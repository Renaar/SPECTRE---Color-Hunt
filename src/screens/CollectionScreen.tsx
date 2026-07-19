import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { OwnedColor } from '../types';
import { useStore } from '../lib/store';
import { hexToHsl, textColorOn } from '../lib/color';
import { RARITY_COLOR } from '../lib/rarity';
import { RarityBadge } from '../components/RarityBadge';

const TOTAL = 16_777_216;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Roue chromatique : angle = teinte, rayon = saturation. */
function SpectreWheel({ collection, onPick }: { collection: OwnedColor[]; onPick: (c: OwnedColor) => void }) {
  const size = 320;
  const c = size / 2;
  const maxR = c - 18;

  const dots = useMemo(
    () =>
      collection.map((col) => {
        const { h, s } = hexToHsl(col.hex);
        const angle = ((h - 90) * Math.PI) / 180;
        const r = (s / 100) * maxR;
        return {
          col,
          x: c + r * Math.cos(angle),
          y: c + r * Math.sin(angle),
        };
      }),
    [collection, c, maxR],
  );

  return (
    <div className="spectre-wheel-wrap">
      <div style={{ position: 'relative', width: size, height: size }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            opacity: 0.14,
            filter: 'blur(2px)',
          }}
        />
        <svg width={size} height={size} style={{ position: 'relative' }}>
          <circle cx={c} cy={c} r={maxR} fill="none" stroke="rgba(255,255,255,0.1)" />
          <circle cx={c} cy={c} r={maxR * 0.5} fill="none" stroke="rgba(255,255,255,0.05)" />
          {dots.map(({ col, x, y }) => (
            <motion.circle
              key={col.hex}
              cx={x}
              cy={y}
              r={7}
              fill={col.hex}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ cursor: 'pointer' }}
              onClick={() => onPick(col)}
            />
          ))}
        </svg>
      </div>
      <p className="spectre-hint">
        Tes couleurs sur la roue chromatique. Le centre est terne, le bord est saturé — les
        zones vides sont encore à conquérir.
      </p>
    </div>
  );
}

function DetailSheet({ color, onClose }: { color: OwnedColor; onClose: () => void }) {
  const { state } = useStore();
  const { h, s, l } = hexToHsl(color.hex);
  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
      >
        <div className="sheet-handle" />
        <div className="detail-swatch" style={{ background: color.hex }}>
          <span className="hex" style={{ color: textColorOn(color.hex), fontSize: 14 }}>
            {color.hex}
          </span>
        </div>
        <div className="detail-name">« {color.name} »</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          Découverte par {state.pseudo || 'toi'}
        </p>
        <RarityBadge rarity={color.rarity} />
        <div className="detail-meta">
          <div className="meta-row">
            <span>Capturée le</span>
            <span className="value">{formatDate(color.capturedAt)}</span>
          </div>
          <div className="meta-row">
            <span>HSL</span>
            <span className="value hex" style={{ color: 'var(--text)' }}>
              {h}° · {s}% · {l}%
            </span>
          </div>
        </div>
        {color.provenanceThumb && (
          <>
            <p className="section-label">Provenance</p>
            <img className="provenance-thumb" src={color.provenanceThumb} alt="Photo d'origine" />
          </>
        )}
      </motion.div>
    </>
  );
}

export function CollectionScreen() {
  const { state } = useStore();
  const [view, setView] = useState<'grid' | 'spectre'>('grid');
  const [selected, setSelected] = useState<OwnedColor | null>(null);

  const count = state.collection.length;

  return (
    <div className="screen">
      <h1 className="screen-title">Collection</h1>
      <p className="screen-subtitle">
        Tu possèdes <strong style={{ color: 'var(--text)' }}>{count.toLocaleString('fr-FR')}</strong> des{' '}
        {TOTAL.toLocaleString('fr-FR')} couleurs du spectre.
      </p>

      <div className="view-toggle">
        <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
          Mur
        </button>
        <button className={view === 'spectre' ? 'active' : ''} onClick={() => setView('spectre')}>
          Spectre
        </button>
      </div>

      {count === 0 ? (
        <div className="empty-state">
          Ta collection est vide.
          <br />
          Le monde entier est un gisement de couleurs — va en capturer une.
        </div>
      ) : view === 'grid' ? (
        <div className="collection-grid">
          {state.collection.map((c, i) => (
            <motion.button
              key={c.hex}
              className="swatch"
              style={{ background: c.hex }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => setSelected(c)}
              aria-label={`${c.name} (${c.hex})`}
            >
              <span
                className="swatch-rarity"
                style={{ background: RARITY_COLOR[c.rarity], color: RARITY_COLOR[c.rarity] }}
              />
            </motion.button>
          ))}
        </div>
      ) : (
        <SpectreWheel collection={state.collection} onPick={setSelected} />
      )}

      <AnimatePresence>
        {selected && <DetailSheet color={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
