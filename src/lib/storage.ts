import type { PlayerState } from '../types';

const PLAYER_STORAGE_KEY = 'spectre.player.v1';

export const DAILY_CAPTURES = 3;
export const MAX_RESERVE = 5;

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function defaultPlayerState(): PlayerState {
  return {
    pseudo: '',
    collection: [],
    wishlist: [],
    economy: { available: DAILY_CAPTURES, lastRefillDate: todayISO() },
    completedSeries: [],
  };
}

/**
 * Recharge quotidienne : +3 à minuit, plafonnée à 5. Idempotente pour un même
 * jour (gère le double-lancement).
 */
export function applyDailyRefill(state: PlayerState): PlayerState {
  const today = todayISO();
  if (state.economy.lastRefillDate === today) return state;
  return {
    ...state,
    economy: {
      available: Math.min(MAX_RESERVE, state.economy.available + DAILY_CAPTURES),
      lastRefillDate: today,
    },
  };
}

export function loadPlayerState(): PlayerState {
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return defaultPlayerState();
    const parsed = JSON.parse(raw) as PlayerState;
    // Champs manquants après une évolution du schéma → valeurs par défaut.
    return applyDailyRefill({ ...defaultPlayerState(), ...parsed });
  } catch {
    return defaultPlayerState();
  }
}

/**
 * Sauvegarde avec repli : si localStorage est plein, on retente sans les
 * vignettes de provenance (les données de jeu priment sur les photos).
 */
export function savePlayerState(state: PlayerState): void {
  try {
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    try {
      const slim: PlayerState = {
        ...state,
        collection: state.collection.map((c) => ({ ...c, provenanceThumb: '' })),
      };
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Vraiment plein : on continue en mémoire, sans crash.
    }
  }
}
