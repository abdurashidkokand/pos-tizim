'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CameraManager } from '@/lib/cameraManager';
import type { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

const DEBOUNCE_MS = 800;
const BARCODE_FORMATS = [
  'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf',
];

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

// ── Native BarcodeDetector — full-frame scan ──────────────────────────────
function useNativeScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onDetect: (code: string) => void,
  enabled: boolean,
) {
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !detectorRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    try {
      const results: { rawValue: string }[] = await detectorRef.current.detect(video);
      if (results.length > 0 && results[0].rawValue) {
        onDetect(results[0].rawValue);
      }
    } catch {}
    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef, onDetect]);

  useEffect(() => {
    if (!enabled) return;
    const BD = (window as any).BarcodeDetector;
    if (!BD) return;
    detectorRef.current = new BD({ formats: BARCODE_FORMATS });
    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, detect]);
}

// ── ZXing fallback — full-frame scan ──────────────────────────────────────
function useZxingScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onDetect: (code: string) => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 800,
      });

      const video = videoRef.current;
      if (!video) return;

      reader.decodeFromVideoElement(video, (result) => {
        if (cancelled) return;
        if (result) {
          const code = result.getText();
          if (code) onDetect(code);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, videoRef, onDetect]);
}

// ── Main component ────────────────────────────────────────────────────────
export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState('');

  // Debounce lock: prevent duplicate detections within DEBOUNCE_MS
  const lockRef = useRef(false);
  const handleDetect = useCallback(
    (code: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setLastScanned(code);
      beep();
      onScan(code);
      setTimeout(() => {
        lockRef.current = false;
      }, DEBOUNCE_MS);
    },
    [onScan],
  );

  // Detect which engine to use
  const hasNative = typeof window !== 'undefined' && !!(window as any).BarcodeDetector;

  useNativeScanner(videoRef, handleDetect, scanning && hasNative);
  useZxingScanner(videoRef, handleDetect, scanning && !hasNative);

  // Camera — use CameraManager (persistent stream, no re-prompt on navigate)
  useEffect(() => {
    let mounted = true;
    CameraManager.getStream()
      .then((stream) => {
        if (!mounted) return;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().then(() => setScanning(true)).catch(() => setScanning(true));
        }
      })
      .catch((e: Error) => {
        if (!mounted) return;
        const msg =
          e.name === 'NotAllowedError'
            ? 'Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.'
            : e.name === 'NotFoundError'
              ? 'Kamera topilmadi.'
              : 'Kamera xatosi: ' + e.message;
        setError(msg);
      });

    // Don't stop tracks on unmount — CameraManager keeps them alive
    return () => {
      mounted = false;
      const v = videoRef.current;
      if (v) v.srcObject = null; // detach but don't stop
    };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      setManualCode('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-gray-600" />
            <h3 className="font-semibold text-sm">Barcode / QR skaner</h3>
            {scanning && !error && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
            {!hasNative && scanning && (
              <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                ZXing
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center text-xl font-light rounded-lg hover:bg-gray-100 transition"
          >
            ×
          </button>
        </div>

        {/* Camera view — full-frame, no ROI crop */}
        {error ? (
          <div className="p-6 text-sm text-red-600 bg-red-50 min-h-32 flex items-center">
            <div>
              <p className="font-medium mb-1"><AlertTriangle className="w-4 h-4 inline mr-1" />Kameraga kirib bo&apos;lmadi</p>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div className="relative bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Full-frame guide overlay */}
            <div className="absolute inset-3 pointer-events-none border-2 border-white/30 rounded-xl" />
            {/* Corner markers */}
            <div className="absolute inset-3 pointer-events-none">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-blue-400 rounded-br-lg" />
            </div>
            {/* Last scanned flash */}
            {lastScanned && (
              <div className="absolute bottom-2 inset-x-2 bg-green-500/90 text-white text-center py-1.5 px-3 rounded-lg text-sm font-mono animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />{lastScanned}
              </div>
            )}
          </div>
        )}

        {/* Manual input fallback — always visible */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-center text-gray-400 mb-2">
            {error
              ? 'Barcodeni qo\u02bblda kiriting:'
              : 'Barcode ko\u02bbrinmasa qo\u02bblda kiriting:'}
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Barcode / kod"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
            >
              OK
            </button>
          </form>
        </div>

        <p className="px-4 py-3 text-xs text-center text-gray-400">
          {hasNative ? 'Native BarcodeDetector' : 'ZXing (universal)'}
          {' · '}Butun kadr skanerlanmoqda
        </p>
      </div>
    </div>
  );
}
