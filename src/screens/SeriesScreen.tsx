import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { allSeriesProgress } from '../lib/series';

export function SeriesScreen() {
  const { state } = useStore();
  const progress = allSeriesProgress(state.collection);

  return (
    <div className="screen">
      <h1 className="screen-title">Séries</h1>
      <p className="screen-subtitle">Des collections dans la collection.</p>

      {progress.map(({ def, count, done, matched }) => (
        <div className="series-card" key={def.id}>
          <div
            className="series-preview"
            style={{
              background: `linear-gradient(90deg, ${(matched.length >= 2 ? matched : def.previewColors).join(', ')})`,
              opacity: matched.length >= 2 ? 1 : 0.45,
            }}
          />
          <div className="series-title-row">
            <span className="series-title">{def.title}</span>
            {done ? (
              <span className="series-done-tag">★ Complétée</span>
            ) : (
              <span className="series-count">
                {count}/{def.target}
              </span>
            )}
          </div>
          <p className="series-desc">{def.description}</p>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(count / def.target) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={done ? { background: '#ffcc4d' } : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
