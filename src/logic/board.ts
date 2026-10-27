import { GameConstants } from '../core/constants';
import { FestivalBlockerSpec, FestivalBlockerType } from './level_config';
import { MatchFinder, MatchGroup, MatchRun } from './match_finder';
import { ALL_TILE_TYPES, SpecialKind, Tile, TileType } from './tile_type';

export class GridPos {
  readonly row: number;
  readonly col: number;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
  }

  equals(other: GridPos | null | undefined): boolean {
    if (!other) return false;
    return this.row === other.row && this.col === other.col;
  }

  get key(): string {
    return `${this.row},${this.col}`;
  }

  static fromKey(key: string): GridPos {
    const [r, c] = key.split(',').map(Number);
    return new GridPos(r, c);
  }

  toString(): string {
    return `(${this.row}, ${this.col})`;
  }
}

export interface TileFallMove {
  readonly from: GridPos;
  readonly to: GridPos;
  readonly tile: Tile;
  readonly type: TileType;
}

export interface RefillSpawn {
  readonly target: GridPos;
  readonly startRow: number;
  readonly tile: Tile;
  readonly type: TileType;
}

export interface TileShuffleMove {
  readonly from: GridPos;
  readonly to: GridPos;
  readonly tile: Tile;
  readonly type: TileType;
}

export interface CreatedSpecial {
  readonly cell: GridPos;
  readonly tile: Tile;
}

export interface ActivatedSpecial {
  readonly cell: GridPos;
  readonly kind: SpecialKind;
  readonly targetColor?: TileType;
  readonly tileType?: TileType;
}

export interface SpecialActivationWave {
  readonly waveIndex: number;
  readonly activated: ActivatedSpecial[];
  readonly cleared: GridPos[];
  readonly clearedByType: Partial<Record<TileType, number>>;
  readonly bonusScore: number;
}

export enum SpecialComboKind {
  none = 'none',
  orbOrb = 'orbOrb',
  slashSlash = 'slashSlash',
  burstBurst = 'burstBurst',
  slashBurst = 'slashBurst',
  orbSpecial = 'orbSpecial',
  mixedSpecials = 'mixedSpecials',
}

export type SugarMoldSide = 'top' | 'right' | 'bottom' | 'left';

export interface FestivalBlockerState {
  readonly id: string;
  readonly type: FestivalBlockerType;
  readonly row: number;
  readonly col: number;
  layers: number;
  readonly maxLayers: number;
  readonly width: number;
  readonly height: number;
  sidesHit: Set<SugarMoldSide>;
  cleansed: boolean;
}

export interface BlockerStepOutcome {
  readonly damagedPaperLanterns: GridPos[];
  readonly shatteredPaperLanterns: GridPos[];
  readonly brokenSugarMolds: GridPos[];
  readonly sugarMoldCoinsEarned: number;
  readonly cleansedToriiGates: GridPos[];
  readonly cursedSlateCells: GridPos[];
}

export interface ResolveStep {
  readonly cleared: GridPos[];
  readonly clearedKeys: Set<string>;
  readonly clearedByType: Partial<Record<TileType, number>>;
  readonly matchRuns: MatchRun[];
  readonly matchGroups: MatchGroup[];
  readonly createdSpecials: CreatedSpecial[];
  readonly waves: SpecialActivationWave[];
  readonly falls: TileFallMove[];
  readonly refills: RefillSpawn[];
  readonly stepBonusScore: number;
  readonly postStepGrid?: (Tile | null)[][];
  readonly blockerOutcome?: BlockerStepOutcome;
}

export interface ResolveResult {
  readonly steps: ResolveStep[];
  readonly cascadeCount: number;
}

const ALL_SUGAR_MOLD_SIDES: readonly SugarMoldSide[] = [
  'top',
  'right',
  'bottom',
  'left',
];

/**
 * Pure 8x8 board model with zero rendering imports, directly unit-testable.
 * Mirrors `lib/logic/board.dart`.
 */
export class Board {
  readonly size: number;
  private readonly _grid: (Tile | null)[][];
  private _blockers: FestivalBlockerState[] = [];
  private _blockerSeq = 0;

  private constructor(size: number, grid: (Tile | null)[][]) {
    this.size = size;
    this._grid = grid;
  }

  static fromGrid(grid: (Tile | TileType | null)[][]): Board {
    const size = grid.length;
    const copy = grid.map((row) =>
      row.map((cell) => {
        if (cell === null) return null;
        if (cell instanceof Tile) return cell;
        return Tile.normal(cell as TileType);
      })
    );
    return new Board(size, copy);
  }

  static fromRows(rows: (TileType | string)[][]): Board {
    const size = rows.length;
    const grid: (Tile | null)[][] = rows.map((row) =>
      row.map((cell) => Tile.normal(cell as TileType))
    );
    return new Board(size, grid);
  }

  static generate(
    randomFn: () => number = Math.random,
    size: number = GameConstants.gridSize
  ): Board {
    const grid: (Tile | null)[][] = Array.from({ length: size }, () =>
      Array<Tile | null>(size).fill(null)
    );

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const candidates = ALL_TILE_TYPES.filter((type) => {
          const formsHorizontalMatch =
            col >= 2 &&
            grid[row][col - 1]?.type === type &&
            grid[row][col - 2]?.type === type;
          const formsVerticalMatch =
            row >= 2 &&
            grid[row - 1][col]?.type === type &&
            grid[row - 2][col]?.type === type;
          return !formsHorizontalMatch && !formsVerticalMatch;
        });

        const chosen =
          candidates[Math.floor(randomFn() * candidates.length)] ??
          ALL_TILE_TYPES[0];
        grid[row][col] = Tile.normal(chosen);
      }
    }

    const board = new Board(size, grid);
    if (!this.hasPossibleMove(board)) {
      this.shuffleBoard(board, randomFn);
    }
    return board;
  }

  getAt(pos: GridPos): Tile | null {
    if (!this.isBounds(pos)) return null;
    return this._grid[pos.row][pos.col];
  }

  tileAt(row: number, col: number): Tile | null {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
    return this._grid[row][col];
  }

  typeAt(row: number, col: number): TileType | null {
    return this.tileAt(row, col)?.type ?? null;
  }

  setAt(pos: GridPos, tileOrType: Tile | TileType | null): void {
    if (!this.isBounds(pos)) return;
    if (tileOrType === null) {
      this._grid[pos.row][pos.col] = null;
    } else if (tileOrType instanceof Tile) {
      this._grid[pos.row][pos.col] = tileOrType;
    } else {
      this._grid[pos.row][pos.col] = Tile.normal(tileOrType);
    }
  }

  isBounds(pos: GridPos): boolean {
    return (
      pos.row >= 0 &&
      pos.row < this.size &&
      pos.col >= 0 &&
      pos.col < this.size
    );
  }

  areAdjacent(a: GridPos, b: GridPos): boolean {
    if (!this.isBounds(a) || !this.isBounds(b)) return false;
    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);
    return rowDiff + colDiff === 1;
  }

  swap(a: GridPos, b: GridPos): void {
    const temp = this._grid[a.row][a.col];
    this._grid[a.row][a.col] = this._grid[b.row][b.col];
    this._grid[b.row][b.col] = temp;
  }

  toGrid(): (Tile | null)[][] {
    return this._grid.map((row) => [...row]);
  }

  applyGrid(grid: (Tile | null)[][]): void {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this._grid[r][c] = grid[r]?.[c] ?? null;
      }
    }
  }

  // ==================== Phase 5: Custom Festival Blockers ====================

  initBlockers(specs?: readonly FestivalBlockerSpec[]): void {
    this._blockers = [];
    if (!specs) return;
    for (const spec of specs) {
      this.setBlocker(spec);
    }
  }

  setBlocker(spec: FestivalBlockerSpec): FestivalBlockerState {
    if (spec.type === 'paper_lantern') {
      return this.placePaperLantern(
        new GridPos(spec.row, spec.col),
        spec.layers ?? 2
      );
    }
    if (spec.type === 'sugar_mold') {
      return this.placeSugarMold(new GridPos(spec.row, spec.col));
    }
    if (spec.type === 'torii_gate') {
      return this.placeToriiGate(
        new GridPos(spec.row, spec.col),
        Boolean(spec.cleansed)
      );
    }
    return this.placeSlateCurse(new GridPos(spec.row, spec.col));
  }

  placePaperLantern(pos: GridPos, layers = 2): FestivalBlockerState {
    const clampedLayers = Math.min(
      GameConstants.paperLanternMaxLayers,
      Math.max(1, Math.trunc(layers))
    );
    this._blockers = this._blockers.filter(
      (b) => !(b.type === 'paper_lantern' && b.row === pos.row && b.col === pos.col)
    );
    const state: FestivalBlockerState = {
      id: `blocker_${++this._blockerSeq}`,
      type: 'paper_lantern',
      row: pos.row,
      col: pos.col,
      layers: clampedLayers,
      maxLayers: clampedLayers,
      width: 1,
      height: 1,
      sidesHit: new Set(),
      cleansed: false,
    };
    this._blockers.push(state);
    return state;
  }

  placeSugarMold(topLeft: GridPos): FestivalBlockerState {
    const r0 = Math.min(this.size - 2, Math.max(0, topLeft.row));
    const c0 = Math.min(this.size - 2, Math.max(0, topLeft.col));
    this._blockers = this._blockers.filter(
      (b) => !(b.type === 'sugar_mold' && b.row === r0 && b.col === c0)
    );
    const state: FestivalBlockerState = {
      id: `blocker_${++this._blockerSeq}`,
      type: 'sugar_mold',
      row: r0,
      col: c0,
      layers: GameConstants.sugarMoldSidesCount,
      maxLayers: GameConstants.sugarMoldSidesCount,
      width: 2,
      height: 2,
      sidesHit: new Set(),
      cleansed: false,
    };
    this._blockers.push(state);
    return state;
  }

  placeToriiGate(pos: GridPos, cleansed = false): FestivalBlockerState {
    this._blockers = this._blockers.filter(
      (b) => !(b.type === 'torii_gate' && b.row === pos.row && b.col === pos.col)
    );
    const state: FestivalBlockerState = {
      id: `blocker_${++this._blockerSeq}`,
      type: 'torii_gate',
      row: pos.row,
      col: pos.col,
      layers: cleansed ? 0 : 1,
      maxLayers: 1,
      width: 1,
      height: 1,
      sidesHit: new Set(),
      cleansed,
    };
    this._blockers.push(state);
    return state;
  }

  placeSlateCurse(pos: GridPos): FestivalBlockerState {
    this._blockers = this._blockers.filter(
      (b) => !(b.type === 'slate_curse' && b.row === pos.row && b.col === pos.col)
    );
    const state: FestivalBlockerState = {
      id: `blocker_${++this._blockerSeq}`,
      type: 'slate_curse',
      row: pos.row,
      col: pos.col,
      layers: 1,
      maxLayers: 1,
      width: 1,
      height: 1,
      sidesHit: new Set(),
      cleansed: false,
    };
    this._blockers.push(state);
    return state;
  }

  allBlockers(): readonly FestivalBlockerState[] {
    return this._blockers.filter(
      (b) => b.type === 'torii_gate' || b.layers > 0
    );
  }

  blockerAt(row: number, col: number): FestivalBlockerState | null {
    for (const b of this._blockers) {
      if (b.type === 'sugar_mold' && b.layers > 0) {
        if (
          row >= b.row &&
          row < b.row + b.height &&
          col >= b.col &&
          col < b.col + b.width
        ) {
          return b;
        }
      } else if (
        b.row === row &&
        b.col === col &&
        (b.type === 'torii_gate' || b.layers > 0)
      ) {
        return b;
      }
    }
    return null;
  }

  paperLanternLayersAt(row: number, col: number): number {
    const b = this._blockers.find(
      (x) =>
        x.type === 'paper_lantern' &&
        x.row === row &&
        x.col === col &&
        x.layers > 0
    );
    return b ? b.layers : 0;
  }

  sugarMoldAt(row: number, col: number): FestivalBlockerState | null {
    const b = this._blockers.find(
      (x) =>
        x.type === 'sugar_mold' &&
        x.layers > 0 &&
        row >= x.row &&
        row < x.row + x.height &&
        col >= x.col &&
        col < x.col + x.width
    );
    return b ?? null;
  }

  toriiGateAt(row: number, col: number): FestivalBlockerState | null {
    const b = this._blockers.find(
      (x) => x.type === 'torii_gate' && x.row === row && x.col === col
    );
    return b ?? null;
  }

  isSlateCursed(row: number, col: number): boolean {
    return this._blockers.some(
      (x) =>
        x.type === 'slate_curse' &&
        x.row === row &&
        x.col === col &&
        x.layers > 0
    );
  }

  cloneBlockers(): FestivalBlockerState[] {
    return this._blockers.map((b) => ({
      ...b,
      sidesHit: new Set(b.sidesHit),
    }));
  }

  restoreBlockers(snapshot: readonly FestivalBlockerState[]): void {
    this._blockers = snapshot.map((b) => ({
      ...b,
      sidesHit: new Set(b.sidesHit),
    }));
  }

  /**
   * Processes custom Festival Blocker rules for a match / blast step:
   * 1. Paper Lantern Barrier (`paper_lantern`):
   *    - Hitting with adjacent matches or blasts reduces `layers` by 1.
   *    - Special Rule: Triggering a Red Lantern (`TileType.lantern`) special tile or Bento Fuse
   *      instantly shatters all layers (`layers = 0`) of adjacent (or hit) Paper Lantern barriers.
   * 2. Sugar Mold (`sugar_mold` 2x2):
   *    - Cleared when adjacent matches are made against all 4 surrounding sides (`top`, `right`, `bottom`, `left`),
   *      or when hit by a Dango X-Pierce special (`TileType.dango`), awarding +10 🪙 Spirit Coins upon breaking.
   * 3. Torii Spirit Gate (`torii_gate`):
   *    - Cleansed (`cleansed = true`) by an adjacent Onigiri (`TileType.onigiri`) or Kitsune Transmute (`TileType.foxMask`) match/special.
   */
  applyStepBlockerEffects(params: {
    cleared: readonly GridPos[];
    clearedByType?: Partial<Record<TileType, number>>;
    redLanternSpecialCells?: readonly GridPos[];
    dangoSpecialCells?: readonly GridPos[];
    foxMaskSpecialCells?: readonly GridPos[];
    isBentoFuse?: boolean;
  }): BlockerStepOutcome {
    const {
      cleared,
      clearedByType = {},
      redLanternSpecialCells = [],
      dangoSpecialCells = [],
      foxMaskSpecialCells = [],
      isBentoFuse = false,
    } = params;

    const damagedPaperLanterns: GridPos[] = [];
    const shatteredPaperLanterns: GridPos[] = [];
    const brokenSugarMolds: GridPos[] = [];
    const cleansedToriiGates: GridPos[] = [];
    let sugarMoldCoinsEarned = 0;

    const isAdjacentOrSame = (a: GridPos, r: number, c: number): boolean =>
      Math.abs(a.row - r) + Math.abs(a.col - c) <= 1;

    const isWithinRadius1 = (a: GridPos, r: number, c: number): boolean =>
      Math.abs(a.row - r) <= 1 && Math.abs(a.col - c) <= 1;

    // 1. Paper Lantern Barriers
    for (const b of this._blockers) {
      if (b.type !== 'paper_lantern' || b.layers <= 0) continue;

      const hitByBentoFuse = isBentoFuse;
      const hitByRedLanternSpecial =
        redLanternSpecialCells.some((sp) => isWithinRadius1(sp, b.row, b.col)) ||
        (redLanternSpecialCells.length > 0 &&
          cleared.some((c) => isAdjacentOrSame(c, b.row, b.col)));

      if (hitByBentoFuse || hitByRedLanternSpecial) {
        b.layers = 0;
        shatteredPaperLanterns.push(new GridPos(b.row, b.col));
      } else if (cleared.some((c) => isAdjacentOrSame(c, b.row, b.col))) {
        b.layers = Math.max(0, b.layers - 1);
        damagedPaperLanterns.push(new GridPos(b.row, b.col));
      }
    }

    // 2. Sugar Molds (2x2 boxes)
    for (const b of this._blockers) {
      if (b.type !== 'sugar_mold' || b.layers <= 0) continue;
      const r0 = b.row;
      const c0 = b.col;

      const isHitByDangoXPierce = dangoSpecialCells.some((sp) => {
        for (let rr = r0; rr < r0 + b.height; rr++) {
          for (let cc = c0; cc < c0 + b.width; cc++) {
            if (
              Math.abs(sp.row - rr) === Math.abs(sp.col - cc) ||
              Math.abs(sp.row - rr) + Math.abs(sp.col - cc) <= 1
            ) {
              return true;
            }
          }
        }
        return false;
      });

      if (isHitByDangoXPierce) {
        for (const side of ALL_SUGAR_MOLD_SIDES) {
          b.sidesHit.add(side);
        }
        b.layers = 0;
        brokenSugarMolds.push(new GridPos(r0, c0));
        sugarMoldCoinsEarned += GameConstants.sugarMoldBreakCoinReward;
        continue;
      }

      // Check adjacent cleared cells against the 4 surrounding sides of the 2x2 Sugar Mold
      const newlyHitSides = new Set<SugarMoldSide>();
      let anyAdjacentHit = false;

      for (const p of cleared) {
        // Top side: row r0 - 1, col in [c0, c0 + 1] (or top half inside box)
        if (
          (p.row === r0 - 1 && (p.col === c0 || p.col === c0 + 1)) ||
          (p.row === r0 && (p.col === c0 || p.col === c0 + 1))
        ) {
          newlyHitSides.add('top');
          anyAdjacentHit = true;
        }
        // Bottom side: row r0 + 2, col in [c0, c0 + 1] (or bottom half inside box)
        if (
          (p.row === r0 + 2 && (p.col === c0 || p.col === c0 + 1)) ||
          (p.row === r0 + 1 && (p.col === c0 || p.col === c0 + 1))
        ) {
          newlyHitSides.add('bottom');
          anyAdjacentHit = true;
        }
        // Left side: col c0 - 1, row in [r0, r0 + 1]
        if (p.col === c0 - 1 && (p.row === r0 || p.row === r0 + 1)) {
          newlyHitSides.add('left');
          anyAdjacentHit = true;
        }
        // Right side: col c0 + 2, row in [r0, r0 + 1]
        if (p.col === c0 + 2 && (p.row === r0 || p.row === r0 + 1)) {
          newlyHitSides.add('right');
          anyAdjacentHit = true;
        }
      }

      if (anyAdjacentHit) {
        const sizeBefore = b.sidesHit.size;
        for (const s of newlyHitSides) {
          b.sidesHit.add(s);
        }
        // If an adjacent match hit a side that was already hit in an earlier turn, advance the next remaining side
        if (b.sidesHit.size === sizeBefore && b.sidesHit.size < 4) {
          const nextRemaining = ALL_SUGAR_MOLD_SIDES.find(
            (s) => !b.sidesHit.has(s)
          );
          if (nextRemaining) {
            b.sidesHit.add(nextRemaining);
          }
        }
        b.layers = Math.max(
          0,
          GameConstants.sugarMoldSidesCount - b.sidesHit.size
        );
        if (b.layers === 0) {
          brokenSugarMolds.push(new GridPos(r0, c0));
          sugarMoldCoinsEarned += GameConstants.sugarMoldBreakCoinReward;
        }
      }
    }

    // 3. Torii Spirit Gates & Cursed Slate Tiles
    const hasOnigiriOrFoxMask =
      (clearedByType[TileType.onigiri] ?? 0) > 0 ||
      (clearedByType[TileType.foxMask] ?? 0) > 0 ||
      foxMaskSpecialCells.length > 0;

    for (const b of this._blockers) {
      if (b.type === 'torii_gate' && !b.cleansed) {
        const adjacentMatch =
          cleared.some((c) => isAdjacentOrSame(c, b.row, b.col)) ||
          foxMaskSpecialCells.some((c) => isWithinRadius1(c, b.row, b.col));
        if (adjacentMatch && hasOnigiriOrFoxMask) {
          b.cleansed = true;
          b.layers = 0;
          cleansedToriiGates.push(new GridPos(b.row, b.col));
          // Cleanse any slate_curse tiles in that gate's column or adjacent to it
          for (const sb of this._blockers) {
            if (
              sb.type === 'slate_curse' &&
              sb.layers > 0 &&
              (sb.col === b.col ||
                isAdjacentOrSame(new GridPos(b.row, b.col), sb.row, sb.col))
            ) {
              sb.layers = 0;
            }
          }
        }
      } else if (b.type === 'slate_curse' && b.layers > 0) {
        if (cleared.some((c) => isAdjacentOrSame(c, b.row, b.col))) {
          b.layers = 0;
        }
      }
    }

    // Remove broken/cleared non-gate blockers
    this._blockers = this._blockers.filter(
      (b) => b.type === 'torii_gate' || b.layers > 0
    );

    return {
      damagedPaperLanterns,
      shatteredPaperLanterns,
      brokenSugarMolds,
      sugarMoldCoinsEarned,
      cleansedToriiGates,
      cursedSlateCells: [],
    };
  }

  /**
   * Applies Torii Spirit Gate curse to falling/refilled tiles passing through an active (un-cleansed) Torii Gate.
   */
  applyToriiGateCurses(
    falls: readonly TileFallMove[] = [],
    refills: readonly RefillSpawn[] = []
  ): GridPos[] {
    const cursedPositions: GridPos[] = [];
    const activeGates = this._blockers.filter(
      (b) => b.type === 'torii_gate' && !b.cleansed
    );
    if (activeGates.length === 0) return cursedPositions;

    for (const gate of activeGates) {
      const fallInGateCol = falls.find(
        (f) =>
          f.to.col === gate.col &&
          f.from.row <= gate.row &&
          f.to.row >= gate.row
      );
      const refillInGateCol = refills.find(
        (r) => r.target.col === gate.col && r.target.row >= gate.row
      );
      const targetPos =
        fallInGateCol?.to ??
        refillInGateCol?.target ??
        new GridPos(Math.min(this.size - 1, gate.row + 1), gate.col);

      if (this.isBounds(targetPos) && !this.isSlateCursed(targetPos.row, targetPos.col)) {
        this.placeSlateCurse(targetPos);
        cursedPositions.push(targetPos);
      }
    }

    return cursedPositions;
  }

  static isValidSwap(board: Board, a: GridPos, b: GridPos): boolean {
    if (!board.areAdjacent(a, b)) return false;
    const tileA = board.getAt(a);
    const tileB = board.getAt(b);
    if (!tileA || !tileB) return false;

    // Orb with any neighbor is valid
    if (tileA.isOrb || tileB.isOrb) return true;

    // Two adjacent specials are valid
    if (tileA.isSpecial && tileB.isSpecial) return true;

    // Otherwise, must create a match-3
    board.swap(a, b);
    const hasMatch = MatchFinder.findMatchKeys(board).size > 0;
    board.swap(a, b);
    return hasMatch;
  }

  static findPossibleMove(board: Board): [GridPos, GridPos] | null {
    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const a = new GridPos(r, c);
        if (board.getAt(a) === null) continue;
        const neighbours = [new GridPos(r, c + 1), new GridPos(r + 1, c)];
        for (const b of neighbours) {
          if (!board.isBounds(b) || board.getAt(b) === null) continue;
          if (this.isValidSwap(board, a, b)) {
            return [a, b];
          }
        }
      }
    }
    return null;
  }

  static hasPossibleMove(board: Board): boolean {
    return this.findPossibleMove(board) !== null;
  }

  static clearMatches(board: Board, matches: GridPos[]): void {
    for (const pos of matches) {
      board.setAt(pos, null);
    }
  }

  static applyGravity(board: Board): TileFallMove[] {
    const moves: TileFallMove[] = [];
    const size = board.size;

    for (let col = 0; col < size; col++) {
      let writeRow = size - 1;
      for (let readRow = size - 1; readRow >= 0; readRow--) {
        const tile = board.tileAt(readRow, col);
        if (tile !== null) {
          if (writeRow !== readRow) {
            const from = new GridPos(readRow, col);
            const to = new GridPos(writeRow, col);
            board.setAt(to, tile);
            board.setAt(from, null);
            moves.push({ from, to, tile, type: tile.type });
          }
          writeRow--;
        }
      }
    }

    return moves;
  }

  static refill(
    board: Board,
    randomFn: () => number = Math.random
  ): RefillSpawn[] {
    const spawns: RefillSpawn[] = [];
    const size = board.size;

    for (let col = 0; col < size; col++) {
      let emptyCount = 0;
      for (let row = 0; row < size; row++) {
        if (board.tileAt(row, col) === null) {
          emptyCount++;
        }
      }
      if (emptyCount === 0) continue;

      let missingIndex = 0;
      for (let row = 0; row < size; row++) {
        if (board.tileAt(row, col) === null) {
          const type =
            ALL_TILE_TYPES[Math.floor(randomFn() * ALL_TILE_TYPES.length)] ??
            ALL_TILE_TYPES[0];
          const tile = Tile.normal(type);
          const target = new GridPos(row, col);
          const startRow = row - emptyCount;
          board.setAt(target, tile);
          spawns.push({
            target,
            startRow: startRow < 0 ? startRow : -(emptyCount - missingIndex),
            tile,
            type,
          });
          missingIndex++;
        }
      }
    }

    return spawns;
  }

  static computeSpecialBlast(params: {
    board: Board;
    cell: GridPos;
    kind: SpecialKind;
    targetColor?: TileType;
    combo?: SpecialComboKind;
  }): GridPos[] {
    const { board, cell, kind, targetColor, combo = SpecialComboKind.none } = params;
    const blastKeys = new Set<string>();
    const size = board.size;

    if (combo === SpecialComboKind.orbOrb) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          blastKeys.add(`${r},${c}`);
        }
      }
      return Array.from(blastKeys).map(GridPos.fromKey);
    }

    if (combo === SpecialComboKind.slashSlash) {
      for (let c = 0; c < size; c++) blastKeys.add(`${cell.row},${c}`);
      for (let r = 0; r < size; r++) blastKeys.add(`${r},${cell.col}`);
      return Array.from(blastKeys).map(GridPos.fromKey);
    }

    if (combo === SpecialComboKind.burstBurst) {
      for (let r = cell.row - 2; r <= cell.row + 2; r++) {
        for (let c = cell.col - 2; c <= cell.col + 2; c++) {
          const p = new GridPos(r, c);
          if (board.isBounds(p)) blastKeys.add(p.key);
        }
      }
      return Array.from(blastKeys).map(GridPos.fromKey);
    }

    if (combo === SpecialComboKind.slashBurst) {
      for (let r = cell.row - 1; r <= cell.row + 1; r++) {
        if (r >= 0 && r < size) {
          for (let c = 0; c < size; c++) blastKeys.add(`${r},${c}`);
        }
      }
      for (let c = cell.col - 1; c <= cell.col + 1; c++) {
        if (c >= 0 && c < size) {
          for (let r = 0; r < size; r++) blastKeys.add(`${r},${c}`);
        }
      }
      return Array.from(blastKeys).map(GridPos.fromKey);
    }

    switch (kind) {
      case SpecialKind.slashRow:
        for (let c = 0; c < size; c++) blastKeys.add(`${cell.row},${c}`);
        break;
      case SpecialKind.slashColumn:
        for (let r = 0; r < size; r++) blastKeys.add(`${r},${cell.col}`);
        break;
      case SpecialKind.burst:
        for (let r = cell.row - 1; r <= cell.row + 1; r++) {
          for (let c = cell.col - 1; c <= cell.col + 1; c++) {
            const p = new GridPos(r, c);
            if (board.isBounds(p)) blastKeys.add(p.key);
          }
        }
        break;
      case SpecialKind.orb:
        blastKeys.add(cell.key);
        if (targetColor) {
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              const p = new GridPos(r, c);
              const t = board.getAt(p);
              if (t && t.type === targetColor) {
                blastKeys.add(p.key);
              }
            }
          }
        }
        break;
      default:
        break;
    }

    return Array.from(blastKeys).map(GridPos.fromKey);
  }

  static resolveBoard(
    board: Board,
    params?: {
      randomFn?: () => number;
      playerMovedCell?: GridPos | null;
      playerSwapOriginCell?: GridPos | null;
    }
  ): ResolveResult {
    const randomFn = params?.randomFn ?? Math.random;
    const steps: ResolveStep[] = [];

    let isInitialStep = true;
    let movedCell = params?.playerMovedCell ?? null;
    let originCell = params?.playerSwapOriginCell ?? null;

    while (true) {
      const matchGroups = MatchFinder.findMatchGroups(board);
      const hasMatches = matchGroups.length > 0;

      const tileA =
        isInitialStep && movedCell ? board.getAt(movedCell) : null;
      const tileB =
        isInitialStep && originCell ? board.getAt(originCell) : null;
      const isOrbSwap =
        isInitialStep &&
        movedCell !== null &&
        originCell !== null &&
        (tileA?.isOrb || tileB?.isOrb);
      const isTwoSpecialsSwap =
        isInitialStep &&
        movedCell !== null &&
        originCell !== null &&
        tileA !== null &&
        tileB !== null &&
        tileA.isSpecial &&
        tileB.isSpecial;

      if (!hasMatches && !isOrbSwap && !isTwoSpecialsSwap) {
        break;
      }

      const matchRuns = MatchFinder.findMatchRuns(board);
      const createdSpecials: CreatedSpecial[] = [];
      const claimedSpawnKeys = new Set<string>();

      // 1. Created specials from match groups
      for (const group of matchGroups) {
        if (group.specialKind !== SpecialKind.none) {
          const spawnCell = group.findSpawnCell(movedCell, originCell);
          if (!claimedSpawnKeys.has(spawnCell.key)) {
            claimedSpawnKeys.add(spawnCell.key);
            const specialTile =
              group.specialKind === SpecialKind.orb
                ? Tile.orb()
                : new Tile(group.type, group.specialKind);
            createdSpecials.push({ cell: spawnCell, tile: specialTile });
          }
        }
      }

      // Initial cells to clear from standard match groups
      const stepClearedKeys = new Set<string>();
      const initialMatchKeys = new Set<string>();
      for (const group of matchGroups) {
        for (const c of group.cells) {
          initialMatchKeys.add(c.key);
        }
      }

      for (const key of initialMatchKeys) {
        if (!claimedSpawnKeys.has(key)) {
          stepClearedKeys.add(key);
        }
      }

      // 2. Identify initial specials to activate
      const initialActivated: ActivatedSpecial[] = [];
      let comboKind = SpecialComboKind.none;

      if (
        isInitialStep &&
        isTwoSpecialsSwap &&
        movedCell &&
        originCell &&
        tileA &&
        tileB
      ) {
        if (!claimedSpawnKeys.has(movedCell.key)) {
          stepClearedKeys.add(movedCell.key);
        }
        if (!claimedSpawnKeys.has(originCell.key)) {
          stepClearedKeys.add(originCell.key);
        }
        const specialA = tileA.special;
        const specialB = tileB.special;

        if (specialA === SpecialKind.orb && specialB === SpecialKind.orb) {
          comboKind = SpecialComboKind.orbOrb;
          initialActivated.push({ cell: movedCell, kind: SpecialKind.orb });
        } else if (tileA.isSlash && tileB.isSlash) {
          comboKind = SpecialComboKind.slashSlash;
          initialActivated.push({
            cell: movedCell,
            kind: specialA,
            tileType: tileA.type,
          });
        } else if (
          specialA === SpecialKind.burst &&
          specialB === SpecialKind.burst
        ) {
          comboKind = SpecialComboKind.burstBurst;
          initialActivated.push({
            cell: movedCell,
            kind: SpecialKind.burst,
            tileType: tileA.type,
          });
        } else {
          comboKind = SpecialComboKind.mixedSpecials;
          initialActivated.push({
            cell: movedCell,
            kind: specialA,
            targetColor: tileB.type,
            tileType: tileA.isOrb ? tileB.type : tileA.type,
          });
          initialActivated.push({
            cell: originCell,
            kind: specialB,
            targetColor: tileA.type,
            tileType: tileB.isOrb ? tileA.type : tileB.type,
          });
        }
      } else if (
        isInitialStep &&
        isOrbSwap &&
        movedCell &&
        originCell
      ) {
        if (!claimedSpawnKeys.has(movedCell.key)) {
          stepClearedKeys.add(movedCell.key);
        }
        if (!claimedSpawnKeys.has(originCell.key)) {
          stepClearedKeys.add(originCell.key);
        }
        const orbPos = tileA?.isOrb ? movedCell : originCell;
        const targetPos = tileA?.isOrb ? originCell : movedCell;
        const targetTile = board.getAt(targetPos);
        const targetColor = targetTile?.type;
        initialActivated.push({
          cell: orbPos,
          kind: SpecialKind.orb,
          targetColor,
          tileType: targetColor,
        });
      }

      // Existing specials participating in matches
      for (const key of initialMatchKeys) {
        const pos = GridPos.fromKey(key);
        const tile = board.getAt(pos);
        if (tile && tile.isSpecial && !claimedSpawnKeys.has(key)) {
          initialActivated.push({
            cell: pos,
            kind: tile.special,
            targetColor: tile.type,
            tileType: tile.isOrb ? undefined : tile.type,
          });
        }
      }

      // 3. Multi-wave blast expansion & chain reactions
      const waves: SpecialActivationWave[] = [];
      const activatedKeys = new Set<string>();
      let currentWaveQueue: ActivatedSpecial[] = [...initialActivated];
      let waveIndex = 1;
      let totalStepBonus = 0;

      while (currentWaveQueue.length > 0) {
        const waveClearedKeys = new Set<string>();
        const waveActivated: ActivatedSpecial[] = [];
        const nextWaveQueue: ActivatedSpecial[] = [];
        let waveBonus = 0;

        for (const act of currentWaveQueue) {
          if (activatedKeys.has(act.cell.key)) continue;
          activatedKeys.add(act.cell.key);
          waveActivated.push(act);

          if (comboKind === SpecialComboKind.orbOrb) {
            waveBonus += GameConstants.doubleOrbBonus;
          } else {
            switch (act.kind) {
              case SpecialKind.slashRow:
              case SpecialKind.slashColumn:
                waveBonus += GameConstants.slashActivationBonus;
                break;
              case SpecialKind.burst:
                waveBonus += GameConstants.burstActivationBonus;
                break;
              case SpecialKind.orb:
                waveBonus += GameConstants.orbActivationBonus;
                break;
              default:
                break;
            }
          }

          const blast = this.computeSpecialBlast({
            board,
            cell: act.cell,
            kind: act.kind,
            targetColor: act.targetColor,
            combo: comboKind,
          });

          for (const bPos of blast) {
            if (!claimedSpawnKeys.has(bPos.key)) {
              waveClearedKeys.add(bPos.key);
              stepClearedKeys.add(bPos.key);

              const hitTile = board.getAt(bPos);
              if (
                hitTile &&
                hitTile.isSpecial &&
                !activatedKeys.has(bPos.key)
              ) {
                nextWaveQueue.push({
                  cell: bPos,
                  kind: hitTile.special,
                  targetColor: hitTile.type,
                  tileType: hitTile.isOrb ? undefined : hitTile.type,
                });
              }
            }
          }
        }

        if (waveActivated.length > 0) {
          const waveClearedByType: Partial<Record<TileType, number>> = {};
          const waveClearedList = Array.from(waveClearedKeys).map(
            GridPos.fromKey
          );
          for (const p of waveClearedList) {
            const t = board.getAt(p);
            if (t && !t.isOrb) {
              waveClearedByType[t.type] = (waveClearedByType[t.type] ?? 0) + 1;
            }
          }

          totalStepBonus += waveBonus;
          waves.push({
            waveIndex: waveIndex++,
            activated: waveActivated,
            cleared: waveClearedList,
            clearedByType: waveClearedByType,
            bonusScore: waveBonus,
          });
        }

        currentWaveQueue = nextWaveQueue;
        comboKind = SpecialComboKind.none;
      }

      // Record cleared counts by color (orbs count for nothing in collect goals)
      const stepClearedList = Array.from(stepClearedKeys).map(GridPos.fromKey);
      const stepClearedByType: Partial<Record<TileType, number>> = {};
      for (const p of stepClearedList) {
        const t = board.getAt(p);
        if (t && !t.isOrb) {
          stepClearedByType[t.type] = (stepClearedByType[t.type] ?? 0) + 1;
        }
      }

      // 4. Update board model: clear tiles and place created specials
      this.clearMatches(board, stepClearedList);
      for (const sp of createdSpecials) {
        board.setAt(sp.cell, sp.tile);
      }

      // 5. Gravity and Refill
      const falls = this.applyGravity(board);
      const refills = this.refill(board, randomFn);

      // 6. Phase 5: Apply Festival Blocker damage/shatter/cleanse & Torii Spirit Gate curses
      const redLanternSpecialCells: GridPos[] = [];
      const dangoSpecialCells: GridPos[] = [];
      const foxMaskSpecialCells: GridPos[] = [];
      for (const w of waves) {
        for (const act of w.activated) {
          if (act.tileType === TileType.lantern) {
            redLanternSpecialCells.push(act.cell);
          } else if (act.tileType === TileType.dango) {
            dangoSpecialCells.push(act.cell);
          } else if (act.tileType === TileType.foxMask) {
            foxMaskSpecialCells.push(act.cell);
          }
        }
      }
      const stepBlockerOutcome = board.applyStepBlockerEffects({
        cleared: stepClearedList,
        clearedByType: stepClearedByType,
        redLanternSpecialCells,
        dangoSpecialCells,
        foxMaskSpecialCells,
      });
      const cursedSlateCells = board.applyToriiGateCurses(falls, refills);
      const blockerOutcome: BlockerStepOutcome = {
        ...stepBlockerOutcome,
        cursedSlateCells,
      };

      steps.push({
        cleared: stepClearedList,
        clearedKeys: stepClearedKeys,
        clearedByType: stepClearedByType,
        matchRuns,
        matchGroups,
        createdSpecials,
        waves,
        falls,
        refills,
        stepBonusScore: totalStepBonus,
        postStepGrid: board.toGrid(),
        blockerOutcome,
      });

      isInitialStep = false;
      movedCell = null;
      originCell = null;
    }

    return {
      steps,
      cascadeCount: steps.length,
    };
  }

  static shuffleBoard(
    board: Board,
    randomFn: () => number = Math.random
  ): TileShuffleMove[] {
    const size = board.size;
    const entries: { from: GridPos; tile: Tile }[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const pos = new GridPos(r, c);
        const t = board.getAt(pos);
        if (t !== null) {
          entries.push({ from: pos, tile: t });
        }
      }
    }

    for (let attempt = 0; attempt < 500; attempt++) {
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        const temp = entries[i];
        entries[i] = entries[j];
        entries[j] = temp;
      }

      const pool = [...entries];
      const placed: (Tile | null)[][] = Array.from({ length: size }, () =>
        Array<Tile | null>(size).fill(null)
      );

      let success = true;
      for (let r = 0; r < size && success; r++) {
        for (let c = 0; c < size; c++) {
          if (board.tileAt(r, c) === null) continue;
          const idx = pool.findIndex((item) => {
            const t = item.tile;
            if (t.isOrb) return true;
            const horizMatch =
              c >= 2 &&
              placed[r][c - 1]?.matchesColor(t) &&
              placed[r][c - 2]?.matchesColor(t);
            const vertMatch =
              r >= 2 &&
              placed[r - 1][c]?.matchesColor(t) &&
              placed[r - 2][c]?.matchesColor(t);
            return !horizMatch && !vertMatch;
          });

          if (idx === -1) {
            success = false;
            break;
          }
          placed[r][c] = pool.splice(idx, 1)[0].tile;
        }
      }

      if (!success) continue;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          board.setAt(new GridPos(r, c), placed[r][c]);
        }
      }

      if (
        MatchFinder.findMatchKeys(board).size === 0 &&
        this.hasPossibleMove(board)
      ) {
        const moves: TileShuffleMove[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const item = entries.find(
              (e) => e.tile.equals(placed[r][c])
            );
            const tile = placed[r][c];
            if (tile) {
              moves.push({
                from: item ? item.from : new GridPos(r, c),
                to: new GridPos(r, c),
                tile,
                type: tile.type,
              });
            }
          }
        }
        return moves;
      }
    }

    return this.constructPlayablePermutation(board, entries, randomFn);
  }

  private static constructPlayablePermutation(
    board: Board,
    entries: { from: GridPos; tile: Tile }[],
    randomFn: () => number
  ): TileShuffleMove[] {
    const size = board.size;
    const counts = new Map<TileType, number>();
    for (const e of entries) {
      if (!e.tile.isOrb) {
        counts.set(e.tile.type, (counts.get(e.tile.type) ?? 0) + 1);
      }
    }

    let triggerType = ALL_TILE_TYPES[0];
    let maxCount = -1;
    for (const [t, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        triggerType = t;
      }
    }

    const triggerItems = entries
      .filter((e) => e.tile.type === triggerType && !e.tile.isOrb)
      .slice(0, 3);
    const remaining = entries.filter((e) => !triggerItems.includes(e));

    const placed: (Tile | null)[][] = Array.from({ length: size }, () =>
      Array<Tile | null>(size).fill(null)
    );
    if (triggerItems.length === 3) {
      placed[0][0] = triggerItems[0].tile;
      placed[0][1] = triggerItems[1].tile;
      placed[1][2] = triggerItems[2].tile;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (placed[r][c] !== null || board.tileAt(r, c) === null) continue;
        const idx = remaining.findIndex((item) => {
          const t = item.tile;
          if (t.isOrb) return true;
          if (r === 0 && c === 2 && t.type === triggerType) return false;
          const hLeft =
            c >= 2 &&
            placed[r][c - 1]?.matchesColor(t) &&
            placed[r][c - 2]?.matchesColor(t);
          const hMid =
            c >= 1 &&
            c + 1 < size &&
            placed[r][c - 1]?.matchesColor(t) &&
            placed[r][c + 1]?.matchesColor(t);
          const vUp =
            r >= 2 &&
            placed[r - 1][c]?.matchesColor(t) &&
            placed[r - 2][c]?.matchesColor(t);
          return !hLeft && !hMid && !vUp;
        });
        const chosen = remaining.splice(idx >= 0 ? idx : 0, 1)[0];
        placed[r][c] = chosen ? chosen.tile : Tile.normal(triggerType);
      }
    }

    const moves: TileShuffleMove[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const tile = placed[r][c];
        board.setAt(new GridPos(r, c), tile);
        if (tile) {
          moves.push({
            from: new GridPos(r, c),
            to: new GridPos(r, c),
            tile,
            type: tile.type,
          });
        }
      }
    }
    return moves;
  }
}
