'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[current];

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-walkthrough="${step.target}"]`);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    }
  }, [step]);

  // Find the target element — retry if not in DOM yet
  useEffect(() => {
    updateSpotlight();

    // Retry with rAF in case element isn't rendered yet
    let retries = 0;
    const retryInterval = setInterval(() => {
      if (spotlightRect || retries > 20) {
        clearInterval(retryInterval);
        return;
      }
      updateSpotlight();
      retries++;
    }, 200);

    // Debounced resize listener
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSpotlight, 100);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearInterval(retryInterval);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, [updateSpotlight, spotlightRect]);

  const handleNext = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
      setSpotlightRect(null); // Reset so retry kicks in for next target
    } else {
      onComplete();
    }
  };

  if (!step || !spotlightRect) return null;

  const padding = 12;
  const x = spotlightRect.left - padding;
  const y = spotlightRect.top - padding;
  const w = spotlightRect.width + padding * 2;
  const h = spotlightRect.height + padding * 2;
  const r = 16;

  // Tooltip position — below target if room, otherwise above
  const tooltipHeight = tooltipRef.current?.offsetHeight ?? 120;
  const tooltipBelow = y + h + 16 + tooltipHeight < window.innerHeight;
  const tooltipY = tooltipBelow ? y + h + 16 : Math.max(8, y - tooltipHeight - 16);

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
    >
      {/* Dark overlay with spotlight hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#spotlight-mask)" />
      </svg>

      {/* Spotlight border glow */}
      <div
        className="absolute rounded-2xl border-2 border-white/30 pointer-events-none"
        style={{ left: x, top: y, width: w, height: h }}
      />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="absolute left-4 right-4 bg-white rounded-[--radius-lg] p-5 shadow-xl"
        style={{ top: tooltipY, maxWidth: 340, margin: '0 auto' }}
      >
        <p className="text-base font-bold text-on-surface mb-3">{step.tooltip}</p>
        <button
          onClick={handleNext}
          className="w-full h-11 bg-brand text-white font-bold text-sm rounded-[--radius-lg] active:scale-[0.97] transition-transform"
        >
          {current < steps.length - 1 ? 'Got it' : 'Got it!'}
        </button>
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
