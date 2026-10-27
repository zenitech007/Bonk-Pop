import 'package:flutter_test/flutter_test.dart';
import 'package:prism_relic_match3/logic/board.dart';
import 'package:prism_relic_match3/logic/match_finder.dart';
import 'package:prism_relic_match3/logic/tile_type.dart';

/// Helper that builds an 8x8 board with a guaranteed no-match pattern,
/// then applies custom tile overrides for testing specific match shapes.
Board _buildBaseBoard([Map<GridPos, TileType>? overrides]) {
  const bgPattern = [
    TileType.circle,
    TileType.square,
    TileType.triangle,
  ];
  final grid = List<List<TileType>>.generate(8, (r) {
    return List<TileType>.generate(8, (c) {
      return bgPattern[(r + c) % bgPattern.length];
    });
  });

  final board = Board.fromGrid(grid);
  if (overrides != null) {
    overrides.forEach(board.setAt);
  }
  return board;
}

void main() {
  group('MatchFinder', () {
    test('returns nothing on a board with no matches', () {
      final board = _buildBaseBoard();
      expect(MatchFinder.findMatches(board), isEmpty);
    });

    test('detects horizontal run of 3', () {
      final board = _buildBaseBoard({
        const GridPos(2, 1): TileType.star,
        const GridPos(2, 2): TileType.star,
        const GridPos(2, 3): TileType.star,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(2, 1),
          const GridPos(2, 2),
          const GridPos(2, 3),
        }),
      );
    });

    test('detects vertical run of 3', () {
      final board = _buildBaseBoard({
        const GridPos(1, 5): TileType.diamond,
        const GridPos(2, 5): TileType.diamond,
        const GridPos(3, 5): TileType.diamond,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(1, 5),
          const GridPos(2, 5),
          const GridPos(3, 5),
        }),
      );
    });

    test('detects run of 4', () {
      final board = _buildBaseBoard({
        const GridPos(4, 2): TileType.star,
        const GridPos(4, 3): TileType.star,
        const GridPos(4, 4): TileType.star,
        const GridPos(4, 5): TileType.star,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(4, 2),
          const GridPos(4, 3),
          const GridPos(4, 4),
          const GridPos(4, 5),
        }),
      );
    });

    test('detects run of 5', () {
      final board = _buildBaseBoard({
        const GridPos(1, 3): TileType.diamond,
        const GridPos(2, 3): TileType.diamond,
        const GridPos(3, 3): TileType.diamond,
        const GridPos(4, 3): TileType.diamond,
        const GridPos(5, 3): TileType.diamond,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(1, 3),
          const GridPos(2, 3),
          const GridPos(3, 3),
          const GridPos(4, 3),
          const GridPos(5, 3),
        }),
      );
    });

    test('detects L shape where horizontal and vertical runs overlap at a corner', () {
      final board = _buildBaseBoard({
        const GridPos(5, 1): TileType.star,
        const GridPos(5, 2): TileType.star,
        const GridPos(5, 3): TileType.star,
        const GridPos(6, 1): TileType.star,
        const GridPos(7, 1): TileType.star,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(5, 1),
          const GridPos(5, 2),
          const GridPos(5, 3),
          const GridPos(6, 1),
          const GridPos(7, 1),
        }),
      );
    });

    test('detects T shape where horizontal and vertical runs intersect', () {
      final board = _buildBaseBoard({
        const GridPos(2, 2): TileType.star,
        const GridPos(2, 3): TileType.star,
        const GridPos(2, 4): TileType.star,
        const GridPos(3, 3): TileType.star,
        const GridPos(4, 3): TileType.star,
      });

      expect(
        MatchFinder.findMatches(board),
        equals({
          const GridPos(2, 2),
          const GridPos(2, 3),
          const GridPos(2, 4),
          const GridPos(3, 3),
          const GridPos(4, 3),
        }),
      );
    });
  });
}
