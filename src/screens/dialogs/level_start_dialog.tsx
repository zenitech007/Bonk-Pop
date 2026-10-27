import React, { useEffect, useState } from 'react';
import { Check, Play, Sparkles, Star, X } from 'lucide-react';
import { audioService } from '../../core/audio_service';
import { GameConstants } from '../../core/constants';
import { LayoutSpec } from '../../core/layout/screen_layout';
import { GameTheme } from '../../core/theme/game_theme';
import {
  GlowSquareMiniIcon,
  GoalTileMiniIcon,
  ThemedStarIcon,
} from '../../game/hud/hud_panel';
import { GlowPatterns } from '../../logic/glow_patterns';
import { LevelConfig, LevelMode } from '../../logic/level_config';
import { SHRINE_LANDMARKS } from '../../logic/progress';

export type BentoBoosterId = 'extra_moves' | 'score_fan' | 'spirit_special';

export interface LevelStartDialogProps {
  theme: GameTheme;
  layout: LayoutSpec;
  level: LevelConfig;
  bestStars: number;
  bestScore: number;
  totalStars?: number;
  onPlay: (equippedBoosters?: readonly BentoBoosterId[]) => void;
  onClose: () => void;
}

interface BentoBoosterSlotSpec {
  readonly id: BentoBoosterId;
  readonly index: 0 | 1 | 2;
  readonly title: string;
  readonly shortEffect: string;
  readonly landmarkIndex: 1 | 2 | 3;
}

const BENTO_BOOSTER_SLOTS: readonly BentoBoosterSlotSpec[] = [
  {
    id: 'extra_moves',
    index: 0,
    title: 'Torii Move Charm',
    shortEffect: '+1 Starting Move',
    landmarkIndex: 1,
  },
  {
    id: 'score_fan',
    index: 1,
    title: 'Lantern Score Fan',
    shortEffect: '+10% Score & Coins',
    landmarkIndex: 2,
  },
  {
    id: 'spirit_special',
    index: 2,
    title: 'Kitsune Bento',
    shortEffect: 'Free Special Tile',
    landmarkIndex: 3,
  },
];

function getDifficultyBadgeSpec(levelNumber: number): {
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
} {
  if (levelNumber === 9 || levelNumber === 30) {
    return {
      label: 'Shrine Boss',
      bgColor: 'rgba(225, 29, 72, 0.32)',
      borderColor: '#FF4D6D',
      textColor: '#FFE5EC',
    };
  }
  if (
    levelNumber >= GameConstants.firstHardLevel &&
    levelNumber % GameConstants.hardLevelInterval === 0
  ) {
    return {
      label: 'Hard Matsuri',
      bgColor: 'rgba(217, 119, 6, 0.30)',
      borderColor: '#FFD166',
      textColor: '#FFF3B0',
    };
  }
  if (levelNumber <= 4) {
    return {
      label: 'Easy Festival',
      bgColor: 'rgba(16, 185, 129, 0.25)',
      borderColor: '#34D399',
      textColor: '#D1FAE5',
    };
  }
  return {
    label: 'Normal Matsuri',
    bgColor: 'rgba(168, 85, 247, 0.26)',
    borderColor: '#C084FC',
    textColor: '#F3E8FF',
  };
}

/**
 * Specification 5: Pre-Level "Bento Preview Drawer" (Slide-Up Modal on Node Click).
 * - Header: Level [X] title, difficulty badge, and star record.
 * - Mission Info: Move limit (e.g., 22 Moves) and exact target tile icons and counts required.
 * - Pre-Game Bento Boosters: 3 circular toggle slots where the player can optionally equip a
 *   starting booster (or view active Shrine Landmark buffs).
 * - Action Button: Prominent glowing "Play Level" button + close X button.
 */
export const LevelStartDialog: React.FC<LevelStartDialogProps> = ({
  theme,
  layout,
  level,
  bestStars,
  bestScore,
  totalStars = 0,
  onPlay,
  onClose,
}) => {
  const [equippedBoosters, setEquippedBoosters] = useState<Set<BentoBoosterId>>(
    () => {
      const initial = new Set<BentoBoosterId>();
      for (const slot of BENTO_BOOSTER_SLOTS) {
        const landmark = SHRINE_LANDMARKS.find(
          (l) => l.index === slot.landmarkIndex
        );
        if (landmark && totalStars >= landmark.requiredStars) {
          initial.add(slot.id);
        }
      }
      return initial;
    }
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onPlay(Array.from(equippedBoosters));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [equippedBoosters, onClose, onPlay]);

  const toggleBooster = (id: BentoBoosterId) => {
    audioService.playClick();
    setEquippedBoosters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dlg = theme.dialogFrame;
  const btn = theme.buttonStyle;
  const hud = theme.hud;
  const s = layout.uiScale;
  const minBtnH = Math.max(
    GameConstants.minTouchTarget,
    Math.round(48 * Math.min(1.2, s))
  );
  const diffBadge = getDifficultyBadgeSpec(level.number);
  const hasBonusMove = equippedBoosters.has('extra_moves');

  const renderMissionTargets = () => {
    if (level.mode === LevelMode.score) {
      const primaryTile =
        theme.tileStyles[(level.number - 1) % theme.tileStyles.length];
      return (
        <div
          data-testid="bento-mission-targets"
          className="flex flex-col items-center gap-1.5"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/35 border border-pink-300/30">
              <GoalTileMiniIcon style={primaryTile} size={20} />
              <span
                style={{
                  fontFamily: theme.numberFontFamily,
                  color: '#FFD166',
                }}
                className="text-sm font-black tabular-nums"
              >
                {level.star1.toLocaleString()} pts
              </span>
            </span>
          </div>
          <p
            data-testid="level-start-goal-text"
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textPrimary,
            }}
            className="text-xs sm:text-sm font-extrabold"
          >
            Reach {level.star1.toLocaleString()} points
          </p>
        </div>
      );
    }

    if (level.mode === LevelMode.glow) {
      const totalLayers = GlowPatterns.totalLayers(level.glowCells ?? []);
      return (
        <div
          data-testid="bento-mission-targets"
          className="flex flex-col items-center gap-1.5"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/35 border border-amber-300/40">
            <GlowSquareMiniIcon theme={theme} size={22} layers={2} />
            <span
              style={{
                fontFamily: theme.numberFontFamily,
                color: '#FFD166',
              }}
              className="text-sm font-black tabular-nums"
            >
              × {totalLayers}
            </span>
          </span>
          <div
            data-testid="level-start-goal-text"
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textPrimary,
            }}
            className="text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 flex-wrap"
          >
            <span>Clear all the glowing squares ({totalLayers} layers)</span>
          </div>
        </div>
      );
    }

    const entries = Object.entries(level.collectGoals);
    return (
      <div
        data-testid="bento-mission-targets"
        className="flex flex-col items-center gap-1.5"
      >
        <div
          data-testid="level-start-goal-text"
          style={{
            fontFamily: theme.titleFontFamily,
            color: hud.textPrimary,
          }}
          className="text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 flex-wrap"
        >
          <span className="sr-only">Collect</span>
          {entries.map(([tileId, count], idx) => {
            const style = theme.styleForId(tileId);
            return (
              <React.Fragment key={tileId}>
                {idx > 0 && <span className="sr-only">and</span>}
                <span
                  data-testid={`bento-target-tile-${tileId}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/35 border border-pink-300/30"
                >
                  <GoalTileMiniIcon style={style} size={20} />
                  <span className="tabular-nums font-black text-amber-200">
                    {count}
                  </span>
                  <span className="text-xs opacity-90">{style.label}</span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${level.number}`}
      data-testid="level-start-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-2 pt-2 pb-0 sm:p-4"
      style={{ backgroundColor: dlg.overlayScrimColor }}
    >
      <div
        data-testid="bento-preview-drawer"
        style={{
          width: `${layout.dialogMaxWidth}px`,
          maxWidth: '100%',
          maxHeight: '92dvh',
          background:
            'linear-gradient(180deg, rgba(58, 30, 74, 0.98) 0%, rgba(35, 18, 48, 0.99) 100%)',
          borderColor: dlg.borderColor,
          borderTopLeftRadius: `${dlg.cornerRadius}px`,
          borderTopRightRadius: `${dlg.cornerRadius}px`,
          borderBottomLeftRadius:
            layout.sizeClass === 'compact' ? '18px' : `${dlg.cornerRadius}px`,
          borderBottomRightRadius:
            layout.sizeClass === 'compact' ? '18px' : `${dlg.cornerRadius}px`,
          boxShadow: `0 -6px 36px ${dlg.glowColor}, 0 12px 32px rgba(0,0,0,0.65)`,
        }}
        className="relative border-[3px] px-4 pt-3 pb-4 sm:p-5 flex flex-col items-center text-center overflow-y-auto animate-bento-drawer"
      >
        {/* Top Drawer Handle Pill */}
        <div
          aria-hidden="true"
          className="w-12 h-1.5 rounded-full bg-pink-200/35 mb-2 shrink-0"
        />

        {/* Close X Button */}
        <button
          type="button"
          aria-label="Close Level Dialog"
          data-testid="level-start-close-button"
          onClick={onClose}
          style={{
            width: `${GameConstants.minTouchTarget}px`,
            height: `${GameConstants.minTouchTarget}px`,
            backgroundColor: hud.badgeBackground,
            borderColor: hud.badgeBorder,
            color: hud.textPrimary,
          }}
          className="absolute top-3 right-3 rounded-full border flex items-center justify-center cursor-pointer hover:brightness-110 transition-transform active:scale-95"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Header: Level [X] Title + Difficulty Badge + Star Record */}
        <div className="flex flex-col items-center gap-1 w-full pr-8 pl-8">
          <div className="inline-flex items-center gap-2 flex-wrap justify-center">
            <h2
              data-testid="level-start-title"
              style={{
                fontFamily: theme.titleFontFamily,
                color: hud.textPrimary,
                fontSize: `${Math.round(22 * Math.min(1.15, s))}px`,
              }}
              className="font-black tracking-wide leading-tight"
            >
              Level {level.number}
            </h2>
            <span
              data-testid="level-difficulty-badge"
              style={{
                backgroundColor: diffBadge.bgColor,
                borderColor: diffBadge.borderColor,
                color: diffBadge.textColor,
                fontFamily: theme.titleFontFamily,
              }}
              className="px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold uppercase tracking-wider"
            >
              {diffBadge.label}
            </span>
          </div>

          {/* Star Record (3 Star Slots) + Best Score */}
          <div className="flex items-center justify-center gap-3 mt-1">
            <div
              data-testid="level-start-stars"
              className="flex items-center justify-center gap-2"
            >
              {[1, 2, 3].map((idx) => (
                <ThemedStarIcon
                  key={idx}
                  theme={theme}
                  filled={idx <= bestStars}
                  size={Math.round(28 * Math.min(1.12, s))}
                />
              ))}
            </div>
            {bestScore > 0 && (
              <p
                data-testid="level-start-best-score"
                style={{
                  fontFamily: theme.numberFontFamily,
                  color: hud.textSecondary,
                }}
                className="text-xs font-extrabold tabular-nums"
              >
                Best: {bestScore.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Mission Info Box: Move Limit & Target Tile Icons/Counts */}
        <div
          style={{
            backgroundColor: hud.badgeBackground,
            borderColor: hud.badgeBorder,
          }}
          className="w-full rounded-2xl border px-3.5 py-2.5 my-2 flex flex-col sm:flex-row items-center justify-between gap-2"
        >
          {/* Move Limit */}
          <div className="flex items-center gap-2">
            <span
              data-testid="level-start-moves"
              style={{
                fontFamily: theme.numberFontFamily,
                color: hud.textPrimary,
              }}
              className="px-3 py-1 rounded-xl bg-purple-950/80 border border-pink-300/35 text-xs sm:text-sm font-black tabular-nums inline-flex items-center gap-1.5"
            >
              <span>{level.moves} Moves</span>
              {hasBonusMove && (
                <span
                  data-testid="bento-bonus-move-tag"
                  className="text-amber-300 font-extrabold text-xs"
                >
                  (+1)
                </span>
              )}
            </span>
          </div>

          {/* Target Tile Icons & Counts */}
          {renderMissionTargets()}
        </div>

        {/* Pre-Game Bento Boosters: 3 Circular Toggle Slots */}
        <div
          data-testid="bento-boosters-section"
          style={{
            backgroundColor: 'rgba(29, 15, 38, 0.68)',
            borderColor: 'rgba(255, 183, 197, 0.35)',
          }}
          className="w-full rounded-2xl border px-3 py-2.5 mb-2.5 flex flex-col items-center gap-2"
        >
          <div className="w-full flex items-center justify-between px-1">
            <span
              style={{
                fontFamily: theme.titleFontFamily,
                color: hud.textSecondary,
              }}
              className="text-[11px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>Pre-Game Bento Boosters</span>
            </span>
            <span className="text-[10px] font-bold text-pink-200/80">
              Tap to equip
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            {BENTO_BOOSTER_SLOTS.map((slot) => {
              const isEquipped = equippedBoosters.has(slot.id);
              const landmark = SHRINE_LANDMARKS.find(
                (l) => l.index === slot.landmarkIndex
              )!;
              const isShrineBuffUnlocked =
                totalStars >= landmark.requiredStars;

              return (
                <div
                  key={slot.id}
                  className="flex flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    data-testid={`bento-booster-slot-${slot.index}`}
                    data-booster-id={slot.id}
                    data-equipped={isEquipped ? 'true' : 'false'}
                    data-shrine-buff={isShrineBuffUnlocked ? 'true' : 'false'}
                    aria-pressed={isEquipped}
                    aria-label={`${slot.title}: ${slot.shortEffect}`}
                    onClick={() => toggleBooster(slot.id)}
                    style={{
                      background: isEquipped
                        ? 'radial-gradient(circle, rgba(255, 240, 173, 0.36) 0%, rgba(255, 117, 151, 0.45) 100%)'
                        : 'rgba(43, 25, 46, 0.88)',
                      borderColor: isEquipped ? '#FFE066' : '#7B6588',
                      boxShadow: isEquipped
                        ? '0 0 14px rgba(255, 209, 102, 0.55)'
                        : 'none',
                    }}
                    className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                  >
                    {/* Custom Festival Booster SVG Icon */}
                    {slot.index === 0 && (
                      <svg
                        viewBox="0 0 40 40"
                        className="w-7 h-7"
                        aria-hidden="true"
                      >
                        <rect
                          x="6"
                          y="10"
                          width="28"
                          height="4"
                          rx="2"
                          fill="#FF4D6D"
                        />
                        <rect
                          x="9"
                          y="16"
                          width="22"
                          height="3"
                          rx="1.5"
                          fill="#FF85A1"
                        />
                        <rect
                          x="11"
                          y="13"
                          width="3.5"
                          height="19"
                          fill="#E63956"
                        />
                        <rect
                          x="25.5"
                          y="13"
                          width="3.5"
                          height="19"
                          fill="#E63956"
                        />
                        <text
                          x="20"
                          y="28"
                          textAnchor="middle"
                          fill="#FFF3B0"
                          fontSize="9"
                          fontWeight="900"
                        >
                          +1
                        </text>
                      </svg>
                    )}
                    {slot.index === 1 && (
                      <svg
                        viewBox="0 0 40 40"
                        className="w-7 h-7"
                        aria-hidden="true"
                      >
                        <ellipse
                          cx="20"
                          cy="20"
                          rx="11"
                          ry="9"
                          fill="#FF5C8A"
                          stroke="#FFD166"
                          strokeWidth="2"
                        />
                        <rect
                          x="15"
                          y="9"
                          width="10"
                          height="3"
                          rx="1"
                          fill="#FFD166"
                        />
                        <rect
                          x="16"
                          y="28"
                          width="8"
                          height="3"
                          rx="1"
                          fill="#FFD166"
                        />
                        <circle cx="20" cy="20" r="4" fill="#FFF3B0" />
                      </svg>
                    )}
                    {slot.index === 2 && (
                      <svg
                        viewBox="0 0 40 40"
                        className="w-7 h-7"
                        aria-hidden="true"
                      >
                        <polygon
                          points="9,16 6,6 16,12"
                          fill="#FF85A1"
                        />
                        <polygon
                          points="31,16 34,6 24,12"
                          fill="#FF85A1"
                        />
                        <circle
                          cx="20"
                          cy="22"
                          r="10"
                          fill="#FFFDF9"
                          stroke="#FFD166"
                          strokeWidth="2"
                        />
                        <path
                          d="M15 22 L20 17 L25 22 L20 27 Z"
                          fill="#4CC9F0"
                        />
                      </svg>
                    )}

                    {/* Equipped Check / Shrine Buff Tag */}
                    {isEquipped && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-purple-950 flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  <span
                    style={{
                      fontFamily: theme.titleFontFamily,
                      color: isEquipped ? '#FFF3B0' : hud.textPrimary,
                    }}
                    className="text-[11px] font-extrabold leading-tight"
                  >
                    {slot.shortEffect}
                  </span>
                  <span className="text-[9px] font-bold text-pink-200/75 leading-none inline-flex items-center gap-0.5">
                    {isShrineBuffUnlocked ? (
                      'Shrine Buff Active'
                    ) : isEquipped ? (
                      'Equipped'
                    ) : (
                      <>
                        <span>{landmark.requiredStars}</span>
                        <Star
                          className="w-2.5 h-2.5 fill-current text-amber-300 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Shrine / Tap</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prominent Glowing "Play Level" Button */}
        <button
          type="button"
          data-testid="level-start-play-button"
          data-start="true"
          onClick={() => onPlay(Array.from(equippedBoosters))}
          style={{
            minHeight: `${minBtnH}px`,
            background: `linear-gradient(135deg, ${btn.primaryBackground} 0%, #FF85A1 55%, #FFD166 100%)`,
            borderColor: '#FFF3B0',
            color: '#23122E',
            borderRadius: `${btn.cornerRadius}px`,
            fontFamily: theme.titleFontFamily,
            boxShadow: '0 0 20px rgba(255, 133, 161, 0.65)',
          }}
          className="w-full py-2.5 px-6 border-2 font-black text-base sm:text-lg inline-flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition-transform active:scale-95"
        >
          <Play className="w-5 h-5 fill-current" aria-hidden="true" />
          <span>Play Level</span>
        </button>
      </div>
    </div>
  );
};
