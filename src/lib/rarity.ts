import type { Hex, Rarity } from '../types';
import { hexToRgb, rgbToHsl } from './color';

/**
 * Rareté calculée, pas arbitraire.
 *
 * - Légendaire : hex "remarquables" — gris purs, valeurs 00/80/FF,
 *   palindromes (#ABCCBA), suites (#123456), octets doublés (#AABBCC).
 * - Épique : couleur "pure" — écart très net entre canal dominant et
 *   canal le plus faible (rouges francs, cyans, magentas…).
 * - Rare : saturation élevée (>70 %) ou luminosité extrême.
 * - Commune : le reste (la majorité du monde réel).
 */

const REMARKABLE_VALUES = new Set([0x00, 0x80, 0xff]);

function isHexPalindrome(digits: string): boolean {
  return digits[0] === digits[5] && digits[1] === digits[4] && digits[2] === digits[3];
}

function isSequence(digits: string): boolean {
  const vals = [...digits].map((d) => parseInt(d, 16));
  const asc = vals.every((v, i) => i === 0 || v === vals[i - 1] + 1);
  const desc = vals.every((v, i) => i === 0 || v === vals[i - 1] - 1);
  return asc || desc;
}

function isDoubledBytes(digits: string): boolean {
  return digits[0] === digits[1] && digits[2] === digits[3] && digits[4] === digits[5];
}

export function isLegendary(hex: Hex): boolean {
  const digits = hex.replace('#', '').toUpperCase();
  const { r, g, b } = hexToRgb(hex);
  if (r === g && g === b) return true; // gris pur
  if (REMARKABLE_VALUES.has(r) && REMARKABLE_VALUES.has(g) && REMARKABLE_VALUES.has(b)) return true;
  if (isHexPalindrome(digits)) return true;
  if (isSequence(digits)) return true;
  if (isDoubledBytes(digits)) return true;
  return false;
}

export function isEpic(hex: Hex): boolean {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Couleur "pure" : chroma très élevé — un ou deux canaux dominent nettement.
  return max - min >= 170 && max >= 200;
}

export function isRare(hex: Hex): boolean {
  const { s, l } = rgbToHsl(hexToRgb(hex));
  return s > 70 || l > 90 || l < 10;
}

export function computeRarity(hex: Hex): Rarity {
  if (isLegendary(hex)) return 'legendaire';
  if (isEpic(hex)) return 'epique';
  if (isRare(hex)) return 'rare';
  return 'commune';
}

export const RARITY_LABEL: Record<Rarity, string> = {
  commune: 'Commune',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
};

export const RARITY_ORDER: Record<Rarity, number> = {
  commune: 0,
  rare: 1,
  epique: 2,
  legendaire: 3,
};

export const RARITY_COLOR: Record<Rarity, string> = {
  commune: '#8a8f98',
  rare: '#4da3ff',
  epique: '#c05cff',
  legendaire: '#ffcc4d',
};
