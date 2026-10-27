import { GameConstants } from '../core/constants';
import {
  ActivatedSpecial,
  BlockerStepOutcome,
  Board,
  FestivalBlockerState,
  GridPos,
  ResolveStep,
  SpecialActivationWave,
} from './board';
import {
  FestivalBlockerSpec,
  LevelConfig,
  LevelMode,
} from './level_config';
import {
  ALL_COMPANION_IDS,
  CompanionId,
  getCompanionRankMultiplier,
  SPIRIT_COMPANIONS,
} from './progress';
import { Scoring } from './scoring';
import {
  applyElementalSignature,
  BentoSlotItem,
  computeSuperMatsuriCrossCells,
  ElementalSignatureResult,
  pickNonMatchingStandardTile,
} from './special_tiles';
import { SpecialKind, Tile, TileType } from './tile_type';

export enum GameStatus {
  idle = 'idle',
  resolving = 'resolving',
  won = 'won',
  lost = 'lost',
}

export interface GlowRemovalEvent {
  readonly pos: GridPos;
  readonly previousLayers: number;
  readonly newLayers: number;
}

export interface LevelBuffOptions {
  readonly extraMoves?: boolean;
  readonly scoreAndCoinBonus?: boolean;
  readonly startingSpecialTile?: boolean;
  readonly festivalFeverStreak?: number;
  readonly carryOverBento?: readonly BentoSlotItem[];
  readonly activeCompanionId?: CompanionId;
  readonly companionRank?: number;
}

export interface TurnSnapshot {
  readonly boardGrid: (Tile | null)[][];
  readonly movesLeft: number;
  readonly score: number;
  readonly collectProgress: Record<string, number>;
  readonly glowGrid: number[][];
  readonly spiritCharge: number;
  readonly sakuraBonusMovesGained: number;
  readonly bentoDock: (BentoSlotItem | null)[];
  readonly stars: number;
  readonly yokaiBossHp: number;
  readonly bossTurnCounter: number;
  readonly blockers: FestivalBlockerState[];
}

export interface KitsuneSkillActivationResult {
  readonly companionId: CompanionId;
  readonly companionRank: number;
  readonly rankMultiplier: number;
  readonly clearedCells: GridPos[];
  readonly upgradedCell: GridPos | null;
  readonly upgradedTile: Tile | null;
  readonly bonusScore: number;
  readonly bonusCoins: number;
  readonly bonusMovesGranted: number;
  readonly bentoSlotAdded: BentoSlotItem | null;
  readonly blockersDamagedCount: number;
  readonly transmutedCells: GridPos[];
  readonly bossDamageDealt: number;
  readonly calloutText: string;
}

/**
 * Calculates Kitsune Spirit Charge gained for a move:
 * - Each matched tile adds +4 charge (`GameConstants.spiritChargePerMatchedTile`)
 * - Each cascade wave (`cascadeDepth >= 2`) adds +15 charge (`GameConstants.spiritChargePerCascadeWave`)
 */
export function calculateSpiritChargeGain(params: {
  matchedTileCount: number;
  cascadeDepth: number;
}): number {
  const { matchedTileCount, cascadeDepth } = params;
  const tileCharge =
    Math.max(0, Math.trunc(matchedTileCount)) *
    GameConstants.spiritChargePerMatchedTile;
  const cascadeWaves = cascadeDepth >= 2 ? cascadeDepth - 1 : 0;
  const cascadeCharge =
    cascadeWaves * GameConstants.spiritChargePerCascadeWave;
  return tileCharge + cascadeCharge;
}

/**
 * Returns true if any resolve step in a move created a 4+ special tile,
 * matched a run of 4 or more, or triggered a special activation wave.
 */
export function hasMoveSpecial4PlusMatch(
  steps: readonly ResolveStep[]
): boolean {
  for (const step of steps) {
    if (step.createdSpecials.length > 0) return true;
    if (step.matchRuns.some((r) => r.length >= 4)) return true;
    if (step.waves && step.waves.some((w) => w.activated.length > 0)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the Matsuri Cascade Combo Callout for a move:
 * - 2 waves (or 4+ special match): "2x Spirit Chain!"
 * - 3 waves: "3x Festival Fever!"
 * - 4+ waves: "4x+ Kitsune Overload!"
 */
export function getCascadeComboCallout(params: {
  cascadeDepth: number;
  has4PlusMatch: boolean;
}): string | null {
  const { cascadeDepth, has4PlusMatch } = params;
  if (cascadeDepth >= 4) {
    return '4x+ Kitsune Overload!';
  }
  if (cascadeDepth === 3) {
    return '3x Festival Fever!';
  }
  if (cascadeDepth === 2 || (cascadeDepth >= 1 && has4PlusMatch)) {
    return '2x Spirit Chain!';
  }
  return null;
}

/**
 * Calculates Spirit Coins awarded for a single move:
 * - +2 🪙 for a 4+ match (`has4PlusMatch`)
 * - +3 🪙 × (cascadeDepth - 1) for cascade chains (`cascadeDepth >= 2`)
 * - Boosted by +10% (rounded up) when Shrine Landmark 2 (`scoreAndCoinBonus`) is active.
 */
export function calculateMoveSpiritCoins(params: {
  cascadeDepth: number;
  has4PlusMatch: boolean;
  scoreAndCoinBonus?: boolean;
}): number {
  const { cascadeDepth, has4PlusMatch, scoreAndCoinBonus = false } = params;
  const matchCoins = has4PlusMatch ? GameConstants.specialMatch4PlusCoins : 0;
  const cascadeCoins =
    cascadeDepth >= 2
      ? GameConstants.cascadeWaveCoinReward * (cascadeDepth - 1)
      : 0;
  const rawCoins = matchCoins + cascadeCoins;
  if (rawCoins <= 0) return 0;
  return scoreAndCoinBonus
    ? Math.ceil(rawCoins * (1 + GameConstants.landmark2BonusRatio))
    : rawCoins;
}

/**
 * Pure observable level & game state.
 */
export class GameState {
  private _level: LevelConfig;
  private _buffOptions: LevelBuffOptions;
  private _movesLeft: number;
  private _score = 0;
  private _collectProgress: Record<string, number>;
  private _glowGrid: number[][];
  private _initialGlowLayers = 0;
  private _lastStepGlowRemovals: GlowRemovalEvent[][] = [];
  private _lastMoveCascadeDepth = 0;
  private _lastMoveHas4PlusMatch = false;
  private _lastMoveComboCallout: string | null = null;
  private _lastMoveCoinsEarned = 0;
  private _lastMoveElementalCoins = 0;
  private _lastTriggeredElementalPower: string | null = null;
  private _lastElementalSignatureResult: ElementalSignatureResult | null = null;
  private _sakuraBonusMovesGained = 0;
  private _bentoDock: (BentoSlotItem | null)[] = Array.from(
    { length: GameConstants.bentoDockCapacity },
    () => null
  );
  private _pocketModeActive = false;
  private _armedBentoSlotIndex: number | null = null;
  private _bentoSeq = 0;
  private _festivalFeverStreak = 0;
  private _spiritCharge = 0;
  private _lastKitsuneSkillCallout: string | null = null;
  private _activeCompanionId: CompanionId = 'kitsune';
  private _companionRank = 1;
  private _companionBonusMovesGranted = 0;
  private _lastCompanionBonusCoins = 0;
  private _previousTurnSnapshot: TurnSnapshot | null = null;
  private _rewindsUsed = 0;
  private _blockerBoard: Board = Board.generate();
  private _sugarMoldCoinsEarned = 0;
  private _yokaiBossMaxHp = 0;
  private _yokaiBossHp = 0;
  private _bossTurnCounter = 0;
  private _lastBossDamageDealt = 0;
  private _lastBossCounterCursedCells: GridPos[] = [];
  private _status: GameStatus = GameStatus.idle;
  private _stars = 0;
  private readonly _listeners = new Set<() => void>();

  constructor(level: LevelConfig, buffOptions?: LevelBuffOptions) {
    this._level = level;
    this._buffOptions = { ...(buffOptions ?? {}) };
    this._movesLeft =
      level.moves +
      (this._buffOptions.extraMoves ? GameConstants.landmark1ExtraMoves : 0);
    this._collectProgress = { ...level.collectGoals };
    this._glowGrid = this._buildGlowGrid(level);
    this._blockerBoard.initBlockers(level.festivalBlockers);
    this._yokaiBossMaxHp = level.yokaiBoss?.maxHp ?? 0;
    this._yokaiBossHp = this._yokaiBossMaxHp;
    this._festivalFeverStreak = Math.min(
      GameConstants.maxFestivalFeverStreak,
      Math.max(0, Math.trunc(this._buffOptions.festivalFeverStreak ?? 0))
    );
    this._spiritCharge = Math.min(
      GameConstants.spiritChargeMax,
      this._festivalFeverStreak * GameConstants.feverStreakChargeBonusPerTier
    );
    this._activeCompanionId =
      this._buffOptions.activeCompanionId &&
      ALL_COMPANION_IDS.includes(this._buffOptions.activeCompanionId)
        ? this._buffOptions.activeCompanionId
        : 'kitsune';
    this._companionRank = Math.min(
      GameConstants.companionMaxRank,
      Math.max(1, Math.trunc(this._buffOptions.companionRank ?? 1))
    );
    if (
      this._buffOptions.carryOverBento &&
      this._buffOptions.carryOverBento.length > 0
    ) {
      for (
        let i = 0;
        i <
        Math.min(
          GameConstants.bentoDockCapacity,
          this._buffOptions.carryOverBento.length
        );
        i++
      ) {
        this._bentoDock[i] = { ...this._buffOptions.carryOverBento[i] };
      }
    }
  }

  private _buildGlowGrid(level: LevelConfig): number[][] {
    const size = GameConstants.gridSize;
    const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
    let total = 0;
    if (level.glowCells) {
      for (const [r, c, layers] of level.glowCells) {
        if (r >= 0 && r < size && c >= 0 && c < size && layers > 0) {
          const clamped = Math.min(2, Math.max(0, Math.floor(layers)));
          total += clamped - grid[r][c];
          grid[r][c] = clamped;
        }
      }
    }
    this._initialGlowLayers = total;
    return grid;
  }

  get level(): LevelConfig {
    return this._level;
  }

  get movesLeft(): number {
    return this._movesLeft;
  }

  get score(): number {
    return this._score;
  }

  get collectProgress(): Readonly<Record<string, number>> {
    return { ...this._collectProgress };
  }

  get glowRemainingGrid(): readonly (readonly number[])[] {
    return this._glowGrid.map((row) => [...row]);
  }

  glowLayersAt(row: number, col: number): number {
    if (
      row < 0 ||
      row >= this._glowGrid.length ||
      col < 0 ||
      col >= this._glowGrid[row].length
    ) {
      return 0;
    }
    return this._glowGrid[row][col];
  }

  get glowLayersRemaining(): number {
    let sum = 0;
    for (const row of this._glowGrid) {
      for (const v of row) {
        sum += v;
      }
    }
    return sum;
  }

  get initialGlowLayers(): number {
    return this._initialGlowLayers;
  }

  get lastStepGlowRemovals(): readonly (readonly GlowRemovalEvent[])[] {
    return this._lastStepGlowRemovals;
  }

  get buffOptions(): LevelBuffOptions {
    return { ...this._buffOptions };
  }

  get lastMoveCascadeDepth(): number {
    return this._lastMoveCascadeDepth;
  }

  get lastMoveHas4PlusMatch(): boolean {
    return this._lastMoveHas4PlusMatch;
  }

  get lastMoveComboCallout(): string | null {
    return this._lastMoveComboCallout;
  }

  get lastMoveCoinsEarned(): number {
    return this._lastMoveCoinsEarned;
  }

  get lastMoveElementalCoins(): number {
    return this._lastMoveElementalCoins;
  }

  get lastTriggeredElementalPower(): string | null {
    return this._lastTriggeredElementalPower;
  }

  get lastElementalSignatureResult(): ElementalSignatureResult | null {
    return this._lastElementalSignatureResult;
  }

  get sakuraBonusMovesGained(): number {
    return this._sakuraBonusMovesGained;
  }

  get bentoDock(): readonly (BentoSlotItem | null)[] {
    return [...this._bentoDock];
  }

  get filledBentoSlots(): readonly BentoSlotItem[] {
    return this._bentoDock.filter((item): item is BentoSlotItem => item !== null);
  }

  get canFuseBento(): boolean {
    return this.filledBentoSlots.length >= 2;
  }

  get pocketModeActive(): boolean {
    return this._pocketModeActive;
  }

  get armedBentoSlotIndex(): number | null {
    return this._armedBentoSlotIndex;
  }

  get spiritCharge(): number {
    return this._spiritCharge;
  }

  get isSpiritReady(): boolean {
    return this._spiritCharge >= GameConstants.spiritChargeMax;
  }

  get festivalFeverStreak(): number {
    return this._festivalFeverStreak;
  }

  get lastKitsuneSkillCallout(): string | null {
    return this._lastKitsuneSkillCallout;
  }

  get activeCompanionId(): CompanionId {
    return this._activeCompanionId;
  }

  get companionRank(): number {
    return this._companionRank;
  }

  get companionBonusMovesGranted(): number {
    return this._companionBonusMovesGranted;
  }

  get lastCompanionBonusCoins(): number {
    return this._lastCompanionBonusCoins;
  }

  setActiveCompanion(id: CompanionId, rank = 1): void {
    if (!ALL_COMPANION_IDS.includes(id)) return;
    this._activeCompanionId = id;
    this._companionRank = Math.min(
      GameConstants.companionMaxRank,
      Math.max(1, Math.trunc(rank))
    );
    this._notify();
  }

  get previousTurnSnapshot(): TurnSnapshot | null {
    return this._previousTurnSnapshot;
  }

  get canRewind(): boolean {
    return this._previousTurnSnapshot !== null && !this.isGameOver;
  }

  get rewindsUsed(): number {
    return this._rewindsUsed;
  }

  get rewindCost(): number {
    return this._rewindsUsed === 0 ? 0 : GameConstants.timeSlipRewindCoinCost;
  }

  get takeoutBentoCost(): number {
    return this._festivalFeverStreak >= GameConstants.maxFestivalFeverStreak
      ? 0
      : GameConstants.takeoutBentoCoinCost;
  }

  get yokaiBossHp(): number {
    return this._yokaiBossHp;
  }

  get yokaiBossMaxHp(): number {
    return this._yokaiBossMaxHp;
  }

  get isBossLevel(): boolean {
    return this._yokaiBossMaxHp > 0;
  }

  get bossTurnCounter(): number {
    return this._bossTurnCounter;
  }

  get lastBossDamageDealt(): number {
    return this._lastBossDamageDealt;
  }

  get lastBossCounterCursedCells(): readonly GridPos[] {
    return [...this._lastBossCounterCursedCells];
  }

  get sugarMoldCoinsEarned(): number {
    return this._sugarMoldCoinsEarned;
  }

  // ==================== Festival Blocker Accessors & Placement ====================

  private _syncBlockersWithBoard(board?: Board): void {
    if (!board) return;
    const boardBlockers = board.allBlockers();
    const stateBlockers = this._blockerBoard.allBlockers();
    if (boardBlockers.length > 0) {
      this._blockerBoard.restoreBlockers(board.cloneBlockers());
    } else if (stateBlockers.length > 0) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
  }

  clearBlockers(board?: Board): void {
    this._blockerBoard.restoreBlockers([]);
    if (board) {
      board.restoreBlockers([]);
    }
    this._notify();
  }

  setBlocker(spec: FestivalBlockerSpec, board?: Board): FestivalBlockerState {
    const b = this._blockerBoard.setBlocker(spec);
    if (board) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
    this._notify();
    return b;
  }

  placePaperLantern(
    pos: GridPos,
    layers = 2,
    board?: Board
  ): FestivalBlockerState {
    const b = this._blockerBoard.placePaperLantern(pos, layers);
    if (board) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
    this._notify();
    return b;
  }

  placeSugarMold(topLeft: GridPos, board?: Board): FestivalBlockerState {
    const b = this._blockerBoard.placeSugarMold(topLeft);
    if (board) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
    this._notify();
    return b;
  }

  placeToriiGate(
    pos: GridPos,
    cleansed = false,
    board?: Board
  ): FestivalBlockerState {
    const b = this._blockerBoard.placeToriiGate(pos, cleansed);
    if (board) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
    this._notify();
    return b;
  }

  placeSlateCurse(pos: GridPos, board?: Board): FestivalBlockerState {
    const b = this._blockerBoard.placeSlateCurse(pos);
    if (board) {
      board.restoreBlockers(this._blockerBoard.cloneBlockers());
    }
    this._notify();
    return b;
  }

  allBlockers(board?: Board): readonly FestivalBlockerState[] {
    if (board && board.allBlockers().length > 0) {
      return board.allBlockers();
    }
    return this._blockerBoard.allBlockers();
  }

  blockerAt(row: number, col: number, board?: Board): FestivalBlockerState | null {
    if (board) {
      const fromBoard = board.blockerAt(row, col);
      if (fromBoard) return fromBoard;
    }
    return this._blockerBoard.blockerAt(row, col);
  }

  paperLanternLayersAt(row: number, col: number, board?: Board): number {
    if (board && board.allBlockers().length > 0) {
      return board.paperLanternLayersAt(row, col);
    }
    return this._blockerBoard.paperLanternLayersAt(row, col);
  }

  sugarMoldAt(row: number, col: number, board?: Board): FestivalBlockerState | null {
    if (board && board.allBlockers().length > 0) {
      return board.sugarMoldAt(row, col);
    }
    return this._blockerBoard.sugarMoldAt(row, col);
  }

  toriiGateAt(row: number, col: number, board?: Board): FestivalBlockerState | null {
    if (board && board.allBlockers().length > 0) {
      return board.toriiGateAt(row, col);
    }
    return this._blockerBoard.toriiGateAt(row, col);
  }

  isSlateCursed(row: number, col: number, board?: Board): boolean {
    if (board && board.allBlockers().length > 0) {
      return board.isSlateCursed(row, col);
    }
    return this._blockerBoard.isSlateCursed(row, col);
  }

  /**
   * Deals damage to the Yokai Boss (on Boss Levels) and evaluates victory if HP reaches 0.
   */
  dealBossDamage(
    rawAmount: number,
    isSpecialDetonation = false
  ): number {
    if (!this.isBossLevel || this._yokaiBossHp <= 0) return 0;
    const multiplier = isSpecialDetonation
      ? GameConstants.yokaiBossSpecialDamageMultiplier
      : 1;
    const dmg = Math.max(0, Math.round(rawAmount * multiplier));
    if (dmg <= 0) return 0;

    this._yokaiBossHp = Math.max(0, this._yokaiBossHp - dmg);
    this._lastBossDamageDealt += dmg;

    if (this._yokaiBossHp === 0 && !this.isGameOver) {
      if (this._movesLeft > 0) {
        const rawBonus = this._movesLeft * GameConstants.leftoverMoveBonus;
        this._score += this._buffOptions.scoreAndCoinBonus
          ? Math.ceil(rawBonus * (1 + GameConstants.landmark2BonusRatio))
          : rawBonus;
      }
      this._status = GameStatus.won;
      this._stars = Scoring.computeStars({
        score: Math.max(this._score, this._level.star1),
        star1: this._level.star1,
        star2: this._level.star2,
        star3: this._level.star3,
        isWin: true,
      });
    }
    return dmg;
  }

  /**
   * Yokai Boss Counter-Attack (every 4 turns):
   * Turns 2 random tiles on the board into locked slate blocks (`slate_curse`).
   */
  triggerBossCounterAttack(
    board?: Board,
    randomFn: () => number = Math.random
  ): GridPos[] {
    if (!this.isBossLevel || this._yokaiBossHp <= 0 || this.isGameOver) {
      return [];
    }
    this._syncBlockersWithBoard(board);
    const targetBoard = board ?? this._blockerBoard;
    const candidates: GridPos[] = [];

    for (let r = 0; r < targetBoard.size; r++) {
      for (let c = 0; c < targetBoard.size; c++) {
        if (!targetBoard.blockerAt(r, c)) {
          candidates.push(new GridPos(r, c));
        }
      }
    }

    const cursed: GridPos[] = [];
    const curseCount =
      this._level.yokaiBoss?.curseTileCount ??
      GameConstants.yokaiBossCurseTileCount;
    const pool = [...candidates];

    for (let i = 0; i < Math.min(curseCount, pool.length); i++) {
      const idx = Math.min(
        pool.length - 1,
        Math.floor(randomFn() * pool.length)
      );
      const pos = pool.splice(idx, 1)[0];
      this._blockerBoard.placeSlateCurse(pos);
      if (board) {
        board.placeSlateCurse(pos);
      }
      cursed.push(pos);
    }

    this._lastBossCounterCursedCells = cursed;
    this._notify();
    return cursed;
  }

  get status(): GameStatus {
    return this._status;
  }

  get stars(): number {
    return this._stars;
  }

  get isGameOver(): boolean {
    return this._status === GameStatus.won || this._status === GameStatus.lost;
  }

  get areAllCollectGoalsMet(): boolean {
    return Object.values(this._collectProgress).every((rem) => rem <= 0);
  }

  get areAllGlowGoalsMet(): boolean {
    return this.glowLayersRemaining <= 0;
  }

  addListener(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const listener of Array.from(this._listeners)) {
      listener();
    }
  }

  /**
   * Returns the level's primary remaining collect target tile type,
   * or null if the level only has a score/glow goal (so Fox-Fire Transmute defaults to Blue Mask).
   */
  primaryRemainingTargetType(): TileType | null {
    if (this._level.mode !== LevelMode.collect) {
      return null;
    }
    const entries = Object.entries(this._collectProgress);
    const active = entries.find(([, rem]) => rem > 0);
    if (active) {
      return active[0] as TileType;
    }
    const firstKey = Object.keys(this._level.collectGoals)[0];
    return firstKey ? (firstKey as TileType) : null;
  }

  /**
   * Triggers the Asymmetric Elemental Signature Bonus for a Special Tile of `tileType` at `cell`.
   */
  triggerElementalSignature(params: {
    board?: Board;
    cell: GridPos;
    tileType: TileType;
    randomFn?: () => number;
    compactBoardAfterClear?: boolean;
  }): ElementalSignatureResult {
    const res = applyElementalSignature({
      board: params.board,
      cell: params.cell,
      tileType: params.tileType,
      primaryTargetType: this.primaryRemainingTargetType(),
      randomFn: params.randomFn,
      compactBoardAfterClear: params.compactBoardAfterClear ?? false,
    });

    this._lastTriggeredElementalPower = res.calloutText;
    this._lastElementalSignatureResult = res;

    // 1. Apply bonus score (with Landmark 2 +10% boost if active)
    let scoreAdd = res.bonusScore;
    for (const pos of res.clearedCells) {
      const currentLayers = this.glowLayersAt(pos.row, pos.col);
      if (currentLayers > 0) {
        this._glowGrid[pos.row][pos.col] = Math.max(0, currentLayers - 1);
        scoreAdd += GameConstants.glowLayerClearedBonus;
      }
    }
    if (this._buffOptions.scoreAndCoinBonus) {
      scoreAdd = Math.ceil(scoreAdd * (1 + GameConstants.landmark2BonusRatio));
    }
    this._score += scoreAdd;

    // 2. Apply collect progress from any signature-cleared tiles (e.g., Onigiri bottom crush or Dango X-pierce)
    if (this._level.mode === LevelMode.collect) {
      for (const [tileId, count] of Object.entries(res.clearedByType)) {
        if (
          count !== undefined &&
          Object.prototype.hasOwnProperty.call(this._collectProgress, tileId)
        ) {
          this._collectProgress[tileId] = Math.max(
            0,
            this._collectProgress[tileId] - count
          );
        }
      }
    }

    // 3. Apply bonus Spirit Coins (Red Lantern: +3 🪙)
    if (res.bonusCoins > 0) {
      const coinsAdd = this._buffOptions.scoreAndCoinBonus
        ? Math.ceil(res.bonusCoins * (1 + GameConstants.landmark2BonusRatio))
        : res.bonusCoins;
      this._lastMoveElementalCoins += coinsAdd;
      this._lastMoveCoinsEarned += coinsAdd;
    }

    // 4. Apply Sakura Gale Breeze +1 Move (capped at max +2 bonus moves gained per level)
    if (res.bonusMovesRequested > 0) {
      const remainingCap = Math.max(
        0,
        GameConstants.maxSakuraBonusMovesPerLevel - this._sakuraBonusMovesGained
      );
      const granted = Math.min(res.bonusMovesRequested, remainingCap);
      if (granted > 0) {
        this._movesLeft += granted;
        this._sakuraBonusMovesGained += granted;
      }
    }

    // 5. Phase 5: Apply Elemental Signature blocker interactions
    this._syncBlockersWithBoard(params.board);
    const activeBlockerTarget = params.board ?? this._blockerBoard;
    const blockerOutcome = activeBlockerTarget.applyStepBlockerEffects({
      cleared: res.clearedCells,
      clearedByType: res.clearedByType,
      redLanternSpecialCells:
        params.tileType === TileType.lantern ? [params.cell] : [],
      dangoSpecialCells:
        params.tileType === TileType.dango ? [params.cell] : [],
      foxMaskSpecialCells:
        params.tileType === TileType.foxMask ? [params.cell] : [],
    });
    if (params.board) {
      this._blockerBoard.restoreBlockers(params.board.cloneBlockers());
    }
    if (blockerOutcome.sugarMoldCoinsEarned > 0) {
      this._sugarMoldCoinsEarned += blockerOutcome.sugarMoldCoinsEarned;
      this._lastMoveCoinsEarned += blockerOutcome.sugarMoldCoinsEarned;
    }

    // 6. Phase 5: Special Tile detonation deals 2x damage to Yokai Boss when invoked directly
    if (this.isBossLevel && !params.compactBoardAfterClear) {
      this.dealBossDamage(scoreAdd, true);
    }

    if (!this.isGameOver) {
      this._stars = Scoring.computeStars({
        score: this._score,
        star1: this._level.star1,
        star2: this._level.star2,
        star3: this._level.star3,
        isWin: false,
      });
    }
    this._notify();
    return res;
  }

  /**
   * Toggles or sets Pocket Mode for the Bento Forge Dock.
   */
  setPocketMode(active: boolean): void {
    if (this.isGameOver) return;
    const hasOpenSlot = this._bentoDock.some((s) => s === null);
    this._pocketModeActive = active && hasOpenSlot;
    if (this._pocketModeActive) {
      this._armedBentoSlotIndex = null;
    }
    this._notify();
  }

  togglePocketMode(): boolean {
    this.setPocketMode(!this._pocketModeActive);
    return this._pocketModeActive;
  }

  /**
   * Arms or disarms a filled Bento Dock slot for deployment onto the board.
   * Clicking an empty Bento slot arms Pocket Mode instead.
   */
  armBentoSlot(slotIndex: number | null): void {
    if (this.isGameOver) return;
    if (slotIndex === null) {
      this._armedBentoSlotIndex = null;
      this._notify();
      return;
    }
    if (slotIndex < 0 || slotIndex >= this._bentoDock.length) return;
    const item = this._bentoDock[slotIndex];
    if (!item) {
      // Clicking an empty Bento slot arms Pocket Mode
      this.setPocketMode(true);
      return;
    }
    this._pocketModeActive = false;
    this._armedBentoSlotIndex =
      this._armedBentoSlotIndex === slotIndex ? null : slotIndex;
    this._notify();
  }

  /**
   * Pockets a Special Tile currently on `board` at `pos` into the first open Bento Dock slot:
   * - Costs 0 moves (`movesLeft` is unchanged).
   * - Replaces `pos` on `board` with a fresh standard tile that avoids immediate 3-matches.
   * - Exits Pocket Mode.
   */
  pocketSpecialFromBoard(
    board: Board,
    pos: GridPos,
    randomFn: () => number = Math.random
  ): BentoSlotItem | null {
    if (this.isGameOver) return null;
    const openIdx = this._bentoDock.findIndex((s) => s === null);
    if (openIdx === -1) return null;
    const tile = board.getAt(pos);
    if (!tile || !tile.isSpecial) return null;

    const item: BentoSlotItem = {
      id: `bento_${++this._bentoSeq}`,
      tileType: tile.type,
      specialType: tile.special,
    };
    this._bentoDock[openIdx] = item;

    const replacement = pickNonMatchingStandardTile(board, pos, randomFn);
    board.setAt(pos, replacement);

    this._pocketModeActive = false;
    this._armedBentoSlotIndex = null;
    this._notify();
    return item;
  }

  /**
   * Deploys the stored Special Tile in `slotIndex` onto `targetPos` on `board`,
   * immediately detonating its Special blast + Elemental Signature Bonus, and clears that Bento Dock slot.
   */
  deployBentoSpecial(
    board: Board,
    slotIndex: number,
    targetPos: GridPos,
    randomFn: () => number = Math.random
  ): {
    deployedItem: BentoSlotItem;
    steps: ResolveStep[];
    stepScores: number[];
    elementalResult: ElementalSignatureResult;
  } | null {
    if (
      this.isGameOver ||
      slotIndex < 0 ||
      slotIndex >= this._bentoDock.length ||
      !board.isBounds(targetPos)
    ) {
      return null;
    }
    const item = this._bentoDock[slotIndex];
    if (!item) return null;

    this._bentoDock[slotIndex] = null;
    this._armedBentoSlotIndex = null;
    this._pocketModeActive = false;

    const deployedTile =
      item.specialType === SpecialKind.orb
        ? Tile.orb()
        : new Tile(item.tileType, item.specialType);
    board.setAt(targetPos, deployedTile);

    const blastPositions = Board.computeSpecialBlast({
      board,
      cell: targetPos,
      kind: item.specialType,
      targetColor: item.tileType,
    });

    const clearedKeys = new Set<string>(blastPositions.map((p) => p.key));
    clearedKeys.add(targetPos.key);
    const clearedList = Array.from(clearedKeys).map(GridPos.fromKey);
    const clearedByType: Partial<Record<TileType, number>> = {};

    for (const p of clearedList) {
      const t = board.getAt(p);
      if (t && !t.isOrb) {
        clearedByType[t.type] = (clearedByType[t.type] ?? 0) + 1;
      }
    }

    const activationBonus =
      item.specialType === SpecialKind.orb
        ? GameConstants.orbActivationBonus
        : item.specialType === SpecialKind.burst
          ? GameConstants.burstActivationBonus
          : GameConstants.slashActivationBonus;

    const activatedEntry: ActivatedSpecial = {
      cell: targetPos,
      kind: item.specialType,
      targetColor: item.tileType,
      tileType: item.tileType,
    };

    const wave: SpecialActivationWave = {
      waveIndex: 1,
      activated: [activatedEntry],
      cleared: clearedList,
      clearedByType,
      bonusScore: activationBonus,
    };

    Board.clearMatches(board, clearedList);
    const falls = Board.applyGravity(board);
    const refills = Board.refill(board, randomFn);

    const deployStep: ResolveStep = {
      cleared: clearedList,
      clearedKeys,
      clearedByType,
      matchRuns: [],
      matchGroups: [],
      createdSpecials: [],
      waves: [wave],
      falls,
      refills,
      stepBonusScore: activationBonus,
      postStepGrid: board.toGrid(),
    };

    const cascadeResult = Board.resolveBoard(board, { randomFn });
    const allSteps = [deployStep, ...cascadeResult.steps];
    const stepScores = this.applyResolveSteps(allSteps, board, randomFn);
    const elementalResult =
      this._lastElementalSignatureResult ??
      this.triggerElementalSignature({
        board,
        cell: targetPos,
        tileType: item.tileType,
        randomFn,
        compactBoardAfterClear: true,
      });

    if (
      (this._level.mode === LevelMode.collect && this.areAllCollectGoalsMet) ||
      (this._level.mode === LevelMode.glow && this.areAllGlowGoalsMet)
    ) {
      this.evaluate();
    }

    return {
      deployedItem: item,
      steps: allSteps,
      stepScores,
      elementalResult,
    };
  }

  /**
   * Consumes the first 2 filled Bento Dock slots and unleashes a Super Matsuri Cross Blast
   * centered on the board (clearing rows 2, 3, 4 and cols 2, 3, 4), triggering both tiles'
   * Elemental Signatures, and awarding +500 bonus score and +5 🪙 Spirit Coins.
   */
  fuseBentoSpecials(
    board: Board,
    randomFn: () => number = Math.random
  ): {
    consumedItems: [BentoSlotItem, BentoSlotItem];
    clearedCells: GridPos[];
    elementalResults: [ElementalSignatureResult, ElementalSignatureResult];
    bonusScore: number;
    bonusCoins: number;
    steps: ResolveStep[];
    stepScores: number[];
  } | null {
    if (this.isGameOver) return null;
    const filledIndices: number[] = [];
    for (let i = 0; i < this._bentoDock.length; i++) {
      if (this._bentoDock[i] !== null) {
        filledIndices.push(i);
      }
    }
    if (filledIndices.length < 2) return null;

    const idxA = filledIndices[0];
    const idxB = filledIndices[1];
    const itemA = this._bentoDock[idxA]!;
    const itemB = this._bentoDock[idxB]!;

    this._bentoDock[idxA] = null;
    this._bentoDock[idxB] = null;
    this._armedBentoSlotIndex = null;
    this._pocketModeActive = false;

    const crossCells = computeSuperMatsuriCrossCells(board.size);
    const clearedKeys = new Set<string>(crossCells.map((p) => p.key));
    const clearedByType: Partial<Record<TileType, number>> = {};

    for (const p of crossCells) {
      const t = board.getAt(p);
      if (t && !t.isOrb) {
        clearedByType[t.type] = (clearedByType[t.type] ?? 0) + 1;
      }
    }

    const fuseWave: SpecialActivationWave = {
      waveIndex: 1,
      activated: [
        {
          cell: new GridPos(3, 3),
          kind: itemA.specialType,
          targetColor: itemA.tileType,
          tileType: itemA.tileType,
        },
        {
          cell: new GridPos(4, 4),
          kind: itemB.specialType,
          targetColor: itemB.tileType,
          tileType: itemB.tileType,
        },
      ],
      cleared: crossCells,
      clearedByType,
      bonusScore: GameConstants.bentoFuseBonusScore,
    };

    Board.clearMatches(board, crossCells);
    const falls = Board.applyGravity(board);
    const refills = Board.refill(board, randomFn);

    const fuseStep: ResolveStep = {
      cleared: crossCells,
      clearedKeys,
      clearedByType,
      matchRuns: [],
      matchGroups: [],
      createdSpecials: [],
      waves: [fuseWave],
      falls,
      refills,
      stepBonusScore: GameConstants.bentoFuseBonusScore,
      postStepGrid: board.toGrid(),
    };

    const cascadeResult = Board.resolveBoard(board, { randomFn });
    const allSteps = [fuseStep, ...cascadeResult.steps];
    const scoreBefore = this._score;
    const stepScores = this.applyResolveSteps(allSteps, board, randomFn);

    // Ensure both Elemental Signatures are captured in results and callout banner
    const resA = applyElementalSignature({
      board,
      cell: new GridPos(3, 3),
      tileType: itemA.tileType,
      primaryTargetType: this.primaryRemainingTargetType(),
      randomFn,
      compactBoardAfterClear: false,
    });
    const resB = applyElementalSignature({
      board,
      cell: new GridPos(4, 4),
      tileType: itemB.tileType,
      primaryTargetType: this.primaryRemainingTargetType(),
      randomFn,
      compactBoardAfterClear: false,
    });

    const fuseCoins = this._buffOptions.scoreAndCoinBonus
      ? Math.ceil(
          GameConstants.bentoFuseBonusCoins *
            (1 + GameConstants.landmark2BonusRatio)
        )
      : GameConstants.bentoFuseBonusCoins;

    this._lastMoveCoinsEarned += fuseCoins;
    this._lastTriggeredElementalPower = `Bento Fusion: ${resA.powerName} × ${resB.powerName}!`;

    // Phase 5: Bento Fuse instantly shatters all layers of Paper Lantern barriers
    this._syncBlockersWithBoard(board);
    const fuseBlockerOutcome = board.applyStepBlockerEffects({
      cleared: crossCells,
      isBentoFuse: true,
      redLanternSpecialCells:
        itemA.tileType === TileType.lantern || itemB.tileType === TileType.lantern
          ? [new GridPos(3, 3)]
          : [],
      dangoSpecialCells:
        itemA.tileType === TileType.dango || itemB.tileType === TileType.dango
          ? [new GridPos(3, 3)]
          : [],
      foxMaskSpecialCells:
        itemA.tileType === TileType.foxMask || itemB.tileType === TileType.foxMask
          ? [new GridPos(3, 3)]
          : [],
    });
    this._blockerBoard.restoreBlockers(board.cloneBlockers());
    if (fuseBlockerOutcome.sugarMoldCoinsEarned > 0) {
      this._sugarMoldCoinsEarned += fuseBlockerOutcome.sugarMoldCoinsEarned;
      this._lastMoveCoinsEarned += fuseBlockerOutcome.sugarMoldCoinsEarned;
    }

    if (
      (this._level.mode === LevelMode.collect && this.areAllCollectGoalsMet) ||
      (this._level.mode === LevelMode.glow && this.areAllGlowGoalsMet)
    ) {
      this.evaluate();
    }

    this._notify();
    return {
      consumedItems: [itemA, itemB],
      clearedCells: crossCells,
      elementalResults: [resA, resB],
      bonusScore: this._score - scoreBefore,
      bonusCoins: this._lastMoveCoinsEarned,
      steps: allSteps,
      stepScores,
    };
  }

  /**
   * Adds raw spirit charge (clamped 0..100) and returns the new charge percentage.
   */
  addSpiritCharge(amount: number): number {
    if (this.isGameOver) return this._spiritCharge;
    const clean = Math.max(0, Math.trunc(amount));
    this._spiritCharge = Math.min(
      GameConstants.spiritChargeMax,
      this._spiritCharge + clean
    );
    this._notify();
    return this._spiritCharge;
  }

  /**
   * Boosts Kitsune Spirit Charge to 100% for 25 🪙 (`GameConstants.kitsuneCoinChargeCost`).
   */
  boostSpiritChargeWithCoins(coinWallet?: {
    spendSpiritCoins(amount: number): boolean;
  }): boolean {
    if (
      this.isGameOver ||
      this._spiritCharge >= GameConstants.spiritChargeMax
    ) {
      return false;
    }
    if (coinWallet && !coinWallet.spendSpiritCoins(GameConstants.kitsuneCoinChargeCost)) {
      return false;
    }
    this._spiritCharge = GameConstants.spiritChargeMax;
    this._notify();
    return true;
  }

  /**
   * Alias for `activateKitsuneSkill` that executes the active Spirit Companion's 100% skill.
   */
  activateCompanionSkill(
    board?: Board,
    randomFn: () => number = Math.random
  ): KitsuneSkillActivationResult | null {
    return this.activateKitsuneSkill(board, randomFn);
  }

  /**
   * At 100% Spirit Charge, activates the equipped Spirit Companion Skill for 0 moves:
   * - Resets `spiritCharge` to 0
   * - Multiplies base score and Boss HP damage by `1 + (companionRank - 1) * 0.25` (★1 = 1.0x, ★2 = 1.25x, ★3 = 1.5x)
   * - Executes the active companion's signature skill:
   *   - `kitsune` (Inari Kitsune — Fox-Fire Barrage): Clears up to 4 target/high-value tiles, upgrades 1 random standard tile into a Special Tile, +300 base score (250 Boss HP damage).
   *   - `tanuki` (Tanuki Bento Chef — Bento Feast Delivery): Adds 1 random Special Tile into first open `bentoDock` slot (or upgrades a board tile if full), clears up to 3 central tiles, +8 🪙 Spirit Coins, +300 base score (250 Boss HP damage).
   *   - `shiba` (Raijin Thunder Shiba — Thunder Bark Chain): Clears 4 diagonal tiles, damages/cleanses up to 4 active blockers on the board, deals 350 base Boss HP damage, +350 base score.
   *   - `rabbit` (Tsuki Moon Rabbit — Lunar Mochi Blessing): Grants +1 bonus move (capped at max +2 per level), converts up to 3 random standard tiles into primary remaining target tile type, +350 base score (250 Boss HP damage).
   */
  activateKitsuneSkill(
    board?: Board,
    randomFn: () => number = Math.random
  ): KitsuneSkillActivationResult | null {
    if (
      this.isGameOver ||
      this._spiritCharge < GameConstants.spiritChargeMax
    ) {
      return null;
    }

    this._spiritCharge = 0;
    this._lastCompanionBonusCoins = 0;

    const companionId = this._activeCompanionId;
    const companionRank = this._companionRank;
    const rankMultiplier = getCompanionRankMultiplier(companionRank);
    const companionSpec = SPIRIT_COMPANIONS[companionId];

    const clearedCells: GridPos[] = [];
    const clearedByType: Partial<Record<TileType, number>> = {};
    let upgradedCell: GridPos | null = null;
    let upgradedTile: Tile | null = null;
    let bentoSlotAdded: BentoSlotItem | null = null;
    let bonusCoins = 0;
    let bonusMovesGranted = 0;
    let blockersDamagedCount = 0;
    const transmutedCells: GridPos[] = [];

    const pickRandomStandardUpgrade = (): void => {
      if (!board) return;
      const upgradeCandidates: GridPos[] = [];
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          const t = board.tileAt(r, c);
          if (t && !t.isSpecial) {
            upgradeCandidates.push(new GridPos(r, c));
          }
        }
      }
      if (upgradeCandidates.length > 0) {
        const pickIdx = Math.min(
          upgradeCandidates.length - 1,
          Math.floor(randomFn() * upgradeCandidates.length)
        );
        upgradedCell = upgradeCandidates[pickIdx];
        const currentTile = board.getAt(upgradedCell)!;
        const specialKinds = [
          SpecialKind.slashRow,
          SpecialKind.slashColumn,
          SpecialKind.burst,
        ] as const;
        const chosenSpecial =
          specialKinds[
            Math.min(
              specialKinds.length - 1,
              Math.floor(randomFn() * specialKinds.length)
            )
          ];
        upgradedTile = new Tile(currentTile.type, chosenSpecial);
        board.setAt(upgradedCell, upgradedTile);
      }
    };

    if (companionId === 'kitsune') {
      if (board) {
        const targetCandidates: GridPos[] = [];
        const standardCandidates: GridPos[] = [];
        const fallbackCandidates: GridPos[] = [];

        for (let r = 0; r < board.size; r++) {
          for (let c = 0; c < board.size; c++) {
            const pos = new GridPos(r, c);
            const t = board.tileAt(r, c);
            if (!t) continue;
            const isGlowTarget =
              this._level.mode === LevelMode.glow &&
              this.glowLayersAt(r, c) > 0;
            const isCollectTarget =
              this._level.mode === LevelMode.collect &&
              !t.isOrb &&
              (this._collectProgress[t.type] ?? 0) > 0;
            if (isGlowTarget || isCollectTarget) {
              targetCandidates.push(pos);
            } else if (!t.isSpecial) {
              standardCandidates.push(pos);
            } else {
              fallbackCandidates.push(pos);
            }
          }
        }

        const orderedPool = [
          ...targetCandidates,
          ...standardCandidates,
          ...fallbackCandidates,
        ];
        for (
          let i = 0;
          i < Math.min(GameConstants.kitsuneSkillClearCount, orderedPool.length);
          i++
        ) {
          const picked = orderedPool[i];
          const t = board.getAt(picked);
          if (t && !t.isOrb) {
            clearedByType[t.type] = (clearedByType[t.type] ?? 0) + 1;
          }
          clearedCells.push(picked);
        }

        if (clearedCells.length > 0) {
          Board.clearMatches(board, clearedCells);
          Board.applyGravity(board);
          Board.refill(board, randomFn);
        }
      }
      pickRandomStandardUpgrade();
    } else if (companionId === 'tanuki') {
      // Tanuki Bento Chef: Clears up to 3 central tiles, adds 1 random Special Tile into first open bentoDock slot (or upgrades a board tile if full), awards +8 🪙
      if (board) {
        const centralCoords: ReadonlyArray<readonly [number, number]> = [
          [3, 3],
          [3, 4],
          [4, 3],
          [4, 4],
          [2, 3],
          [3, 2],
          [4, 5],
          [5, 4],
        ];
        for (const [r, c] of centralCoords) {
          if (clearedCells.length >= GameConstants.tanukiSkillClearCount) break;
          const pos = new GridPos(r, c);
          if (!board.isBounds(pos)) continue;
          const t = board.getAt(pos);
          if (!t) continue;
          if (!t.isOrb) {
            clearedByType[t.type] = (clearedByType[t.type] ?? 0) + 1;
          }
          clearedCells.push(pos);
        }
        if (clearedCells.length > 0) {
          Board.clearMatches(board, clearedCells);
          Board.applyGravity(board);
          Board.refill(board, randomFn);
        }
      }

      const openSlotIdx = this._bentoDock.findIndex((s) => s === null);
      if (openSlotIdx !== -1) {
        const allTileTypes = [
          TileType.sakura,
          TileType.lantern,
          TileType.onigiri,
          TileType.dango,
          TileType.foxMask,
        ] as const;
        const specialKinds = [
          SpecialKind.slashRow,
          SpecialKind.slashColumn,
          SpecialKind.burst,
        ] as const;
        const chosenType =
          this.primaryRemainingTargetType() ??
          allTileTypes[
            Math.min(
              allTileTypes.length - 1,
              Math.floor(randomFn() * allTileTypes.length)
            )
          ];
        const chosenSpecial =
          specialKinds[
            Math.min(
              specialKinds.length - 1,
              Math.floor(randomFn() * specialKinds.length)
            )
          ];
        bentoSlotAdded = {
          id: `bento_tanuki_${++this._bentoSeq}`,
          tileType: chosenType,
          specialType: chosenSpecial,
        };
        this._bentoDock[openSlotIdx] = bentoSlotAdded;
      } else {
        pickRandomStandardUpgrade();
      }

      const rawTanukiCoins = GameConstants.tanukiSkillBonusCoins;
      bonusCoins = this._buffOptions.scoreAndCoinBonus
        ? Math.ceil(rawTanukiCoins * (1 + GameConstants.landmark2BonusRatio))
        : rawTanukiCoins;
      this._lastCompanionBonusCoins = bonusCoins;
      this._lastMoveCoinsEarned += bonusCoins;
    } else if (companionId === 'shiba') {
      // Raijin Thunder Shiba: Clears 4 diagonal tiles, damages/cleanses up to 4 active blockers on the board
      if (board) {
        const diagCoords: ReadonlyArray<readonly [number, number]> = [
          [1, 1],
          [2, 2],
          [5, 5],
          [6, 6],
          [1, 6],
          [2, 5],
          [5, 2],
          [6, 1],
          [3, 3],
          [4, 4],
        ];
        for (const [r, c] of diagCoords) {
          if (
            clearedCells.length >= GameConstants.shibaSkillDiagonalClearCount
          ) {
            break;
          }
          const pos = new GridPos(r, c);
          if (!board.isBounds(pos)) continue;
          const t = board.getAt(pos);
          if (!t) continue;
          if (!t.isOrb) {
            clearedByType[t.type] = (clearedByType[t.type] ?? 0) + 1;
          }
          clearedCells.push(pos);
        }
        if (clearedCells.length > 0) {
          Board.clearMatches(board, clearedCells);
          Board.applyGravity(board);
          Board.refill(board, randomFn);
        }
      }

      this._syncBlockersWithBoard(board);
      const activeTarget = board ?? this._blockerBoard;
      const cloned = activeTarget.cloneBlockers();
      let sugarCoinsFromShiba = 0;

      for (const b of cloned) {
        if (blockersDamagedCount >= GameConstants.shibaSkillBlockerDamageCount) {
          break;
        }
        if (b.type === 'paper_lantern' && b.layers > 0) {
          b.layers = Math.max(0, b.layers - 1);
          blockersDamagedCount += 1;
        } else if (b.type === 'sugar_mold' && b.layers > 0) {
          b.layers = 0;
          b.sidesHit = new Set(['top', 'right', 'bottom', 'left']);
          sugarCoinsFromShiba += GameConstants.sugarMoldBreakCoinReward;
          blockersDamagedCount += 1;
        } else if (b.type === 'torii_gate' && !b.cleansed) {
          b.cleansed = true;
          b.layers = 0;
          blockersDamagedCount += 1;
        } else if (b.type === 'slate_curse' && b.layers > 0) {
          b.layers = 0;
          blockersDamagedCount += 1;
        }
      }

      const filtered = cloned.filter(
        (b) => b.type === 'torii_gate' || b.layers > 0
      );
      this._blockerBoard.restoreBlockers(filtered);
      if (board) {
        board.restoreBlockers(filtered);
      }
      if (sugarCoinsFromShiba > 0) {
        this._sugarMoldCoinsEarned += sugarCoinsFromShiba;
        this._lastMoveCoinsEarned += sugarCoinsFromShiba;
        bonusCoins += sugarCoinsFromShiba;
        this._lastCompanionBonusCoins += sugarCoinsFromShiba;
      }
    } else if (companionId === 'rabbit') {
      // Tsuki Moon Rabbit: Grants +1 bonus move (capped at max +2 per level), converts up to 3 random standard tiles into primary remaining target tile type
      if (
        this._companionBonusMovesGranted <
        GameConstants.maxRabbitBonusMovesPerLevel
      ) {
        this._movesLeft += 1;
        this._companionBonusMovesGranted += 1;
        bonusMovesGranted = 1;
      }

      const targetType =
        this.primaryRemainingTargetType() ?? TileType.sakura;
      if (board) {
        const candidates: GridPos[] = [];
        for (let r = 0; r < board.size; r++) {
          for (let c = 0; c < board.size; c++) {
            const t = board.tileAt(r, c);
            if (t && !t.isSpecial && t.type !== targetType) {
              candidates.push(new GridPos(r, c));
            }
          }
        }
        const pool = [...candidates];
        for (
          let i = 0;
          i < Math.min(GameConstants.rabbitSkillTransmuteCount, pool.length);
          i++
        ) {
          const idx = Math.min(
            pool.length - 1,
            Math.floor(randomFn() * pool.length)
          );
          const pos = pool.splice(idx, 1)[0];
          board.setAt(pos, Tile.normal(targetType));
          transmutedCells.push(pos);
        }
      }
    }

    let bonusScore = Math.round(companionSpec.baseScore * rankMultiplier);
    for (const pos of clearedCells) {
      const currentLayers = this.glowLayersAt(pos.row, pos.col);
      if (currentLayers > 0) {
        this._glowGrid[pos.row][pos.col] = Math.max(0, currentLayers - 1);
        bonusScore += GameConstants.glowLayerClearedBonus;
      }
    }

    if (this._level.mode === LevelMode.collect) {
      if (board && clearedCells.length > 0) {
        for (const [tileId, count] of Object.entries(clearedByType)) {
          if (
            count !== undefined &&
            Object.prototype.hasOwnProperty.call(this._collectProgress, tileId)
          ) {
            this._collectProgress[tileId] = Math.max(
              0,
              this._collectProgress[tileId] - count
            );
          }
        }
      } else if (!board && companionId === 'kitsune') {
        // Headless fallback when called without a board instance
        let remainingClears = GameConstants.kitsuneSkillClearCount;
        for (const key of Object.keys(this._collectProgress)) {
          if (remainingClears <= 0) break;
          const cur = this._collectProgress[key] ?? 0;
          const take = Math.min(cur, remainingClears);
          this._collectProgress[key] = cur - take;
          remainingClears -= take;
        }
      }
    }

    if (this._buffOptions.scoreAndCoinBonus) {
      bonusScore = Math.ceil(
        bonusScore * (1 + GameConstants.landmark2BonusRatio)
      );
    }
    this._score += bonusScore;

    const calloutText = companionSpec.calloutText;
    this._lastKitsuneSkillCallout = calloutText;

    // Deal companion Boss HP damage multiplied by Star Rank multiplier (1.0x / 1.25x / 1.5x)
    let bossDamageDealt = 0;
    if (this.isBossLevel) {
      this._lastBossDamageDealt = 0;
      const scaledBossDamage = Math.round(
        companionSpec.baseBossDamage * rankMultiplier
      );
      bossDamageDealt = this.dealBossDamage(scaledBossDamage, false);
    }

    if (!this.isGameOver) {
      this._stars = Scoring.computeStars({
        score: this._score,
        star1: this._level.star1,
        star2: this._level.star2,
        star3: this._level.star3,
        isWin: false,
      });
    }

    if (
      !this.isGameOver &&
      ((this._level.mode === LevelMode.collect && this.areAllCollectGoalsMet) ||
        (this._level.mode === LevelMode.glow && this.areAllGlowGoalsMet))
    ) {
      this.evaluate();
    } else {
      this._notify();
    }

    return {
      companionId,
      companionRank,
      rankMultiplier,
      clearedCells,
      upgradedCell,
      upgradedTile,
      bonusScore,
      bonusCoins,
      bonusMovesGranted,
      bentoSlotAdded,
      blockersDamagedCount,
      transmutedCells,
      bossDamageDealt,
      calloutText,
    };
  }

  /**
   * Saves a 1-move rewind snapshot before a player swap.
   */
  saveTurnSnapshot(
    board: Board,
    gridOverride?: (Tile | null)[][]
  ): TurnSnapshot {
    this._syncBlockersWithBoard(board);
    const gridSource = gridOverride ?? board.toGrid();
    const snapshot: TurnSnapshot = {
      boardGrid: gridSource.map((row) => [...row]),
      movesLeft: this._movesLeft,
      score: this._score,
      collectProgress: { ...this._collectProgress },
      glowGrid: this._glowGrid.map((row) => [...row]),
      spiritCharge: this._spiritCharge,
      sakuraBonusMovesGained: this._sakuraBonusMovesGained,
      bentoDock: this._bentoDock.map((item) => (item ? { ...item } : null)),
      stars: this._stars,
      yokaiBossHp: this._yokaiBossHp,
      bossTurnCounter: this._bossTurnCounter,
      blockers: this._blockerBoard.cloneBlockers(),
    };
    this._previousTurnSnapshot = snapshot;
    this._notify();
    return snapshot;
  }

  /**
   * Rewinds the last player move using `previousTurnSnapshot`.
   * The 1st rewind per level is free (0 🪙); subsequent rewinds cost 15 🪙 (`GameConstants.timeSlipRewindCoinCost`).
   */
  rewindLastMove(
    board: Board,
    coinWallet?: { spendSpiritCoins(amount: number): boolean }
  ): boolean {
    if (!this._previousTurnSnapshot || this.isGameOver) {
      return false;
    }
    const cost = this.rewindCost;
    if (cost > 0 && coinWallet && !coinWallet.spendSpiritCoins(cost)) {
      return false;
    }

    const snap = this._previousTurnSnapshot;
    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        board.setAt(new GridPos(r, c), snap.boardGrid[r]?.[c] ?? null);
      }
    }
    board.restoreBlockers(snap.blockers);
    this._blockerBoard.restoreBlockers(snap.blockers);

    this._movesLeft = snap.movesLeft;
    this._score = snap.score;
    this._collectProgress = { ...snap.collectProgress };
    this._glowGrid = snap.glowGrid.map((row) => [...row]);
    this._spiritCharge = snap.spiritCharge;
    this._sakuraBonusMovesGained = snap.sakuraBonusMovesGained;
    this._bentoDock = snap.bentoDock.map((item) => (item ? { ...item } : null));
    this._stars = snap.stars;
    this._yokaiBossHp = snap.yokaiBossHp;
    this._bossTurnCounter = snap.bossTurnCounter;
    this._status = GameStatus.idle;
    this._previousTurnSnapshot = null;
    this._rewindsUsed += 1;
    this._pocketModeActive = false;
    this._armedBentoSlotIndex = null;
    this._notify();
    return true;
  }

  /**
   * Lucky Shuffle: Costs 20 🪙 (`GameConstants.luckyShuffleCoinCost`) and 0 moves,
   * shuffles movable tiles on `board`, and upgrades 1 random standard tile into a Special Tile.
   */
  luckyShuffle(
    board: Board,
    coinWallet?: { spendSpiritCoins(amount: number): boolean },
    randomFn: () => number = Math.random
  ): {
    shuffleMoves: Array<{ from: GridPos; to: GridPos }>;
    upgradedCell: GridPos | null;
    upgradedTile: Tile | null;
  } | null {
    if (this.isGameOver) return null;
    if (
      coinWallet &&
      !coinWallet.spendSpiritCoins(GameConstants.luckyShuffleCoinCost)
    ) {
      return null;
    }

    const shuffleMoves = Board.shuffleBoard(board, randomFn);
    const standardCells: GridPos[] = [];
    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const t = board.tileAt(r, c);
        if (t && !t.isSpecial) {
          standardCells.push(new GridPos(r, c));
        }
      }
    }

    let upgradedCell: GridPos | null = null;
    let upgradedTile: Tile | null = null;
    if (standardCells.length > 0) {
      const idx = Math.min(
        standardCells.length - 1,
        Math.floor(randomFn() * standardCells.length)
      );
      upgradedCell = standardCells[idx];
      const baseTile = board.getAt(upgradedCell)!;
      const specialPool = [
        SpecialKind.slashRow,
        SpecialKind.slashColumn,
        SpecialKind.burst,
      ] as const;
      const chosenKind =
        specialPool[
          Math.min(
            specialPool.length - 1,
            Math.floor(randomFn() * specialPool.length)
          )
        ];
      upgradedTile = new Tile(baseTile.type, chosenKind);
      board.setAt(upgradedCell, upgradedTile);
    }

    this._notify();
    return {
      shuffleMoves,
      upgradedCell,
      upgradedTile,
    };
  }

  /**
   * Second Wind Continue (on out-of-moves):
   * Costs 40 🪙 (`GameConstants.secondWindCoinCost`) for +5 moves, 100% spirit charge,
   * and Festival Fever Streak protection.
   */
  activateSecondWind(coinWallet?: {
    spendSpiritCoins(amount: number): boolean;
    setFestivalFeverStreak?(streak: number): unknown;
  }): boolean {
    if (this._status !== GameStatus.lost) {
      return false;
    }
    if (
      coinWallet &&
      !coinWallet.spendSpiritCoins(GameConstants.secondWindCoinCost)
    ) {
      return false;
    }

    this._movesLeft += GameConstants.secondWindExtraMoves;
    this._spiritCharge = GameConstants.spiritChargeMax;
    this._status = GameStatus.idle;
    if (coinWallet?.setFestivalFeverStreak) {
      coinWallet.setFestivalFeverStreak(this._festivalFeverStreak);
    }
    this._notify();
    return true;
  }

  /**
   * Packs stored `bentoDock` specials into `carryOverBento` on level victory
   * (costs 25 🪙, or 0 🪙 at Fever Tier 5).
   */
  packTakeoutBento(bentoWallet?: {
    packTakeoutBento(
      items: readonly BentoSlotItem[],
      feverStreakOverride?: number
    ): boolean;
  }): readonly BentoSlotItem[] | null {
    const itemsToPack: BentoSlotItem[] =
      this.filledBentoSlots.length > 0
        ? [...this.filledBentoSlots]
        : [
            {
              id: `takeout_${++this._bentoSeq}`,
              tileType: TileType.sakura,
              specialType: SpecialKind.slashRow,
            },
          ];

    if (
      bentoWallet &&
      !bentoWallet.packTakeoutBento(itemsToPack, this._festivalFeverStreak)
    ) {
      return null;
    }
    return itemsToPack;
  }

  beginResolving(): void {
    if (this.isGameOver) return;
    this._status = GameStatus.resolving;
    this._notify();
  }

  /**
   * Called ONLY after a valid swap (one that creates a match or activates a special).
   * Invalid swaps that swap back do NOT cost a move.
   */
  useMove(board?: Board, randomFn: () => number = Math.random): void {
    if (this.isGameOver) return;
    if (this._movesLeft > 0) {
      this._movesLeft -= 1;
      if (this.isBossLevel) {
        this._bossTurnCounter += 1;
        const counterInterval =
          this._level.yokaiBoss?.counterIntervalTurns ??
          GameConstants.yokaiBossCounterIntervalTurns;
        if (
          this._bossTurnCounter > 0 &&
          this._bossTurnCounter % counterInterval === 0
        ) {
          this.triggerBossCounterAttack(board, randomFn);
        }
      }
      this._notify();
    }
  }

  /**
   * Adds score for every step, reduces collect goals by the tile types cleared,
   * removes at most 1 glow layer per cleared glowing cell per step (+100 pts each),
   * charges the Kitsune Spirit Companion Meter (+4 per matched tile, +15 per cascade wave),
   * processes Custom Festival Blockers (Paper Lanterns, Sugar Molds, Torii Gates),
   * deals Yokai Boss damage (1x normal match, 2x special detonation),
   * and triggers Asymmetric Elemental Signatures for any activated special tiles.
   * Goals and glow layers never go below 0.
   */
  applyResolveSteps(
    steps: ResolveStep[],
    board?: Board,
    randomFn: () => number = Math.random
  ): number[] {
    if (this.isGameOver) return [];

    this._syncBlockersWithBoard(board);
    const stepScores: number[] = [];
    this._lastStepGlowRemovals = [];
    this._lastMoveElementalCoins = 0;
    this._lastTriggeredElementalPower = null;
    this._lastElementalSignatureResult = null;
    this._lastKitsuneSkillCallout = null;
    this._lastBossDamageDealt = 0;
    let totalMatchedTilesInMove = 0;
    let moveSugarMoldCoins = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let pts = Scoring.scoreForStep(step, i);
      totalMatchedTilesInMove += step.cleared.length;

      const uniqueClearedKeys = new Set<string>(step.clearedKeys);
      for (const sp of step.createdSpecials) {
        uniqueClearedKeys.add(sp.cell.key);
      }

      const stepRemovals: GlowRemovalEvent[] = [];
      for (const key of uniqueClearedKeys) {
        const pos = GridPos.fromKey(key);
        const currentLayers = this.glowLayersAt(pos.row, pos.col);
        if (currentLayers > 0) {
          const nextLayers = Math.max(0, currentLayers - 1);
          this._glowGrid[pos.row][pos.col] = nextLayers;
          pts += GameConstants.glowLayerClearedBonus;
          stepRemovals.push({
            pos,
            previousLayers: currentLayers,
            newLayers: nextLayers,
          });
        }
      }

      this._lastStepGlowRemovals.push(stepRemovals);
      if (this._buffOptions.scoreAndCoinBonus) {
        pts = Math.ceil(pts * (1 + GameConstants.landmark2BonusRatio));
      }
      this._score += pts;
      stepScores.push(pts);

      // Phase 5: Yokai Boss damage (1x for normal matches, 2x for Special Tile detonations)
      if (this.isBossLevel) {
        const hasSpecialDetonation =
          step.stepBonusScore > 0 ||
          (step.waves && step.waves.some((w) => w.activated.length > 0));
        this.dealBossDamage(pts, hasSpecialDetonation);
      }

      // Phase 5: Process Custom Festival Blockers for synthetic or resolved steps
      let blockerOutcome: BlockerStepOutcome | undefined = step.blockerOutcome;
      if (!blockerOutcome) {
        const redLanternSpecialCells: GridPos[] = [];
        const dangoSpecialCells: GridPos[] = [];
        const foxMaskSpecialCells: GridPos[] = [];
        if (step.waves) {
          for (const w of step.waves) {
            for (const act of w.activated) {
              if (act.tileType === TileType.lantern) {
                redLanternSpecialCells.push(act.cell);
              } else if (act.tileType === TileType.dango) {
                dangoSpecialCells.push(act.cell);
              } else if (act.tileType === TileType.foxMask) {
                foxMaskSpecialCells.push(act.cell);
              }
            }
          }
        }
        const activeTarget = board ?? this._blockerBoard;
        const stepEffect = activeTarget.applyStepBlockerEffects({
          cleared: step.cleared,
          clearedByType: step.clearedByType,
          redLanternSpecialCells,
          dangoSpecialCells,
          foxMaskSpecialCells,
        });
        const cursedSlateCells = activeTarget.applyToriiGateCurses(
          step.falls,
          step.refills
        );
        blockerOutcome = {
          ...stepEffect,
          cursedSlateCells,
        };
        if (board) {
          this._blockerBoard.restoreBlockers(board.cloneBlockers());
        }
      } else if (board) {
        this._blockerBoard.restoreBlockers(board.cloneBlockers());
      }

      if (blockerOutcome.sugarMoldCoinsEarned > 0) {
        moveSugarMoldCoins += blockerOutcome.sugarMoldCoinsEarned;
        this._sugarMoldCoinsEarned += blockerOutcome.sugarMoldCoinsEarned;
      }

      if (this._level.mode === LevelMode.collect) {
        for (const [tileId, count] of Object.entries(step.clearedByType)) {
          if (
            count !== undefined &&
            Object.prototype.hasOwnProperty.call(this._collectProgress, tileId)
          ) {
            this._collectProgress[tileId] = Math.max(
              0,
              this._collectProgress[tileId] - count
            );
          }
        }
      }
    }

    this._lastMoveCascadeDepth = steps.length;
    this._lastMoveHas4PlusMatch = hasMoveSpecial4PlusMatch(steps);
    this._lastMoveComboCallout = getCascadeComboCallout({
      cascadeDepth: this._lastMoveCascadeDepth,
      has4PlusMatch: this._lastMoveHas4PlusMatch,
    });
    this._lastMoveCoinsEarned =
      calculateMoveSpiritCoins({
        cascadeDepth: this._lastMoveCascadeDepth,
        has4PlusMatch: this._lastMoveHas4PlusMatch,
        scoreAndCoinBonus: Boolean(this._buffOptions.scoreAndCoinBonus),
      }) + moveSugarMoldCoins;

    // Charge Kitsune Spirit Companion Meter (+4 per matched tile, +15 per cascade wave >= 2)
    const chargeGain = calculateSpiritChargeGain({
      matchedTileCount: totalMatchedTilesInMove,
      cascadeDepth: this._lastMoveCascadeDepth,
    });
    if (chargeGain > 0) {
      this._spiritCharge = Math.min(
        GameConstants.spiritChargeMax,
        this._spiritCharge + chargeGain
      );
    }

    // Trigger Asymmetric Elemental Signatures for any activated special tiles in the move's waves
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.waves || step.waves.length === 0) continue;
      for (const wave of step.waves) {
        for (const act of wave.activated) {
          if (act.tileType) {
            const scoreBeforeSig = this._score;
            this.triggerElementalSignature({
              board,
              cell: act.cell,
              tileType: act.tileType,
              randomFn,
              compactBoardAfterClear: Boolean(board),
            });
            const sigScoreDelta = this._score - scoreBeforeSig;
            stepScores[i] += sigScoreDelta;
            if (this.isBossLevel && sigScoreDelta > 0) {
              this.dealBossDamage(sigScoreDelta, true);
            }
          }
        }
      }
    }

    if (!this.isGameOver) {
      this._stars = Scoring.computeStars({
        score: this._score,
        star1: this._level.star1,
        star2: this._level.star2,
        star3: this._level.star3,
        isWin: false,
      });
    }

    this._notify();
    return stepScores;
  }

  /**
   * Called only when the board is fully stable (all cascades and any shuffle finished).
   */
  evaluate(): void {
    if (this.isGameOver) return;

    // Phase 5: Yokai Boss Victory Condition (bringing HP to 0 before moves run out completes the level)
    if (this.isBossLevel && this._yokaiBossHp <= 0) {
      if (this._movesLeft > 0) {
        const rawBonus = this._movesLeft * GameConstants.leftoverMoveBonus;
        this._score += this._buffOptions.scoreAndCoinBonus
          ? Math.ceil(rawBonus * (1 + GameConstants.landmark2BonusRatio))
          : rawBonus;
      }
      this._status = GameStatus.won;
      this._stars = Scoring.computeStars({
        score: Math.max(this._score, this._level.star1),
        star1: this._level.star1,
        star2: this._level.star2,
        star3: this._level.star3,
        isWin: true,
      });
      this._notify();
      return;
    }

    if (this._level.mode === LevelMode.score) {
      if (this._movesLeft === 0) {
        if (this._score >= this._level.star1) {
          this._status = GameStatus.won;
          this._stars = Scoring.computeStars({
            score: this._score,
            star1: this._level.star1,
            star2: this._level.star2,
            star3: this._level.star3,
            isWin: true,
          });
        } else {
          this._status = GameStatus.lost;
          this._stars = Scoring.computeStars({
            score: this._score,
            star1: this._level.star1,
            star2: this._level.star2,
            star3: this._level.star3,
            isWin: false,
          });
        }
      } else {
        this._status = GameStatus.idle;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: false,
        });
      }
    } else if (this._level.mode === LevelMode.collect) {
      if (this.areAllCollectGoalsMet) {
        if (this._movesLeft > 0) {
          const rawBonus = this._movesLeft * GameConstants.leftoverMoveBonus;
          this._score += this._buffOptions.scoreAndCoinBonus
            ? Math.ceil(rawBonus * (1 + GameConstants.landmark2BonusRatio))
            : rawBonus;
        }
        this._status = GameStatus.won;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: true,
        });
      } else if (this._movesLeft === 0) {
        this._status = GameStatus.lost;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: false,
        });
      } else {
        this._status = GameStatus.idle;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: false,
        });
      }
    } else if (this._level.mode === LevelMode.glow) {
      if (this.areAllGlowGoalsMet) {
        if (this._movesLeft > 0) {
          const rawBonus = this._movesLeft * GameConstants.leftoverMoveBonus;
          this._score += this._buffOptions.scoreAndCoinBonus
            ? Math.ceil(rawBonus * (1 + GameConstants.landmark2BonusRatio))
            : rawBonus;
        }
        this._status = GameStatus.won;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: true,
        });
      } else if (this._movesLeft === 0) {
        this._status = GameStatus.lost;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: false,
        });
      } else {
        this._status = GameStatus.idle;
        this._stars = Scoring.computeStars({
          score: this._score,
          star1: this._level.star1,
          star2: this._level.star2,
          star3: this._level.star3,
          isWin: false,
        });
      }
    }

    this._notify();
  }

  restart(): void {
    this.loadLevel(this._level, this._buffOptions);
  }

  loadLevel(config: LevelConfig, buffOptions?: LevelBuffOptions): void {
    this._level = config;
    this._buffOptions = { ...(buffOptions ?? {}) };
    this._movesLeft =
      config.moves +
      (this._buffOptions.extraMoves ? GameConstants.landmark1ExtraMoves : 0);
    this._score = 0;
    this._collectProgress = { ...config.collectGoals };
    this._glowGrid = this._buildGlowGrid(config);
    this._blockerBoard.initBlockers(config.festivalBlockers);
    this._sugarMoldCoinsEarned = 0;
    this._yokaiBossMaxHp = config.yokaiBoss?.maxHp ?? 0;
    this._yokaiBossHp = this._yokaiBossMaxHp;
    this._bossTurnCounter = 0;
    this._lastBossDamageDealt = 0;
    this._lastBossCounterCursedCells = [];
    this._lastStepGlowRemovals = [];
    this._lastMoveCascadeDepth = 0;
    this._lastMoveHas4PlusMatch = false;
    this._lastMoveComboCallout = null;
    this._lastMoveCoinsEarned = 0;
    this._lastMoveElementalCoins = 0;
    this._lastTriggeredElementalPower = null;
    this._lastElementalSignatureResult = null;
    this._sakuraBonusMovesGained = 0;
    this._bentoDock = Array.from(
      { length: GameConstants.bentoDockCapacity },
      () => null
    );
    if (
      this._buffOptions.carryOverBento &&
      this._buffOptions.carryOverBento.length > 0
    ) {
      for (
        let i = 0;
        i <
        Math.min(
          GameConstants.bentoDockCapacity,
          this._buffOptions.carryOverBento.length
        );
        i++
      ) {
        this._bentoDock[i] = { ...this._buffOptions.carryOverBento[i] };
      }
    }
    this._pocketModeActive = false;
    this._armedBentoSlotIndex = null;
    this._festivalFeverStreak = Math.min(
      GameConstants.maxFestivalFeverStreak,
      Math.max(0, Math.trunc(this._buffOptions.festivalFeverStreak ?? 0))
    );
    this._spiritCharge = Math.min(
      GameConstants.spiritChargeMax,
      this._festivalFeverStreak * GameConstants.feverStreakChargeBonusPerTier
    );
    if (
      this._buffOptions.activeCompanionId &&
      ALL_COMPANION_IDS.includes(this._buffOptions.activeCompanionId)
    ) {
      this._activeCompanionId = this._buffOptions.activeCompanionId;
    }
    if (this._buffOptions.companionRank !== undefined) {
      this._companionRank = Math.min(
        GameConstants.companionMaxRank,
        Math.max(1, Math.trunc(this._buffOptions.companionRank))
      );
    }
    this._companionBonusMovesGranted = 0;
    this._lastCompanionBonusCoins = 0;
    this._lastKitsuneSkillCallout = null;
    this._previousTurnSnapshot = null;
    this._rewindsUsed = 0;
    this._status = GameStatus.idle;
    this._stars = 0;
    this._notify();
  }
}
