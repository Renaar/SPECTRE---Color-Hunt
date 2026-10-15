# SPECTRE — Spécification complète de l'application Android

> **Mode d'emploi (pour l'humain)**
>
> 1. Ouvre **Google AI Studio → Build**, choisis la cible **application Android** (Kotlin + Jetpack Compose).
> 2. Colle ce document **en entier** comme premier message, ou joins-le en fichier si l'interface le permet.
>    S'il est trop long pour un seul message, envoie d'abord les sections 0 à 6, puis 7 à 15.
> 3. Laisse l'agent construire. Ensuite, utilise les **prompts de relance** de la section 14, étape par étape.
> 4. Teste dans l'émulateur du navigateur (le mode « galerie » remplace la caméra si l'émulateur n'en a pas),
>    puis sur un vrai téléphone via ADB pour la caméra, les vibrations et le son.
>
> Ce document est la référence **normative** : les blocs de code Kotlin des sections 5 et 6 définissent le
> comportement exact attendu, et les vecteurs de test de la section 12 permettent de le vérifier.
> Il est le portage du prototype web (Vite + React) du dépôt `SPECTRE---Color-Hunt`.

---

## 0. Instructions pour l'agent (à lire en premier)

Tu es un développeur Android senior spécialisé en Kotlin, Jetpack Compose et animations. Tu dois livrer
un **projet Android complet, compilable et jouable** nommé **SPECTRE**, conforme à ce document.

### 0.1 Règles non négociables

1. **Kotlin + Jetpack Compose uniquement** (pas de XML de layout, pas de Flutter, pas de WebView).
2. **Aucun accès réseau.** Pas de permission `INTERNET`, pas de Firebase, pas d'API Gemini, pas de SDK
   d'analytics. Le « serveur » est **simulé localement** (`FakeSpectreServer`) — voir §6.3.
3. **Le joueur ne choisit jamais la couleur.** Le client envoie l'**image** au serveur ; c'est le serveur qui
   choisit le pixel et ajoute le bruit. Le client n'envoie jamais un hex au moment de la capture.
4. Les packages `core` et `server` sont du **Kotlin pur** : aucun import `android.*` ni `androidx.*`.
   Ils doivent être testables en tests unitaires JVM.
5. Les algorithmes des sections 5 et 6 (couleurs, rareté, registre seedé, économie, séries) doivent être
   implémentés **à l'identique**. Les vecteurs de test de la section 12 doivent tous passer.
6. **Toute l'interface est en français**, textes exacts en section 11. Dans `strings.xml`, échappe les
   apostrophes (`\'`).
7. **Les animations sont le cœur du produit**, pas de la décoration. La timeline de révélation (§7.3) est
   un livrable à part entière.
8. Le projet doit **compiler à chaque étape** du plan (§14). Ne laisse jamais de `TODO()` qui plante à
   l'exécution.

### 0.2 À ne pas faire

- Ne pas ajouter d'écran de connexion, de compte, de pub, de boutique.
- Ne pas utiliser de bibliothèque de confettis ou de fichiers audio : confettis en `Canvas`, sons
  synthétisés (§9).
- Ne pas utiliser Hilt/Dagger : injection manuelle via un `AppContainer`.
- Ne pas donner un look « Material par défaut » : thème sombre sur mesure (§8), les couleurs collectées
  sont les vedettes.

---

## 1. Vision et critère de réussite

**SPECTRE** est un jeu de collection où les **16 777 216 couleurs hex** du spectre RGB sont des objets
**uniques au monde** : chaque couleur ne peut appartenir qu'à un seul joueur. Le joueur « capture » des
couleurs en photographiant le monde réel, les nomme, les expose dans sa collection et complète des séries.

Le sentiment recherché est la **collectionnite aiguë** : chaque capture est un moment précieux, chaque
révélation une petite loterie, chaque couleur possédée un trophée exclusif.

**Critère de réussite.** Une personne qui ouvre l'app sur son téléphone doit, en moins de 2 minutes :
capturer une couleur, ressentir le suspense de la révélation, la nommer, et vouloir immédiatement utiliser
sa deuxième capture. Si la troisième capture est dépensée avec regret (« j'aurais dû la garder »), l'app a
gagné.

---

## 2. Glossaire

| Terme | Définition |
|---|---|
| Capture | Une prise de photo qui déclenche la loterie. Ressource limitée (3 par jour, réserve max 5). |
| Loterie du pixel | Le serveur choisit un pixel au hasard dans la photo, ajoute un bruit de ±5 par canal RGB. |
| Libre / prise | Une couleur est *libre* si personne ne la possède dans le registre mondial, *prise* sinon. |
| Registre mondial | Base (simulée) de toutes les couleurs possédées, avec nom et propriétaire. |
| Gravure | Le nommage définitif d'une couleur libre (max 40 caractères), « Découverte par [pseudo] ». |
| Provenance | Date, heure, vignette de la photo d'origine, source (caméra ou galerie). |
| Convoitise | Liste de souhaits : couleurs que le joueur aimerait posséder. |
| Série | Ensemble de couleurs à réunir (ex. « Feu » : 10 couleurs chaudes). |

---

## 3. Stack technique et configuration

| Sujet | Choix |
|---|---|
| Langage | Kotlin 2.x |
| UI | Jetpack Compose + Material 3 (thème sombre personnalisé), Navigation Compose |
| SDK | `minSdk 26`, `compileSdk`/`targetSdk` = dernière version stable fournie par le template |
| Architecture | Single-activity (`MainActivity : ComponentActivity`), MVVM, `ViewModel` + `StateFlow`, coroutines |
| Caméra | CameraX (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`). Aperçu : `CameraXViewfinder` (artefact `camera-compose`) si disponible, sinon `PreviewView` dans `AndroidView` |
| Repli caméra | Photo Picker : `ActivityResultContracts.PickVisualMedia` (aucune permission de stockage) |
| Persistance | Room (via KSP) pour collection, convoitises et registre serveur ; DataStore Preferences pour profil, économie, capture en attente |
| Images | `Bitmap` natif, vignettes JPEG dans `filesDir/provenance/` ; chargement via `BitmapFactory` sur `Dispatchers.IO` |
| Sons | Synthèse PCM via `AudioTrack` (aucun fichier audio) |
| Haptique | `Vibrator` / `VibratorManager` + `VibrationEffect.createWaveform` |
| Confettis | Système de particules maison dans un `Canvas` Compose |
| Tests | JUnit 4 + `kotlinx-coroutines-test` |
| Build | Gradle Kotlin DSL, version catalog, `buildFeatures { compose = true; buildConfig = true }` |

**Manifeste**

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-feature android:name="android.hardware.camera.any" android:required="false" />
<!-- PAS de permission INTERNET -->
```

- `MainActivity` : `android:screenOrientation="portrait"`, `android:windowSoftInputMode="adjustResize"`.
- `enableEdgeToEdge()` ; barres système transparentes, icônes claires.
- Nom de l'app : **SPECTRE**. Package : `com.spectre.colorhunt`.
- Icône adaptative : fond `#0A0A0F`, anneau arc-en-ciel (dégradé conique rouge → orange → vert → bleu →
  violet → rouge) et disque central au même dégradé (vector drawable).

---

## 4. Architecture et arborescence

```
app/src/main/java/com/spectre/colorhunt/
├── SpectreApp.kt                 Application : crée l'AppContainer
├── AppContainer.kt               Injection manuelle (server, repositories, feedback)
├── MainActivity.kt               setContent { SpectreTheme { SpectreNavHost() } }
│
├── core/                         ── KOTLIN PUR (aucun import android.*) ──
│   ├── color/ColorMath.kt        hex ⇄ RGB ⇄ HSL, luminance
│   ├── rarity/Rarity.kt          enum Rarity + RarityEngine
│   ├── series/Series.kt          définitions des 3 séries + progression
│   ├── economy/Economy.kt        recharge quotidienne, plafonds
│   └── model/Models.kt           types partagés (§5)
│
├── server/                       ── KOTLIN PUR — « backend » simulé, SEULE autorité ──
│   ├── SpectreServer.kt          interface (contrat réseau futur)
│   ├── FakeSpectreServer.kt      loterie du pixel, registre, claims, latence
│   ├── RegistrySeed.kt           ~500 couleurs déjà prises (déterministe)
│   ├── Mulberry32.kt             PRNG seedé
│   └── ClaimsStore.kt            interface de persistance du serveur
│
├── data/
│   ├── client/                   Room « spectre_client.db » : owned_colors, wishlist
│   ├── server/RoomClaimsStore.kt Room « spectre_server.db » : claims (séparée du client !)
│   ├── PlayerPrefs.kt            DataStore : pseudo, économie, séries complétées, capture en attente
│   ├── ThumbnailStore.kt         écriture/lecture des vignettes JPEG
│   └── PlayerRepository.kt       façade utilisée par les ViewModels
│
├── feedback/
│   ├── ToneSynth.kt              synthèse et lecture des sons
│   ├── Haptics.kt                motifs de vibration
│   └── Confetti.kt               particules Canvas
│
└── ui/
    ├── theme/                    Color.kt, Type.kt, Theme.kt (tokens §8)
    ├── components/               RarityBadge, ColorSwatch, PillButton, SpectreButton…
    ├── onboarding/               OnboardingScreen
    ├── capture/                  CaptureScreen, CaptureViewModel, ImagePipeline
    ├── reveal/                   RevealOverlay, RevealViewModel (machine à états §7.3)
    ├── collection/               CollectionScreen, SpectreWheel, ColorDetailSheet
    ├── series/                   SeriesScreen, SeriesCelebration
    ├── registry/                 RegistryScreen, RegistryViewModel
    └── debug/                    DebugSheet (uniquement si BuildConfig.DEBUG)

app/src/test/java/com/spectre/colorhunt/   tests unitaires JVM (§12)
```

**Frontière serveur.** L'UI et les repositories ne parlent au « serveur » qu'à travers l'interface
`SpectreServer`. Ils ne lisent jamais `spectre_server.db` directement. Cette frontière permettra de
remplacer `FakeSpectreServer` par un client HTTP sans toucher au reste.

---

## 5. Modèle de données (Kotlin, normatif)

```kotlin
package com.spectre.colorhunt.core.model

import com.spectre.colorhunt.core.rarity.Rarity

/** Hex toujours au format "#RRGGBB" en MAJUSCULES. */
typealias Hex = String

data class Rgb(val r: Int, val g: Int, val b: Int)

/** h : 0–360, s : 0–100, l : 0–100 — ENTIERS arrondis (voir ColorMath). */
data class Hsl(val h: Int, val s: Int, val l: Int)

enum class CaptureSource { CAMERA, GALLERY, DEBUG }

/** Couleur possédée par le joueur local. */
data class OwnedColor(
    val hex: Hex,
    val name: String,
    val rarity: Rarity,
    val capturedAt: Long,          // epoch ms
    val thumbPath: String?,        // chemin absolu de la vignette JPEG, null si non conservée
    val source: CaptureSource,
)

/** Entrée du registre mondial : une couleur possédée par quelqu'un. */
data class RegistryEntry(
    val hex: Hex,
    val name: String,
    val owner: String,
    val claimedAt: Long,
)

/** Position du pixel choisi, en fractions [0,1) de la largeur/hauteur de l'image. */
data class PixelPos(val x: Float, val y: Float)

/** Image envoyée au serveur : pixels ARGB, sans dépendance android.graphics. */
class CaptureImage(val width: Int, val height: Int, val argb: IntArray)

sealed interface CaptureResult {
    val hex: Hex
    val rarity: Rarity
    val pixel: PixelPos

    data class Free(
        override val hex: Hex,
        override val rarity: Rarity,
        override val pixel: PixelPos,
    ) : CaptureResult

    data class Taken(
        override val hex: Hex,
        override val rarity: Rarity,
        override val pixel: PixelPos,
        val owner: String,
        val name: String,
    ) : CaptureResult
}

sealed interface ClaimResult {
    data class Ok(val entry: RegistryEntry) : ClaimResult
    data object AlreadyTaken : ClaimResult
}

data class CaptureEconomy(
    val available: Int,
    val lastRefillDate: String,    // ISO "yyyy-MM-dd", fuseau local
)

/** Couleur libre révélée mais pas encore gravée (survit à la mort du processus). */
data class PendingClaim(
    val hex: Hex,
    val rarity: Rarity,
    val pixel: PixelPos,
    val thumbPath: String?,
    val framePath: String?,        // image figée plein écran en cache, pour réafficher le fond
    val source: CaptureSource,
    val createdAt: Long,
)
```

**Tables Room**

| Base | Table | Colonnes |
|---|---|---|
| `spectre_client.db` | `owned_colors` | `hex TEXT PK`, `name TEXT`, `rarity TEXT`, `capturedAt INTEGER`, `thumbPath TEXT NULL`, `source TEXT` |
| `spectre_client.db` | `wishlist` | `hex TEXT PK`, `addedAt INTEGER` |
| `spectre_server.db` | `claims` | `hex TEXT PK`, `name TEXT`, `owner TEXT`, `claimedAt INTEGER` |

Collection toujours triée par `capturedAt DESC` (plus récente en premier).

**Clés DataStore (`player_prefs`)** : `pseudo`, `available`, `lastRefillDate`, `completedSeries`
(string set), `inFlightSince` (long, voir §10), et les champs de `PendingClaim` à plat
(`pending_hex`, `pending_rarity`, `pending_px`, `pending_py`, `pending_thumb`, `pending_frame`,
`pending_source`, `pending_createdAt`).

---

## 6. Logique de jeu (référence normative)

### 6.1 Couleurs — `ColorMath`

Le HSL est **arrondi à l'entier** ; la rareté et les séries dépendent de cet arrondi.
`roundToInt()` de Kotlin arrondit les demis vers le haut, comme `Math.round` en JavaScript : les deux
plateformes donnent donc les mêmes résultats.

```kotlin
package com.spectre.colorhunt.core.color

import com.spectre.colorhunt.core.model.Hsl
import com.spectre.colorhunt.core.model.Rgb
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

object ColorMath {
    private val HEX_RE = Regex("^#?[0-9a-fA-F]{6}$")

    fun isValidHex(input: String): Boolean = HEX_RE.matches(input.trim())

    fun normalizeHex(input: String): String =
        "#" + input.trim().removePrefix("#").uppercase(Locale.ROOT)

    fun rgbToHex(r: Int, g: Int, b: Int): String = String.format(
        Locale.ROOT, "#%02X%02X%02X",
        r.coerceIn(0, 255), g.coerceIn(0, 255), b.coerceIn(0, 255),
    )

    fun hexToRgb(hex: String): Rgb {
        require(isValidHex(hex)) { "Hex invalide : $hex" }
        val n = hex.trim().removePrefix("#").toInt(16)
        return Rgb((n shr 16) and 0xFF, (n shr 8) and 0xFF, n and 0xFF)
    }

    fun rgbToHsl(c: Rgb): Hsl {
        val rn = c.r / 255.0
        val gn = c.g / 255.0
        val bn = c.b / 255.0
        val mx = max(rn, max(gn, bn))
        val mn = min(rn, min(gn, bn))
        val l = (mx + mn) / 2
        var h = 0.0
        var s = 0.0
        if (mx != mn) {
            val d = mx - mn
            s = if (l > 0.5) d / (2 - mx - mn) else d / (mx + mn)
            h = when (mx) {
                rn -> ((gn - bn) / d + (if (gn < bn) 6 else 0)) * 60
                gn -> ((bn - rn) / d + 2) * 60
                else -> ((rn - gn) / d + 4) * 60
            }
        }
        return Hsl(h.roundToInt(), (s * 100).roundToInt(), (l * 100).roundToInt())
    }

    fun hexToHsl(hex: String): Hsl = rgbToHsl(hexToRgb(hex))

    /** Luminance relative 0–1. */
    fun luminance(hex: String): Double {
        val (r, g, b) = hexToRgb(hex)
        fun lin(c: Int): Double {
            val s = c / 255.0
            return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }

    /** true → texte sombre (noir 85 %) sur cette couleur ; false → texte clair (blanc 92 %). */
    fun needsDarkText(hex: String): Boolean = luminance(hex) > 0.35
}
```

### 6.2 Rareté — calculée, jamais arbitraire

Ordre de priorité : **Légendaire > Épique > Rare > Commune**. On teste dans cet ordre et on s'arrête au
premier qui correspond.

| Rang | Règle exacte |
|---|---|
| **Légendaire** | (a) gris pur `r == g == b` ; (b) chaque canal ∈ {0x00, 0x80, 0xFF} ; (c) palindrome hex `d0==d5 && d1==d4 && d2==d3` ; (d) suite de 6 chiffres hex consécutifs croissants (`#123456`, `#ABCDEF`) ou décroissants (`#FEDCBA`) ; (e) octets doublés `d0==d1 && d2==d3 && d4==d5` (`#AABBCC`) |
| **Épique** | couleur « pure » : `max(r,g,b) − min(r,g,b) ≥ 170` **et** `max(r,g,b) ≥ 200` |
| **Rare** | saturation HSL `> 70` **ou** luminosité HSL `> 90` **ou** `< 10` |
| **Commune** | tout le reste (gris, bruns, verts ternes : la majorité du monde réel) |

```kotlin
package com.spectre.colorhunt.core.rarity

import com.spectre.colorhunt.core.color.ColorMath

enum class Rarity(val label: String, val rank: Int, val argb: Long) {
    COMMUNE("Commune", 0, 0xFF8A8F98),
    RARE("Rare", 1, 0xFF4DA3FF),
    EPIQUE("Épique", 2, 0xFFC05CFF),
    LEGENDAIRE("Légendaire", 3, 0xFFFFCC4D),
}

object RarityEngine {
    private val REMARKABLE = setOf(0x00, 0x80, 0xFF)

    fun isLegendary(hex: String): Boolean {
        val d = ColorMath.normalizeHex(hex).substring(1)
        val (r, g, b) = ColorMath.hexToRgb(hex)
        if (r == g && g == b) return true
        if (r in REMARKABLE && g in REMARKABLE && b in REMARKABLE) return true
        if (d[0] == d[5] && d[1] == d[4] && d[2] == d[3]) return true
        val v = d.map { it.digitToInt(16) }
        val asc = (1..5).all { v[it] == v[it - 1] + 1 }
        val desc = (1..5).all { v[it] == v[it - 1] - 1 }
        if (asc || desc) return true
        if (d[0] == d[1] && d[2] == d[3] && d[4] == d[5]) return true
        return false
    }

    fun isEpic(hex: String): Boolean {
        val (r, g, b) = ColorMath.hexToRgb(hex)
        val mx = maxOf(r, g, b)
        val mn = minOf(r, g, b)
        return mx - mn >= 170 && mx >= 200
    }

    fun isRare(hex: String): Boolean {
        val hsl = ColorMath.hexToHsl(hex)
        return hsl.s > 70 || hsl.l > 90 || hsl.l < 10
    }

    fun compute(hex: String): Rarity = when {
        isLegendary(hex) -> Rarity.LEGENDAIRE
        isEpic(hex) -> Rarity.EPIQUE
        isRare(hex) -> Rarity.RARE
        else -> Rarity.COMMUNE
    }
}
```

Distribution mesurée sur 200 000 couleurs uniformément aléatoires : commune 47,9 %, rare 27,4 %,
épique 24,6 %, légendaire 0,05 %. Les photos réelles étant majoritairement ternes, la part de communes est
bien plus élevée en jeu.

### 6.3 La loterie du pixel — `FakeSpectreServer`

C'est le **cœur anti-triche**. Contrat :

```kotlin
package com.spectre.colorhunt.server

interface SpectreServer {
    /** Le serveur choisit LUI-MÊME un pixel, ajoute un bruit ±5/canal, consulte le registre. */
    suspend fun submitCapture(image: CaptureImage): CaptureResult
    /** Re-vérifie la disponibilité côté serveur avant d'attribuer. */
    suspend fun claimColor(hex: String, name: String, ownerPseudo: String): ClaimResult
    suspend fun lookupColor(hex: String): RegistryEntry?
    /** Nombre total de couleurs possédées dans le monde (seed + claims). */
    suspend fun countClaimed(): Int
}

interface ClaimsStore {
    suspend fun get(hex: String): RegistryEntry?
    suspend fun insert(entry: RegistryEntry)
    suspend fun allHexes(): Set<String>
    suspend fun clear()
}
```

Implémentation de référence :

```kotlin
class FakeSpectreServer(
    private val claims: ClaimsStore,
    private val random: kotlin.random.Random = kotlin.random.Random.Default,
    private val latency: suspend () -> Unit = { kotlinx.coroutines.delay(random.nextLong(300, 801)) },
    nowMs: () -> Long = { System.currentTimeMillis() },
) : SpectreServer {

    private val seed: Map<String, RegistryEntry> = buildSeedRegistry(nowMs())
    private val claimMutex = kotlinx.coroutines.sync.Mutex()

    /** DEBUG uniquement : si non nul, la prochaine capture renvoie ce hex (sans bruit). */
    @Volatile var debugForcedHex: String? = null

    private suspend fun owner(hex: String): RegistryEntry? = claims.get(hex) ?: seed[hex]

    override suspend fun submitCapture(image: CaptureImage): CaptureResult {
        latency()
        val px = random.nextInt(image.width)
        val py = random.nextInt(image.height)
        val hex = debugForcedHex?.let { debugForcedHex = null; ColorMath.normalizeHex(it) } ?: run {
            val argb = image.argb[py * image.width + px]
            val r0 = (argb shr 16) and 0xFF
            val g0 = (argb shr 8) and 0xFF
            val b0 = argb and 0xFF
            fun noise() = random.nextInt(-5, 6)            // −5..+5 inclus
            ColorMath.rgbToHex(
                (r0 + noise()).coerceIn(0, 255),
                (g0 + noise()).coerceIn(0, 255),
                (b0 + noise()).coerceIn(0, 255),
            )
        }
        val rarity = RarityEngine.compute(hex)
        val pixel = PixelPos(px.toFloat() / image.width, py.toFloat() / image.height)
        val o = owner(hex)
        return if (o != null) CaptureResult.Taken(hex, rarity, pixel, o.owner, o.name)
        else CaptureResult.Free(hex, rarity, pixel)
    }

    override suspend fun claimColor(hex: String, name: String, ownerPseudo: String): ClaimResult {
        latency()
        val h = ColorMath.normalizeHex(hex)
        return claimMutex.withLock {
            if (owner(h) != null) return@withLock ClaimResult.AlreadyTaken
            val clean = name.filterNot { it.isISOControl() }.trim().take(40).ifBlank { "Sans nom" }
            val entry = RegistryEntry(h, clean, ownerPseudo, System.currentTimeMillis())
            claims.insert(entry)
            ClaimResult.Ok(entry)
        }
    }

    override suspend fun lookupColor(hex: String): RegistryEntry? {
        latency()
        return owner(ColorMath.normalizeHex(hex))
    }

    override suspend fun countClaimed(): Int {
        latency()
        return (seed.keys + claims.allHexes()).size
    }
}
```

Points clés :

- Latence artificielle **300–800 ms** sur chaque appel (injectable pour les tests).
- L'image reçue est **déjà recadrée** au format de l'écran par le client (§7.2), donc tout pixel tiré est
  visible à l'écran pendant la révélation.
- Image envoyée au serveur : côté le plus long **≤ 480 px**.

### 6.4 Le registre mondial seedé (~500 couleurs déjà prises)

Le registre est **généré de façon déterministe** au démarrage (non stocké) : tous les appareils voient le
même monde, identique au prototype web. Il contient 25 couleurs iconiques puis des couleurs aléatoires
jusqu'à **500 entrées exactement**.

**PRNG Mulberry32** (portage exact, vérifié identique à la version JavaScript sur 100 000 tirages) :

```kotlin
package com.spectre.colorhunt.server

class Mulberry32(seed: Int) {
    private var a = seed
    /** Renvoie un Double dans [0, 1). */
    fun next(): Double {
        a += 0x6D2B79F5
        var t = a
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        return ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL) / 4294967296.0
    }
}
```

Les trois premiers tirages avec la graine `0x5BEC7EE` sont `0.6971473212`, `0.9636811074`, `0.8349227423`.

**Listes (à recopier telles quelles, dans cet ordre)**

```kotlin
private val ICONIC = listOf(
    Triple("#FF0000", "Rouge Absolu", "chroma_king"),
    Triple("#00FF00", "Vert Machine", "pixelmancer"),
    Triple("#0000FF", "Bleu Primaire", "chroma_king"),
    Triple("#000000", "Le Néant", "void_walker"),
    Triple("#FFFFFF", "Lumière Totale", "prisma"),
    Triple("#FFFF00", "Soleil Criard", "helios22"),
    Triple("#FF00FF", "Magenta Interdit", "nyx_hunter"),
    Triple("#00FFFF", "Cyan Glacial", "borealis"),
    Triple("#FF8000", "Orange Réacteur", "helios22"),
    Triple("#800080", "Pourpre Impérial", "byzance"),
    Triple("#808080", "Gris Milieu", "void_walker"),
    Triple("#C0C0C0", "Argent Lunaire", "selene.hex"),
    Triple("#FFD700", "Or des Fous", "midas_touch"),
    Triple("#FF69B4", "Rose Bonbon Volé", "candy_crush_84"),
    Triple("#8B4513", "Terre de Selle", "terracotta"),
    Triple("#123456", "La Suite Parfaite", "sequenceur"),
    Triple("#ABCDEF", "Alphabet Céleste", "sequenceur"),
    Triple("#DEADBE", "Presque Deadbeef", "hexorciste"),
    Triple("#C0FFEE", "Café Serré", "barista_dev"),
    Triple("#BADA55", "Vert Frimeur", "hexorciste"),
    Triple("#FACADE", "Belle Façade", "archi_texte"),
    Triple("#B00B1E", "Rouge Scandale", "nyx_hunter"),
    Triple("#0D0D0D", "Noir Studio", "void_walker"),
    Triple("#F5F5DC", "Beige Notaire", "archi_texte"),
    Triple("#4B0082", "Indigo Profond", "byzance"),
)

private val ADJ = listOf(
    "Brûlé", "Glacé", "Perdu", "Sauvage", "Doux", "Amer", "Électrique", "Fané",
    "Secret", "Royal", "Pâle", "Profond", "Fumé", "Vif", "Ancien", "Fragile",
    "Nocturne", "Solaire", "Boréal", "Toxique", "Velouté", "Rouillé", "Poudré",
    "Néon", "Astral", "Mineur", "Majeur", "Discret", "Fatal", "Tendre",
)

private val NOUN = listOf(
    "Crépuscule", "Océan", "Braise", "Mousse", "Orage", "Sirop", "Lagon",
    "Cendre", "Pollen", "Météore", "Lichen", "Nectar", "Fjord", "Désert",
    "Encre", "Écume", "Basalte", "Nébuleuse", "Prune", "Absinthe", "Cobalt",
    "Safran", "Turquin", "Garance", "Céladon", "Vermillon", "Aurore", "Éclipse",
    "Sous-bois", "Marée", "Comète", "Givre", "Torrent", "Volcan", "Papyrus",
)

private val PSEUDO_A = listOf(
    "pixel", "hex", "chroma", "neo", "luna", "dark", "ultra", "mono", "poly",
    "astro", "vapor", "retro", "cyber", "wild", "zen", "echo", "nova", "flux",
)

private val PSEUDO_B = listOf(
    "hunter", "catcher", "weaver", "smith", "ghost", "fox", "wolf", "raven",
    "mancer", "seeker", "drifter", "pilot", "witch", "monk", "punk", "sage",
)
```

**Génération — l'ordre des tirages est normatif**

```kotlin
private fun <T> List<T>.pick(rand: Mulberry32): T = this[(rand.next() * size).toInt()]

private fun fakeName(rand: Mulberry32): String {
    val noun = NOUN.pick(rand)                 // tirage 1
    val adj = ADJ.pick(rand)                   // tirage 2
    return if (rand.next() < 0.35) noun else "$noun $adj"   // tirage 3
}

private fun fakePseudo(rand: Mulberry32): String {
    val a = PSEUDO_A.pick(rand)                                          // tirage 1
    val b = PSEUDO_B.pick(rand)                                          // tirage 2
    val suffix = if (rand.next() < 0.4) (rand.next() * 99).toInt().toString() else ""  // tirage 3 (+4)
    val sep = if (rand.next() < 0.3) "_" else ""                         // tirage suivant
    return "$a$sep$b$suffix"
}

fun buildSeedRegistry(nowMs: Long): Map<String, RegistryEntry> {
    val rand = Mulberry32(0x5BEC7EE)
    val year = 365L * 24 * 3600 * 1000
    val registry = LinkedHashMap<String, RegistryEntry>()
    for ((hex, name, owner) in ICONIC) {
        registry[hex] = RegistryEntry(hex, name, owner, nowMs - (rand.next() * year).toLong())
    }
    while (registry.size < 500) {
        val r = (rand.next() * 256).toInt()
        val g = (rand.next() * 256).toInt()
        val b = (rand.next() * 256).toInt()
        val hex = ColorMath.rgbToHex(r, g, b)
        if (hex in registry) continue
        val name = fakeName(rand)
        val owner = fakePseudo(rand)
        val claimedAt = nowMs - (rand.next() * year).toLong()
        registry[hex] = RegistryEntry(hex, name, owner, claimedAt)
    }
    return registry
}
```

Vecteurs attendus (index dans l'ordre d'insertion) :

| Index | Hex | Nom | Propriétaire |
|---|---|---|---|
| 0 | `#FF0000` | Rouge Absolu | chroma_king |
| 24 | `#4B0082` | Indigo Profond | byzance |
| 25 | `#C5ED0E` | Marée | monoseeker9 |
| 26 | `#7A870D` | Océan Poudré | darkmancer |
| 27 | `#A6E095` | Nébuleuse Toxique | dark_catcher |
| 100 | `#5D66C1` | Météore Fumé | poly_raven74 |
| 499 | `#B03F7E` | Lichen Fané | zenghost |

Répartition des raretés dans le seed : légendaire 16, épique 108, rare 147, commune 229.

### 6.5 Économie des captures

| Règle | Valeur |
|---|---|
| Captures au premier lancement | 3 |
| Recharge quotidienne | +3 à minuit (fuseau local), vérifiée au lancement **et** à chaque `ON_RESUME` |
| Réserve maximale | 5 (pas d'accumulation au-delà : « utilise-les ou perds-les ») |
| Débit | Au déclenchement (shutter), avant l'envoi au serveur |
| Remboursement | Si le serveur échoue, ou si le processus meurt avant le résultat (§10) |
| Gain simulé | Bouton discret « +1 capture (marcher 2 km) », plafonné à 5 |

```kotlin
package com.spectre.colorhunt.core.economy

const val DAILY_CAPTURES = 3
const val MAX_RESERVE = 5

/** Idempotente pour un même jour : gère le double lancement. */
fun applyDailyRefill(e: CaptureEconomy, today: java.time.LocalDate): CaptureEconomy {
    val last = runCatching { java.time.LocalDate.parse(e.lastRefillDate) }.getOrNull()
    if (last != null && !today.isAfter(last)) return e
    return CaptureEconomy(minOf(MAX_RESERVE, e.available + DAILY_CAPTURES), today.toString())
}

fun spend(e: CaptureEconomy): CaptureEconomy? =
    if (e.available <= 0) null else e.copy(available = e.available - 1)

fun earn(e: CaptureEconomy): CaptureEconomy =
    e.copy(available = minOf(MAX_RESERVE, e.available + 1))
```

Le débit doit être **atomique** (une seule transaction `DataStore.edit`) pour empêcher un double tap de
dépenser deux captures.

### 6.6 Séries

```kotlin
package com.spectre.colorhunt.core.series

data class SeriesDef(
    val id: String,
    val title: String,
    val description: String,
    val target: Int,
    val explicitHexes: List<String>? = null,      // série « liste »
    val matches: ((String) -> Boolean)? = null,   // série « zone »
    val previewColors: List<String>,
)

val PURE_GREYS: List<String> = (0..15).map { "#" + it.toString(16).uppercase().repeat(6) }
// #000000, #111111, … #FFFFFF

fun isFire(hex: String): Boolean {
    val (h, s, l) = ColorMath.hexToHsl(hex)
    return (h <= 45 || h >= 350) && s >= 50 && l in 20..75
}

fun isDaySky(hex: String): Boolean {
    val (h, s, l) = ColorMath.hexToHsl(hex)
    return h in 190..240 && s >= 35 && l in 40..85
}

val SERIES = listOf(
    SeriesDef("feu", "Feu", "10 couleurs de la zone chaude — rouges, oranges, braises.",
        target = 10, matches = ::isFire,
        previewColors = listOf("#8C1D04", "#C63A0A", "#E85D1F", "#F08A2C", "#D94020")),
    SeriesDef("gris-purs", "Les 16 gris purs", "Du néant à la lumière : #000000, #111111 … #FFFFFF.",
        target = 16, explicitHexes = PURE_GREYS,
        previewColors = listOf("#000000", "#444444", "#888888", "#CCCCCC", "#FFFFFF")),
    SeriesDef("ciel-du-jour", "Ciel du jour", "5 bleus du ciel, du zénith à l'horizon.",
        target = 5, matches = ::isDaySky,
        previewColors = listOf("#2E6FBF", "#4A8AD4", "#6FA8E0", "#8FC0EC", "#B4D6F5")),
)

data class SeriesProgress(val def: SeriesDef, val matched: List<String>, val count: Int, val done: Boolean)

/** collection triée de la plus récente à la plus ancienne. */
fun progress(def: SeriesDef, collection: List<OwnedColor>): SeriesProgress {
    val matched: List<String> = if (def.explicitHexes != null) {
        val owned = collection.map { it.hex }.toSet()
        def.explicitHexes.filter { it in owned }
    } else {
        collection.asSequence().map { it.hex }.distinct()
            .filter { def.matches!!(it) }.take(def.target).toList()
    }
    val count = minOf(matched.size, def.target)
    return SeriesProgress(def, matched.take(def.target), count, count >= def.target)
}
```

**Détection de complétion** : après chaque gravure réussie, recalculer la progression de toutes les séries ;
toute série `done` absente de `completedSeries` est ajoutée et déclenche la célébration (§7.6). Si plusieurs
séries se complètent en même temps, les célébrer **l'une après l'autre**.

> ⚠️ **Point de design assumé.** `#000000` et `#FFFFFF` sont détenues par d'autres joueurs dans le registre
> seedé : la série « Les 16 gris purs » ne peut donc pas être complétée sans un futur système d'échange.
> C'est voulu : l'écran Séries affiche ces deux cases verrouillées **avec le pseudo du propriétaire**, ce qui
> nourrit la convoitise. Le menu debug (§7.10) permet de tester la célébration quand même.

### 6.7 Convoitises (wishlist)

- Ajout et retrait depuis une révélation « déjà prise » et depuis le Registre (couleur libre ou prise).
- Quand le joueur grave une couleur de sa liste, elle en est retirée automatiquement.
- Stockée en Room (`wishlist`), ordre d'ajout.

---

## 7. Écrans et parcours

### 7.0 Navigation globale

- Au premier lancement (pseudo vide) : **Onboarding** plein écran, puis l'app.
- Barre d'onglets en bas, 4 onglets : **Capture** (par défaut), **Collection**, **Séries**, **Registre**.
  Icônes Material « outlined » : `CameraAlt`, `GridView`, `Layers`, `Search` (material-icons-extended
  autorisé). Libellés 10 sp en MAJUSCULES, interlettrage 0,08 em ; actif = `text`, inactif = `textDim`.
- Barre translucide : fond `#0A0A0F` à 82 % avec flou si API ≥ 31, bordure haute 1 dp `line`. Elle passe
  **au-dessus** de l'aperçu caméra (qui occupe tout l'écran).
- La **révélation** est un overlay plein écran au-dessus de tout (barre d'onglets masquée).
- Changement d'onglet : fondu enchaîné 200 ms.
- Au lancement, si une `PendingClaim` existe : ouvrir directement la révélation en phase **Nommage**
  (fond = la couleur, message « Une couleur attend encore son nom. »).

### 7.1 Onboarding

Centré verticalement, padding 36 dp :

1. Anneau logo 84 dp : bordure 10 dp en dégradé conique (`#FF3B5C → #FFB03B → #3BFF8F → #3B9DFF →
   #B03BFF → #FF3B5C`), qui tourne lentement (une rotation en 12 s).
2. « SPECTRE » — 30 sp, graisse Light, interlettrage 0,42 em.
3. Texte (14 sp, `textDim`, interligne 1,7) ; `16 777 216` en monospace `text`.
4. Champ pseudo (max 20 caractères, centré, fond `bgRaised`, rayon 14 dp).
5. Bouton « Commencer la chasse » (désactivé si vide).

Sortie : fondu + agrandissement à 1,04 en 400 ms. Le pseudo est enregistré, nettoyé (`trim`).

### 7.2 Écran Capture

**Disposition**

- Aperçu caméra **plein écran** (arrière, `FILL_CENTER`).
- **Viseur** discret au centre : carré 180 dp, 4 coins en équerre (22 dp, trait 2 dp blanc 90 %, coins
  arrondis 12 dp), opacité globale 50 %.
- **En haut à gauche** : pilule compteur (fond `#0A0A0F` à 60 %, bordure `line`) — « 3/5 » en chiffres
  tabulaires, gras 13 sp, suivi de 5 points de 7 dp (pleins = blanc, vides = blanc 18 %). Un appui long ouvre
  le menu debug (build debug uniquement).
- **En haut à droite** : pilule discrète en pointillés « +1 capture (marcher 2 km) », 11 sp, `textDim`,
  désactivée à 5/5.
- **En bas au centre** (au-dessus de la barre d'onglets) : **déclencheur** 78 dp — anneau blanc 4 dp, fond
  blanc 14 %, disque intérieur blanc 58 dp. Appui : ressort, échelle 0,9. Désactivé (opacité 35 %) si 0
  capture.
- À 0 capture : texte au-dessus du déclencheur « Plus de captures aujourd'hui. Reviens après minuit — ou
  marche un peu. » (13 sp, blanc 75 %, ombre portée).

**Permission caméra**

- Demandée à l'arrivée sur l'onglet. Pendant l'attente : « Démarrage de la caméra… ».
- Refusée, absente (émulateur) ou erreur de liaison CameraX → **mode galerie** : panneau centré (icône
  appareil photo 40 dp + texte d'explication), le déclencheur ouvre le Photo Picker. Bouton « Autoriser la
  caméra » : redemande la permission, ou ouvre les réglages de l'app si « Ne plus demander ».
- La caméra est déliée quand on quitte l'onglet (économie de batterie) et reliée au retour.

**Au déclenchement** (dans cet ordre)

1. Vérifier qu'il reste ≥ 1 capture, sinon ignorer.
2. Retour immédiat : flash blanc plein écran (opacité 0,9 → 0 en 150 ms), son d'obturateur, vibration 30 ms.
3. Débiter la capture (atomique) et poser `inFlightSince = now`.
4. Prendre la photo : `ImageCapture` (`CAPTURE_MODE_MINIMIZE_LATENCY`) → `ImageProxy.toBitmap()` →
   rotation selon `imageInfo.rotationDegrees`.
5. **Pipeline image** (sur `Dispatchers.Default`) :
   - **Recadrage centré au ratio de la fenêtre** (largeur/hauteur de l'écran) : ce que le joueur voit est
     exactement ce que le serveur échantillonne.
   - Image figée d'affichage : côté le plus long ≤ 1280 px, gardée en mémoire et écrite en cache JPEG
     (q 80) pour la reprise.
   - Image serveur : côté le plus long ≤ 480 px → `CaptureImage(width, height, argb)` via `getPixels`.
   - Vignette de provenance : côté le plus long ≤ 200 px, JPEG q 60 dans `filesDir/provenance/`.
6. Ouvrir l'overlay de révélation et appeler `server.submitCapture(image)`.

Le mode galerie suit le même pipeline à partir de l'image choisie (source `GALLERY`). Si le sélecteur est
annulé, rien n'est débité.

### 7.3 La révélation — moment « ouverture de booster »

**Machine à états (`RevealViewModel`)**

```
Lottery ──► Spark ──► Flood ──► Free ──► Claiming ──► Engraved ──► [SeriesComplete × n] ──► fin
                                  └──► Taken ──► fin
Lottery ──(erreur serveur)──► Error ──► fin (capture remboursée)
Claiming ──(AlreadyTaken)──► Taken
```

**Timeline**

| Phase | Durée | Ce qui se passe |
|---|---|---|
| **Flash** | 150 ms | Flash blanc (déjà décrit en §7.2). |
| **Lottery** | **max(1800 ms, réponse serveur)** | Photo figée plein écran. Une **ligne de balayage** horizontale (2 dp, dégradé transparent → blanc 90 % → transparent, halo blanc 35 % de 24 dp) parcourt l'image de haut en bas puis de bas en haut, en boucle de 2,4 s (ease-in-out). En bas, « LE SERVEUR TIRE UN PIXEL… » (13 sp, interlettrage 0,24 em) qui pulse (opacité 0,4 ↔ 1, 1,4 s). Son de suspense : 6 notes montantes. |
| **Spark** | 700 ms | La photo s'assombrit (voile noir 0 → 55 % en 300 ms). Au pixel élu, un disque de 14 dp de la couleur apparaît : échelle 0 → 2,2 → 1,6, halo de la couleur (rayon 40 dp puis 24 dp). Vibration 20 ms. |
| **Flood** | 750 ms | Un cercle de la couleur grandit depuis le pixel jusqu'à couvrir tout l'écran (rayon final = distance au coin le plus éloigné), easing `CubicBezier(0.3, 0, 0.2, 1)`. |
| **Résultat** | 450 ms (délai 150 ms) | Le fond devient la couleur. Le contenu apparaît (fondu + glissement de 24 dp vers le haut). Célébration (libre) ou note douce-amère (prise). |

Position du pixel à l'écran : `x = pixel.x × largeurOverlay`, `y = pixel.y × hauteurOverlay` (valable
grâce au recadrage au ratio de la fenêtre).

**Célébration proportionnelle à la rareté (couleur libre)**

| Rareté | Confettis | Son | Vibration (ms, alterné on/off) | Effets en plus |
|---|---|---|---|---|
| Commune | 1 salve, 30 particules, dispersion 50° | 2 notes | `[40]` | — |
| Rare | 1 salve, 90 particules, 70° | 3 notes | `[40, 60, 40]` | Halo blanc doux qui pulse derrière le hex (échelle 0,9 ↔ 1,1, 2 s) ; le badge pulse |
| Épique | 140 particules à 100°, puis 80 à 120° après 250 ms (plus haut) | 4 notes | `[50, 50, 50, 50, 80]` | Halo + rayons lumineux qui tournent lentement derrière le contenu |
| **Légendaire** | **5 salves dorées** de 120 particules, toutes les 320 ms, positions aléatoires (x 0,2–0,8 ; y 0,3–0,7), couleurs `#FFD700 #FFF3B0 #FFB347 #FFFFFF` | 6 notes | `[60, 40, 60, 40, 60, 40, 150]` | Tremblement d'écran (6 dp, 400 ms), anneau doré qui s'étend 2 fois, reflet doré qui balaie le badge |

Les confettis des raretés non légendaires utilisent une palette multicolore vive. Si l'utilisateur a
désactivé les animations système (`ANIMATOR_DURATION_SCALE == 0`) : pas de confettis ni de tremblement, et
l'inondation est remplacée par un fondu de 300 ms. Le suspense minimal de 1,8 s est conservé (c'est du
rythme de jeu).

**Retour arrière** : bloqué pendant Lottery, Spark, Flood et Claiming. Pendant le nommage, il affiche
« Grave d'abord son nom — elle t'attend. » (snackbar) sans fermer.

### 7.4 Nommage et gravure (couleur libre)

Contenu centré, couleur du texte selon `needsDarkText(hex)` (noir 85 % ou blanc 92 %) :

- « COULEUR LIBRE — ELLE EST À TOI » (13 sp, interlettrage 0,22 em, opacité 70 %).
- Hex en monospace 15 sp, interlettrage 0,18 em.
- Badge de rareté (§8).
- « Baptise ta couleur » (26 sp, gras).
- Champ texte : fond blanc 90 %, texte `#111`, centré, 16 sp, rayon 14 dp, **max 40 caractères** (compter
  les points de code), placeholder « Son nom pour l'éternité… », compteur « 12/40 » dessous. Focus et clavier
  automatiques ; action IME « Terminé » = valider. `imePadding()` pour rester visible au-dessus du clavier.
- Bouton « Graver ce nom » (désactivé si vide ; devient « Gravure… » pendant l'appel).

À la validation : `server.claimColor(hex, name, pseudo)`.

- `Ok` → insérer l'`OwnedColor` (provenance : date, vignette, source), effacer la `PendingClaim`, retirer le
  hex des convoitises, détecter les séries complétées, passer en **Engraved**.
- `AlreadyTaken` → passer en **Taken** (cas rarissime, le serveur fait autorité).

**Écran Engraved** : hex, puis le nom entre guillemets français **qui s'écrit lettre par lettre** (35 ms par
caractère, micro-vibration légère par lettre, comme un burin), puis « DÉCOUVERTE PAR LOIC — POUR TOUJOURS »
(12 sp, interlettrage 0,14 em, opacité 65 %). Bouton « Retour à la chasse », ou « Continuer… » si une série
vient d'être complétée.

### 7.5 Couleur déjà prise — le moment doux-amer

- « DÉJÀ DÉCOUVERTE », hex.
- Carte translucide (fond noir 35 %, flou, bordure blanc 14 %, rayon 20 dp) :
  - « « Rouge Absolu » » (26 sp, gras) ;
  - « Cette couleur appartient à **chroma_king**. Il ne peut y en avoir qu'un. » ;
  - bouton fantôme « ♡ Convoiter cette couleur » ↔ « ♥ Dans ta liste de convoitises » ;
  - bouton « Continuer la chasse ».
- Son : deux notes descendantes ; vibration `[20, 80, 20]`.

### 7.6 Série complétée

Overlay plein écran (fond `#050508` à 92 %, flou) :

- **Artefact** : disque de 220 dp rempli d'un dégradé composé des couleurs de la série (`matched`), qui
  tourne en continu (une rotation en 8 s) et dont le dégradé se décale (4 s, aller-retour), halo blanc 12 %.
  Entrée en ressort : échelle 0 → 1, rotation −30° → 0°.
- Après 500 ms : « SÉRIE COMPLÉTÉE » (doré `#FFCC4D`), titre de la série, description.
- Bouton « Magnifique » (ou « Suivante » s'il reste des séries à célébrer).
- Son de série + vibration `[80, 40, 80, 40, 200]`.

### 7.7 Collection

**En-tête** : « Collection » (22 sp) ; « Tu possèdes **23** des 16 777 216 couleurs du spectre. »
(nombres formatés `Locale.FRANCE`). Sélecteur segmenté **Mur | Spectre**.

**Vue Mur**

- `LazyVerticalGrid(GridCells.Adaptive(72.dp))`, espacement 10 dp, plus récente en premier, `key = hex`.
- Chaque carré : ratio 1, rayon 14 dp, bordure 1 dp blanc 6 %, **point de rareté** de 7 dp en haut à droite
  (marge 6 dp) avec halo de sa couleur.
- Appui : ressort, échelle 0,92. Apparition initiale : fondu + échelle 0,8 → 1, décalée de 20 ms par élément
  (400 ms max).
- Tap → fiche détaillée. Appui long → copie le hex dans le presse-papiers (« Hex copié »).
- Collection vide : « Ta collection est vide. Le monde entier est un gisement de couleurs — va en capturer
  une. »

**Vue Spectre — roue chromatique**

- `Canvas` carré : côté = min(largeur − 40 dp, 340 dp). `c` = centre, `maxR = c − 18 dp`.
- **Angle = teinte, rayon = saturation** : `θ = (h − 90)°` en coordonnées écran (y vers le bas), donc
  rouge en haut, sens horaire ; `x = c + (s/100)·maxR·cos θ`, `y = c + (s/100)·maxR·sin θ`.
- Fond : disque en `Brush.sweepGradient(rouge, jaune, vert, cyan, bleu, magenta, rouge)` **tourné de −90°**
  pour que les teintes du fond coïncident avec les points ; opacité 14 %, flou 2 dp si API ≥ 31.
- Cercles guides : `maxR` (blanc 10 %) et `maxR/2` (blanc 5 %).
- Chaque couleur = point de 7 dp de rayon, contour 1 dp blanc 50 %, apparition en échelle. Zone de tap de
  20 dp → fiche détaillée.
- Légende : « Tes couleurs sur la roue chromatique. Le centre est terne, le bord est saturé — les zones vides
  sont encore à conquérir. »

**Fiche détaillée** (`ModalBottomSheet`, fond `bgOverlay`, rayon haut 24 dp, poignée 40 × 4 dp)

- Grand aplat 16:10, rayon 18 dp, hex en bas à gauche (monospace 14 sp, couleur selon luminance).
- « « Nom » » (22 sp, gras) ; « Découverte par loic » (13 sp, `textDim`) ; badge de rareté.
- Lignes séparées par `line` : « Capturée le » → `19 juillet 2026 à 14:35`
  (`DateTimeFormatter.ofPattern("d MMMM yyyy 'à' HH:mm", Locale.FRANCE)`) ; « HSL » → `119° · 100% · 26%`
  en monospace ; « Source » → « Caméra » ou « Photo importée ».
- « PROVENANCE » puis la vignette (pleine largeur, rayon 14 dp). Absente si la vignette n'a pas pu être
  conservée.

### 7.8 Séries

« Séries » / « Des collections dans la collection. » Une carte par série (fond `bgRaised`, bordure
`line`, rayon 18 dp, padding 18 dp) :

- Bandeau dégradé (hauteur 10 dp) : couleurs obtenues si ≥ 2, sinon `previewColors` à 45 % d'opacité.
- Titre (16 sp) + « 3/10 » en monospace à droite, ou « ★ Complétée » en doré.
- Description (13 sp, `textDim`).
- **Cases** : une rangée de petites cases (18 dp, rayon 5 dp) — case possédée = remplie de la couleur ;
  case vide = contour pointillé. Pour « Les 16 gris purs » (grille 8 × 2), chaque case montre son gris ;
  une case **détenue par un autre joueur** est remplie à 35 % avec un cadenas, et un tap affiche
  « Détenue par void_walker » (données via `server.lookupColor`, appels lancés en parallèle à l'ouverture).
- Barre de progression 6 dp animée (700 ms, ease-out), dorée si complétée.

### 7.9 Registre — la fenêtre sur le monde partagé

- « Registre » / « La fenêtre sur le monde partagé — cherche un hex, vois qui le possède. »
- Statistique mondiale (via `countClaimed`) : « 500 couleurs ont déjà un propriétaire · 16 776 716 restent
  à découvrir ».
- Champ de recherche monospace, majuscules forcées, « # » ajouté automatiquement, 6 chiffres hex max,
  placeholder `#RRGGBB`, action IME « Rechercher » ; bouton « Chercher » actif seulement si l'hex est valide.
- Résultat (carte : aplat 64 dp + infos + cœur de convoitise) :
  - chargement : « Interrogation du registre mondial… » ;
  - **libre** : « Libre ! » en vert `#6FDC8C`, `#123321 · Légendaire`, « Personne ne la possède. À toi de
    la croiser dans le monde réel… » ;
  - **prise** : « Prise — « Rouge Absolu » », « Appartient à **chroma_king** depuis le 07/11/2025. » ;
  - **à moi** : « À toi ! », « Elle brille dans ta collection. » (pas de cœur).
- « COULEURS CONVOITÉES (2) » : liste (aplat 38 dp, hex, « Vérifier → ») ; tap = relance la recherche.
  Vide : « Rien pour l'instant. Quand une révélation t'échappe, convoite-la — tu sauras à qui elle
  appartient. »

### 7.10 Menu debug (uniquement si `BuildConfig.DEBUG`)

Ouvert par appui long sur la pilule compteur. Bottom sheet avec :

- **+1 capture** (même effet que le bouton visible).
- **Simuler un nouveau jour** : recule `lastRefillDate` d'un jour, puis applique la recharge.
- **Forcer la prochaine couleur…** : saisie d'un hex → `server.debugForcedHex`. Exemples utiles :
  `#FF0000` (prise), `#ABCCBA` (légendaire libre), `#F51D0A` (épique), `#B8431F` (rare), `#7A6E5F` (commune).
- **Remplir la série Feu à 9/10** : insère 9 couleurs Feu libres (source `DEBUG`) via `claimColor`. La
  prochaine capture d'une couleur Feu complète la série.
- **Tout réinitialiser** (avec confirmation) : vide les deux bases, le DataStore et les vignettes.

---

## 8. Direction artistique — design tokens

Interface **sombre et sobre** : les couleurs collectées sont les vedettes, l'UI s'efface. Esthétique
« spécimen de laboratoire » rencontre « cabinet de curiosités » : hex en petit, en monospace.

**Couleurs**

| Token | Valeur | Usage |
|---|---|---|
| `bg` | `#0A0A0F` | Fond de l'app |
| `bgRaised` | `#13131A` | Cartes, champs |
| `bgOverlay` | `#1A1A24` | Bottom sheets |
| `text` | `#E8E8EE` | Texte principal, boutons pleins |
| `textDim` | `#8A8F98` | Texte secondaire |
| `line` | `#FFFFFF` à 8 % | Bordures, séparateurs |
| `free` | `#6FDC8C` | « Libre ! » |
| `gold` | `#FFCC4D` | Séries complétées, légendaire |
| `danger` | `#FF5C5C` | Erreurs |
| Rareté | Commune `#8A8F98` · Rare `#4DA3FF` · Épique `#C05CFF` · Légendaire `#FFCC4D` | Badges, points |

**Typographie** : sans-serif système ; monospace (`FontFamily.Monospace`) pour les hex et compteurs.

| Style | Taille | Graisse | Divers |
|---|---|---|---|
| Titre d'écran | 22 sp | SemiBold | interlettrage −0,01 em |
| Sous-titre | 13 sp | Normal | `textDim`, chiffres tabulaires |
| Hex | 12 sp | Normal | monospace, interlettrage 0,06 em, `textDim` |
| Titre de révélation | 26 sp | Bold | interligne 1,25 |
| Statut (MAJUSCULES) | 13 sp | Normal | interlettrage 0,22 em, opacité 70 % |
| Badge | 11 sp | Bold | MAJUSCULES, interlettrage 0,16 em |
| Logo onboarding | 30 sp | Light | interlettrage 0,42 em |

**Formes et espacements** : marges d'écran 20 dp ; boutons rayon 14 dp, padding 14 × 24 dp, 15 sp
SemiBold ; bouton plein = fond `text`, texte `bg` ; bouton fantôme = fond blanc 8 %, bordure `line` ;
pilules rayon 999 ; cartes rayon 18 dp ; carrés de couleur rayon 14 dp.

**Badge de rareté** : pilule bordure 1 dp et texte de la couleur de la rareté, padding 5 × 12 dp.

**Micro-interactions partout** : tout élément tactile réagit (ressort sur l'échelle 0,92–0,97), transitions
fluides, jamais de changement d'état sans animation.

---

## 9. Animations, sons et haptique

### 9.1 Confettis (`Confetti.kt`)

Système de particules dans un `Canvas` plein écran au-dessus de l'overlay :

- Particule : position, vitesse (vitesse initiale 30–45 dp par tranche de 16 ms, direction dans le cône de
  dispersion autour de la verticale montante), gravité (≈ 0,5 dp/frame²), traînée 0,98, rotation et vitesse
  angulaire, forme rectangle 6 × 10 dp ou cercle 5 dp, couleur, durée de vie 2,5–3,5 s avec fondu final.
- Animation pilotée par `withFrameNanos`. `fun burst(count, spreadDeg, origin: Offset, colors, startVelocity)`.

### 9.2 Sons synthétisés (`ToneSynth.kt`)

Aucun fichier audio. Chaque son est une liste de notes rendue en PCM 16 bits mono 44,1 kHz puis jouée via
`AudioTrack` (`USAGE_GAME`, `MODE_STATIC`). Pré-rendre tous les sons au démarrage pour une latence nulle.

```kotlin
enum class Wave { SINE, SQUARE, TRIANGLE }
data class Note(val freq: Double, val startMs: Int, val durMs: Int, val gain: Double, val wave: Wave = Wave.SINE)
```

Enveloppe : montée de 0 au gain en 20 ms, puis décroissance exponentielle jusqu'à 0,0001 à la fin de la
note. Mixer, multiplier par 4, écrêter à ±0,9.

| Son | Notes |
|---|---|
| Obturateur | 880 Hz carré 50 ms gain 0,08 à t0 ; 440 Hz carré 60 ms gain 0,06 à 40 ms |
| Suspense | 6 notes triangle, `220 × 2^(i/12)` Hz, départ `i × 220 ms`, 180 ms, gain 0,04 |
| Révélation | Gamme `523.25, 659.25, 783.99, 1046.5, 1318.5, 1568` Hz : commune = 2 premières, rare = 3, épique = 4, légendaire = 6. Chaque note : départ `i × 90 ms`, 500 ms, gain 0,09 sinus + octave supérieure 250 ms gain 0,02 |
| Déjà prise | 392 Hz 400 ms à t0 ; 311.13 Hz 600 ms à 180 ms ; gain 0,06 sinus |
| Série complétée | `523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5` Hz, départ `i × 120 ms`, 400 ms, gain 0,08 |

Le son suit le volume « média » de l'appareil.

### 9.3 Haptique (`Haptics.kt`)

Les motifs du document sont au format « vibre, pause, vibre… ». `VibrationEffect.createWaveform` commence
par une **pause** : préfixer par `0`.

```kotlin
fun vibrate(pattern: LongArray) {
    val timings = longArrayOf(0) + pattern
    vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
}
```

Toujours en best-effort : `try/catch`, silencieux si non supporté.

---

## 10. Persistance et robustesse

| Situation | Comportement attendu |
|---|---|
| Caméra refusée / absente / erreur CameraX | Mode galerie (§7.2), aucun crash. |
| « Ne plus demander » | Le bouton « Autoriser la caméra » ouvre les réglages de l'app. |
| Double lancement le même jour | `applyDailyRefill` idempotente : pas de recharge en double (test §12). |
| Session qui traverse minuit | Recharge appliquée au prochain `ON_RESUME`. |
| Horloge reculée | Pas de recharge (`isAfter` strict). |
| Processus tué pendant la loterie | Au démarrage, si `inFlightSince` est posé sans résultat : rembourser 1 capture, effacer le marqueur. |
| Processus tué pendant le nommage | La `PendingClaim` (enregistrée dès le résultat « libre ») rouvre le nommage au lancement. |
| Erreur du serveur simulé | Phase Error, capture remboursée, « La capture s'est perdue… ». |
| Stockage plein à l'écriture de la vignette | Gravure sans vignette + snackbar « Stockage plein : la photo de provenance n'a pas pu être conservée. » |
| Stockage plein à l'insertion Room (`SQLiteFullException`) | La couleur reste en `PendingClaim` ; message « Stockage plein : libère de l'espace pour graver cette couleur. Elle t'attend. » |
| Double tap sur le déclencheur | Un seul débit (débit atomique + verrou `isCapturing`). |
| Hors connexion | Tout fonctionne : l'app n'utilise jamais le réseau. |

Toutes les écritures disque se font hors du thread principal. Aucune exception ne doit remonter jusqu'à un
crash : les erreurs se traduisent en états d'UI.

---

## 11. Textes de l'interface (français, exacts)

| Clé | Texte |
|---|---|
| `app_name` | SPECTRE |
| `onboarding_body` | Il existe 16 777 216 couleurs.\nChacune ne peut appartenir qu'à une seule personne au monde.\nChasse-les dans le réel, nomme-les, garde-les. |
| `onboarding_hint` | Ton pseudo de chasseur |
| `onboarding_cta` | Commencer la chasse |
| `tab_capture` / `tab_collection` / `tab_series` / `tab_registry` | Capture / Collection / Séries / Registre |
| `capture_counter` | %1$d/%2$d |
| `capture_debug_earn` | +1 capture (marcher 2 km) |
| `capture_empty` | Plus de captures aujourd'hui. Reviens après minuit — ou marche un peu. |
| `capture_camera_starting` | Démarrage de la caméra… |
| `capture_camera_denied` | Caméra indisponible ou refusée.\nLe déclencheur ouvrira ta galerie : choisis une photo, le serveur y pigera un pixel au hasard. |
| `capture_camera_allow` | Autoriser la caméra |
| `capture_shutter_cd` | Capturer |
| `reveal_lottery` | Le serveur tire un pixel… |
| `reveal_free_status` | Couleur libre — elle est à toi |
| `reveal_name_title` | Baptise ta couleur |
| `reveal_name_hint` | Son nom pour l'éternité… |
| `reveal_name_counter` | %1$d/40 |
| `reveal_name_cta` / `reveal_name_cta_busy` | Graver ce nom / Gravure… |
| `reveal_back_blocked` | Grave d'abord son nom — elle t'attend. |
| `reveal_pending_resume` | Une couleur attend encore son nom. |
| `reveal_engraved_by` | Découverte par %1$s — pour toujours |
| `reveal_back_to_hunt` / `reveal_continue` | Retour à la chasse / Continuer… |
| `reveal_taken_status` | Déjà découverte |
| `reveal_taken_body` | Cette couleur appartient à %1$s. Il ne peut y en avoir qu'un. |
| `reveal_wish_add` / `reveal_wish_added` | ♡ Convoiter cette couleur / ♥ Dans ta liste de convoitises |
| `reveal_taken_cta` | Continuer la chasse |
| `reveal_error_title` / `reveal_error_body` / `reveal_error_cta` | La capture s'est perdue… / Ta capture t'a été rendue. Réessaie. / Retour |
| `series_complete_status` | Série complétée |
| `series_complete_cta` / `series_complete_next` | Magnifique / Suivante |
| `collection_title` | Collection |
| `collection_count` | Tu possèdes %1$s des %2$s couleurs du spectre. |
| `collection_view_wall` / `collection_view_spectre` | Mur / Spectre |
| `collection_empty` | Ta collection est vide.\nLe monde entier est un gisement de couleurs — va en capturer une. |
| `collection_spectre_hint` | Tes couleurs sur la roue chromatique. Le centre est terne, le bord est saturé — les zones vides sont encore à conquérir. |
| `collection_hex_copied` | Hex copié |
| `detail_discovered_by` | Découverte par %1$s |
| `detail_captured_on` / `detail_hsl` / `detail_source` / `detail_provenance` | Capturée le / HSL / Source / Provenance |
| `detail_source_camera` / `detail_source_gallery` / `detail_source_debug` | Caméra / Photo importée / Debug |
| `series_title` / `series_subtitle` | Séries / Des collections dans la collection. |
| `series_done` | ★ Complétée |
| `series_count` | %1$d/%2$d |
| `series_slot_owned_by` | Détenue par %1$s |
| `registry_title` | Registre |
| `registry_subtitle` | La fenêtre sur le monde partagé — cherche un hex, vois qui le possède. |
| `registry_world_stat` | %1$s couleurs ont déjà un propriétaire · %2$s restent à découvrir |
| `registry_hint` / `registry_search` | #RRGGBB / Chercher |
| `registry_loading` | Interrogation du registre mondial… |
| `registry_free` / `registry_free_body` | Libre ! / Personne ne la possède. À toi de la croiser dans le monde réel… |
| `registry_taken` / `registry_taken_body` | Prise — « %1$s » / Appartient à %1$s depuis le %2$s. |
| `registry_mine` / `registry_mine_body` | À toi ! / Elle brille dans ta collection. |
| `registry_wishlist_title` | Couleurs convoitées (%1$d) |
| `registry_wishlist_empty` | Rien pour l'instant. Quand une révélation t'échappe, convoite-la — tu sauras à qui elle appartient. |
| `registry_wishlist_check` | Vérifier → |
| `storage_full_thumb` | Stockage plein : la photo de provenance n'a pas pu être conservée. |
| `storage_full_blocking` | Stockage plein : libère de l'espace pour graver cette couleur. Elle t'attend. |
| `debug_title` | Outils de test |
| `debug_new_day` / `debug_force_hex` / `debug_fill_fire` / `debug_reset` | Simuler un nouveau jour / Forcer la prochaine couleur… / Remplir la série Feu à 9/10 / Tout réinitialiser |

**Accessibilité** : `contentDescription` sur tout élément graphique (ex. carré de couleur : « Rouge Absolu,
#FF0000, Légendaire ») ; cibles tactiles ≥ 48 dp ; contraste du texte calculé selon la luminance.

---

## 12. Tests unitaires (JVM) — tous doivent passer

### `RarityEngineTest`

| Entrée | Attendu | Pourquoi |
|---|---|---|
| `#000000`, `#FFFFFF`, `#777777` | LEGENDAIRE | gris purs |
| `#FF0000`, `#FF8000`, `#0080FF` | LEGENDAIRE | canaux ∈ {00, 80, FF} |
| `#ABCCBA` | LEGENDAIRE | palindrome |
| `#1A44A1` → `isLegendary` true ; `#12A21A` → false | — | palindrome / non-palindrome |
| `#123456`, `#FEDCBA` | LEGENDAIRE | suites |
| `#123457` → `isLegendary` false | — | suite cassée |
| `#AABBCC`, `#1122EE` | LEGENDAIRE | octets doublés |
| `#3F6E2B`, `#A45C31` → `isLegendary` false | — | couleurs quelconques |
| `#F51D0A` | EPIQUE (`isEpic` true) | rouge franc |
| `#0AF5E3` → `isEpic` true | — | cyan franc |
| `#6B705C`, `#8899AA` → `isEpic` false | — | ternes |
| `#B8431F` | RARE (`isRare` true) | saturation 71 %, chroma insuffisant pour épique |
| `#F5F2EE`, `#0D0B08` → `isRare` true | — | luminosité extrême |
| `#7A6E5F` → `isRare` false | — | ton moyen désaturé |
| `#7A6E5F`, `#5C6B5D`, `#9A8F84` | COMMUNE | couleurs du quotidien |
| `#E67F19` | EPIQUE | chroma 205 ≥ 170 et max 230 ≥ 200 |

### `ColorMathTest`

- `hexToHsl("#028300") == Hsl(119, 100, 26)` ; `#B8431F → (14, 71, 42)` ; `#7A6E5F → (33, 12, 43)` ;
  `#2E6FBF → (213, 61, 46)` ; `#F51D0A → (5, 92, 50)`.
- `rgbToHex(300, -4, 15) == "#FF000F"` (bornage) ; `normalizeHex(" ab12cd ") == "#AB12CD"` ;
  `isValidHex("#12345G") == false`.

### `SeriesTest`

- `isFire` vrai pour `#B8431F`, `#F51D0A`, `#E67F19`, `#D94020` ; faux pour `#7A6E5F`, `#2E6FBF`.
- `isDaySky` vrai pour `#2E6FBF`, `#6FA8E0` ; faux pour `#B8431F`.
- `PURE_GREYS.size == 16`, premier `#000000`, dernier `#FFFFFF`, `PURE_GREYS[1] == "#111111"`.
- Une collection de 10 couleurs Feu distinctes → série « feu » `done`, `count == 10` ; 12 couleurs Feu →
  `count == 10`.

### `EconomyTest`

- Même jour : `applyDailyRefill` renvoie l'objet inchangé (appelée deux fois de suite → identique).
- Jour suivant : 0 → 3, 1 → 4, 4 → 5, 5 → 5.
- Date future (horloge reculée) : inchangé.
- `spend` à 0 → `null` ; `earn` à 5 → 5.

### `RegistrySeedTest`

- Taille 500 ; vecteurs des index 0, 24, 25, 26, 27, 100, 499 (§6.4) ; répartition des raretés
  16 / 108 / 147 / 229.
- `Mulberry32(0x5BEC7EE)` : trois premiers tirages ≈ `0.6971473212`, `0.9636811074`, `0.8349227423`
  (tolérance 1e-9).

### `FakeSpectreServerTest` (latence injectée = no-op, `Random` seedé, `ClaimsStore` en mémoire)

- Image uniforme RGB(100, 100, 100) → chaque canal du résultat ∈ [95, 105] sur 1 000 essais.
- `pixel.x` et `pixel.y` toujours dans [0, 1).
- `debugForcedHex = "#FF0000"` → résultat `Taken` (propriétaire chroma_king), puis le forçage est consommé.
- `claimColor` sur un hex libre → `Ok` ; `lookupColor` renvoie l'entrée ; second `claimColor` →
  `AlreadyTaken`.
- `claimColor("#FF0000", …)` → `AlreadyTaken`.
- Nom de 60 caractères → tronqué à 40 ; nom vide → « Sans nom ».
- `countClaimed()` = 500 au départ, 501 après une gravure.

---

## 13. Critères d'acceptation (checklist de recette)

- [ ] Premier lancement : onboarding, pseudo, arrivée sur Capture avec **3/5**.
- [ ] Caméra plein écran, viseur, compteur, bouton debug, déclencheur réactif (flash, son, vibration).
- [ ] Caméra refusée ou émulateur sans caméra : le mode galerie fonctionne de bout en bout.
- [ ] Révélation : ≥ 1,8 s de balayage, le pixel élu s'illumine **à l'endroit exact** de la photo, la
      couleur inonde l'écran depuis ce point.
- [ ] Couleur libre : célébration visiblement plus intense pour Rare < Épique < Légendaire (tester avec le
      menu debug).
- [ ] Nommage limité à 40 caractères ; le nom s'écrit lettre par lettre ; « Découverte par [pseudo] ».
- [ ] La couleur apparaît en tête du Mur, avec sa fiche (date, HSL, source, vignette).
- [ ] Couleur prise (`#FF0000` forcé) : nom + propriétaire affichés, ajout aux convoitises fonctionnel.
- [ ] Vue Spectre : les points sont à la bonne teinte et saturation, le fond est aligné.
- [ ] Séries : progression correcte ; la célébration se déclenche (debug « Feu 9/10 » + une couleur Feu).
- [ ] Gris purs : `#000000` et `#FFFFFF` affichés verrouillés avec leur propriétaire.
- [ ] Registre : `#FF0000` → prise par chroma_king ; un hex au hasard → libre ; statistique mondiale.
- [ ] Après 3 captures : 0/5, déclencheur désactivé, message d'attente ; « Simuler un nouveau jour » → 3/5.
- [ ] Tuer l'app pendant le nommage puis relancer → le nommage reprend avec la même couleur.
- [ ] Mode avion : tout fonctionne. L'APK ne déclare pas la permission `INTERNET`.
- [ ] `./gradlew test` : tous les tests de la section 12 passent.

---

## 14. Plan de construction et prompts de relance

Construis l'app **dans cet ordre**. Chaque étape doit compiler et être jouable.

| Étape | Contenu | Sections |
|---|---|---|
| 1 | Projet, thème et tokens, navigation à 4 onglets, onboarding, DataStore, économie + `EconomyTest` | 3, 4, 6.5, 7.0, 7.1, 8 |
| 2 | Logique pure : `ColorMath`, `RarityEngine`, séries, `Mulberry32`, registre seedé, `FakeSpectreServer` + tous leurs tests | 5, 6, 12 |
| 3 | Capture : CameraX, permission, mode galerie, pipeline image, compteur, déclencheur | 7.2 |
| 4 | Révélation : machine à états, timeline, confettis, sons, haptique | 7.3, 9 |
| 5 | Nommage, gravure, Room, vignettes, `PendingClaim`, déjà prise, convoitises | 7.4, 7.5, 6.7, 10 |
| 6 | Collection : Mur, Spectre, fiche détaillée | 7.7 |
| 7 | Séries + célébration ; Registre | 6.6, 7.6, 7.8, 7.9 |
| 8 | Robustesse, menu debug, accessibilité, finitions | 7.10, 10, 11, 13 |

**Prompts de relance à copier dans AI Studio** (un par message, après la première génération) :

1. « Vérifie l'étape 2 du plan : implémente `ColorMath`, `RarityEngine`, `Mulberry32`, `buildSeedRegistry`
   et `FakeSpectreServer` exactement comme dans les sections 6.1 à 6.4, puis écris tous les tests de la
   section 12. Lance-les et corrige jusqu'à ce qu'ils passent tous. »
2. « Implémente l'écran Capture selon la section 7.2 : CameraX plein écran, viseur, pilule compteur, bouton
   +1 capture, déclencheur avec flash/son/vibration, mode galerie si la caméra est refusée ou absente, et le
   pipeline image avec recadrage au ratio de la fenêtre. »
3. « Implémente la révélation selon la section 7.3 : machine à états `RevealViewModel`, timeline exacte
   (Lottery ≥ 1,8 s avec ligne de balayage, Spark 700 ms, Flood 750 ms), célébration par rareté (tableau),
   confettis `Canvas`, sons `ToneSynth` et vibrations de la section 9. »
4. « Implémente le nommage, la gravure lettre par lettre, l'écran "déjà prise" et la persistance Room +
   vignettes + `PendingClaim` (sections 7.4, 7.5 et 10). »
5. « Implémente la Collection (Mur, roue Spectre avec fond aligné, fiche en bottom sheet) selon la
   section 7.7. »
6. « Implémente les Séries (cases, gris verrouillés avec propriétaire, célébration avec artefact animé) et le
   Registre (recherche, statistique mondiale, convoitises) selon les sections 7.6, 7.8 et 7.9. »
7. « Ajoute le menu debug de la section 7.10 et vérifie chaque ligne du tableau de robustesse de la
   section 10. »
8. « Parcours la checklist de la section 13 point par point et corrige tout écart. »

**Relances ciblées utiles**

- « La révélation est trop rapide ou trop plate : respecte la timeline de la section 7.3 et l'intensité
  croissante par rareté. »
- « Le pixel lumineux n'est pas au bon endroit : applique le recadrage au ratio de la fenêtre (§7.2,
  étape 5) et la formule de position de la §7.3. »
- « Le thème ressemble à du Material par défaut : applique les tokens de la section 8 et retire les
  élévations tonales. »
- « Les textes ne correspondent pas : reprends exactement le tableau de la section 11. »

---

## 15. Simulé vs réel, et migration vers un vrai serveur

| Simulé dans cette version | Réel dans cette version |
|---|---|
| `FakeSpectreServer` : latence 300–800 ms, registre dans une base locale séparée | Caméra (CameraX), recadrage, envoi de l'image |
| ~500 propriétaires fictifs générés par PRNG seedé | Calcul de rareté, séries, économie des captures |
| Unicité mondiale limitée à l'appareil | Recharge quotidienne à minuit, réserve max 5 |
| Bouton « +1 capture (marcher 2 km) » | Persistance de la collection, provenance photo, convoitises |
| Pas d'anti-triche réel (photos de galerie acceptées) | Sons, vibrations, animations |

**Pour brancher un vrai backend plus tard** : remplacer `FakeSpectreServer` par une implémentation HTTP de
`SpectreServer` (ex. `POST /captures` avec l'image → `CaptureResult` ; `POST /claims` ; `GET /registry/{hex}` ;
`GET /stats`). À prévoir côté serveur : réservation temporaire de la couleur libre entre la révélation et la
gravure ; attestation d'intégrité (Play Integrity) et restriction des imports galerie (une image unie
importée permet de viser une zone de couleur, même avec le bruit) ; économie des captures calculée côté
serveur (l'horloge du téléphone n'est pas fiable).

---

## Annexe — écarts volontaires par rapport au prototype web

| Sujet | Prototype web | Version Android |
|---|---|---|
| Position du pixel | La photo est affichée en *cover* ; le pixel tiré peut être hors écran | Recadrage au ratio de la fenêtre avant envoi : le pixel est toujours visible |
| Mort du processus | Une couleur libre non nommée est perdue | `PendingClaim` + remboursement si la loterie est interrompue |
| Roue Spectre | Fond décalé de 90° par rapport aux points | Fond aligné (rouge en haut, sens horaire) |
| Plusieurs séries complétées d'un coup | Seule la première est célébrée | Célébrations successives |
| Vignettes | dataURL dans localStorage | Fichiers JPEG dans `filesDir/provenance/` |
| Horloge reculée | Déclenche une recharge | Pas de recharge (`isAfter` strict) |
| Gris purs verrouillés | Non visible | Cases verrouillées avec le pseudo du propriétaire |
| Source de la photo | Non enregistrée | Caméra / Photo importée affichée dans la fiche |
| Outils de test | Bouton +1 seulement | Menu debug complet (nouveau jour, forcer un hex, Feu 9/10, réinitialiser) |
