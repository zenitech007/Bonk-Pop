import test from 'node:test';
import assert from 'node:assert/strict';
import { GameConstants } from '../core/constants';
import { SakuraFestivalTheme } from '../core/theme/sakura_festival_theme';
import { Board, GridPos } from './board';
import { MatchFinder } from './match_finder';
import { ALL_TILE_TYPES, TileType } from './tile_type';

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildNoMatchBoard(): Board {
  const bg = [TileType.sakura, TileType.lantern, TileType.onigiri];
  const grid: (TileType | null)[][] = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (__, c) => bg[(r + c) % bg.length])
  );
  return Board.fromGrid(grid);
}

test('Board.generate() never starts with a match across 200 generations', () => {
  const rng = createSeededRandom(42);
  for (let i = 0; i < 200; i++) {
    const board = Board.generate(rng);
    assert.equal(board.size, GameConstants.gridSize);
    const matches = MatchFinder.findMatches(board);
    assert.equal(
      matches.length,
      0,
      `Board generation #${i} unexpectedly started with matches: ${matches.join(', ')}`
    );
  }
});

test('areAdjacent returns true only for orthogonal neighbours and false for diagonals/same cell', () => {
  const board = Board.generate(createSeededRandom(1));
  const center = new GridPos(3, 3);

  assert.equal(board.areAdjacent(center, new GridPos(2, 3)), true);
  assert.equal(board.areAdjacent(center, new GridPos(4, 3)), true);
  assert.equal(board.areAdjacent(center, new GridPos(3, 2)), true);
  assert.equal(board.areAdjacent(center, new GridPos(3, 4)), true);

  assert.equal(board.areAdjacent(center, center), false);
  assert.equal(board.areAdjacent(center, new GridPos(2, 2)), false);
  assert.equal(board.areAdjacent(center, new GridPos(2, 4)), false);
  assert.equal(board.areAdjacent(center, new GridPos(4, 2)), false);
  assert.equal(board.areAdjacent(center, new GridPos(4, 4)), false);
});

test('applyGravity: tiles in columns fall correctly, including gaps in the middle and a fully empty column', () => {
  const board = buildNoMatchBoard();

  // Column 2: middle gaps at (2,2), (3,2), (5,2)
  board.setAt(new GridPos(0, 2), TileType.foxMask);
  board.setAt(new GridPos(1, 2), TileType.dango);
  board.setAt(new GridPos(2, 2), null);
  board.setAt(new GridPos(3, 2), null);
  board.setAt(new GridPos(4, 2), TileType.sakura);
  board.setAt(new GridPos(5, 2), null);
  board.setAt(new GridPos(6, 2), TileType.lantern);
  board.setAt(new GridPos(7, 2), TileType.onigiri);

  // Column 5: fully empty column
  for (let r = 0; r < 8; r++) {
    board.setAt(new GridPos(r, 5), null);
  }

  const moves = Board.applyGravity(board);

  // Column 2 top 3 cells are null, bottom 5 cells contain compacted tiles in order
  assert.equal(board.tileAt(0, 2), null);
  assert.equal(board.tileAt(1, 2), null);
  assert.equal(board.tileAt(2, 2), null);
  assert.equal(board.typeAt(3, 2), TileType.foxMask);
  assert.equal(board.typeAt(4, 2), TileType.dango);
  assert.equal(board.typeAt(5, 2), TileType.sakura);
  assert.equal(board.typeAt(6, 2), TileType.lantern);
  assert.equal(board.typeAt(7, 2), TileType.onigiri);

  // Column 5 remains completely empty
  for (let r = 0; r < 8; r++) {
    assert.equal(board.tileAt(r, 5), null);
  }
  assert.equal(moves.filter((m) => m.from.col === 5).length, 0);
  assert.equal(moves.filter((m) => m.from.col === 2).length, 3);
});

test('refill: fills every empty cell and never changes existing tiles', () => {
  const board = buildNoMatchBoard();
  board.setAt(new GridPos(0, 1), null);
  board.setAt(new GridPos(1, 1), null);
  board.setAt(new GridPos(0, 4), null);

  const snapshot = board.toGrid();
  const rng = createSeededRandom(99);
  const spawns = Board.refill(board, rng);

  assert.equal(spawns.length, 3);
  for (const s of spawns) {
    assert.equal(s.startRow < 0, true);
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      assert.notEqual(board.tileAt(r, c), null);
      if (snapshot[r][c] !== null) {
        assert.equal(board.tileAt(r, c), snapshot[r][c]);
      }
    }
  }
});

test('resolveBoard: always returns a board with no matches; cascade count and step order are correct on a known cascade', () => {
  const board = buildNoMatchBoard();

  // Build a staggered 2-step cascade:
  // Step 1: Vertical match of 3 foxMask at col 2, rows 5, 6, 7
  board.setAt(new GridPos(5, 2), TileType.foxMask);
  board.setAt(new GridPos(6, 2), TileType.foxMask);
  board.setAt(new GridPos(7, 2), TileType.foxMask);

  // Place two dango at (7, 0) and (7, 1) (only 2 in a row -> NOT matched in Step 1),
  // and the third dango at (4, 2) directly above the vertical match!
  // When col 2 rows 5..7 clear in Step 1, (4, 2) falls 3 rows down to (7, 2),
  // completing the horizontal match (7, 0), (7, 1), (7, 2) in Step 2!
  board.setAt(new GridPos(7, 0), TileType.dango);
  board.setAt(new GridPos(7, 1), TileType.dango);
  board.setAt(new GridPos(4, 2), TileType.dango);

  const result = Board.resolveBoard(board, {
    randomFn: createSeededRandom(7),
  });

  assert.equal(result.cascadeCount >= 2, true);
  assert.equal(result.steps.length, result.cascadeCount);
  assert.equal(result.steps[0].clearedKeys.has('5,2'), true);
  assert.equal(result.steps[0].clearedKeys.has('6,2'), true);
  assert.equal(result.steps[0].clearedKeys.has('7,2'), true);
  assert.equal(result.steps[0].clearedKeys.has('7,0'), false);

  assert.equal(result.steps[1].clearedKeys.has('7,0'), true);
  assert.equal(result.steps[1].clearedKeys.has('7,1'), true);
  assert.equal(result.steps[1].clearedKeys.has('7,2'), true);

  assert.equal(MatchFinder.findMatchKeys(board).size, 0);
});

test('hasPossibleMove: detects true and false cases', () => {
  const deadGrid: TileType[][] = Array.from({ length: 8 }, (_, r) =>
    Array.from(
      { length: 8 },
      (__, c) => ALL_TILE_TYPES[(r % 2) * 2 + (c % 2)]
    )
  );
  const deadBoard = Board.fromGrid(deadGrid);
  assert.equal(Board.hasPossibleMove(deadBoard), false);

  const liveBoard = Board.fromGrid(deadGrid);
  liveBoard.setAt(new GridPos(0, 0), TileType.foxMask);
  liveBoard.setAt(new GridPos(0, 1), TileType.foxMask);
  liveBoard.setAt(new GridPos(1, 2), TileType.foxMask);
  assert.equal(Board.hasPossibleMove(liveBoard), true);
});

test('shuffleBoard: result has no matches and at least one possible move across 200 runs', () => {
  const rng = createSeededRandom(2026);
  const board = Board.generate(rng);

  for (let i = 0; i < 200; i++) {
    Board.shuffleBoard(board, rng);
    assert.equal(
      MatchFinder.findMatchKeys(board).size,
      0,
      `Shuffle #${i} left a match on the board`
    );
    assert.equal(
      Board.hasPossibleMove(board),
      true,
      `Shuffle #${i} produced a deadlocked board`
    );
  }
});

test('Theme: SakuraFestivalTheme has 5 distinct tile styles and every tile id has a shape', () => {
  const theme = SakuraFestivalTheme.instance;
  assert.equal(theme.tileStyles.length, 5);

  const ids = new Set(theme.tileStyles.map((s) => s.id));
  const shapes = new Set(theme.tileStyles.map((s) => s.shape));
  const colors = new Set(theme.tileStyles.map((s) => s.baseColor));

  assert.equal(ids.size, 5);
  assert.equal(shapes.size, 5);
  assert.equal(colors.size, 5);

  for (const type of ALL_TILE_TYPES) {
    const style = theme.styleFor(type);
    assert.equal(style.id, type);
    assert.ok(style.shape);
  }
});
