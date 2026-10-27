import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, GridPos, SpecialComboKind } from './board';
import { MatchFinder, MatchShapeKind } from './match_finder';
import { SpecialKind, Tile, TileType } from './tile_type';
import { GameState } from './game_state';
import { LevelConfig, LevelMode } from './level_config';

test('Special Tiles - Match 4 creates Slash tile with correct orientation', () => {
  // Horizontal match 4 -> slashRow
  const boardH = Board.fromRows([
    ['sakura', 'sakura', 'sakura', 'sakura', 'lantern', 'skewer', 'mask', 'dango'],
    ['dango', 'skewer', 'mask', 'lantern', 'sakura', 'lantern', 'skewer', 'mask'],
    ['lantern', 'mask', 'dango', 'skewer', 'dango', 'mask', 'lantern', 'sakura'],
    ['skewer', 'dango', 'lantern', 'mask', 'lantern', 'dango', 'sakura', 'skewer'],
    ['mask', 'lantern', 'skewer', 'dango', 'skewer', 'lantern', 'mask', 'dango'],
    ['sakura', 'skewer', 'mask', 'lantern', 'mask', 'skewer', 'dango', 'lantern'],
    ['lantern', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['skewer', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);

  const groupsH = MatchFinder.findMatchGroups(boardH);
  assert.equal(groupsH.length, 1);
  assert.equal(groupsH[0].shapeKind, MatchShapeKind.line4);
  assert.equal(groupsH[0].specialKind, SpecialKind.slashRow);

  // If player moved cell was (0, 2), spawn cell should be (0, 2)
  const spawnPosH = groupsH[0].findSpawnCell(new GridPos(0, 2));
  assert.deepEqual(spawnPosH, new GridPos(0, 2));

  // Vertical match 4 -> slashColumn
  const boardV = Board.fromRows([
    ['sakura', 'dango', 'lantern', 'skewer', 'mask', 'lantern', 'skewer', 'mask'],
    ['sakura', 'skewer', 'mask', 'lantern', 'sakura', 'lantern', 'skewer', 'mask'],
    ['sakura', 'mask', 'dango', 'skewer', 'dango', 'mask', 'lantern', 'sakura'],
    ['sakura', 'dango', 'lantern', 'mask', 'lantern', 'dango', 'sakura', 'skewer'],
    ['mask', 'lantern', 'skewer', 'dango', 'skewer', 'lantern', 'mask', 'dango'],
    ['lantern', 'skewer', 'mask', 'lantern', 'mask', 'skewer', 'dango', 'lantern'],
    ['skewer', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['dango', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);

  const groupsV = MatchFinder.findMatchGroups(boardV);
  assert.equal(groupsV.length, 1);
  assert.equal(groupsV[0].shapeKind, MatchShapeKind.line4);
  assert.equal(groupsV[0].specialKind, SpecialKind.slashColumn);
});

test('Special Tiles - Match 5 creates Spirit Orb (no color)', () => {
  const board5 = Board.fromRows([
    ['sakura', 'sakura', 'sakura', 'sakura', 'sakura', 'skewer', 'mask', 'dango'],
    ['dango', 'skewer', 'mask', 'lantern', 'sakura', 'lantern', 'skewer', 'mask'],
    ['lantern', 'mask', 'dango', 'skewer', 'dango', 'mask', 'lantern', 'sakura'],
    ['skewer', 'dango', 'lantern', 'mask', 'lantern', 'dango', 'sakura', 'skewer'],
    ['mask', 'lantern', 'skewer', 'dango', 'skewer', 'lantern', 'mask', 'dango'],
    ['sakura', 'skewer', 'mask', 'lantern', 'mask', 'skewer', 'dango', 'lantern'],
    ['lantern', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['skewer', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);

  const groups = MatchFinder.findMatchGroups(board5);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].shapeKind, MatchShapeKind.line5);
  assert.equal(groups[0].specialKind, SpecialKind.orb);
});

test('Special Tiles - T and L shapes create Burst tile at intersection cell', () => {
  const boardT = Board.fromRows([
    ['dango', 'skewer', 'sakura', 'lantern', 'mask', 'lantern', 'skewer', 'mask'],
    ['mask', 'lantern', 'sakura', 'skewer', 'dango', 'mask', 'lantern', 'sakura'],
    ['sakura', 'sakura', 'sakura', 'sakura', 'sakura', 'dango', 'sakura', 'skewer'],
    ['skewer', 'dango', 'lantern', 'mask', 'lantern', 'dango', 'sakura', 'skewer'],
    ['mask', 'lantern', 'skewer', 'dango', 'skewer', 'lantern', 'mask', 'dango'],
    ['sakura', 'skewer', 'mask', 'lantern', 'mask', 'skewer', 'dango', 'lantern'],
    ['lantern', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['skewer', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);

  const groupsT = MatchFinder.findMatchGroups(boardT);
  assert.equal(groupsT.length, 1);
  assert.equal(groupsT[0].specialKind, SpecialKind.burst);
  assert.deepEqual(groupsT[0].findSpawnCell(null), new GridPos(2, 2));
});

test('Special Tiles - Compute blast areas: Slash Row, Slash Column, Burst, Orb', () => {
  const board = Board.generate();

  // 1. Slash Row clears row 3 completely (8 cells)
  const blastRow = Board.computeSpecialBlast({
    board,
    cell: new GridPos(3, 4),
    kind: SpecialKind.slashRow,
  });
  assert.equal(blastRow.length, 8);
  const rowKeys = new Set(blastRow.map((p) => p.key));
  for (let c = 0; c < 8; c++) {
    assert.ok(rowKeys.has(`3,${c}`));
  }

  // 2. Slash Column clears col 5 completely (8 cells)
  const blastCol = Board.computeSpecialBlast({
    board,
    cell: new GridPos(2, 5),
    kind: SpecialKind.slashColumn,
  });
  assert.equal(blastCol.length, 8);
  const colKeys = new Set(blastCol.map((p) => p.key));
  for (let r = 0; r < 8; r++) {
    assert.ok(colKeys.has(`${r},5`));
  }

  // 3. Burst clears 3x3 (9 cells in middle of board)
  const blastBurst = Board.computeSpecialBlast({
    board,
    cell: new GridPos(4, 4),
    kind: SpecialKind.burst,
  });
  assert.equal(blastBurst.length, 9);
  const burstKeys = new Set(blastBurst.map((p) => p.key));
  assert.ok(burstKeys.has('3,3'));
  assert.ok(burstKeys.has('5,5'));

  // Burst at corner (0, 0) clamped to 4 cells
  const cornerBurst = Board.computeSpecialBlast({
    board,
    cell: new GridPos(0, 0),
    kind: SpecialKind.burst,
  });
  assert.equal(cornerBurst.length, 4);

  // 4. Orb + Orb clears the entire 64-cell board
  const blastDoubleOrb = Board.computeSpecialBlast({
    board,
    cell: new GridPos(3, 3),
    kind: SpecialKind.orb,
    combo: SpecialComboKind.orbOrb,
  });
  assert.equal(blastDoubleOrb.length, 64);

  // 5. Burst + Burst combo clears 5x5 (25 cells)
  const blastDoubleBurst = Board.computeSpecialBlast({
    board,
    cell: new GridPos(4, 4),
    kind: SpecialKind.burst,
    combo: SpecialComboKind.burstBurst,
  });
  assert.equal(blastDoubleBurst.length, 25);
});

test('Special Tiles - Chain reactions: blast hitting another special cascades in waves', () => {
  const board = Board.fromRows([
    ['dango', 'skewer', 'mask', 'lantern', 'sakura', 'lantern', 'skewer', 'mask'],
    ['lantern', 'sakura', 'sakura', 'sakura', 'dango', 'mask', 'lantern', 'sakura'],
    ['skewer', 'dango', 'lantern', 'mask', 'lantern', 'dango', 'sakura', 'skewer'],
    ['mask', 'lantern', 'skewer', 'dango', 'skewer', 'lantern', 'mask', 'dango'],
    ['sakura', 'skewer', 'mask', 'lantern', 'mask', 'skewer', 'dango', 'lantern'],
    ['lantern', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['skewer', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
    ['dango', 'lantern', 'sakura', 'skewer', 'mask', 'sakura', 'lantern', 'dango'],
  ]);

  board.setAt(new GridPos(1, 2), new Tile(TileType.sakura, SpecialKind.slashColumn));
  board.setAt(new GridPos(4, 2), new Tile(TileType.foxMask, SpecialKind.burst));

  const result = Board.resolveBoard(board);
  assert.ok(result.steps.length >= 1);
  const firstStep = result.steps[0];

  assert.ok(firstStep.waves.length >= 2, `Expected >= 2 waves, got ${firstStep.waves.length}`);
  assert.equal(firstStep.waves[0].waveIndex, 1);
  assert.equal(firstStep.waves[1].waveIndex, 2);
});

test('Special Tiles - Collect Goals ignore Spirit Orbs (colorless)', () => {
  const level: LevelConfig = {
    number: 1,
    moves: 20,
    mode: LevelMode.collect,
    star1: 3000,
    star2: 6000,
    star3: 9000,
    collectGoals: { [TileType.sakura]: 10 },
  };
  const state = new GameState(level);

  // Initial remaining amount is 10
  assert.equal(state.collectProgress[TileType.sakura], 10);

  // Resolve step that clears 3 sakura tiles and 1 Spirit Orb
  state.applyResolveSteps([
    {
      cleared: [new GridPos(0, 0), new GridPos(0, 1), new GridPos(0, 2), new GridPos(0, 3)],
      clearedKeys: new Set(['0,0', '0,1', '0,2', '0,3']),
      clearedByType: { [TileType.sakura]: 3 }, // Orb does not contribute to color count
      matchRuns: [],
      matchGroups: [],
      createdSpecials: [],
      waves: [],
      falls: [],
      refills: [],
      stepBonusScore: 300,
    },
  ]);

  // Sakura goal remaining is 10 - 3 = 7
  assert.equal(state.collectProgress[TileType.sakura], 7);
});

test('Special Tiles - Shuffle preserves all special tiles on the board', () => {
  const board = Board.generate();
  board.setAt(new GridPos(0, 1), new Tile(TileType.lantern, SpecialKind.slashRow));
  board.setAt(new GridPos(2, 3), new Tile(TileType.dango, SpecialKind.burst));
  board.setAt(new GridPos(5, 5), Tile.orb());

  const countSpecials = (b: Board) => {
    let count = 0;
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        if (b.tileAt(r, c)?.isSpecial) count++;
      }
    }
    return count;
  };

  assert.equal(countSpecials(board), 3);
  Board.shuffleBoard(board);
  assert.equal(countSpecials(board), 3, 'Specials count must be preserved across shuffle');
});
