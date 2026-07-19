import type { Rarity } from '../types';

/**
 * Sons synthétisés (WebAudio, zéro asset) + retour haptique.
 * Tout est best-effort : silence si l'API n'est pas disponible.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, ac.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}

/** Déclic de capture. */
export function playShutter(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, 880, 0, 0.05, 0.08, 'square');
  tone(ac, 440, 0.04, 0.06, 0.06, 'square');
  vibrate(30);
}

/** Montée de suspense pendant la loterie. */
export function playSuspense(): void {
  const ac = audio();
  if (!ac) return;
  for (let i = 0; i < 6; i++) {
    tone(ac, 220 * Math.pow(2, i / 12), i * 0.22, 0.18, 0.04, 'triangle');
  }
}

const REVEAL_NOTES: Record<Rarity, number[]> = {
  commune: [523.25, 659.25],
  rare: [523.25, 659.25, 783.99],
  epique: [523.25, 659.25, 783.99, 1046.5],
  legendaire: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568],
};

const REVEAL_VIBES: Record<Rarity, number[]> = {
  commune: [40],
  rare: [40, 60, 40],
  epique: [50, 50, 50, 50, 80],
  legendaire: [60, 40, 60, 40, 60, 40, 150],
};

/** Fanfare de révélation, proportionnelle à la rareté. */
export function playReveal(rarity: Rarity): void {
  const ac = audio();
  if (ac) {
    REVEAL_NOTES[rarity].forEach((f, i) => {
      tone(ac, f, i * 0.09, 0.5, 0.09, 'sine');
      tone(ac, f * 2, i * 0.09, 0.25, 0.02, 'sine');
    });
  }
  vibrate(REVEAL_VIBES[rarity]);
}

/** Note douce-amère : la couleur appartient à quelqu'un d'autre. */
export function playTaken(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, 392, 0, 0.4, 0.06, 'sine');
  tone(ac, 311.13, 0.18, 0.6, 0.06, 'sine');
  vibrate([20, 80, 20]);
}

/** Série complétée. */
export function playSeriesComplete(): void {
  const ac = audio();
  if (!ac) return;
  [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(ac, f, i * 0.12, 0.4, 0.08, 'sine');
  });
  vibrate([80, 40, 80, 40, 200]);
}
