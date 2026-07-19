import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { playShutter } from '../lib/feedback';
import { MAX_RESERVE } from '../lib/storage';

export interface PendingCapture {
  /** Image figée plein écran (dataURL). */
  frameDataURL: string;
  /** Pixels réduits envoyés au serveur pour la loterie. */
  imageData: ImageData;
  /** Vignette de provenance conservée dans la collection. */
  thumbDataURL: string;
}

const SERVER_IMAGE_MAX = 480;
const THUMB_MAX = 200;

/** Dessine une source dans un canvas borné à maxSize, renvoie le canvas. */
function drawScaled(
  source: HTMLVideoElement | HTMLImageElement,
  maxSize: number,
): HTMLCanvasElement | null {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return null;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function buildCapture(source: HTMLVideoElement | HTMLImageElement): PendingCapture | null {
  const full = drawScaled(source, 1280);
  const server = drawScaled(source, SERVER_IMAGE_MAX);
  const thumb = drawScaled(source, THUMB_MAX);
  if (!full || !server || !thumb) return null;
  const ctx = server.getContext('2d', { willReadFrequently: true })!;
  return {
    frameDataURL: full.toDataURL('image/jpeg', 0.8),
    imageData: ctx.getImageData(0, 0, server.width, server.height),
    thumbDataURL: thumb.toDataURL('image/jpeg', 0.6),
  };
}

export function CaptureScreen({ onCapture }: { onCapture: (p: PendingCapture) => void }) {
  const { state, earnCapture } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraState, setCameraState] = useState<'pending' | 'ok' | 'denied'>('pending');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);

  const available = state.economy.available;

  useEffect(() => {
    let acquired: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          acquired.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(acquired);
        setCameraState('ok');
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    }

    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      void start();
    } else {
      setCameraState('denied');
    }

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Attache le flux une fois que l'élément <video> est monté.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [stream, cameraState]);

  const fireCapture = useCallback(
    (source: HTMLVideoElement | HTMLImageElement) => {
      const pending = buildCapture(source);
      if (!pending) return;
      playShutter();
      onCapture(pending);
    },
    [onCapture],
  );

  const onShutter = useCallback(() => {
    if (available <= 0 || busy) return;
    if (cameraState === 'ok' && videoRef.current) {
      fireCapture(videoRef.current);
    } else {
      fileRef.current?.click();
    }
  }, [available, busy, cameraState, fireCapture]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || available <= 0) return;
      setBusy(true);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        fireCapture(img);
        URL.revokeObjectURL(url);
        setBusy(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setBusy(false);
      };
      img.src = url;
    },
    [available, fireCapture],
  );

  return (
    <div className="camera-stage">
      {cameraState === 'ok' ? (
        <>
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="viewfinder">
            <span className="corner" />
          </div>
        </>
      ) : (
        <div className="camera-fallback">
          <span style={{ fontSize: 40 }}>📷</span>
          {cameraState === 'pending' ? (
            <p>Démarrage de la caméra…</p>
          ) : (
            <p>
              Caméra indisponible ou refusée.
              <br />
              Le déclencheur ouvrira ta galerie : choisis une photo, le serveur y pigera un
              pixel au hasard.
            </p>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />

      <div className="capture-hud-top">
        <div className="capture-counter">
          <span>
            {available}/{MAX_RESERVE}
          </span>
          <span className="capture-dots">
            {Array.from({ length: MAX_RESERVE }, (_, i) => (
              <span key={i} className={`capture-dot${i < available ? ' full' : ''}`} />
            ))}
          </span>
        </div>
        <button className="debug-earn" onClick={earnCapture} disabled={available >= MAX_RESERVE}>
          +1 capture (marcher 2 km)
        </button>
      </div>

      {available <= 0 && (
        <p className="no-captures-hint">
          Plus de captures aujourd'hui. Reviens après minuit — ou marche un peu.
        </p>
      )}

      <div className="capture-hud-bottom">
        <button
          className="shutter"
          onClick={onShutter}
          disabled={available <= 0 || busy || cameraState === 'pending'}
          aria-label="Capturer"
        >
          <span className="shutter-core" />
        </button>
      </div>
    </div>
  );
}
