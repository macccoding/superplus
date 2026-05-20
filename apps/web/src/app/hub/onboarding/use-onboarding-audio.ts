'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Single persistent Audio element — once "unlocked" by user gesture on iOS,
// it can be played programmatically on subsequent slide changes
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;

export function useOnboardingAudio(audioUrl: string | null) {
  const prevUrlRef = useRef<string | null>(null);
  const autoplayRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // When URL changes (slide change), stop current audio and prep for autoplay
  useEffect(() => {
    if (audioUrl === prevUrlRef.current) return;
    prevUrlRef.current = audioUrl;
    setIsPlaying(false);
    setProgress(0);

    if (sharedAudio) {
      sharedAudio.pause();
    }

    // Autoplay if the audio element was already unlocked (user tapped play before)
    if (unlocked && audioUrl && sharedAudio) {
      sharedAudio.src = audioUrl;
      sharedAudio.currentTime = 0;
      sharedAudio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [audioUrl]);

  // Attach progress/end listeners once
  useEffect(() => {
    if (!sharedAudio) return;
    const audio = sharedAudio;
    const onTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnded = () => { setIsPlaying(false); setProgress(1); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = useCallback(() => {
    if (!prevUrlRef.current) return;

    // Create and unlock the shared Audio on first user tap
    if (!sharedAudio) {
      sharedAudio = new Audio(prevUrlRef.current);
      sharedAudio.addEventListener('timeupdate', () => {
        if (sharedAudio!.duration) setProgress(sharedAudio!.currentTime / sharedAudio!.duration);
      });
      sharedAudio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(1);
      });
    }

    const audio = sharedAudio;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Set src if it changed
      if (audio.src !== prevUrlRef.current) {
        audio.src = prevUrlRef.current!;
      }
      if (progress >= 1) audio.currentTime = 0;
      audio.play().then(() => {
        unlocked = true;
        setIsPlaying(true);
      }).catch(() => {});
    }
  }, [isPlaying, progress]);

  return { toggle, isPlaying, progress, duration: 0 };
}
