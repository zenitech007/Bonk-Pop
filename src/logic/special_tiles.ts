import { GameConstants } from '../core/constants';
import { Board, GridPos } from './board';
import { ALL_TILE_TYPES, SpecialKind, Tile, TileType } from './tile_type';

export interface BentoSlotItem {
  readonly id: string;
  readonly tileType: TileType;
  readonly specialType: SpecialKind;
}

export interface ElementalSignatureResult {
  readonly tileType: TileType;
  readonly powerName: string;
  readonly calloutText: string;
  readonly bonusScore: number;
  readonly bonusCoins: number;
  readonly bonusMovesRequested: number;
  readonly transmutedCells: GridPos[];
  readonly clearedCells: GridPos[];
  readonly clearedByType: Partial<Record<TileType, number>>;
}

/**
 * Returns the canonical Elemental Signature title and callout badge text for a tile type.
 */
export function getElementalSignatureMeta(tileType: TileType): {
  powerName: string;
  calloutText: string;
  bonusScore: number;
  bonusCoins: number;
  bonusMovesRequested: number;
} {
  switch (tileType) {
    case TileType.foxMask:
      return {
        powerName: 'Fox-Fire Transmute',
        calloutText: 'Fox-Fire Transmute!',
        bonusScore: GameConstants.elementalMaskBonusScore,
        bonusCoins: 0,
        bonusMovesRequested: 0,
      };
    case TileType.onigiri:
      return {
        powerName: 'Rolling Rice Crush',
        calloutText: 'Rolling Rice Crush!',
        bonusScore: GameConstants.elementalOnigiriBonusScore,
        bonusCoins: 0,
        bonusMovesRequested: 0,
      };
    case TileType.dango:
      return {
        powerName: 'Bamboo X-Pierce',
        calloutText: 'Bamboo X-Pierce!',
        bonusScore: GameConstants.elementalDangoBonusScore,
        bonusCoins: 0,
        bonusMovesRequested: 0,
      };
    case TileType.lantern:
      return {
        powerName: 'Ember Lantern Nova',
        calloutText: 'Ember Lantern Nova!',
        bonusScore: GameConstants.elementalLanternBonusScore,
        bonusCoins: GameConstants.elementalLanternBonusCoins,
        bonusMovesRequested: 0,
      };
    case TileType.sakura:
    default:
      return {
        powerName: 'Sakura Gale Breeze',
        calloutText: 'Sakura Gale +1 Move!',
        bonusScore: GameConstants.elementalSakuraBonusScore,
        bonusCoins: 0,
        bonusMovesRequested: GameConstants.elementalSakuraBonusMoves,
      };
  }
}

/**
 * Applies the Asymmetric Elemental Signature Bonus for a detonated Special Tile:
 * - Blue Kitsune Mask (`TileType.foxMask`): Converts up to 2 random standard tiles on the board
 *   into `primaryTargetType` (or `TileType.foxMask` if no collect target remains) + 150 pts.
 * - Onigiri (`TileType.onigiri`): Clears up to 2 additional tiles at the bottom-most rows
 *   (rows 6 and 7) of `cell.col` + 150 pts.
 * - Dango Skewer (`TileType.dango`): Clears the 4 diagonal corner neighbors
 *   (`[r-1, c-1]`, `[r-1, c+1]`, `[r+1, c-1]`, `[r+1, c+1]`) around `cell` + 150 pts.
 * - Red Lantern (`TileType.lantern`): Awards +3 Spirit Coins and +200 pts.
 * - Sakura Blossom (`TileType.sakura`): Requests +1 Bonus Move (capped at +2 per level in GameState) and +200 pts.
 */
export function applyElementalSignature(params: {
  board?: Board;
  cell: GridPos;
  tileType: TileType;
  primaryTargetType?: TileType | null;
  randomFn?: () => number;
  compactBoardAfterClear?: boolean;
}): ElementalSignatureResult {
  const {
    board,
    cell,
    tileType,
    primaryTargetType = null,
    randomFn = Math.random,
    compactBoardAfterClear = false,
  } = params;

  const meta = getElementalSignatureMeta(tileType);
  const transmutedCells: GridPos[] = [];
  const clearedCells: GridPos[] = [];
  const clearedByType: Partial<Record<TileType, number>> = {};

  if (tileType === TileType.foxMask && board) {
    const targetType = primaryTargetType ?? TileType.foxMask;
    const candidates: GridPos[] = [];

    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const pos = new GridPos(r, c);
        if (pos.equals(cell)) continue;
        const t = board.getAt(pos);
        if (t && !t.isSpecial && t.type !== targetType) {
          candidates.push(pos);
        }
      }
    }

    const pool = [...candidates];
    const count = Math.min(
      GameConstants.elementalMaskTransmuteCount,
      pool.length
    );
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(randomFn() * pool.length);
      const chosen = pool.splice(idx, 1)[0];
      if (chosen) {
        board.setAt(chosen, Tile.normal(targetType));
        transmutedCells.push(chosen);
      }
    }
  } else if (tileType === TileType.onigiri) {
    const size = board?.size ?? GameConstants.gridSize;
    const bottomRows = [size - 2, size - 1];
    for (const r of bottomRows) {
      if (r >= 0 && r < size && cell.col >= 0 && cell.col < size) {
        const pos = new GridPos(r, cell.col);
        clearedCells.push(pos);
        if (board) {
          const existing = board.getAt(pos);
          if (existing && !existing.isOrb) {
            clearedByType[existing.type] =
              (clearedByType[existing.type] ?? 0) + 1;
          }
          if (compactBoardAfterClear) {
            board.setAt(pos, null);
          }
        }
      }
    }
    if (board && compactBoardAfterClear && clearedCells.length > 0) {
      Board.applyGravity(board);
      Board.refill(board, randomFn);
    }
  } else if (tileType === TileType.dango) {
    const size = board?.size ?? GameConstants.gridSize;
    const deltas = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const;

    for (const [dr, dc] of deltas) {
      const nr = cell.row + dr;
      const nc = cell.col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        const pos = new GridPos(nr, nc);
        clearedCells.push(pos);
        if (board) {
          const existing = board.getAt(pos);
          if (existing && !existing.isOrb) {
            clearedByType[existing.type] =
              (clearedByType[existing.type] ?? 0) + 1;
          }
          if (compactBoardAfterClear) {
            board.setAt(pos, null);
          }
        }
      }
    }
    if (board && compactBoardAfterClear && clearedCells.length > 0) {
      Board.applyGravity(board);
      Board.refill(board, randomFn);
    }
  }

  return {
    tileType,
    powerName: meta.powerName,
    calloutText: meta.calloutText,
    bonusScore: meta.bonusScore,
    bonusCoins: meta.bonusCoins,
    bonusMovesRequested: meta.bonusMovesRequested,
    transmutedCells,
    clearedCells,
    clearedByType,
  };
}

/**
 * Selects a fresh standard tile for `pos` that avoids forming an immediate 3-in-a-row match.
 */
export function pickNonMatchingStandardTile(
  board: Board,
  pos: GridPos,
  randomFn: () => number = Math.random
): Tile {
  const candidates = ALL_TILE_TYPES.filter((type) => {
    const r = pos.row;
    const c = pos.col;
    const hLeft =
      c >= 2 &&
      board.tileAt(r, c - 1)?.type === type &&
      board.tileAt(r, c - 2)?.type === type;
    const hRight =
      c + 2 < board.size &&
      board.tileAt(r, c + 1)?.type === type &&
      board.tileAt(r, c + 2)?.type === type;
    const hMid =
      c >= 1 &&
      c + 1 < board.size &&
      board.tileAt(r, c - 1)?.type === type &&
      board.tileAt(r, c + 1)?.type === type;
    const vUp =
      r >= 2 &&
      board.tileAt(r - 1, c)?.type === type &&
      board.tileAt(r - 2, c)?.type === type;
    const vDown =
      r + 2 < board.size &&
      board.tileAt(r + 1, c)?.type === type &&
      board.tileAt(r + 2, c)?.type === type;
    const vMid =
      r >= 1 &&
      r + 1 < board.size &&
      board.tileAt(r - 1, c)?.type === type &&
      board.tileAt(r + 1, c)?.type === type;
    return !hLeft && !hRight && !hMid && !vUp && !vDown && !vMid;
  });

  const pool = candidates.length > 0 ? candidates : ALL_TILE_TYPES;
  const chosen = pool[Math.floor(randomFn() * pool.length)] ?? ALL_TILE_TYPES[0];
  return Tile.normal(chosen);
}

/**
 * Returns the central 3 rows (rows 2, 3, 4) and 3 columns (cols 2, 3, 4)
 * for the Bento Fusion Super Matsuri Cross Blast.
 */
export function computeSuperMatsuriCrossCells(
  size: number = GameConstants.gridSize
): GridPos[] {
  const keys = new Set<string>();
  const centerRows = [2, 3, 4];
  const centerCols = [2, 3, 4];

  for (const r of centerRows) {
    if (r >= 0 && r < size) {
      for (let c = 0; c < size; c++) {
        keys.add(`${r},${c}`);
      }
    }
  }
  for (const c of centerCols) {
    if (c >= 0 && c < size) {
      for (let r = 0; r < size; r++) {
        keys.add(`${r},${c}`);
      }
    }
  }

  return Array.from(keys).map(GridPos.fromKey);
}
