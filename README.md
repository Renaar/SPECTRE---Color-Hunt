# SPECTRE — Color Hunt

Prototype mobile-first d'un jeu de collection où les **16 777 216 couleurs** du spectre RGB
sont des objets uniques au monde : chaque couleur ne peut appartenir qu'à un seul joueur.
On capture des couleurs en photographiant le réel, on les nomme, on complète des séries.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173 — ouvrir sur téléphone via l'IP locale
npm test           # tests unitaires de la logique de rareté
npm run build      # build de production (PWA installable)
```

Sur desktop sans caméra, le déclencheur bascule automatiquement sur un
sélecteur de fichier image.

## Architecture

```
src/
├── types.ts               Types partagés (couleurs, registre, résultats, état joueur)
├── server/
│   ├── fakeServer.ts      ★ Le "backend" simulé — SEULE autorité du jeu :
│   │                        loterie du pixel, bruit ±5, registre mondial, claims.
│   │                        Isolé de l'UI pour migrer tel quel vers un vrai serveur.
│   └── registrySeed.ts    ~500 couleurs "déjà prises" (déterministe, PRNG seedé)
├── lib/
│   ├── rarity.ts          Rareté calculée (+ rarity.test.ts, 14 tests vitest)
│   ├── color.ts           Conversions hex/RGB/HSL, luminance
│   ├── series.ts          Les 3 séries de démo et leur progression
│   ├── storage.ts         Persistance localStorage + économie des captures
│   ├── store.tsx          État React global (contexte)
│   └── feedback.ts        Sons synthétisés (WebAudio) + vibrations
└── screens/
    ├── CaptureScreen.tsx  Caméra plein écran, compteur, déclencheur, fallback upload
    ├── RevealFlow.tsx     Suspense → pixel élu → inondation → célébration / doux-amer
    ├── CollectionScreen   Mur + vue Spectre (roue chromatique) + fiche détail
    ├── SeriesScreen       Barres de progression des séries
    └── RegistryScreen     Recherche d'hex dans le registre mondial + wishlist
```

## Simulé vs réel

| Simulé (prototype)                                     | Réel |
| ------------------------------------------------------ | ---- |
| `fakeServer.ts` : latence 300–800 ms, registre en localStorage (`spectre.server.*`) | Caméra (`getUserMedia`), capture du pixel, toute l'UI |
| ~500 propriétaires fictifs générés par PRNG seedé       | Calcul de rareté, séries, économie des captures |
| Bouton debug « +1 capture (marcher 2 km) »              | Recharge quotidienne à minuit (max 5 en réserve) |
| Unicité mondiale (locale à l'appareil, pas de réseau)   | Persistance de la collection, provenance photo |

## Règles clés

- **Loterie du pixel** : le serveur choisit lui-même un pixel de la photo et ajoute
  un bruit ±5 par canal — impossible de viser un hex précis.
- **Rareté calculée** : commune (terne), rare (saturation > 70 % ou luminosité extrême),
  épique (couleur pure, chroma ≥ 170), légendaire (hex remarquables : gris purs,
  00/80/FF, palindromes, suites, octets doublés).
- **Économie** : 3 captures/jour à minuit, réserve plafonnée à 5.
- Tout fonctionne hors connexion après le premier chargement (PWA + localStorage).
