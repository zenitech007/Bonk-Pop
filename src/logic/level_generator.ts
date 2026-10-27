import { GameConstants } from '../core/constants';
import { GlowPatternKind, GlowPatterns } from './glow_patterns';
import {
  FestivalBlockerSpec,
  LevelConfig,
  LevelMode,
  YokaiBossSpec,
} from './level_config';
import { ALL_TILE_TYPES, TileType } from './tile_type';

/**
 * Pure deterministic level generator for levels 1 to 30 (Step 6 Parts 0, A & B).
 *
 * Difficulty Rhythm & Mode Cycle Formula:
 * 1. Levels 1 to 3 stay exactly as handcrafted in Step 3.
 * 2. Levels 4 to 30 cycle deterministically through the 6-level mode sequence:
 *    `[glow, score, collect, glow, collect, score]` via `(n - 4) % 6`.
 *    - Level 4 is the first `glow` level and is intentionally easy:
 *      1 layer, 12 cells (`rows` 12-cell slice), and generous moves (18).
 * 3. Difficulty Rhythm:
 *    - Every 5th level from Level 10 (`n >= 10 && n % 5 === 0`: Levels 10, 15, 20, 25, 30)
 *      is a "hard" spike level (target greedy win rate 40%..60%).
 *    - The level immediately following a hard level (`n > 10 && (n - 1) % 5 === 0`:
 *      Levels 11, 16, 21, 26) is a breather level that is easier than the preceding hard level.
 * 4. Glow Layer Cap Formula (Step 6 Part B.3):
 *    - Early glow levels (`n < 12`) use 1 layer only (`twoLayerCount = 0`).
 *    - From Level 12 onward (`n >= 12`), central cells of the pattern receive 2 layers.
 *    - Total glow layers are strictly capped relative to `moves`:
 *      `maxLayers = Math.floor(moves * GameConstants.glowMaxLayersPerMoveRatio)`
 *      so that `totalLayers <= maxLayers` on every glow level and no level is ever impossible.
 */
export class LevelGenerator {
  private static readonly MODE_CYCLE: readonly LevelMode[] = [
    LevelMode.glow,
    LevelMode.score,
    LevelMode.collect,
    LevelMode.glow,
    LevelMode.collect,
    LevelMode.score,
  ];

  private static readonly level1: LevelConfig = {
    number: 1,
    moves: GameConstants.level1Moves,
    mode: LevelMode.score,
    star1: GameConstants.level1Star1,
    star2: GameConstants.level1Star2,
    star3: GameConstants.level1Star3,
    collectGoals: {},
  };

  private static readonly level2: LevelConfig = {
    number: 2,
    moves: GameConstants.level2Moves,
    mode: LevelMode.collect,
    star1: GameConstants.level2Star1,
    star2: GameConstants.level2Star2,
    star3: GameConstants.level2Star3,
    collectGoals: {
      [TileType.sakura]: GameConstants.level2GoalA,
      [TileType.lantern]: GameConstants.level2GoalB,
    },
  };

  private static readonly level3: LevelConfig = {
    number: 3,
    moves: GameConstants.level3Moves,
    mode: LevelMode.collect,
    star1: GameConstants.level3Star1,
    star2: GameConstants.level3Star2,
    star3: GameConstants.level3Star3,
    collectGoals: {
      [TileType.onigiri]: GameConstants.level3GoalA,
      [TileType.foxMask]: GameConstants.level3GoalB,
    },
  };

  static isHardLevel(n: number): boolean {
    return (
      n >= GameConstants.firstHardLevel &&
      n % GameConstants.hardLevelInterval === 0
    );
  }

  static isBreatherLevel(n: number): boolean {
    return (
      n > GameConstants.firstHardLevel &&
      (n - 1) % GameConstants.hardLevelInterval === 0
    );
  }

  /**
   * Returns the Yokai Boss encounter specification for Milestone Levels (9, 19, 30),
   * or undefined for standard levels.
   */
  static buildYokaiBossSpec(n: number): YokaiBossSpec | undefined {
    if (n === 9) {
      return {
        name: 'Crimson Tengu',
        maxHp: GameConstants.yokaiBossLevel9Hp,
        counterIntervalTurns: GameConstants.yokaiBossCounterIntervalTurns,
        curseTileCount: GameConstants.yokaiBossCurseTileCount,
        trophyId: 'boss_trophy_9',
        trophyName: 'Crimson Kitsune Trophy',
      };
    }
    if (n === 19) {
      return {
        name: 'Moonlit Jorogumo',
        maxHp: GameConstants.yokaiBossLevel19Hp,
        counterIntervalTurns: GameConstants.yokaiBossCounterIntervalTurns,
        curseTileCount: GameConstants.yokaiBossCurseTileCount,
        trophyId: 'boss_trophy_19',
        trophyName: 'Moonlit Kitsune Trophy',
      };
    }
    if (n === 30) {
      return {
        name: 'Nine-Tail Sovereign',
        maxHp: GameConstants.yokaiBossLevel30Hp,
        counterIntervalTurns: GameConstants.yokaiBossCounterIntervalTurns,
        curseTileCount: GameConstants.yokaiBossCurseTileCount,
        trophyId: 'boss_trophy_30',
        trophyName: 'Grand Sovereign Trophy',
      };
    }
    return undefined;
  }

  /**
   * Returns deterministic Japanese Festival Blockers (Paper Lanterns, Sugar Molds, Torii Spirit Gates)
   * for levels 6..30.
   */
  static buildFestivalBlockers(n: number): readonly FestivalBlockerSpec[] | undefined {
    if (n < 6) return undefined;
    if (n === 9) {
      return [
        { type: 'paper_lantern', row: 2, col: 2, layers: 2 },
        { type: 'paper_lantern', row: 2, col: 5, layers: 2 },
        { type: 'torii_gate', row: 0, col: 3, cleansed: false },
      ];
    }
    if (n === 19) {
      return [
        { type: 'paper_lantern', row: 1, col: 1, layers: 3 },
        { type: 'paper_lantern', row: 1, col: 6, layers: 3 },
        { type: 'sugar_mold', row: 3, col: 3, layers: 4, width: 2, height: 2 },
      ];
    }
    if (n === 30) {
      return [
        { type: 'paper_lantern', row: 1, col: 2, layers: 3 },
        { type: 'paper_lantern', row: 1, col: 5, layers: 3 },
        { type: 'sugar_mold', row: 3, col: 3, layers: 4, width: 2, height: 2 },
        { type: 'torii_gate', row: 0, col: 4, cleansed: false },
      ];
    }
    const mod = n % 3;
    if (mod === 0) {
      return [
        { type: 'paper_lantern', row: 2, col: 2, layers: n >= 15 ? 3 : 2 },
        { type: 'paper_lantern', row: 5, col: 5, layers: n >= 15 ? 3 : 2 },
      ];
    }
    if (mod === 1 && n >= 8) {
      return [
        { type: 'sugar_mold', row: 3, col: 3, layers: 4, width: 2, height: 2 },
      ];
    }
    if (mod === 2 && n >= 11) {
      return [{ type: 'torii_gate', row: 0, col: n % 6 + 1, cleansed: false }];
    }
    return undefined;
  }

  static getLevel(number: number): LevelConfig {
    const clamped = Math.min(
      Math.max(Math.trunc(number), 1),
      GameConstants.totalLevels
    );
    if (clamped === 1) return this.level1;
    if (clamped === 2) return this.level2;
    if (clamped === 3) return this.level3;

    const n = clamped;
    const mode = this.MODE_CYCLE[(n - 4) % this.MODE_CYCLE.length];
    const isHard = this.isHardLevel(n);
    const isBreather = this.isBreatherLevel(n);

    const baseConfig =
      mode === LevelMode.glow
        ? this.buildGlowLevel(n, isHard, isBreather)
        : mode === LevelMode.score
          ? this.buildScoreLevel(n, isHard, isBreather)
          : this.buildCollectLevel(n, isHard, isBreather);

    const yokaiBoss = this.buildYokaiBossSpec(n);
    const festivalBlockers = this.buildFestivalBlockers(n);

    return {
      ...baseConfig,
      ...(festivalBlockers ? { festivalBlockers } : {}),
      ...(yokaiBoss ? { yokaiBoss } : {}),
    };
  }

  private static clampMoves(m: number): number {
    return Math.min(
      Math.max(Math.round(m), GameConstants.minLevelMoves),
      GameConstants.maxLevelMoves
    );
  }

  private static buildGlowLevel(
    n: number,
    isHard: boolean,
    isBreather: boolean
  ): LevelConfig {
    // Glow levels in 4..30 occur at n = 4, 7, 10, 13, 16, 19, 22, 25, 28
    let patternKind: GlowPatternKind = 'rows';
    let rawMoves = 20;
    let requestedTwoLayers = 0;
    let maxCellsOverride: number | undefined;

    if (n === 4) {
      // First glow level: easy, 1 layer, 12 cells, generous moves
      patternKind = 'rows';
      maxCellsOverride = 12;
      rawMoves = 18;
      requestedTwoLayers = 0;
    } else if (n === 7) {
      // Mid band (target 55..85%)
      patternKind = 'corners';
      rawMoves = 21;
      requestedTwoLayers = 0;
    } else if (isHard && n === 10) {
      // Level 10: hard level (target 40..60%), 1 layer only since n < 12
      patternKind = 'corners';
      rawMoves = 18;
      requestedTwoLayers = 0;
    } else if (n === 13) {
      // Level 13: first 2-layer glow level (centre cells get 2 layers)
      patternKind = 'rows';
      rawMoves = 15;
      requestedTwoLayers = 4;
    } else if (isBreather) {
      // Level 16: breather level after hard level 15 (easier than 15, inside 35..75%)
      patternKind = 'ring';
      maxCellsOverride = 18;
      rawMoves = 14;
      requestedTwoLayers = 2;
    } else if (n === 19) {
      patternKind = 'border';
      maxCellsOverride = 22;
      rawMoves = 21;
      requestedTwoLayers = 2;
    } else if (n === 22) {
      patternKind = 'border';
      maxCellsOverride = 24;
      rawMoves = 22;
      requestedTwoLayers = 2;
    } else if (isHard) {
      // Level 25: hard level (target 40..60%)
      patternKind = 'border';
      rawMoves = 22;
      requestedTwoLayers = 2;
    } else {
      // Level 28
      patternKind = 'border';
      maxCellsOverride = 26;
      rawMoves = 22;
      requestedTwoLayers = 2;
    }

    const moves = this.clampMoves(rawMoves);

    // Cap total glow layers relative to moves so the level is never impossible:
    // totalLayers <= Math.floor(moves * GameConstants.glowMaxLayersPerMoveRatio)
    const maxLayers = Math.floor(
      moves * GameConstants.glowMaxLayersPerMoveRatio
    );
    const targetTwoLayers =
      n < GameConstants.glowTwoLayerStartLevel ? 0 : requestedTwoLayers;
    const baseCells = GlowPatterns.build(patternKind, 0, maxCellsOverride);
    const cappedCellCount = Math.min(
      baseCells.length,
      Math.max(12, maxLayers - targetTwoLayers)
    );
    const allowedTwoLayers =
      n < GameConstants.glowTwoLayerStartLevel
        ? 0
        : Math.max(
            0,
            Math.min(targetTwoLayers, maxLayers - cappedCellCount)
          );

    const glowCells = GlowPatterns.build(
      patternKind,
      allowedTwoLayers,
      cappedCellCount
    );
    const totalLayers = GlowPatterns.totalLayers(glowCells);

    // Score thresholds for 1, 2, 3 stars (including +100 per glow layer and leftover move bonuses)
    const expectedBaseScore =
      moves * 960 + totalLayers * GameConstants.glowLayerClearedBonus;
    const star1 = Math.round((expectedBaseScore * 0.55) / 100) * 100;
    const star2 =
      n <= 5
        ? Math.round((expectedBaseScore * 1.32) / 100) * 100
        : n <= 15
        ? Math.round((expectedBaseScore * 1.12) / 100) * 100
        : Math.round((expectedBaseScore * 1.31) / 100) * 100;
    const star3 =
      n <= 5
        ? Math.round((expectedBaseScore * 1.52) / 100) * 100
        : n <= 15
        ? Math.round((expectedBaseScore * 1.26) / 100) * 100
        : Math.round((expectedBaseScore * 1.37) / 100) * 100;

    return {
      number: n,
      moves,
      mode: LevelMode.glow,
      star1,
      star2: Math.max(star1 + 1000, star2),
      star3: Math.max(star2 + 1200, star3),
      collectGoals: {},
      glowCells,
    };
  }

  private static buildScoreLevel(
    n: number,
    isHard: boolean,
    isBreather: boolean
  ): LevelConfig {
    // Score levels in 4..30 occur at n = 5, 9, 11, 15, 17, 21, 23, 27, 29
    let rawMoves = 16;
    let ptsPerMove: number = GameConstants.scorePtsPerMoveMid;

    if (n === 5) {
      rawMoves = 16;
      ptsPerMove = GameConstants.scorePtsPerMoveEasy;
    } else if (isHard) {
      // Level 15 (hard level: 40..60% greedy win rate)
      rawMoves = 16;
      ptsPerMove = GameConstants.scorePtsPerMoveHard;
    } else if (isBreather) {
      // Levels 11, 21 (easier than preceding hard level)
      rawMoves = 16;
      ptsPerMove =
        n <= 15
          ? GameConstants.scorePtsPerMoveBreather
          : GameConstants.scorePtsPerMoveLate + 5;
    } else if (n <= 15) {
      // Level 9
      rawMoves = 16;
      ptsPerMove = GameConstants.scorePtsPerMoveMid;
    } else {
      // Levels 17, 23, 27, 29
      rawMoves = 16;
      ptsPerMove = GameConstants.scorePtsPerMoveLate;
    }

    const moves = this.clampMoves(rawMoves);
    const star1 = Math.round((moves * ptsPerMove) / 100) * 100;
    const star2Delta =
      n <= 5
        ? moves * (GameConstants.star2StepPerMove + 220)
        : n <= 15
        ? moves * GameConstants.star2StepPerMove
        : moves * (GameConstants.star2StepPerMove + 110);
    const star3Delta =
      n <= 5
        ? moves * (GameConstants.star3StepPerMove + 120)
        : n <= 15
        ? moves * GameConstants.star3StepPerMove
        : moves * (GameConstants.star3StepPerMove + 15);

    const star2 = Math.round((star1 + star2Delta) / 100) * 100;
    const star3 = Math.round((star2 + star3Delta) / 100) * 100;

    return {
      number: n,
      moves,
      mode: LevelMode.score,
      star1,
      star2,
      star3,
      collectGoals: {},
    };
  }

  private static buildCollectLevel(
    n: number,
    isHard: boolean,
    isBreather: boolean
  ): LevelConfig {
    // Collect levels in 4..30 occur at n = 6, 8, 12, 14, 18, 20, 24, 26, 30
    let rawMoves = 16;
    let goalA = 28;
    let goalB = 27;

    if (isHard) {
      // Levels 20, 30: hard collect levels (target 40..60% greedy win rate)
      rawMoves = 15;
      goalA = n === 20 ? 31 : 32;
      goalB = n === 20 ? 30 : 31;
    } else if (isBreather) {
      // Level 26: breather level after hard level 25
      rawMoves = 16;
      goalA = 29;
      goalB = 28;
    } else if (n <= 15) {
      // Levels 6, 8, 12, 14 (target 55..85% greedy win rate)
      rawMoves = 16;
      goalA = 28 + Math.floor((n - 6) / 4);
      goalB = 27 + Math.floor((n - 6) / 4);
    } else {
      // Levels 18, 24 (target 35..75% greedy win rate)
      rawMoves = 16;
      goalA = 30 + Math.floor((n - 18) / 6);
      goalB = 29 + Math.floor((n - 18) / 6);
    }

    const moves = this.clampMoves(rawMoves);
    const clampedA = Math.min(40, Math.max(12, goalA));
    const clampedB = Math.min(40, Math.max(12, goalB));

    const typeA = ALL_TILE_TYPES[(n * 2) % ALL_TILE_TYPES.length];
    const typeB = ALL_TILE_TYPES[(n * 2 + 2) % ALL_TILE_TYPES.length];

    const expectedScore = moves * 1040;
    const star1 = Math.round((expectedScore * 0.55) / 100) * 100;
    const star2 =
      n <= 15
        ? Math.round((expectedScore * 1.12) / 100) * 100
        : Math.round((expectedScore * 1.36) / 100) * 100;
    const star3 =
      n <= 15
        ? Math.round((expectedScore * 1.32) / 100) * 100
        : Math.round((expectedScore * 1.44) / 100) * 100;

    return {
      number: n,
      moves,
      mode: LevelMode.collect,
      star1,
      star2: Math.max(star1 + 1000, star2),
      star3: Math.max(star2 + 1500, star3),
      collectGoals: {
        [typeA]: clampedA,
        [typeB]: clampedB,
      },
    };
  }

  static allLevels(): readonly LevelConfig[] {
    return Array.from({ length: GameConstants.totalLevels }, (_, idx) =>
      this.getLevel(idx + 1)
    );
  }
}

export function getLevel(number: number): LevelConfig {
  return LevelGenerator.getLevel(number);
}
