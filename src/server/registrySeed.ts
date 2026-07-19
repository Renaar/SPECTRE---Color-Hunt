import type { RegistryEntry } from '../types';
import { rgbToHex } from '../lib/color';

/**
 * Registre global simulé : ~500 couleurs "déjà prises par d'autres joueurs".
 * Généré de façon déterministe (PRNG seedé) pour que tous les lancements
 * voient le même monde partagé.
 */

// PRNG mulberry32 — déterministe et suffisant pour la simulation.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ICONIC: Array<[string, string, string]> = [
  ['#FF0000', 'Rouge Absolu', 'chroma_king'],
  ['#00FF00', 'Vert Machine', 'pixelmancer'],
  ['#0000FF', 'Bleu Primaire', 'chroma_king'],
  ['#000000', 'Le Néant', 'void_walker'],
  ['#FFFFFF', 'Lumière Totale', 'prisma'],
  ['#FFFF00', 'Soleil Criard', 'helios22'],
  ['#FF00FF', 'Magenta Interdit', 'nyx_hunter'],
  ['#00FFFF', 'Cyan Glacial', 'borealis'],
  ['#FF8000', 'Orange Réacteur', 'helios22'],
  ['#800080', 'Pourpre Impérial', 'byzance'],
  ['#808080', 'Gris Milieu', 'void_walker'],
  ['#C0C0C0', 'Argent Lunaire', 'selene.hex'],
  ['#FFD700', "Or des Fous", 'midas_touch'],
  ['#FF69B4', 'Rose Bonbon Volé', 'candy_crush_84'],
  ['#8B4513', 'Terre de Selle', 'terracotta'],
  ['#123456', 'La Suite Parfaite', 'sequenceur'],
  ['#ABCDEF', 'Alphabet Céleste', 'sequenceur'],
  ['#DEADBE', 'Presque Deadbeef', 'hexorciste'],
  ['#C0FFEE', 'Café Serré', 'barista_dev'],
  ['#BADA55', 'Vert Frimeur', 'hexorciste'],
  ['#FACADE', 'Belle Façade', 'archi_texte'],
  ['#B00B1E', 'Rouge Scandale', 'nyx_hunter'],
  ['#0D0D0D', 'Noir Studio', 'void_walker'],
  ['#F5F5DC', 'Beige Notaire', 'archi_texte'],
  ['#4B0082', 'Indigo Profond', 'byzance'],
];

const ADJ = [
  'Brûlé', 'Glacé', 'Perdu', 'Sauvage', 'Doux', 'Amer', 'Électrique', 'Fané',
  'Secret', 'Royal', 'Pâle', 'Profond', 'Fumé', 'Vif', 'Ancien', 'Fragile',
  'Nocturne', 'Solaire', 'Boréal', 'Toxique', 'Velouté', 'Rouillé', 'Poudré',
  'Néon', 'Astral', 'Mineur', 'Majeur', 'Discret', 'Fatal', 'Tendre',
];

const NOUN = [
  'Crépuscule', 'Océan', 'Braise', 'Mousse', 'Orage', 'Sirop', 'Lagon',
  'Cendre', 'Pollen', 'Météore', 'Lichen', 'Nectar', 'Fjord', 'Désert',
  'Encre', 'Écume', 'Basalte', 'Nébuleuse', 'Prune', 'Absinthe', 'Cobalt',
  'Safran', 'Turquin', 'Garance', 'Céladon', 'Vermillon', 'Aurore', 'Éclipse',
  'Sous-bois', 'Marée', 'Comète', 'Givre', 'Torrent', 'Volcan', 'Papyrus',
];

const PSEUDO_A = [
  'pixel', 'hex', 'chroma', 'neo', 'luna', 'dark', 'ultra', 'mono', 'poly',
  'astro', 'vapor', 'retro', 'cyber', 'wild', 'zen', 'echo', 'nova', 'flux',
];

const PSEUDO_B = [
  'hunter', 'catcher', 'weaver', 'smith', 'ghost', 'fox', 'wolf', 'raven',
  'mancer', 'seeker', 'drifter', 'pilot', 'witch', 'monk', 'punk', 'sage',
];

function fakeName(rand: () => number): string {
  const noun = NOUN[Math.floor(rand() * NOUN.length)];
  const adj = ADJ[Math.floor(rand() * ADJ.length)];
  return rand() < 0.35 ? noun : `${noun} ${adj}`;
}

function fakePseudo(rand: () => number): string {
  const a = PSEUDO_A[Math.floor(rand() * PSEUDO_A.length)];
  const b = PSEUDO_B[Math.floor(rand() * PSEUDO_B.length)];
  const suffix = rand() < 0.4 ? String(Math.floor(rand() * 99)) : '';
  const sep = rand() < 0.3 ? '_' : '';
  return `${a}${sep}${b}${suffix}`;
}

export function buildSeedRegistry(): Map<string, RegistryEntry> {
  const rand = mulberry32(0x5bec7ee);
  const registry = new Map<string, RegistryEntry>();
  const now = Date.now();
  const year = 365 * 24 * 3600 * 1000;

  for (const [hex, name, owner] of ICONIC) {
    registry.set(hex, { hex, name, owner, claimedAt: now - Math.floor(rand() * year) });
  }

  while (registry.size < 500) {
    const hex = rgbToHex({
      r: Math.floor(rand() * 256),
      g: Math.floor(rand() * 256),
      b: Math.floor(rand() * 256),
    });
    if (registry.has(hex)) continue;
    registry.set(hex, {
      hex,
      name: fakeName(rand),
      owner: fakePseudo(rand),
      claimedAt: now - Math.floor(rand() * year),
    });
  }

  return registry;
}
