import { GameConstants } from '../core/constants';
import { LevelConfig, YokaiBossSpec } from './level_config';
import { LevelGenerator } from './level_generator';

/**
 * Accessor for all 30 levels, keeping Levels 1 to 3 identical to Step 3
 * and delegating Levels 4 to 30 to `LevelGenerator`.
 * Milestone Levels 9, 19, and 30 are configured as Yokai Boss Encounters.
 */
export class Levels {
  static readonly YOKAI_BOSS_LEVELS: readonly number[] = [9, 19, 30];
  static readonly all: readonly LevelConfig[] = LevelGenerator.allLevels();

  static getLevel(num: number): LevelConfig {
    return LevelGenerator.getLevel(num);
  }

  static forNumber(num: number): LevelConfig {
    return LevelGenerator.getLevel(num);
  }

  static isBossLevel(num: number): boolean {
    return Boolean(LevelGenerator.getLevel(num).yokaiBoss);
  }

  static bossSpecFor(num: number): YokaiBossSpec | undefined {
    return LevelGenerator.getLevel(num).yokaiBoss;
  }

  static nextAfter(currentNumber: number): LevelConfig | null {
    if (currentNumber < 1 || currentNumber >= GameConstants.totalLevels) {
      return null;
    }
    return LevelGenerator.getLevel(currentNumber + 1);
  }
}

