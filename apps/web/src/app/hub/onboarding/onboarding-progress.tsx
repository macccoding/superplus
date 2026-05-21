'use client';

interface OnboardingProgressProps {
  total: number;
  current: number;
  colors: string[];
}

export function OnboardingProgress({ total, current, colors }: OnboardingProgressProps) {
  return (
    <div className="flex gap-2 items-center justify-center" role="progressbar" aria-label="Slide progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1}>
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === current;
        return (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-full transition-all duration-300"
            style={{
              width: isActive ? 10 : 7,
              height: isActive ? 10 : 7,
              backgroundColor: isActive ? (colors[i] || '#E31837') : 'rgba(0,0,0,0.12)',
              boxShadow: isActive ? `0 0 8px ${colors[i] || '#E31837'}40` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
