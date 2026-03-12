'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationBannerProps {
  type?: NotificationType;
  message: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
  className?: string;
}

const typeClasses: Record<NotificationType, string> = {
  info: 'bg-brand-secondary/10 border-brand-secondary/30 text-brand-secondary',
  success: 'bg-success/10 border-success/30 text-success',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  error: 'bg-danger/10 border-danger/30 text-danger',
};

const iconPaths: Record<NotificationType, string> = {
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  success: 'M9 12l2 2 4-4m6 2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  warning: 'M12 9v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
};

export function NotificationBanner({
  type = 'info',
  message,
  onDismiss,
  autoDismissMs,
  className,
}: NotificationBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismissMs) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-card border',
        typeClasses[type],
        className
      )}
      role="alert"
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={iconPaths[type]} />
      </svg>
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onDismiss && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
