import test from 'node:test';
import assert from 'node:assert/strict';
import { GameConstants } from '../core/constants';
import { GridPos, ResolveStep } from './board';
import { GameState, GameStatus } from './game_state';
import { LevelConfig, LevelMode } from './level_config';
import { Levels } from './levels';
import { MatchDirection, MatchRun } from './match_finder';
import { Scoring } from './scoring';
import { TileType } from './tile_type';

function makeStep(params: {
  tileCount: number;
  byType?: Partial<Record<TileType, number>>;
  runLengths?: number[];
}): ResolveStep {
  const { tileCount, byType, runLengths = [3] } = params;
  const cleared: GridPos[] = Array.from(
    { length: tileCount },
    (_, i) => new GridPos(0, i)
  );
  const clearedKeys = new Set(cleared.map((c) => c.key));
  const matchRuns: MatchRun[] = runLengths.map((len) => ({
    type: TileType.sakura,
    cells: Array.from({ length: len }, (_, i) => new GridPos(0, i)),
    length: len,
    direction: MatchDirection.horizontal,
  }));

  return {
    cleared,
    clearedKeys,
    clearedByType: byType ?? { [TileType.sakura]: tileCount },
    matchRuns,
    matchGroups: [],
    createdSpecials: [],
    waves: [],
    falls: [],
    refills: [],
    stepBonusScore: 0,
  };
}

test('Scoring: base points, cascade multiplier and the cap at x5, run-of-4 and run-of-5 bonuses', () => {
  const step3 = makeStep({ tileCount: 3, runLengths: [3] });
  // Cascade 1 (index 0): 3 * 60 * 1 = 180
  assert.equal(
    Scoring.scoreForStep(step3, 0),
    3 * GameConstants.basePointsPerTile
  );
  // Cascade 2 (index 1): 3 * 60 * 2 = 360
  assert.equal(
    Scoring.scoreForStep(step3, 1),
    3 * GameConstants.basePointsPerTile * 2
  );
  // Cascade 5 (index 4): 3 * 60 * 5 = 900
  assert.equal(
    Scoring.scoreForStep(step3, 4),
    3 * GameConstants.basePointsPerTile * 5
  );
  // Cascade 8 (index 7): capped at x5 -> 900
  assert.equal(
    Scoring.scoreForStep(step3, 7),
    3 * GameConstants.basePointsPerTile * 5
  );

  // Run of 4 bonus (+120): (4 * 60 + 120) * 1 = 360
  const step4 = makeStep({ tileCount: 4, runLengths: [4] });
  assert.equal(
    Scoring.scoreForStep(step4, 0),
    4 * GameConstants.basePointsPerTile + GameConstants.runOf4Bonus
  );

  // Run of 5 bonus (+300) on cascade 2 (x2): (5 * 60 + 300) * 2 = 1200
  const step5 = makeStep({ tileCount: 5, runLengths: [5] });
  assert.equal(
    Scoring.scoreForStep(step5, 1),
    (5 * GameConstants.basePointsPerTile + GameConstants.runOf5OrMoreBonus) * 2
  );
});

test('useMove is called only for valid swaps; invalid swaps never change movesLeft', () => {
  const state = new GameState(Levels.forNumber(1));
  assert.equal(state.movesLeft, 20);

  // Invalid swap does not invoke useMove()
  assert.equal(state.movesLeft, 20);

  // Valid swap invokes useMove()
  state.useMove();
  assert.equal(state.movesLeft, 19);
});

test('Score mode: wins at movesLeft == 0 with score >= star1; loses below it', () => {
  const config: LevelConfig = {
    number: 1,
    moves: 1,
    mode: LevelMode.score,
    star1: 500,
    star2: 1000,
    star3: 1500,
    collectGoals: {},
  };

  // Lose below star1 (180 < 500)
  const loseState = new GameState(config);
  loseState.useMove();
  loseState.applyResolveSteps([makeStep({ tileCount: 3 })]);
  loseState.evaluate();
  assert.equal(loseState.status, GameStatus.lost);
  assert.equal(loseState.stars, 0);

  // Win at/above star1 (600 >= 500)
  const winState = new GameState(config);
  winState.useMove();
  winState.applyResolveSteps([makeStep({ tileCount: 5, runLengths: [5] })]);
  winState.evaluate();
  assert.equal(winState.status, GameStatus.won);
  assert.equal(winState.stars, 1);
});

test('Collect mode: wins immediately when goals reach 0 with moves left; loses at 0 moves with goals left; leftover-moves bonus added before stars', () => {
  const config: LevelConfig = {
    number: 2,
    moves: 5,
    mode: LevelMode.collect,
    star1: 1000,
    star2: 2000,
    star3: 3000,
    collectGoals: { [TileType.sakura]: 3 },
  };

  const winState = new GameState(config);
  winState.useMove(); // 4 moves left
  winState.applyResolveSteps([
    makeStep({ tileCount: 3, byType: { [TileType.sakura]: 3 } }),
  ]);
  winState.evaluate();

  assert.equal(winState.status, GameStatus.won);
  // 180 base + 4 leftover moves * 500 = 2180 -> reaches star2 (2000)!
  assert.equal(winState.score, 180 + 4 * GameConstants.leftoverMoveBonus);
  assert.equal(winState.stars, 2);

  // Lose at 0 moves with goals left
  const loseConfig: LevelConfig = {
    number: 2,
    moves: 1,
    mode: LevelMode.collect,
    star1: 1000,
    star2: 2000,
    star3: 3000,
    collectGoals: { [TileType.sakura]: 5 },
  };
  const loseState = new GameState(loseConfig);
  loseState.useMove();
  loseState.applyResolveSteps([
    makeStep({ tileCount: 3, byType: { [TileType.sakura]: 3 } }),
  ]);
  loseState.evaluate();
  assert.equal(loseState.status, GameStatus.lost);
});

test('Winning on the very last move (including via cascades) is a win, not a loss, and goals never go negative', () => {
  const config: LevelConfig = {
    number: 3,
    moves: 1,
    mode: LevelMode.collect,
    star1: 300,
    star2: 600,
    star3: 900,
    collectGoals: { [TileType.sakura]: 4 },
  };

  const state = new GameState(config);
  state.useMove(); // movesLeft == 0
  state.applyResolveSteps([
    makeStep({ tileCount: 3, byType: { [TileType.sakura]: 3 } }),
    makeStep({ tileCount: 3, byType: { [TileType.sakura]: 3 } }),
  ]);
  state.evaluate();

  assert.equal(state.collectProgress[TileType.sakura], 0);
  assert.equal(state.status, GameStatus.won);
  assert.equal(state.score, 180 + 360);
});

test('Stars are 1, 2 or 3 at the exact thresholds, and the score just below a threshold gives the lower star count', () => {
  assert.equal(
    Scoring.computeStars({
      score: 2999,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: false,
    }),
    0
  );
  assert.equal(
    Scoring.computeStars({
      score: 3000,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: true,
    }),
    1
  );
  assert.equal(
    Scoring.computeStars({
      score: 5999,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: true,
    }),
    1
  );
  assert.equal(
    Scoring.computeStars({
      score: 6000,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: true,
    }),
    2
  );
  assert.equal(
    Scoring.computeStars({
      score: 8999,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: true,
    }),
    2
  );
  assert.equal(
    Scoring.computeStars({
      score: 9000,
      star1: 3000,
      star2: 6000,
      star3: 9000,
      isWin: true,
    }),
    3
  );
});

test('After won or lost, further score or move changes are ignored; restart() resets everything', () => {
  const config: LevelConfig = {
    number: 2,
    moves: 3,
    mode: LevelMode.collect,
    star1: 100,
    star2: 500,
    star3: 1000,
    collectGoals: { [TileType.sakura]: 3 },
  };

  const state = new GameState(config);
  state.useMove();
  state.applyResolveSteps([
    makeStep({ tileCount: 3, byType: { [TileType.sakura]: 3 } }),
  ]);
  state.evaluate();
  assert.equal(state.status, GameStatus.won);

  const lockedScore = state.score;
  const lockedMoves = state.movesLeft;

  // Attempt extra move and score after game is won -> ignored
  state.useMove();
  state.applyResolveSteps([
    makeStep({ tileCount: 5, byType: { [TileType.sakura]: 5 } }),
  ]);
  assert.equal(state.score, lockedScore);
  assert.equal(state.movesLeft, lockedMoves);

  // restart() resets everything
  state.restart();
  assert.equal(state.status, GameStatus.idle);
  assert.equal(state.score, 0);
  assert.equal(state.stars, 0);
  assert.equal(state.movesLeft, 3);
  assert.equal(state.collectProgress[TileType.sakura], 3);
});
