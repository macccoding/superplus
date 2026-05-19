'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getRosterWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function MySchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getRosterWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: slots, isLoading } = trpc.schedules.mySchedule.useQuery({ weekStart });

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">My Schedule</h2>
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setWeekOffset(w => w - 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream active:scale-95 transition-all">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-on-surface">
              {weekStart.toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })} — {weekEnd.toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })}
            </p>
            {weekOffset === 0 && <span className="text-xs text-brand font-medium">This Week</span>}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream active:scale-95 transition-all">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </section>

      <section className="px-5 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : slots && slots.length > 0 ? (
          slots.map((slot: any) => {
            const date = new Date(slot.date);
            return (
              <div key={slot.id} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-[--radius-lg] bg-brand/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand">{SHORT_DAYS[date.getDay()]}</span>
                  <span className="text-lg font-extrabold text-brand">{date.getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-on-surface">{DAY_NAMES[date.getDay()]}</p>
                  <p className="text-sm text-on-surface-secondary mt-0.5">
                    {slot.startTime} — {slot.endTime}
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-cream text-on-surface-secondary">
                  {slot.role}
                </span>
              </div>
            );
          })
        ) : (
          <EmptyState icon="event_busy" title="No schedule published" description="Your manager hasn't published a schedule for this week yet" />
        )}
      </section>
    </div>
  );
}
