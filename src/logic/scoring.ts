import { GameConstants } from '../core/constants';
import { ResolveStep } from './board';

/**
 * Pure scoring calculator with no rendering imports.
 * Mirrors `lib/logic/scoring.dart`.
 */
export class Scoring {
  static multiplierForCascadeIndex(cascadeIndex: number): number {
    const raw = Math.max(1, cascadeIndex + 1);
    return Math.min(raw, GameConstants.maxCascadeMultiplier);
  }

  static runBonusForStep(step: ResolveStep): number {
    let bonus = 0;
    if (step.matchRuns && step.matchRuns.length > 0) {
      for (const run of step.matchRuns) {
        if (run.length >= 5) {
          bonus += GameConstants.runOf5OrMoreBonus;
        } else if (run.length === 4) {
          bonus += GameConstants.runOf4Bonus;
        }
      }
      return bonus;
    }

    const count = step.cleared.length;
    if (count >= 5) {
      return GameConstants.runOf5OrMoreBonus;
    } else if (count === 4) {
      return GameConstants.runOf4Bonus;
    }
    return 0;
  }

  static scoreForStep(step: ResolveStep, cascadeIndex: number): number {
    const tilePoints = step.cleared.length * GameConstants.basePointsPerTile;
    const runBonus = this.runBonusForStep(step);
    const multiplier = this.multiplierForCascadeIndex(cascadeIndex);
    const baseScore = (tilePoints + runBonus) * multiplier;
    return baseScore + (step.stepBonusScore ?? 0);
  }

  static computeStars(params: {
    score: number;
    star1: number;
    star2: number;
    star3: number;
    isWin: boolean;
  }): number {
    const { score, star1, star2, star3, isWin } = params;
    let stars = 0;
    if (score >= star3) {
      stars = 3;
    } else if (score >= star2) {
      stars = 2;
    } else if (score >= star1) {
      stars = 1;
    }
    if (isWin && stars < 1) {
      stars = 1;
    }
    return stars;
  }
}
