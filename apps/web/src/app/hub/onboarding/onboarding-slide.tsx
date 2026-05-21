'use client';

import { useState } from 'react';
import { OnboardingAudioButton } from './onboarding-audio-button';

export interface SlideData {
  id: string;
  heading: string;
  subtext: string;
  icon: string;
  color: string;
  imageUrl: string;
  videoUrl?: string;
  audioUrl: string;
  narrationScript: string;
}

interface OnboardingSlideProps {
  slide: SlideData;
  isFirst: boolean;
  audio: { isPlaying: boolean; progress: number; toggle: () => void };
}

export function OnboardingSlide({ slide, isFirst, audio }: OnboardingSlideProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const hasVideo = !!slide.videoUrl && !videoError;
  const showImageFallback = !hasVideo && (!slide.imageUrl || imgError || !imgLoaded);

  return (
    <div className="h-full flex flex-col" aria-label={slide.narrationScript}>
      {/* Media area — top 60% for video, 55% for image */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          height: hasVideo ? '60%' : '55%',
          background: hasVideo ? '#000' : `linear-gradient(135deg, ${slide.color}15 0%, ${slide.color}08 100%)`,
        }}
      >
        {/* Video (primary) */}
        {slide.videoUrl && !videoError && (
          <video
            src={slide.videoUrl}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setVideoError(true)}
          />
        )}

        {/* Fallback icon (no image or video) */}
        {!hasVideo && showImageFallback && (
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 120, height: 120,
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

        {/* Fallback image (no video) */}
        {!hasVideo && slide.imageUrl && (
          <img
            src={slide.imageUrl}
            alt={slide.heading}
            className={`absolute inset-0 w-full h-full object-contain p-6 transition-opacity duration-300 ${imgLoaded && !imgError ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 bg-white rounded-t-[32px] -mt-6 relative z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] flex flex-col items-center px-6 pt-8">
        <h1 className="text-[28px] font-extrabold text-on-surface leading-tight">
          {slide.heading}
        </h1>
        <p className="text-base text-on-surface-secondary mt-2">
          {slide.subtext}
        </p>

        {/* Audio button — only show when no video (video has native audio) */}
        {!hasVideo && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <OnboardingAudioButton
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              onToggle={audio.toggle}
              pulse={isFirst}
            />
            {isFirst && !audio.isPlaying && audio.progress === 0 && (
              <span className="text-xs font-semibold text-on-surface-secondary/60 uppercase tracking-widest">
                Tap to listen
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
