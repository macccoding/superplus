'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OnboardingAudioButton } from './onboarding-audio-button';
import { useOnboardingAudio } from './use-onboarding-audio';

interface WalkthroughStep {
  id: string;
  target: string;
  title?: string;
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
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

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
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    const target = document.querySelector(`[data-walkthrough="${step?.target}"]`);
    target?.scrollIntoView({ block: 'center', inline: 'nearest' });

    updateSpotlight();
    frameRef.current = window.requestAnimationFrame(updateSpotlight);
    timeoutRef.current = window.setTimeout(updateSpotlight, 220);

    const observer = new ResizeObserver(updateSpotlight);
    if (target) observer.observe(target);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    document.addEventListener('animationend', updateSpotlight, true);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      observer.disconnect();
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
      document.removeEventListener('animationend', updateSpotlight, true);
    };
  }, [step, updateSpotlight]);

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

  const tooltipHeight = 236;
  const tooltipTop = y + h + 16;
  const tooltipBelow = tooltipTop + tooltipHeight < window.innerHeight - 88;
  const tooltipY = Math.max(16, tooltipBelow ? tooltipTop : y - tooltipHeight - 16);

  const overlay = (
    <div ref={overlayRef} className="fixed inset-0 z-[60]">
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

      <div
        data-walkthrough-spotlight={step.target}
        className="absolute rounded-2xl border-2 border-white/80 shadow-[0_0_0_6px_rgba(255,255,255,0.18)] pointer-events-none"
        style={{ left: x, top: y, width: w, height: h }}
      />

      <div
        data-walkthrough-card={step.target}
        className="absolute left-4 right-4 bg-white rounded-[--radius-lg] p-5 shadow-xl"
        style={{ top: tooltipY, maxWidth: 340, margin: '0 auto' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
            Step {current + 1} of {steps.length}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">
            Hub tour
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-on-surface">{step.title ?? step.target}</h2>
        <p className="mt-2 text-sm font-medium leading-5 text-on-surface-secondary">{step.tooltip}</p>

        <div className="mt-4 flex items-center gap-3">
          {step.audioUrl && (
            <OnboardingAudioButton
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              onToggle={audio.toggle}
              size={40}
            />
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand text-sm font-extrabold text-white transition-transform active:scale-[0.97]"
          >
            <span>{current < steps.length - 1 ? 'Next' : 'Finish tour'}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{current < steps.length - 1 ? 'arrow_forward' : 'check'}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="absolute bottom-8 left-1/2 min-h-12 -translate-x-1/2 rounded-full bg-white/10 px-5 text-sm font-bold text-white/80 transition-colors active:text-white"
      >
        Skip tour
      </button>
    </div>
  );

  return createPortal(overlay, document.body);
}
