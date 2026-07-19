import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './lib/store';
import { CaptureScreen, type PendingCapture } from './screens/CaptureScreen';
import { RevealFlow } from './screens/RevealFlow';
import { CollectionScreen } from './screens/CollectionScreen';
import { SeriesScreen } from './screens/SeriesScreen';
import { RegistryScreen } from './screens/RegistryScreen';

type Tab = 'capture' | 'collection' | 'series' | 'registry';

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'capture', icon: '◉', label: 'Capture' },
  { id: 'collection', icon: '▦', label: 'Collection' },
  { id: 'series', icon: '≡', label: 'Séries' },
  { id: 'registry', icon: '⌕', label: 'Registre' },
];

function Onboarding({ onDone }: { onDone: (pseudo: string) => void }) {
  const [pseudo, setPseudo] = useState('');
  return (
    <motion.div className="onboarding" exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.4 }}>
      <div className="logo-ring" />
      <h1>SPECTRE</h1>
      <p>
        Il existe <span className="big-number">16 777 216</span> couleurs.
        <br />
        Chacune ne peut appartenir qu'à une seule personne au monde.
        <br />
        Chasse-les dans le réel, nomme-les, garde-les.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pseudo.trim()) onDone(pseudo);
        }}
      >
        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Ton pseudo de chasseur"
          maxLength={20}
        />
        <button className="btn btn--block" type="submit" disabled={!pseudo.trim()}>
          Commencer la chasse
        </button>
      </form>
    </motion.div>
  );
}

export default function App() {
  const { state, setPseudo, spendCapture } = useStore();
  const [tab, setTab] = useState<Tab>('capture');
  const [pending, setPending] = useState<PendingCapture | null>(null);

  const onCapture = useCallback(
    (p: PendingCapture) => {
      // Le compteur est débité au déclenchement ; rendu si le "réseau" échoue.
      if (spendCapture()) setPending(p);
    },
    [spendCapture],
  );

  const needsOnboarding = state.pseudo === '';

  return (
    <div className="app">
      <AnimatePresence>
        {needsOnboarding && <Onboarding onDone={setPseudo} />}
      </AnimatePresence>

      {tab === 'capture' ? (
        <div className="screen screen--flush">
          <CaptureScreen onCapture={onCapture} />
        </div>
      ) : tab === 'collection' ? (
        <CollectionScreen />
      ) : tab === 'series' ? (
        <SeriesScreen />
      ) : (
        <RegistryScreen />
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {pending && <RevealFlow pending={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
