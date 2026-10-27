import 'package:flutter_test/flutter_test.dart';
import 'package:prism_relic/core/constants.dart';
import 'package:prism_relic/core/layout/screen_layout.dart';
import 'package:prism_relic/core/theme/sakura_festival_theme.dart';
import 'package:prism_relic/data/progress_repository.dart';
import 'package:prism_relic/logic/level_config.dart';
import 'package:prism_relic/logic/level_generator.dart';
import 'package:prism_relic/logic/progress.dart';

bool _rectsOverlap(LayoutRect a, LayoutRect b) {
  const eps = 0.01;
  return a.left < b.right - eps &&
      a.right > b.left + eps &&
      a.top < b.bottom - eps &&
      a.bottom > b.top + eps;
}

bool _rectInsideSafeArea(LayoutRect r, LayoutSize screen, LayoutInsets insets) {
  const eps = 0.5;
  final safeLeft = insets.left - eps;
  final safeTop = insets.top - eps;
  final safeRight = screen.width - insets.right + eps;
  final safeBottom = screen.height - insets.bottom + eps;
  return r.left >= safeLeft &&
      r.top >= safeTop &&
      r.right <= safeRight &&
      r.bottom <= safeBottom;
}

void main() {
  group('Game Title & Constants', () {
    test('kGameTitle is Bonk Pop and kTileIconRatio is 0.75', () {
      expect(kGameTitle, equals('Bonk Pop'));
      expect(GameConstants.kTileIconRatio, closeTo(0.75, 0.001));
    });
  });

  group('ScreenLayout.compute across 11 screen sizes & orientations', () {
    const baseSizes = <LayoutSize>[
      LayoutSize(320, 480),
      LayoutSize(360, 640),
      LayoutSize(375, 667),
      LayoutSize(390, 844),
      LayoutSize(412, 915),
      LayoutSize(768, 1024),
      LayoutSize(820, 1180),
      LayoutSize(1024, 1366),
      LayoutSize(1280, 800),
      LayoutSize(1440, 900),
      LayoutSize(1920, 1080),
    ];

    test('validates portrait and landscape geometry with and without safe insets', () {
      for (final base in baseSizes) {
        final orientations = <LayoutSize>[
          base,
          LayoutSize(base.height, base.width),
        ];
        final insetCases = <LayoutInsets>[
          LayoutInsets.zero,
          const LayoutInsets.fromLTRB(0, 24, 0, 20),
        ];

        for (final size in orientations) {
          for (final insets in insetCases) {
            final spec = ScreenLayout.compute(size, insets);

            // Board is square and tileSize >= 34
            expect((spec.board.width - spec.board.height).abs(), lessThan(0.01));
            expect(spec.tileSize, greaterThanOrEqualTo(GameConstants.kMinTileSize));
            expect(spec.board.width, lessThanOrEqualTo(GameConstants.kMaxBoardSize));

            // Mode check
            final safeW = size.width - insets.horizontal;
            final safeH = size.height - insets.vertical;
            final expectedMode = safeH >= safeW * 0.95
                ? LayoutMode.portrait
                : LayoutMode.landscape;
            expect(spec.mode, equals(expectedMode));

            // SizeClass check
            final shortSide = safeW < safeH ? safeW : safeH;
            final expectedClass = shortSide < 600
                ? SizeClass.compact
                : shortSide <= 900
                    ? SizeClass.medium
                    : SizeClass.expanded;
            expect(spec.sizeClass, equals(expectedClass));

            // Every rect inside safe area & no overlaps
            expect(_rectInsideSafeArea(spec.board, size, insets), isTrue);
            if (spec.mode == LayoutMode.portrait) {
              expect(_rectInsideSafeArea(spec.hud, size, insets), isTrue);
              expect(_rectInsideSafeArea(spec.bottomBar, size, insets), isTrue);
              expect(_rectsOverlap(spec.hud, spec.board), isFalse);
              expect(_rectsOverlap(spec.board, spec.bottomBar), isFalse);
              expect(_rectsOverlap(spec.hud, spec.bottomBar), isFalse);
            } else {
              expect(spec.leftPanel, isNotNull);
              expect(_rectInsideSafeArea(spec.leftPanel!, size, insets), isTrue);
              expect(_rectsOverlap(spec.leftPanel!, spec.board), isFalse);
              if (spec.rightPanel != null) {
                expect(
                  _rectInsideSafeArea(spec.rightPanel!, size, insets),
                  isTrue,
                );
                expect(_rectsOverlap(spec.rightPanel!, spec.board), isFalse);
                expect(
                  _rectsOverlap(spec.leftPanel!, spec.rightPanel!),
                  isFalse,
                );
              }
            }
          }
        }
      }
    });
  });

  group('LevelGenerator (Levels 1..30)', () {
    final validTileIds = SakuraFestivalTheme()
        .tiles
        .map((t) => t.id)
        .toSet();

    test('levels 1..30 have valid moves, stars, tile IDs, and are deterministic', () {
      for (int n = 1; n <= 30; n++) {
        final a = LevelGenerator.getLevel(n);
        final b = LevelGenerator.getLevel(n);

        expect(a.number, equals(n));
        expect(a.moves, inInclusiveRange(18, 30));
        expect(a.star1, lessThan(a.star2));
        expect(a.star2, lessThan(a.star3));
        expect(a.mode, equals(b.mode));
        expect(a.moves, equals(b.moves));
        expect(a.star1, equals(b.star1));
        expect(a.star2, equals(b.star2));
        expect(a.star3, equals(b.star3));
        expect(a.collectGoals, equals(b.collectGoals));

        if (a.mode == LevelMode.collect) {
          expect(a.collectGoals, isNotEmpty);
          for (final entry in a.collectGoals.entries) {
            expect(validTileIds.contains(entry.key), isTrue);
            expect(entry.value, greaterThan(0));
          }
        }
      }
    });
  });

  group('GameProgress & ProgressRepository', () {
    test('tracks wins, stars, best scores, caps at level 30, and computes node states', () {
      var p = GameProgress.initial();
      expect(p.highestUnlockedLevel, equals(1));
      expect(p.totalStars, equals(0));
      expect(p.nodeStateFor(1), equals(MapNodeState.current));
      expect(p.nodeStateFor(2), equals(MapNodeState.locked));

      // Win level 1 with 2 stars
      p = p.recordWin(1, 2, 6500);
      expect(p.highestUnlockedLevel, equals(2));
      expect(p.starsFor(1), equals(2));
      expect(p.bestScoreFor(1), equals(6500));
      expect(p.totalStars, equals(2));
      expect(p.nodeStateFor(1), equals(MapNodeState.completed));
      expect(p.nodeStateFor(2), equals(MapNodeState.current));
      expect(p.nodeStateFor(3), equals(MapNodeState.locked));

      // Replay level 1 with 1 star and lower score -> keeps 2 stars and 6500
      p = p.recordWin(1, 1, 4200);
      expect(p.starsFor(1), equals(2));
      expect(p.bestScoreFor(1), equals(6500));
      expect(p.totalStars, equals(2));

      // Replay level 1 with 3 stars -> updates to 3 stars
      p = p.recordWin(1, 3, 9500);
      expect(p.starsFor(1), equals(3));
      expect(p.bestScoreFor(1), equals(9500));
      expect(p.totalStars, equals(3));

      // Winning level 30 does not unlock 31
      final unlocked30 = p.unlockAll(30).recordWin(30, 3, 25000);
      expect(unlocked30.highestUnlockedLevel, equals(30));
      expect(unlocked30.starsFor(30), equals(3));
      expect(unlocked30.nodeStateFor(30), equals(MapNodeState.completed));
    });

    test('InMemoryProgressRepository round-trip, corrupted JSON, and reset', () async {
      final repo = InMemoryProgressRepository();
      final initial = await repo.load();
      expect(initial.highestUnlockedLevel, equals(1));
      expect(initial.totalStars, equals(0));

      final updated = initial.recordWin(1, 3, 9200).recordWin(2, 2, 7400);
      await repo.save(updated);

      final loaded = await repo.load();
      expect(loaded.highestUnlockedLevel, equals(3));
      expect(loaded.starsFor(1), equals(3));
      expect(loaded.starsFor(2), equals(2));
      expect(loaded.bestScoreFor(1), equals(9200));
      expect(loaded.totalStars, equals(5));

      // Corrupted JSON falls back cleanly
      repo.setRawJsonForTesting('{corrupted_json!!!');
      final recovered = await repo.load();
      expect(recovered.highestUnlockedLevel, equals(1));
      expect(recovered.totalStars, equals(0));

      // Reset returns to initial
      await repo.save(updated);
      await repo.reset();
      final afterReset = await repo.load();
      expect(afterReset.highestUnlockedLevel, equals(1));
      expect(afterReset.totalStars, equals(0));
    });
  });
}
