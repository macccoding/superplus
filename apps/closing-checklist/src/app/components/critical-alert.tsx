'use client';

interface CriticalAlertProps {
  message: string;
  onDismiss: () => void;
}

export function CriticalAlert({ message, onDismiss }: CriticalAlertProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="bg-surface rounded-card p-6 max-w-sm w-full shadow-xl space-y-4">
        {/* Warning icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
        </div>

        {/* Alert title */}
        <h3 className="text-lg font-heading font-bold text-danger text-center">
          Critical Alert
        </h3>

        {/* Message */}
        <p className="text-sm text-text-primary text-center leading-relaxed">
          {message}
        </p>

        {/* Flagged notice */}
        <div className="bg-danger/5 border border-danger/20 rounded-card px-4 py-3">
          <p className="text-xs text-danger text-center font-medium">
            This has been flagged to management
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={onDismiss}
          className="w-full py-3 bg-danger text-white font-heading font-semibold rounded-button hover:bg-danger/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
