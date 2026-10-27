import { GameConstants } from '../core/constants';
import {
  BoardThemeId,
  CompanionId,
  GachaPullResult,
  GameProgress,
} from '../logic/progress';
import { BentoSlotItem } from '../logic/special_tiles';

/**
 * Abstract persistence interface for player progression (Step 4 Part C.3).
 * Mirrors `lib/data/progress_repository.dart`.
 */
export abstract class ProgressRepository {
  abstract load(): GameProgress;
  abstract save(progress: GameProgress): void;
  abstract reset(): void;
}

/**
 * Web/localStorage-backed implementation of SharedPreferencesProgressRepository.
 * Stores one JSON string under one key with a schema version number.
 * Missing or corrupted data loads a fresh `GameProgress.initial()` state without throwing.
 */
export class SharedPreferencesProgressRepository extends ProgressRepository {
  readonly storageKey: string;

  constructor(storageKey: string = GameConstants.progressStorageKey) {
    super();
    this.storageKey = storageKey;
  }

  load(): GameProgress {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return GameProgress.initial();
      }
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw || raw.trim().length === 0) {
        return GameProgress.initial();
      }
      const decoded: unknown = JSON.parse(raw);
      return GameProgress.fromJson(decoded);
    } catch {
      return GameProgress.initial();
    }
  }

  save(progress: GameProgress): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          this.storageKey,
          JSON.stringify(progress.toJson())
        );
      }
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }

  reset(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch {
      // Ignore storage removal errors
    }
  }
}

/**
 * In-memory repository for unit tests.
 */
export class InMemoryProgressRepository extends ProgressRepository {
  private rawJson: string | null;

  constructor(initialRawJson: string | null = null) {
    super();
    this.rawJson = initialRawJson;
  }

  setRawJsonForTest(rawJson: string | null): void {
    this.rawJson = rawJson;
  }

  load(): GameProgress {
    if (!this.rawJson || this.rawJson.trim().length === 0) {
      return GameProgress.initial();
    }
    try {
      const decoded: unknown = JSON.parse(this.rawJson);
      return GameProgress.fromJson(decoded);
    } catch {
      return GameProgress.initial();
    }
  }

  save(progress: GameProgress): void {
    this.rawJson = JSON.stringify(progress.toJson());
  }

  reset(): void {
    this.rawJson = null;
  }
}

export type ProgressListener = (progress: GameProgress) => void;

/**
 * Observable progress notifier mirroring `ProgressNotifier` in `lib/data/progress_repository.dart`.
 */
export class ProgressNotifier {
  private readonly repository: ProgressRepository;
  private _progress: GameProgress;
  private readonly listeners = new Set<ProgressListener>();

  constructor(repository: ProgressRepository) {
    this.repository = repository;
    this._progress = repository.load();
  }

  get progress(): GameProgress {
    return this._progress;
  }

  addListener(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this._progress);
    }
  }

  recordWin(params: {
    levelNumber: number;
    score: number;
    stars: number;
  }): GameProgress {
    this._progress = this._progress.recordWin(params);
    this.repository.save(this._progress);
    this.notify();
    return this._progress;
  }

  recordLoss(params?: { levelNumber: number; score: number }): GameProgress {
    const updated = this._progress.recordLoss(params);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  claimTierChest(tierNumber: number): GameProgress {
    const updated = this._progress.claimTierChest(tierNumber);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  addSpiritCoins(amount: number): GameProgress {
    const updated = this._progress.addSpiritCoins(amount);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  spendSpiritCoins(amount: number): boolean {
    const cleanCost = Math.max(0, Math.trunc(amount));
    if (cleanCost === 0) return true;
    if (!this._progress.canAffordCoins(cleanCost)) {
      return false;
    }
    this._progress = this._progress.spendSpiritCoins(cleanCost);
    this.repository.save(this._progress);
    this.notify();
    return true;
  }

  setFestivalFeverStreak(streak: number): GameProgress {
    const updated = this._progress.withFeverStreak(streak);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  packTakeoutBento(
    items: readonly BentoSlotItem[],
    feverStreakOverride?: number
  ): boolean {
    if (items.length === 0) return false;
    const effectiveStreak =
      feverStreakOverride !== undefined
        ? feverStreakOverride
        : this._progress.festivalFeverStreak;
    const cost =
      effectiveStreak >= GameConstants.maxFestivalFeverStreak
        ? 0
        : GameConstants.takeoutBentoCoinCost;
    if (!this._progress.canAffordCoins(cost)) {
      return false;
    }
    this._progress = this._progress.packTakeoutBento(items, effectiveStreak);
    this.repository.save(this._progress);
    this.notify();
    return true;
  }

  consumeCarryOverBento(): readonly BentoSlotItem[] {
    const carried = [...this._progress.carryOverBento];
    if (carried.length > 0) {
      this._progress = this._progress.clearCarryOverBento();
      this.repository.save(this._progress);
      this.notify();
    }
    return carried;
  }

  equipCompanion(id: CompanionId): GameProgress {
    const updated = this._progress.equipCompanion(id);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  equipTheme(id: BoardThemeId): GameProgress {
    const updated = this._progress.equipTheme(id);
    if (updated !== this._progress) {
      this._progress = updated;
      this.repository.save(this._progress);
      this.notify();
    }
    return this._progress;
  }

  performGachaPull(
    rngOrIndex?: (() => number) | number
  ): GachaPullResult | null {
    const out = this._progress.performGachaPull(rngOrIndex);
    if (!out) return null;
    this._progress = out.progress;
    this.repository.save(this._progress);
    this.notify();
    return out.result;
  }

  unlockAllLevels(): GameProgress {
    this._progress = this._progress.withAllLevelsUnlocked();
    this.repository.save(this._progress);
    this.notify();
    return this._progress;
  }

  resetProgress(): GameProgress {
    this.repository.reset();
    this._progress = GameProgress.initial();
    this.notify();
    return this._progress;
  }
}
