import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Hex, OwnedColor, PlayerState } from '../types';
import {
  applyDailyRefill,
  loadPlayerState,
  savePlayerState,
  MAX_RESERVE,
} from './storage';

interface Store {
  state: PlayerState;
  setPseudo: (pseudo: string) => void;
  /** Décrémente le compteur ; renvoie false si plus de captures. */
  spendCapture: () => boolean;
  /** Rend la capture si l'envoi au serveur a échoué. */
  refundCapture: () => void;
  /** Bouton debug "+1 capture (marcher 2 km)". */
  earnCapture: () => void;
  addColor: (color: OwnedColor) => void;
  toggleWishlist: (hex: Hex) => void;
  markSeriesComplete: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>(() => loadPlayerState());

  useEffect(() => {
    savePlayerState(state);
  }, [state]);

  // Recharge de minuit : vérifiée au lancement (loadPlayerState) et à chaque
  // retour au premier plan, pour les sessions qui traversent minuit.
  useEffect(() => {
    const check = () => setState((s) => applyDailyRefill(s));
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const setPseudo = useCallback((pseudo: string) => {
    setState((s) => ({ ...s, pseudo: pseudo.slice(0, 20).trim() }));
  }, []);

  const spendCapture = useCallback(() => {
    let ok = false;
    setState((s) => {
      if (s.economy.available <= 0) return s;
      ok = true;
      return { ...s, economy: { ...s.economy, available: s.economy.available - 1 } };
    });
    return ok;
  }, []);

  const refundCapture = useCallback(() => {
    setState((s) => ({
      ...s,
      economy: { ...s.economy, available: Math.min(MAX_RESERVE, s.economy.available + 1) },
    }));
  }, []);

  const earnCapture = useCallback(() => {
    setState((s) => ({
      ...s,
      economy: { ...s.economy, available: Math.min(MAX_RESERVE, s.economy.available + 1) },
    }));
  }, []);

  const addColor = useCallback((color: OwnedColor) => {
    setState((s) =>
      s.collection.some((c) => c.hex === color.hex)
        ? s
        : {
            ...s,
            collection: [color, ...s.collection],
            wishlist: s.wishlist.filter((h) => h !== color.hex),
          },
    );
  }, []);

  const toggleWishlist = useCallback((hex: Hex) => {
    setState((s) => ({
      ...s,
      wishlist: s.wishlist.includes(hex)
        ? s.wishlist.filter((h) => h !== hex)
        : [...s.wishlist, hex],
    }));
  }, []);

  const markSeriesComplete = useCallback((id: string) => {
    setState((s) =>
      s.completedSeries.includes(id)
        ? s
        : { ...s, completedSeries: [...s.completedSeries, id] },
    );
  }, []);

  const store = useMemo<Store>(
    () => ({
      state,
      setPseudo,
      spendCapture,
      refundCapture,
      earnCapture,
      addColor,
      toggleWishlist,
      markSeriesComplete,
    }),
    [
      state,
      setPseudo,
      spendCapture,
      refundCapture,
      earnCapture,
      addColor,
      toggleWishlist,
      markSeriesComplete,
    ],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore doit être utilisé sous <StoreProvider>');
  return store;
}
