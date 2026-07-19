import type { CaptureResult, Hex, RegistryEntry } from '../types';
import { computeRarity } from '../lib/rarity';
import { rgbToHex, normalizeHex, clamp } from '../lib/color';
import { buildSeedRegistry } from './registrySeed';

/**
 * ─── SERVEUR SIMULÉ ────────────────────────────────────────────────────────
 *
 * Ce module joue le rôle du backend autoritaire. Rien ici ne doit dépendre
 * de l'UI : toute la logique anti-triche (choix du pixel, bruit, registre)
 * vit de ce côté de la frontière pour pouvoir être migrée telle quelle vers
 * un vrai serveur plus tard.
 *
 * Persistance côté "serveur" : clé localStorage séparée de celle du client.
 */

const SERVER_STORAGE_KEY = 'spectre.server.claims.v1';

function delay(): Promise<void> {
  const ms = 300 + Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Registre global ─────────────────────────────────────────────────────

const seedRegistry = buildSeedRegistry();

function loadRuntimeClaims(): Map<string, RegistryEntry> {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as RegistryEntry[];
    return new Map(entries.map((e) => [e.hex, e]));
  } catch {
    return new Map();
  }
}

function saveRuntimeClaims(claims: Map<string, RegistryEntry>): void {
  try {
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify([...claims.values()]));
  } catch {
    // localStorage plein ou indisponible : le "serveur" garde l'état en mémoire.
  }
}

const runtimeClaims = loadRuntimeClaims();

function getOwner(hex: Hex): RegistryEntry | null {
  return runtimeClaims.get(hex) ?? seedRegistry.get(hex) ?? null;
}

// ─── API "réseau" ────────────────────────────────────────────────────────

/**
 * La loterie du pixel. Le serveur choisit LUI-MÊME un pixel aléatoire dans
 * l'image soumise, puis applique un bruit ±5 par canal : impossible de viser
 * un hex précis.
 */
export async function submitCapture(image: ImageData): Promise<CaptureResult> {
  await delay();

  const px = Math.floor(Math.random() * image.width);
  const py = Math.floor(Math.random() * image.height);
  const i = (py * image.width + px) * 4;

  const noise = () => Math.round(Math.random() * 10) - 5; // ±5
  const r = clamp(image.data[i] + noise(), 0, 255);
  const g = clamp(image.data[i + 1] + noise(), 0, 255);
  const b = clamp(image.data[i + 2] + noise(), 0, 255);

  const hex = rgbToHex({ r, g, b });
  const rarity = computeRarity(hex);
  const pixel = { x: px / image.width, y: py / image.height };

  const owner = getOwner(hex);
  if (owner) {
    return { status: 'taken', hex, rarity, pixel, owner: owner.owner, name: owner.name };
  }
  return { status: 'free', hex, rarity, pixel };
}

/**
 * Réclame une couleur libre au nom du joueur. Le serveur re-vérifie la
 * disponibilité (autorité côté serveur, pas côté client).
 */
export async function claimColor(
  hex: Hex,
  name: string,
  ownerPseudo: string,
): Promise<{ ok: true; entry: RegistryEntry } | { ok: false; reason: 'taken' }> {
  await delay();
  const normalized = normalizeHex(hex);
  if (getOwner(normalized)) return { ok: false, reason: 'taken' };
  const entry: RegistryEntry = {
    hex: normalized,
    name: name.slice(0, 40).trim() || 'Sans nom',
    owner: ownerPseudo,
    claimedAt: Date.now(),
  };
  runtimeClaims.set(normalized, entry);
  saveRuntimeClaims(runtimeClaims);
  return { ok: true, entry };
}

/** Recherche d'un hex précis dans le registre mondial. */
export async function lookupColor(hex: Hex): Promise<RegistryEntry | null> {
  await delay();
  return getOwner(normalizeHex(hex));
}

/** Nombre total de couleurs réclamées dans le monde (pour le vertige). */
export async function countClaimed(): Promise<number> {
  await delay();
  const all = new Set([...seedRegistry.keys(), ...runtimeClaims.keys()]);
  return all.size;
}
