'use client';

import { useCallback, useRef, useState } from 'react';

export function useOnboardingAudio(audioUrl: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset state when URL changes (slide change)
  if (audioUrl !== currentUrlRef.current) {
    currentUrlRef.current = audioUrl;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
  }

  const toggle = useCallback(() => {
    if (!currentUrlRef.current) return;

    // Create Audio lazily on first play — inside the user gesture chain
    // so iOS Safari allows playback
    if (!audioRef.current) {
      const audio = new Audio(currentUrlRef.current);
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) setProgress(audio.currentTime / audio.duration);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(1);
      });
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (progress >= 1) audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, progress]);

  return { toggle, isPlaying, progress, duration: 0 };
}
