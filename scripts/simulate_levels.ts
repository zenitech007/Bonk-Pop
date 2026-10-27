import { Board, GridPos } from '../src/logic/board';
import { GameState, GameStatus } from '../src/logic/game_state';
import { LevelConfig, LevelMode } from '../src/logic/level_config';
import { Levels } from '../src/logic/levels';
import { MatchFinder } from '../src/logic/match_finder';

export type BotSkill = 'greedy' | 'casual';

export interface LevelSimResult {
  levelNumber: number;
  mode: LevelMode;
  moves: number;
  runs: number;
  wins: number;
  winRatePct: number;
  avgStarsOnWin: number;
  avgStarsAll: number;
  threeStarRatePct: number;
  avgMovesLeftOnWin: number;
}

function hasLocalMatchAt(board: Board, r: number, c: number): boolean {
  const t = board.tileAt(r, c);
  if (!t || t.isOrb) return false;
  const size = board.size;

  let hCount = 1;
  for (let cc = c - 1; cc >= 0 && board.tileAt(r, cc)?.matchesColor(t); cc--) {
    hCount++;
  }
  for (
    let cc = c + 1;
    cc < size && board.tileAt(r, cc)?.matchesColor(t);
    cc++
  ) {
    hCount++;
  }
  if (hCount >= 3) return true;

  let vCount = 1;
  for (let rr = r - 1; rr >= 0 && board.tileAt(rr, c)?.matchesColor(t); rr--) {
    vCount++;
  }
  for (
    let rr = r + 1;
    rr < size && board.tileAt(rr, c)?.matchesColor(t);
    rr++
  ) {
    vCount++;
  }
  return vCount >= 3;
}

function evaluateMoveScore(
  board: Board,
  from: GridPos,
  to: GridPos,
  level: LevelConfig,
  state: GameState
): number {
  const tileA = board.getAt(from);
  const tileB = board.getAt(to);
  if (!tileA || !tileB) return -1;

  const hasGlow = state.initialGlowLayers > 0;

  // Double special swap
  if (tileA.isSpecial && tileB.isSpecial) {
    if (tileA.isOrb && tileB.isOrb) return 4000;
    return 2400;
  }

  // Single orb swap
  if (tileA.isOrb || tileB.isOrb) {
    const other = tileA.isOrb ? tileB : tileA;
    let bonus = 1100;
    if (
      level.mode === LevelMode.collect &&
      (state.collectProgress[other.type] ?? 0) > 0
    ) {
      bonus += 1200;
    }
    if (hasGlow) {
      let glowMatches = 0;
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          if (
            board.tileAt(r, c)?.type === other.type &&
            state.glowLayersAt(r, c) > 0
          ) {
            glowMatches++;
          }
        }
      }
      bonus += glowMatches * 450;
    }
    return bonus;
  }

  board.swap(from, to);
  const createsMatch =
    hasLocalMatchAt(board, from.row, from.col) ||
    hasLocalMatchAt(board, to.row, to.col);
  if (!createsMatch) {
    board.swap(from, to);
    return -1;
  }

  const groups = MatchFinder.findMatchGroups(board);
  if (groups.length === 0) {
    board.swap(from, to);
    return -1;
  }

  let score = (from.row + to.row) * 8;
  const countedCells = new Set<string>();

  for (const g of groups) {
    if (g.shapeKind === 'line5') score += 1100;
    else if (
      g.shapeKind === 'lShape' ||
      g.shapeKind === 'tShape' ||
      g.shapeKind === 'cross'
    )
      score += 700;
    else if (g.shapeKind === 'line4') score += 480;
    else score += 180;

    if (level.mode === LevelMode.collect) {
      const rem = state.collectProgress[g.type] ?? 0;
      if (rem > 0) {
        score += g.cells.length * 460;
      }
    }

    for (const c of g.cells) {
      countedCells.add(c.key);
      // Weight tiles cleared on glowing cells at x2 (Step 6 Part B.4)
      if (hasGlow && state.glowLayersAt(c.row, c.col) > 0) {
        score += 420;
      }

      // Check if this matched cell contains a special tile on the swapped board
      const t = board.getAt(c);
      if (t && t.isSpecial) {
        score += 550;
        const blast = Board.computeSpecialBlast({
          board,
          cell: c,
          kind: t.special,
          targetColor: t.type,
        });
        for (const bp of blast) {
          if (!countedCells.has(bp.key)) {
            countedCells.add(bp.key);
            if (hasGlow && state.glowLayersAt(bp.row, bp.col) > 0) {
              score += 420;
            }
            if (level.mode === LevelMode.collect) {
              const bt = board.getAt(bp);
              if (bt && (state.collectProgress[bt.type] ?? 0) > 0) {
                score += 280;
              }
            } else {
              score += 50;
            }
          }
        }
      }
    }
  }

  board.swap(from, to);
  return score;
}

export function runSingleSimulation(
  level: LevelConfig,
  seed: number,
  skill: BotSkill
): {
  won: boolean;
  stars: number;
  movesLeft: number;
  score: number;
} {
  let stateRandom = seed >>> 0;
  const rng = () => {
    stateRandom = (1664525 * stateRandom + 1013904223) >>> 0;
    return stateRandom / 0x100000000;
  };

  const state = new GameState(level);
  const board = Board.generate(rng);

  while (!state.isGameOver) {
    const validMoves: { from: GridPos; to: GridPos; score: number }[] = [];

    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const from = new GridPos(r, c);
        const neighbors = [new GridPos(r + 1, c), new GridPos(r, c + 1)];

        for (const to of neighbors) {
          if (board.isBounds(to)) {
            const moveScore = evaluateMoveScore(board, from, to, level, state);
            if (moveScore > 0) {
              validMoves.push({ from, to, score: moveScore });
            }
          }
        }
      }
    }

    if (validMoves.length === 0) {
      if (!Board.hasPossibleMove(board)) {
        Board.shuffleBoard(board, rng);
        continue;
      }
      break;
    }

    validMoves.sort((a, b) => b.score - a.score);

    let chosen = validMoves[0];
    if (skill === 'casual' && rng() >= 0.5) {
      chosen = validMoves[Math.floor(rng() * validMoves.length)];
    }

    state.useMove();
    board.swap(chosen.from, chosen.to);
    const res = Board.resolveBoard(board, {
      randomFn: rng,
      playerMovedCell: chosen.to,
      playerSwapOriginCell: chosen.from,
    });
    state.applyResolveSteps(res.steps);
    state.evaluate();

    if (!Board.hasPossibleMove(board) && !state.isGameOver) {
      Board.shuffleBoard(board, rng);
    }
  }

  return {
    won: state.status === GameStatus.won,
    stars: state.stars,
    movesLeft: state.movesLeft,
    score: state.score,
  };
}

export function simulateAllLevels(
  runsPerLevel = 200,
  skill: BotSkill = 'greedy'
): LevelSimResult[] {
  const results: LevelSimResult[] = [];
  for (let lvl = 1; lvl <= 30; lvl++) {
    const config = Levels.forNumber(lvl);
    let wins = 0;
    let totalStarsOnWin = 0;
    let totalStarsAll = 0;
    let threeStars = 0;
    let totalMovesLeft = 0;

    for (let run = 0; run < runsPerLevel; run++) {
      const outcome = runSingleSimulation(config, lvl * 10000 + run * 7 + 13, skill);
      totalStarsAll += outcome.stars;
      if (outcome.won) {
        wins++;
        totalStarsOnWin += outcome.stars;
        totalMovesLeft += outcome.movesLeft;
        if (outcome.stars === 3) {
          threeStars++;
        }
      }
    }

    results.push({
      levelNumber: lvl,
      mode: config.mode,
      moves: config.moves,
      runs: runsPerLevel,
      wins,
      winRatePct: (wins / runsPerLevel) * 100,
      avgStarsOnWin: wins > 0 ? totalStarsOnWin / wins : 0,
      avgStarsAll: totalStarsAll / runsPerLevel,
      threeStarRatePct: (threeStars / runsPerLevel) * 100,
      avgMovesLeftOnWin: wins > 0 ? totalMovesLeft / wins : 0,
    });
  }
  return results;
}

if (process.argv[1]?.endsWith('simulate_levels.ts')) {
  const runs = Number(process.argv[2] ?? '200');
  console.log(`Running Bonk Pop Level Balance Simulation (${runs} runs per level, greedy & casual)...`);
  const greedy = simulateAllLevels(runs, 'greedy');
  const casual = simulateAllLevels(runs, 'casual');

  console.log(
    '\n| Level | Mode    | Moves | Greedy Win% | Casual Win% | Greedy Avg★ | Greedy 3★% | Casual Avg★ | Moves Left |'
  );
  console.log(
    '|-------|---------|-------|-------------|-------------|-------------|------------|-------------|------------|'
  );

  for (let i = 0; i < greedy.length; i++) {
    const g = greedy[i];
    const c = casual[i];
    console.log(
      `| ${g.levelNumber.toString().padStart(5)} | ${g.mode.padEnd(7)} | ${g.moves.toString().padStart(5)} | ${g.winRatePct.toFixed(1).padStart(10)}% | ${c.winRatePct.toFixed(1).padStart(10)}% | ${g.avgStarsOnWin.toFixed(2).padStart(11)} | ${g.threeStarRatePct.toFixed(1).padStart(9)}% | ${c.avgStarsOnWin.toFixed(2).padStart(11)} | ${g.avgMovesLeftOnWin.toFixed(1).padStart(10)} |`
    );
  }

  const bandAvg = (arr: LevelSimResult[], start: number, end: number, fn: (x: LevelSimResult) => number) => {
    const slice = arr.filter((x) => x.levelNumber >= start && x.levelNumber <= end);
    return slice.reduce((acc, x) => acc + fn(x), 0) / slice.length;
  };

  console.log('\n--- Band Summary ---');
  console.log(
    `Levels 1-5   | Greedy Win: ${bandAvg(greedy, 1, 5, (x) => x.winRatePct).toFixed(1)}% | Casual Win: ${bandAvg(casual, 1, 5, (x) => x.winRatePct).toFixed(1)}% | Greedy Avg Stars: ${bandAvg(greedy, 1, 5, (x) => x.avgStarsOnWin).toFixed(2)}`
  );
  console.log(
    `Levels 6-15  | Greedy Win: ${bandAvg(greedy, 6, 15, (x) => x.winRatePct).toFixed(1)}% | Casual Win: ${bandAvg(casual, 6, 15, (x) => x.winRatePct).toFixed(1)}% | Greedy Avg Stars: ${bandAvg(greedy, 6, 15, (x) => x.avgStarsOnWin).toFixed(2)}`
  );
  console.log(
    `Levels 16-30 | Greedy Win: ${bandAvg(greedy, 16, 30, (x) => x.winRatePct).toFixed(1)}% | Casual Win: ${bandAvg(casual, 16, 30, (x) => x.winRatePct).toFixed(1)}% | Greedy Avg Stars: ${bandAvg(greedy, 16, 30, (x) => x.avgStarsOnWin).toFixed(2)}`
  );
}
