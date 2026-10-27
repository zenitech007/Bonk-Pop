import test from 'node:test';
import assert from 'node:assert/strict';
import { GameConstants, kGameTitle, kTileIconRatio } from '../core/constants';
import {
  LayoutInsets,
  LayoutMode,
  LayoutRect,
  ScreenLayout,
  ScreenSize,
  SizeClass,
  ZERO_INSETS,
} from '../core/layout/screen_layout';
import { SakuraFestivalTheme } from '../core/theme/sakura_festival_theme';
import {
  InMemoryProgressRepository,
  ProgressNotifier,
} from '../data/progress_repository';
import { LevelMode } from './level_config';
import { LevelGenerator } from './level_generator';
import { Levels } from './levels';
import { GameProgress, LevelNodeState } from './progress';

test('Game Title and Part 0 constants match Step 4 specification', () => {
  assert.equal(kGameTitle, 'Bonk Pop');
  assert.equal(GameConstants.kGameTitle, 'Bonk Pop');
  assert.equal(kTileIconRatio, 0.75);
  assert.equal(GameConstants.tileIconRatio, 0.75);
});

test('ScreenLayout.compute validates all 11 screen sizes in both orientations with and without safe insets', () => {
  const baseSizes: ScreenSize[] = [
    { width: 320, height: 480 },
    { width: 360, height: 640 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 1366 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  const insetCases: LayoutInsets[] = [
    ZERO_INSETS,
    { left: 0, top: 24, right: 0, bottom: 20 },
    { left: 20, top: 12, right: 20, bottom: 12 },
  ];

  for (const base of baseSizes) {
    const orientations: ScreenSize[] = [
      base,
      { width: base.height, height: base.width },
    ];

    for (const screen of orientations) {
      for (const insets of insetCases) {
        const spec = ScreenLayout.compute(screen, insets);
        const label = `${screen.width}x${screen.height} insets(${insets.left},${insets.top},${insets.right},${insets.bottom})`;

        const safeRect = new LayoutRect(
          insets.left,
          insets.top,
          screen.width - insets.left - insets.right,
          screen.height - insets.top - insets.bottom
        );

        // 1. Board is square
        assert.ok(
          Math.abs(spec.board.width - spec.board.height) < 0.01,
          `Board must be square for ${label}`
        );

        // 2. tileSize >= 34 and board.width <= 720
        assert.ok(
          spec.tileSize >= GameConstants.minTileSize,
          `tileSize (${spec.tileSize}) must be >= 34 for ${label}`
        );
        assert.ok(
          spec.board.width <= GameConstants.maxBoardSide,
          `board.width (${spec.board.width}) must be <= 720 for ${label}`
        );

        // 3. Mode is portrait when safeH >= safeW * 0.95, landscape otherwise
        const expectedMode =
          safeRect.height >= safeRect.width * 0.95
            ? LayoutMode.portrait
            : LayoutMode.landscape;
        assert.equal(spec.mode, expectedMode, `Mode mismatch for ${label}`);

        // 4. SizeClass matches shortSide thresholds (<600 compact, 600..900 medium, >900 expanded)
        const shortSide = Math.min(safeRect.width, safeRect.height);
        const expectedSizeClass =
          shortSide < 600
            ? SizeClass.compact
            : shortSide <= 900
            ? SizeClass.medium
            : SizeClass.expanded;
        assert.equal(
          spec.sizeClass,
          expectedSizeClass,
          `SizeClass mismatch for ${label}`
        );

        // 5. All rects lie inside safe area and no two rects overlap
        assert.ok(
          spec.board.isInside(safeRect),
          `Board rect outside safe area for ${label}`
        );

        if (spec.mode === LayoutMode.portrait) {
          assert.ok(
            spec.hud.isInside(safeRect),
            `HUD rect outside safe area for ${label}`
          );
          assert.ok(
            spec.bottomBar.isInside(safeRect),
            `BottomBar rect outside safe area for ${label}`
          );
          assert.ok(
            !spec.hud.overlaps(spec.board),
            `HUD and Board overlap for ${label}`
          );
          assert.ok(
            !spec.board.overlaps(spec.bottomBar),
            `Board and BottomBar overlap for ${label}`
          );
          assert.ok(
            !spec.hud.overlaps(spec.bottomBar),
            `HUD and BottomBar overlap for ${label}`
          );
        } else {
          assert.ok(
            !spec.leftPanel.isEmpty,
            `leftPanel must exist in landscape for ${label}`
          );
          assert.ok(
            spec.leftPanel.isInside(safeRect),
            `leftPanel outside safe area for ${label}`
          );
          assert.ok(
            !spec.leftPanel.overlaps(spec.board),
            `leftPanel and Board overlap for ${label}`
          );
          if (!spec.rightPanel.isEmpty) {
            assert.ok(
              spec.rightPanel.isInside(safeRect),
              `rightPanel outside safe area for ${label}`
            );
            assert.ok(
              !spec.rightPanel.overlaps(spec.board),
              `rightPanel and Board overlap for ${label}`
            );
            assert.ok(
              !spec.leftPanel.overlaps(spec.rightPanel),
              `leftPanel and rightPanel overlap for ${label}`
            );
          }
        }
      }
    }
  }
});

test('ScreenLayout.compute supports 4:3, 16:10, 16:9, 21:9, and 9:21 aspect ratios, right-panel merge, dialog clamping, and textScale 1.0..1.3', () => {
  const aspectRatios: ScreenSize[] = [
    { width: 1024, height: 768 }, // 4:3
    { width: 1440, height: 900 }, // 16:10
    { width: 1920, height: 1080 }, // 16:9
    { width: 2520, height: 1080 }, // 21:9 ultrawide
    { width: 420, height: 980 }, // 9:21 tall mobile
  ];

  for (const size of aspectRatios) {
    const spec = ScreenLayout.compute(size, ZERO_INSETS);
    assert.ok(Math.abs(spec.board.width - spec.board.height) < 0.01);
    assert.ok(spec.tileSize >= 34);
    assert.ok(spec.uiScale >= 0.8 && spec.uiScale <= 1.8);
    assert.ok(spec.dialogMaxWidth >= 280 && spec.dialogMaxWidth <= 520);
  }

  // On 320x480, tileSize >= 34 and dialogMaxWidth = 280
  const smallSpec = ScreenLayout.compute({ width: 320, height: 480 }, ZERO_INSETS);
  assert.ok(smallSpec.tileSize >= 34);
  assert.equal(smallSpec.dialogMaxWidth, 280);

  // Narrow landscape where free space beside board < 140 * uiScale merges right panel into left panel
  const narrowLandscape = ScreenLayout.compute({ width: 480, height: 320 }, ZERO_INSETS);
  assert.equal(narrowLandscape.mode, LayoutMode.landscape);
  assert.equal(narrowLandscape.mergeRightIntoLeftPanel, true);
  assert.equal(narrowLandscape.rightPanel.isEmpty, true);

  // Wide landscape keeps rightPanel separate
  const wideLandscape = ScreenLayout.compute({ width: 1280, height: 800 }, ZERO_INSETS);
  assert.equal(wideLandscape.mode, LayoutMode.landscape);
  assert.equal(wideLandscape.mergeRightIntoLeftPanel, false);
  assert.equal(wideLandscape.rightPanel.isEmpty, false);

  // Text scale clamps to 1.0..1.3
  assert.equal(
    ScreenLayout.compute({ width: 390, height: 844 }, ZERO_INSETS, 0.75).textScale,
    1.0
  );
  assert.equal(
    ScreenLayout.compute({ width: 390, height: 844 }, ZERO_INSETS, 1.15).textScale,
    1.15
  );
  assert.equal(
    ScreenLayout.compute({ width: 390, height: 844 }, ZERO_INSETS, 1.85).textScale,
    1.3
  );
});

test('LevelGenerator generates Levels 1..30 deterministically with valid constraints', () => {
  const validTileIds = new Set<string>(
    SakuraFestivalTheme.instance.tileStyles.map((t) => t.id)
  );

  // Levels 1..3 match Step 3 exactly
  const l1 = LevelGenerator.getLevel(1);
  assert.equal(l1.mode, LevelMode.score);
  assert.equal(l1.moves, 20);
  assert.equal(l1.star1, 3000);
  assert.equal(l1.star2, 6000);
  assert.equal(l1.star3, 9000);

  const l2 = LevelGenerator.getLevel(2);
  assert.equal(l2.mode, LevelMode.collect);
  assert.equal(l2.moves, 25);

  const l3 = LevelGenerator.getLevel(3);
  assert.equal(l3.mode, LevelMode.collect);
  assert.equal(l3.moves, 22);

  for (let n = 1; n <= 30; n++) {
    const a = LevelGenerator.getLevel(n);
    const b = LevelGenerator.getLevel(n);

    assert.equal(a.number, n);
    assert.ok(
      a.moves >= 14 && a.moves <= 30,
      `Level ${n} moves (${a.moves}) out of 14..30`
    );
    assert.ok(
      a.star1 < a.star2 && a.star2 < a.star3,
      `Level ${n} stars not strictly increasing`
    );
    assert.deepEqual(a, b, `Level ${n} must be deterministic`);

    if (a.mode === LevelMode.collect) {
      const entries = Object.entries(a.collectGoals);
      assert.ok(
        entries.length >= 1 && entries.length <= 2,
        `Level ${n} collect goals count should be 1 or 2`
      );
      for (const [tileId, target] of entries) {
        assert.ok(
          validTileIds.has(tileId),
          `Level ${n} uses invalid tile ID: ${tileId}`
        );
        assert.ok(target >= 12 && target <= 40);
      }
    }
  }

  assert.equal(Levels.all.length, 30);
  assert.equal(Levels.nextAfter(30), null);
  assert.equal(Levels.nextAfter(1)?.number, 2);
});

test('GameProgress tracks wins, stars, best scores, caps at 30, and computes map node states', () => {
  let progress = GameProgress.initial();
  assert.equal(progress.highestUnlocked, 1);
  assert.equal(progress.totalStars, 0);
  assert.equal(progress.nodeStateFor(1), LevelNodeState.current);
  assert.equal(progress.nodeStateFor(2), LevelNodeState.locked);
  assert.equal(progress.nodeStateFor(30), LevelNodeState.locked);

  // Win level 1 with 2 stars and 6400 score
  progress = progress.recordWin({ levelNumber: 1, stars: 2, score: 6400 });
  assert.equal(progress.highestUnlocked, 2);
  assert.equal(progress.bestStarsFor(1), 2);
  assert.equal(progress.bestScoreFor(1), 6400);
  assert.equal(progress.totalStars, 2);
  assert.equal(progress.nodeStateFor(1), LevelNodeState.completed);
  assert.equal(progress.nodeStateFor(2), LevelNodeState.current);
  assert.equal(progress.nodeStateFor(3), LevelNodeState.locked);

  // Replaying level 1 with 1 star and lower score keeps 2 stars and 6400
  progress = progress.recordWin({ levelNumber: 1, stars: 1, score: 3500 });
  assert.equal(progress.bestStarsFor(1), 2);
  assert.equal(progress.bestScoreFor(1), 6400);
  assert.equal(progress.totalStars, 2);

  // Replaying level 1 with 3 stars updates to 3 stars and higher score
  progress = progress.recordWin({ levelNumber: 1, stars: 3, score: 9800 });
  assert.equal(progress.bestStarsFor(1), 3);
  assert.equal(progress.bestScoreFor(1), 9800);
  assert.equal(progress.totalStars, 3);

  // Losing a level does not change progress
  progress = progress.recordLoss({ levelNumber: 2, score: 1200 });
  assert.equal(progress.highestUnlocked, 2);
  assert.equal(progress.totalStars, 3);

  // Winning level 30 does not unlock level 31
  const at30 = progress
    .withAllLevelsUnlocked()
    .recordWin({ levelNumber: 30, stars: 3, score: 25000 });
  assert.equal(at30.highestUnlocked, 30);
  assert.equal(at30.bestStarsFor(30), 3);
  assert.equal(at30.nodeStateFor(30), LevelNodeState.completed);
});

test('ProgressRepository round-trip, missing data, corrupted JSON, and reset', () => {
  const memRepo = new InMemoryProgressRepository();
  const initial = memRepo.load();
  assert.equal(initial.highestUnlocked, 1);
  assert.equal(initial.totalStars, 0);

  const saved = initial
    .recordWin({ levelNumber: 1, stars: 3, score: 9100 })
    .recordWin({ levelNumber: 2, stars: 2, score: 7300 });
  memRepo.save(saved);

  const loaded = memRepo.load();
  assert.equal(loaded.highestUnlocked, 3);
  assert.equal(loaded.bestStarsFor(1), 3);
  assert.equal(loaded.bestStarsFor(2), 2);
  assert.equal(loaded.bestScoreFor(1), 9100);
  assert.equal(loaded.totalStars, 5);

  // Corrupted JSON falls back cleanly without throwing
  memRepo.setRawJsonForTest('{not_valid_json!!!');
  const recovered = memRepo.load();
  assert.equal(recovered.highestUnlocked, 1);
  assert.equal(recovered.totalStars, 0);

  // Reset returns to initial progress
  memRepo.save(saved);
  memRepo.reset();
  const afterReset = memRepo.load();
  assert.equal(afterReset.highestUnlocked, 1);
  assert.equal(afterReset.totalStars, 0);

  // ProgressNotifier notifies listeners and persists changes
  const notifier = new ProgressNotifier(memRepo);
  notifier.recordWin({ levelNumber: 1, stars: 2, score: 6200 });
  assert.equal(notifier.progress.highestUnlocked, 2);
  assert.equal(notifier.progress.totalStars, 2);

  notifier.unlockAllLevels();
  assert.equal(notifier.progress.highestUnlocked, 30);

  notifier.resetProgress();
  assert.equal(notifier.progress.highestUnlocked, 1);
  assert.equal(notifier.progress.totalStars, 0);
});
