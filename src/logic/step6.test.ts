import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
   audioService,
  CASCADE_PENTATONIC_TONES,
  getCascadeChimeTone,
} from '../core/audio_service';
import { GameConstants } from '../core/constants';
import {
  InMemoryProgressRepository,
  ProgressNotifier,
} from '../data/progress_repository';
import { Board, GridPos, ResolveStep, SpecialComboKind } from './board';
import {
  calculateMoveSpiritCoins,
  calculateSpiritChargeGain,
  GameState,
  GameStatus,
  getCascadeComboCallout,
} from './game_state';
import { GlowPatternKind, GlowPatterns } from './glow_patterns';
import { LevelConfig, LevelMode } from './level_config';
import { LevelGenerator } from './level_generator';
import { Levels } from './levels';
import { MatchDirection, MatchFinder, MatchRun } from './match_finder';
import { GameProgress } from './progress';
import { SettingsNotifier, SettingsRepository } from './settings';
import { SpecialKind, Tile, TileType } from './tile_type';

function makeClearedStep(
  coords: ReadonlyArray<readonly [number, number]>,
  byType?: Partial<Record<TileType, number>>
): ResolveStep {
  const cleared = coords.map(([r, c]) => new GridPos(r, c));
  const clearedKeys = new Set(cleared.map((p) => p.key));
  const matchRuns: MatchRun[] =
    cleared.length >= 3
      ? [
          {
            type: TileType.sakura,
            cells: cleared.slice(0, 3),
            length: 3,
            direction: MatchDirection.horizontal,
          },
        ]
      : [];
  return {
    cleared,
    clearedKeys,
    clearedByType: byType ?? { [TileType.sakura]: cleared.length },
    matchRuns,
    matchGroups: [],
    createdSpecials: [],
    waves: [],
    falls: [],
    refills: [],
    stepBonusScore: 0,
  };
}

test('Burst, Slash, and Orb spawn rules: Burst at intersection; Slash/Orb at swapped cell if in group, otherwise middle cell', () => {
  // 1. Line of 4 horizontal at row 0, cols 1..4
  const board4 = Board.fromRows([
    ['dango', 'sakura', 'sakura', 'sakura', 'sakura', 'lantern', 'skewer', 'mask'],
    ['lantern', 'skewer', 'mask', 'lantern', 'dango', 'lantern', 'skewer', 'mask'],
    ['skewer', 'mask', 'dango', 'skewer', 'lantern', 'mask', 'lantern', 'sakura'],
    ['mask', 'dango', 'lantern', 'mask', 'skewer', 'dango', 'sakura', 'skewer'],
    ['sakura', 'lantern', 'skewer', 'dango', 'mask', 'lantern', 'mask', 'dango'],
    ['lantern', 'skewer', 'mask', 'lantern', 'sakura', 'skewer', 'dango', 'lantern'],
    ['skewer', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['dango', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);
  const groups4 = MatchFinder.findMatchGroups(board4);
  assert.equal(groups4.length, 1);
  assert.equal(groups4[0].specialKind, SpecialKind.slashRow);
  // Swapped cell in group -> spawns at swapped cell
  assert.deepEqual(
    groups4[0].findSpawnCell(new GridPos(0, 3), new GridPos(1, 3)),
    new GridPos(0, 3)
  );
  // Origin cell in group -> spawns at origin cell
  assert.deepEqual(
    groups4[0].findSpawnCell(new GridPos(3, 3), new GridPos(0, 4)),
    new GridPos(0, 4)
  );
  // Cascade (neither in group) -> spawns at middle cell (index floor(4/2) = 2 -> (0, 3))
  assert.deepEqual(groups4[0].findSpawnCell(null, null), new GridPos(0, 3));

  // 2. L-shape intersection at (2, 1): Burst always spawns at intersection even if player moved another cell
  const boardL = Board.fromRows([
    ['dango', 'sakura', 'lantern', 'skewer', 'mask', 'lantern', 'skewer', 'mask'],
    ['lantern', 'sakura', 'mask', 'lantern', 'dango', 'lantern', 'skewer', 'mask'],
    ['skewer', 'sakura', 'sakura', 'sakura', 'lantern', 'mask', 'lantern', 'sakura'],
    ['mask', 'dango', 'lantern', 'mask', 'skewer', 'dango', 'sakura', 'skewer'],
    ['sakura', 'lantern', 'skewer', 'dango', 'mask', 'lantern', 'mask', 'dango'],
    ['lantern', 'skewer', 'mask', 'lantern', 'sakura', 'skewer', 'dango', 'lantern'],
    ['skewer', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['dango', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);
  const groupsL = MatchFinder.findMatchGroups(boardL);
  assert.equal(groupsL.length, 1);
  assert.equal(groupsL[0].specialKind, SpecialKind.burst);
  assert.deepEqual(
    groupsL[0].findSpawnCell(new GridPos(2, 3), new GridPos(3, 3)),
    new GridPos(2, 1)
  );
});

test('Special + Special combos: Slash+Slash cross, Slash+Burst 3x3 lines, Orb+Normal color clear, Orb+Slash/Burst conversion', () => {
  const board = Board.generate();

  // Slash + Slash clears full row + full column (15 unique cells)
  const slashCross = Board.computeSpecialBlast({
    board,
    cell: new GridPos(3, 4),
    kind: SpecialKind.slashRow,
    combo: SpecialComboKind.slashSlash,
  });
  assert.equal(slashCross.length, 15);

  // Slash + Burst clears 3 rows and 3 columns centred on cell (3*8 + 3*8 - 9 = 39 unique cells)
  const slashBurst = Board.computeSpecialBlast({
    board,
    cell: new GridPos(3, 4),
    kind: SpecialKind.burst,
    combo: SpecialComboKind.slashBurst,
  });
  assert.equal(slashBurst.length, 39);

  // Starting board never spawns a special tile
  for (let i = 0; i < 30; i++) {
    const b = Board.generate();
    for (let r = 0; r < b.size; r++) {
      for (let c = 0; c < b.size; c++) {
        assert.equal(b.tileAt(r, c)?.isSpecial, false);
      }
    }
  }
});

test('Glow: one layer removed per cleared glowing cell; 2-layer cell needs two steps; at most 1 layer per cell per step; +100 bonus per layer; never below 0', () => {
  const config: LevelConfig = {
    number: 4,
    moves: 10,
    mode: LevelMode.glow,
    star1: 1000,
    star2: 2000,
    star3: 3000,
    collectGoals: {},
    glowCells: [
      [0, 0, 1],
      [0, 1, 2],
      [0, 2, 1],
    ],
  };

  const state = new GameState(config);
  assert.equal(state.initialGlowLayers, 4);
  assert.equal(state.glowLayersRemaining, 4);
  assert.equal(state.glowLayersAt(0, 0), 1);
  assert.equal(state.glowLayersAt(0, 1), 2);
  assert.equal(state.glowLayersAt(0, 2), 1);

  // Step 1: Clear (0,0), (0,1), (0,2), with duplicate (0,1) in `cleared` array to verify at most 1 layer removed per cell per step
  const stepWithDuplicate = makeClearedStep([
    [0, 0],
    [0, 1],
    [0, 1],
    [0, 2],
  ]);
  const scores1 = state.applyResolveSteps([stepWithDuplicate]);

  // (0,0) -> 0, (0,1) -> 1 (lost only 1 layer despite duplicate), (0,2) -> 0
  assert.equal(state.glowLayersAt(0, 0), 0);
  assert.equal(state.glowLayersAt(0, 1), 1);
  assert.equal(state.glowLayersAt(0, 2), 0);
  assert.equal(state.glowLayersRemaining, 1);
  assert.equal(state.lastStepGlowRemovals[0].length, 3);

  // Score includes 3 removed glow layers * 100 = +300 on top of tile points
  const baseTileScore = 4 * GameConstants.basePointsPerTile;
  assert.equal(
    scores1[0],
    baseTileScore + 3 * GameConstants.glowLayerClearedBonus
  );

  // Step 2: Clear (0,0) and (0,1) again -> (0,0) stays at 0 (never negative), (0,1) goes from 1 -> 0
  state.applyResolveSteps([
    makeClearedStep([
      [0, 0],
      [0, 1],
      [0, 3],
    ]),
  ]);
  assert.equal(state.glowLayersAt(0, 0), 0);
  assert.equal(state.glowLayersAt(0, 1), 0);
  assert.equal(state.glowLayersRemaining, 0);
  assert.equal(state.areAllGlowGoalsMet, true);
});

test('Glow: blasts (slash, burst, orb, orb+orb) remove layers under every cleared cell', () => {
  const board = Board.fromRows([
    ['dango', 'skewer', 'mask', 'lantern', 'sakura', 'lantern', 'skewer', 'mask'],
    ['lantern', 'skewer', 'mask', 'lantern', 'dango', 'lantern', 'skewer', 'mask'],
    ['skewer', 'mask', 'dango', 'skewer', 'lantern', 'mask', 'lantern', 'sakura'],
    ['mask', 'dango', 'lantern', 'mask', 'skewer', 'dango', 'sakura', 'skewer'],
    ['sakura', 'lantern', 'skewer', 'dango', 'mask', 'lantern', 'mask', 'dango'],
    ['lantern', 'skewer', 'mask', 'lantern', 'sakura', 'skewer', 'dango', 'lantern'],
    ['skewer', 'dango', 'lantern', 'skewer', 'dango', 'mask', 'sakura', 'mask'],
    ['dango', 'mask', 'dango', 'lantern', 'sakura', 'dango', 'mask', 'lantern'],
  ]);

  // Place two Spirit Orbs at (3, 3) and (3, 4) and swap them for an Orb+Orb full-board blast
  board.setAt(new GridPos(3, 3), Tile.orb());
  board.setAt(new GridPos(3, 4), Tile.orb());

  const glowCells = GlowPatterns.border(2); // 28 border cells, including 2-layer cells
  const config: LevelConfig = {
    number: 12,
    moves: 15,
    mode: LevelMode.glow,
    star1: 2000,
    star2: 4000,
    star3: 6000,
    collectGoals: {},
    glowCells,
  };

  const state = new GameState(config);
  const initialLayers = state.glowLayersRemaining;
  assert.equal(initialLayers, 30); // 28 cells + 2 extra layers

  const res = Board.resolveBoard(board, {
    playerMovedCell: new GridPos(3, 4),
    playerSwapOriginCell: new GridPos(3, 3),
  });
  assert.ok(res.steps.length >= 1);

  state.applyResolveSteps([res.steps[0]]);
  // First step cleared all 64 cells once, so all 28 glowing border cells lost 1 layer -> only the two 2-layer cells have 1 layer left!
  assert.equal(state.glowLayersRemaining, 2);
});

test('Glow Win and Lose: immediate win with moves left + leftover bonus, last-move win, cascade on last move win, and loss at 0 moves with layers left', () => {
  const baseConfig: LevelConfig = {
    number: 4,
    moves: 5,
    mode: LevelMode.glow,
    star1: 1000,
    star2: 2500,
    star3: 4000,
    collectGoals: {},
    glowCells: [
      [1, 1, 1],
      [1, 2, 1],
    ],
  };

  // 1. Immediate win when last layer is removed with moves left + leftover bonus
  const winEarly = new GameState(baseConfig);
  winEarly.useMove(); // 4 moves left
  winEarly.applyResolveSteps([
    makeClearedStep([
      [1, 1],
      [1, 2],
      [1, 3],
    ]),
  ]);
  winEarly.evaluate();
  assert.equal(winEarly.status, GameStatus.won);
  // 3 tiles * 60 (180) + 2 glow layers * 100 (200) + 4 leftover moves * 500 (2000) = 2380
  assert.equal(
    winEarly.score,
    180 + 2 * GameConstants.glowLayerClearedBonus + 4 * GameConstants.leftoverMoveBonus
  );

  // 2. Last-move win via cascade (layers removed in cascade step 2 after final move are counted before evaluate)
  const cascadeLastMoveConfig: LevelConfig = {
    ...baseConfig,
    moves: 1,
    star1: 300,
    glowCells: [
      [1, 1, 1],
      [2, 2, 1],
    ],
  };
  const winCascade = new GameState(cascadeLastMoveConfig);
  winCascade.useMove(); // 0 moves left
  winCascade.applyResolveSteps([
    makeClearedStep([
      [1, 1],
      [1, 2],
      [1, 3],
    ]), // clears (1,1) in step 1
    makeClearedStep([
      [2, 2],
      [2, 3],
      [2, 4],
    ]), // clears (2,2) in cascade step 2
  ]);
  winCascade.evaluate();
  assert.equal(winCascade.glowLayersRemaining, 0);
  assert.equal(winCascade.status, GameStatus.won);

  // 3. Loss at 0 moves with layers remaining
  const loseState = new GameState(cascadeLastMoveConfig);
  loseState.useMove(); // 0 moves left
  loseState.applyResolveSteps([
    makeClearedStep([
      [1, 1],
      [1, 2],
      [1, 3],
    ]), // only clears (1,1), leaving (2,2) glowing
  ]);
  loseState.evaluate();
  assert.equal(loseState.glowLayersRemaining, 1);
  assert.equal(loseState.status, GameStatus.lost);
  assert.equal(loseState.stars, 0);
});

test('GlowPatterns: all 8 patterns are inside the 8x8 board, cover 12..40 cells, are deterministic, and match twoLayerCount', () => {
  const allKinds: GlowPatternKind[] = [
    'corners',
    'rows',
    'ring',
    'checker',
    'cross',
    'diamond',
    'heart',
    'border',
  ];

  for (const kind of allKinds) {
    for (const twoLayers of [0, 4, 8]) {
      const a = GlowPatterns.build(kind, twoLayers);
      const b = GlowPatterns.build(kind, twoLayers);
      assert.deepEqual(a, b, `Pattern ${kind} must be deterministic`);
      assert.ok(
        a.length >= GameConstants.minGlowCells &&
          a.length <= GameConstants.maxGlowCells,
        `Pattern ${kind} cell count (${a.length}) must be within 12..40`
      );

      const seen = new Set<string>();
      let count2 = 0;
      for (const [r, c, layers] of a) {
        assert.ok(r >= 0 && r < 8 && c >= 0 && c < 8, `Out of bounds cell in ${kind}: ${r},${c}`);
        assert.ok(layers === 1 || layers === 2, `Invalid layer count ${layers}`);
        const key = `${r},${c}`;
        assert.equal(seen.has(key), false, `Duplicate cell ${key} in ${kind}`);
        seen.add(key);
        if (layers === 2) count2++;
      }
      assert.equal(count2, Math.min(twoLayers, a.length));
      assert.equal(GlowPatterns.totalLayers(a), a.length + count2);
    }
  }
});

test('LevelGenerator Step 6: levels 1..3 unchanged, levels 4..30 follow 6-mode cycle, moves in 14..30, and glow layers capped relative to moves', () => {
  // Levels 1..3 unchanged
  const l1 = LevelGenerator.getLevel(1);
  const l2 = LevelGenerator.getLevel(2);
  const l3 = LevelGenerator.getLevel(3);
  assert.equal(l1.mode, LevelMode.score);
  assert.equal(l1.moves, 20);
  assert.equal(l2.mode, LevelMode.collect);
  assert.equal(l2.moves, 25);
  assert.equal(l3.mode, LevelMode.collect);
  assert.equal(l3.moves, 22);

  // Level 4 is the first glow level: 1 layer, 12 cells, generous moves (18)
  const l4 = LevelGenerator.getLevel(4);
  assert.equal(l4.mode, LevelMode.glow);
  assert.ok(l4.glowCells && l4.glowCells.length === 12);
  assert.equal(GlowPatterns.totalLayers(l4.glowCells!), 12);
  assert.ok(l4.glowCells!.every(([, , layers]) => layers === 1));

  const expectedCycle: LevelMode[] = [
    LevelMode.glow,
    LevelMode.score,
    LevelMode.collect,
    LevelMode.glow,
    LevelMode.collect,
    LevelMode.score,
  ];

  for (let n = 4; n <= 30; n++) {
    const lvl = Levels.forNumber(n);
    const expectedMode = expectedCycle[(n - 4) % expectedCycle.length];
    assert.equal(
      lvl.mode,
      expectedMode,
      `Level ${n} mode (${lvl.mode}) did not match cycle (${expectedMode})`
    );
    assert.ok(
      lvl.moves >= GameConstants.minLevelMoves &&
        lvl.moves <= GameConstants.maxLevelMoves
    );

    if (lvl.mode === LevelMode.glow) {
      assert.ok(lvl.glowCells && lvl.glowCells.length >= 12 && lvl.glowCells.length <= 40);
      const totalLayers = GlowPatterns.totalLayers(lvl.glowCells!);
      const maxAllowed = Math.floor(
        lvl.moves * GameConstants.glowMaxLayersPerMoveRatio
      );
      assert.ok(
        totalLayers <= maxAllowed,
        `Level ${n} totalLayers (${totalLayers}) exceeds cap (${maxAllowed}) for ${lvl.moves} moves`
      );
      if (n < GameConstants.glowTwoLayerStartLevel) {
        assert.ok(
          lvl.glowCells!.every(([, , l]) => l === 1),
          `Early glow level ${n} must use 1-layer cells only`
        );
      } else {
        assert.ok(
          lvl.glowCells!.some(([, , l]) => l === 2),
          `Glow level ${n} (>= 12) should include 2-layer cells`
        );
      }
    }
  }
});

test('Saving and Compatibility: old saves (bonk_pop_progress_v1 and bonk_pop_settings_v1) load cleanly and preserve stars/unlocks by level number', () => {
  // 1. Old Step 4/5 progress save with stars on levels 1..6 loads cleanly and maps by level number
  const repo = new InMemoryProgressRepository();
  const legacySaveJson = JSON.stringify({
    highestUnlocked: 7,
    stars: { '1': 3, '2': 2, '3': 3, '4': 2, '5': 1, '6': 3 },
    scores: {
      '1': 9500,
      '2': 8200,
      '3': 9100,
      '4': 14200,
      '5': 12100,
      '6': 16400,
    },
  });
  repo.setRawJsonForTest(legacySaveJson);

  const loadedProgress: GameProgress = repo.load();
  assert.equal(loadedProgress.highestUnlocked, 7);
  assert.equal(loadedProgress.bestStarsFor(1), 3);
  assert.equal(loadedProgress.bestStarsFor(2), 2);
  assert.equal(loadedProgress.bestStarsFor(3), 3);
  assert.equal(loadedProgress.bestStarsFor(4), 2);
  assert.equal(loadedProgress.bestScoreFor(4), 14200);
  assert.equal(loadedProgress.totalStars, 14);

  // 2. Old Step 5 settings save loads cleanly; OS prefers-reduced-motion default applies when not explicitly saved
  const memMap = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => memMap.get(k) ?? null,
    setItem: (k: string, v: string) => memMap.set(k, v),
  };

  // When OS prefers reduced motion = true and no user override exists -> defaults to true
  const repoOsTrue = new SettingsRepository('bonk_pop_settings_v1', mockStorage, () => true);
  const notifierOsTrue = new SettingsNotifier(repoOsTrue);
  assert.equal(notifierOsTrue.settings.reducedMotion, true);
  assert.equal(notifierOsTrue.settings.reducedMotionUserSet, false);

  // When player explicitly toggles switch to false -> persists false even though OS is true
  notifierOsTrue.update({ reducedMotion: false });
  const reloadedNotifier = new SettingsNotifier(repoOsTrue);
  assert.equal(reloadedNotifier.settings.reducedMotion, false);
  assert.equal(reloadedNotifier.settings.reducedMotionUserSet, true);
});

test('SpecialTileThemeStyle redesign: 4 bold opaque white+gold stripes (~45% area), gold-pink gradient, 2px bright border, 1.8s shine sweep, distinct from GlowCell underlay', async () => {
  const { SakuraFestivalTheme } = await import(
    '../core/theme/sakura_festival_theme'
  );
  const theme = SakuraFestivalTheme.instance;
  const sp = theme.specialTile;
  const glow = theme.glowCell;

  // 3-4 bold opaque stripes (white + gold) covering ~45% of piece area
  assert.ok(sp.slashStripeCount >= 3 && sp.slashStripeCount <= 4);
  assert.equal(sp.slashStripeCount, GameConstants.specialStripeCount);
  assert.equal(sp.slashStripeAreaRatio, GameConstants.specialStripeAreaRatio);
  assert.equal(sp.slashStripeWhite, '#FFFFFF');
  assert.equal(sp.slashStripeGold, '#FFD166');

  // Gold-pink gradient background + brighter 2px border
  assert.ok(sp.cardGradientStart.startsWith('#'));
  assert.ok(sp.cardGradientMid.startsWith('#'));
  assert.ok(sp.cardGradientEnd.startsWith('#'));
  assert.ok(sp.cardBorderColor.startsWith('#'));
  assert.equal(GameConstants.specialTileBorderWidthPx, 2);

  // Gentle shine sweep every ~1.8s (1800ms)
  assert.equal(sp.shineSweepDurationMs, 1800);
  assert.equal(
    sp.shineSweepDurationMs,
    GameConstants.specialShineSweepDurationMs
  );

  // Distinct from Glow Squares pulsing underlay
  assert.notEqual(sp.cardGradientStart, glow.layer1Fill);
  assert.notEqual(sp.cardBorderColor, glow.layer1Border);
});

test('Spirit Matsuri Lattice Map: non-linear Tiers 1-5 branching, Shrine Restoration landmarks (6/15/30 stars), and Row Harmony Chests (+100 Spirit Coins)', () => {
  let p = GameProgress.initial();
  assert.equal(p.spiritCoins, GameConstants.initialSpiritCoins);
  assert.equal(p.isLatticeUnlocked(1), true);
  assert.equal(p.isLatticeUnlocked(2), false);
  assert.equal(p.isLatticeUnlocked(3), false);
  assert.equal(p.highestActiveLatticeLevel, 1);

  // Completing Level 1 unlocks BOTH Level 2 (Left branch) and Level 3 (Right branch) in Tier 2
  p = p.recordWin({ levelNumber: 1, stars: 3, score: 8000 });
  assert.equal(p.isLatticeUnlocked(2), true);
  assert.equal(p.isLatticeUnlocked(3), true);
  assert.equal(p.isLatticeUnlocked(4), false);
  assert.equal(p.isLatticeUnlocked(5), false);
  assert.equal(p.isLatticeUnlocked(6), false);

  // Tier 1 has only Level 1 -> Tier 1 Harmony Chest is now claimable!
  assert.equal(p.getTierChestState(1), 'claimable');
  const coinsBeforeChest1 = p.spiritCoins;
  p = p.claimTierChest(1);
  assert.equal(
    p.spiritCoins,
    coinsBeforeChest1 + GameConstants.tierHarmonyChestRewardCoins
  );
  assert.equal(p.getTierChestState(1), 'claimed');
  // Claiming again is idempotent
  p = p.claimTierChest(1);
  assert.equal(
    p.spiritCoins,
    coinsBeforeChest1 + GameConstants.tierHarmonyChestRewardCoins
  );

  // Completing Level 2 unlocks Levels 4 & 5 (but not 6)
  p = p.recordWin({ levelNumber: 2, stars: 3, score: 9000 });
  assert.equal(p.isLatticeUnlocked(4), true);
  assert.equal(p.isLatticeUnlocked(5), true);
  assert.equal(p.isLatticeUnlocked(6), false);

  // Total stars is now 6 -> Shrine Landmark 1 (Crimson Torii Gate at 6 ★) unlocks!
  assert.equal(p.totalStars, 6);
  assert.equal(p.isLandmarkUnlocked(1), true);
  assert.equal(p.isLandmarkUnlocked(2), false);
  assert.equal(p.isLandmarkUnlocked(3), false);

  // Completing Level 3 unlocks Level 6 and makes Tier 2 chest claimable
  p = p.recordWin({ levelNumber: 3, stars: 3, score: 9500 });
  assert.equal(p.isLatticeUnlocked(6), true);
  assert.equal(p.getTierChestState(2), 'claimable');

  // Tier 4 (Levels 7 & 8) requires ANY 2 nodes in Tier 3 (Levels 4, 5, 6) cleared
  p = p.recordWin({ levelNumber: 4, stars: 3, score: 11000 });
  assert.equal(p.isLatticeUnlocked(7), false);
  assert.equal(p.isLatticeUnlocked(8), false);

  p = p.recordWin({ levelNumber: 6, stars: 3, score: 12000 });
  assert.equal(p.isLatticeUnlocked(7), true);
  assert.equal(p.isLatticeUnlocked(8), true);
  assert.equal(p.isLatticeUnlocked(9), false);

  // Total stars is now 15 -> Shrine Landmark 2 (Glowing Lantern Bridge at 15 ★) unlocks!
  assert.equal(p.totalStars, 15);
  assert.equal(p.isLandmarkUnlocked(2), true);

  // Tier 5 (Apex Boss Level 9) unlocks when EITHER Level 7 or Level 8 is cleared
  p = p.recordWin({ levelNumber: 8, stars: 3, score: 14000 });
  assert.equal(p.isLatticeUnlocked(9), true);
});

test('Elemental Twilight Glass Tile Plates: each of the 5 tile types maps to a distinct glassmorphic plate theme and inner glow border', async () => {
  const { SakuraFestivalTheme } = await import(
    '../core/theme/sakura_festival_theme'
  );
  const theme = SakuraFestivalTheme.instance;

  const expectedPlates: Record<TileType, string> = {
    [TileType.foxMask]: 'sapphire-slate',
    [TileType.onigiri]: 'pearl-indigo',
    [TileType.dango]: 'emerald-jade',
    [TileType.lantern]: 'crimson-ember',
    [TileType.sakura]: 'magenta-plum',
  };

  const seenPlateNames = new Set<string>();
  const seenBorders = new Set<string>();

  for (const [tileType, expectedName] of Object.entries(expectedPlates) as Array<
    [TileType, string]
  >) {
    const style = theme.styleFor(tileType);
    assert.equal(style.plateName, expectedName);
    assert.ok(style.plateGradientStart.startsWith('rgba('));
    assert.ok(style.plateGradientEnd.startsWith('rgba('));
    assert.ok(style.plateBorderColor.startsWith('#'));
    assert.ok(style.plateInnerGlowColor.startsWith('rgba('));
    seenPlateNames.add(style.plateName);
    seenBorders.add(style.plateBorderColor);
  }

  assert.equal(seenPlateNames.size, 5);
  assert.equal(seenBorders.size, 5);
});

test('Shrine Landmark buffs & Pre-Game Boosters: +1 Move, +10% Score & Coin bonus, and Starting Special Tile apply when initializing a level', () => {
  const level1 = Levels.forNumber(1); // 20 moves

  // 1. Fresh progress with no Shrine Landmarks unlocked -> no passive buffs unless equipped
  let progress = GameProgress.initial();
  const baseBuffs = progress.resolveActiveBuffs();
  assert.equal(baseBuffs.extraMoves, false);
  assert.equal(baseBuffs.scoreAndCoinBonus, false);
  assert.equal(baseBuffs.startingSpecialTile, false);
  assert.equal(baseBuffs.activeBadges.length, 0);

  // Equipping Pre-Game Bento Boosters activates the corresponding buffs
  const equippedBuffs = progress.resolveActiveBuffs([
    'extra_moves',
    'score_fan',
    'spirit_special',
  ]);
  assert.equal(equippedBuffs.extraMoves, true);
  assert.equal(equippedBuffs.scoreAndCoinBonus, true);
  assert.equal(equippedBuffs.startingSpecialTile, true);
  assert.equal(equippedBuffs.activeBadges.length, 3);

  // 2. Unlocking Shrine Landmarks at 6★, 15★, and 30★ activates buffs automatically
  for (let lvl = 1; lvl <= 10; lvl++) {
    progress = progress.recordWin({ levelNumber: lvl, stars: 3, score: 12000 });
  }
  assert.equal(progress.totalStars, 30);
  const shrineBuffs = progress.resolveActiveBuffs();
  assert.equal(shrineBuffs.extraMoves, true);
  assert.equal(shrineBuffs.scoreAndCoinBonus, true);
  assert.equal(shrineBuffs.startingSpecialTile, true);

  // 3. GameState with buffs applies +1 starting move and +10% score bonus rounded up
  const unbuffedState = new GameState(level1);
  assert.equal(unbuffedState.movesLeft, level1.moves);

  const buffedState = new GameState(level1, {
    extraMoves: shrineBuffs.extraMoves,
    scoreAndCoinBonus: shrineBuffs.scoreAndCoinBonus,
    startingSpecialTile: shrineBuffs.startingSpecialTile,
  });
  assert.equal(buffedState.movesLeft, level1.moves + 1);

  const step3Tiles = makeClearedStep([
    [0, 0],
    [0, 1],
    [0, 2],
  ]);
  const [unbuffedScore] = unbuffedState.applyResolveSteps([step3Tiles]);
  const [buffedScore] = buffedState.applyResolveSteps([step3Tiles]);
  assert.equal(unbuffedScore, 180);
  assert.equal(buffedScore, Math.ceil(180 * 1.1)); // 198
});

test('Cascade Combo Callouts & Spirit Coin Drops: 2x/3x/4x+ callouts, coin math (+2 for 4+ match, +3*(depth-1) for cascades, +10% Landmark 2 boost), and persistence', () => {
  // 1. Callout strings
  assert.equal(
    getCascadeComboCallout({ cascadeDepth: 1, has4PlusMatch: false }),
    null
  );
  assert.equal(
    getCascadeComboCallout({ cascadeDepth: 1, has4PlusMatch: true }),
    '2x Spirit Chain!'
  );
  assert.equal(
    getCascadeComboCallout({ cascadeDepth: 2, has4PlusMatch: false }),
    '2x Spirit Chain!'
  );
  assert.equal(
    getCascadeComboCallout({ cascadeDepth: 3, has4PlusMatch: false }),
    '3x Festival Fever!'
  );
  assert.equal(
    getCascadeComboCallout({ cascadeDepth: 4, has4PlusMatch: true }),
    '4x+ Kitsune Overload!'
  );

  // 2. Coin calculation without and with Landmark 2 (+10% rounded up)
  // Single 3-match (depth 1, no 4+ match) -> 0 coins
  assert.equal(
    calculateMoveSpiritCoins({
      cascadeDepth: 1,
      has4PlusMatch: false,
      scoreAndCoinBonus: false,
    }),
    0
  );
  // 4+ match on wave 1 -> +2 coins (or ceil(2 * 1.1) = 3 with Landmark 2)
  assert.equal(
    calculateMoveSpiritCoins({
      cascadeDepth: 1,
      has4PlusMatch: true,
      scoreAndCoinBonus: false,
    }),
    2
  );
  assert.equal(
    calculateMoveSpiritCoins({
      cascadeDepth: 1,
      has4PlusMatch: true,
      scoreAndCoinBonus: true,
    }),
    Math.ceil(2 * 1.1)
  );
  // 3-wave cascade + 4+ match -> 2 + 3*(3-1) = 8 coins (or ceil(8 * 1.1) = 9 with Landmark 2)
  assert.equal(
    calculateMoveSpiritCoins({
      cascadeDepth: 3,
      has4PlusMatch: true,
      scoreAndCoinBonus: false,
    }),
    8
  );
  assert.equal(
    calculateMoveSpiritCoins({
      cascadeDepth: 3,
      has4PlusMatch: true,
      scoreAndCoinBonus: true,
    }),
    9
  );

  // 3. GameState + ProgressNotifier integration and persistence
  const repo = new InMemoryProgressRepository();
  const notifier = new ProgressNotifier(repo);
  const startCoins = notifier.progress.spiritCoins;

  const state = new GameState(Levels.forNumber(1), {
    scoreAndCoinBonus: true,
  });
  const stepWave1With4Match: ResolveStep = {
    ...makeClearedStep([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]),
    matchRuns: [
      {
        type: TileType.sakura,
        cells: [
          new GridPos(0, 0),
          new GridPos(0, 1),
          new GridPos(0, 2),
          new GridPos(0, 3),
        ],
        length: 4,
        direction: MatchDirection.horizontal,
      },
    ],
  };
  const stepWave2 = makeClearedStep([
    [1, 0],
    [1, 1],
    [1, 2],
  ]);

  state.applyResolveSteps([stepWave1With4Match, stepWave2]);
  assert.equal(state.lastMoveCascadeDepth, 2);
  assert.equal(state.lastMoveHas4PlusMatch, true);
  assert.equal(state.lastMoveComboCallout, '2x Spirit Chain!');
  // Base: 2 (4+ match) + 3*(2-1) (cascade) = 5 -> boosted by 1.1x rounded up = 6
  assert.equal(state.lastMoveCoinsEarned, 6);

  notifier.addSpiritCoins(state.lastMoveCoinsEarned);
  assert.equal(notifier.progress.spiritCoins, startCoins + 6);
  // Verify persisted to repository
  assert.equal(repo.load().spiritCoins, startCoins + 6);
});

test('Asymmetric Elemental Special Tile Signatures: Blue Mask transmute, Onigiri bottom crush, Dango diagonal pierce, Lantern bonus coins, and Sakura +1 move with +2 cap', () => {
  // 1. Blue Kitsune Mask (Fox-Fire Transmute): converts up to 2 standard tiles into primary collect target (or Blue Mask on score/glow levels) + 150 pts
  const collectLevel = Levels.forNumber(2); // Collect mode with goals
  const maskState = new GameState(collectLevel);
  const primaryTarget = maskState.primaryRemainingTargetType();
  assert.ok(primaryTarget !== null);

  const maskBoard = Board.generate(() => 0.25);
  // Ensure at least 4 standard tiles are NOT primaryTarget
  const otherType =
    primaryTarget === TileType.sakura ? TileType.lantern : TileType.sakura;
  maskBoard.setAt(new GridPos(0, 0), Tile.normal(otherType));
  maskBoard.setAt(new GridPos(0, 1), Tile.normal(otherType));
  maskBoard.setAt(new GridPos(0, 2), Tile.normal(otherType));

  const maskRes = maskState.triggerElementalSignature({
    board: maskBoard,
    cell: new GridPos(3, 3),
    tileType: TileType.foxMask,
    randomFn: () => 0,
  });
  assert.equal(maskRes.calloutText, 'Fox-Fire Transmute!');
  assert.equal(maskState.lastTriggeredElementalPower, 'Fox-Fire Transmute!');
  assert.equal(maskRes.bonusScore, GameConstants.elementalMaskBonusScore);
  assert.equal(maskState.score, 150);
  assert.equal(maskRes.transmutedCells.length, 2);
  for (const pos of maskRes.transmutedCells) {
    assert.equal(maskBoard.getAt(pos)?.type, primaryTarget);
  }

  // Score-only level defaults Fox-Fire Transmute target to TileType.foxMask
  const scoreState = new GameState(Levels.forNumber(1));
  const scoreBoard = Board.fromRows(
    Array.from({ length: 8 }, () => Array(8).fill(TileType.sakura))
  );
  const scoreMaskRes = scoreState.triggerElementalSignature({
    board: scoreBoard,
    cell: new GridPos(4, 4),
    tileType: TileType.foxMask,
    randomFn: () => 0,
  });
  assert.equal(scoreMaskRes.transmutedCells.length, 2);
  for (const pos of scoreMaskRes.transmutedCells) {
    assert.equal(scoreBoard.getAt(pos)?.type, TileType.foxMask);
  }

  // 2. Onigiri (Rolling Rice Crush): clears up to 2 tiles at the bottom-most rows (rows 6 and 7) of that tile's column + 150 pts
  const onigiriState = new GameState(Levels.forNumber(1));
  const onigiriBoard = Board.generate(() => 0.4);
  const onigiriRes = onigiriState.triggerElementalSignature({
    board: onigiriBoard,
    cell: new GridPos(2, 5),
    tileType: TileType.onigiri,
  });
  assert.equal(onigiriRes.calloutText, 'Rolling Rice Crush!');
  assert.equal(onigiriState.lastTriggeredElementalPower, 'Rolling Rice Crush!');
  assert.equal(onigiriState.score, 150);
  assert.equal(onigiriRes.clearedCells.length, 2);
  assert.deepEqual(
    onigiriRes.clearedCells.map((p) => p.key),
    ['6,5', '7,5']
  );

  // 3. Dango Skewer (Bamboo X-Pierce): clears the 4 diagonal corner neighbors around the detonated special tile + 150 pts
  const dangoState = new GameState(Levels.forNumber(1));
  const dangoBoard = Board.generate(() => 0.5);
  const dangoRes = dangoState.triggerElementalSignature({
    board: dangoBoard,
    cell: new GridPos(3, 3),
    tileType: TileType.dango,
  });
  assert.equal(dangoRes.calloutText, 'Bamboo X-Pierce!');
  assert.equal(dangoState.lastTriggeredElementalPower, 'Bamboo X-Pierce!');
  assert.equal(dangoState.score, 150);
  assert.equal(dangoRes.clearedCells.length, 4);
  assert.deepEqual(
    dangoRes.clearedCells.map((p) => p.key),
    ['2,2', '2,4', '4,2', '4,4']
  );

  // 4. Red Lantern (Ember Lantern Nova): awards +3 bonus Spirit Coins and +200 bonus points
  const lanternState = new GameState(Levels.forNumber(1));
  const lanternRes = lanternState.triggerElementalSignature({
    cell: new GridPos(4, 2),
    tileType: TileType.lantern,
  });
  assert.equal(lanternRes.calloutText, 'Ember Lantern Nova!');
  assert.equal(lanternState.lastTriggeredElementalPower, 'Ember Lantern Nova!');
  assert.equal(lanternState.score, 200);
  assert.equal(lanternState.lastMoveElementalCoins, 3);
  assert.equal(lanternState.lastMoveCoinsEarned, 3);

  // 5. Sakura Blossom (Sakura Gale Breeze): grants +1 Bonus Move (capped at max +2 per level) and +200 bonus points
  const sakuraState = new GameState(Levels.forNumber(1)); // starts at 20 moves
  assert.equal(sakuraState.movesLeft, 20);

  // 1st Sakura special -> +1 move (21), +200 pts
  const sak1 = sakuraState.triggerElementalSignature({
    cell: new GridPos(1, 1),
    tileType: TileType.sakura,
  });
  assert.equal(sak1.calloutText, 'Sakura Gale +1 Move!');
  assert.equal(sakuraState.movesLeft, 21);
  assert.equal(sakuraState.sakuraBonusMovesGained, 1);
  assert.equal(sakuraState.score, 200);

  // 2nd Sakura special -> +1 move (22), +200 pts (reaches +2 cap)
  sakuraState.triggerElementalSignature({
    cell: new GridPos(2, 2),
    tileType: TileType.sakura,
  });
  assert.equal(sakuraState.movesLeft, 22);
  assert.equal(sakuraState.sakuraBonusMovesGained, 2);
  assert.equal(sakuraState.score, 400);

  // 3rd Sakura special in same level -> capped at +2 moves (stays 22), still awards +200 pts
  sakuraState.triggerElementalSignature({
    cell: new GridPos(3, 3),
    tileType: TileType.sakura,
  });
  assert.equal(sakuraState.movesLeft, 22);
  assert.equal(sakuraState.sakuraBonusMovesGained, 2);
  assert.equal(sakuraState.score, 600);
});

test('Bottom 3-Slot Bento Forge Dock: Pocket a Special Tile (0 moves), Deploy onto target coordinate, and Fuse 2 docked specials for Super Matsuri Cross Blast', () => {
  const state = new GameState(Levels.forNumber(1));
  const board = Board.generate(() => 0.35);

  const startMoves = state.movesLeft;
  assert.equal(state.bentoDock.length, 3);
  assert.equal(state.filledBentoSlots.length, 0);
  assert.equal(state.canFuseBento, false);

  // Place a Red Lantern Slash Row special at (2, 3) and a Sakura Burst special at (5, 4)
  board.setAt(
    new GridPos(2, 3),
    new Tile(TileType.lantern, SpecialKind.slashRow)
  );
  board.setAt(
    new GridPos(5, 4),
    new Tile(TileType.sakura, SpecialKind.burst)
  );

  // A. Arm Pocket Mode and pocket (2, 3) -> 0 moves spent, replaced with standard tile, stored in slot 0
  state.setPocketMode(true);
  assert.equal(state.pocketModeActive, true);
  const pocketed0 = state.pocketSpecialFromBoard(board, new GridPos(2, 3));
  assert.ok(pocketed0 !== null);
  assert.equal(pocketed0?.tileType, TileType.lantern);
  assert.equal(pocketed0?.specialType, SpecialKind.slashRow);
  assert.equal(state.movesLeft, startMoves); // 0 moves spent!
  assert.equal(state.pocketModeActive, false);
  assert.equal(board.getAt(new GridPos(2, 3))?.isSpecial, false);
  assert.equal(state.bentoDock[0]?.tileType, TileType.lantern);

  // B. Arm slot 0 and deploy onto target coordinate (4, 4) -> detonates blast + Ember Lantern Nova (+3 coins, +200 elemental pts) and clears slot 0
  state.armBentoSlot(0);
  assert.equal(state.armedBentoSlotIndex, 0);
  const deployResult = state.deployBentoSpecial(board, 0, new GridPos(4, 4));
  assert.ok(deployResult !== null);
  assert.equal(state.bentoDock[0], null);
  assert.equal(state.armedBentoSlotIndex, null);
  assert.equal(state.lastTriggeredElementalPower, 'Ember Lantern Nova!');
  assert.ok(state.score >= GameConstants.slashActivationBonus + GameConstants.elementalLanternBonusScore);
  assert.ok(state.lastMoveCoinsEarned >= GameConstants.elementalLanternBonusCoins);

  // C. Pocket 2 Special Tiles into slots 0 and 1, then trigger Fuse Bento
  board.setAt(
    new GridPos(1, 1),
    new Tile(TileType.dango, SpecialKind.slashColumn)
  );
  board.setAt(
    new GridPos(5, 4),
    new Tile(TileType.sakura, SpecialKind.burst)
  );
  state.pocketSpecialFromBoard(board, new GridPos(1, 1));
  state.pocketSpecialFromBoard(board, new GridPos(5, 4));
  assert.equal(state.filledBentoSlots.length, 2);
  assert.equal(state.canFuseBento, true);

  const scoreBeforeFuse = state.score;
  const movesBeforeFuse = state.movesLeft;
  const fuseResult = state.fuseBentoSpecials(board);
  assert.ok(fuseResult !== null);
  // Central 3 rows (2,3,4) and 3 cols (2,3,4) = 3*8 + 3*8 - 9 = 39 unique cells
  assert.equal(fuseResult!.clearedCells.length, 39);
  assert.equal(state.filledBentoSlots.length, 0);
  assert.equal(state.canFuseBento, false);
  // Both Elemental Signatures triggered (Dango Bamboo X-Pierce + Sakura Gale +1 Move)
  assert.equal(state.movesLeft, movesBeforeFuse + 1);
  assert.ok(
    state.score >=
      scoreBeforeFuse +
        GameConstants.bentoFuseBonusScore +
        GameConstants.elementalDangoBonusScore +
        GameConstants.elementalSakuraBonusScore
  );
  assert.ok(fuseResult!.bonusCoins >= GameConstants.bentoFuseBonusCoins);
  assert.ok(
    state.lastTriggeredElementalPower?.includes('Bamboo X-Pierce') &&
      state.lastTriggeredElementalPower?.includes('Sakura Gale Breeze')
  );
});

test('Kitsune Spirit Companion Meter: +4 per tile, +15 per cascade wave, 25 coin boost, and 100% activateKitsuneSkill() for 0 moves', () => {
  const state = new GameState(Levels.forNumber(1));
  const board = Board.generate(() => 0.42);
  assert.equal(state.spiritCharge, 0);
  assert.equal(state.isSpiritReady, false);

  // 1-wave 3-tile clear -> 3 * 4 = 12% charge
  const step1 = makeClearedStep([
    [0, 0],
    [0, 1],
    [0, 2],
  ]);
  assert.equal(
    calculateSpiritChargeGain({ matchedTileCount: 3, cascadeDepth: 1 }),
    12
  );
  state.applyResolveSteps([step1]);
  assert.equal(state.spiritCharge, 12);

  // 2-wave cascade (3 tiles + 3 tiles) -> (6 * 4) + (1 * 15) = 39% charge (total 51%)
  const step2 = makeClearedStep([
    [1, 0],
    [1, 1],
    [1, 2],
  ]);
  assert.equal(
    calculateSpiritChargeGain({ matchedTileCount: 6, cascadeDepth: 2 }),
    39
  );
  state.applyResolveSteps([step1, step2]);
  assert.equal(state.spiritCharge, 51);
  assert.equal(state.isSpiritReady, false);

  // Boost to 100% via boostSpiritChargeWithCoins()
  const boosted = state.boostSpiritChargeWithCoins();
  assert.equal(boosted, true);
  assert.equal(state.spiritCharge, 100);
  assert.equal(state.isSpiritReady, true);

  // Activate Kitsune Skill at 100% -> 0 moves spent, resets charge to 0, clears up to 4 tiles (+300 score), upgrades 1 tile into a Special Tile, sets callout
  const movesBefore = state.movesLeft;
  const scoreBefore = state.score;

  const skillResult = state.activateKitsuneSkill(board, () => 0.25);
  assert.ok(skillResult !== null);
  assert.equal(state.movesLeft, movesBefore); // 0 moves spent
  assert.equal(state.spiritCharge, 0);
  assert.equal(state.isSpiritReady, false);
  assert.equal(
    skillResult!.clearedCells.length,
    GameConstants.kitsuneSkillClearCount
  );
  assert.ok(state.score >= scoreBefore + GameConstants.kitsuneSkillBonusScore);
  assert.ok(skillResult!.upgradedCell !== null);
  assert.equal(
    board.getAt(skillResult!.upgradedCell!)?.isSpecial,
    true
  );
  assert.equal(state.lastKitsuneSkillCallout, 'Kitsune Fox-Fire Barrage!');
});

test('Spirit Coin Tactical Utilities: 1-Move Time-Slip Rewind (1st free, 2nd 15 coins) and Lucky Shuffle (20 coins, 0 moves, upgrades 1 special)', () => {
  const state = new GameState(Levels.forNumber(1));
  const board = Board.generate(() => 0.33);
  const initialMoves = state.movesLeft;

  // Before any move, canRewind is false and first rewind cost is 0 (Free)
  assert.equal(state.canRewind, false);
  assert.equal(state.rewindCost, 0);

  // Save snapshot before player swap, then consume a move and mutate board + score
  state.saveTurnSnapshot(board);
  assert.equal(state.canRewind, true);
  const originalTile00 = board.getAt(new GridPos(0, 0));
  board.setAt(new GridPos(0, 0), new Tile(TileType.lantern, SpecialKind.burst));
  state.useMove();
  state.applyResolveSteps([
    makeClearedStep([
      [2, 0],
      [2, 1],
      [2, 2],
    ]),
  ]);
  assert.equal(state.movesLeft, initialMoves - 1);
  assert.ok(state.score > 0);

  // 1st rewind is FREE (cost 0), restores board, movesLeft, and score
  const rewound = state.rewindLastMove(board);
  assert.equal(rewound, true);
  assert.equal(state.movesLeft, initialMoves);
  assert.equal(state.score, 0);
  assert.equal(board.getAt(new GridPos(0, 0))?.type, originalTile00?.type);
  assert.equal(board.getAt(new GridPos(0, 0))?.special, originalTile00?.special);
  assert.equal(state.rewindsUsed, 1);
  // 2nd rewind in the same level costs 15 Spirit Coins
  assert.equal(state.rewindCost, GameConstants.timeSlipRewindCoinCost);

  // Lucky Shuffle: costs 0 moves, shuffles movable tiles, and upgrades 1 random standard tile into a Special Tile
  const movesBeforeShuffle = state.movesLeft;
  const shuffleResult = state.luckyShuffle(board, undefined, () => 0.5);
  assert.ok(shuffleResult !== null);
  assert.equal(state.movesLeft, movesBeforeShuffle); // 0 moves spent
  assert.ok(shuffleResult!.upgradedCell !== null);
  assert.equal(
    board.getAt(shuffleResult!.upgradedCell!)?.isSpecial,
    true
  );
});

test('Festival Fever Streak (0..5), Second Wind Continue (40 coins for +5 moves & 100% charge), and Takeout Bento (25 coins or 0 at Tier 5)', () => {
  const repo = new InMemoryProgressRepository();
  const notifier = new ProgressNotifier(repo);

  // Win 3 levels -> festivalFeverStreak = 3 -> startingSpiritChargeBonus = 60%
  notifier.recordWin({ levelNumber: 1, stars: 3, score: 1500 });
  notifier.recordWin({ levelNumber: 2, stars: 3, score: 1800 });
  notifier.recordWin({ levelNumber: 3, stars: 3, score: 2100 });
  assert.equal(notifier.progress.festivalFeverStreak, 3);
  assert.equal(notifier.progress.startingSpiritChargeBonus, 60);
  assert.equal(
    notifier.progress.takeoutBentoCost,
    GameConstants.takeoutBentoCoinCost
  );

  // Initializing a level with Fever Streak 3 starts Kitsune Spirit Meter at 60%
  const feverState = new GameState(Levels.forNumber(2), {
    festivalFeverStreak: notifier.progress.festivalFeverStreak,
  });
  assert.equal(feverState.festivalFeverStreak, 3);
  assert.equal(feverState.spiritCharge, 60);

  // Drain moves to trigger loss (score 0 < star1)
  while (feverState.movesLeft > 0) {
    feverState.useMove();
  }
  feverState.evaluate();
  assert.equal(feverState.status, GameStatus.lost);

  // Second Wind Continue: restores status to idle, grants +5 moves and 100% Spirit Charge
  const continued = feverState.activateSecondWind(notifier);
  assert.equal(continued, true);
  assert.equal(feverState.status, GameStatus.idle);
  assert.equal(feverState.movesLeft, GameConstants.secondWindExtraMoves);
  assert.equal(feverState.spiritCharge, GameConstants.spiritChargeMax);
  assert.equal(notifier.progress.festivalFeverStreak, 3);

  // Win 2 more times to reach Fever Streak Tier 5 (max) -> takeoutBentoCost becomes 0 (Free!)
  notifier.recordWin({ levelNumber: 4, stars: 3, score: 2200 });
  notifier.recordWin({ levelNumber: 5, stars: 3, score: 2500 });
  assert.equal(notifier.progress.festivalFeverStreak, 5);
  assert.equal(notifier.progress.startingSpiritChargeBonus, 100);
  assert.equal(notifier.progress.takeoutBentoCost, 0);

  // Pack Takeout Bento on victory -> carries stored Bento specials into the next level
  const winState = new GameState(Levels.forNumber(1), {
    festivalFeverStreak: notifier.progress.festivalFeverStreak,
  });
  const board = Board.generate(() => 0.2);
  board.setAt(
    new GridPos(1, 1),
    new Tile(TileType.sakura, SpecialKind.slashRow)
  );
  winState.pocketSpecialFromBoard(board, new GridPos(1, 1));
  assert.equal(winState.filledBentoSlots.length, 1);

  const packedItems = winState.packTakeoutBento(notifier);
  assert.ok(packedItems !== null);
  assert.equal(packedItems!.length, 1);
  assert.equal(notifier.progress.carryOverBento.length, 1);

  // Next level receives carryOverBento in its Bento Dock
  const nextLevelState = new GameState(Levels.forNumber(2), {
    carryOverBento: notifier.progress.carryOverBento,
  });
  assert.equal(nextLevelState.filledBentoSlots.length, 1);
  assert.equal(nextLevelState.bentoDock[0]?.tileType, TileType.sakura);
  assert.equal(nextLevelState.bentoDock[0]?.specialType, SpecialKind.slashRow);
});

test('Custom Festival Blockers: Paper Lantern Barrier (1-3 layers + Red Lantern / Bento Fuse instant-shatter), Sugar Mold (4-side clear or Dango X-Pierce +10 coins), and Torii Spirit Gate (curse falling items until Onigiri/Kitsune cleanse)', () => {
  // 1. Paper Lantern Barrier: 3 layers reduced 1 per adjacent match; Red Lantern special or Bento Fuse instantly shatters all layers
  const state = new GameState(Levels.forNumber(1));
  const board = Board.generate(() => 0.35);

  state.placePaperLantern(new GridPos(2, 2), 3, board);
  assert.equal(state.paperLanternLayersAt(2, 2, board), 3);
  assert.equal(board.paperLanternLayersAt(2, 2), 3);

  // Adjacent normal match at (2,3), (2,4), (2,5) -> damages Paper Lantern at (2,2) by 1 layer (3 -> 2)
  state.applyResolveSteps(
    [
      makeClearedStep([
        [2, 3],
        [2, 4],
        [2, 5],
      ]),
    ],
    board
  );
  assert.equal(state.paperLanternLayersAt(2, 2, board), 2);

  // Triggering a Red Lantern special adjacent at (2,3) instantly shatters all remaining layers (3 -> 0)
  state.placePaperLantern(new GridPos(2, 2), 3, board);
  assert.equal(state.paperLanternLayersAt(2, 2, board), 3);
  state.triggerElementalSignature({
    board,
    cell: new GridPos(2, 3),
    tileType: TileType.lantern,
  });
  assert.equal(state.paperLanternLayersAt(2, 2, board), 0);
  assert.equal(board.blockerAt(2, 2), null);

  // Bento Fuse also instantly shatters Paper Lantern barriers
  state.placePaperLantern(new GridPos(1, 2), 3, board);
  assert.equal(state.paperLanternLayersAt(1, 2, board), 3);
  board.setAt(new GridPos(0, 0), new Tile(TileType.sakura, SpecialKind.slashRow));
  board.setAt(new GridPos(0, 1), new Tile(TileType.onigiri, SpecialKind.burst));
  state.pocketSpecialFromBoard(board, new GridPos(0, 0));
  state.pocketSpecialFromBoard(board, new GridPos(0, 1));
  state.fuseBentoSpecials(board);
  assert.equal(state.paperLanternLayersAt(1, 2, board), 0);

  // 2. Sugar Mold (2x2 box at top-left (4,4) covering (4,4), (4,5), (5,4), (5,5)):
  //    a) Cleared when all 4 surrounding sides (top, bottom, left, right) are hit by adjacent matches, awarding +10 Spirit Coins
  state.placeSugarMold(new GridPos(4, 4), board);
  assert.ok(state.sugarMoldAt(4, 4, board) !== null);
  assert.ok(state.sugarMoldAt(5, 5, board) !== null);

  // Hit top side ((3,4),(3,5),(3,6)) and left side ((4,3),(5,3),(6,3))
  state.applyResolveSteps(
    [
      makeClearedStep([
        [3, 4],
        [3, 5],
        [3, 6],
        [4, 3],
        [5, 3],
        [6, 3],
      ]),
    ],
    board
  );
  const partialMold = state.sugarMoldAt(4, 4, board);
  assert.ok(partialMold !== null);
  assert.equal(partialMold!.sidesHit.has('top'), true);
  assert.equal(partialMold!.sidesHit.has('left'), true);

  // Hit bottom side ((6,4),(6,5),(6,6)) and right side ((4,6),(5,6),(6,6)) -> all 4 sides cleared -> Sugar Mold breaks & awards +10 Spirit Coins!
  state.applyResolveSteps(
    [
      makeClearedStep([
        [6, 4],
        [6, 5],
        [6, 6],
        [4, 6],
        [5, 6],
      ]),
    ],
    board
  );
  assert.equal(state.sugarMoldAt(4, 4, board), null);
  assert.equal(state.sugarMoldAt(5, 5, board), null);
  assert.ok(
    state.lastMoveCoinsEarned >= GameConstants.sugarMoldBreakCoinReward
  );

  //    b) Sugar Mold also breaks immediately when hit by a Dango X-Pierce special, awarding +10 Spirit Coins
  state.placeSugarMold(new GridPos(3, 3), board);
  assert.ok(state.sugarMoldAt(3, 3, board) !== null);
  const coinsBeforeDangoMold = state.sugarMoldCoinsEarned;
  state.triggerElementalSignature({
    board,
    cell: new GridPos(2, 2), // diagonal corner (3,3) is pierced by Dango X-Pierce!
    tileType: TileType.dango,
  });
  assert.equal(state.sugarMoldAt(3, 3, board), null);
  assert.equal(
    state.sugarMoldCoinsEarned,
    coinsBeforeDangoMold + GameConstants.sugarMoldBreakCoinReward
  );

  // 3. Torii Spirit Gate: curses falling items into slate gray tiles unless cleansed by an adjacent Onigiri or Kitsune Transmute match
  state.placeToriiGate(new GridPos(1, 6), false, board);
  assert.equal(state.toriiGateAt(1, 6, board)?.cleansed, false);

  // When a tile falls through/below an uncleansed Torii Gate at (1,6) -> (2,6) becomes slate-cursed!
  const stepWithFallBelowGate: ResolveStep = {
    ...makeClearedStep([
      [0, 0],
      [0, 1],
      [0, 2],
    ]),
    falls: [
      {
        from: new GridPos(1, 6),
        to: new GridPos(2, 6),
        tile: Tile.normal(TileType.sakura),
        type: TileType.sakura,
      },
    ],
  };
  state.applyResolveSteps([stepWithFallBelowGate], board);
  assert.equal(state.isSlateCursed(2, 6, board), true);

  // Adjacent Onigiri match at (1,5) cleanses the Torii Spirit Gate at (1,6) and purifies adjacent slate curses
  const cleanseStep: ResolveStep = {
    ...makeClearedStep(
      [
        [1, 5],
        [2, 5],
        [3, 5],
      ],
      { [TileType.onigiri]: 3 }
    ),
    matchRuns: [
      {
        type: TileType.onigiri,
        cells: [new GridPos(1, 5), new GridPos(2, 5), new GridPos(3, 5)],
        length: 3,
        direction: MatchDirection.vertical,
      },
    ],
  };
  state.applyResolveSteps([cleanseStep], board);
  assert.equal(state.toriiGateAt(1, 6, board)?.cleansed, true);
  assert.equal(state.isSlateCursed(2, 6, board), false);
});

test('Yokai Boss Battles (Levels 9, 19, 30): HP depletion on normal matches (1x), Special Tile detonations (2x), Kitsune Skill (250 HP), 4-turn counter-attack curse, and Boss Trophy victory', () => {
  // Verify Milestone Levels 9, 19, 30 are Yokai Boss levels
  assert.equal(Levels.isBossLevel(9), true);
  assert.equal(Levels.isBossLevel(19), true);
  assert.equal(Levels.isBossLevel(30), true);
  assert.equal(Levels.isBossLevel(1), false);

  const level9 = Levels.forNumber(9);
  assert.ok(level9.yokaiBoss !== undefined);
  assert.equal(level9.yokaiBoss?.maxHp, GameConstants.yokaiBossLevel9Hp); // 1000 HP

  const bossState = new GameState(level9);
  const board = Board.generate(() => 0.3);
  if (level9.festivalBlockers) {
    board.initBlockers(level9.festivalBlockers);
  }

  assert.equal(bossState.isBossLevel, true);
  assert.equal(bossState.yokaiBossMaxHp, 1000);
  assert.equal(bossState.yokaiBossHp, 1000);

  // 1. Normal match deals 1x damage equal to score earned (3 tiles * 60 = 180 damage -> 820 HP)
  const normalStep = makeClearedStep([
    [0, 0],
    [0, 1],
    [0, 2],
  ]);
  const [normalStepScore] = bossState.applyResolveSteps([normalStep], board);
  assert.equal(normalStepScore, 180);
  assert.equal(bossState.lastBossDamageDealt, 180);
  assert.equal(bossState.yokaiBossHp, 1000 - 180); // 820 HP

  // 2. Every 4 turns, Yokai Boss counter-attacks by cursing 2 random tiles into locked slate blocks
  bossState.useMove(board);
  bossState.useMove(board);
  bossState.useMove(board);
  assert.equal(bossState.lastBossCounterCursedCells.length, 0);
  bossState.useMove(board); // 4th turn triggers Boss Counter-Attack!
  assert.equal(
    bossState.lastBossCounterCursedCells.length,
    GameConstants.yokaiBossCurseTileCount
  );
  for (const cursedPos of bossState.lastBossCounterCursedCells) {
    assert.equal(bossState.isSlateCursed(cursedPos.row, cursedPos.col, board), true);
  }

  // 3. Triggering 100% Kitsune Spirit Companion skill deals 250 HP damage (820 -> 570 HP)
  const hpBeforeKitsune = bossState.yokaiBossHp;
  bossState.boostSpiritChargeWithCoins();
  bossState.activateKitsuneSkill(board, () => 0.25);
  assert.equal(
    bossState.lastBossDamageDealt,
    GameConstants.yokaiBossKitsuneSkillDamage
  );
  assert.equal(
    bossState.yokaiBossHp,
    hpBeforeKitsune - GameConstants.yokaiBossKitsuneSkillDamage
  ); // 570 HP

  // 4. Special Tile detonation deals 2x damage
  const specialStep: ResolveStep = {
    ...makeClearedStep([
      [3, 0],
      [3, 1],
      [3, 2],
    ]),
    waves: [
      {
        waveIndex: 0,
        activated: [
          {
            cell: new GridPos(3, 1),
            kind: SpecialKind.slashRow,
            tileType: TileType.sakura,
          },
        ],
        cleared: [
          new GridPos(3, 0),
          new GridPos(3, 1),
          new GridPos(3, 2),
        ],
        clearedByType: { [TileType.sakura]: 3 },
        bonusScore: GameConstants.slashActivationBonus,
      },
    ],
  };
  const [specialStepScore] = bossState.applyResolveSteps([specialStep], board);
  // specialStepScore (180 base + 200 Sakura signature = 380) * 2x = 760 Boss Damage!
  const expectedSpecialDamage =
    specialStepScore * GameConstants.yokaiBossSpecialDamageMultiplier;
  assert.equal(bossState.lastBossDamageDealt, expectedSpecialDamage);

  // 5. Depleting Yokai Boss HP to 0 completes the level (GameStatus.won) and awards the Kitsune Boss Trophy badge
  assert.equal(bossState.yokaiBossHp, 0);
  assert.equal(bossState.status, GameStatus.won);
  assert.ok(bossState.stars >= 1);

  let progress = GameProgress.initial();
  assert.equal(progress.hasBossTrophy(9), false);
  progress = progress.recordWin({
    levelNumber: 9,
    stars: bossState.stars,
    score: bossState.score,
  });
  assert.equal(progress.hasBossTrophy(9), true);
});

test('Phase 6: Ascending Pentatonic Cascade Chimes (C4, D4, E4, G4, A4) & Publish Pack Documentation', () => {
  // 1. Verify exact 5-step pentatonic cascade chime frequencies
  assert.equal(CASCADE_PENTATONIC_TONES.length, 5);
  assert.deepEqual(getCascadeChimeTone(1), { note: 'C4', frequencyHz: 261.63 });
  assert.deepEqual(getCascadeChimeTone(2), { note: 'D4', frequencyHz: 293.66 });
  assert.deepEqual(getCascadeChimeTone(3), { note: 'E4', frequencyHz: 329.63 });
  assert.deepEqual(getCascadeChimeTone(4), { note: 'G4', frequencyHz: 392.0 });
  assert.deepEqual(getCascadeChimeTone(5), { note: 'A4', frequencyHz: 440.0 });
  assert.deepEqual(getCascadeChimeTone(7), { note: 'A4', frequencyHz: 440.0 });

  // 2. Verify audioService.playCascadeChime records last played tone safely in headless/node environment
  const played3 = audioService.playCascadeChime(3);
  assert.equal(played3.note, 'E4');
  assert.equal(audioService.lastPlayedCascadeChime?.note, 'E4');

  // 3. Verify docs/PUBLISH_PACK.md exists and documents required sections
  const publishPackPath = path.resolve(process.cwd(), 'docs/PUBLISH_PACK.md');
  assert.equal(fs.existsSync(publishPackPath), true);
  const content = fs.readFileSync(publishPackPath, 'utf8');
  assert.ok(content.includes('Matsuri Spirit: Match & Shrine'));
  assert.ok(content.includes('Lattice Map'));
  assert.ok(content.includes('Bento Forge'));
  assert.ok(content.includes('Kitsune'));
  assert.ok(content.includes('Yokai Boss'));
  assert.ok(content.includes('C4') && content.includes('D4') && content.includes('E4') && content.includes('G4') && content.includes('A4'));
  assert.ok(content.includes('#2B1B3D') && content.includes('#FFB7C5') && content.includes('#FFD166'));
  assert.ok(content.includes('npm run build'));
});

test('Phase 7: Shrine Gachapon Machine (free 1st pull, 100-coin subsequent pulls, companion/theme unlocks, Star Rank 1->3 upgrades, and +40 Spirit Shard refund)', () => {
  const repo = new InMemoryProgressRepository();
  const notifier = new ProgressNotifier(repo);

  // Initial state: Kitsune unlocked at Rank 1, Sakura Twilight unlocked, 0 gacha pulls, 1st pull cost = 0
  assert.equal(notifier.progress.activeCompanionId, 'kitsune');
  assert.equal(notifier.progress.activeCompanionRank, 1);
  assert.equal(notifier.progress.companionRankFor('tanuki'), 0);
  assert.equal(notifier.progress.companionRankFor('shiba'), 0);
  assert.equal(notifier.progress.companionRankFor('rabbit'), 0);
  assert.deepEqual(notifier.progress.unlockedThemes, ['sakura_twilight']);
  assert.equal(notifier.progress.activeThemeId, 'sakura_twilight');
  assert.equal(notifier.progress.totalGachaPulls, 0);
  assert.equal(notifier.progress.gachaPullCost, 0);

  const initialCoins = notifier.progress.spiritCoins; // 150

  // 1st pull is FREE (0 🪙) and unlocks Tanuki at Rank 1
  const pull1 = notifier.performGachaPull(0);
  assert.ok(pull1 !== null);
  assert.equal(pull1!.costPaid, 0);
  assert.equal(pull1!.kind, 'unlock_companion');
  assert.equal(pull1!.companionId, 'tanuki');
  assert.equal(notifier.progress.spiritCoins, initialCoins);
  assert.equal(notifier.progress.companionRankFor('tanuki'), 1);
  assert.equal(notifier.progress.totalGachaPulls, 1);
  assert.equal(notifier.progress.gachaPullCost, GameConstants.gachaponPullCoinCost);

  // Add plenty of coins to pull all remaining companions, themes, and rank upgrades
  notifier.addSpiritCoins(2000);
  const coinsBeforePull2 = notifier.progress.spiritCoins;

  // 2nd pull costs 100 🪙 and unlocks Shiba
  const pull2 = notifier.performGachaPull(0);
  assert.ok(pull2 !== null);
  assert.equal(pull2!.costPaid, 100);
  assert.equal(pull2!.kind, 'unlock_companion');
  assert.equal(pull2!.companionId, 'shiba');
  assert.equal(notifier.progress.spiritCoins, coinsBeforePull2 - 100);
  assert.equal(notifier.progress.companionRankFor('shiba'), 1);

  // Pull remaining 4 unowned items (rabbit + 3 themes: cyber_tokyo, golden_inari, matcha_zen)
  for (let i = 0; i < 4; i++) {
    const res = notifier.performGachaPull(0);
    assert.ok(res !== null);
  }
  assert.equal(notifier.progress.companionRankFor('rabbit'), 1);
  assert.equal(notifier.progress.isThemeUnlocked('cyber_tokyo'), true);
  assert.equal(notifier.progress.isThemeUnlocked('golden_inari'), true);
  assert.equal(notifier.progress.isThemeUnlocked('matcha_zen'), true);

  // Next 8 pulls upgrade all 4 companions from Rank 1 -> Rank 2 -> Rank 3
  for (let i = 0; i < 8; i++) {
    const upg = notifier.performGachaPull(0);
    assert.ok(upg !== null);
    assert.equal(upg!.kind, 'upgrade_companion');
  }
  assert.equal(notifier.progress.companionRankFor('kitsune'), 3);
  assert.equal(notifier.progress.companionRankFor('tanuki'), 3);
  assert.equal(notifier.progress.companionRankFor('shiba'), 3);
  assert.equal(notifier.progress.companionRankFor('rabbit'), 3);

  // When all 4 companions are Rank 3 and all 4 themes are unlocked, pulling grants +40 🪙 Spirit Shard refund (net -60 🪙)
  const coinsBeforeShard = notifier.progress.spiritCoins;
  const shardPull = notifier.performGachaPull(0);
  assert.ok(shardPull !== null);
  assert.equal(shardPull!.kind, 'spirit_shard_refund');
  assert.equal(shardPull!.refundCoins, GameConstants.gachaponDuplicateShardRefund);
  assert.equal(notifier.progress.spiritCoins, coinsBeforeShard - 100 + 40);

  // Equipping and persisting activeCompanionId and activeThemeId
  notifier.equipCompanion('shiba');
  notifier.equipTheme('cyber_tokyo');
  assert.equal(notifier.progress.activeCompanionId, 'shiba');
  assert.equal(notifier.progress.activeCompanionRank, 3);
  assert.equal(notifier.progress.activeThemeId, 'cyber_tokyo');

  const reloaded = new ProgressNotifier(repo);
  assert.equal(reloaded.progress.activeCompanionId, 'shiba');
  assert.equal(reloaded.progress.activeCompanionRank, 3);
  assert.equal(reloaded.progress.activeThemeId, 'cyber_tokyo');
  assert.equal(reloaded.progress.companionRankFor('tanuki'), 3);
});

test('Phase 7: Spirit Companion Skills (Tanuki Bento Chef, Raijin Thunder Shiba, Tsuki Moon Rabbit) & Star Rank Multipliers (1.0x / 1.25x / 1.5x)', () => {
  const bossLevel = Levels.forNumber(9); // Yokai Boss Level (1000 HP)
  const board = Board.generate(() => 0.35);

  // 1. Tanuki Bento Chef (Rank 2 -> 1.25x multiplier):
  //    Adds 1 Special Tile to first open bentoDock slot, clears 3 central tiles, awards +8 🪙 and 300 * 1.25 = 375 score (250 * 1.25 = 313 Boss HP damage)
  const tanukiState = new GameState(bossLevel, {
    activeCompanionId: 'tanuki',
    companionRank: 2,
  });
  assert.equal(tanukiState.filledBentoSlots.length, 0);
  tanukiState.addSpiritCharge(100);
  const tanukiRes = tanukiState.activateCompanionSkill(board, () => 0.2);
  assert.ok(tanukiRes !== null);
  assert.equal(tanukiRes!.companionId, 'tanuki');
  assert.equal(tanukiRes!.companionRank, 2);
  assert.equal(tanukiRes!.rankMultiplier, 1.25);
  assert.ok(tanukiRes!.bentoSlotAdded !== null);
  assert.equal(tanukiState.filledBentoSlots.length, 1);
  assert.equal(tanukiRes!.clearedCells.length, 3);
  assert.equal(tanukiRes!.bonusCoins, GameConstants.tanukiSkillBonusCoins);
  assert.equal(tanukiRes!.bonusScore, Math.round(300 * 1.25)); // 375
  assert.equal(tanukiRes!.bossDamageDealt, Math.round(250 * 1.25)); // 313
  assert.equal(tanukiState.lastKitsuneSkillCallout, 'Tanuki Bento Feast Delivery!');

  // 2. Raijin Thunder Shiba (Rank 3 -> 1.5x multiplier):
  //    Clears 4 diagonal tiles, damages/cleanses up to 4 active blockers, deals 350 * 1.5 = 525 Boss HP damage, awards 350 * 1.5 = 525 score
  const shibaBoard = Board.generate(() => 0.4);
  const shibaState = new GameState(bossLevel, {
    activeCompanionId: 'shiba',
    companionRank: 3,
  });
  shibaState.clearBlockers(shibaBoard);
  shibaState.placePaperLantern(new GridPos(0, 0), 2, shibaBoard);
  shibaState.placeToriiGate(new GridPos(0, 7), false, shibaBoard);
  shibaState.placeSlateCurse(new GridPos(7, 0), shibaBoard);
  shibaState.placeSugarMold(new GridPos(4, 4), shibaBoard);

  shibaState.addSpiritCharge(100);
  const shibaRes = shibaState.activateKitsuneSkill(shibaBoard, () => 0.25);
  assert.ok(shibaRes !== null);
  assert.equal(shibaRes!.companionId, 'shiba');
  assert.equal(shibaRes!.rankMultiplier, 1.5);
  assert.equal(shibaRes!.clearedCells.length, 4);
  assert.equal(shibaRes!.blockersDamagedCount, 4);
  assert.equal(shibaState.paperLanternLayersAt(0, 0, shibaBoard), 1); // 2 -> 1
  assert.equal(shibaState.toriiGateAt(0, 7, shibaBoard)?.cleansed, true);
  assert.equal(shibaState.isSlateCursed(7, 0, shibaBoard), false);
  assert.equal(shibaState.sugarMoldAt(4, 4, shibaBoard), null);
  assert.equal(shibaRes!.bonusScore, Math.round(350 * 1.5)); // 525
  assert.equal(shibaRes!.bossDamageDealt, Math.round(350 * 1.5)); // 525
  assert.equal(shibaState.lastKitsuneSkillCallout, 'Shiba Thunder Bark Chain!');

  // 3. Tsuki Moon Rabbit (Rank 1 -> 1.0x multiplier):
  //    Grants +1 bonus move (capped at max +2 per level), converts 3 random standard tiles into primary target tile type, awards +350 score
  const collectLevel = Levels.forNumber(2); // Collect mode
  const rabbitBoard = Board.generate(() => 0.3);
  const rabbitState = new GameState(collectLevel, {
    activeCompanionId: 'rabbit',
    companionRank: 1,
  });
  const movesBefore = rabbitState.movesLeft;
  const primaryTarget = rabbitState.primaryRemainingTargetType();
  assert.ok(primaryTarget !== null);

  rabbitState.addSpiritCharge(100);
  const rabbitRes1 = rabbitState.activateKitsuneSkill(rabbitBoard, () => 0.1);
  assert.ok(rabbitRes1 !== null);
  assert.equal(rabbitRes1!.companionId, 'rabbit');
  assert.equal(rabbitRes1!.bonusMovesGranted, 1);
  assert.equal(rabbitState.movesLeft, movesBefore + 1);
  assert.equal(rabbitRes1!.transmutedCells.length, 3);
  for (const pos of rabbitRes1!.transmutedCells) {
    assert.equal(rabbitBoard.getAt(pos)?.type, primaryTarget);
  }
  assert.equal(rabbitState.lastKitsuneSkillCallout, 'Rabbit Lunar Mochi Blessing!');

  // 2nd activation grants +1 move (total +2), 3rd activation caps bonus moves at +2
  rabbitState.addSpiritCharge(100);
  const rabbitRes2 = rabbitState.activateKitsuneSkill(rabbitBoard, () => 0.2);
  assert.equal(rabbitRes2?.bonusMovesGranted, 1);
  assert.equal(rabbitState.movesLeft, movesBefore + 2);

  rabbitState.addSpiritCharge(100);
  const rabbitRes3 = rabbitState.activateKitsuneSkill(rabbitBoard, () => 0.3);
  assert.equal(rabbitRes3?.bonusMovesGranted, 0);
  assert.equal(rabbitState.movesLeft, movesBefore + 2);
});







