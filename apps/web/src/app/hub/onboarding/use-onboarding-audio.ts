'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useOnboardingAudio(audioUrl: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Reset when URL changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
  }, [audioUrl]);

  const toggle = useCallback(() => {
    if (!audioUrl) return;

    // Create Audio lazily — inside user gesture chain for iOS
    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
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
  }, [audioUrl, isPlaying, progress]);

  return { toggle, isPlaying, progress };
}
