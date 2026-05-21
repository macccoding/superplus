'use client';

import { useState } from 'react';
import { OnboardingAudioButton } from './onboarding-audio-button';

export interface SlideData {
  id: string;
  eyebrow?: string;
  heading: string;
  subtext: string;
  caption?: string;
  bullets?: string[];
  icon: string;
  color: string;
  imageUrl: string;
  audioUrl: string;
  narrationScript: string;
}

interface OnboardingSlideProps {
  slide: SlideData;
  isFirst: boolean;
  current: number;
  total: number;
  audio: { isPlaying: boolean; progress: number; toggle: () => void };
}

export function OnboardingSlide({ slide, isFirst, current, total, audio }: OnboardingSlideProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showFallback = !slide.imageUrl || imgError || !imgLoaded;

  return (
    <div className="h-full flex flex-col" aria-label={slide.narrationScript}>
      <div
        className="relative flex h-[34%] min-h-[230px] shrink-0 items-center justify-center overflow-hidden px-5 pb-5 pt-16 sm:h-[40%]"
        style={{
          background: `linear-gradient(135deg, ${slide.color}15 0%, ${slide.color}08 100%)`,
        }}
      >
        <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-on-surface shadow-sm">
          <span aria-hidden="true" className="material-symbols-outlined text-[17px]" style={{ color: slide.color, fontVariationSettings: "'FILL' 1" }}>
            {slide.icon}
          </span>
          <span>{slide.eyebrow ?? `Step ${current + 1}`}</span>
        </div>
        {showFallback && (
          <div
            className="flex items-center justify-center rounded-3xl shadow-sm"
            style={{
              width: 128, height: 128,
              backgroundColor: `${slide.color}20`,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 64, color: slide.color, fontVariationSettings: "'FILL' 1" }}
            >
              {slide.icon}
            </span>
          </div>
        )}
        {slide.imageUrl && (
          <img
            src={slide.imageUrl}
            alt={slide.heading}
            className={`h-full max-h-full w-full max-w-[440px] rounded-[28px] object-cover object-top shadow-[0_20px_40px_rgba(27,58,92,0.12)] transition-opacity duration-300 ${imgLoaded && !imgError ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <div className="relative z-10 -mt-7 flex min-h-0 flex-1 flex-col rounded-t-[32px] bg-white px-5 pb-3 pt-6 shadow-[0_-8px_28px_rgba(27,58,92,0.08)]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="rounded-full bg-surface-cream px-3 py-1 text-xs font-extrabold text-on-surface-secondary">
            {current + 1} of {total}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: slide.color }}>
            Staff orientation
          </span>
        </div>

        <h1 className="text-[30px] font-extrabold leading-tight text-on-surface">
          {slide.heading}
        </h1>
        <p className="mt-1 text-lg font-bold text-on-surface-secondary">
          {slide.subtext}
        </p>
        {slide.caption && (
          <p className="mt-4 text-[15px] leading-6 text-on-surface">
            {slide.caption}
          </p>
        )}

        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {slide.bullets.map((bullet) => (
              <li key={bullet} className="flex min-h-11 items-start gap-3 rounded-[--radius-lg] bg-surface px-3 py-2.5">
                <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[20px]" style={{ color: slide.color, fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span className="text-sm font-bold leading-5 text-on-surface">{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-center gap-3 rounded-[--radius-lg] bg-surface-cream p-3">
          <OnboardingAudioButton
            isPlaying={audio.isPlaying}
            progress={audio.progress}
            onToggle={audio.toggle}
            pulse={isFirst}
            size={48}
          />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-on-surface">{audio.isPlaying ? 'Playing orientation' : 'Listen to Keisha'}</p>
            <p className="truncate text-xs text-on-surface-secondary">Audio explains this step in plain language.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
