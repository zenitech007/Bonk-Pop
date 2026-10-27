import 'package:flutter_test/flutter_test.dart';
import 'package:bonk_pop/logic/board.dart';
import 'package:bonk_pop/logic/game_state.dart';
import 'package:bonk_pop/logic/level_config.dart';
import 'package:bonk_pop/logic/match_finder.dart';
import 'package:bonk_pop/logic/tile_type.dart';

void main() {
  group('Special Tiles Tests (Step 5)', () {
    test('Match 4 creates Slash tile with correct orientation', () {
      final boardH = Board.fromRows([
        [TileType.sakura, TileType.sakura, TileType.sakura, TileType.sakura, TileType.lantern, TileType.skewer, TileType.mask, TileType.dango],
        [TileType.dango, TileType.skewer, TileType.mask, TileType.lantern, TileType.sakura, TileType.lantern, TileType.skewer, TileType.mask],
        [TileType.lantern, TileType.mask, TileType.dango, TileType.skewer, TileType.dango, TileType.mask, TileType.lantern, TileType.sakura],
        [TileType.skewer, TileType.dango, TileType.lantern, TileType.mask, TileType.lantern, TileType.dango, TileType.sakura, TileType.skewer],
        [TileType.mask, TileType.lantern, TileType.skewer, TileType.dango, TileType.skewer, TileType.lantern, TileType.mask, TileType.dango],
        [TileType.sakura, TileType.skewer, TileType.mask, TileType.lantern, TileType.mask, TileType.skewer, TileType.dango, TileType.lantern],
        [TileType.lantern, TileType.dango, TileType.lantern, TileType.skewer, TileType.dango, TileType.mask, TileType.sakura, TileType.mask],
        [TileType.skewer, TileType.mask, TileType.dango, TileType.lantern, TileType.sakura, TileType.dango, TileType.mask, TileType.lantern],
      ]);

      final groupsH = MatchFinder.findMatchGroups(boardH);
      expect(groupsH.length, 1);
      expect(groupsH[0].shapeKind, MatchShapeKind.line4);
      expect(groupsH[0].specialKind, SpecialKind.slashRow);

      final spawnPosH = groupsH[0].findSpawnCell(const GridPos(0, 2));
      expect(spawnPosH, const GridPos(0, 2));
    });

    test('Match 5 creates Spirit Orb (no color)', () {
      final board5 = Board.fromRows([
        [TileType.sakura, TileType.sakura, TileType.sakura, TileType.sakura, TileType.sakura, TileType.skewer, TileType.mask, TileType.dango],
        [TileType.dango, TileType.skewer, TileType.mask, TileType.lantern, TileType.sakura, TileType.lantern, TileType.skewer, TileType.mask],
        [TileType.lantern, TileType.mask, TileType.dango, TileType.skewer, TileType.dango, TileType.mask, TileType.lantern, TileType.sakura],
        [TileType.skewer, TileType.dango, TileType.lantern, TileType.mask, TileType.lantern, TileType.dango, TileType.sakura, TileType.skewer],
        [TileType.mask, TileType.lantern, TileType.skewer, TileType.dango, TileType.skewer, TileType.lantern, TileType.mask, TileType.dango],
        [TileType.sakura, TileType.skewer, TileType.mask, TileType.lantern, TileType.mask, TileType.skewer, TileType.dango, TileType.lantern],
        [TileType.lantern, TileType.dango, TileType.lantern, TileType.skewer, TileType.dango, TileType.mask, TileType.sakura, TileType.mask],
        [TileType.skewer, TileType.mask, TileType.dango, TileType.lantern, TileType.sakura, TileType.dango, TileType.mask, TileType.lantern],
      ]);

      final groups = MatchFinder.findMatchGroups(board5);
      expect(groups.length, 1);
      expect(groups[0].shapeKind, MatchShapeKind.line5);
      expect(groups[0].specialKind, SpecialKind.orb);
    });

    test('Blast areas: Slash Row, Slash Column, Burst, Double Orb', () {
      final board = Board.generate();

      final blastRow = Board.computeSpecialBlast(
        board: board,
        cell: const GridPos(3, 4),
        kind: SpecialKind.slashRow,
      );
      expect(blastRow.length, 8);

      final blastCol = Board.computeSpecialBlast(
        board: board,
        cell: const GridPos(2, 5),
        kind: SpecialKind.slashColumn,
      );
      expect(blastCol.length, 8);

      final blastBurst = Board.computeSpecialBlast(
        board: board,
        cell: const GridPos(4, 4),
        kind: SpecialKind.burst,
      );
      expect(blastBurst.length, 9);

      final blastDoubleOrb = Board.computeSpecialBlast(
        board: board,
        cell: const GridPos(3, 3),
        kind: SpecialKind.orb,
        combo: SpecialComboKind.orbOrb,
      );
      expect(blastDoubleOrb.length, 64);
    });

    test('Collect Goals ignore Spirit Orbs (colorless)', () {
      const level = LevelConfig(
        number: 1,
        moves: 20,
        mode: LevelMode.collect,
        star1: 3000,
        star2: 6000,
        star3: 9000,
        collectGoals: {'sakura': 10},
      );
      final state = GameState(level);

      expect(state.collectProgress['sakura'], 0);

      state.applyResolveSteps([
        const ResolveStep(
          cleared: [GridPos(0, 0), GridPos(0, 1), GridPos(0, 2), GridPos(0, 3)],
          clearedKeys: {'0,0', '0,1', '0,2', '0,3'},
          clearedByType: {TileType.sakura: 3}, // Orb contributes 0 to colors
          matchRuns: [],
          matchGroups: [],
          createdSpecials: [],
          waves: [],
          falls: [],
          refills: [],
          stepBonusScore: 300,
        ),
      ]);

      expect(state.collectProgress['sakura'], 3);
    });

    test('Shuffle preserves all specials', () {
      final board = Board.generate();
      board.setAt(const GridPos(0, 1), const Tile(type: TileType.lantern, special: SpecialKind.slashRow));
      board.setAt(const GridPos(2, 3), const Tile(type: TileType.dango, special: SpecialKind.burst));
      board.setAt(const GridPos(5, 5), const Tile.orb());

      int countSpecials(Board b) {
        var count = 0;
        for (var r = 0; r < b.size; r++) {
          for (var c = 0; c < b.size; c++) {
            if (b.tileAt(r, c)?.isSpecial == true) count++;
          }
        }
        return count;
      }

      expect(countSpecials(board), 3);
      Board.shuffleBoard(board);
      expect(countSpecials(board), 3);
    });
  });
}
