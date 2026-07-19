import { useCallback, useState } from 'react';
import type { Hex, RegistryEntry } from '../types';
import { useStore } from '../lib/store';
import { lookupColor } from '../server/fakeServer';
import { isValidHex, normalizeHex } from '../lib/color';
import { computeRarity, RARITY_LABEL } from '../lib/rarity';

type Lookup =
  | { status: 'idle' }
  | { status: 'loading'; hex: Hex }
  | { status: 'free'; hex: Hex }
  | { status: 'taken'; hex: Hex; entry: RegistryEntry };

export function RegistryScreen() {
  const { state, toggleWishlist } = useStore();
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });

  const ownedSet = new Set(state.collection.map((c) => c.hex));

  const search = useCallback(
    async (raw: string) => {
      if (!isValidHex(raw)) return;
      const hex = normalizeHex(raw);
      setQuery(hex);
      setLookup({ status: 'loading', hex });
      const entry = await lookupColor(hex);
      setLookup(entry ? { status: 'taken', hex, entry } : { status: 'free', hex });
    },
    [],
  );

  const currentHex = lookup.status !== 'idle' ? lookup.hex : null;
  const isWished = currentHex !== null && state.wishlist.includes(currentHex);

  return (
    <div className="screen">
      <h1 className="screen-title">Registre</h1>
      <p className="screen-subtitle">
        La fenêtre sur le monde partagé — cherche un hex, vois qui le possède.
      </p>

      <form
        className="registry-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <input
          className="registry-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="#RRGGBB"
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="btn" type="submit" disabled={!isValidHex(query)}>
          Chercher
        </button>
      </form>

      {lookup.status === 'loading' && (
        <div className="registry-result">
          <div className="registry-swatch" style={{ background: lookup.hex }} />
          <div className="registry-info">
            <p className="sub">Interrogation du registre mondial…</p>
          </div>
        </div>
      )}

      {lookup.status === 'free' && (
        <div className="registry-result">
          <div className="registry-swatch" style={{ background: lookup.hex }} />
          <div className="registry-info">
            <p className="status-free">Libre !</p>
            <p className="sub">
              <span className="hex">{lookup.hex}</span> · {RARITY_LABEL[computeRarity(lookup.hex)]}
              <br />
              Personne ne la possède. À toi de la croiser dans le monde réel…
            </p>
          </div>
          <button
            className="wish-btn"
            onClick={() => toggleWishlist(lookup.hex)}
            aria-label="Convoiter"
          >
            {isWished ? '♥' : '♡'}
          </button>
        </div>
      )}

      {lookup.status === 'taken' && (
        <div className="registry-result">
          <div className="registry-swatch" style={{ background: lookup.hex }} />
          <div className="registry-info">
            <p className="status-taken">
              {ownedSet.has(lookup.hex) ? 'À toi !' : `Prise — « ${lookup.entry.name} »`}
            </p>
            <p className="sub">
              <span className="hex">{lookup.hex}</span>
              <br />
              {ownedSet.has(lookup.hex) ? (
                <>Elle brille dans ta collection.</>
              ) : (
                <>
                  Appartient à <strong>{lookup.entry.owner}</strong> depuis le{' '}
                  {new Date(lookup.entry.claimedAt).toLocaleDateString('fr-FR')}.
                </>
              )}
            </p>
          </div>
          {!ownedSet.has(lookup.hex) && (
            <button
              className="wish-btn"
              onClick={() => toggleWishlist(lookup.hex)}
              aria-label="Convoiter"
            >
              {isWished ? '♥' : '♡'}
            </button>
          )}
        </div>
      )}

      <p className="section-label">Couleurs convoitées ({state.wishlist.length})</p>
      {state.wishlist.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
          Rien pour l'instant. Quand une révélation t'échappe, convoite-la — tu sauras à qui
          elle appartient.
        </p>
      ) : (
        state.wishlist.map((hex) => (
          <button key={hex} className="wishlist-row" onClick={() => void search(hex)}>
            <span className="wishlist-swatch" style={{ background: hex }} />
            <span className="hex" style={{ fontSize: 14 }}>
              {hex}
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12 }}>
              Vérifier →
            </span>
          </button>
        ))
      )}
    </div>
  );
}
