'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { OnboardingSlide, type SlideData } from './onboarding-slide';
import { OnboardingProgress } from './onboarding-progress';
import { useOnboardingAudio } from './use-onboarding-audio';

interface OnboardingFlowProps {
  slides: SlideData[];
  type: 'orientation' | 'whats-new';
  version: number;
}

export function OnboardingFlow({ slides, type, version }: OnboardingFlowProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const completeOnboarding = trpc.users.completeOnboarding.useMutation();
  const utils = trpc.useUtils();

  const slide = slides[current];
  const isLast = current === slides.length - 1;
  const audio = useOnboardingAudio(slide?.audioUrl || null);
  const colors = slides.map((s) => s.color);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= slides.length || transitioning) return;
    setTransitioning(true);
    setOffset((index - current) * -100);
    setTimeout(() => {
      setCurrent(index);
      setOffset(0);
      setTransitioning(false);
    }, 300);
  }, [current, slides.length, transitioning]);

  const handleComplete = async () => {
    try {
      await completeOnboarding.mutateAsync({ version });
      utils.users.me.invalidate();
      if (type === 'orientation') {
        router.replace('/hub?walkthrough=1');
      } else {
        router.replace('/hub');
      }
    } catch {
      router.replace('/hub');
    }
  };

  const handleSkip = () => handleComplete();

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const onTouchEnd = () => {
    const threshold = 60;
    if (touchDeltaX.current < -threshold && current < slides.length - 1) {
      goTo(current + 1);
    } else if (touchDeltaX.current > threshold && current > 0) {
      goTo(current - 1);
    }
    touchDeltaX.current = 0;
  };

  if (!slide) return null;
  const completeLabel = type === 'orientation' ? 'Start Hub' : 'Got It';
  const nextLabel = isLast ? completeLabel : 'Next';
  const closeLabel = type === 'whats-new' ? 'Close update' : 'Skip orientation';

  return (
    <div
      className="fixed inset-0 z-[200] flex h-dvh w-dvw flex-col overflow-hidden bg-[#FFF8F6]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={handleSkip}
        className="absolute right-4 top-4 z-[210] flex min-h-12 min-w-12 items-center justify-center rounded-full bg-white/90 text-on-surface-secondary shadow-[0_10px_30px_rgba(27,58,92,0.14)] backdrop-blur-sm transition-transform active:scale-95"
      >
        {type === 'whats-new' ? (
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">close</span>
        ) : (
          <span className="text-sm font-semibold text-on-surface-secondary px-2">Skip</span>
        )}
      </button>

      <div
        className="flex-1 min-h-0 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${offset}%)` }}
      >
        <OnboardingSlide
          slide={slide}
          isFirst={current === 0}
          current={current}
          total={slides.length}
          audio={audio}
        />
      </div>

      <div className="bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(27,58,92,0.06)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0 || transitioning}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-[--radius-lg] bg-surface-cream text-on-surface-secondary transition-all active:scale-[0.97] disabled:opacity-30"
            aria-label="Previous slide"
          >
            <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col items-center gap-1">
            <OnboardingProgress total={slides.length} current={current} colors={colors} />
            <span className="text-xs font-bold text-on-surface-secondary">
              Swipe or tap Next
            </span>
          </div>
          <button
            type="button"
            onClick={() => (isLast ? handleComplete() : goTo(current + 1))}
            disabled={completeOnboarding.isPending}
            className="flex min-h-12 min-w-[112px] items-center justify-center gap-2 rounded-[--radius-lg] bg-brand px-5 text-sm font-extrabold text-white shadow-md transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {completeOnboarding.isPending ? (
              <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            ) : (
              <>
                <span>{nextLabel}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{isLast ? 'check' : 'arrow_forward'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
