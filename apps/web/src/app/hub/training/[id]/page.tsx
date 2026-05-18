'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function GuideViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: guide, isLoading } = trpc.training.getGuide.useQuery({ id });
  const [currentStep, setCurrentStep] = useState(0);

  if (isLoading) return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>;
  if (!guide) return null;

  const step = guide.steps[currentStep];
  const totalSteps = guide.steps.length;

  return (
    <div className="px-5 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>

      <h2 className="text-xl font-bold text-on-surface mb-1">{guide.title}</h2>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 bg-surface-cream rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} />
        </div>
        <span className="text-xs font-bold text-on-surface-secondary">Step {currentStep + 1} of {totalSteps}</span>
      </div>

      {/* Current step */}
      {step && (
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
              <span className="text-on-brand font-bold text-sm">{currentStep + 1}</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">{step.title}</h3>
          </div>

          {step.imageUrl && (
            <img src={step.imageUrl} alt={step.title} className="w-full rounded-[--radius-lg] mb-4 max-h-64 object-cover" />
          )}

          <p className="text-on-surface leading-relaxed text-base">{step.content}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">chevron_left</span>
          Back
        </button>
        {currentStep < totalSteps - 1 ? (
          <button
            onClick={() => setCurrentStep(s => s + 1)}
            className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            Next
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        ) : (
          <button
            onClick={() => router.back()}
            className="flex-1 h-14 bg-success text-white font-bold rounded-[--radius-lg] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">check_circle</span>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
