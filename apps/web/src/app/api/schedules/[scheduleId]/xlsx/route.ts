import { NextResponse } from 'next/server';
import { db } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';
import { auth } from '@/server/auth';
import { buildScheduleWorkbook } from '@/server/schedule-xlsx';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, 'MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { scheduleId } = await params;
  const schedule = await db.shiftSchedule.findFirst({
    where: {
      id: scheduleId,
      storeId: session.user.storeId,
    },
    include: {
      store: true,
      slots: {
        include: { user: { select: { id: true, fullName: true, role: true, jobLane: true, isActive: true } } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }

  const weekEnd = new Date(schedule.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const slotUserIds = schedule.slots.map(slot => slot.userId);
  const [staff, absences] = await Promise.all([
    db.user.findMany({
      where: {
        storeId: session.user.storeId,
        OR: [{ isActive: true }, { id: { in: slotUserIds } }],
      },
      orderBy: [{ jobLane: 'asc' }, { fullName: 'asc' }],
    }),
    db.staffAbsence.findMany({
      where: {
        storeId: session.user.storeId,
        startDate: { lte: weekEnd },
        endDate: { gte: schedule.weekStart },
      },
      include: { user: { select: { fullName: true } } },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  const workbook = await buildScheduleWorkbook({
    schedule,
    staff,
    absences,
    weekStart: schedule.weekStart,
  });
  const filename = `superplus-schedule-${formatDate(schedule.weekStart)}.xlsx`;

  return new Response(workbook, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
