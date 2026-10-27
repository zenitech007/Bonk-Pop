/**
 * Top-level game title constant used across StartScreen, document title, and manifests.
 */
export const kGameTitle = 'Bonk Pop';

/**
 * Ratio of the tile's inner size filled by its vector/sprite icon (75%).
 */
export const kTileIconRatio = 0.75;

/**
 * Centralised constants for sizes, layout bounds, scoring rules, timings, and particle budgets.
 * Mirrors `lib/core/constants.dart` with zero magic numbers.
 */
export const GameConstants = {
  kGameTitle,
  gameTitle: kGameTitle,
  totalLevels: 30,
  progressSchemaVersion: 1,
  progressStorageKey: 'bonk_pop_progress_v1',

  // Grid dimensions
  gridSize: 8,
  minMatchLength: 3,
  tileTypeCount: 5,

  // Tile art & geometry proportions
  tileIconRatio: kTileIconRatio,
  tilePaddingFraction: 0.05,
  tileCornerRadiusFraction: 0.22,
  shapeRadiusFraction: 0.375,
  swipeThresholdFraction: 0.24,

  // Responsive layout constants (Part 1)
  compactMaxShortSide: 600,
  mediumMaxShortSide: 900,
  uiScaleReferenceShortSide: 400,
  minUiScale: 0.8,
  maxUiScale: 1.8,
  minTextScale: 1.0,
  maxTextScale: 1.3,

  maxPortraitContentColumnWidth: 900,
  maxHudContentWidth: 760,
  maxMapColumnWidth: 720,
  maxBoardSide: 720,
  maxBottomBarWidth: 720,
  minTileSize: 34,
  minTouchTarget: 44,

  portraitHudHeightFraction: 0.125,
  minHudHeight: 88,
  maxHudHeight: 190,

  portraitBottomBarHeightFraction: 0.08,
  minBottomBarHeight: 64,
  maxBottomBarHeight: 110,
  compactBottomBarWidthFraction: 0.9,
  regularBottomBarWidthFraction: 0.7,
  portraitBottomMarginFraction: 0.02,
  portraitSideMarginFraction: 0.02,
  portraitBoardGapFraction: 0.02,

  landscapeBoardMaxWidthFraction: 0.5,
  landscapeBoardMarginFraction: 0.04,
  landscapePanelWidthFraction: 0.28,
  maxLandscapePanelWidth: 360,
  minRightPanelFreeSpaceFactor: 140,

  dialogWidthFraction: 0.85,
  minDialogWidth: 280,
  maxDialogWidth: 520,

  // Level generator bounds & balance constants (Step 6 Part 0.1 & Part B)
  minLevelMoves: 14,
  maxLevelMoves: 30,
  minGlowCells: 12,
  maxGlowCells: 40,
  hardLevelInterval: 5,
  firstHardLevel: 10,
  glowTwoLayerStartLevel: 12,
  glowMaxLayersPerMoveRatio: 1.45,
  scorePtsPerMoveEasy: 925,
  scorePtsPerMoveMid: 1040,
  scorePtsPerMoveLate: 1245,
  scorePtsPerMoveHard: 1205,
  scorePtsPerMoveBreather: 1060,
  star2StepPerMove: 270,
  star3StepPerMove: 275,

  // Scoring & level constants (Step 3, Step 5 & Step 6)
  basePointsPerTile: 60,
  maxCascadeMultiplier: 5,
  runOf4Bonus: 120,
  runOf5OrMoreBonus: 300,
  leftoverMoveBonus: 500,
  lowMovesThreshold: 5,
  glowLayerClearedBonus: 100,

  // Special tile activation bonuses (Step 5 Part A.4)
  slashActivationBonus: 120,
  burstActivationBonus: 200,
  orbActivationBonus: 300,
  doubleOrbBonus: 2000,

  // Audio & Settings constants (Step 5 Parts B & C)
  sfxThrottleMs: 60,
  maxSimultaneousSfx: 6,
  musicCrossfadeMs: 500,
  settingsStorageKey: 'bonk_pop_settings_v1',
  settingsSchemaVersion: 1,
  splashMaxWaitMs: 1400,

  // Polish constants (Step 5 Part D & Step 6 Special Tile Redesign)
  idleHintDelayMs: 6000,
  waveDelayMs: 100,
  specialBeamDurationMs: 260,
  specialBurstRingDurationMs: 280,
  screenShakeDurationMs: 180,
  specialStripeCount: 4,
  specialStripeAreaRatio: 0.45,
  specialShineSweepDurationMs: 1800,
  specialTileBorderWidthPx: 2,

  // Sample Level 1 (Score mode)
  level1Moves: 20,
  level1Star1: 3000,
  level1Star2: 6000,
  level1Star3: 9000,

  // Sample Level 2 (Collect mode)
  level2Moves: 25,
  level2GoalA: 20,
  level2GoalB: 15,
  level2Star1: 4000,
  level2Star2: 7000,
  level2Star3: 10000,

  // Sample Level 3 (Collect mode)
  level3Moves: 22,
  level3GoalA: 25,
  level3GoalB: 25,
  level3Star1: 5000,
  level3Star2: 8000,
  level3Star3: 11000,

  // Animation timings (milliseconds)
  swapDurationMs: 200,
  clearDurationMs: 250,
  fallDurationMs: 300,
  shuffleDurationMs: 360,
  cascadePopupDurationMs: 650,
  floatingScoreDurationMs: 750,
  scoreCountUpDurationMs: 300,
  endBannerHoldMs: 1000,
  starPopIntervalMs: 260,
  stepPauseMs: 60,
  mapAutoScrollDurationMs: 550,
  lockedNodeShakeDurationMs: 360,
  mascotBonkDurationMs: 380,

  // Clear pop scale & fall bounce parameters
  clearPopPeakScale: 1.18,
  fallBounceOvershoot: 0.06,

  // Particle budgets (strictly capped for 60 fps on mid-range Android)
  maxBackgroundPetals: 20,
  burstParticlesPerTile: 5,
  maxBurstParticles: 80,

  // Map layout & Spirit Matsuri Lattice constants
  mapNodeVerticalSpacing: 116,
  mapBottomPadding: 110,
  mapTopPadding: 130,
  mapCompletedNodeSize: 62,
  mapCurrentNodeSize: 76,
  mapLockedNodeSize: 58,
  initialSpiritCoins: 150,
  coinsPerStarEarned: 25,
  tierHarmonyChestRewardCoins: 100,
  landmark1Stars: 6,
  landmark2Stars: 15,
  landmark3Stars: 30,
  landmark1ExtraMoves: 1,
  landmark2BonusRatio: 0.1,
  specialMatch4PlusCoins: 2,
  cascadeWaveCoinReward: 3,
  selectedTileScale: 1.06,
  targetPulseDurationMs: 520,
  floatingCoinGainDurationMs: 1100,
  cascadeBannerHoldMs: 950,

  // Phase 3: Asymmetric Elemental Special Tile Signatures & Bento Forge Dock constants
  elementalMaskBonusScore: 150,
  elementalMaskTransmuteCount: 2,
  elementalOnigiriBonusScore: 150,
  elementalOnigiriBottomCrushCount: 2,
  elementalDangoBonusScore: 150,
  elementalLanternBonusScore: 200,
  elementalLanternBonusCoins: 3,
  elementalSakuraBonusScore: 200,
  elementalSakuraBonusMoves: 1,
  maxSakuraBonusMovesPerLevel: 2,
  bentoDockCapacity: 3,
  bentoFuseBonusScore: 500,
  bentoFuseBonusCoins: 5,
  elementalCalloutHoldMs: 1100,

  // Phase 4: Kitsune Spirit Companion Meter & Spirit Coin Economy constants
  spiritChargeMax: 100,
  spiritChargePerMatchedTile: 4,
  spiritChargePerCascadeWave: 15,
  kitsuneSkillClearCount: 4,
  kitsuneSkillBonusScore: 300,
  kitsuneCoinChargeCost: 25,
  timeSlipRewindCoinCost: 15,
  luckyShuffleCoinCost: 20,
  maxFestivalFeverStreak: 5,
  feverStreakChargeBonusPerTier: 20,
  secondWindCoinCost: 40,
  secondWindExtraMoves: 5,
  takeoutBentoCoinCost: 25,
  kitsuneSkillCalloutHoldMs: 1200,

  // Phase 5: Custom Japanese Festival Blockers & Yokai Boss Battle constants
  paperLanternMaxLayers: 3,
  sugarMoldSidesCount: 4,
  sugarMoldBreakCoinReward: 10,
  yokaiBossLevel9Hp: 1000,
  yokaiBossLevel19Hp: 1500,
  yokaiBossLevel30Hp: 2200,
  yokaiBossSpecialDamageMultiplier: 2,
  yokaiBossKitsuneSkillDamage: 250,
  yokaiBossCounterIntervalTurns: 4,
  yokaiBossCurseTileCount: 2,

  // Phase 7: Shrine Gachapon Machine, Spirit Companions & Matsuri Board Themes constants
  gachaponPullCoinCost: 100,
  gachaponDuplicateShardRefund: 40,
  companionMaxRank: 3,
  companionRankMultiplierStep: 0.25,
  tanukiSkillBonusCoins: 8,
  tanukiSkillBonusScore: 300,
  tanukiSkillBossDamage: 250,
  tanukiSkillClearCount: 3,
  shibaSkillBonusScore: 350,
  shibaSkillBossDamage: 350,
  shibaSkillDiagonalClearCount: 4,
  shibaSkillBlockerDamageCount: 4,
  rabbitSkillBonusScore: 350,
  rabbitSkillBossDamage: 250,
  rabbitSkillTransmuteCount: 3,
  maxRabbitBonusMovesPerLevel: 2,

  // Shared UI selection & face colours
  selectionStroke: '#FFE066',
  tileCardFill: 'rgba(255, 249, 252, 0.95)',
  tileCardSelectedFill: '#FFF0F6',
  tileCardBorder: 'rgba(214, 158, 194, 0.35)',
  cuteEyeDark: '#2B192E',
  cuteEyeHighlight: '#FFFFFF',
  cuteBlush: 'rgba(255, 122, 162, 0.55)',
} as const;

export const kSettingsStorageKey = GameConstants.settingsStorageKey;
export const kAudioMinThrottleGapMs = GameConstants.sfxThrottleMs;
export const kAudioMaxConcurrentSounds = GameConstants.maxSimultaneousSfx;
export const kIdleHintDelayMs = GameConstants.idleHintDelayMs;
export const kSpecialWaveDelayMs = GameConstants.waveDelayMs;


