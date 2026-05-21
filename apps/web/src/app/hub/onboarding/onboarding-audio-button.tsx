'use client';

interface OnboardingAudioButtonProps {
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
  pulse?: boolean;
  size?: number;
}

export function OnboardingAudioButton({
  isPlaying, progress, onToggle, pulse = false, size = 56,
}: OnboardingAudioButtonProps) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  return (
    <button
      onClick={onToggle}
      aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
      className={`relative flex items-center justify-center active:scale-90 transition-transform ${pulse && !isPlaying ? 'animate-pulse' : ''}`}
      style={{ width: size, height: size }}
    >
      {/* Progress ring */}
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="white" strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      {/* Button circle */}
      <div
        className="rounded-full bg-brand flex items-center justify-center shadow-lg"
        style={{ width: size - 8, height: size - 8 }}
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-white"
          style={{ fontSize: size * 0.5, fontVariationSettings: "'FILL' 1" }}
        >
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </div>
    </button>
  );
}
