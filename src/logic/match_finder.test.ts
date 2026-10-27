import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, GridPos } from './board';
import { MatchFinder } from './match_finder';
import { ALL_TILE_TYPES, TileType } from './tile_type';

const BG_TYPES: readonly TileType[] = [
  TileType.circle,
  TileType.square,
  TileType.triangle,
];

function buildBaseBoard(overrides: Array<[GridPos, TileType]> = []): Board {
  const grid: TileType[][] = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (__, c) => {
      return BG_TYPES[(r + c) % BG_TYPES.length];
    })
  );
  const board = Board.fromGrid(grid);
  for (const [pos, type] of overrides) {
    board.setAt(pos, type);
  }
  return board;
}

test('MatchFinder returns nothing on a board with no matches', () => {
  const board = buildBaseBoard();
  assert.equal(MatchFinder.findMatchKeys(board).size, 0);
});

test('MatchFinder detects horizontal 3', () => {
  const board = buildBaseBoard([
    [new GridPos(2, 1), TileType.star],
    [new GridPos(2, 2), TileType.star],
    [new GridPos(2, 3), TileType.star],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['2,1', '2,2', '2,3'])
  );
});

test('MatchFinder detects vertical 3', () => {
  const board = buildBaseBoard([
    [new GridPos(1, 5), TileType.diamond],
    [new GridPos(2, 5), TileType.diamond],
    [new GridPos(3, 5), TileType.diamond],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['1,5', '2,5', '3,5'])
  );
});

test('MatchFinder detects run of 4', () => {
  const board = buildBaseBoard([
    [new GridPos(4, 2), TileType.star],
    [new GridPos(4, 3), TileType.star],
    [new GridPos(4, 4), TileType.star],
    [new GridPos(4, 5), TileType.star],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['4,2', '4,3', '4,4', '4,5'])
  );
});

test('MatchFinder detects run of 5', () => {
  const board = buildBaseBoard([
    [new GridPos(1, 3), TileType.diamond],
    [new GridPos(2, 3), TileType.diamond],
    [new GridPos(3, 3), TileType.diamond],
    [new GridPos(4, 3), TileType.diamond],
    [new GridPos(5, 3), TileType.diamond],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['1,3', '2,3', '3,3', '4,3', '5,3'])
  );
});

test('MatchFinder detects L shape', () => {
  const board = buildBaseBoard([
    [new GridPos(5, 1), TileType.star],
    [new GridPos(5, 2), TileType.star],
    [new GridPos(5, 3), TileType.star],
    [new GridPos(6, 1), TileType.star],
    [new GridPos(7, 1), TileType.star],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['5,1', '5,2', '5,3', '6,1', '7,1'])
  );
});

test('MatchFinder detects T shape', () => {
  const board = buildBaseBoard([
    [new GridPos(2, 2), TileType.star],
    [new GridPos(2, 3), TileType.star],
    [new GridPos(2, 4), TileType.star],
    [new GridPos(3, 3), TileType.star],
    [new GridPos(4, 3), TileType.star],
  ]);

  assert.deepEqual(
    MatchFinder.findMatchKeys(board),
    new Set(['2,2', '2,3', '2,4', '3,3', '4,3'])
  );
});
