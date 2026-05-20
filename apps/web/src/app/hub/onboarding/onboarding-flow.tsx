'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENT_ONBOARDING_VERSION } from '@superplus/config';
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

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#FFF8F6] flex flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip / Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-[210] min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm active:scale-95 transition-transform"
      >
        {type === 'whats-new' ? (
          <span className="material-symbols-outlined text-on-surface-secondary text-[24px]">close</span>
        ) : (
          <span className="text-sm font-semibold text-on-surface-secondary px-2">Skip</span>
        )}
      </button>

      {/* Slide content */}
      <div
        className="flex-1 min-h-0 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${offset}%)` }}
      >
        <OnboardingSlide
          slide={slide}
          isFirst={current === 0}
          audio={audio}
        />
      </div>

      {/* Bottom bar: progress dots + CTA on last slide */}
      <div className="bg-white px-6 pb-8 pt-2 flex flex-col items-center gap-4">
        {isLast && (
          <button
            onClick={handleComplete}
            disabled={completeOnboarding.isPending}
            className="w-full h-14 bg-brand text-white font-extrabold text-base rounded-[--radius-lg] shadow-md active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {completeOnboarding.isPending ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            ) : (
              type === 'orientation' ? "Let's Go!" : 'Got It!'
            )}
          </button>
        )}

        <OnboardingProgress total={slides.length} current={current} colors={colors} />

        {!isLast && (
          <span className="text-[10px] text-on-surface-secondary/40 font-medium tracking-wider">
            swipe &rarr;
          </span>
        )}
      </div>
    </div>
  );
}
