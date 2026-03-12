'use client';

interface SubmissionSuccessProps {
  onSubmitAnother: () => void;
}

export function SubmissionSuccess({ onSubmitAnother }: SubmissionSuccessProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2ECC71"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
        Thanks for your suggestion!
      </h2>
      <p className="text-sm text-text-secondary text-center max-w-xs mb-8">
        Your feedback has been submitted and will be reviewed by the management team.
      </p>

      <button
        onClick={onSubmitAnother}
        className="px-8 py-3 bg-brand-primary text-white font-heading font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
      >
        Submit Another
      </button>
    </div>
  );
}
