import 'dart:io';
import 'dart:math';
import 'package:bonk_pop/logic/board.dart';
import 'package:bonk_pop/logic/game_state.dart';
import 'package:bonk_pop/logic/level_config.dart';
import 'package:bonk_pop/logic/levels.dart';
import 'package:bonk_pop/logic/tile_type.dart';

/// Greedy level simulation bot for "Bonk Pop" (Step 5 Part E).
void main() {
  stdout.writeln('Running Bonk Pop Level Balance Simulation (200 runs per level)...');
  stdout.writeln('| Level | Mode | Win Rate % | Avg Stars (Wins) | Avg Moves Left |');
  stdout.writeln('|-------|---------|------------|------------------|----------------|');

  for (var lvl = 1; lvl <= 30; lvl++) {
    final config = Levels.forNumber(lvl);
    var wins = 0;
    var totalStars = 0;
    var totalMovesLeft = 0;
    const runs = 200;

    for (var run = 0; run < runs; run++) {
      final outcome = _runSingleSimulation(config, lvl * 1000 + run);
      if (outcome.won) {
        wins++;
        totalStars += outcome.stars;
        totalMovesLeft += outcome.movesLeft;
      }
    }

    final winRate = (wins / runs * 100).toStringAsFixed(1);
    final avgStars = wins > 0 ? (totalStars / wins).toStringAsFixed(2) : '0.00';
    final avgMoves = wins > 0 ? (totalMovesLeft / wins).toStringAsFixed(1) : '0.0';

    stdout.writeln(
      '| ${lvl.toString().padLeft(5)} | ${config.mode.name.padRight(7)} | ${winRate.padLeft(9)}% | ${avgStars.padLeft(16)} | ${avgMoves.padLeft(14)} |',
    );
  }
}

({bool won, int stars, int movesLeft}) _runSingleSimulation(
  LevelConfig level,
  int seed,
) {
  final rng = Random(seed);
  final state = GameState(level);
  var board = Board.generate(random: rng);

  while (!state.isGameOver) {
    ({GridPos from, GridPos to, int score})? bestMove;

    for (var r = 0; r < board.size; r++) {
      for (var c = 0; c < board.size; c++) {
        final from = GridPos(r, c);
        final neighbors = [GridPos(r + 1, c), GridPos(r, c + 1)];

        for (final to in neighbors) {
          if (board.isBounds(to)) {
            final moveScore = _evaluateMove(board, from, to, state);
            if (moveScore >= 0) {
              if (bestMove == null || moveScore > bestMove.score) {
                bestMove = (from: from, to: to, score: moveScore);
              }
            }
          }
        }
      }
    }

    if (bestMove == null) {
      if (!Board.hasPossibleMove(board)) {
        Board.shuffleBoard(board, random: rng);
        continue;
      }
      break;
    }

    state.useMove();
    board.swap(bestMove.from, bestMove.to);
    final res = Board.resolveBoard(
      board,
      playerMovedCell: bestMove.to,
      playerSwapOriginCell: bestMove.from,
      random: rng,
    );
    state.applyResolveSteps(res.steps);
    state.evaluate();

    if (!Board.hasPossibleMove(board) && !state.isGameOver) {
      Board.shuffleBoard(board, random: rng);
    }
  }

  return (
    won: state.status == GameStatus.won,
    stars: state.stars,
    movesLeft: state.movesLeft,
  );
}

int _evaluateMove(
  Board board,
  GridPos from,
  GridPos to,
  GameState state,
) {
  final clone = Board.fromGrid(board.toGrid());
  clone.swap(from, to);
  final res = Board.resolveBoard(
    clone,
    playerMovedCell: to,
    playerSwapOriginCell: from,
  );

  if (res.steps.isEmpty) return -1;

  var score = 0;
  for (final step in res.steps) {
    score += step.stepBonusScore;
    score += step.cleared.length * 60;

    if (state.level.mode == LevelMode.collect) {
      for (final entry in step.clearedByType.entries) {
        if (state.level.collectGoals.containsKey(entry.key.name)) {
          score += entry.value * 400;
        }
      }
    }

    for (final sp in step.createdSpecials) {
      if (sp.tile.isOrb) score += 800;
      if (sp.tile.isBurst) score += 500;
      if (sp.tile.isSlash) score += 350;
    }
  }

  return score;
}
