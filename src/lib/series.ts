import type { Hex, OwnedColor, SeriesDef } from '../types';
import { hexToHsl } from './color';

/** Les 16 gris purs : #000000, #111111 … #FFFFFF. */
const PURE_GREYS: Hex[] = Array.from({ length: 16 }, (_, i) => {
  const d = i.toString(16).toUpperCase();
  return `#${d}${d}${d}${d}${d}${d}`;
});

function isFire(hex: Hex): boolean {
  const { h, s, l } = hexToHsl(hex);
  const warmHue = h <= 45 || h >= 350;
  return warmHue && s >= 50 && l >= 20 && l <= 75;
}

function isDaySky(hex: Hex): boolean {
  const { h, s, l } = hexToHsl(hex);
  return h >= 190 && h <= 240 && s >= 35 && l >= 40 && l <= 85;
}

export const SERIES: SeriesDef[] = [
  {
    id: 'feu',
    title: 'Feu',
    description: '10 couleurs de la zone chaude — rouges, oranges, braises.',
    target: 10,
    kind: 'zone',
    matches: isFire,
    previewColors: ['#8C1D04', '#C63A0A', '#E85D1F', '#F08A2C', '#D94020'],
  },
  {
    id: 'gris-purs',
    title: 'Les 16 gris purs',
    description: 'Du néant à la lumière : #000000, #111111 … #FFFFFF.',
    target: 16,
    kind: 'explicit',
    explicitHexes: PURE_GREYS,
    previewColors: ['#000000', '#444444', '#888888', '#CCCCCC', '#FFFFFF'],
  },
  {
    id: 'ciel-du-jour',
    title: 'Ciel du jour',
    description: '5 bleus du ciel, du zénith à l’horizon.',
    target: 5,
    kind: 'zone',
    matches: isDaySky,
    previewColors: ['#2E6FBF', '#4A8AD4', '#6FA8E0', '#8FC0EC', '#B4D6F5'],
  },
];

export interface SeriesProgress {
  def: SeriesDef;
  /** Hexes de la collection qui comptent pour la série (dédupliqués, bornés au target). */
  matched: Hex[];
  count: number;
  done: boolean;
}

export function seriesProgress(def: SeriesDef, collection: OwnedColor[]): SeriesProgress {
  let matched: Hex[];
  if (def.kind === 'explicit') {
    const owned = new Set(collection.map((c) => c.hex));
    matched = (def.explicitHexes ?? []).filter((h) => owned.has(h));
  } else {
    const seen = new Set<Hex>();
    matched = [];
    for (const c of collection) {
      if (!seen.has(c.hex) && def.matches!(c.hex)) {
        seen.add(c.hex);
        matched.push(c.hex);
      }
      if (matched.length >= def.target) break;
    }
  }
  const count = Math.min(matched.length, def.target);
  return { def, matched: matched.slice(0, def.target), count, done: count >= def.target };
}

export function allSeriesProgress(collection: OwnedColor[]): SeriesProgress[] {
  return SERIES.map((def) => seriesProgress(def, collection));
}
