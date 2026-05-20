'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OnboardingAudioButton } from './onboarding-audio-button';
import { useOnboardingAudio } from './use-onboarding-audio';

interface WalkthroughStep {
  id: string;
  target: string;
  tooltip: string;
  audioUrl: string;
}

interface OnboardingWalkthroughProps {
  steps: WalkthroughStep[];
  onComplete: () => void;
}

export function OnboardingWalkthrough({ steps, onComplete }: OnboardingWalkthroughProps) {
  const [current, setCurrent] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const audio = useOnboardingAudio(step?.audioUrl || null);

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-walkthrough="${step.target}"]`);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    }
  }, [step]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  const handleNext = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      onComplete();
    }
  };

  if (!step || !spotlightRect) return null;

  // Clip path to create spotlight hole
  const padding = 12;
  const x = spotlightRect.left - padding;
  const y = spotlightRect.top - padding;
  const w = spotlightRect.width + padding * 2;
  const h = spotlightRect.height + padding * 2;
  const r = 16;

  const clipPath = `
    M 0 0 H 100vw V 100vh H 0 Z
    M ${x + r} ${y}
    H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r}
    V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h}
    H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r}
    V ${y + r} Q ${x} ${y} ${x + r} ${y}
    Z
  `;

  // Tooltip position — below the spotlight if there's room, otherwise above
  const tooltipTop = y + h + 16;
  const tooltipBelow = tooltipTop + 200 < window.innerHeight;
  const tooltipY = tooltipBelow ? tooltipTop : y - 200 - 16;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[60]">
      {/* Dark overlay with spotlight hole */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={x} y={y} width={w} height={h}
              rx={r} ry={r} fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      <div
        className="absolute rounded-2xl border-2 border-white/30 pointer-events-none"
        style={{ left: x, top: y, width: w, height: h }}
      />

      {/* Tooltip card */}
      <div
        className="absolute left-4 right-4 bg-white rounded-[--radius-lg] p-5 shadow-xl"
        style={{ top: tooltipY, maxWidth: 340, margin: '0 auto' }}
      >
        <p className="text-base font-bold text-on-surface mb-3">{step.tooltip}</p>

        <div className="flex items-center gap-3">
          {step.audioUrl && (
            <OnboardingAudioButton
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              onToggle={audio.toggle}
              size={40}
            />
          )}
          <button
            onClick={handleNext}
            className="flex-1 h-11 bg-brand text-white font-bold text-sm rounded-[--radius-lg] active:scale-[0.97] transition-transform"
          >
            {current < steps.length - 1 ? 'Got it' : 'Got it!'}
          </button>
        </div>
      </div>

      {/* Skip tour */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium active:text-white/90 transition-colors min-h-[48px] px-4"
      >
        Skip tour
      </button>
    </div>
  );
}
