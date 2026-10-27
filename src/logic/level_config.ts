export enum LevelMode {
  score = 'score',
  collect = 'collect',
  glow = 'glow',
}

/**
 * Tuple representing a glowing cell on the 8x8 board: [row, col, layers (1 or 2)].
 */
export type GlowCellSpec = readonly [number, number, number];

/**
 * Custom Japanese Festival Blocker types on the 8x8 board (Phase 5).
 */
export type FestivalBlockerType =
  | 'paper_lantern'
  | 'sugar_mold'
  | 'torii_gate'
  | 'slate_curse';

export interface FestivalBlockerSpec {
  readonly type: FestivalBlockerType;
  readonly row: number;
  readonly col: number;
  readonly layers?: number;
  readonly width?: number;
  readonly height?: number;
  readonly cleansed?: boolean;
}

/**
 * Yokai Boss Encounter specification for Milestone Levels (Levels 9, 19, 30).
 */
export interface YokaiBossSpec {
  readonly name: string;
  readonly maxHp: number;
  readonly counterIntervalTurns: number;
  readonly curseTileCount: number;
  readonly trophyId: string;
  readonly trophyName: string;
}

/**
 * Pure configuration for a single level.
 */
export interface LevelConfig {
  readonly number: number;
  readonly moves: number;
  readonly mode: LevelMode;
  readonly star1: number;
  readonly star2: number;
  readonly star3: number;
  readonly collectGoals: Readonly<Record<string, number>>;
  readonly glowCells?: readonly GlowCellSpec[];
  readonly festivalBlockers?: readonly FestivalBlockerSpec[];
  readonly yokaiBoss?: YokaiBossSpec;
}

