import { GameConstants } from '../core/constants';
import { BentoSlotItem } from './special_tiles';
import { SpecialKind, TileType } from './tile_type';

export enum LevelNodeState {
  locked = 'locked',
  current = 'current',
  completed = 'completed',
}

export type CompanionId = 'kitsune' | 'tanuki' | 'shiba' | 'rabbit';

export const ALL_COMPANION_IDS: readonly CompanionId[] = [
  'kitsune',
  'tanuki',
  'shiba',
  'rabbit',
] as const;

export interface CompanionSpec {
  readonly id: CompanionId;
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly skillName: string;
  readonly calloutText: string;
  readonly description: string;
  readonly baseScore: number;
  readonly baseBossDamage: number;
  readonly bonusCoins: number;
  readonly accentColor: string;
}

export const SPIRIT_COMPANIONS: Readonly<Record<CompanionId, CompanionSpec>> = {
  kitsune: {
    id: 'kitsune',
    name: 'Inari Kitsune',
    shortName: 'Kitsune',
    emoji: '🦊',
    skillName: 'Fox-Fire Barrage',
    calloutText: 'Kitsune Fox-Fire Barrage!',
    description:
      'Clears up to 4 target/high-value tiles, upgrades 1 random standard tile into a Special Tile, awards +300 base score (250 Boss HP damage).',
    baseScore: GameConstants.kitsuneSkillBonusScore,
    baseBossDamage: GameConstants.yokaiBossKitsuneSkillDamage,
    bonusCoins: 0,
    accentColor: '#FF4D79',
  },
  tanuki: {
    id: 'tanuki',
    name: 'Tanuki Bento Chef',
    shortName: 'Tanuki',
    emoji: '🦝',
    skillName: 'Bento Feast Delivery',
    calloutText: 'Tanuki Bento Feast Delivery!',
    description:
      'Adds 1 Special Tile into the first open Bento Dock slot (or upgrades a board tile if full), clears 3 central tiles, +8 🪙 and +300 base score.',
    baseScore: GameConstants.tanukiSkillBonusScore,
    baseBossDamage: GameConstants.tanukiSkillBossDamage,
    bonusCoins: GameConstants.tanukiSkillBonusCoins,
    accentColor: '#FFB703',
  },
  shiba: {
    id: 'shiba',
    name: 'Raijin Thunder Shiba',
    shortName: 'Shiba',
    emoji: '🐕',
    skillName: 'Thunder Bark Chain',
    calloutText: 'Shiba Thunder Bark Chain!',
    description:
      'Clears 4 diagonal tiles, damages/cleanses up to 4 active blockers on the board, deals 350 base Boss HP damage, and awards +350 base score.',
    baseScore: GameConstants.shibaSkillBonusScore,
    baseBossDamage: GameConstants.shibaSkillBossDamage,
    bonusCoins: 0,
    accentColor: '#4CC9F0',
  },
  rabbit: {
    id: 'rabbit',
    name: 'Tsuki Moon Rabbit',
    shortName: 'Rabbit',
    emoji: '🐇',
    skillName: 'Lunar Mochi Blessing',
    calloutText: 'Rabbit Lunar Mochi Blessing!',
    description:
      'Grants +1 bonus move (max +2 per level), converts up to 3 random standard tiles into the primary target tile type, and awards +350 base score.',
    baseScore: GameConstants.rabbitSkillBonusScore,
    baseBossDamage: GameConstants.rabbitSkillBossDamage,
    bonusCoins: 0,
    accentColor: '#C77DFF',
  },
};

export function getCompanionRankMultiplier(rank: number): number {
  const clampedRank = Math.min(
    GameConstants.companionMaxRank,
    Math.max(1, Math.trunc(rank || 1))
  );
  return 1 + (clampedRank - 1) * GameConstants.companionRankMultiplierStep;
}

export type BoardThemeId =
  | 'sakura_twilight'
  | 'cyber_tokyo'
  | 'golden_inari'
  | 'matcha_zen';

export const ALL_BOARD_THEME_IDS: readonly BoardThemeId[] = [
  'sakura_twilight',
  'cyber_tokyo',
  'golden_inari',
  'matcha_zen',
] as const;

export interface BoardThemeSpec {
  readonly id: BoardThemeId;
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly tagline: string;
  readonly gradientCss: string;
  readonly boardBorderColor: string;
  readonly boardGlowShadow: string;
  readonly hudPanelBg: string;
  readonly accentColor: string;
}

export const MATSURI_BOARD_THEMES: Readonly<
  Record<BoardThemeId, BoardThemeSpec>
> = {
  sakura_twilight: {
    id: 'sakura_twilight',
    name: 'Sakura Twilight',
    shortName: 'Sakura',
    emoji: '🌸',
    tagline: 'Lantern-lit shrine dusk under falling cherry blossoms',
    gradientCss:
      'linear-gradient(180deg, #1E102B 0%, #2B1B3D 48%, #3B1F4E 100%)',
    boardBorderColor: '#FFB7C5',
    boardGlowShadow: '0 0 26px rgba(255, 183, 197, 0.35)',
    hudPanelBg: 'rgba(38, 19, 54, 0.92)',
    accentColor: '#FF4D79',
  },
  cyber_tokyo: {
    id: 'cyber_tokyo',
    name: 'Cyber Tokyo Matsuri',
    shortName: 'Cyber Tokyo',
    emoji: '🌆',
    tagline: 'Electric cyan & neon magenta holographic arcade night',
    gradientCss:
      'linear-gradient(180deg, #090D24 0%, #141B41 50%, #24134A 100%)',
    boardBorderColor: '#4CC9F0',
    boardGlowShadow: '0 0 28px rgba(76, 201, 240, 0.5)',
    hudPanelBg: 'rgba(16, 23, 56, 0.92)',
    accentColor: '#4CC9F0',
  },
  golden_inari: {
    id: 'golden_inari',
    name: 'Golden Inari Sanctum',
    shortName: 'Golden Inari',
    emoji: '⛩️',
    tagline: 'Imperial vermilion torii gates and gilded lantern gold',
    gradientCss:
      'linear-gradient(180deg, #2A0F18 0%, #461622 50%, #59251A 100%)',
    boardBorderColor: '#FFD166',
    boardGlowShadow: '0 0 28px rgba(255, 209, 102, 0.5)',
    hudPanelBg: 'rgba(54, 18, 28, 0.92)',
    accentColor: '#FFD166',
  },
  matcha_zen: {
    id: 'matcha_zen',
    name: 'Matcha Bamboo Zen',
    shortName: 'Matcha Zen',
    emoji: '🍵',
    tagline: 'Tranquil emerald bamboo grove and warm lantern tea house',
    gradientCss:
      'linear-gradient(180deg, #0D211D 0%, #16362F 50%, #20473B 100%)',
    boardBorderColor: '#6EE7B7',
    boardGlowShadow: '0 0 26px rgba(110, 231, 183, 0.42)',
    hudPanelBg: 'rgba(18, 44, 38, 0.92)',
    accentColor: '#34D399',
  },
};

export interface GachaPullResult {
  readonly kind:
    | 'unlock_companion'
    | 'upgrade_companion'
    | 'unlock_theme'
    | 'spirit_shard_refund';
  readonly companionId?: CompanionId;
  readonly newRank?: number;
  readonly themeId?: BoardThemeId;
  readonly costPaid: number;
  readonly refundCoins: number;
  readonly headline: string;
  readonly subtext: string;
}

export interface SerializedProgress {
  readonly version: number;
  readonly highestUnlocked: number;
  readonly bestStars: Record<string, number>;
  readonly bestScore: Record<string, number>;
  readonly spiritCoins?: number;
  readonly claimedTiers?: readonly number[];
  readonly festivalFeverStreak?: number;
  readonly carryOverBento?: readonly BentoSlotItem[];
  readonly unlockedCompanions?: Partial<Record<CompanionId, number>>;
  readonly activeCompanionId?: CompanionId;
  readonly unlockedThemes?: readonly BoardThemeId[];
  readonly activeThemeId?: BoardThemeId;
  readonly totalGachaPulls?: number;
}

export interface LatticeTierSpec {
  readonly tier: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly levels: readonly number[];
  readonly isBossTier?: boolean;
  readonly hasHarmonyChest: boolean;
}

export interface ShrineLandmarkSpec {
  readonly id: 'torii_gate' | 'lantern_bridge' | 'kitsune_pavilion';
  readonly index: 1 | 2 | 3;
  readonly name: string;
  readonly requiredStars: number;
  readonly buffLabel: string;
}

export const SHRINE_LANDMARKS: readonly ShrineLandmarkSpec[] = [
  {
    id: 'torii_gate',
    index: 1,
    name: 'Crimson Torii Gate',
    requiredStars: GameConstants.landmark1Stars,
    buffLabel: '+1 Starting Move',
  },
  {
    id: 'lantern_bridge',
    index: 2,
    name: 'Glowing Lantern Bridge',
    requiredStars: GameConstants.landmark2Stars,
    buffLabel: '+10% Score & Coin Bonus',
  },
  {
    id: 'kitsune_pavilion',
    index: 3,
    name: 'Kitsune Spirit Pavilion',
    requiredStars: GameConstants.landmark3Stars,
    buffLabel: 'Free Starting Special Tile',
  },
];

/**
 * Horizontal Tiers of the Non-Linear "Spirit Lantern Lattice".
 * Tiers 1-5 form District 1: Kitsune Shrine (Levels 1-9) with Row Harmony Chests.
 * Tiers 6-14 hold Levels 10-30 above Tier 5 so all 30 levels remain accessible.
 */
export const SPIRIT_LATTICE_TIERS: readonly LatticeTierSpec[] = [
  {
    tier: 1,
    label: 'Tier 1 · Torii Approach',
    shortLabel: 'Tier 1',
    levels: [1],
    hasHarmonyChest: true,
  },
  {
    tier: 2,
    label: 'Tier 2 · Lantern Fork',
    shortLabel: 'Tier 2',
    levels: [2, 3],
    hasHarmonyChest: true,
  },
  {
    tier: 3,
    label: 'Tier 3 · Courtyard Plaza',
    shortLabel: 'Tier 3',
    levels: [4, 5, 6],
    hasHarmonyChest: true,
  },
  {
    tier: 4,
    label: 'Tier 4 · Sacred Bridge',
    shortLabel: 'Tier 4',
    levels: [7, 8],
    hasHarmonyChest: true,
  },
  {
    tier: 5,
    label: 'Tier 5 · Apex Shrine Boss',
    shortLabel: 'Tier 5',
    levels: [9],
    isBossTier: true,
    hasHarmonyChest: true,
  },
  {
    tier: 6,
    label: 'Tier 6 · Upper Terrace I',
    shortLabel: 'Tier 6',
    levels: [10, 11],
    hasHarmonyChest: false,
  },
  {
    tier: 7,
    label: 'Tier 7 · Upper Terrace II',
    shortLabel: 'Tier 7',
    levels: [12, 13, 14],
    hasHarmonyChest: false,
  },
  {
    tier: 8,
    label: 'Tier 8 · Bamboo Ridge',
    shortLabel: 'Tier 8',
    levels: [15, 16],
    hasHarmonyChest: false,
  },
  {
    tier: 9,
    label: 'Tier 9 · Moonlit Pagoda',
    shortLabel: 'Tier 9',
    levels: [17, 18, 19],
    hasHarmonyChest: false,
  },
  {
    tier: 10,
    label: 'Tier 10 · Starlit Crossing',
    shortLabel: 'Tier 10',
    levels: [20, 21],
    hasHarmonyChest: false,
  },
  {
    tier: 11,
    label: 'Tier 11 · Sakura Promenade',
    shortLabel: 'Tier 11',
    levels: [22, 23, 24],
    hasHarmonyChest: false,
  },
  {
    tier: 12,
    label: 'Tier 12 · Fox Spirit Gate',
    shortLabel: 'Tier 12',
    levels: [25, 26],
    hasHarmonyChest: false,
  },
  {
    tier: 13,
    label: 'Tier 13 · Inner Sanctum',
    shortLabel: 'Tier 13',
    levels: [27, 28, 29],
    hasHarmonyChest: false,
  },
  {
    tier: 14,
    label: 'Tier 14 · Grand Matsuri Finale',
    shortLabel: 'Tier 14',
    levels: [30],
    isBossTier: true,
    hasHarmonyChest: false,
  },
];

/**
 * Directed parent -> child spirit-thread connections in the lattice.
 */
export const SPIRIT_LATTICE_EDGES: ReadonlyArray<readonly [number, number]> = [
  // District 1: Kitsune Shrine (Tiers 1 -> 5)
  [1, 2],
  [1, 3],
  [2, 4],
  [2, 5],
  [3, 5],
  [3, 6],
  [4, 7],
  [5, 7],
  [5, 8],
  [6, 8],
  [7, 9],
  [8, 9],
  // Upper tiers (Tiers 6 -> 14)
  [9, 10],
  [9, 11],
  [10, 12],
  [10, 13],
  [11, 13],
  [11, 14],
  [12, 15],
  [13, 15],
  [13, 16],
  [14, 16],
  [15, 17],
  [15, 18],
  [16, 18],
  [16, 19],
  [17, 20],
  [18, 20],
  [18, 21],
  [19, 21],
  [20, 22],
  [20, 23],
  [21, 23],
  [21, 24],
  [22, 25],
  [23, 25],
  [23, 26],
  [24, 26],
  [25, 27],
  [25, 28],
  [26, 28],
  [26, 29],
  [27, 30],
  [28, 30],
  [29, 30],
];

export type TierChestState = 'locked' | 'claimable' | 'claimed';

/**
 * Pure progress model holding unlocked levels, per-level stars, best scores,
 * Spirit Coins, and claimed Row Harmony Chests.
 */
export interface GameProgressParams {
  readonly highestUnlocked?: number;
  readonly bestStars?: Record<number, number>;
  readonly bestScore?: Record<number, number>;
  readonly spiritCoins?: number;
  readonly claimedTiers?: readonly number[];
  readonly festivalFeverStreak?: number;
  readonly carryOverBento?: readonly BentoSlotItem[];
  readonly unlockedCompanions?: Partial<Record<CompanionId, number>>;
  readonly activeCompanionId?: CompanionId;
  readonly unlockedThemes?: readonly BoardThemeId[];
  readonly activeThemeId?: BoardThemeId;
  readonly totalGachaPulls?: number;
}

/**
 * Pure progress model holding unlocked levels, per-level stars, best scores,
 * Spirit Coins, claimed Row Harmony Chests, Spirit Companions, Matsuri Board Themes,
 * and Shrine Gachapon pull history.
 */
export class GameProgress {
  readonly highestUnlocked: number;
  readonly bestStars: Readonly<Record<number, number>>;
  readonly bestScore: Readonly<Record<number, number>>;
  readonly spiritCoins: number;
  readonly claimedTiers: readonly number[];
  readonly festivalFeverStreak: number;
  readonly carryOverBento: readonly BentoSlotItem[];
  readonly unlockedCompanions: Readonly<Record<CompanionId, number>>;
  readonly activeCompanionId: CompanionId;
  readonly unlockedThemes: readonly BoardThemeId[];
  readonly activeThemeId: BoardThemeId;
  readonly totalGachaPulls: number;

  constructor(params?: GameProgressParams) {
    const rawHighest = params?.highestUnlocked ?? 1;
    this.highestUnlocked = Math.min(
      Math.max(Math.trunc(rawHighest), 1),
      GameConstants.totalLevels
    );
    this.bestStars = { ...(params?.bestStars ?? {}) };
    this.bestScore = { ...(params?.bestScore ?? {}) };
    this.spiritCoins =
      params?.spiritCoins !== undefined && Number.isFinite(params.spiritCoins)
        ? Math.max(0, Math.trunc(params.spiritCoins))
        : GameConstants.initialSpiritCoins;
    this.claimedTiers = Array.from(new Set(params?.claimedTiers ?? [])).sort(
      (a, b) => a - b
    );
    const rawStreak = params?.festivalFeverStreak ?? 0;
    this.festivalFeverStreak = Number.isFinite(rawStreak)
      ? Math.min(
          GameConstants.maxFestivalFeverStreak,
          Math.max(0, Math.trunc(rawStreak))
        )
      : 0;
    this.carryOverBento = (params?.carryOverBento ?? []).slice(
      0,
      GameConstants.bentoDockCapacity
    );

    const rawCompanions = params?.unlockedCompanions ?? {};
    const clampRank = (val: unknown, fallback: number): number => {
      if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
      return Math.min(
        GameConstants.companionMaxRank,
        Math.max(0, Math.trunc(val))
      );
    };
    const kitsuneRank = Math.max(1, clampRank(rawCompanions.kitsune, 1));
    const normalizedCompanions: Record<CompanionId, number> = {
      kitsune: kitsuneRank,
      tanuki: clampRank(rawCompanions.tanuki, 0),
      shiba: clampRank(rawCompanions.shiba, 0),
      rabbit: clampRank(rawCompanions.rabbit, 0),
    };
    this.unlockedCompanions = normalizedCompanions;

    const requestedCompanion = params?.activeCompanionId;
    this.activeCompanionId =
      requestedCompanion &&
      ALL_COMPANION_IDS.includes(requestedCompanion) &&
      normalizedCompanions[requestedCompanion] >= 1
        ? requestedCompanion
        : 'kitsune';

    const rawThemes = params?.unlockedThemes ?? ['sakura_twilight'];
    const validThemes = Array.from(
      new Set<BoardThemeId>([
        'sakura_twilight',
        ...rawThemes.filter((t): t is BoardThemeId =>
          ALL_BOARD_THEME_IDS.includes(t)
        ),
      ])
    );
    this.unlockedThemes = validThemes;

    const requestedTheme = params?.activeThemeId;
    this.activeThemeId =
      requestedTheme && validThemes.includes(requestedTheme)
        ? requestedTheme
        : 'sakura_twilight';

    const rawPulls = params?.totalGachaPulls ?? 0;
    this.totalGachaPulls =
      typeof rawPulls === 'number' && Number.isFinite(rawPulls)
        ? Math.max(0, Math.trunc(rawPulls))
        : 0;
  }

  private copyWith(overrides: GameProgressParams): GameProgress {
    return new GameProgress({
      highestUnlocked: overrides.highestUnlocked ?? this.highestUnlocked,
      bestStars: overrides.bestStars ?? { ...this.bestStars },
      bestScore: overrides.bestScore ?? { ...this.bestScore },
      spiritCoins: overrides.spiritCoins ?? this.spiritCoins,
      claimedTiers: overrides.claimedTiers ?? [...this.claimedTiers],
      festivalFeverStreak:
        overrides.festivalFeverStreak ?? this.festivalFeverStreak,
      carryOverBento: overrides.carryOverBento ?? [...this.carryOverBento],
      unlockedCompanions:
        overrides.unlockedCompanions ?? { ...this.unlockedCompanions },
      activeCompanionId: overrides.activeCompanionId ?? this.activeCompanionId,
      unlockedThemes: overrides.unlockedThemes ?? [...this.unlockedThemes],
      activeThemeId: overrides.activeThemeId ?? this.activeThemeId,
      totalGachaPulls: overrides.totalGachaPulls ?? this.totalGachaPulls,
    });
  }

  static initial(): GameProgress {
    return new GameProgress();
  }

  get totalStars(): number {
    let sum = 0;
    for (const val of Object.values(this.bestStars)) {
      sum += Math.min(Math.max(val, 0), 3);
    }
    return sum;
  }

  get startingSpiritChargeBonus(): number {
    return Math.min(
      GameConstants.spiritChargeMax,
      this.festivalFeverStreak * GameConstants.feverStreakChargeBonusPerTier
    );
  }

  get takeoutBentoCost(): number {
    return this.festivalFeverStreak >= GameConstants.maxFestivalFeverStreak
      ? 0
      : GameConstants.takeoutBentoCoinCost;
  }

  get gachaPullCost(): number {
    return this.totalGachaPulls === 0 ? 0 : GameConstants.gachaponPullCoinCost;
  }

  get activeCompanionRank(): number {
    return Math.max(1, this.unlockedCompanions[this.activeCompanionId] ?? 1);
  }

  companionRankFor(id: CompanionId): number {
    return this.unlockedCompanions[id] ?? 0;
  }

  isCompanionUnlocked(id: CompanionId): boolean {
    return this.companionRankFor(id) >= 1;
  }

  isThemeUnlocked(id: BoardThemeId): boolean {
    return this.unlockedThemes.includes(id);
  }

  equipCompanion(id: CompanionId): GameProgress {
    if (!ALL_COMPANION_IDS.includes(id) || !this.isCompanionUnlocked(id)) {
      return this;
    }
    if (this.activeCompanionId === id) return this;
    return this.copyWith({ activeCompanionId: id });
  }

  equipTheme(id: BoardThemeId): GameProgress {
    if (!ALL_BOARD_THEME_IDS.includes(id) || !this.isThemeUnlocked(id)) {
      return this;
    }
    if (this.activeThemeId === id) return this;
    return this.copyWith({ activeThemeId: id });
  }

  /**
   * Executes a Shrine Gachapon Capsule Pull:
   * - First pull is FREE (`0 🪙`) (`totalGachaPulls === 0`); subsequent pulls cost `100 🪙`.
   * - Prioritizes unlocking an unowned Companion (`tanuki`, `shiba`, `rabbit`) or Board Theme
   *   (`cyber_tokyo`, `golden_inari`, `matcha_zen`), or upgrading an owned Companion's Star Rank (`1 -> 2 -> 3`).
   * - If all 4 companions are Rank 3 and all 4 themes are unlocked, grants a `+40 🪙 Spirit Shard` refund.
   */
  performGachaPull(
    rngOrIndex?: (() => number) | number
  ): { progress: GameProgress; result: GachaPullResult } | null {
    const cost = this.gachaPullCost;
    if (this.spiritCoins < cost) {
      return null;
    }

    type GachaCandidate =
      | { readonly kind: 'unlock_companion'; readonly companionId: CompanionId }
      | { readonly kind: 'unlock_theme'; readonly themeId: BoardThemeId }
      | {
          readonly kind: 'upgrade_companion';
          readonly companionId: CompanionId;
          readonly newRank: number;
        };

    const unownedCompanions: GachaCandidate[] = ALL_COMPANION_IDS.filter(
      (id) => this.companionRankFor(id) === 0
    ).map((companionId) => ({ kind: 'unlock_companion', companionId }));

    const unownedThemes: GachaCandidate[] = ALL_BOARD_THEME_IDS.filter(
      (id) => !this.isThemeUnlocked(id)
    ).map((themeId) => ({ kind: 'unlock_theme', themeId }));

    const upgradeableCompanions: GachaCandidate[] = ALL_COMPANION_IDS.filter(
      (id) => {
        const rank = this.companionRankFor(id);
        return rank >= 1 && rank < GameConstants.companionMaxRank;
      }
    ).map((companionId) => ({
      kind: 'upgrade_companion',
      companionId,
      newRank: this.companionRankFor(companionId) + 1,
    }));

    // Prioritize unlocking unowned companions & themes first, then upgrading companion Star Ranks (1 -> 2 -> 3)
    const primaryPool: GachaCandidate[] = [
      ...unownedCompanions,
      ...unownedThemes,
    ];
    const activePool: GachaCandidate[] =
      primaryPool.length > 0 ? primaryPool : upgradeableCompanions;

    const coinsAfterCost = this.spiritCoins - cost;
    const nextPulls = this.totalGachaPulls + 1;

    if (activePool.length === 0) {
      const refund = GameConstants.gachaponDuplicateShardRefund;
      const result: GachaPullResult = {
        kind: 'spirit_shard_refund',
        costPaid: cost,
        refundCoins: refund,
        headline: '✨ Max Shrine Mastery! +40 🪙 Spirit Shard Refund!',
        subtext:
          'All Spirit Companions are ★3 and all Matsuri Themes are unlocked.',
      };
      const nextProgress = this.copyWith({
        spiritCoins: coinsAfterCost + refund,
        totalGachaPulls: nextPulls,
      });
      return { progress: nextProgress, result };
    }

    let pickedIndex = 0;
    if (typeof rngOrIndex === 'number' && Number.isFinite(rngOrIndex)) {
      pickedIndex =
        ((Math.trunc(rngOrIndex) % activePool.length) + activePool.length) %
        activePool.length;
    } else if (typeof rngOrIndex === 'function') {
      const r = Math.max(0, Math.min(0.999999, rngOrIndex()));
      pickedIndex = Math.floor(r * activePool.length);
    }

    const picked = activePool[pickedIndex];
    if (picked.kind === 'unlock_companion') {
      const spec = SPIRIT_COMPANIONS[picked.companionId];
      const nextCompanions = {
        ...this.unlockedCompanions,
        [picked.companionId]: 1,
      };
      const result: GachaPullResult = {
        kind: 'unlock_companion',
        companionId: picked.companionId,
        newRank: 1,
        costPaid: cost,
        refundCoins: 0,
        headline: `${spec.emoji} New Spirit Companion: ${spec.name} (★1)!`,
        subtext: `${spec.skillName}: ${spec.description}`,
      };
      const nextProgress = this.copyWith({
        spiritCoins: coinsAfterCost,
        unlockedCompanions: nextCompanions,
        totalGachaPulls: nextPulls,
      });
      return { progress: nextProgress, result };
    }

    if (picked.kind === 'unlock_theme') {
      const spec = MATSURI_BOARD_THEMES[picked.themeId];
      const nextThemes = [...this.unlockedThemes, picked.themeId];
      const result: GachaPullResult = {
        kind: 'unlock_theme',
        themeId: picked.themeId,
        costPaid: cost,
        refundCoins: 0,
        headline: `${spec.emoji} New Matsuri Board Theme: ${spec.name}!`,
        subtext: spec.tagline,
      };
      const nextProgress = this.copyWith({
        spiritCoins: coinsAfterCost,
        unlockedThemes: nextThemes,
        totalGachaPulls: nextPulls,
      });
      return { progress: nextProgress, result };
    }

    // upgrade_companion
    const spec = SPIRIT_COMPANIONS[picked.companionId];
    const nextCompanions = {
      ...this.unlockedCompanions,
      [picked.companionId]: picked.newRank,
    };
    const multPct = Math.round(
      getCompanionRankMultiplier(picked.newRank) * 100
    );
    const result: GachaPullResult = {
      kind: 'upgrade_companion',
      companionId: picked.companionId,
      newRank: picked.newRank,
      costPaid: cost,
      refundCoins: 0,
      headline: `${spec.emoji} Star Rank Up! ${spec.name} reached ★${picked.newRank}!`,
      subtext: `Skill score & Boss HP damage boosted to ${multPct}% (${getCompanionRankMultiplier(picked.newRank).toFixed(2)}x)!`,
    };
    const nextProgress = this.copyWith({
      spiritCoins: coinsAfterCost,
      unlockedCompanions: nextCompanions,
      totalGachaPulls: nextPulls,
    });
    return { progress: nextProgress, result };
  }

  /**
   * Returns the list of Milestone Yokai Boss levels (9, 19, 30) defeated by the player.
   */
  get bossTrophies(): readonly number[] {
    return [9, 19, 30].filter((lvl) => this.bestStarsFor(lvl) >= 1);
  }

  hasBossTrophy(levelNumber: number): boolean {
    return (
      (levelNumber === 9 || levelNumber === 19 || levelNumber === 30) &&
      this.bestStarsFor(levelNumber) >= 1
    );
  }

  bestStarsFor(levelNumber: number): number {
    return Math.min(Math.max(this.bestStars[levelNumber] ?? 0, 0), 3);
  }

  bestScoreFor(levelNumber: number): number {
    return Math.max(0, this.bestScore[levelNumber] ?? 0);
  }

  isUnlocked(levelNumber: number): boolean {
    return levelNumber >= 1 && levelNumber <= this.highestUnlocked;
  }

  nodeStateFor(levelNumber: number): LevelNodeState {
    if (levelNumber > this.highestUnlocked) {
      return LevelNodeState.locked;
    }
    if (this.bestStarsFor(levelNumber) > 0) {
      return LevelNodeState.completed;
    }
    return LevelNodeState.current;
  }

  /**
   * Non-linear branching unlock evaluation for the Spirit Lantern Lattice:
   * - Tier 1 (Level 1): Always unlocked.
   * - Tier 2 (Levels 2 & 3): Both unlock as soon as Level 1 is completed.
   * - Tier 3 (Levels 4, 5, 6): Level 2 unlocks 4 & 5; Level 3 unlocks 5 & 6.
   * - Tier 4 (Levels 7 & 8): Unlock when any 2 nodes in Tier 3 (4, 5, 6) are cleared.
   * - Tier 5 (Level 9 Apex Boss): Unlocks when either Level 7 or Level 8 is cleared.
   * - Upper Tiers (Levels 10..30): Follow parent completion or `highestUnlocked`.
   */
  isLatticeUnlocked(levelNumber: number): boolean {
    if (levelNumber < 1 || levelNumber > GameConstants.totalLevels) {
      return false;
    }
    if (levelNumber === 1) return true;
    if (this.bestStarsFor(levelNumber) > 0) return true;
    // Support debug "Unlock All Levels"
    if (this.highestUnlocked >= GameConstants.totalLevels) return true;

    if (levelNumber === 2 || levelNumber === 3) {
      return this.bestStarsFor(1) > 0;
    }
    if (levelNumber === 4) {
      return this.bestStarsFor(2) > 0;
    }
    if (levelNumber === 5) {
      return this.bestStarsFor(2) > 0 || this.bestStarsFor(3) > 0;
    }
    if (levelNumber === 6) {
      return this.bestStarsFor(3) > 0;
    }
    if (levelNumber === 7 || levelNumber === 8) {
      const tier3Cleared = [4, 5, 6].filter(
        (lvl) => this.bestStarsFor(lvl) > 0
      ).length;
      return tier3Cleared >= 2;
    }
    if (levelNumber === 9) {
      return this.bestStarsFor(7) > 0 || this.bestStarsFor(8) > 0;
    }

    // Levels 10..30: check if any parent in SPIRIT_LATTICE_EDGES is completed, or linear highestUnlocked
    const parents = SPIRIT_LATTICE_EDGES.filter(
      ([, child]) => child === levelNumber
    ).map(([parent]) => parent);
    if (parents.some((p) => this.bestStarsFor(p) > 0)) {
      return true;
    }
    return levelNumber <= this.highestUnlocked;
  }

  latticeNodeStateFor(levelNumber: number): LevelNodeState {
    if (this.bestStarsFor(levelNumber) > 0) {
      return LevelNodeState.completed;
    }
    if (this.isLatticeUnlocked(levelNumber)) {
      return LevelNodeState.current;
    }
    return LevelNodeState.locked;
  }

  /**
   * Returns true if a spirit-thread edge `(fromLevel -> toLevel)` is unlocked/active.
   */
  isLatticeEdgeUnlocked(fromLevel: number, toLevel: number): boolean {
    if (this.highestUnlocked >= GameConstants.totalLevels) return true;
    return (
      this.bestStarsFor(fromLevel) > 0 && this.isLatticeUnlocked(toLevel)
    );
  }

  /**
   * Highest currently playable (or most recently unlocked) node in the lattice,
   * used to position the floating Kitsune Mascot badge and initial scroll.
   */
  get highestActiveLatticeLevel(): number {
    let highestPlayable = 1;
    for (let lvl = 1; lvl <= GameConstants.totalLevels; lvl++) {
      const state = this.latticeNodeStateFor(lvl);
      if (state === LevelNodeState.current) {
        highestPlayable = lvl;
      }
    }
    return highestPlayable;
  }

  isLandmarkUnlocked(landmarkIndex: 1 | 2 | 3): boolean {
    const spec = SHRINE_LANDMARKS.find((l) => l.index === landmarkIndex);
    if (!spec) return false;
    return this.totalStars >= spec.requiredStars;
  }

  isTierComplete(tierNumber: number): boolean {
    const tierSpec = SPIRIT_LATTICE_TIERS.find((t) => t.tier === tierNumber);
    if (!tierSpec) return false;
    return tierSpec.levels.every((lvl) => this.bestStarsFor(lvl) >= 1);
  }

  getTierChestState(tierNumber: number): TierChestState {
    if (this.claimedTiers.includes(tierNumber)) {
      return 'claimed';
    }
    if (this.isTierComplete(tierNumber)) {
      return 'claimable';
    }
    return 'locked';
  }

  claimTierChest(tierNumber: number): GameProgress {
    if (this.getTierChestState(tierNumber) !== 'claimable') {
      return this;
    }
    return this.copyWith({
      spiritCoins:
        this.spiritCoins + GameConstants.tierHarmonyChestRewardCoins,
      claimedTiers: [...this.claimedTiers, tierNumber],
    });
  }

  addSpiritCoins(amount: number): GameProgress {
    const cleanAmount = Math.max(0, Math.trunc(amount));
    if (cleanAmount <= 0) return this;
    return this.copyWith({
      spiritCoins: this.spiritCoins + cleanAmount,
    });
  }

  canAffordCoins(amount: number): boolean {
    const cleanCost = Math.max(0, Math.trunc(amount));
    return this.spiritCoins >= cleanCost;
  }

  spendSpiritCoins(amount: number): GameProgress {
    const cleanCost = Math.max(0, Math.trunc(amount));
    if (cleanCost <= 0) return this;
    if (this.spiritCoins < cleanCost) return this;
    return this.copyWith({
      spiritCoins: this.spiritCoins - cleanCost,
    });
  }

  withFeverStreak(streak: number): GameProgress {
    const clamped = Math.min(
      GameConstants.maxFestivalFeverStreak,
      Math.max(0, Math.trunc(streak))
    );
    if (clamped === this.festivalFeverStreak) return this;
    return this.copyWith({
      festivalFeverStreak: clamped,
    });
  }

  packTakeoutBento(
    items: readonly BentoSlotItem[],
    feverStreakOverride?: number
  ): GameProgress {
    if (items.length === 0) return this;
    const effectiveStreak =
      feverStreakOverride !== undefined
        ? feverStreakOverride
        : this.festivalFeverStreak;
    const cost =
      effectiveStreak >= GameConstants.maxFestivalFeverStreak
        ? 0
        : GameConstants.takeoutBentoCoinCost;
    if (this.spiritCoins < cost) return this;
    return this.copyWith({
      spiritCoins: this.spiritCoins - cost,
      carryOverBento: items.slice(0, GameConstants.bentoDockCapacity),
    });
  }

  clearCarryOverBento(): GameProgress {
    if (this.carryOverBento.length === 0) return this;
    return this.copyWith({
      carryOverBento: [],
    });
  }

  resolveActiveBuffs(equippedBoosters?: readonly string[]): {
    readonly extraMoves: boolean;
    readonly scoreAndCoinBonus: boolean;
    readonly startingSpecialTile: boolean;
    readonly activeBadges: ReadonlyArray<{
      readonly id: 'extra_moves' | 'score_fan' | 'spirit_special';
      readonly label: string;
      readonly shortLabel: string;
    }>;
  } {
    const set = new Set(equippedBoosters ?? []);
    const extraMoves =
      this.isLandmarkUnlocked(1) || set.has('extra_moves');
    const scoreAndCoinBonus =
      this.isLandmarkUnlocked(2) || set.has('score_fan');
    const startingSpecialTile =
      this.isLandmarkUnlocked(3) || set.has('spirit_special');

    const activeBadges: Array<{
      readonly id: 'extra_moves' | 'score_fan' | 'spirit_special';
      readonly label: string;
      readonly shortLabel: string;
    }> = [];

    if (extraMoves) {
      activeBadges.push({
        id: 'extra_moves',
        label: '+1 Move',
        shortLabel: '+1 Move',
      });
    }
    if (scoreAndCoinBonus) {
      activeBadges.push({
        id: 'score_fan',
        label: '+10% Score & Coins',
        shortLabel: '+10% Score/🪙',
      });
    }
    if (startingSpecialTile) {
      activeBadges.push({
        id: 'spirit_special',
        label: 'Starting Special Tile',
        shortLabel: 'Special Tile',
      });
    }

    return {
      extraMoves,
      scoreAndCoinBonus,
      startingSpecialTile,
      activeBadges,
    };
  }

  recordWin(params: {
    levelNumber: number;
    score: number;
    stars: number;
  }): GameProgress {
    const { levelNumber, score, stars } = params;
    if (levelNumber < 1 || levelNumber > GameConstants.totalLevels) {
      return this;
    }
    const earnedStars = Math.min(Math.max(Math.trunc(stars), 1), 3);
    const nextUnlocked = Math.max(
      this.highestUnlocked,
      Math.min(GameConstants.totalLevels, levelNumber + 1)
    );

    const updatedStars: Record<number, number> = { ...this.bestStars };
    updatedStars[levelNumber] = Math.max(
      this.bestStarsFor(levelNumber),
      earnedStars
    );

    const updatedScores: Record<number, number> = { ...this.bestScore };
    updatedScores[levelNumber] = Math.max(
      this.bestScoreFor(levelNumber),
      Math.max(0, Math.trunc(score))
    );

    const baseCoinReward = earnedStars * GameConstants.coinsPerStarEarned;
    const coinBonus =
      this.totalStars >= GameConstants.landmark2Stars
        ? Math.round(baseCoinReward * GameConstants.landmark2BonusRatio)
        : 0;

    const nextStreak = Math.min(
      GameConstants.maxFestivalFeverStreak,
      this.festivalFeverStreak + 1
    );

    return this.copyWith({
      highestUnlocked: nextUnlocked,
      bestStars: updatedStars,
      bestScore: updatedScores,
      spiritCoins: this.spiritCoins + baseCoinReward + coinBonus,
      festivalFeverStreak: nextStreak,
    });
  }

  recordLoss(_params?: { levelNumber: number; score: number }): GameProgress {
    if (this.festivalFeverStreak === 0) return this;
    return this.copyWith({
      festivalFeverStreak: 0,
    });
  }

  withAllLevelsUnlocked(): GameProgress {
    return this.copyWith({
      highestUnlocked: GameConstants.totalLevels,
    });
  }

  toJson(): SerializedProgress {
    const starsOut: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.bestStars)) {
      starsOut[String(k)] = v;
    }
    const scoresOut: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.bestScore)) {
      scoresOut[String(k)] = v;
    }
    return {
      version: GameConstants.progressSchemaVersion,
      highestUnlocked: this.highestUnlocked,
      bestStars: starsOut,
      bestScore: scoresOut,
      spiritCoins: this.spiritCoins,
      claimedTiers: [...this.claimedTiers],
      festivalFeverStreak: this.festivalFeverStreak,
      carryOverBento: [...this.carryOverBento],
      unlockedCompanions: { ...this.unlockedCompanions },
      activeCompanionId: this.activeCompanionId,
      unlockedThemes: [...this.unlockedThemes],
      activeThemeId: this.activeThemeId,
      totalGachaPulls: this.totalGachaPulls,
    };
  }

  static fromJson(raw: unknown): GameProgress {
    if (!raw || typeof raw !== 'object') {
      return GameProgress.initial();
    }
    const obj = raw as Record<string, unknown>;
    if (
      obj.version !== undefined &&
      obj.version !== GameConstants.progressSchemaVersion
    ) {
      return GameProgress.initial();
    }

    const rawHighest = obj.highestUnlocked;
    const highestUnlocked =
      typeof rawHighest === 'number' && Number.isFinite(rawHighest)
        ? Math.min(
            Math.max(Math.trunc(rawHighest), 1),
            GameConstants.totalLevels
          )
        : 1;

    const bestStars: Record<number, number> = {};
    const starsSource =
      obj.bestStars && typeof obj.bestStars === 'object'
        ? obj.bestStars
        : obj.stars && typeof obj.stars === 'object'
        ? obj.stars
        : null;
    if (starsSource) {
      for (const [key, val] of Object.entries(
        starsSource as Record<string, unknown>
      )) {
        const lvl = Number.parseInt(key, 10);
        if (
          Number.isInteger(lvl) &&
          lvl >= 1 &&
          lvl <= GameConstants.totalLevels &&
          typeof val === 'number' &&
          Number.isFinite(val)
        ) {
          bestStars[lvl] = Math.min(Math.max(Math.trunc(val), 0), 3);
        }
      }
    }

    const bestScore: Record<number, number> = {};
    const scoresSource =
      obj.bestScore && typeof obj.bestScore === 'object'
        ? obj.bestScore
        : obj.scores && typeof obj.scores === 'object'
        ? obj.scores
        : null;
    if (scoresSource) {
      for (const [key, val] of Object.entries(
        scoresSource as Record<string, unknown>
      )) {
        const lvl = Number.parseInt(key, 10);
        if (
          Number.isInteger(lvl) &&
          lvl >= 1 &&
          lvl <= GameConstants.totalLevels &&
          typeof val === 'number' &&
          Number.isFinite(val) &&
          val >= 0
        ) {
          bestScore[lvl] = Math.trunc(val);
        }
      }
    }

    const spiritCoins =
      typeof obj.spiritCoins === 'number' && Number.isFinite(obj.spiritCoins)
        ? Math.max(0, Math.trunc(obj.spiritCoins))
        : GameConstants.initialSpiritCoins;

    const claimedTiers: number[] = [];
    if (Array.isArray(obj.claimedTiers)) {
      for (const item of obj.claimedTiers) {
        if (
          typeof item === 'number' &&
          Number.isInteger(item) &&
          item >= 1 &&
          item <= 14
        ) {
          claimedTiers.push(item);
        }
      }
    }

    const festivalFeverStreak =
      typeof obj.festivalFeverStreak === 'number' &&
      Number.isFinite(obj.festivalFeverStreak)
        ? Math.min(
            GameConstants.maxFestivalFeverStreak,
            Math.max(0, Math.trunc(obj.festivalFeverStreak))
          )
        : 0;

    const carryOverBento: BentoSlotItem[] = [];
    if (Array.isArray(obj.carryOverBento)) {
      for (const rawItem of obj.carryOverBento) {
        if (rawItem && typeof rawItem === 'object') {
          const itemObj = rawItem as Record<string, unknown>;
          if (
            typeof itemObj.id === 'string' &&
            typeof itemObj.tileType === 'string' &&
            typeof itemObj.specialType === 'string'
          ) {
            carryOverBento.push({
              id: itemObj.id,
              tileType: itemObj.tileType as TileType,
              specialType: itemObj.specialType as SpecialKind,
            });
          }
        }
      }
    }

    const unlockedCompanions: Partial<Record<CompanionId, number>> = {};
    if (obj.unlockedCompanions && typeof obj.unlockedCompanions === 'object') {
      const compObj = obj.unlockedCompanions as Record<string, unknown>;
      for (const id of ALL_COMPANION_IDS) {
        const r = compObj[id];
        if (typeof r === 'number' && Number.isFinite(r)) {
          unlockedCompanions[id] = Math.min(
            GameConstants.companionMaxRank,
            Math.max(0, Math.trunc(r))
          );
        }
      }
    }

    const activeCompanionId =
      typeof obj.activeCompanionId === 'string' &&
      ALL_COMPANION_IDS.includes(obj.activeCompanionId as CompanionId)
        ? (obj.activeCompanionId as CompanionId)
        : 'kitsune';

    const unlockedThemes: BoardThemeId[] = [];
    if (Array.isArray(obj.unlockedThemes)) {
      for (const rawTheme of obj.unlockedThemes) {
        if (
          typeof rawTheme === 'string' &&
          ALL_BOARD_THEME_IDS.includes(rawTheme as BoardThemeId)
        ) {
          unlockedThemes.push(rawTheme as BoardThemeId);
        }
      }
    }

    const activeThemeId =
      typeof obj.activeThemeId === 'string' &&
      ALL_BOARD_THEME_IDS.includes(obj.activeThemeId as BoardThemeId)
        ? (obj.activeThemeId as BoardThemeId)
        : 'sakura_twilight';

    const totalGachaPulls =
      typeof obj.totalGachaPulls === 'number' &&
      Number.isFinite(obj.totalGachaPulls)
        ? Math.max(0, Math.trunc(obj.totalGachaPulls))
        : 0;

    return new GameProgress({
      highestUnlocked,
      bestStars,
      bestScore,
      spiritCoins,
      claimedTiers,
      festivalFeverStreak,
      carryOverBento,
      unlockedCompanions,
      activeCompanionId,
      unlockedThemes,
      activeThemeId,
      totalGachaPulls,
    });
  }
}
