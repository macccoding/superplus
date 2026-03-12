'use client';

import { useRef, useState } from 'react';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  onUploadComplete?: (url: string) => void;
  maxSizeMB?: number;
  className?: string;
  label?: string;
}

export function PhotoCapture({
  onCapture,
  maxSizeMB = 5,
  className,
  label = 'Add Photo',
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    onCapture(file);
  }

  function handleRemove() {
    setPreview(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-label={label}
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Captured"
            className="w-full h-40 object-cover rounded-card border border-gray-200"
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 rounded-full text-white"
            aria-label="Remove photo"
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
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-card text-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <span className="text-sm font-medium">{label}</span>
        </button>
      )}

      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
