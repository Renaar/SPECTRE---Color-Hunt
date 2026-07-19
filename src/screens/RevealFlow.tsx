import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { CaptureResult, OwnedColor, Rarity } from '../types';
import type { PendingCapture } from './CaptureScreen';
import { submitCapture, claimColor } from '../server/fakeServer';
import { useStore } from '../lib/store';
import { textColorOn } from '../lib/color';
import { allSeriesProgress, type SeriesProgress } from '../lib/series';
import { RarityBadge } from '../components/RarityBadge';
import {
  playSuspense,
  playReveal,
  playTaken,
  playSeriesComplete,
  vibrate,
} from '../lib/feedback';

type Phase =
  | 'lottery'
  | 'spark'
  | 'flood'
  | 'free'
  | 'taken'
  | 'engraved'
  | 'series'
  | 'error';

const MIN_SUSPENSE_MS = 1800;

function celebrate(rarity: Rarity) {
  playReveal(rarity);
  const base = { zIndex: 300, disableForReducedMotion: true } as const;
  if (rarity === 'commune') {
    confetti({ ...base, particleCount: 30, spread: 50, origin: { y: 0.6 } });
  } else if (rarity === 'rare') {
    confetti({ ...base, particleCount: 90, spread: 70, origin: { y: 0.6 } });
  } else if (rarity === 'epique') {
    confetti({ ...base, particleCount: 140, spread: 100, origin: { y: 0.6 } });
    setTimeout(
      () => confetti({ ...base, particleCount: 80, spread: 120, origin: { y: 0.4 } }),
      250,
    );
  } else {
    const gold = ['#FFD700', '#FFF3B0', '#FFB347', '#FFFFFF'];
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        confetti({
          ...base,
          particleCount: 120,
          spread: 160,
          startVelocity: 40,
          colors: gold,
          origin: { x: 0.2 + Math.random() * 0.6, y: 0.3 + Math.random() * 0.4 },
        });
      }, i * 320);
    }
  }
}

export function RevealFlow({
  pending,
  onClose,
}: {
  pending: PendingCapture;
  onClose: () => void;
}) {
  const { state, refundCapture, addColor, toggleWishlist, markSeriesComplete } = useStore();
  const [phase, setPhase] = useState<Phase>('lottery');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [name, setName] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [wished, setWished] = useState(false);
  const [newSeries, setNewSeries] = useState<SeriesProgress[]>([]);
  const startedRef = useRef(false);

  // Lancement de la loterie : le serveur choisit le pixel, on entretient le
  // suspense pendant au moins MIN_SUSPENSE_MS.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    playSuspense();
    const minWait = new Promise((r) => setTimeout(r, MIN_SUSPENSE_MS));
    Promise.all([submitCapture(pending.imageData), minWait])
      .then(([res]) => {
        setResult(res);
        setPhase('spark');
      })
      .catch(() => {
        refundCapture();
        setPhase('error');
      });
  }, [pending, refundCapture]);

  // Enchaînement spark → flood → résultat.
  useEffect(() => {
    if (phase === 'spark') {
      vibrate(20);
      const t = setTimeout(() => setPhase('flood'), 700);
      return () => clearTimeout(t);
    }
    if (phase === 'flood' && result) {
      const t = setTimeout(() => {
        if (result.status === 'free') {
          setPhase('free');
          celebrate(result.rarity);
        } else {
          setPhase('taken');
          playTaken();
        }
      }, 750);
      return () => clearTimeout(t);
    }
  }, [phase, result]);

  const submitName = useCallback(async () => {
    if (!result || result.status !== 'free' || claiming) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setClaiming(true);
    const res = await claimColor(result.hex, trimmed, state.pseudo || 'toi');
    if (!res.ok) {
      // Course perdue : quelqu'un l'a prise entre-temps (rarissime en proto).
      setPhase('taken');
      playTaken();
      setClaiming(false);
      return;
    }
    const owned: OwnedColor = {
      hex: result.hex,
      name: res.entry.name,
      rarity: result.rarity,
      capturedAt: res.entry.claimedAt,
      provenanceThumb: pending.thumbDataURL,
    };
    addColor(owned);

    // Détection de séries nouvellement complétées.
    const nextCollection = [owned, ...state.collection];
    const done = allSeriesProgress(nextCollection).filter(
      (p) => p.done && !state.completedSeries.includes(p.def.id),
    );
    done.forEach((p) => markSeriesComplete(p.def.id));
    setNewSeries(done);
    setClaiming(false);
    setPhase('engraved');
  }, [result, claiming, name, state, addColor, markSeriesComplete, pending.thumbDataURL]);

  const finishEngraved = useCallback(() => {
    if (newSeries.length > 0) {
      setPhase('series');
      playSeriesComplete();
    } else {
      onClose();
    }
  }, [newSeries, onClose]);

  const hex = result?.hex ?? '#000000';
  const onColor = textColorOn(hex);
  const pixelLeft = result ? `${result.pixel.x * 100}%` : '50%';
  const pixelTop = result ? `${result.pixel.y * 100}%` : '50%';
  const showPhoto = phase === 'lottery' || phase === 'spark' || phase === 'flood';
  const floodDone =
    phase === 'free' || phase === 'taken' || phase === 'engraved' || phase === 'series';

  return (
    <div className="reveal-overlay" style={{ background: floodDone ? hex : '#000' }}>
      {showPhoto && (
        <img src={pending.frameDataURL} className="reveal-photo" alt="" draggable={false} />
      )}

      {/* Balayage du suspense */}
      {phase === 'lottery' && (
        <>
          <motion.div
            className="scan-line"
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.p
            className="lottery-caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            Le serveur tire un pixel…
          </motion.p>
        </>
      )}

      {/* Le pixel élu s'illumine */}
      {(phase === 'spark' || phase === 'flood') && result && (
        <motion.div
          className="pixel-spark"
          style={{ left: pixelLeft, top: pixelTop, background: hex }}
          initial={{ scale: 0, boxShadow: '0 0 0 0 rgba(255,255,255,0)' }}
          animate={{
            scale: [0, 2.2, 1.6],
            boxShadow: [
              '0 0 0 0 rgba(255,255,255,0)',
              `0 0 40px 14px ${hex}`,
              `0 0 24px 8px ${hex}`,
            ],
          }}
          transition={{ duration: 0.65 }}
        />
      )}

      {/* La couleur envahit l'écran depuis le pixel */}
      {phase === 'flood' && (
        <motion.div
          className="color-flood"
          style={{ left: pixelLeft, top: pixelTop, background: hex, width: '300vmax', height: '300vmax' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.75, ease: [0.3, 0, 0.2, 1] }}
        />
      )}

      <AnimatePresence>
        {/* ── Couleur libre : nommage ── */}
        {phase === 'free' && result?.status === 'free' && (
          <motion.div
            className="reveal-content"
            style={{ color: onColor }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
          >
            <p className="reveal-status">Couleur libre — elle est à toi</p>
            <p className="reveal-hex">{hex}</p>
            <RarityBadge rarity={result.rarity} />
            <div className="name-form">
              <p className="reveal-title">Baptise ta couleur</p>
              <input
                className="name-input"
                value={name}
                maxLength={40}
                placeholder="Son nom pour l'éternité…"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submitName()}
                autoFocus
              />
              <span className="name-count">{name.length}/40</span>
              <button
                className="btn btn--block"
                onClick={() => void submitName()}
                disabled={!name.trim() || claiming}
              >
                {claiming ? 'Gravure…' : 'Graver ce nom'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Couleur déjà prise : doux-amer ── */}
        {phase === 'taken' && result?.status === 'taken' && (
          <motion.div
            className="reveal-content"
            style={{ color: onColor }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
          >
            <p className="reveal-status">Déjà découverte</p>
            <p className="reveal-hex">{hex}</p>
            <div className="taken-card">
              <p className="reveal-title">« {result.name} »</p>
              <p style={{ opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
                Cette couleur appartient à <strong>{result.owner}</strong>. Il ne peut y en
                avoir qu'un.
              </p>
              <button
                className="btn btn--ghost btn--block"
                onClick={() => {
                  toggleWishlist(hex);
                  setWished((w) => !w);
                }}
                style={{ color: onColor, borderColor: 'currentColor', marginTop: 10 }}
              >
                {wished ? '♥ Dans ta liste de convoitises' : '♡ Convoiter cette couleur'}
              </button>
              <button className="btn btn--block" onClick={onClose} style={{ marginTop: 4 }}>
                Continuer la chasse
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Nom gravé ── */}
        {phase === 'engraved' && result?.status === 'free' && (
          <motion.div
            className="reveal-content"
            style={{ color: onColor }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <p className="reveal-hex">{hex}</p>
            <p className="reveal-title">« {name.trim() }»</p>
            <p className="engraved">Découverte par {state.pseudo || 'toi'} — pour toujours</p>
            <button className="btn" onClick={finishEngraved} style={{ marginTop: 24 }}>
              {newSeries.length > 0 ? 'Continuer…' : 'Retour à la chasse'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Série complétée ── */}
      {phase === 'series' && newSeries.length > 0 && (
        <div className="series-celebration">
          <motion.div
            className="series-artifact"
            style={{
              backgroundImage: `linear-gradient(135deg, ${newSeries[0].matched.join(', ')})`,
            }}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.45, duration: 1 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="reveal-status" style={{ color: '#ffcc4d' }}>
              Série complétée
            </p>
            <p className="reveal-title" style={{ margin: '8px 0' }}>
              {newSeries[0].def.title}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              {newSeries[0].def.description}
            </p>
          </motion.div>
          <button className="btn" onClick={onClose} style={{ marginTop: 12 }}>
            Magnifique
          </button>
        </div>
      )}

      {/* ── Erreur réseau simulée ── */}
      {phase === 'error' && (
        <div className="reveal-content" style={{ color: 'var(--text)' }}>
          <p className="reveal-title">La capture s'est perdue…</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Ta capture t'a été rendue. Réessaie.
          </p>
          <button className="btn" onClick={onClose} style={{ marginTop: 20 }}>
            Retour
          </button>
        </div>
      )}
    </div>
  );
}
