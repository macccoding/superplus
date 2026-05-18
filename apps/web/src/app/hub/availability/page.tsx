'use client';

import { trpc } from '@/lib/trpc-client';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityPage() {
  const utils = trpc.useUtils();
  const { data: days, isLoading } = trpc.availability.get.useQuery();

  const update = trpc.availability.update.useMutation({
    onSuccess: () => utils.availability.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">My Availability</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Tell your manager which days you can work</p>
      </section>

      <section className="px-5 pb-24 space-y-2">
        {days?.map((day: any) => (
          <div key={day.dayOfWeek} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${day.available ? 'bg-success/10' : 'bg-surface-cream'}`}>
                <span className={`material-symbols-outlined text-[20px] ${day.available ? 'text-success' : 'text-on-surface-secondary'}`}>
                  {day.available ? 'check' : 'close'}
                </span>
              </div>
              <div>
                <p className={`font-bold ${day.available ? 'text-on-surface' : 'text-on-surface-secondary'}`}>{DAY_NAMES[day.dayOfWeek]}</p>
                {day.note && <p className="text-xs text-on-surface-secondary italic">{day.note}</p>}
              </div>
            </div>
            <button
              onClick={() => update.mutate({ dayOfWeek: day.dayOfWeek, available: !day.available })}
              className={`w-14 h-8 rounded-full relative transition-all duration-200 ${day.available ? 'bg-success' : 'bg-outline-variant'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm ${day.available ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
