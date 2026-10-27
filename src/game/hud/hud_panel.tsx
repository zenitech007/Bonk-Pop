import React, { useEffect, useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { GameConstants } from '../../core/constants';
import { LayoutSpec } from '../../core/layout/screen_layout';
import {
  GameTheme,
  MascotExpression,
  TileStyle,
} from '../../core/theme/game_theme';
import { GameStatus } from '../../logic/game_state';
import { LevelConfig, LevelMode } from '../../logic/level_config';
import { CompanionId, SPIRIT_COMPANIONS } from '../../logic/progress';
import { BentoSlotItem } from '../../logic/special_tiles';
import { SpecialKind, TileShape } from '../../logic/tile_type';
import { MascotAvatar } from './mascot_avatar';

export interface ActiveShrineBuffBadge {
  readonly id: 'extra_moves' | 'score_fan' | 'spirit_special';
  readonly label: string;
  readonly shortLabel: string;
}

export interface HudPanelProps {
  theme: GameTheme;
  layout: LayoutSpec;
  level: LevelConfig;
  movesLeft: number;
  score: number;
  collectProgress: Readonly<Record<string, number>>;
  glowLayersRemaining?: number;
  spiritCoins?: number;
  floatingCoinGain?: { readonly id: number; readonly amount: number } | null;
  activeShrineBuffs?: readonly ActiveShrineBuffBadge[];
  pulsingTargetKeys?: ReadonlySet<string>;
  bentoDock?: readonly (BentoSlotItem | null)[];
  pocketModeActive?: boolean;
  armedBentoSlotIndex?: number | null;
  canFuseBento?: boolean;
  spiritCharge?: number;
  activeCompanionId?: CompanionId;
  companionRank?: number;
  festivalFeverStreak?: number;
  canRewind?: boolean;
  rewindCost?: number;
  yokaiBossHp?: number;
  yokaiBossMaxHp?: number;
  bossTurnCounter?: number;
  status: GameStatus;
  disabled: boolean;
  onPauseClick: () => void;
  onNewBoardClick?: () => void;
  onTogglePocketMode?: () => void;
  onClickBentoSlot?: (slotIndex: number) => void;
  onFuseBento?: () => void;
  onActivateKitsuneSkill?: () => void;
  onCoinBoostKitsune?: () => void;
  onRewindMove?: () => void;
  onLuckyShuffle?: () => void;
}

/**
 * Renders a compact tile icon inside a goal slot using the theme's TileStyle.
 */
export const GoalTileMiniIcon: React.FC<{
  style: TileStyle;
  size?: number;
}> = ({ style, size = 22 }) => {
  return (
    <svg
      viewBox="8 8 84 84"
      style={{ width: `${size}px`, height: `${size}px` }}
      className="shrink-0 drop-shadow-xs"
      aria-hidden="true"
    >
      {style.shape === TileShape.flower && (
        <g stroke={style.outlineColor} strokeWidth="5" fill={style.baseColor}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 50 50)`}
              d="M 50 48 C 34 34, 32 13, 45 10 L 50 15 L 55 10 C 68 13, 66 34, 50 48 Z"
            />
          ))}
          <circle
            cx="50"
            cy="50"
            r="16"
            fill={style.accentColor}
            stroke="none"
          />
        </g>
      )}
      {style.shape === TileShape.lantern && (
        <g>
          <rect
            x="18"
            y="20"
            width="64"
            height="60"
            rx="26"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="5"
          />
          <rect
            x="32"
            y="13"
            width="36"
            height="10"
            rx="4"
            fill={style.accentColor}
          />
          <rect
            x="34"
            y="77"
            width="32"
            height="9"
            rx="4"
            fill={style.accentColor}
          />
        </g>
      )}
      {style.shape === TileShape.triangle && (
        <g>
          <path
            d="M 50 14 C 62 14, 88 62, 84 76 C 80 86, 20 86, 16 76 C 12 62, 38 14, 50 14 Z"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="5"
          />
          <rect
            x="33"
            y="58"
            width="34"
            height="26"
            rx="4"
            fill={style.accentColor}
          />
        </g>
      )}
      {style.shape === TileShape.skewer && (
        <g>
          <line
            x1="15"
            y1="85"
            x2="85"
            y2="15"
            stroke="#B07D4F"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle
            cx="30"
            cy="70"
            r="16"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="17"
            fill="#FFFDF9"
            stroke={style.outlineColor}
            strokeWidth="4"
          />
          <circle
            cx="70"
            cy="30"
            r="16"
            fill={style.accentColor}
            stroke={style.outlineColor}
            strokeWidth="4"
          />
        </g>
      )}
      {style.shape === TileShape.mask && (
        <g>
          <path
            d="M 20 14 L 38 30 L 62 30 L 80 14 L 84 54 L 50 87 L 16 54 Z"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <polygon points="24,22 35,32 23,38" fill={style.accentColor} />
          <polygon points="76,22 65,32 77,38" fill={style.accentColor} />
        </g>
      )}
    </svg>
  );
};

/**
 * Themed star SVG icon (filled or empty) with pop transition when reached.
 */
export const ThemedStarIcon: React.FC<{
  theme: GameTheme;
  filled: boolean;
  size?: number;
}> = ({ theme, filled, size = 20 }) => {
  const star = theme.starIcon;
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        filter: filled ? `drop-shadow(0 0 6px ${star.glowColor})` : 'none',
        transform: filled ? 'scale(1.14)' : 'scale(1)',
        transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      className="shrink-0"
      aria-hidden="true"
    >
      <polygon
        points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.7 5.8,21 7,14.1 2,9.3 8.9,8.3"
        fill={filled ? star.filledColor : star.emptyColor}
        stroke={filled ? star.filledStrokeColor : star.emptyStrokeColor}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Code-drawn luminous gold-pink glow square icon for HUD goals and dialogs.
 */
export const GlowSquareMiniIcon: React.FC<{
  theme: GameTheme;
  size?: number;
  layers?: number;
}> = ({ theme, size = 20, layers = 2 }) => {
  const g = theme.glowCell;
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        filter: `drop-shadow(0 0 5px ${g.layer2Shadow})`,
      }}
      className="shrink-0"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        fill={layers >= 2 ? g.layer2Fill : g.layer1Fill}
        stroke={layers >= 2 ? g.layer2OuterBorder : g.layer1Border}
        strokeWidth="2.2"
      />
      {layers >= 2 && (
        <rect
          x="5.5"
          y="5.5"
          width="13"
          height="13"
          rx="3"
          fill={g.layer2GradientEnd}
          stroke={g.layer2InnerBorder}
          strokeWidth="1.8"
        />
      )}
      <path
        d="M12 6.5 L13.2 10.8 L17.5 12 L13.2 13.2 L12 17.5 L10.8 13.2 L6.5 12 L10.8 10.8 Z"
        fill={g.shimmerStarColor}
      />
    </svg>
  );
};

/**
 * Smoothly counts up to `targetScore` over `GameConstants.scoreCountUpDurationMs` (~300 ms).
 */
export const AnimatedScoreNumber: React.FC<{
  targetScore: number;
  fontFamily: string;
  color: string;
  fontSizePx?: number;
  className?: string;
}> = ({ targetScore, fontFamily, color, fontSizePx, className = '' }) => {
  const [displayed, setDisplayed] = useState(targetScore);

  useEffect(() => {
    if (displayed === targetScore) return;
    const startVal = displayed;
    const diff = targetScore - startVal;
    const startTime = performance.now();
    const duration = GameConstants.scoreCountUpDurationMs;
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(startVal + diff * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetScore]);

  return (
    <span
      data-testid="hud-score"
      data-target-score={targetScore}
      style={{
        fontFamily,
        color,
        ...(fontSizePx ? { fontSize: `${fontSizePx}px` } : {}),
      }}
      className={`tabular-nums ${className}`}
    >
      {displayed.toLocaleString()}
    </span>
  );
};

/**
 * Renders the responsive HUD according to `LayoutSpec`:
 * - Portrait mode: Full-width rounded top HUD (`hud` rect, content inside `hudContent` max 760px)
 *   + Centred bottom bar (`bottomBar` rect: `90%` compact, `70%` medium/expanded) with Gear button on left
 *   and empty themed booster rail on right.
 * - Landscape mode: Left panel (`leftPanel` rect: Level title, big Moves badge, score + star bar, goal panel)
 *   + Right panel (`rightPanel` rect: large Kitsune mascot + Gear pause button, or merged into bottom of left panel).
 * Mirrors `lib/game/hud/hud_panel.dart`.
 */
export const HudPanel: React.FC<HudPanelProps> = ({
  theme,
  layout,
  level,
  movesLeft,
  score,
  collectProgress,
  glowLayersRemaining = 0,
  spiritCoins = GameConstants.initialSpiritCoins,
  floatingCoinGain = null,
  activeShrineBuffs = [],
  pulsingTargetKeys,
  bentoDock = [null, null, null],
  pocketModeActive = false,
  armedBentoSlotIndex = null,
  canFuseBento = false,
  spiritCharge = 0,
  activeCompanionId = 'kitsune',
  companionRank = 1,
  festivalFeverStreak = 0,
  canRewind = false,
  rewindCost = 0,
  yokaiBossHp = 0,
  yokaiBossMaxHp = 0,
  bossTurnCounter = 0,
  status,
  disabled,
  onPauseClick,
  onTogglePocketMode,
  onClickBentoSlot,
  onFuseBento,
  onActivateKitsuneSkill,
  onCoinBoostKitsune,
  onRewindMove,
  onLuckyShuffle,
}) => {
  const hud = theme.hud;
  const sidePanel = theme.sidePanel;
  const s = layout.uiScale;
  const isLowMoves = movesLeft <= GameConstants.lowMovesThreshold;
  const clampedCharge = Math.min(
    GameConstants.spiritChargeMax,
    Math.max(0, Math.round(spiritCharge))
  );
  const isSpiritReady = clampedCharge >= GameConstants.spiritChargeMax;
  const clampedStreak = Math.min(
    GameConstants.maxFestivalFeverStreak,
    Math.max(0, Math.trunc(festivalFeverStreak))
  );

  let expression = MascotExpression.normal;
  if (status === GameStatus.won || isSpiritReady) {
    expression = MascotExpression.happy;
  } else if (status === GameStatus.lost) {
    expression = MascotExpression.sad;
  } else if (isLowMoves) {
    expression = MascotExpression.worried;
  }

  const maxBarScore = level.star3;
  const fillPct = Math.min(100, Math.max(0, (score / maxBarScore) * 100));
  const star1Pct = (level.star1 / maxBarScore) * 100;
  const star2Pct = (level.star2 / maxBarScore) * 100;
  const star3Pct = 100;

  const renderMovesBadge = (compactLandscape = false) => (
    <div
      data-testid="hud-moves-badge"
      style={{
        backgroundColor: hud.badgeBackground,
        borderColor: isLowMoves ? hud.lowMovesColor : hud.badgeBorder,
        borderRadius: `${Math.round(16 * s)}px`,
        padding: compactLandscape
          ? `${Math.round(4 * s)}px ${Math.round(10 * s)}px`
          : `${Math.round(5 * s)}px ${Math.round(12 * s)}px`,
        minWidth: `${Math.round((compactLandscape ? 64 : 74) * Math.min(1.25, s))}px`,
      }}
      className="border-2 flex flex-col items-center justify-center shrink-0 shadow-inner"
    >
      <span
        style={{
          fontFamily: theme.titleFontFamily,
          color: hud.textSecondary,
          fontSize: `${Math.max(10, Math.round(11 * s))}px`,
        }}
        className="font-bold tracking-wide leading-none"
      >
        Moves
      </span>
      <span
        data-testid="hud-moves-left"
        style={{
          fontFamily: theme.numberFontFamily,
          color: isLowMoves ? hud.lowMovesColor : hud.textPrimary,
          fontSize: `${Math.max(20, Math.round((compactLandscape ? 24 : 28) * s))}px`,
          transform: isLowMoves ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 220ms ease, color 220ms ease',
        }}
        className={`font-extrabold leading-tight tabular-nums ${
          isLowMoves ? 'animate-pulse' : ''
        }`}
      >
        {movesLeft}
      </span>
    </div>
  );

  const renderStarProgressBar = () => {
    const starSize = Math.max(15, Math.round(18 * Math.min(1.25, s)));
    return (
      <div className="relative w-full flex items-center py-1">
        <div
          style={{
            backgroundColor: hud.progressTrackColor,
            borderColor: hud.badgeBorder,
            height: `${Math.max(10, Math.round(12 * Math.min(1.25, s)))}px`,
          }}
          className="w-full rounded-full border overflow-hidden p-0.5"
        >
          <div
            data-testid="hud-progress-fill"
            style={{
              width: `${fillPct}%`,
              background: `linear-gradient(90deg, ${hud.progressFillStart}, ${hud.progressFillEnd})`,
              transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="h-full rounded-full"
          />
        </div>

        {[
          { pct: star1Pct, threshold: level.star1, idx: 1 },
          { pct: star2Pct, threshold: level.star2, idx: 2 },
          { pct: star3Pct, threshold: level.star3, idx: 3 },
        ].map((st) => (
          <div
            key={st.idx}
            style={{ left: `${st.pct}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          >
            <ThemedStarIcon
              theme={theme}
              filled={score >= st.threshold}
              size={starSize}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderFeverStreakBadge = () => (
    <div
      data-testid="game-fever-streak"
      data-streak={clampedStreak}
      title={`Festival Fever Streak ${clampedStreak}/${GameConstants.maxFestivalFeverStreak} (+${clampedStreak * GameConstants.feverStreakChargeBonusPerTier}% Starting Spirit Charge)`}
      style={{
        background:
          clampedStreak > 0
            ? 'linear-gradient(135deg, rgba(255, 77, 121, 0.38) 0%, rgba(255, 209, 102, 0.28) 100%)'
            : 'rgba(36, 19, 48, 0.85)',
        borderColor: clampedStreak > 0 ? '#FF85A1' : hud.badgeBorder,
        color: clampedStreak > 0 ? '#FFE5EC' : hud.textSecondary,
        fontFamily: theme.numberFontFamily,
      }}
      className="px-1.5 py-0.5 rounded-full border font-black text-[10px] sm:text-[11px] inline-flex items-center gap-0.5 whitespace-nowrap"
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        🔥
      </span>
      <span className="tabular-nums">
        {clampedStreak}/{GameConstants.maxFestivalFeverStreak}
      </span>
    </div>
  );

  const renderCoinsIndicator = () => (
    <div className="relative inline-flex items-center gap-1">
      {renderFeverStreakBadge()}
      <div
        data-testid="game-hud-coins"
        data-coins={spiritCoins}
        style={{
          backgroundColor: '#281534',
          borderColor: '#FFD166',
          color: '#FFF3B0',
          fontFamily: theme.numberFontFamily,
          boxShadow: '0 0 8px rgba(255, 209, 102, 0.35)',
        }}
        className="px-2 py-0.5 rounded-full border font-black text-[11px] sm:text-xs inline-flex items-center gap-1 whitespace-nowrap"
      >
        <span aria-hidden="true" className="text-[11px] leading-none">
          🪙
        </span>
        <span className="tabular-nums">{spiritCoins}</span>
      </div>

      {floatingCoinGain && floatingCoinGain.amount > 0 && (
        <span
          key={floatingCoinGain.id}
          data-testid="floating-coin-gain"
          data-amount={floatingCoinGain.amount}
          style={{
            backgroundColor: '#FFE066',
            color: '#23122E',
            fontFamily: theme.numberFontFamily,
            boxShadow: '0 0 12px rgba(255, 224, 102, 0.9)',
          }}
          className="pointer-events-none absolute -bottom-5 right-0 z-30 px-1.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap animate-chest-pop"
        >
          +{floatingCoinGain.amount} 🪙
        </span>
      )}
    </div>
  );

  const renderKitsuneCompanionMeter = (avatarSize: number) => {
    const ringRadius = avatarSize * 0.48;
    const circumference = 2 * Math.PI * ringRadius;
    const dashOffset =
      circumference * (1 - clampedCharge / GameConstants.spiritChargeMax);
    const canAffordBoost = spiritCoins >= GameConstants.kitsuneCoinChargeCost;
    const companionSpec =
      SPIRIT_COMPANIONS[activeCompanionId] ?? SPIRIT_COMPANIONS.kitsune;
    const clampedRank = Math.min(
      GameConstants.companionMaxRank,
      Math.max(1, Math.trunc(companionRank))
    );

    return (
      <div className="relative flex flex-col items-center justify-center shrink-0">
        <button
          type="button"
          data-testid="kitsune-spirit-meter"
          data-active-companion={companionSpec.id}
          data-companion-rank={clampedRank}
          data-spirit-charge={clampedCharge}
          data-spirit-ready={isSpiritReady ? 'true' : 'false'}
          aria-label={
            isSpiritReady
              ? `Activate ${companionSpec.name} (★${clampedRank}) Skill (100% Ready)`
              : `${companionSpec.name} (★${clampedRank}) Charge ${clampedCharge}%`
          }
          disabled={disabled}
          onClick={() => {
            if (isSpiritReady && !disabled) {
              onActivateKitsuneSkill?.();
            }
          }}
          style={{
            width: `${avatarSize + 8}px`,
            height: `${avatarSize + 8}px`,
            boxShadow: isSpiritReady
              ? '0 0 16px rgba(76, 201, 240, 0.9), 0 0 26px rgba(255, 209, 102, 0.75)'
              : 'none',
          }}
          className={`relative rounded-full flex items-center justify-center transition-transform ${
            isSpiritReady
              ? 'cursor-pointer animate-pulse active:scale-95'
              : 'cursor-default'
          }`}
        >
          {/* SVG Circular Spirit Charge Ring */}
          <svg
            viewBox={`0 0 ${avatarSize + 8} ${avatarSize + 8}`}
            className="pointer-events-none absolute inset-0 w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={(avatarSize + 8) / 2}
              cy={(avatarSize + 8) / 2}
              r={ringRadius}
              fill="none"
              stroke="rgba(45, 24, 62, 0.8)"
              strokeWidth="4"
            />
            <circle
              cx={(avatarSize + 8) / 2}
              cy={(avatarSize + 8) / 2}
              r={ringRadius}
              fill="none"
              stroke={isSpiritReady ? '#FFE066' : companionSpec.accentColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 260ms ease' }}
            />
          </svg>

          <MascotAvatar
            theme={theme}
            expression={expression}
            size={Math.max(38, avatarSize - 4)}
          />

          {/* Top Companion Icon + Name + Star Rank Badge */}
          <span
            data-testid="hud-companion-badge"
            data-companion-id={companionSpec.id}
            data-companion-rank={clampedRank}
            style={{
              backgroundColor: '#1E112A',
              borderColor: companionSpec.accentColor,
              color: '#FFE066',
              fontFamily: theme.titleFontFamily,
            }}
            className="pointer-events-none absolute -top-1.5 px-1.5 py-0.2 rounded-full border text-[8.5px] font-black leading-tight whitespace-nowrap shadow-xs inline-flex items-center gap-0.5"
          >
            <span aria-hidden="true">{companionSpec.emoji}</span>
            <span>{companionSpec.shortName}</span>
            <span>★{clampedRank}</span>
          </span>

          <span
            data-testid="kitsune-charge-percent"
            style={{
              backgroundColor: isSpiritReady ? '#FFE066' : '#1E112A',
              borderColor: isSpiritReady ? '#FF4D79' : companionSpec.accentColor,
              color: isSpiritReady ? '#1E112A' : '#E0FBFC',
              fontFamily: theme.numberFontFamily,
            }}
            className="pointer-events-none absolute -bottom-1 px-1.5 py-0.2 rounded-full border text-[9px] font-black leading-tight tabular-nums whitespace-nowrap shadow-xs"
          >
            {clampedCharge}%
          </span>
        </button>

        {clampedCharge < GameConstants.spiritChargeMax && (
          <button
            type="button"
            data-testid="kitsune-coin-charge-button"
            data-cost={GameConstants.kitsuneCoinChargeCost}
            aria-label={`Boost ${companionSpec.name} Charge to 100% for ${GameConstants.kitsuneCoinChargeCost} Spirit Coins`}
            disabled={disabled || !canAffordBoost}
            onClick={onCoinBoostKitsune}
            style={{
              background:
                'linear-gradient(135deg, #281534 0%, #4A1942 100%)',
              borderColor: '#FFD166',
              color: '#FFF3B0',
              fontFamily: theme.titleFontFamily,
            }}
            className="mt-1 px-1.5 py-0.5 rounded-full border text-[9px] font-extrabold leading-none whitespace-nowrap cursor-pointer hover:brightness-110 active:scale-95 disabled:opacity-45"
          >
            Boost {GameConstants.kitsuneCoinChargeCost} 🪙
          </button>
        )}
      </div>
    );
  };

  const renderActiveShrineBuffsStrip = () => (
    <div
      data-testid="game-active-shrine-buffs"
      data-buff-count={activeShrineBuffs.length}
      className="inline-flex items-center justify-center gap-1 flex-wrap"
    >
      {activeShrineBuffs.map((buff) => (
        <span
          key={buff.id}
          data-testid={`game-shrine-buff-${buff.id}`}
          title={buff.label}
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 209, 102, 0.22) 0%, rgba(255, 92, 138, 0.28) 100%)',
            borderColor: '#FFD166',
            color: '#FFF3B0',
            fontFamily: theme.titleFontFamily,
          }}
          className="px-1.5 py-0.5 rounded-md border text-[9px] sm:text-[10px] font-extrabold leading-none whitespace-nowrap"
        >
          {buff.shortLabel}
        </span>
      ))}
    </div>
  );

  const renderYokaiBossHealthBar = () => {
    if (yokaiBossMaxHp <= 0 && !level.yokaiBoss) return null;
    const maxHp = yokaiBossMaxHp > 0 ? yokaiBossMaxHp : (level.yokaiBoss?.maxHp ?? 1000);
    const currentHp = Math.max(0, Math.min(maxHp, yokaiBossHp));
    const hpPct = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));
    const bossName = level.yokaiBoss?.name ?? 'Yokai Shrine Boss';
    const turnsUntilCurse =
      GameConstants.yokaiBossCounterIntervalTurns -
      (bossTurnCounter % GameConstants.yokaiBossCounterIntervalTurns);

    return (
      <div
        data-testid="yokai-boss-health-bar"
        data-boss-hp={currentHp}
        data-boss-max-hp={maxHp}
        data-turns-until-curse={turnsUntilCurse}
        style={{
          background:
            'linear-gradient(135deg, rgba(60, 9, 36, 0.94) 0%, rgba(28, 12, 43, 0.96) 100%)',
          borderColor: '#FF4D79',
          boxShadow: '0 0 12px rgba(255, 77, 121, 0.45)',
        }}
        className="w-full rounded-xl border px-2 py-0.5 flex flex-col gap-0.5"
      >
        <div className="w-full flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] font-black leading-none">
          <span
            style={{ color: '#FFB7C5', fontFamily: theme.titleFontFamily }}
            className="truncate"
          >
            👹 {bossName}
          </span>
          <span
            data-testid="yokai-boss-hp-text"
            style={{ color: '#FFF3B0', fontFamily: theme.numberFontFamily }}
            className="tabular-nums whitespace-nowrap"
          >
            HP: {currentHp} / {maxHp}
          </span>
        </div>
        <div
          style={{ backgroundColor: 'rgba(18, 6, 26, 0.85)' }}
          className="w-full h-2 rounded-full overflow-hidden border border-pink-400/40 p-0.2"
        >
          <div
            data-testid="yokai-boss-hp-fill"
            style={{
              width: `${hpPct}%`,
              background:
                'linear-gradient(90deg, #FF2A5F 0%, #FF758F 55%, #FFD166 100%)',
              transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="h-full rounded-full"
          />
        </div>
      </div>
    );
  };

  const renderGoalsPanel = () => {
    const iconSize = Math.max(15, Math.round(18 * Math.min(1.2, s)));
    const textPx = Math.max(11, Math.round(12 * Math.min(1.2, s)));
    return (
      <div
        data-testid="hud-goals-panel"
        style={{
          backgroundColor: hud.badgeBackground,
          borderColor: hud.badgeBorder,
          borderRadius: `${Math.round(13 * s)}px`,
          padding: `${Math.round(3 * s)}px ${Math.round(9 * s)}px`,
        }}
        className="border flex items-center justify-center gap-2 flex-wrap shadow-inner"
      >
        {level.mode === LevelMode.score ? (
          <div
            data-testid="hud-target-item-0"
            data-target-pulsing={
              pulsingTargetKeys?.has('score') ? 'true' : 'false'
            }
            data-completed={score >= level.star1 ? 'true' : 'false'}
            style={{
              transform: pulsingTargetKeys?.has('score')
                ? 'scale(1.14)'
                : score >= level.star1
                  ? 'scale(1.06)'
                  : 'scale(1)',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap"
          >
            <ThemedStarIcon
              theme={theme}
              filled={score >= level.star1}
              size={iconSize - 2}
            />
            <span
              style={{
                fontFamily: theme.numberFontFamily,
                color: hud.textPrimary,
                fontSize: `${textPx}px`,
              }}
              className="tabular-nums"
            >
              Goal: {level.star1.toLocaleString()}
            </span>
            {score >= level.star1 && (
              <span
                data-testid="hud-target-check-0"
                style={{ color: hud.checkMarkColor }}
                className="inline-flex items-center font-black text-xs"
                aria-label="Target reached"
              >
                ✓
              </span>
            )}
          </div>
        ) : level.mode === LevelMode.glow ? (
          <div
            data-testid="hud-target-item-0"
            data-target-pulsing={
              pulsingTargetKeys?.has('glow') ? 'true' : 'false'
            }
            data-completed={glowLayersRemaining <= 0 ? 'true' : 'false'}
            style={{
              transform: pulsingTargetKeys?.has('glow')
                ? 'scale(1.16)'
                : glowLayersRemaining <= 0
                  ? 'scale(1.06)'
                  : 'scale(1)',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            className="inline-flex items-center"
          >
            <div
              data-testid="goal-slot-glow"
              data-remaining={glowLayersRemaining}
              className="inline-flex items-center gap-1.5 font-extrabold whitespace-nowrap"
            >
              <GlowSquareMiniIcon theme={theme} size={iconSize} layers={2} />
              {glowLayersRemaining <= 0 ? (
                <span
                  data-testid="goal-check-glow"
                  style={{ color: hud.checkMarkColor }}
                  className="inline-flex items-center gap-0.5 font-black text-xs"
                  aria-label="Glow goal complete"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>✓</span>
                </span>
              ) : (
                <span
                  data-testid="hud-glow-remaining"
                  style={{
                    fontFamily: theme.numberFontFamily,
                    color: pulsingTargetKeys?.has('glow')
                      ? '#FFE066'
                      : hud.textPrimary,
                    fontSize: `${textPx}px`,
                  }}
                  className="tabular-nums"
                >
                  {glowLayersRemaining}
                </span>
              )}
            </div>
          </div>
        ) : (
          Object.keys(level.collectGoals).map((tileId, idx) => {
            const remaining = collectProgress[tileId] ?? 0;
            const done = remaining <= 0;
            const isPulsing = pulsingTargetKeys?.has(tileId) ?? false;
            const style = theme.styleForId(tileId);
            return (
              <div
                key={tileId}
                data-testid={`hud-target-item-${idx}`}
                data-target-tile={tileId}
                data-target-pulsing={isPulsing ? 'true' : 'false'}
                data-completed={done ? 'true' : 'false'}
                style={{
                  transform: isPulsing
                    ? 'scale(1.18)'
                    : done
                      ? 'scale(1.06)'
                      : 'scale(1)',
                  transition:
                    'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                className={`inline-flex items-center rounded-lg px-1 ${
                  isPulsing ? 'bg-amber-300/20 ring-1 ring-amber-300' : ''
                }`}
              >
                <div
                  data-testid={`goal-slot-${tileId}`}
                  data-remaining={remaining}
                  className="inline-flex items-center gap-1 font-extrabold whitespace-nowrap"
                >
                  <GoalTileMiniIcon style={style} size={iconSize} />
                  {done ? (
                    <span
                      data-testid={`goal-check-${tileId}`}
                      style={{ color: hud.checkMarkColor }}
                      className="inline-flex items-center gap-0.5 font-black text-xs"
                      aria-label={`${style.label} goal complete`}
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>✓</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: theme.numberFontFamily,
                        color: isPulsing ? '#FFE066' : hud.textPrimary,
                        fontSize: `${textPx}px`,
                      }}
                      className="tabular-nums"
                    >
                      {remaining}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const specialBadgeText = (specialKind: SpecialKind): string => {
    switch (specialKind) {
      case SpecialKind.slashRow:
        return '↔';
      case SpecialKind.slashColumn:
        return '↕';
      case SpecialKind.burst:
        return '✦';
      case SpecialKind.orb:
        return '★';
      default:
        return '•';
    }
  };

  const renderBentoForgeDock = (compactLandscape = false) => {
    const isNarrowMobile = layout.bottomBar.width < 360;
    const slotSize = compactLandscape
      ? 30
      : isNarrowMobile
        ? 28
        : Math.max(30, Math.min(40, Math.round(layout.bottomBar.height * 0.54)));
    const canAffordRewind = rewindCost === 0 || spiritCoins >= rewindCost;
    const canAffordLuckyShuffle =
      spiritCoins >= GameConstants.luckyShuffleCoinCost;

    return (
      <div
        data-testid="booster-rail"
        style={{
          backgroundColor: hud.railSlotBackground,
          borderColor: pocketModeActive ? '#4CC9F0' : hud.railSlotBorder,
          borderRadius: `${Math.round(16 * Math.min(1.2, s))}px`,
          boxShadow: pocketModeActive
            ? '0 0 12px rgba(76, 201, 240, 0.55)'
            : 'none',
        }}
        className={`flex-1 min-w-0 border px-1 sm:px-2 py-1 flex items-center justify-between gap-0.5 sm:gap-1 ${
          compactLandscape ? 'w-full flex-wrap justify-center' : ''
        }`}
      >
        {/* A. Pocket Mode Toggle Button */}
        <button
          type="button"
          data-testid="bento-pocket-mode-button"
          data-active={pocketModeActive ? 'true' : 'false'}
          aria-label="Toggle Bento Pocket Mode"
          disabled={disabled}
          onClick={onTogglePocketMode}
          style={{
            background: pocketModeActive
              ? 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)'
              : hud.badgeBackground,
            borderColor: pocketModeActive ? '#FFF3B0' : hud.badgeBorder,
            color: pocketModeActive ? '#FFFFFF' : hud.textPrimary,
            fontFamily: theme.titleFontFamily,
          }}
          className="px-1 sm:px-2 py-1 rounded-xl border text-[8.5px] sm:text-xs font-extrabold tracking-tight whitespace-nowrap cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
        >
          {pocketModeActive ? 'Pocket: ON' : 'Pocket'}
        </button>

        {/* 3 Circular Bento Forge Slots */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1.5">
          {[0, 1, 2].map((idx) => {
            const slotItem = bentoDock[idx] ?? null;
            const isFilled = slotItem !== null;
            const isArmed = armedBentoSlotIndex === idx;
            const tileStyle = slotItem
              ? theme.styleFor(slotItem.tileType)
              : null;

            return (
              <button
                key={idx}
                type="button"
                data-testid={`bento-dock-slot-${idx}`}
                data-slot-filled={isFilled ? 'true' : 'false'}
                data-slot-armed={isArmed ? 'true' : 'false'}
                data-tile-type={slotItem?.tileType ?? ''}
                data-special-kind={slotItem?.specialType ?? ''}
                aria-label={
                  slotItem
                    ? `Bento Slot ${idx + 1}: ${tileStyle?.label ?? slotItem.tileType} (${slotItem.specialType})${isArmed ? ' Armed' : ''}`
                    : `Bento Slot ${idx + 1}: Empty (Tap to Pocket)`
                }
                disabled={disabled}
                onClick={() => onClickBentoSlot?.(idx)}
                style={{
                  width: `${slotSize}px`,
                  height: `${slotSize}px`,
                  background:
                    isFilled && tileStyle
                      ? `linear-gradient(145deg, ${tileStyle.plateGradientStart}, ${tileStyle.plateGradientEnd})`
                      : 'rgba(22, 11, 32, 0.72)',
                  borderColor: isArmed
                    ? '#4CC9F0'
                    : isFilled
                      ? '#FFD166'
                      : 'rgba(214, 158, 194, 0.42)',
                  boxShadow: isArmed
                    ? '0 0 14px rgba(76, 201, 240, 0.9)'
                    : isFilled
                      ? '0 0 10px rgba(255, 209, 102, 0.5)'
                      : 'inset 0 2px 5px rgba(0, 0, 0, 0.45)',
                  transform: isArmed ? 'scale(1.1)' : 'scale(1)',
                }}
                className="relative rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                {isFilled && tileStyle && slotItem ? (
                  <>
                    <GoalTileMiniIcon
                      style={tileStyle}
                      size={Math.round(slotSize * 0.62)}
                    />
                    <span
                      style={{
                        backgroundColor: '#1E112A',
                        borderColor: '#FFD166',
                        color: '#FFE066',
                      }}
                      className="pointer-events-none absolute -top-1 -right-1 w-4 h-4 rounded-full border text-[9px] font-black flex items-center justify-center leading-none"
                    >
                      {specialBadgeText(slotItem.specialType)}
                    </span>
                  </>
                ) : (
                  <span
                    style={{ color: 'rgba(255, 214, 232, 0.45)' }}
                    className="text-xs font-black leading-none"
                  >
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* C. Bento Fusion Button (active glowing button when 2+ slots are filled) */}
        {canFuseBento && (
          <button
            type="button"
            data-testid="bento-fuse-button"
            aria-label="Fuse 2 Docked Bento Specials"
            disabled={disabled}
            onClick={onFuseBento}
            style={{
              background:
                'linear-gradient(135deg, #FFE066 0%, #FF4D79 55%, #7209B7 100%)',
              borderColor: '#FFF3B0',
              color: '#FFFFFF',
              fontFamily: theme.titleFontFamily,
              boxShadow: '0 0 14px rgba(255, 209, 102, 0.85)',
            }}
            className="px-1.5 py-1 rounded-xl border-2 text-[8.5px] sm:text-xs font-black tracking-tight whitespace-nowrap cursor-pointer animate-pulse transition-transform active:scale-95 disabled:opacity-50"
          >
            ⚡ Fuse Bento
          </button>
        )}

        {/* D. 1-Move Time-Slip Rewind & Lucky Shuffle Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            data-testid="time-slip-rewind-button"
            data-rewind-cost={rewindCost}
            data-can-rewind={canRewind ? 'true' : 'false'}
            aria-label={
              rewindCost === 0
                ? 'Rewind Last Move (Free)'
                : `Rewind Last Move (${rewindCost} Spirit Coins)`
            }
            disabled={disabled || !canRewind || !canAffordRewind}
            onClick={onRewindMove}
            style={{
              backgroundColor: hud.badgeBackground,
              borderColor: canRewind ? '#4CC9F0' : hud.badgeBorder,
              color: hud.textPrimary,
              fontFamily: theme.titleFontFamily,
            }}
            className="px-1 sm:px-1.5 py-1 rounded-xl border text-[8.5px] sm:text-[10px] font-extrabold tracking-tight whitespace-nowrap cursor-pointer transition-transform active:scale-95 disabled:opacity-45"
          >
            {rewindCost === 0
              ? '↺ Rewind (Free)'
              : `↺ Rewind (${rewindCost} 🪙)`}
          </button>

          <button
            type="button"
            data-testid="lucky-shuffle-button"
            data-cost={GameConstants.luckyShuffleCoinCost}
            aria-label={`Lucky Shuffle (${GameConstants.luckyShuffleCoinCost} Spirit Coins)`}
            disabled={disabled || !canAffordLuckyShuffle}
            onClick={onLuckyShuffle}
            style={{
              backgroundColor: hud.badgeBackground,
              borderColor: '#FFD166',
              color: '#FFF3B0',
              fontFamily: theme.titleFontFamily,
            }}
            className="px-1 sm:px-1.5 py-1 rounded-xl border text-[8.5px] sm:text-[10px] font-extrabold tracking-tight whitespace-nowrap cursor-pointer transition-transform active:scale-95 disabled:opacity-45"
          >
            Shuffle ({GameConstants.luckyShuffleCoinCost} 🪙)
          </button>
        </div>
      </div>
    );
  };

  if (layout.isPortrait) {
    const mascotSize = Math.min(
      Math.max(44, Math.round(layout.hud.height * 0.56)),
      72
    );
    const gearBtnSize = Math.max(
      GameConstants.minTouchTarget,
      Math.min(54, Math.round(layout.bottomBar.height * 0.68))
    );

    return (
      <>
        {/* Top Full-Width HUD Panel with Rounded Bottom Edge */}
        <section
          aria-label="Level Status HUD"
          data-testid="hud-panel"
          style={{
            left: `${layout.hud.left}px`,
            top: `${layout.hud.top}px`,
            width: `${layout.hud.width}px`,
            height: `${layout.hud.height}px`,
            backgroundColor: hud.panelBackground,
            borderBottom: `3px solid ${hud.panelBorder}`,
            borderBottomLeftRadius: `${Math.round(24 * Math.min(1.2, s))}px`,
            borderBottomRightRadius: `${Math.round(24 * Math.min(1.2, s))}px`,
            boxShadow: '0 6px 20px rgba(23, 10, 32, 0.52)',
          }}
          className="absolute z-10 flex items-center justify-center px-3"
        >
          <div
            style={{ width: `${layout.hudContent.width}px` }}
            className="h-full flex items-center justify-between gap-2 sm:gap-3"
          >
            {/* Left: Big Moves Number */}
            {renderMovesBadge(false)}

            {/* Centre: Level Title, Coins, Star Progress Bar, Goal Panel & Active Shrine Buffs */}
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between gap-1.5 px-0.5">
                <span
                  data-testid="hud-level-title"
                  style={{
                    fontFamily: theme.titleFontFamily,
                    color: hud.textPrimary,
                    fontSize: `${Math.max(12, Math.round(14 * Math.min(1.2, s)))}px`,
                  }}
                  className="font-extrabold tracking-tight whitespace-nowrap"
                >
                  Level {level.number}
                </span>

                <div className="inline-flex items-center gap-1.5">
                  {renderCoinsIndicator()}
                  <AnimatedScoreNumber
                    targetScore={score}
                    fontFamily={theme.numberFontFamily}
                    color={hud.textPrimary}
                    fontSizePx={Math.max(11, Math.round(13 * Math.min(1.2, s)))}
                    className="font-extrabold"
                  />
                </div>
              </div>

              {renderYokaiBossHealthBar()}
              {renderStarProgressBar()}
              <div className="mt-0.5 flex items-center justify-center gap-1.5 flex-wrap">
                {renderGoalsPanel()}
                {renderActiveShrineBuffsStrip()}
              </div>
            </div>

            {/* Right: Kitsune Spirit Companion Meter + Boost Button */}
            {renderKitsuneCompanionMeter(mascotSize)}
          </div>
        </section>

        {/* Bottom Bar: 90% width on compact, 70% on medium/expanded, Gear on left + 3-Slot Bento Forge Dock on right */}
        <footer
          aria-label="Game Controls Bar"
          data-testid="bottom-bar"
          style={{
            left: `${layout.bottomBar.left}px`,
            top: `${layout.bottomBar.top}px`,
            width: `${layout.bottomBar.width}px`,
            height: `${layout.bottomBar.height}px`,
            backgroundColor: hud.panelBackground,
            borderColor: hud.panelBorder,
            borderRadius: `${Math.round(22 * Math.min(1.2, s))}px`,
            boxShadow: '0 6px 20px rgba(18, 8, 28, 0.55)',
          }}
          className="absolute z-10 border-2 px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2"
        >
          <button
            type="button"
            aria-label="Pause Game"
            data-testid="pause-button"
            disabled={disabled}
            onClick={onPauseClick}
            style={{
              width: `${gearBtnSize}px`,
              height: `${gearBtnSize}px`,
              backgroundColor: hud.badgeBackground,
              borderColor: hud.badgeBorder,
              color: hud.textPrimary,
            }}
            className="rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer hover:brightness-110 disabled:opacity-50 transition-transform active:scale-95"
          >
            <Settings
              style={{
                width: `${Math.round(gearBtnSize * 0.48)}px`,
                height: `${Math.round(gearBtnSize * 0.48)}px`,
              }}
              aria-hidden="true"
            />
          </button>

          {/* 3-Slot Bento Forge Dock + Rewind & Lucky Shuffle */}
          {renderBentoForgeDock(false)}
        </footer>
      </>
    );
  }

  // Landscape Mode: Left Panel + Right Panel (or merged into Left Panel when side space is tight)
  const gearSize = Math.max(
    GameConstants.minTouchTarget,
    Math.round(46 * Math.min(1.2, s))
  );
  const mascotRightSize = Math.min(
    Math.max(50, Math.round(layout.rightPanel.width * 0.56)),
    96
  );

  return (
    <>
      <section
        aria-label="Level Status Panel"
        data-testid="landscape-left-panel"
        style={{
          left: `${layout.leftPanel.left}px`,
          top: `${layout.leftPanel.top}px`,
          width: `${layout.leftPanel.width}px`,
          height: `${layout.leftPanel.height}px`,
          backgroundColor: sidePanel.backgroundColor,
          borderColor: sidePanel.borderColor,
          borderRadius: `${Math.round(sidePanel.cornerRadius * Math.min(1.15, s))}px`,
          boxShadow: `0 8px 24px ${sidePanel.glowColor}`,
        }}
        className="absolute z-10 border-2 p-2.5 sm:p-3.5 flex flex-col items-center justify-between overflow-hidden"
      >
        <div className="w-full flex items-center justify-between gap-1">
          <span
            data-testid="hud-level-title"
            style={{
              fontFamily: theme.titleFontFamily,
              color: hud.textPrimary,
              fontSize: `${Math.max(13, Math.round(16 * Math.min(1.2, s)))}px`,
            }}
            className="font-extrabold tracking-tight whitespace-nowrap"
          >
            Level {level.number}
          </span>
          {renderCoinsIndicator()}
        </div>

        {renderMovesBadge(true)}

        <div className="w-full flex flex-col items-center gap-0.5">
          {renderYokaiBossHealthBar()}
          <AnimatedScoreNumber
            targetScore={score}
            fontFamily={theme.numberFontFamily}
            color={hud.textPrimary}
            fontSizePx={Math.max(13, Math.round(15 * Math.min(1.2, s)))}
            className="font-extrabold mb-0.5"
          />
          {renderStarProgressBar()}
        </div>

        <div className="flex flex-col items-center gap-1">
          {renderGoalsPanel()}
          {renderActiveShrineBuffsStrip()}
        </div>

        {layout.mergeRightIntoLeftPanel && (
          <div className="w-full flex flex-col items-center gap-1.5 pt-1">
            {renderBentoForgeDock(true)}
            <div className="w-full flex items-center justify-evenly">
              {renderKitsuneCompanionMeter(44)}
              <button
                type="button"
                aria-label="Pause Game"
                data-testid="pause-button"
                disabled={disabled}
                onClick={onPauseClick}
                style={{
                  width: `${GameConstants.minTouchTarget}px`,
                  height: `${GameConstants.minTouchTarget}px`,
                  backgroundColor: hud.badgeBackground,
                  borderColor: hud.badgeBorder,
                  color: hud.textPrimary,
                }}
                className="rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer hover:brightness-110 disabled:opacity-50"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      {!layout.mergeRightIntoLeftPanel && !layout.rightPanel.isEmpty && (
        <aside
          aria-label="Mascot and Controls Panel"
          data-testid="landscape-right-panel"
          style={{
            left: `${layout.rightPanel.left}px`,
            top: `${layout.rightPanel.top}px`,
            width: `${layout.rightPanel.width}px`,
            height: `${layout.rightPanel.height}px`,
            backgroundColor: sidePanel.backgroundColor,
            borderColor: sidePanel.borderColor,
            borderRadius: `${Math.round(sidePanel.cornerRadius * Math.min(1.15, s))}px`,
            boxShadow: `0 8px 24px ${sidePanel.glowColor}`,
          }}
          className="absolute z-10 border-2 p-3 flex flex-col items-center justify-evenly gap-2"
        >
          {renderKitsuneCompanionMeter(mascotRightSize)}
          {renderBentoForgeDock(true)}
          <button
            type="button"
            aria-label="Pause Game"
            data-testid="pause-button"
            disabled={disabled}
            onClick={onPauseClick}
            style={{
              width: `${gearSize}px`,
              height: `${gearSize}px`,
              backgroundColor: hud.badgeBackground,
              borderColor: hud.badgeBorder,
              color: hud.textPrimary,
            }}
            className="rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer hover:brightness-110 disabled:opacity-50 transition-transform active:scale-95"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </aside>
      )}
    </>
  );
};
