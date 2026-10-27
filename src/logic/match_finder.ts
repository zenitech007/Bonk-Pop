import { GameConstants } from '../core/constants';
import { Board, GridPos } from './board';
import { SpecialKind, TileType } from './tile_type';

export enum MatchDirection {
  horizontal = 'horizontal',
  vertical = 'vertical',
  shape = 'shape',
}

export enum MatchShapeKind {
  line3 = 'line3',
  line4 = 'line4',
  line5 = 'line5',
  lShape = 'lShape',
  tShape = 'tShape',
  cross = 'cross',
}

export interface MatchRun {
  readonly type: TileType;
  readonly cells: GridPos[];
  readonly length: number;
  readonly direction: MatchDirection;
}

export class MatchGroup {
  readonly type: TileType;
  readonly cells: GridPos[];
  readonly direction: MatchDirection;
  readonly shapeKind: MatchShapeKind;
  readonly intersectionCell?: GridPos;

  constructor(params: {
    type: TileType;
    cells: GridPos[];
    direction: MatchDirection;
    shapeKind: MatchShapeKind;
    intersectionCell?: GridPos;
  }) {
    this.type = params.type;
    this.cells = params.cells;
    this.direction = params.direction;
    this.shapeKind = params.shapeKind;
    this.intersectionCell = params.intersectionCell;
  }

  get length(): number {
    return this.cells.length;
  }

  get specialKind(): SpecialKind {
    switch (this.shapeKind) {
      case MatchShapeKind.line5:
        return SpecialKind.orb;
      case MatchShapeKind.lShape:
      case MatchShapeKind.tShape:
      case MatchShapeKind.cross:
        return SpecialKind.burst;
      case MatchShapeKind.line4:
        return this.direction === MatchDirection.horizontal
          ? SpecialKind.slashRow
          : SpecialKind.slashColumn;
      case MatchShapeKind.line3:
        return SpecialKind.none;
    }
  }

  findSpawnCell(
    playerMovedCell?: GridPos | null,
    playerSwapOriginCell?: GridPos | null
  ): GridPos {
    if (this.intersectionCell) {
      return this.intersectionCell;
    }
    if (playerMovedCell) {
      const match = this.cells.find((c) => c.equals(playerMovedCell));
      if (match) return match;
    }
    if (playerSwapOriginCell) {
      const match = this.cells.find((c) => c.equals(playerSwapOriginCell));
      if (match) return match;
    }
    return this.cells[Math.floor(this.cells.length / 2)];
  }
}

/**
 * Pure match finder with no UI/rendering dependencies.
 * Mirrors `lib/logic/match_finder.dart`.
 */
export class MatchFinder {
  static findMatchRuns(board: Board): MatchRun[] {
    const runs: MatchRun[] = [];
    const size = board.size;
    const minRun = GameConstants.minMatchLength;

    // Scan horizontal runs
    for (let row = 0; row < size; row++) {
      let runStart = 0;
      for (let col = 1; col <= size; col++) {
        const startTile = board.tileAt(row, runStart);
        const currentTile = col < size ? board.tileAt(row, col) : null;
        const sameAsStart =
          startTile !== null &&
          !startTile.isOrb &&
          col < size &&
          currentTile !== null &&
          startTile.matchesColor(currentTile);

        if (!sameAsStart) {
          const runLength = col - runStart;
          if (startTile !== null && !startTile.isOrb && runLength >= minRun) {
            const cells: GridPos[] = [];
            for (let c = runStart; c < col; c++) {
              cells.push(new GridPos(row, c));
            }
            runs.push({
              type: startTile.type,
              cells,
              length: cells.length,
              direction: MatchDirection.horizontal,
            });
          }
          runStart = col;
        }
      }
    }

    // Scan vertical runs
    for (let col = 0; col < size; col++) {
      let runStart = 0;
      for (let row = 1; row <= size; row++) {
        const startTile = board.tileAt(runStart, col);
        const currentTile = row < size ? board.tileAt(row, col) : null;
        const sameAsStart =
          startTile !== null &&
          !startTile.isOrb &&
          row < size &&
          currentTile !== null &&
          startTile.matchesColor(currentTile);

        if (!sameAsStart) {
          const runLength = row - runStart;
          if (startTile !== null && !startTile.isOrb && runLength >= minRun) {
            const cells: GridPos[] = [];
            for (let r = runStart; r < row; r++) {
              cells.push(new GridPos(r, col));
            }
            runs.push({
              type: startTile.type,
              cells,
              length: cells.length,
              direction: MatchDirection.vertical,
            });
          }
          runStart = row;
        }
      }
    }

    return runs;
  }

  static findMatchGroups(board: Board): MatchGroup[] {
    const runs = this.findMatchRuns(board);
    if (runs.length === 0) return [];

    const hRuns = runs.filter((r) => r.direction === MatchDirection.horizontal);
    const vRuns = runs.filter((r) => r.direction === MatchDirection.vertical);

    const usedH = new Set<number>();
    const usedV = new Set<number>();
    const groups: MatchGroup[] = [];

    // Intersecting horizontal and vertical runs of the SAME colour
    for (let hi = 0; hi < hRuns.length; hi++) {
      if (usedH.has(hi)) continue;
      const h = hRuns[hi];
      for (let vi = 0; vi < vRuns.length; vi++) {
        if (usedV.has(vi)) continue;
        const v = vRuns[vi];
        if (h.type !== v.type) continue;

        const hRow = h.cells[0].row;
        const vCol = v.cells[0].col;
        const hCols = new Set(h.cells.map((c) => c.col));
        const vRows = new Set(v.cells.map((c) => c.row));

        if (hCols.has(vCol) && vRows.has(hRow)) {
          const intersection = new GridPos(hRow, vCol);
          const cellKeySet = new Set<string>();
          const mergedCells: GridPos[] = [];
          for (const c of [...h.cells, ...v.cells]) {
            if (!cellKeySet.has(c.key)) {
              cellKeySet.add(c.key);
              mergedCells.push(c);
            }
          }

          const isHEnd =
            h.cells[0].col === vCol || h.cells[h.cells.length - 1].col === vCol;
          const isVEnd =
            v.cells[0].row === hRow || v.cells[v.cells.length - 1].row === hRow;

          let shapeKind: MatchShapeKind;
          if (isHEnd && isVEnd) {
            shapeKind = MatchShapeKind.lShape;
          } else if (isHEnd || isVEnd) {
            shapeKind = MatchShapeKind.tShape;
          } else {
            shapeKind = MatchShapeKind.cross;
          }

          usedH.add(hi);
          usedV.add(vi);

          groups.push(
            new MatchGroup({
              type: h.type,
              cells: mergedCells,
              direction: MatchDirection.shape,
              shapeKind,
              intersectionCell: intersection,
            })
          );
          break;
        }
      }
    }

    // Remaining horizontal runs
    for (let hi = 0; hi < hRuns.length; hi++) {
      if (usedH.has(hi)) continue;
      const h = hRuns[hi];
      let shapeKind: MatchShapeKind;
      if (h.length >= 5) {
        shapeKind = MatchShapeKind.line5;
      } else if (h.length === 4) {
        shapeKind = MatchShapeKind.line4;
      } else {
        shapeKind = MatchShapeKind.line3;
      }

      groups.push(
        new MatchGroup({
          type: h.type,
          cells: h.cells,
          direction: MatchDirection.horizontal,
          shapeKind,
        })
      );
    }

    // Remaining vertical runs
    for (let vi = 0; vi < vRuns.length; vi++) {
      if (usedV.has(vi)) continue;
      const v = vRuns[vi];
      let shapeKind: MatchShapeKind;
      if (v.length >= 5) {
        shapeKind = MatchShapeKind.line5;
      } else if (v.length === 4) {
        shapeKind = MatchShapeKind.line4;
      } else {
        shapeKind = MatchShapeKind.line3;
      }

      groups.push(
        new MatchGroup({
          type: v.type,
          cells: v.cells,
          direction: MatchDirection.vertical,
          shapeKind,
        })
      );
    }

    // Priority: orb > burst > slash > none
    const priority = (kind: SpecialKind): number => {
      switch (kind) {
        case SpecialKind.orb:
          return 3;
        case SpecialKind.burst:
          return 2;
        case SpecialKind.slashRow:
        case SpecialKind.slashColumn:
          return 1;
        default:
          return 0;
      }
    };

    groups.sort((a, b) => priority(b.specialKind) - priority(a.specialKind));
    return groups;
  }

  static findMatchKeys(board: Board): Set<string> {
    const matched = new Set<string>();
    for (const run of this.findMatchRuns(board)) {
      for (const cell of run.cells) {
        matched.add(cell.key);
      }
    }
    return matched;
  }

  static findMatches(board: Board): GridPos[] {
    return Array.from(this.findMatchKeys(board)).map(GridPos.fromKey);
  }

  static findValidMove(board: Board): [GridPos, GridPos] | null {
    return Board.findPossibleMove(board);
  }
}
