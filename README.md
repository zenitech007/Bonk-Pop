# Bonk Pop — Sakura Festival Match-3 Puzzle Game

A modular, offline-ready anime-themed ("Sakura Festival") match-3 puzzle game built in **TypeScript + React + Vite** (`src/`), keeping pure game logic (`src/logic/`) completely separated from rendering, DOM, and platform APIs.

*(Unverified legacy Dart prototypes are archived in `_archive_dart/` and excluded from build, lint, and tests.)*

---

## Architecture & Game Rules (Steps 1 to 6)

### 1. Special Tiles & Spawn Rules (`src/logic/tile_type.ts`, `src/logic/match_finder.ts`, `src/logic/board.ts`)
- **Special Tile Types**:
  - **Row Slash (`SpecialKind.slashRow`)**: Created by a horizontal match of 4. Clears its entire 8-cell row (+120 bonus).
  - **Column Slash (`SpecialKind.slashColumn`)**: Created by a vertical match of 4. Clears its entire 8-cell column (+120 bonus).
  - **Burst (`SpecialKind.burst`)**: Created by an L-shape, T-shape, or Cross match. Clears a 3×3 area around itself (+180 bonus).
  - **Spirit Orb (`SpecialKind.orb`)**: Created by a match of 5 or more in a line. Colorless tile; swapping it with a normal tile clears all tiles of that color (+300 bonus).
- **Special Spawn Position Rule**:
  - **Burst (`SpecialKind.burst`)**: Always spawns at the **intersection cell** of the horizontal and vertical runs forming the L, T, or Cross shape.
  - **Slash (`slashRow` / `slashColumn`) & Spirit Orb (`orb`)**: Spawns at the **player-swapped cell** (`playerMovedCell`, or `playerSwapOriginCell`) if that cell is part of the match group; otherwise (e.g. during a cascade), spawns at the **middle cell** of the run (`cells[Math.floor(cells.length / 2)]`).
- **Special Combinations**:
  - **Orb + Orb**: Clears all 64 cells on the board (+2,000 bonus).
  - **Orb + Slash / Burst**: Converts every tile of the partner's color on the board into that special kind and activates them all in a chain wave (+400 bonus).
  - **Slash + Slash**: Clears both the row and column of the target cell (+240 bonus).
  - **Slash + Burst**: Clears 3 rows and 3 columns centred on the target cell (+320 bonus).
  - **Burst + Burst**: Clears a 5×5 area centred on the target cell (+400 bonus).

### 2. Glow Squares Mode (`src/logic/glow_patterns.ts`, `src/logic/game_state.ts`, `src/logic/level_generator.ts`)
- **Cell-Bound Layers**:
  - A board cell can hold `1` or `2` glow layers (`LevelConfig.glowCells: [row, col, layers][]`).
  - Glow belongs to the **cell**, not the tile: tiles fall and refill through glowing cells normally.
- **Clearing & Scoring**:
  - Whenever a tile inside a glowing cell is cleared (by a normal match, Slash, Burst, Spirit Orb, or Orb+Orb blast), that cell loses **at most 1 glow layer per resolve step**.
  - Each removed glow layer awards **`+100` bonus points** (`GameConstants.glowLayerClearedBonus`) on top of normal tile points.
- **Win & Lose Conditions (`LevelMode.glow`)**:
  - **Win**: Immediately once the board settles after a move and `glowLayersRemaining === 0` (including via cascades on the final move). Leftover moves award `+500` each (`GameConstants.leftoverMoveBonus`) before star evaluation.
  - **Lose**: When `movesLeft === 0` after all cascades settle and at least 1 glow layer remains.
- **Pattern Helpers (`GlowPatterns`)**:
  - Provides 8 deterministic pattern builders inside the 8×8 grid covering 12 to 40 cells: `corners` (12), `rows` (16), `ring` (16), `checker` (16), `cross` (24), `diamond` (24), `heart` (26), and `border` (28).
  - From Level 12 onward (`GameConstants.glowTwoLayerStartLevel`), central cells of the pattern receive 2 layers, capped by `maxLayers = Math.floor(moves * GameConstants.glowMaxLayersPerMoveRatio)` so no level is impossible.

### 3. Level Progression & Balance Procedure (`src/logic/level_generator.ts`, `scripts/simulate_levels.ts`)
- **Mode Cycle**:
  - Levels 1 to 3 remain fixed (`score`, `collect`, `collect`).
  - From Level 4 to 30, modes follow the 6-level cycle: `glow, score, collect, glow, collect, score...`
  - Every 5th level starting at Level 10 (`10, 15, 20, 25, 30`) is a **Hard** level, followed by a **Breather** level (`11, 16, 21, 26`).
- **Two-Bot Balance Simulation (`scripts/simulate_levels.ts`)**:
  - **Greedy Bot**: Evaluates all valid swaps and picks the highest immediate value (weighting tiles cleared on glowing cells at `×2` in `glow` mode and target colors at `×25` in `collect` mode).
  - **Casual Bot**: Picks the Greedy best move 50% of the time and a random valid move 50% of the time.
  - Run `npx tsx scripts/simulate_levels.ts` to simulate all 30 levels for both bots and verify win-rate and star-rate bands.

---

## Commands

```bash
# Run all unit tests (prints per-file and total pass counts)
npm test

# Type-check with TypeScript
npm run check

# Build production bundle
npm run build

# Run Greedy + Casual bot level balance simulation
npx tsx scripts/simulate_levels.ts
```
