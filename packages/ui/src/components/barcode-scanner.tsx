'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    async function startScanner() {
      try {
        // Dynamically import html5-qrcode to keep bundle small
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!mounted || !videoRef.current) return;

        const scanner = new Html5Qrcode('barcode-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {
            // Scan failure — ignore, keep scanning
          }
        );
      } catch (err) {
        if (mounted) {
          setError('Camera access denied or not available. Please check permissions.');
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <h2 className="text-white font-heading font-semibold">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white"
          aria-label="Close scanner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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

      {/* Scanner viewport */}
      <div className="flex-1 flex items-center justify-center">
        {error ? (
          <div className="text-center px-6">
            <p className="text-white text-sm mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white text-brand-primary rounded-button font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <div
            id="barcode-reader"
            ref={videoRef}
            className="w-full max-w-sm mx-auto"
          />
        )}
      </div>

      {/* Hint */}
      <div className="px-4 py-4 text-center">
        <p className="text-white/70 text-sm">
          Point the camera at a barcode to scan
        </p>
      </div>
    </div>
  );
}
