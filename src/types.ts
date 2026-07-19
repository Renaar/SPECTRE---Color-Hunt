/** Hex color string, always uppercase, format "#RRGGBB". */
export type Hex = string;

export type Rarity = 'commune' | 'rare' | 'epique' | 'legendaire';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

/** A color owned by the local player. */
export interface OwnedColor {
  hex: Hex;
  name: string;
  rarity: Rarity;
  capturedAt: number; // epoch ms
  /** Small dataURL thumbnail of the source photo. */
  provenanceThumb: string;
}

/** An entry in the global (simulated) registry: a color owned by someone. */
export interface RegistryEntry {
  hex: Hex;
  name: string;
  owner: string;
  claimedAt: number;
}

/** Result of the server-side pixel lottery. */
export type CaptureResult =
  | {
      status: 'free';
      hex: Hex;
      rarity: Rarity;
      /** Where the server picked the pixel, as fractions of image size. */
      pixel: { x: number; y: number };
    }
  | {
      status: 'taken';
      hex: Hex;
      rarity: Rarity;
      pixel: { x: number; y: number };
      owner: string;
      name: string;
    };

export interface CaptureEconomy {
  /** Captures currently available. */
  available: number;
  /** ISO date (YYYY-MM-DD) of the last daily refill. */
  lastRefillDate: string;
}

export interface SeriesDef {
  id: string;
  title: string;
  description: string;
  /** Total items needed. */
  target: number;
  /** Either an explicit list of hexes, or a predicate on the color. */
  kind: 'explicit' | 'zone';
  explicitHexes?: Hex[];
  matches?: (hex: Hex) => boolean;
  /** Representative gradient for the series card. */
  previewColors: Hex[];
}

export interface PlayerState {
  pseudo: string;
  collection: OwnedColor[];
  wishlist: Hex[];
  economy: CaptureEconomy;
  completedSeries: string[];
}
