import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:prism_relic_match3/core/constants.dart';
import 'package:prism_relic_match3/core/theme/sakura_festival_theme.dart';
import 'package:prism_relic_match3/logic/board.dart';
import 'package:prism_relic_match3/logic/match_finder.dart';
import 'package:prism_relic_match3/logic/tile_type.dart';

/// Builds an 8x8 board with a guaranteed no-match pattern.
Board _buildNoMatchBoard() {
  const bg = [
    TileType.sakura,
    TileType.lantern,
    TileType.onigiri,
  ];
  final grid = List<List<TileType?>>.generate(8, (r) {
    return List<TileType?>.generate(8, (c) => bg[(r + c) % bg.length]);
  });
  return Board.fromGrid(grid);
}

void main() {
  group('Board & Step 1 Requirements', () {
    test('Board.generate() never starts with a match across 200 generations', () {
      final rng = Random(42);
      for (var i = 0; i < 200; i++) {
        final board = Board.generate(random: rng);
        expect(board.size, GameConstants.gridSize);
        final matches = MatchFinder.findMatches(board);
        expect(
          matches,
          isEmpty,
          reason: 'Board generation #$i unexpectedly started with matches: $matches',
        );
      }
    });

    test('areAdjacent returns true only for up, down, left, right neighbours', () {
      final board = Board.generate(random: Random(1));
      const center = GridPos(3, 3);

      expect(board.areAdjacent(center, const GridPos(2, 3)), isTrue);
      expect(board.areAdjacent(center, const GridPos(4, 3)), isTrue);
      expect(board.areAdjacent(center, const GridPos(3, 2)), isTrue);
      expect(board.areAdjacent(center, const GridPos(3, 4)), isTrue);

      expect(board.areAdjacent(center, center), isFalse);
      expect(board.areAdjacent(center, const GridPos(2, 2)), isFalse);
      expect(board.areAdjacent(center, const GridPos(2, 4)), isFalse);
      expect(board.areAdjacent(center, const GridPos(4, 2)), isFalse);
      expect(board.areAdjacent(center, const GridPos(4, 4)), isFalse);
    });
  });

  group('Step 2 Game Loop Logic', () {
    test('applyGravity: tiles fall correctly with middle gaps and a fully empty column', () {
      final board = _buildNoMatchBoard();

      // Column 2: clear middle cells (2,2), (3,2), (5,2)
      board.setAt(const GridPos(0, 2), TileType.foxMask);
      board.setAt(const GridPos(1, 2), TileType.dango);
      board.setAt(const GridPos(2, 2), null);
      board.setAt(const GridPos(3, 2), null);
      board.setAt(const GridPos(4, 2), TileType.sakura);
      board.setAt(const GridPos(5, 2), null);
      board.setAt(const GridPos(6, 2), TileType.lantern);
      board.setAt(const GridPos(7, 2), TileType.onigiri);

      // Column 5: fully empty column
      for (var r = 0; r < 8; r++) {
        board.setAt(GridPos(r, 5), null);
      }

      final moves = Board.applyGravity(board);

      // Column 2 should have top 3 cells empty and remaining 5 compacted at rows 3..7
      expect(board.tileAt(0, 2), isNull);
      expect(board.tileAt(1, 2), isNull);
      expect(board.tileAt(2, 2), isNull);
      expect(board.tileAt(3, 2), TileType.foxMask);
      expect(board.tileAt(4, 2), TileType.dango);
      expect(board.tileAt(5, 2), TileType.sakura);
      expect(board.tileAt(6, 2), TileType.lantern);
      expect(board.tileAt(7, 2), TileType.onigiri);

      // Column 5 remains completely null with zero moves
      for (var r = 0; r < 8; r++) {
        expect(board.tileAt(r, 5), isNull);
      }
      expect(moves.where((m) => m.from.col == 5), isEmpty);
      expect(moves.where((m) => m.from.col == 2).length, 3);
    });

    test('refill: fills every empty cell and never changes existing tiles', () {
      final board = _buildNoMatchBoard();
      board.setAt(const GridPos(0, 1), null);
      board.setAt(const GridPos(1, 1), null);
      board.setAt(const GridPos(0, 4), null);

      final snapshotBefore = <GridPos, TileType?>{};
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          final pos = GridPos(r, c);
          snapshotBefore[pos] = board.getAt(pos);
        }
      }

      final spawns = Board.refill(board, random: Random(99));
      expect(spawns.length, 3);

      for (final s in spawns) {
        expect(s.startRow, lessThan(0));
      }

      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          final pos = GridPos(r, c);
          expect(board.getAt(pos), isNotNull);
          if (snapshotBefore[pos] != null) {
            expect(board.getAt(pos), snapshotBefore[pos]);
          }
        }
      }
    });

    test('resolveBoard: returns a board with no matches and accurate cascade steps on a hand-built cascade', () {
      final board = _buildNoMatchBoard();

      // Build a staggered 2-step cascade:
      // Step 1: Vertical match of 3 foxMask at col 2, rows 5, 6, 7
      board.setAt(const GridPos(5, 2), TileType.foxMask);
      board.setAt(const GridPos(6, 2), TileType.foxMask);
      board.setAt(const GridPos(7, 2), TileType.foxMask);

      // Two dango waiting at (7, 0) and (7, 1), plus the 3rd dango at (4, 2) above the vertical match.
      // When col 2 rows 5..7 clear, (4, 2) drops 3 rows to (7, 2) and triggers Cascade Step 2!
      board.setAt(const GridPos(7, 0), TileType.dango);
      board.setAt(const GridPos(7, 1), TileType.dango);
      board.setAt(const GridPos(4, 2), TileType.dango);

      final result = Board.resolveBoard(board, random: Random(7));

      expect(result.cascadeCount, greaterThanOrEqualTo(2));
      expect(result.steps.length, result.cascadeCount);
      expect(
        result.steps[0].cleared,
        containsAll([
          const GridPos(5, 2),
          const GridPos(6, 2),
          const GridPos(7, 2),
        ]),
      );
      expect(
        result.steps[1].cleared,
        containsAll([
          const GridPos(7, 0),
          const GridPos(7, 1),
          const GridPos(7, 2),
        ]),
      );

      // Final resolved board has zero remaining matches and no null cells
      expect(MatchFinder.findMatches(board), isEmpty);
    });

    test('hasPossibleMove: detects true and false cases accurately', () {
      // False case: checkerboard of 4 types where no two identical types are within distance 2
      final deadGrid = List<List<TileType?>>.generate(8, (r) {
        return List<TileType?>.generate(8, (c) {
          final idx = ((r % 2) * 2) + (c % 2);
          return TileType.values[idx];
        });
      });
      final deadBoard = Board.fromGrid(deadGrid);
      expect(Board.hasPossibleMove(deadBoard), isFalse);

      // True case: place two sakura at (0,0), (0,1) and one sakura at (1,2)
      final liveBoard = Board.fromGrid(deadGrid);
      liveBoard.setAt(const GridPos(0, 0), TileType.foxMask);
      liveBoard.setAt(const GridPos(0, 1), TileType.foxMask);
      liveBoard.setAt(const GridPos(1, 2), TileType.foxMask);
      expect(Board.hasPossibleMove(liveBoard), isTrue);
    });

    test('shuffleBoard: result has no matches and at least one possible move across 200 runs', () {
      final rng = Random(2026);
      final board = Board.generate(random: rng);

      for (var i = 0; i < 200; i++) {
        Board.shuffleBoard(board, random: rng);
        expect(
          MatchFinder.findMatches(board),
          isEmpty,
          reason: 'Shuffle #$i left a match on the board',
        );
        expect(
          Board.hasPossibleMove(board),
          isTrue,
          reason: 'Shuffle #$i produced a board with no possible moves',
        );
      }
    });

    test('SakuraFestivalTheme has 5 distinct tile styles and every tile id has a shape', () {
      final theme = SakuraFestivalTheme();
      expect(theme.tileStyles.length, 5);

      final ids = theme.tileStyles.map((s) => s.id).toSet();
      final shapes = theme.tileStyles.map((s) => s.shape).toSet();
      final colors = theme.tileStyles.map((s) => s.baseColor).toSet();

      expect(ids.length, 5);
      expect(shapes.length, 5);
      expect(colors.length, 5);

      for (final type in TileType.values) {
        final style = theme.styleFor(type);
        expect(style.id, type);
        expect(style.shape, isNotNull);
      }
    });
  });
}
