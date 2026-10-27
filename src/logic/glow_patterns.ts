import { GameConstants } from '../core/constants';
import { GlowCellSpec } from './level_config';

export type GlowPatternKind =
  | 'corners'
  | 'rows'
  | 'ring'
  | 'checker'
  | 'cross'
  | 'diamond'
  | 'heart'
  | 'border';

export const ALL_GLOW_PATTERNS: readonly GlowPatternKind[] = [
  'corners',
  'rows',
  'ring',
  'checker',
  'cross',
  'diamond',
  'heart',
  'border',
];

/**
 * Pure deterministic pattern builders for Step 6 Part A ("Glow Squares").
 * - All coordinates lie strictly within the 8x8 board (0..7).
 * - Every pattern covers between 12 and 40 unique cells.
 * - When `twoLayerCount > 0`, the `twoLayerCount` cells closest to the centre (3.5, 3.5)
 *   receive 2 glow layers and the remaining cells receive 1 glow layer.
 */
export class GlowPatterns {
  private static applyLayers(
    coords: readonly (readonly [number, number])[],
    twoLayerCount = 0
  ): readonly GlowCellSpec[] {
    const size = GameConstants.gridSize;
    const seen = new Set<string>();
    const unique: [number, number][] = [];

    for (const [r, c] of coords) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        const key = `${r},${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push([r, c]);
        }
      }
    }

    const clampedTwo = Math.max(0, Math.min(unique.length, Math.trunc(twoLayerCount)));
    if (clampedTwo === 0) {
      return unique.map(([r, c]) => [r, c, 1] as const);
    }

    // Rank cells by distance to board centre (3.5, 3.5), tie-breaking deterministically by row then col
    const rankedIndices = unique
      .map(([r, c], idx) => ({
        idx,
        dist: Math.abs(r - 3.5) + Math.abs(c - 3.5),
        r,
        c,
      }))
      .sort((a, b) => a.dist - b.dist || a.r - b.r || a.c - b.c);

    const twoLayerIndices = new Set<number>(
      rankedIndices.slice(0, clampedTwo).map((item) => item.idx)
    );

    return unique.map(([r, c], idx) => [
      r,
      c,
      twoLayerIndices.has(idx) ? 2 : 1,
    ] as const);
  }

  /**
   * 12 cells: 3-cell L-triad in each of the 4 corners.
   */
  static corners(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [
      // Top-left
      [0, 0],
      [0, 1],
      [1, 0],
      // Top-right
      [0, 6],
      [0, 7],
      [1, 7],
      // Bottom-left
      [6, 0],
      [7, 0],
      [7, 1],
      // Bottom-right
      [6, 7],
      [7, 6],
      [7, 7],
    ];
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 16 cells: two full horizontal rows (row 2 and row 5).
   */
  static rows(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    for (const r of [2, 5]) {
      for (let c = 0; c < GameConstants.gridSize; c++) {
        coords.push([r, c]);
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 20 cells: 6x6 inner ring perimeter (rows 1..6, cols 1..6).
   */
  static ring(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 6; c++) {
        if (r === 1 || r === 6 || c === 1 || c === 6) {
          coords.push([r, c]);
        }
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 18 cells: inner 6x6 checkerboard where (r + c) % 2 === 0.
   */
  static checker(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 6; c++) {
        if ((r + c) % 2 === 0) {
          coords.push([r, c]);
        }
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 20 cells: central cross (rows 3..4 for cols 1..6, and cols 3..4 for rows 1..6).
   */
  static cross(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 6; c++) {
        if (r === 3 || r === 4 || c === 3 || c === 4) {
          coords.push([r, c]);
        }
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 24 cells: central diamond where |r - 3.5| + |c - 3.5| <= 3.
   */
  static diamond(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    for (let r = 0; r < GameConstants.gridSize; r++) {
      for (let c = 0; c < GameConstants.gridSize; c++) {
        if (Math.abs(r - 3.5) + Math.abs(c - 3.5) <= 3) {
          coords.push([r, c]);
        }
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 22 cells: symmetric heart silhouette inside rows 1..6, cols 1..6.
   */
  static heart(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [
      [1, 2],
      [1, 5],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [2, 6],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
      [3, 6],
      [4, 2],
      [4, 3],
      [4, 4],
      [4, 5],
      [5, 3],
      [5, 4],
      [6, 3],
      [6, 4],
    ];
    return this.applyLayers(coords, twoLayerCount);
  }

  /**
   * 28 cells: outer border of the 8x8 board.
   */
  static border(twoLayerCount = 0): readonly GlowCellSpec[] {
    const coords: [number, number][] = [];
    const last = GameConstants.gridSize - 1;
    for (let r = 0; r <= last; r++) {
      for (let c = 0; c <= last; c++) {
        if (r === 0 || r === last || c === 0 || c === last) {
          coords.push([r, c]);
        }
      }
    }
    return this.applyLayers(coords, twoLayerCount);
  }

  static build(
    kind: GlowPatternKind,
    twoLayerCount = 0,
    maxCells?: number
  ): readonly GlowCellSpec[] {
    let base: readonly GlowCellSpec[];
    switch (kind) {
      case 'corners':
        base = this.corners(0);
        break;
      case 'rows':
        base = this.rows(0);
        break;
      case 'ring':
        base = this.ring(0);
        break;
      case 'checker':
        base = this.checker(0);
        break;
      case 'cross':
        base = this.cross(0);
        break;
      case 'diamond':
        base = this.diamond(0);
        break;
      case 'heart':
        base = this.heart(0);
        break;
      case 'border':
        base = this.border(0);
        break;
    }

    const coords = base.map(([r, c]) => [r, c] as const);
    const sliced =
      maxCells !== undefined && maxCells >= 12 && maxCells < coords.length
        ? coords.slice(0, maxCells)
        : coords;
    return this.applyLayers(sliced, twoLayerCount);
  }

  static totalLayers(cells: readonly GlowCellSpec[]): number {
    return cells.reduce((sum, [, , layers]) => sum + layers, 0);
  }
}
