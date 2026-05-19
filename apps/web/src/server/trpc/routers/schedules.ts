import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, managerProcedure } from '../init';
import { AbsenceType, ScheduleStatus, Role } from '@superplus/db';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { notifyStoreStaff } from '../../notifications';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_INDEX_BY_NAME = new Map(DAY_NAMES.map((day, index) => [day.toLowerCase(), index]));

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const aiSlotSchema = z.object({
  userId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeSchema,
  endTime: timeSchema,
  role: z.string().optional(),
});

type AiSlot = z.infer<typeof aiSlotSchema>;
type AbsenceWithUser = {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  type: AbsenceType;
  note: string | null;
  user: { fullName: string };
};

const absenceTypeLabels: Record<AbsenceType, string> = {
  VACATION_LEAVE: 'Vacation leave',
  SICK_LEAVE: 'Sick leave',
  MATERNITY_LEAVE: 'Maternity leave',
  PERSONAL_LEAVE: 'Personal leave',
  OTHER: 'Other leave',
};

const SUPERPLUS_ROSTER_RULES = `
Historical SuperPlus roster patterns inferred from April/May 2026 schedules:
- The roster is a Sunday-to-Saturday grid. Sunday is not automatically closed; schedule it when the store is configured open.
- Shifts are written as a green start time and red end time. OFF and leave are explicit non-working states.
- Common shift templates are 06:00-21:00, 06:00-16:00, 07:00-17:00, 08:00-18:00, 09:00-19:00, 10:00-18:00, 10:00-17:00, and 11:00-21:00.
- 06:00-21:00 is a long open-to-close shift. Use it sparingly for roles that historically do it, usually not on back-to-back days.
- Every open day needs an opening layer around 06:00-08:00, a day layer around 07:00-19:00, and a closing layer ending 21:00.
- Supervisor coverage is mandatory from opening through close. Prefer 2-3 supervisor/manager shifts on busy days: one opener, one closer, and optionally one mid/day shift.
- Cashier coverage should include both early and late coverage. Busy days and Saturdays usually need at least two cashiers, including a closer ending 21:00.
- Pricing clerk work is normally stable day work, usually 08:00-18:00, with Sunday and one other day off unless manager notes say otherwise.
- Produce/meat coverage is normally 07:00/09:00 start and 17:00/19:00 finish, with Friday/Saturday coverage important.
- Merchandisers usually work 07:00-17:00, 09:00-19:00, 06:00-21:00, or 11:00-21:00 depending on coverage need.
- Staff should normally have 2-3 OFF days per week. Avoid scheduling anyone 7 days.
- Spread closing shifts fairly. Do not give one person all the 21:00 closes unless manager notes specifically require it.
- Rotate weekends: if previous schedules show someone worked Sunday or Saturday, prefer giving them at least one weekend OFF this week where coverage allows.
- Leave, sick leave, maternity leave, and unavailable days are hard constraints. Do not schedule those days.
- If manager notes or staff names identify a job lane such as cashier, merchandiser, pricing clerk, or produce/meat, keep that person in that lane. Otherwise, use permission role for coverage and balance STAFF across cashier/merchandising style shifts.
`;

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
            include: { user: { select: { id: true, fullName: true, role: true, jobLane: true } } },
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
      return createAiSchedule(ctx, {
        weekStart: input.weekStart,
        notes: input.notes,
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
      role: z.nativeEnum(Role),
    }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await ctx.db.shiftSchedule.findFirstOrThrow({
        where: { id: input.scheduleId, storeId: ctx.storeId },
      });
      if (schedule.status === ScheduleStatus.PUBLISHED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit published schedule' });
      }
      await ctx.db.user.findFirstOrThrow({
        where: { id: input.userId, storeId: ctx.storeId },
      });
      return ctx.db.shiftSlot.create({
        data: {
          scheduleId: input.scheduleId,
          userId: input.userId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          role: input.role,
        },
        include: { user: { select: { id: true, fullName: true, role: true, jobLane: true } } },
      });
    }),

  listAbsences: managerProcedure
    .input(z.object({
      weekStart: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const weekEnd = new Date(input.weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return ctx.db.staffAbsence.findMany({
        where: {
          storeId: ctx.storeId,
          startDate: { lte: weekEnd },
          endDate: { gte: input.weekStart },
        },
        include: {
          user: { select: { id: true, fullName: true, jobLane: true } },
          createdBy: { select: { fullName: true } },
        },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
      });
    }),

  createAbsence: managerProcedure
    .input(z.object({
      userId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      type: z.nativeEnum(AbsenceType),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const startDate = startOfDay(input.startDate);
      const endDate = startOfDay(input.endDate);
      if (endDate < startDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End date must be after start date' });
      }
      await ctx.db.user.findFirstOrThrow({
        where: { id: input.userId, storeId: ctx.storeId, isActive: true },
      });
      return ctx.db.staffAbsence.create({
        data: {
          storeId: ctx.storeId,
          userId: input.userId,
          startDate,
          endDate,
          type: input.type,
          note: input.note?.trim() || null,
          createdById: ctx.user.id,
        },
        include: {
          user: { select: { id: true, fullName: true, jobLane: true } },
          createdBy: { select: { fullName: true } },
        },
      });
    }),

  deleteAbsence: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.staffAbsence.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      return ctx.db.staffAbsence.delete({ where: { id: input.id } });
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
      const result = await ctx.db.shiftSchedule.update({
        where: { id: input.scheduleId, storeId: ctx.storeId, status: ScheduleStatus.DRAFT },
        data: {
          status: ScheduleStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: ctx.user.id,
        },
      });
      try {
        await notifyStoreStaff(ctx.db, ctx.storeId, 'SCHEDULE_PUBLISHED', 'Schedule published', 'Check your shifts for this week', '/hub/schedule');
      } catch {}
      return result;
    }),

  regenerate: managerProcedure
    .input(z.object({
      scheduleId: z.string(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.shiftSchedule.findFirstOrThrow({
        where: { id: input.scheduleId, storeId: ctx.storeId, status: ScheduleStatus.DRAFT },
      });
      return createAiSchedule(ctx, {
        weekStart: existing.weekStart,
        notes: input.notes,
        replaceScheduleId: input.scheduleId,
      });
    }),

  mySchedule: protectedProcedure
    .input(z.object({ weekStart: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const weekStart = input?.weekStart ?? getRosterWeekStart(new Date());
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

async function createAiSchedule(
  ctx: { db: any; storeId: string; user: { id: string } },
  input: { weekStart: Date; notes?: string; replaceScheduleId?: string },
) {
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
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });

  if (staff.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'No active staff found for this store.',
    });
  }

  const weekEnd = new Date(input.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const openDayIndexes = parseOpenDays(store.openDays);
  const openDays = [...openDayIndexes].sort().map(day => DAY_NAMES[day]);

  const previousWeekStarts = [1, 2, 3, 4].map(offset => {
    const date = new Date(input.weekStart);
    date.setDate(date.getDate() - offset * 7);
    return date;
  });
  const previousSchedules = await ctx.db.shiftSchedule.findMany({
    where: {
      storeId: ctx.storeId,
      weekStart: { in: previousWeekStarts },
    },
    include: { slots: { include: { user: true }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] } },
    orderBy: { weekStart: 'desc' },
  });
  const absences = await ctx.db.staffAbsence.findMany({
    where: {
      storeId: ctx.storeId,
      startDate: { lte: weekEnd },
      endDate: { gte: input.weekStart },
    },
    include: { user: { select: { fullName: true } } },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
  });

  const prompt = buildSchedulePrompt({
    store,
    staff,
    previousSchedules,
    weekStart: input.weekStart,
    weekEnd,
    openDays,
    absences,
    notes: input.notes,
  });

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt,
    temperature: 0.2,
  });

  const parsedSlots = parseAiSlots(text);
  const slots = validateAiSlots(parsedSlots, staff, absences, input.weekStart, openDayIndexes);

  const existing = input.replaceScheduleId
    ? await ctx.db.shiftSchedule.findUnique({ where: { id: input.replaceScheduleId } })
    : await ctx.db.shiftSchedule.findUnique({
        where: { storeId_weekStart: { storeId: ctx.storeId, weekStart: input.weekStart } },
      });

  if (existing) {
    if (existing.storeId !== ctx.storeId) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    if (existing.status === ScheduleStatus.PUBLISHED) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Schedule already published for this week' });
    }
    await ctx.db.shiftSchedule.delete({ where: { id: existing.id } });
  }

  const sanitizedPrompt = sanitizePrompt(prompt);

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
          date: dateFromKey(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          role: s.role,
        })),
      },
    },
    include: {
      slots: {
        include: { user: { select: { id: true, fullName: true, role: true, jobLane: true } } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      },
      publishedBy: { select: { fullName: true } },
    },
  });
}

function buildSchedulePrompt(input: {
  store: any;
  staff: any[];
  previousSchedules: any[];
  weekStart: Date;
  weekEnd: Date;
  openDays: string[];
  absences: AbsenceWithUser[];
  notes?: string;
}) {
  const staffDescriptions = input.staff.map(s => {
    const avail = s.staffAvailability || [];
    const explicitAvailable = avail.filter((a: any) => a.available).map((a: any) => DAY_NAMES[a.dayOfWeek]).join(', ');
    const unavailable = avail.filter((a: any) => !a.available).map((a: any) => {
      const name = DAY_NAMES[a.dayOfWeek];
      return a.note ? `${name} (${a.note})` : name;
    }).join(', ');
    return `- ${s.fullName} (${s.role}, ${jobLaneLabel(s.jobLane)}) userId="${s.id}" | Available: ${explicitAvailable || 'all days'}${unavailable ? ` | Not available: ${unavailable}` : ''}`;
  }).join('\n');

  const previousScheduleInfo = buildPreviousScheduleInfo(input.previousSchedules);
  const absenceInfo = buildAbsenceInfo(input.absences);

  return `You are the AI shift scheduler for SuperPlus Food Stores in Jamaica.

Your job is to create a manager-reviewable weekly roster that follows real SuperPlus scheduling patterns.

Store:
- Name: ${input.store.name}
- Customer hours: ${input.store.openTime}-${input.store.closeTime}
- Open days: ${input.openDays.join(', ')}
- Operational coverage may start at 06:00 for opening prep when needed.

Staff:
${staffDescriptions}

${SUPERPLUS_ROSTER_RULES}

Hard requirements:
- Respect unavailable days strictly.
- Only schedule on configured open days: ${input.openDays.join(', ')}.
- Use exact userId values from Staff. Do not invent users.
- Use 24-hour HH:MM times.
- Use only dates from ${formatDate(input.weekStart)} through ${formatDate(input.weekEnd)}.
- At least one SUPERVISOR, MANAGER, or OWNER must be scheduled for every open day.
- Prefer coverage through 21:00 on every open day unless manager notes say the store closes earlier.
- Keep shifts realistic for a supermarket floor team; do not create tiny 1-3 hour shifts.
- Prefer the historical shift templates unless coverage requires a close variant.
- Job lane is operational, not just permission. Keep cashiers on cashier-style coverage, merchandisers on floor/stock coverage, and pricing clerks on pricing/day coverage.
- Return a draft roster, not an explanation.
${previousScheduleInfo}
${absenceInfo}
${input.notes ? `\nManager notes, overrides, leave, or department rules:\n${input.notes}` : ''}

Generate the schedule for ${formatDate(input.weekStart)} to ${formatDate(input.weekEnd)}.

Return ONLY valid JSON, no markdown and no commentary. Format:
[{"userId":"...","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","role":"STAFF|SUPERVISOR|MANAGER|OWNER"}]`;
}

function buildAbsenceInfo(absences: AbsenceWithUser[]) {
  if (absences.length === 0) {
    return '';
  }

  const lines = absences.map(absence => (
    `- ${absence.user.fullName}: ${formatDate(absence.startDate)} to ${formatDate(absence.endDate)} (${absenceTypeLabels[absence.type]})${absence.note ? ` - ${absence.note}` : ''}`
  ));

  return `\nStructured absences. These are hard no-schedule constraints:\n${lines.join('\n')}`;
}

function buildPreviousScheduleInfo(previousSchedules: any[]) {
  if (previousSchedules.length === 0) {
    return '';
  }

  const lines = previousSchedules.flatMap(schedule => (
    schedule.slots.map((slot: any) => {
      const hours = shiftHours(slot.startTime, slot.endTime);
      return `- Week ${formatDate(schedule.weekStart)}: ${slot.user.fullName} ${formatDate(slot.date)} ${slot.startTime}-${slot.endTime} (${hours}h)`;
    })
  ));

  return `\nPrevious schedules for continuity, weekend rotation, and fairness:\n${lines.join('\n')}`;
}

function parseAiSlots(text: string): AiSlot[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return z.array(aiSlotSchema).parse(JSON.parse(jsonMatch[0]));
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI generated an invalid schedule. Please try again with clearer notes.',
    });
  }
}

function validateAiSlots(rawSlots: AiSlot[], staff: any[], absences: AbsenceWithUser[], weekStart: Date, openDayIndexes: Set<number>) {
  const staffMap = new Map(staff.map(s => [s.id, s]));
  const absencesByUser = groupAbsencesByUser(absences);
  const allowedDates = getWeekDateKeys(weekStart, openDayIndexes);
  const seenUserDays = new Set<string>();
  const slots: Array<AiSlot & { role: string }> = [];

  for (const rawSlot of rawSlots) {
    const staffMember = staffMap.get(rawSlot.userId);
    if (!staffMember) continue;
    if (!allowedDates.has(rawSlot.date)) continue;
    if (timeToMinutes(rawSlot.startTime) >= timeToMinutes(rawSlot.endTime)) continue;

    const date = dateFromKey(rawSlot.date);
    const unavailable = (staffMember.staffAvailability || []).some((availability: any) => (
      availability.dayOfWeek === date.getDay() && availability.available === false
    ));
    if (unavailable) continue;
    const absent = (absencesByUser.get(rawSlot.userId) || []).some(absence => (
      date >= startOfDay(absence.startDate) && date <= startOfDay(absence.endDate)
    ));
    if (absent) continue;

    const userDayKey = `${rawSlot.userId}:${rawSlot.date}`;
    if (seenUserDays.has(userDayKey)) continue;
    seenUserDays.add(userDayKey);

    slots.push({
      ...rawSlot,
      role: staffMember.role,
    });
  }

  if (slots.length === 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI did not produce any valid shifts. Check store hours, staff availability, and manager notes.',
    });
  }

  const scheduledSupervisorDays = new Set(
    slots
      .filter(slot => ['OWNER', 'MANAGER', 'SUPERVISOR'].includes(slot.role))
      .map(slot => slot.date),
  );
  const uncoveredDays = [...allowedDates].filter(date => !scheduledSupervisorDays.has(date));
  if (uncoveredDays.length > 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `AI missed supervisor coverage on ${uncoveredDays.join(', ')}. Please regenerate with a coverage note.`,
    });
  }

  return slots;
}

function groupAbsencesByUser(absences: AbsenceWithUser[]) {
  const grouped = new Map<string, AbsenceWithUser[]>();
  for (const absence of absences) {
    if (!grouped.has(absence.userId)) grouped.set(absence.userId, []);
    grouped.get(absence.userId)!.push(absence);
  }
  return grouped;
}

function jobLaneLabel(jobLane: string) {
  return jobLane
    .toLowerCase()
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(jobLane === 'PRODUCE_MEAT' ? '/' : ' ');
}

function parseOpenDays(openDays: string) {
  const parsed = openDays
    .split(',')
    .map(day => DAY_INDEX_BY_NAME.get(day.trim().slice(0, 3).toLowerCase()))
    .filter((day): day is number => typeof day === 'number');
  return new Set(parsed.length > 0 ? parsed : [0, 1, 2, 3, 4, 5, 6]);
}

function getWeekDateKeys(weekStart: Date, openDayIndexes: Set<number>) {
  const dates = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    if (openDayIndexes.has(date.getDay())) {
      dates.add(formatDate(date));
    }
  }
  return dates;
}

function sanitizePrompt(prompt: string) {
  return prompt.replace(/userId="[^"]+"/g, 'userId="[redacted]"');
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  const clean = new Date(date);
  clean.setHours(0, 0, 0, 0);
  return clean;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function shiftHours(startTime: string, endTime: string) {
  return Math.max(0, (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60);
}

function getRosterWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
