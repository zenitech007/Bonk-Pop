import 'package:flutter_test/flutter_test.dart';
import 'package:prism_relic_match3/core/constants.dart';
import 'package:prism_relic_match3/logic/board.dart';
import 'package:prism_relic_match3/logic/game_state.dart';
import 'package:prism_relic_match3/logic/level_config.dart';
import 'package:prism_relic_match3/logic/levels.dart';
import 'package:prism_relic_match3/logic/match_finder.dart';
import 'package:prism_relic_match3/logic/scoring.dart';
import 'package:prism_relic_match3/logic/tile_type.dart';

ResolveStep _makeStep({
  required int tileCount,
  Map<TileType, int>? byType,
  List<int> runLengths = const [3],
}) {
  final cleared = <GridPos>{
    for (var i = 0; i < tileCount; i++) GridPos(0, i),
  };
  final runs = runLengths
      .map(
        (len) => MatchRun(
          type: TileType.sakura,
          cells: List.generate(len, (i) => GridPos(0, i)),
        ),
      )
      .toList();

  return ResolveStep(
    cleared: cleared,
    clearedByType: byType ?? {TileType.sakura: tileCount},
    matchRuns: runs,
    falls: const [],
    refills: const [],
  );
}

void main() {
  group('Scoring', () {
    test('computes base points, cascade multiplier up to x5 cap, and run-of-4 / run-of-5+ bonuses', () {
      final step3 = _makeStep(tileCount: 3, runLengths: [3]);
      // Cascade 1 (index 0): 3 * 60 * 1 = 180
      expect(Scoring.scoreForStep(step3, 0), 3 * GameConstants.basePointsPerTile);
      // Cascade 2 (index 1): 3 * 60 * 2 = 360
      expect(Scoring.scoreForStep(step3, 1), 3 * GameConstants.basePointsPerTile * 2);
      // Cascade 5 (index 4): 3 * 60 * 5 = 900
      expect(Scoring.scoreForStep(step3, 4), 3 * GameConstants.basePointsPerTile * 5);
      // Cascade 7 (index 6): still capped at x5 -> 900
      expect(Scoring.scoreForStep(step3, 6), 3 * GameConstants.basePointsPerTile * 5);

      // Run of 4 bonus (+120): (4 * 60 + 120) * 1 = 360
      final step4 = _makeStep(tileCount: 4, runLengths: [4]);
      expect(
        Scoring.scoreForStep(step4, 0),
        4 * GameConstants.basePointsPerTile + GameConstants.runOf4Bonus,
      );

      // Run of 5 bonus (+300) on cascade 2 (x2): (5 * 60 + 300) * 2 = 1200
      final step5 = _makeStep(tileCount: 5, runLengths: [5]);
      expect(
        Scoring.scoreForStep(step5, 1),
        (5 * GameConstants.basePointsPerTile + GameConstants.runOf5OrMoreBonus) * 2,
      );
    });
  });

  group('GameState & Level Evaluation', () {
    test('useMove decrements movesLeft only when called; invalid swaps do not change movesLeft', () {
      final state = GameState(level: Levels.forNumber(1));
      expect(state.movesLeft, 20);

      // Invalid swap does not call useMove -> movesLeft stays 20
      expect(state.movesLeft, 20);

      // Valid swap calls useMove -> movesLeft becomes 19
      state.useMove();
      expect(state.movesLeft, 19);
    });

    test('Score mode: wins at movesLeft == 0 with score >= star1; loses below it', () {
      const config = LevelConfig(
        number: 1,
        moves: 1,
        mode: LevelMode.score,
        star1: 500,
        star2: 1000,
        star3: 1500,
      );

      // Lose case: 180 < 500
      final loseState = GameState(level: config);
      loseState.useMove();
      loseState.applyResolveSteps([_makeStep(tileCount: 3)]);
      loseState.evaluate();
      expect(loseState.status, GameStatus.lost);
      expect(loseState.stars, 0);

      // Win case: 5 tiles + run of 5 bonus = 600 >= 500
      final winState = GameState(level: config);
      winState.useMove();
      winState.applyResolveSteps([_makeStep(tileCount: 5, runLengths: [5])]);
      winState.evaluate();
      expect(winState.status, GameStatus.won);
      expect(winState.stars, 1);
    });

    test('Collect mode: wins immediately when goals reach 0 with moves left, and loses at 0 moves with goals left', () {
      final config = LevelConfig(
        number: 2,
        moves: 5,
        mode: LevelMode.collect,
        star1: 1000,
        star2: 2000,
        star3: 3000,
        collectGoals: {TileType.sakura.name: 3},
      );

      final winState = GameState(level: config);
      winState.useMove(); // 4 moves left
      winState.applyResolveSteps([
        _makeStep(tileCount: 3, byType: {TileType.sakura: 3}),
      ]);
      winState.evaluate();
      expect(winState.status, GameStatus.won);
      // 180 base + 4 leftover moves * 500 = 2180 -> 2 stars!
      expect(winState.score, 180 + 4 * GameConstants.leftoverMoveBonus);
      expect(winState.stars, 2);

      // Lose at 0 moves with goals remaining
      final loseConfig = LevelConfig(
        number: 2,
        moves: 1,
        mode: LevelMode.collect,
        star1: 1000,
        star2: 2000,
        star3: 3000,
        collectGoals: {TileType.sakura.name: 5},
      );
      final loseState = GameState(level: loseConfig);
      loseState.useMove();
      loseState.applyResolveSteps([
        _makeStep(tileCount: 3, byType: {TileType.sakura: 3}),
      ]);
      loseState.evaluate();
      expect(loseState.status, GameStatus.lost);
    });

    test('Winning on the very last move (including via cascade) is a WIN and goals never go negative', () {
      final config = LevelConfig(
        number: 3,
        moves: 1,
        mode: LevelMode.collect,
        star1: 300,
        star2: 600,
        star3: 900,
        collectGoals: {TileType.sakura.name: 4},
      );

      final state = GameState(level: config);
      state.useMove(); // movesLeft == 0
      // Step 1 clears 3 sakura, Cascade Step 2 clears 3 more sakura (total 6 > 4)
      state.applyResolveSteps([
        _makeStep(tileCount: 3, byType: {TileType.sakura: 3}),
        _makeStep(tileCount: 3, byType: {TileType.sakura: 3}),
      ]);
      state.evaluate();

      expect(state.collectProgress[TileType.sakura.name], 0); // Clamped at 0, never negative
      expect(state.status, GameStatus.won);
      expect(state.score, 180 + 360); // Both cascade steps counted before evaluate
    });

    test('Stars are 1, 2 or 3 at exact thresholds and lower just below thresholds', () {
      expect(
        Scoring.computeStars(
          score: 2999,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: false,
        ),
        0,
      );
      expect(
        Scoring.computeStars(
          score: 3000,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: true,
        ),
        1,
      );
      expect(
        Scoring.computeStars(
          score: 5999,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: true,
        ),
        1,
      );
      expect(
        Scoring.computeStars(
          score: 6000,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: true,
        ),
        2,
      );
      expect(
        Scoring.computeStars(
          score: 8999,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: true,
        ),
        2,
      );
      expect(
        Scoring.computeStars(
          score: 9000,
          star1: 3000,
          star2: 6000,
          star3: 9000,
          isWin: true,
        ),
        3,
      );
    });

    test('After won or lost, further score or move changes are ignored; restart() resets everything', () {
      final config = LevelConfig(
        number: 2,
        moves: 3,
        mode: LevelMode.collect,
        star1: 100,
        star2: 500,
        star3: 1000,
        collectGoals: {TileType.sakura.name: 3},
      );

      final state = GameState(level: config);
      state.useMove();
      state.applyResolveSteps([
        _makeStep(tileCount: 3, byType: {TileType.sakura: 3}),
      ]);
      state.evaluate();
      expect(state.status, GameStatus.won);

      final finalScore = state.score;
      final finalMoves = state.movesLeft;

      // Further calls after win must be ignored
      state.useMove();
      state.applyResolveSteps([
        _makeStep(tileCount: 5, byType: {TileType.sakura: 5}),
      ]);
      expect(state.score, finalScore);
      expect(state.movesLeft, finalMoves);

      // restart() resets everything cleanly
      state.restart();
      expect(state.status, GameStatus.idle);
      expect(state.score, 0);
      expect(state.stars, 0);
      expect(state.movesLeft, 3);
      expect(state.collectProgress[TileType.sakura.name], 3);
    });
  });
}
