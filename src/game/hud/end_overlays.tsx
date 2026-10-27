import React, { useEffect, useState } from 'react';
import { HeartCrack, MapPin, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import { GameConstants } from '../../core/constants';
import { LayoutSpec } from '../../core/layout/screen_layout';
import { GameTheme } from '../../core/theme/game_theme';
import { GameStatus } from '../../logic/game_state';
import { LevelConfig, LevelMode } from '../../logic/level_config';
import { Levels } from '../../logic/levels';
import {
  AnimatedScoreNumber,
  GlowSquareMiniIcon,
  GoalTileMiniIcon,
  ThemedStarIcon,
} from './hud_panel';

export interface EndAndPauseOverlaysProps {
  theme: GameTheme;
  layout: LayoutSpec;
  level: LevelConfig;
  status: GameStatus;
  score: number;
  stars: number;
  collectProgress: Readonly<Record<string, number>>;
  glowLayersRemaining?: number;
  spiritCoins?: number;
  festivalFeverStreak?: number;
  takeoutBentoCost?: number;
  takeoutBentoPacked?: boolean;
  bentoSpecialsCount?: number;
  isPaused: boolean;
  showEndDialog: boolean;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onQuitToMap: () => void;
  onNewBoard?: () => void;
  onPackTakeoutBento?: () => void;
  onSecondWindContinue?: () => void;
}

/**
 * Renders the end-of-level sliding festival banner ("Level Complete!" or "Level Failed!"),
 * the Win dialog ("Next Level", "Pack Takeout Bento", & "Map"; only "Map" on Level 30),
 * the Lose dialog ("Second Wind (+5 Moves)", "Retry" + X close button going back to Map),
 * and the Pause dialog ("Resume", "Restart", "Quit to map").
 * Also supports `Enter` to activate the primary action of an open dialog.
 */
export const EndAndPauseOverlays: React.FC<EndAndPauseOverlaysProps> = ({
  theme,
  layout,
  level,
  status,
  score,
  stars,
  collectProgress,
  glowLayersRemaining = 0,
  spiritCoins = GameConstants.initialSpiritCoins,
  festivalFeverStreak = 0,
  takeoutBentoCost = GameConstants.takeoutBentoCoinCost,
  takeoutBentoPacked = false,
  bentoSpecialsCount = 0,
  isPaused,
  showEndDialog,
  onResume,
  onRestart,
  onNextLevel,
  onQuitToMap,
  onNewBoard,
  onPackTakeoutBento,
  onSecondWindContinue,
}) => {
  const [litStars, setLitStars] = useState(0);

  useEffect(() => {
    if (!showEndDialog || status !== GameStatus.won) {
      setLitStars(0);
      return;
    }
    const timers: number[] = [];
    for (let i = 1; i <= stars; i++) {
      const t = window.setTimeout(() => {
        setLitStars(i);
      }, i * GameConstants.starPopIntervalMs);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
  }, [showEndDialog, status, stars]);

  // Enter activates the primary button of an open dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (isPaused) {
        e.preventDefault();
        onResume();
      } else if (showEndDialog && status === GameStatus.won) {
        e.preventDefault();
        const nextLvl = Levels.nextAfter(level.number);
        if (nextLvl) {
          onNextLevel();
        } else {
          onQuitToMap();
        }
      } else if (showEndDialog && status === GameStatus.lost) {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPaused,
    level.number,
    onNextLevel,
    onQuitToMap,
    onRestart,
    onResume,
    showEndDialog,
    status,
  ]);

  const dlg = theme.dialogFrame;
  const btn = theme.buttonStyle;
  const banner = theme.bannerStripe;
  const hud = theme.hud;
  const s = layout.uiScale;
  const minBtnH = Math.max(
    GameConstants.minTouchTarget,
    Math.round(46 * Math.min(1.2, s))
  );

  // 1. Pause Modal
  if (isPaused) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game Paused"
        data-testid="pause-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: dlg.overlayScrimColor }}
      >
        <div
          style={{
            width: `${layout.dialogMaxWidth}px`,
            maxWidth: '100%',
            maxHeight: '90dvh',
            backgroundColor: dlg.backgroundColor,
            borderColor: dlg.borderColor,
            borderRadius: `${dlg.cornerRadius}px`,
            boxShadow: `0 0 32px ${dlg.glowColor}`,
          }}
          className="border-[3px] p-5 sm:p-6 flex flex-col items-center text-center overflow-y-auto"
        >
          <h2
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textPrimary,
              fontSize: `${Math.round(22 * Math.min(1.2, s))}px`,
            }}
            className="font-extrabold mb-4"
          >
            Game Paused
          </h2>

          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              data-testid="pause-resume-button"
              onClick={onResume}
              style={{
                minHeight: `${minBtnH}px`,
                backgroundColor: btn.primaryBackground,
                borderColor: btn.primaryBorder,
                color: btn.primaryText,
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full py-2.5 px-5 border-2 font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 shadow-lg transition-transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Resume</span>
            </button>

            <button
              type="button"
              data-testid="pause-restart-button"
              onClick={onRestart}
              style={{
                minHeight: `${minBtnH}px`,
                backgroundColor: btn.secondaryBackground,
                borderColor: btn.secondaryBorder,
                color: btn.secondaryText,
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full py-2.5 px-5 border-2 font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Restart</span>
            </button>

            <button
              type="button"
              data-testid="pause-quit-map-button"
              onClick={onQuitToMap}
              style={{
                minHeight: `${minBtnH}px`,
                backgroundColor: btn.secondaryBackground,
                borderColor: btn.secondaryBorder,
                color: btn.secondaryText,
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full py-2.5 px-5 border-2 font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition-transform active:scale-95"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>Quit to map</span>
            </button>

            {import.meta.env.DEV && onNewBoard && (
              <button
                type="button"
                data-testid="dev-new-board-button"
                onClick={() => {
                  onNewBoard();
                  onResume();
                }}
                style={{
                  minHeight: `${minBtnH}px`,
                  backgroundColor: hud.badgeBackground,
                  borderColor: hud.badgeBorder,
                  color: hud.textSecondary,
                  borderRadius: `${btn.cornerRadius}px`,
                  fontFamily: theme.titleFontFamily,
                }}
                className="w-full py-2 px-4 border font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Board (Dev)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isGameOver = status === GameStatus.won || status === GameStatus.lost;
  if (!isGameOver) return null;

  // 2. Wide Horizontal Festival Banner (slides in for ~1 s before dialog)
  if (!showEndDialog) {
    const isWin = status === GameStatus.won;
    const stripeGradient = `repeating-linear-gradient(135deg, ${banner.stripePrimary} 0px, ${banner.stripePrimary} 14px, ${banner.stripeSecondary} 14px, ${banner.stripeSecondary} 28px)`;

    return (
      <div
        data-testid="end-banner"
        className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto"
        style={{ backgroundColor: 'rgba(15, 8, 22, 0.45)' }}
      >
        <div
          style={{
            backgroundColor: banner.backgroundColor,
            borderColor: banner.borderColor,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
          }}
          className="w-full border-y-4 overflow-hidden animate-banner-slide"
        >
          <div style={{ background: stripeGradient }} className="w-full h-3" />
          <div className="py-5 px-4 text-center">
            <p
              style={{
                fontFamily: theme.titleFontFamily,
                color: banner.textColor,
                fontSize: `${Math.round(24 * Math.min(1.25, s))}px`,
              }}
              className="font-extrabold tracking-wide drop-shadow-md"
            >
              {isWin
                ? 'Level Complete!'
                : 'Level Failed! You did not reach the goal!'}
            </p>
          </div>
          <div style={{ background: stripeGradient }} className="w-full h-3" />
        </div>
      </div>
    );
  }

  // 3. Win Dialog
  if (status === GameStatus.won) {
    const nextLvl = Levels.nextAfter(level.number);
    const effectiveCost =
      festivalFeverStreak >= GameConstants.maxFestivalFeverStreak
        ? 0
        : takeoutBentoCost;
    const canAffordTakeout = spiritCoins >= effectiveCost;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Level Complete"
        data-testid="win-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: dlg.overlayScrimColor }}
      >
        <div
          style={{
            width: `${layout.dialogMaxWidth}px`,
            maxWidth: '100%',
            maxHeight: '90dvh',
            backgroundColor: dlg.backgroundColor,
            borderColor: dlg.borderColor,
            borderRadius: `${dlg.cornerRadius}px`,
            boxShadow: `0 0 36px ${dlg.glowColor}`,
          }}
          className="border-[3px] p-5 sm:p-6 flex flex-col items-center text-center overflow-y-auto"
        >
          <span
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textSecondary,
            }}
            className="text-xs font-extrabold tracking-wider"
          >
            Level Complete!
          </span>
          <h2
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textPrimary,
              fontSize: `${Math.round(24 * Math.min(1.2, s))}px`,
            }}
            className="font-extrabold mt-0.5 mb-3"
          >
            Level {level.number}
          </h2>

          {/* 3 Star Slots filling one by one */}
          <div
            data-testid="win-stars-row"
            data-earned-stars={stars}
            className="flex items-center justify-center gap-4 my-1.5"
          >
            {[1, 2, 3].map((idx) => (
              <ThemedStarIcon
                key={idx}
                theme={theme}
                filled={idx <= litStars}
                size={Math.round(44 * Math.min(1.15, s))}
              />
            ))}
          </div>

          {/* Final Score counting up */}
          <div
            style={{
              backgroundColor: hud.badgeBackground,
              borderColor: hud.badgeBorder,
            }}
            className="w-full rounded-2xl border py-2.5 px-4 my-3 flex flex-col items-center"
          >
            <span
              style={{
                fontFamily: theme.titleFontFamily,
                color: hud.textSecondary,
              }}
              className="text-xs font-bold"
            >
              Final Score
            </span>
            <AnimatedScoreNumber
              targetScore={score}
              fontFamily={theme.numberFontFamily}
              color={hud.textPrimary}
              fontSizePx={Math.round(26 * Math.min(1.2, s))}
              className="font-extrabold mt-0.5"
            />
          </div>

          <div className="w-full flex flex-col gap-2.5">
            {/* Pack Takeout Bento Button (25 🪙, or 0 🪙 at Fever Tier 5) */}
            <button
              type="button"
              data-testid="pack-takeout-bento-button"
              data-cost={effectiveCost}
              data-packed={takeoutBentoPacked ? 'true' : 'false'}
              data-bento-count={bentoSpecialsCount}
              disabled={takeoutBentoPacked || !canAffordTakeout}
              onClick={onPackTakeoutBento}
              style={{
                minHeight: `${minBtnH}px`,
                background: takeoutBentoPacked
                  ? 'rgba(46, 74, 62, 0.9)'
                  : 'linear-gradient(135deg, #281534 0%, #5B2A5F 100%)',
                borderColor: '#FFD166',
                color: '#FFF3B0',
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full py-2 px-4 border-2 font-extrabold text-sm cursor-pointer hover:brightness-110 transition-transform active:scale-95 disabled:opacity-55"
            >
              {takeoutBentoPacked
                ? '🍱 Takeout Bento Packed!'
                : effectiveCost === 0
                  ? '🍱 Pack Takeout Bento (0 🪙 · Fever 5!)'
                  : `🍱 Pack Takeout Bento (${effectiveCost} 🪙)`}
            </button>

            {nextLvl !== null && (
              <button
                type="button"
                data-testid="win-next-button"
                onClick={onNextLevel}
                style={{
                  minHeight: `${minBtnH}px`,
                  backgroundColor: btn.primaryBackground,
                  borderColor: btn.primaryBorder,
                  color: btn.primaryText,
                  borderRadius: `${btn.cornerRadius}px`,
                  fontFamily: theme.titleFontFamily,
                }}
                className="w-full py-2.5 px-5 border-2 font-extrabold text-base cursor-pointer hover:brightness-110 shadow-lg transition-transform active:scale-95"
              >
                Next Level
              </button>
            )}

            <button
              type="button"
              data-testid="win-map-button"
              onClick={onQuitToMap}
              style={{
                minHeight: `${minBtnH}px`,
                backgroundColor:
                  nextLvl === null
                    ? btn.primaryBackground
                    : btn.secondaryBackground,
                borderColor:
                  nextLvl === null ? btn.primaryBorder : btn.secondaryBorder,
                color: nextLvl === null ? btn.primaryText : btn.secondaryText,
                borderRadius: `${btn.cornerRadius}px`,
                fontFamily: theme.titleFontFamily,
              }}
              className="w-full py-2.5 px-5 border-2 font-extrabold text-base cursor-pointer hover:brightness-110 transition-transform active:scale-95"
            >
              Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Lose Dialog
  const canAffordSecondWind = spiritCoins >= GameConstants.secondWindCoinCost;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Level Failed"
      data-testid="lose-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: dlg.overlayScrimColor }}
    >
      <div
        style={{
          width: `${layout.dialogMaxWidth}px`,
          maxWidth: '100%',
          maxHeight: '90dvh',
          backgroundColor: dlg.backgroundColor,
          borderColor: dlg.borderColor,
          borderRadius: `${dlg.cornerRadius}px`,
          boxShadow: `0 0 36px ${dlg.glowColor}`,
        }}
        className="relative border-[3px] p-5 sm:p-6 flex flex-col items-center text-center overflow-y-auto"
      >
        {/* Close (X) button now goes back to the Map */}
        <button
          type="button"
          aria-label="Close to Map"
          data-testid="lose-close-map-button"
          onClick={onQuitToMap}
          style={{
            width: `${GameConstants.minTouchTarget}px`,
            height: `${GameConstants.minTouchTarget}px`,
            backgroundColor: hud.badgeBackground,
            borderColor: hud.badgeBorder,
            color: hud.textPrimary,
          }}
          className="absolute top-3 right-3 rounded-full border flex items-center justify-center cursor-pointer hover:brightness-110"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <HeartCrack
          className="w-12 h-12 mb-2"
          style={{ color: dlg.brokenHeartColor }}
          aria-hidden="true"
        />

        <h2
          style={{
            fontFamily: theme.titleFontFamily,
            color: hud.textPrimary,
            fontSize: `${Math.round(22 * Math.min(1.2, s))}px`,
          }}
          className="font-extrabold"
        >
          Level {level.number} Failed
        </h2>

        <p
          style={{
            fontFamily: theme.titleFontFamily,
            color: hud.textSecondary,
          }}
          className="text-sm font-bold mt-1"
        >
          You ran out of moves
        </p>

        {/* Remaining Goals Summary */}
        <div
          style={{
            backgroundColor: hud.badgeBackground,
            borderColor: hud.badgeBorder,
          }}
          className="w-full rounded-2xl border py-2.5 px-4 my-3.5 flex flex-col items-center gap-1.5"
        >
          <span
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textSecondary,
            }}
            className="text-xs font-bold"
          >
            Remaining Goal
          </span>
          {level.mode === LevelMode.score ? (
            <span
              style={{
                fontFamily: theme.numberFontFamily,
                color: hud.textPrimary,
              }}
              className="text-sm font-extrabold tabular-nums"
            >
              {Math.max(0, level.star1 - score).toLocaleString()} points needed
            </span>
          ) : level.mode === LevelMode.glow ? (
            <div
              data-testid="lose-glow-remaining"
              className="inline-flex items-center gap-2 text-sm font-extrabold"
            >
              <GlowSquareMiniIcon theme={theme} size={20} layers={2} />
              <span
                style={{
                  fontFamily: theme.numberFontFamily,
                  color: hud.textPrimary,
                }}
                className="tabular-nums"
              >
                {glowLayersRemaining}{' '}
                {glowLayersRemaining === 1 ? 'layer' : 'layers'} left
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {Object.keys(level.collectGoals).map((tileId) => {
                const rem = collectProgress[tileId] ?? 0;
                const style = theme.styleForId(tileId);
                return (
                  <div
                    key={tileId}
                    className="inline-flex items-center gap-1.5 text-sm font-extrabold"
                  >
                    <GoalTileMiniIcon style={style} size={20} />
                    <span
                      style={{
                        fontFamily: theme.numberFontFamily,
                        color: hud.textPrimary,
                      }}
                      className="tabular-nums"
                    >
                      {rem} left
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full flex flex-col gap-2.5">
          {/* Second Wind Continue Button (40 🪙 for +5 moves, 100% spirit charge, and streak protection) */}
          <button
            type="button"
            data-testid="second-wind-continue-button"
            data-cost={GameConstants.secondWindCoinCost}
            disabled={!canAffordSecondWind}
            onClick={onSecondWindContinue}
            style={{
              minHeight: `${minBtnH}px`,
              background:
                'linear-gradient(135deg, #4CC9F0 0%, #7209B7 60%, #FF4D79 100%)',
              borderColor: '#FFE066',
              color: '#FFFFFF',
              borderRadius: `${btn.cornerRadius}px`,
              fontFamily: theme.titleFontFamily,
              boxShadow: '0 0 16px rgba(76, 201, 240, 0.55)',
            }}
            className="w-full py-2.5 px-4 border-2 font-extrabold text-sm cursor-pointer hover:brightness-110 transition-transform active:scale-95 disabled:opacity-50"
          >
            🌬️ Second Wind: +{GameConstants.secondWindExtraMoves} Moves & 100% Spirit ({GameConstants.secondWindCoinCost} 🪙)
          </button>

          <button
            type="button"
            data-testid="lose-retry-button"
            onClick={onRestart}
            style={{
              minHeight: `${minBtnH}px`,
              backgroundColor: btn.primaryBackground,
              borderColor: btn.primaryBorder,
              color: btn.primaryText,
              borderRadius: `${btn.cornerRadius}px`,
              fontFamily: theme.titleFontFamily,
            }}
            className="w-full py-2.5 px-5 border-2 font-extrabold text-base cursor-pointer hover:brightness-110 shadow-lg transition-transform active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};
