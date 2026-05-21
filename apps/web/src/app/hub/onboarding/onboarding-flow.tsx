'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import type { SlideData } from './onboarding-slide';

interface OnboardingFlowProps {
  slides: SlideData[];
  type: 'orientation' | 'whats-new';
  version: number;
}

export function OnboardingFlow({ slides, type, version }: OnboardingFlowProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [showCta, setShowCta] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const completeOnboarding = trpc.users.completeOnboarding.useMutation();
  const utils = trpc.useUtils();

  const slide = slides[current];
  const isLast = current === slides.length - 1;
  const hasVideo = !!slide?.videoUrl;

  const handleVideoEnded = useCallback(() => {
    if (isLast) {
      setShowCta(true);
    } else {
      // Auto-advance to next video
      setCurrent((prev) => prev + 1);
    }
  }, [isLast]);

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

  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col h-dvh w-dvw">
      {/* Skip / Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-[210] min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-95 transition-transform"
      >
        {type === 'whats-new' ? (
          <span className="material-symbols-outlined text-white text-[24px]">close</span>
        ) : (
          <span className="text-sm font-semibold text-white/80 px-2">Skip</span>
        )}
      </button>

      {/* Video area — full screen */}
      {hasVideo ? (
        <video
          ref={videoRef}
          key={slide.id}
          src={slide.videoUrl}
          autoPlay
          playsInline
          className="flex-1 w-full object-cover"
          onEnded={handleVideoEnded}
        />
      ) : (
        /* Fallback: illustration mode for slides without video */
        <div className="flex-1 flex flex-col">
          <div
            className="flex-1 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${slide.color}15 0%, ${slide.color}08 100%)` }}
          >
            {slide.imageUrl ? (
              <img src={slide.imageUrl} alt={slide.heading} className="max-h-full max-w-full object-contain p-8" />
            ) : (
              <div className="flex items-center justify-center rounded-full" style={{ width: 120, height: 120, backgroundColor: `${slide.color}20` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 64, color: slide.color, fontVariationSettings: "'FILL' 1" }}>{slide.icon}</span>
              </div>
            )}
          </div>
          {slide.heading && (
            <div className="bg-[#FFF8F6] px-6 py-8 text-center">
              <h1 className="text-[28px] font-extrabold text-on-surface">{slide.heading}</h1>
              {slide.subtext && <p className="text-base text-on-surface-secondary mt-2">{slide.subtext}</p>}
            </div>
          )}
        </div>
      )}

      {/* CTA overlay — appears after last video ends */}
      {showCta && (
        <div className="absolute inset-0 z-[220] bg-black/60 flex items-center justify-center">
          <div className="bg-white rounded-[20px] p-8 mx-6 max-w-sm w-full text-center shadow-2xl">
            <span className="material-symbols-outlined text-brand text-[48px] mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
            <h2 className="text-2xl font-extrabold text-on-surface">You're all set!</h2>
            <p className="text-sm text-on-surface-secondary mt-2 mb-6">
              You can replay this anytime from your Profile.
            </p>
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
          </div>
        </div>
      )}

      {/* Progress bar at bottom */}
      {!showCta && (
        <div className="absolute bottom-0 left-0 right-0 z-[210] px-4 pb-6 pt-16 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <div key={s.id} className="flex-1 h-1 rounded-full overflow-hidden bg-white/20">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${i < current ? 'bg-white w-full' : i === current ? 'bg-white animate-pulse' : ''}`}
                  style={{ width: i < current ? '100%' : i === current ? '50%' : '0%' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
