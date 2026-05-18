import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, managerProcedure } from '../init';
import { ScheduleStatus } from '@superplus/db';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const schedulesRouter = router({
  getWeek: protectedProcedure
    .input(z.object({ weekStart: z.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.shiftSchedule.findUnique({
        where: {
          storeId_weekStart: { storeId: ctx.storeId, weekStart: input.weekStart },
        },
        include: {
          slots: {
            include: { user: { select: { id: true, fullName: true, role: true } } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          },
          publishedBy: { select: { fullName: true } },
        },
      });
    }),

  generate: managerProcedure
    .input(z.object({
      weekStart: z.date(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const store = await ctx.db.store.findUniqueOrThrow({
        where: { id: ctx.storeId },
      });

      if (!store.openTime || !store.closeTime || !store.openDays) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Store hours not configured. Set opening hours in Store settings first.',
        });
      }

      const staff = await ctx.db.user.findMany({
        where: { storeId: ctx.storeId, isActive: true },
        include: { staffAvailability: true },
      });

      const prevWeekStart = new Date(input.weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevSchedule = await ctx.db.shiftSchedule.findUnique({
        where: {
          storeId_weekStart: { storeId: ctx.storeId, weekStart: prevWeekStart },
        },
        include: { slots: { include: { user: true } } },
      });

      const weekEnd = new Date(input.weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const openDays = store.openDays!.split(',').map((d: string) => d.trim());

      const staffDescriptions = staff.map(s => {
        const avail = s.staffAvailability;
        const availDays = avail.filter(a => a.available).map(a => DAY_NAMES[a.dayOfWeek]).join(', ');
        const unavailDays = avail.filter(a => !a.available).map(a => {
          const name = DAY_NAMES[a.dayOfWeek];
          return a.note ? `${name} (${a.note})` : name;
        }).join(', ');
        return `- ${s.fullName} (${s.role}) — Available: ${availDays || 'all days'}${unavailDays ? ` | Not available: ${unavailDays}` : ''}`;
      }).join('\n');

      let prevScheduleInfo = '';
      if (prevSchedule && prevSchedule.slots.length > 0) {
        prevScheduleInfo = '\n\nPrevious week schedule (for continuity and fairness):\n' +
          prevSchedule.slots.map(s =>
            `- ${s.user.fullName}: ${new Date(s.date).toISOString().slice(0, 10)} ${s.startTime}-${s.endTime}`
          ).join('\n');
      }

      const userIdMap = staff.map(s => `${s.fullName}: "${s.id}"`).join('\n');

      const prompt = `You are a shift scheduler for a supermarket in Jamaica.

Store: ${store.name}, open ${store.openTime}-${store.closeTime}, days: ${openDays.join(', ')}

Staff (use their exact userIds):
${userIdMap}

Staff availability:
${staffDescriptions}

Requirements:
- At least 1 SUPERVISOR or MANAGER on every shift
- Distribute hours fairly — no one should work every day
- Respect availability constraints strictly
- Standard shift length: 8 hours (can vary 6-10)
- Morning shift: ${store.openTime}-15:00, Evening shift: 13:00-${store.closeTime}
${prevScheduleInfo}
${input.notes ? `\nManager notes: ${input.notes}` : ''}

Generate a schedule for the week ${input.weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}.
Only schedule on store open days: ${openDays.join(', ')}.

Return ONLY valid JSON — no markdown, no explanation. Format:
[{"userId":"...","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","role":"STAFF|SUPERVISOR|MANAGER|OWNER"}]`;

      const { text } = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        prompt,
      });

      let slots: { userId: string; date: string; startTime: string; endTime: string; role: string }[];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array found');
        slots = JSON.parse(jsonMatch[0]);
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI generated invalid schedule. Please try again.',
        });
      }

      // Validate AI output: filter to valid users and map roles from DB
      const staffMap = new Map(staff.map(s => [s.id, s]));
      slots = slots
        .filter(s => staffMap.has(s.userId))
        .map(s => ({ ...s, role: staffMap.get(s.userId)!.role }));

      const existing = await ctx.db.shiftSchedule.findUnique({
        where: { storeId_weekStart: { storeId: ctx.storeId, weekStart: input.weekStart } },
      });
      if (existing) {
        if (existing.status === ScheduleStatus.PUBLISHED) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Schedule already published for this week' });
        }
        await ctx.db.shiftSchedule.delete({ where: { id: existing.id } });
      }

      // Strip user IDs from stored prompt for privacy
      const sanitizedPrompt = prompt.replace(/: "[a-z0-9]+"/g, ': "[redacted]"');

      return ctx.db.shiftSchedule.create({
        data: {
          storeId: ctx.storeId,
          weekStart: input.weekStart,
          generatedBy: 'ai',
          aiPrompt: sanitizedPrompt,
          aiResponse: text,
          slots: {
            create: slots.map(s => ({
              userId: s.userId,
              date: new Date(s.date),
              startTime: s.startTime,
              endTime: s.endTime,
              role: s.role,
            })),
          },
        },
        include: {
          slots: {
            include: { user: { select: { id: true, fullName: true, role: true } } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          },
        },
      });
    }),

  updateSlot: managerProcedure
    .input(z.object({
      slotId: z.string(),
      userId: z.string().optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const slot = await ctx.db.shiftSlot.findFirstOrThrow({
        where: { id: input.slotId },
        include: { schedule: true },
      });
      if (slot.schedule.storeId !== ctx.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (slot.schedule.status === ScheduleStatus.PUBLISHED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit published schedule' });
      }
      const { slotId, ...data } = input;
      return ctx.db.shiftSlot.update({ where: { id: slotId }, data });
    }),

  addSlot: managerProcedure
    .input(z.object({
      scheduleId: z.string(),
      userId: z.string(),
      date: z.date(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      role: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await ctx.db.shiftSchedule.findFirstOrThrow({
        where: { id: input.scheduleId, storeId: ctx.storeId },
      });
      if (schedule.status === ScheduleStatus.PUBLISHED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit published schedule' });
      }
      return ctx.db.shiftSlot.create({
        data: {
          scheduleId: input.scheduleId,
          userId: input.userId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          role: input.role,
        },
        include: { user: { select: { id: true, fullName: true, role: true } } },
      });
    }),

  removeSlot: managerProcedure
    .input(z.object({ slotId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const slot = await ctx.db.shiftSlot.findFirstOrThrow({
        where: { id: input.slotId },
        include: { schedule: true },
      });
      if (slot.schedule.storeId !== ctx.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (slot.schedule.status === ScheduleStatus.PUBLISHED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit published schedule' });
      }
      return ctx.db.shiftSlot.delete({ where: { id: input.slotId } });
    }),

  publish: managerProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.shiftSchedule.update({
        where: { id: input.scheduleId, storeId: ctx.storeId, status: ScheduleStatus.DRAFT },
        data: {
          status: ScheduleStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: ctx.user.id,
        },
      });
    }),

  mySchedule: protectedProcedure
    .input(z.object({ weekStart: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const weekStart = input?.weekStart ?? getMonday(new Date());
      return ctx.db.shiftSlot.findMany({
        where: {
          userId: ctx.user.id,
          schedule: {
            storeId: ctx.storeId,
            weekStart,
            status: ScheduleStatus.PUBLISHED,
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    }),
});

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
