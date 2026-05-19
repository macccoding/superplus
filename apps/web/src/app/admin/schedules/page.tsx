'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const absenceTypeLabels: Record<string, string> = {
  VACATION_LEAVE: 'Vacation Leave',
  SICK_LEAVE: 'Sick Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  PERSONAL_LEAVE: 'Personal Leave',
  OTHER: 'Other Leave',
};

const jobLaneLabels: Record<string, string> = {
  SUPERVISOR: 'Supervisor',
  PRICING_CLERK: 'Pricing Clerk',
  CASHIER: 'Cashier',
  PRODUCE_MEAT: 'Produce/Meat',
  MERCHANDISER: 'Merchandiser',
};

function getRosterWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function SchedulesAdminPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ userId: '', type: 'VACATION_LEAVE', startDate: '', endDate: '', note: '' });
  const utils = trpc.useUtils();

  const weekStart = getRosterWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: schedule, isLoading } = trpc.schedules.getWeek.useQuery({ weekStart });
  const { data: staff } = trpc.users.list.useQuery({ isActive: true });
  const { data: absences } = trpc.schedules.listAbsences.useQuery({ weekStart });

  const generate = trpc.schedules.generate.useMutation({
    onSuccess: () => { utils.schedules.invalidate(); setGenerating(false); setNotes(''); },
    onError: () => setGenerating(false),
  });

  const regenerate = trpc.schedules.regenerate.useMutation({
    onSuccess: () => { utils.schedules.invalidate(); setGenerating(false); setNotes(''); },
    onError: () => setGenerating(false),
  });

  const publish = trpc.schedules.publish.useMutation({
    onSuccess: () => utils.schedules.invalidate(),
  });

  const removeSlot = trpc.schedules.removeSlot.useMutation({
    onSuccess: () => utils.schedules.invalidate(),
  });

  const createAbsence = trpc.schedules.createAbsence.useMutation({
    onSuccess: () => {
      utils.schedules.listAbsences.invalidate();
      setAbsenceForm({ userId: '', type: 'VACATION_LEAVE', startDate: '', endDate: '', note: '' });
    },
  });

  const deleteAbsence = trpc.schedules.deleteAbsence.useMutation({
    onSuccess: () => utils.schedules.listAbsences.invalidate(),
  });

  const slotsByDate = new Map<string, any[]>();
  if (schedule?.slots) {
    for (const slot of schedule.slots) {
      const dateKey = new Date(slot.date).toISOString().slice(0, 10);
      if (!slotsByDate.has(dateKey)) slotsByDate.set(dateKey, []);
      slotsByDate.get(dateKey)!.push(slot);
    }
  }

  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
  }

  const roleColors: Record<string, string> = {
    OWNER: 'bg-brand/10 text-brand',
    MANAGER: 'bg-warning/15 text-warning',
    SUPERVISOR: 'bg-navy/10 text-navy',
    STAFF: 'bg-surface-cream text-on-surface-secondary',
  };

  const exportSchedule = () => {
    if (!schedule) return;
    const link = document.createElement('a');
    link.href = `/api/schedules/${schedule.id}/xlsx`;
    link.download = `superplus-schedule-${weekStart.toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const defaultDate = weekStart.toISOString().slice(0, 10);
  const absenceStart = absenceForm.startDate || defaultDate;
  const absenceEnd = absenceForm.endDate || absenceStart;
  const canCreateAbsence = absenceForm.userId && absenceStart && absenceEnd;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Schedules</h1>
          <p className="text-on-surface-secondary mt-1">AI-powered shift scheduling</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
        <button onClick={() => setWeekOffset(w => w - 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream active:scale-95 transition-all">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center">
          <p className="font-bold text-on-surface">
            {weekStart.toLocaleDateString('en-JM', { month: 'long', day: 'numeric' })} — {weekEnd.toLocaleDateString('en-JM', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {weekOffset === 0 && <span className="text-xs text-brand font-medium">This Week</span>}
          {schedule && (
            <span className={`text-xs font-bold ml-2 px-2 py-0.5 rounded-full ${
              schedule.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning'
            }`}>{schedule.status}</span>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream active:scale-95 transition-all">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-on-surface">Staff Leave</h2>
            <p className="text-sm text-on-surface-secondary">Vacation, sick, and maternity leave are hard rules for AI generation.</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_150px_150px_150px_1fr_auto]">
          <select
            value={absenceForm.userId}
            onChange={(e) => setAbsenceForm({ ...absenceForm, userId: e.target.value })}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Staff member for leave"
          >
            <option value="">Choose staff</option>
            {(staff ?? []).map((user: any) => (
              <option key={user.id} value={user.id}>{user.fullName} - {jobLaneLabels[user.jobLane] ?? user.jobLane}</option>
            ))}
          </select>
          <select
            value={absenceForm.type}
            onChange={(e) => setAbsenceForm({ ...absenceForm, type: e.target.value })}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Leave type"
          >
            {Object.entries(absenceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            type="date"
            value={absenceStart}
            onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value, endDate: absenceForm.endDate || e.target.value })}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Leave start date"
          />
          <input
            type="date"
            value={absenceEnd}
            onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Leave end date"
          />
          <input
            value={absenceForm.note}
            onChange={(e) => setAbsenceForm({ ...absenceForm, note: e.target.value })}
            placeholder="Optional note"
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm text-on-surface placeholder:text-on-surface-secondary"
          />
          <button
            onClick={() => createAbsence.mutate({
              userId: absenceForm.userId,
              type: absenceForm.type as any,
              startDate: parseInputDate(absenceStart),
              endDate: parseInputDate(absenceEnd),
              note: absenceForm.note || undefined,
            })}
            disabled={!canCreateAbsence || createAbsence.isPending}
            className="h-12 px-4 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
          >
            Add
          </button>
        </div>
        {createAbsence.error && <p className="text-sm font-bold text-error mt-3">{createAbsence.error.message}</p>}
        {absences && absences.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {absences.map((absence: any) => (
              <div key={absence.id} className="h-10 pl-3 pr-1 rounded-full bg-surface-cream flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{absence.user.fullName}</span>
                <span className="text-xs text-on-surface-secondary">{absenceTypeLabels[absence.type] ?? absence.type}</span>
                <span className="text-xs text-on-surface-secondary">{formatShortDate(absence.startDate)}-{formatShortDate(absence.endDate)}</span>
                <button onClick={() => deleteAbsence.mutate({ id: absence.id })} className="w-8 h-8 rounded-full text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : !schedule ? (
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm max-w-xl">
          <div className="text-center mb-6">
            <span className="material-symbols-outlined text-[48px] text-on-surface-secondary mb-2">auto_awesome</span>
            <h2 className="text-lg font-bold text-on-surface">Generate Schedule with AI</h2>
            <p className="text-sm text-on-surface-secondary mt-1">Claude will create an optimized schedule based on staff availability and store hours</p>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes (e.g., 'Give Marcus more morning shifts this week')"
            rows={2}
            className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors mb-4"
          />
          <button
            onClick={() => { setGenerating(true); generate.mutate({ weekStart, notes: notes || undefined }); }}
            disabled={generating}
            className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {generating ? (
              <><span className="material-symbols-outlined animate-spin">progress_activity</span>Generating with AI...</>
            ) : (
              <><span className="material-symbols-outlined">auto_awesome</span>Generate Schedule</>
            )}
          </button>
        </div>
      ) : (
        <div>
          {schedule.status === 'DRAFT' && (
            <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm mb-6">
              <label className="block text-xs font-bold uppercase text-on-surface-secondary mb-2">
                AI adjustment notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: Keep Tamara off Sunday, give cashiers more 11-9 closers, avoid back-to-back 6-9 shifts."
                rows={2}
                className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors mb-4"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setGenerating(true); regenerate.mutate({ scheduleId: schedule.id, notes: notes || undefined }); }}
                  disabled={generating || regenerate.isPending}
                  className="h-12 px-5 bg-surface-cream text-on-surface-secondary font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                  {generating || regenerate.isPending ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  onClick={() => publish.mutate({ scheduleId: schedule.id })}
                  disabled={publish.isPending}
                  className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">publish</span>
                  Publish
                </button>
                <button
                  onClick={exportSchedule}
                  className="h-12 px-5 bg-navy text-on-navy font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Export XLSX
                </button>
              </div>
            </div>
          )}

          {schedule.status === 'PUBLISHED' && schedule.publishedBy && (
            <div className="bg-success/10 rounded-[--radius-lg] p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success">check_circle</span>
                <span className="text-sm text-success font-medium">
                  Published by {schedule.publishedBy.fullName} on {schedule.publishedAt ? new Date(schedule.publishedAt as any).toLocaleDateString() : ''}
                </span>
              </div>
              <button
                onClick={exportSchedule}
                className="h-11 px-4 bg-navy text-on-navy font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export XLSX
              </button>
            </div>
          )}

          <div className="space-y-4">
            {weekDates.map((date) => {
              const dateKey = date.toISOString().slice(0, 10);
              const daySlots = slotsByDate.get(dateKey) || [];
              return (
                <div key={dateKey} className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
                  <div className="bg-navy/5 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-extrabold text-navy">{date.getDate()}</span>
                      <span className="font-bold text-on-surface">{DAY_NAMES[date.getDay()]}</span>
                    </div>
                    <span className="text-xs text-on-surface-secondary">{daySlots.length} shifts</span>
                  </div>
                  {daySlots.length > 0 ? (
                    <div className="divide-y divide-outline-variant/10">
                      {daySlots.map((slot: any) => (
                        <div key={slot.id} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-navy">
                                {slot.user.fullName.split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-on-surface">{slot.user.fullName}</p>
                              <p className="text-xs text-on-surface-secondary">{slot.startTime} — {slot.endTime}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColors[slot.role] || roleColors.STAFF}`}>
                              {slot.role}
                            </span>
                            {schedule.status === 'DRAFT' && (
                              <button onClick={() => removeSlot.mutate({ slotId: slot.id })} className="w-8 h-8 flex items-center justify-center text-error rounded-lg hover:bg-error/5">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-sm text-on-surface-secondary text-center">No shifts scheduled</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleDateString('en-JM', { month: 'short', day: 'numeric' });
}
