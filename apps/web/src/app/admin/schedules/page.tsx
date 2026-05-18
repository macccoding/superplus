'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function SchedulesAdminPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const utils = trpc.useUtils();

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekEnd = new Date(monday);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: schedule, isLoading } = trpc.schedules.getWeek.useQuery({ weekStart: monday });

  const generate = trpc.schedules.generate.useMutation({
    onSuccess: () => { utils.schedules.invalidate(); setGenerating(false); setNotes(''); },
    onError: () => setGenerating(false),
  });

  const publish = trpc.schedules.publish.useMutation({
    onSuccess: () => utils.schedules.invalidate(),
  });

  const removeSlot = trpc.schedules.removeSlot.useMutation({
    onSuccess: () => utils.schedules.invalidate(),
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
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
  }

  const roleColors: Record<string, string> = {
    OWNER: 'bg-brand/10 text-brand',
    MANAGER: 'bg-warning/20/30 text-warning',
    SUPERVISOR: 'bg-navy/10 text-navy',
    STAFF: 'bg-surface-cream text-on-surface-secondary',
  };

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
            {monday.toLocaleDateString('en-JM', { month: 'long', day: 'numeric' })} — {weekEnd.toLocaleDateString('en-JM', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {weekOffset === 0 && <span className="text-xs text-brand font-medium">This Week</span>}
          {schedule && (
            <span className={`text-xs font-bold ml-2 px-2 py-0.5 rounded-full ${
              schedule.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 'bg-warning/20/30 text-warning'
            }`}>{schedule.status}</span>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream active:scale-95 transition-all">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
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
            onClick={() => { setGenerating(true); generate.mutate({ weekStart: monday, notes: notes || undefined }); }}
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
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { setGenerating(true); generate.mutate({ weekStart: monday, notes: notes || undefined }); }}
                disabled={generating}
                className="h-12 px-5 bg-surface-cream text-on-surface-secondary font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                Regenerate
              </button>
              <button
                onClick={() => publish.mutate({ scheduleId: schedule.id })}
                disabled={publish.isPending}
                className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">publish</span>
                Publish
              </button>
            </div>
          )}

          {schedule.status === 'PUBLISHED' && schedule.publishedBy && (
            <div className="bg-success/10 rounded-[--radius-lg] p-4 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-success">check_circle</span>
              <span className="text-sm text-success font-medium">
                Published by {schedule.publishedBy.fullName} on {schedule.publishedAt ? new Date(schedule.publishedAt as any).toLocaleDateString() : ''}
              </span>
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
