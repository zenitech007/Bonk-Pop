# Publish Pack — Bonk Pop (Matsuri Spirit: Match & Shrine)

## 1. Game Title & Store Tagline

- **Game Title**: `Bonk Pop`
- **Store Tagline**: `Matsuri Spirit: Match & Shrine`
- **Genre**: Japanese Twilight Festival Match-3 Puzzle & Shrine Restoration
- **Target Platforms**: Web (Desktop & Mobile Responsive SPA), Android (Capacitor Offline Package)
- **Offline Capability**: 100% self-contained offline build (bundled fonts, procedural SVG art, Web Audio synthesizer + WAV cues, local persistence).

---

## 2. Key Features Summary

### A. Non-Linear Spirit Lantern Lattice Map & Shrine Restoration
- **30 Handcrafted & Deterministic Festival Levels** arranged across an ascending 15-tier Spirit Lantern Lattice (`District 1: Kitsune Shrine`) with branching choice nodes, golden spirit-thread SVG connections, and collapsible Shrine Restoration header.
- **Interactive Shrine Restoration Diorama**: Unlock 3 layered shrine landmarks as players collect Festival Stars:
  1. **Crimson Torii Gate (6 ★)**: Grants `+1 Starting Move` on every level.
  2. **Glowing Lantern Bridge (15 ★)**: Grants `+10% Score & Spirit Coin Bonus`.
  3. **Kitsune Spirit Pavilion (30 ★)**: Grants a `Starting Special Tile` at board center `(3, 3)`.
- **Row Harmony Chests**: Completing every node in a horizontal lattice tier (`>= 1 ★`) unlocks that row's Harmony Chest for `+100 🪙 Spirit Coins`.

### B. Bottom 3-Slot Bento Forge Dock & Asymmetric Elemental Powers
- **3-Slot Bento Forge Dock**: Players can toggle **Pocket Mode** (`0 Moves`) to store any on-board Special Tile into the 3-slot Bento Dock, redeploy stored specials onto any board cell, or **Fuse 2 Docked Specials** into a **Super Matsuri Cross Blast** clearing the central 3 rows and 3 columns (`+600` bonus points, `+5 🪙`, and instantly shattering adjacent Paper Lantern barriers).
- **Asymmetric Elemental Special Tile Signatures**:
  - **Blue Fox Mask (`Fox-Fire Transmute`)**: Converts up to 2 random standard tiles into the level's primary remaining target tile type (`+150` bonus points) and cleanses adjacent Torii Spirit Gates.
  - **Pink Sakura (`Sakura Gale +1 Move!`)**: Sweeps away 3 random stray tiles and awards `+1 Move` (`+200` bonus points).
  - **Red Lantern (`Ember Lantern Nova!`)**: Ignites a 4-corner diagonal ember pop, shatters all layers of adjacent Paper Lantern barriers, and drops `+3 🪙 Spirit Coins` (`+200` bonus points).
  - **Rice Onigiri (`Nori Shield Sweep!`)**: Cracks up to 2 remaining Glow Square layers (or clears a 3-tile horizontal bar) and cleanses adjacent Torii Spirit Gates (`+180` bonus points).
  - **Sweet Dango (`Bamboo X-Pierce!`)**: Fires a diagonal X-pierce laser across `(r ± k, c ± k)` up to radius 2, instantly breaking any Sugar Mold in its path (`+180` bonus points).

### C. Kitsune Spirit Companion, Spirit Coin Economy & Festival Fever
- **Kitsune Spirit Companion Meter (`0..100%`)**: Charges `+4%` per matched tile and `+15%` per cascade wave (`cascadeDepth >= 2`). At `100%`, activating the Kitsune mascot (`0 Moves`) clears up to 4 high-priority target tiles (`+300` score), upgrades 1 random standard tile into a Special Tile, and deals `250 HP` direct damage to Yokai Bosses. Players can also boost charge to `100%` for `25 🪙`.
- **Tactical Spirit Coin Actions**:
  - **1-Move Time-Slip Rewind**: Restores the exact pre-swap board and state (`1st rewind Free` per level; subsequent rewinds `15 🪙`).
  - **Lucky Shuffle**: Shuffles movable tiles and upgrades 1 random tile into a Special Tile for `20 🪙` and `0 Moves`.
  - **Festival Fever Streak (`0..5`)**: Consecutive wins grant `+20%` starting Kitsune Spirit Charge per tier (up to `100%` at Tier 5).
  - **Second Wind Continue (`40 🪙`)**: On out-of-moves, grants `+5 Moves`, `100%` Kitsune Spirit Charge, and protects the player's Festival Fever Streak.
  - **Takeout Bento (`25 🪙`, or `0 🪙` at Fever Tier 5)**: Carries 1 docked Special Tile from a victory screen directly into the next level.

### D. Custom Festival Blockers & Yokai Boss Battles
- **Custom Festival Blockers**:
  - **Paper Lantern Barrier (`paper_lantern`)**: 1- to 3-layer glowing barriers damaged by adjacent matches or blasts; instantly shattered by an adjacent Red Lantern special or Bento Fuse.
  - **Sugar Mold (`sugar_mold`)**: 2×2 festival sugar boxes cleared when all 4 sides are matched or hit by a Dango X-Pierce special, awarding `+10 🪙 Spirit Coins`.
  - **Torii Spirit Gate (`torii_gate`)**: Curses falling tiles into unmatchable Slate Curse tiles (`slate_curse`) unless cleansed by an adjacent Onigiri or Kitsune Fox-Fire match.
- **Yokai Boss Encounters (Milestone Levels 9, 19, 30)**:
  - Features a live **Yokai Boss Health Bar** (`1000 HP` on Level 9, `1800 HP` on Level 19, `2600 HP` on Level 30).
  - Standard matches deal `1:1` HP damage, Special Tile detonations deal `2×` damage, and 100% Kitsune Companion skills deal `250 HP` damage.
  - Every 4 player moves, the boss unleashes a counter-attack cursing 2 random tiles into Slate Curse blockers. Defeating a boss awards its **Kitsune Boss Trophy** badge on the Map screen.

---

## 3. Audio Cue Specification & Color Palette Hex References

### A. Audio Cue Specification

| Audio Cue / System | Asset / Synthesizer Spec | Trigger & Behavior |
| :--- | :--- | :--- |
| **Cascade Chime Wave 1** | Web Audio Synth `C4` (`261.63 Hz`) + `match.wav` | 1st match resolution wave in a turn |
| **Cascade Chime Wave 2** | Web Audio Synth `D4` (`293.66 Hz`) + `match_c2.wav` | 2nd cascade step resolution (`2x Spirit Chain!`) |
| **Cascade Chime Wave 3** | Web Audio Synth `E4` (`329.63 Hz`) + `match_c3.wav` | 3rd cascade step resolution (`3x Festival Fever!`) |
| **Cascade Chime Wave 4** | Web Audio Synth `G4` (`392.00 Hz`) + `match_c4.wav` | 4th cascade step resolution (`4x+ Kitsune Overload!`) |
| **Cascade Chime Wave 5+** | Web Audio Synth `A4` (`440.00 Hz`) + `match_c4.wav` | 5th+ cascade step resolution |
| **UI Click (`click`)** | `/assets/audio/sfx/click.wav` | Buttons, dialogs, Bento slot arming, invalid swap return |
| **Tile Swap (`swap`)** | `/assets/audio/sfx/swap.wav` + Light Haptic (`12ms`) | Adjacent tile swap gesture or 1-Move Time-Slip Rewind |
| **Line Slash (`slash`)** | `/assets/audio/sfx/slash.wav` + Medium Haptic (`28ms`) | Row or Column Kanzashi Slash activation |
| **Petal Burst (`burst`)** | `/assets/audio/sfx/burst.wav` + Medium Haptic (`28ms`) | 3×3 Temari Burst or Bento Special deployment |
| **Spirit Orb (`orb`)** | `/assets/audio/sfx/orb.wav` + Heavy Haptic (`[40,30,60]ms`) | Rainbow Spirit Orb, Bento Fuse, or 100% Kitsune Skill |
| **Victory / Defeat** | `/assets/audio/sfx/win.wav` / `lose.wav` | Level won, Harmony Chest claimed, or out of moves |
| **Background Music** | `/assets/audio/music/bgm_calm.wav` & `bgm_level.wav` | 500ms crossfade between Map/Start (`bgm_calm`) and Board (`bgm_level`) |

### B. Color Palette Hex References (`SakuraFestivalTheme`)

| Element / Token | Hex / RGBA Reference | Usage |
| :--- | :--- | :--- |
| **Twilight Sky Gradient** | `#2B1B3D` → `#4A2545` → `#7C3E66` | Main twilight festival sky backdrop |
| **Map Sky Gradient** | `#1F112B` → `#3D1E42` → `#6B325C` → `#94496E` | Spirit Lantern Lattice Map sky |
| **Dusk Hills (Far / Near)** | `#4A244B` / `#241028` | Bottom-anchored scenic SVG silhouettes |
| **Board Frame & Border** | `rgba(35, 21, 48, 0.86)` / `#FFB7C5` | 8×8 board container fill and Sakura border |
| **HUD Panel & Badge** | `rgba(52, 28, 66, 0.92)` / `#23122E` (`#FF85A1` border) | Top HUD bar, Bento Forge dock, and stat badges |
| **Primary Text / Secondary** | `#FFFDF9` / `#FFC2D1` | High-contrast cream text & sakura pink labels |
| **Star & Spirit Coin Gold** | `#FFD166` / `#FFF3B0` (stroke `#B45309`) | Festival stars, Spirit Coins, and Lantern Embers |
| **Pink Sakura Tile** | `#FF85A1` (accent `#FFD6E0`, outline `#B5385A`) | `sakura` tile icon & floating sakura petals (`#FFB7C5`) |
| **Red Lantern Tile** | `#FF4D4D` (accent `#FFC145`, outline `#9E1B1B`) | `lantern` tile icon & Paper Lantern barriers |
| **Rice Onigiri Tile** | `#FFFDF7` (accent `#2E5A44`, outline `#5E7A6B`) | `onigiri` tile icon & Nori wrap |
| **Sweet Dango Tile** | `#A8E6CF` (accent `#FF9AA2`, outline `#4D8B74`) | `dango` tri-color skewer tile |
| **Blue Fox Mask Tile** | `#4CC9F0` (accent `#FF5964`, outline `#1D6FA5`) | `foxMask` tile & Kitsune Spirit Meter glow |

---

## 4. Build & Export Instructions

### Production Web Bundle
Run the standard production build and verification commands from the project root:

```bash
# 1. Run the automated unit test suite (55+ tests across 6 test suites)
npm test

# 2. Run TypeScript static type validation
npm run check

# 3. Export the self-contained offline production bundle into dist/
npm run build
```

The compiled static assets are emitted to `dist/` (`dist/index.html` and `dist/assets/*`) with all fonts, SVG graphics, and audio assets bundled for offline play.

### Android Capacitor Sync (Optional Native Packaging)
```bash
npx cap sync android
```
