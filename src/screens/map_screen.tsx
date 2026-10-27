import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react';
import { audioService } from '../core/audio_service';
import { GameConstants } from '../core/constants';
import { LayoutSpec } from '../core/layout/screen_layout';
import { GameTheme, TileStyle } from '../core/theme/game_theme';
import { GoalTileMiniIcon } from '../game/hud/hud_panel';
import { LevelMode } from '../logic/level_config';
import { Levels } from '../logic/levels';
import {
  ALL_BOARD_THEME_IDS,
  ALL_COMPANION_IDS,
  BoardThemeId,
  CompanionId,
  GachaPullResult,
  GameProgress,
  getCompanionRankMultiplier,
  LevelNodeState,
  MATSURI_BOARD_THEMES,
  SHRINE_LANDMARKS,
  ShrineLandmarkSpec,
  SPIRIT_COMPANIONS,
  SPIRIT_LATTICE_EDGES,
  SPIRIT_LATTICE_TIERS,
} from '../logic/progress';

export interface MapScreenProps {
  readonly theme: GameTheme;
  readonly layout: LayoutSpec;
  readonly progress: GameProgress;
  readonly onBack: () => void;
  readonly onOpenSettings: () => void;
  readonly onSelectLevel: (levelNumber: number) => void;
  readonly onClaimTierChest?: (tierNumber: number) => void;
  readonly onPerformGachaPull?: () => GachaPullResult | null;
  readonly onEquipCompanion?: (id: CompanionId) => void;
  readonly onEquipTheme?: (id: BoardThemeId) => void;
}

const TIER_STEP_Y = 104;
const TOP_PADDING = 112;
const BOTTOM_PADDING = 104;

interface MatsuriParticleSpec {
  readonly id: number;
  readonly kind: 'sakura_petal' | 'lantern_ember';
  readonly baseXRatio: number;
  readonly initialYRatio: number;
  readonly speedY: number;
  readonly swayAmpPx: number;
  readonly swayFreq: number;
  readonly phase: number;
  readonly sizePx: number;
  readonly alpha: number;
}

const MATSURI_PARTICLES: readonly MatsuriParticleSpec[] = Array.from(
  { length: 28 },
  (_, i) => {
    const isEmber = i % 2 === 1;
    return {
      id: i,
      kind: isEmber ? 'lantern_ember' : 'sakura_petal',
      baseXRatio: ((i * 37) % 100) / 100,
      initialYRatio: ((i * 53) % 100) / 100,
      speedY: isEmber ? 18 + (i % 5) * 4 : 14 + (i % 4) * 3.5,
      swayAmpPx: isEmber ? 10 + (i % 4) * 4 : 16 + (i % 5) * 5,
      swayFreq: 0.9 + (i % 5) * 0.28,
      phase: (i * 1.17) % (Math.PI * 2),
      sizePx: isEmber ? 3 + (i % 3) * 1.3 : 5 + (i % 4) * 1.5,
      alpha: isEmber ? 0.62 + (i % 3) * 0.1 : 0.46 + (i % 3) * 0.08,
    };
  }
);

/**
 * Phase 6 Spec 1: Lightweight Matsuri Particle Canvas (`[data-testid="matsuri-particle-canvas"]`)
 * running on the Map and Gameplay screens. Gently floats translucent pink sakura petals (#FFB7C5)
 * and warm golden lantern embers (#FFD166) upward against the dark twilight background with smooth
 * sine-wave horizontal drift.
 */
export const MatsuriParticleCanvas: React.FC<{
  readonly width: number;
  readonly height: number;
  readonly reducedMotion?: boolean;
}> = ({ width, height, reducedMotion = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number | null = null;
    const startMs = performance.now();

    const renderFrame = (nowMs: number) => {
      const elapsedSec = reducedMotion ? 0 : (nowMs - startMs) / 1000;
      const w = Math.max(1, width);
      const h = Math.max(1, height);

      ctx.clearRect(0, 0, w, h);

      for (const p of MATSURI_PARTICLES) {
        const travelY = (elapsedSec * p.speedY) % (h + 32);
        let y = p.initialYRatio * h - travelY;
        if (y < -16) {
          y += h + 32;
        }
        const sineDrift =
          Math.sin(elapsedSec * p.swayFreq + p.phase) * p.swayAmpPx;
        const x = p.baseXRatio * w + sineDrift;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (p.kind === 'lantern_ember') {
          const grad = ctx.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            p.sizePx * 2.4
          );
          grad.addColorStop(0, '#FFF3B0');
          grad.addColorStop(0.45, '#FFD166');
          grad.addColorStop(1, 'rgba(255, 158, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, p.sizePx * 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const angle = Math.sin(elapsedSec * 1.1 + p.phase) * 0.55;
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.fillStyle = '#FFB7C5';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.sizePx * 1.25, p.sizePx * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (!reducedMotion) {
        animFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame(startMs);
    return () => {
      if (animFrameId !== null) {
        window.cancelAnimationFrame(animFrameId);
      }
    };
  }, [height, reducedMotion, width]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="matsuri-particle-canvas"
      data-particle-types="sakura_petal,lantern_ember"
      data-particle-count={MATSURI_PARTICLES.length}
      width={Math.max(1, Math.round(width))}
      height={Math.max(1, Math.round(height))}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full z-0"
    />
  );
};

interface LatticeNodePosition {
  readonly level: number;
  readonly tier: number;
  readonly xPct: number;
  readonly yPx: number;
  readonly isBoss: boolean;
}

/**
 * Determines the primary tile icon for a level node preview badge.
 */
function getPrimaryTileForLevel(levelNumber: number, theme: GameTheme): TileStyle {
  const cfg = Levels.forNumber(levelNumber);
  if (cfg.mode === LevelMode.collect) {
    const firstKey = Object.keys(cfg.collectGoals)[0];
    if (firstKey) {
      return theme.styleForId(firstKey);
    }
  }
  return theme.tileStyles[(levelNumber - 1) % theme.tileStyles.length];
}

/**
 * Layered SVG illustration for each of the 3 Shrine Restoration Landmarks:
 * - Landmark 1 (6 ★): Crimson Torii Gate
 * - Landmark 2 (15 ★): Glowing Lantern Bridge
 * - Landmark 3 (30 ★): Kitsune Spirit Pavilion
 * Renders as a dim silhouette when locked, and a vibrant neon/gold SVG with floating particle dots when unlocked.
 */
const ShrineLandmarkSvg: React.FC<{
  landmark: ShrineLandmarkSpec;
  unlocked: boolean;
}> = ({ landmark, unlocked }) => {
  const silhouetteFill = '#3D274E';
  const silhouetteStroke = '#63467A';

  return (
    <svg
      viewBox="0 0 96 64"
      className="w-full h-11 sm:h-13 overflow-visible"
      aria-hidden="true"
    >
      {/* Floating particle dots when unlocked */}
      {unlocked && (
        <g data-testid={`landmark-particles-${landmark.index}`}>
          <circle
            cx="14"
            cy="14"
            r="2.2"
            fill="#FFE066"
            className="animate-pulse"
          />
          <circle
            cx="82"
            cy="12"
            r="2"
            fill="#4CC9F0"
            className="animate-pulse"
          />
          <circle
            cx="24"
            cy="8"
            r="1.6"
            fill="#FF85A1"
            className="animate-pulse"
          />
          <circle
            cx="74"
            cy="24"
            r="1.8"
            fill="#FFE066"
            className="animate-pulse"
          />
        </g>
      )}

      {/* Soft ground glow */}
      <ellipse
        cx="48"
        cy="56"
        rx="36"
        ry="5"
        fill={unlocked ? 'rgba(255, 209, 102, 0.28)' : 'rgba(25, 14, 34, 0.5)'}
      />

      {landmark.index === 1 && (
        /* Landmark 1: Crimson Torii Gate */
        <g>
          <rect
            x="24"
            y="49"
            width="8"
            height="6"
            rx="1"
            fill={unlocked ? '#9E8B9C' : silhouetteFill}
          />
          <rect
            x="64"
            y="49"
            width="8"
            height="6"
            rx="1"
            fill={unlocked ? '#9E8B9C' : silhouetteFill}
          />
          <rect
            x="26"
            y="18"
            width="5"
            height="33"
            fill={unlocked ? '#FF3B6B' : silhouetteFill}
            stroke={unlocked ? '#FFD166' : silhouetteStroke}
            strokeWidth="1"
          />
          <rect
            x="65"
            y="18"
            width="5"
            height="33"
            fill={unlocked ? '#FF3B6B' : silhouetteFill}
            stroke={unlocked ? '#FFD166' : silhouetteStroke}
            strokeWidth="1"
          />
          <path
            d="M 14 15 Q 48 9 82 15 L 79 20 Q 48 15 17 20 Z"
            fill={unlocked ? '#FF4D6D' : silhouetteFill}
            stroke={unlocked ? '#FFE066' : silhouetteStroke}
            strokeWidth="1.2"
          />
          <rect
            x="21"
            y="25"
            width="54"
            height="4"
            rx="1.5"
            fill={unlocked ? '#FF758F' : silhouetteFill}
          />
          {/* Hanging Shrine Lantern */}
          <ellipse
            cx="48"
            cy="33"
            rx="4.5"
            ry="5.5"
            fill={unlocked ? '#FFE066' : silhouetteStroke}
          />
        </g>
      )}

      {landmark.index === 2 && (
        /* Landmark 2: Glowing Lantern Bridge */
        <g>
          {/* Arched Bridge Deck */}
          <path
            d="M 12 52 Q 48 26 84 52"
            fill="none"
            stroke={unlocked ? '#FF5C8A' : silhouetteFill}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 14 46 Q 48 20 82 46"
            fill="none"
            stroke={unlocked ? '#FFE066' : silhouetteStroke}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Bridge Posts */}
          {[24, 38, 58, 72].map((x) => (
            <line
              key={x}
              x1={x}
              y1="34"
              x2={x}
              y2="48"
              stroke={unlocked ? '#FF85A1' : silhouetteStroke}
              strokeWidth="2"
            />
          ))}
          {/* Hanging Festival Lanterns */}
          {[26, 48, 70].map((x, i) => (
            <ellipse
              key={x}
              cx={x}
              cy={i === 1 ? 22 : 28}
              rx="4.5"
              ry="5.5"
              fill={unlocked ? '#FFE066' : silhouetteFill}
              stroke={unlocked ? '#FF4D6D' : silhouetteStroke}
              strokeWidth="1.2"
            />
          ))}
        </g>
      )}

      {landmark.index === 3 && (
        /* Landmark 3: Kitsune Spirit Pavilion */
        <g>
          {/* Pavilion Pillars & Chamber */}
          <rect
            x="26"
            y="34"
            width="44"
            height="19"
            rx="2"
            fill={unlocked ? '#5B2A5F' : silhouetteFill}
            stroke={unlocked ? '#FFB7C5' : silhouetteStroke}
            strokeWidth="1.2"
          />
          {/* Golden glowing doorway */}
          <rect
            x="41"
            y="39"
            width="14"
            height="14"
            rx="3"
            fill={unlocked ? '#FFE066' : silhouetteStroke}
          />
          {/* Lower Pagoda Roof */}
          <path
            d="M 16 35 Q 48 25 80 35 L 74 30 Q 48 22 22 30 Z"
            fill={unlocked ? '#FF4D79' : silhouetteFill}
            stroke={unlocked ? '#FFE066' : silhouetteStroke}
            strokeWidth="1.2"
          />
          {/* Upper Pagoda Roof */}
          <path
            d="M 24 24 Q 48 14 72 24 L 66 19 Q 48 11 30 19 Z"
            fill={unlocked ? '#FF7597' : silhouetteFill}
            stroke={unlocked ? '#FFE066' : silhouetteStroke}
            strokeWidth="1.2"
          />
          {/* Kitsune Finial Crest */}
          <polygon
            points="43,14 40,6 47,11"
            fill={unlocked ? '#FFE066' : silhouetteStroke}
          />
          <polygon
            points="53,14 56,6 49,11"
            fill={unlocked ? '#FFE066' : silhouetteStroke}
          />
          <circle
            cx="48"
            cy="13"
            r="3.5"
            fill={unlocked ? '#4CC9F0' : silhouetteStroke}
          />
        </g>
      )}
    </svg>
  );
};

/**
 * Ornate Kitsune Crest SVG crowning the Tier 5 Apex Shrine Boss Node (Level 9).
 */
const BossKitsuneCrestSvg: React.FC<{ level: number }> = ({ level }) => (
  <svg
    viewBox="0 0 120 44"
    data-testid={`boss-kitsune-crest-${level}`}
    className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-8 overflow-visible z-20"
    aria-hidden="true"
  >
    {/* Left & Right Fox Ears */}
    <polygon
      points="34,36 22,6 48,24"
      fill="#FFE066"
      stroke="#B45309"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <polygon points="35,32 27,13 45,24" fill="#FF4D79" />
    <polygon
      points="86,36 98,6 72,24"
      fill="#FFE066"
      stroke="#B45309"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <polygon points="85,32 93,13 75,24" fill="#FF4D79" />
    {/* Center Sacred Jewel */}
    <polygon
      points="60,4 68,18 60,30 52,18"
      fill="#4CC9F0"
      stroke="#FFF3B0"
      strokeWidth="2.2"
    />
  </svg>
);

/**
 * Redesigned "Spirit Matsuri Lattice Map" Screen:
 * 1. Top HUD Bar: Back button, District Badge ("District 1: Kitsune Shrine"), Star Counter pill,
 *    Spirit Coins pill with golden glow, and Settings button.
 * 2. Interactive "Shrine Restoration" Diorama Header: 3 layered SVG landmarks (6 ★ Crimson Torii Gate,
 *    15 ★ Glowing Lantern Bridge, 30 ★ Kitsune Spirit Pavilion) with passive buff badges & progress bar.
 * 3. Non-Linear "Spirit Lantern Lattice": Ascending horizontal Tiers (Tier 1: L1; Tier 2: L2, L3;
 *    Tier 3: L4, L5, L6; Tier 4: L7, L8; Tier 5: L9 Apex Boss Node; plus upper tiers L10..30)
 *    connected by SVG spirit-thread lines.
 * 4. "Row Harmony Chests": Right-hand Tier Harmony Chests on Tiers 1..5 awarding +100 Spirit Coins
 *    when all nodes in that horizontal row have >= 1 ★.
 */
export const MapScreen: React.FC<MapScreenProps> = ({
  theme,
  layout,
  progress,
  onBack,
  onOpenSettings,
  onSelectLevel,
  onClaimTierChest,
  onPerformGachaPull,
  onEquipCompanion,
  onEquipTheme,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [shakingLevel, setShakingLevel] = useState<number | null>(null);
  const [poppingChestTier, setPoppingChestTier] = useState<number | null>(null);
  const [isShrineCollapsed, setIsShrineCollapsed] = useState(false);
  const [isGachaModalOpen, setIsGachaModalOpen] = useState(false);
  const [lastGachaResult, setLastGachaResult] =
    useState<GachaPullResult | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const chestPopTimerRef = useRef<number | null>(null);

  const hud = theme.hud;
  const starIcon = theme.starIcon;
  const mascot = theme.mascot;
  const mapTheme = theme.mapTheme;
  const scale = layout.uiScale;
  const totalLevels = GameConstants.totalLevels;
  const maxStars = totalLevels * 3;
  const totalTiers = SPIRIT_LATTICE_TIERS.length;
  const totalHeight =
    TOP_PADDING + (totalTiers - 1) * TIER_STEP_Y + BOTTOM_PADDING;

  // Compute horizontal Tier Y positions and per-node X% coordinates
  const { nodes, nodeByLevel, tierYMap } = useMemo(() => {
    const list: LatticeNodePosition[] = [];
    const byLvl: Record<number, LatticeNodePosition> = {};
    const yByTier: Record<number, number> = {};

    for (const tierSpec of SPIRIT_LATTICE_TIERS) {
      const indexFromBottom = tierSpec.tier - 1;
      const yPx =
        totalHeight - BOTTOM_PADDING - indexFromBottom * TIER_STEP_Y;
      yByTier[tierSpec.tier] = yPx;

      const count = tierSpec.levels.length;
      // Reserve xPct 18%..72% (center 45%) for lattice nodes so xPct = 90% holds Row Harmony Chests
      const xPositions =
        count === 1
          ? [45]
          : count === 2
            ? tierSpec.tier === 4
              ? [31, 59]
              : [26, 64]
            : [19, 45, 71];

      tierSpec.levels.forEach((lvl, idx) => {
        const pos: LatticeNodePosition = {
          level: lvl,
          tier: tierSpec.tier,
          xPct: xPositions[idx] ?? 45,
          yPx,
          isBoss: Boolean(tierSpec.isBossTier),
        };
        list.push(pos);
        byLvl[lvl] = pos;
      });
    }

    return { nodes: list, nodeByLevel: byLvl, tierYMap: yByTier };
  }, [totalHeight]);

  const activeMascotLevel = progress.highestActiveLatticeLevel;

  // Scroll to show District 1 (Tiers 1..5) or the player's current playable lattice tier on mount/update
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetLevel = Math.max(
      1,
      Math.min(totalLevels, activeMascotLevel)
    );
    const nodeData = nodeByLevel[targetLevel];
    if (nodeData) {
      const scrollToActiveTier = () => {
        const viewportH = container.clientHeight || window.innerHeight;
        const maxScrollTop = Math.max(
          0,
          container.scrollHeight - viewportH
        );
        const desiredTop =
          targetLevel <= 9
            ? maxScrollTop
            : Math.min(maxScrollTop, Math.max(0, nodeData.yPx - viewportH * 0.5));
        container.scrollTop = desiredTop;
      };
      scrollToActiveTier();
      const rafId = requestAnimationFrame(scrollToActiveTier);
      return () => cancelAnimationFrame(rafId);
    }
  }, [activeMascotLevel, isShrineCollapsed, nodeByLevel, totalHeight, totalLevels]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
      if (chestPopTimerRef.current !== null) {
        window.clearTimeout(chestPopTimerRef.current);
      }
    };
  }, []);

  const handleTapNode = (level: number) => {
    const state = progress.latticeNodeStateFor(level);
    if (state === LevelNodeState.locked) {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
      setShakingLevel(level);
      shakeTimerRef.current = window.setTimeout(() => {
        setShakingLevel(null);
      }, GameConstants.lockedNodeShakeDurationMs);
      return;
    }
    onSelectLevel(level);
  };

  const handleTapChest = (tierNumber: number) => {
    const chestState = progress.getTierChestState(tierNumber);
    if (chestState !== 'claimable') return;
    audioService.playWin();
    onClaimTierChest?.(tierNumber);
    if (chestPopTimerRef.current !== null) {
      window.clearTimeout(chestPopTimerRef.current);
    }
    setPoppingChestTier(tierNumber);
    chestPopTimerRef.current = window.setTimeout(() => {
      setPoppingChestTier(null);
    }, 1100);
  };

  // Shrine Restoration progress calculation toward the next landmark (6, 15, 30 ★)
  const currentStars = progress.totalStars;
  const nextLandmark =
    SHRINE_LANDMARKS.find((l) => currentStars < l.requiredStars) ??
    SHRINE_LANDMARKS[SHRINE_LANDMARKS.length - 1];
  const prevThreshold =
    nextLandmark.index === 1
      ? 0
      : SHRINE_LANDMARKS[nextLandmark.index - 2].requiredStars;
  const segmentSpan = Math.max(1, nextLandmark.requiredStars - prevThreshold);
  const progressPct =
    currentStars >= GameConstants.landmark3Stars
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((currentStars - prevThreshold) / segmentSpan) * 100)
          )
        );
  const unlockedLandmarkCount = SHRINE_LANDMARKS.filter((l) =>
    progress.isLandmarkUnlocked(l.index)
  ).length;

  return (
    <section
      data-testid="map-screen"
      data-board-theme={progress.activeThemeId}
      style={{
        paddingLeft: `${layout.safeInsets.left}px`,
        paddingRight: `${layout.safeInsets.right}px`,
      }}
      className="relative z-10 w-full h-full flex flex-col items-center overflow-hidden select-none"
    >
      {/* Floating Sakura Petal & Lantern Ember Particle Canvas */}
      <MatsuriParticleCanvas
        width={layout.screen.width}
        height={layout.screen.height}
      />

      {/* 1. Top HUD Bar Upgrade: Back, District Badge, Star Counter Pill, Spirit Coins Pill, Settings */}
      <header
        data-testid="map-top-bar"
        style={{
          maxWidth: `${GameConstants.maxMapColumnWidth}px`,
          paddingTop: `${8 + layout.safeInsets.top}px`,
        }}
        className="relative z-30 w-full px-2.5 shrink-0"
      >
        <div
          style={{
            backgroundColor: hud.panelBackground,
            borderColor: hud.panelBorder,
          }}
          className="w-full rounded-2xl border-2 px-2.5 py-1.5 flex items-center justify-between gap-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
        >
          <button
            type="button"
            aria-label="Back to Start Screen"
            data-testid="map-back-button"
            onClick={onBack}
            style={{
              backgroundColor: hud.badgeBackground,
              borderColor: hud.badgeBorder,
              color: hud.textPrimary,
              width: `${GameConstants.minTouchTarget}px`,
              height: `${GameConstants.minTouchTarget}px`,
            }}
            className="rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Center Pills: District Badge + Star Counter Pill + Spirit Coins Pill */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap min-w-0">
            {/* District Badge */}
            <div
              data-testid="map-district-badge"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255, 77, 121, 0.28) 0%, rgba(74, 25, 66, 0.85) 100%)',
                borderColor: '#FF85A1',
                color: '#FFE5EC',
                fontFamily: theme.titleFontFamily,
              }}
              className="px-2 sm:px-2.5 py-1 rounded-xl border text-[10px] sm:text-xs font-extrabold tracking-wide whitespace-nowrap"
            >
              District 1: Kitsune Shrine
            </div>

            {/* Star Counter Pill */}
            <div
              data-testid="map-total-stars"
              style={{
                backgroundColor: hud.badgeBackground,
                borderColor: hud.badgeBorder,
                color: hud.textPrimary,
                fontFamily: theme.titleFontFamily,
              }}
              className="px-2 sm:px-2.5 py-1 rounded-xl border font-black text-[11px] sm:text-sm inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Star
                className="w-3.5 h-3.5 fill-current shrink-0"
                style={{ color: starIcon.filledColor }}
                aria-hidden="true"
              />
              <span className="tabular-nums">
                {progress.totalStars} / {maxStars}
              </span>
            </div>

            {/* Spirit Coins Pill with subtle golden glow */}
            <div
              data-testid="map-spirit-coins"
              style={{
                backgroundColor: '#281534',
                borderColor: '#FFD166',
                color: '#FFF3B0',
                fontFamily: theme.numberFontFamily,
                boxShadow: '0 0 12px rgba(255, 209, 102, 0.42)',
              }}
              className="px-2 sm:px-2.5 py-1 rounded-xl border font-black text-[11px] sm:text-sm inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span aria-hidden="true" className="text-xs leading-none">
                🪙
              </span>
              <span
                data-testid="map-spirit-coins-value"
                className="tabular-nums"
              >
                {progress.spiritCoins}
              </span>
            </div>

            {/* Phase 7: Glowing Shrine Gacha Button */}
            <button
              type="button"
              data-testid="map-gachapon-button"
              data-pull-cost={progress.gachaPullCost}
              aria-label="Open Shrine Gachapon & Spirit Wardrobe"
              onClick={() => {
                audioService.playClick();
                setIsGachaModalOpen(true);
              }}
              style={{
                background:
                  'linear-gradient(135deg, #FF4D79 0%, #7209B7 55%, #4CC9F0 100%)',
                borderColor: '#FFE066',
                color: '#FFFFFF',
                fontFamily: theme.titleFontFamily,
                boxShadow: '0 0 14px rgba(255, 209, 102, 0.65)',
              }}
              className="px-2 sm:px-2.5 py-1 rounded-xl border font-black text-[11px] sm:text-xs inline-flex items-center gap-1 whitespace-nowrap cursor-pointer hover:brightness-110 transition-transform active:scale-95"
            >
              <span aria-hidden="true">🎰</span>
              <span>Shrine Gacha</span>
              {progress.gachaPullCost === 0 && (
                <span className="px-1 py-0.2 rounded bg-amber-300 text-purple-950 text-[9px] font-black leading-none">
                  FREE
                </span>
              )}
            </button>

            {/* Festival Fever Streak Pill (0..5) */}
            <div
              data-testid="map-fever-streak"
              data-streak={progress.festivalFeverStreak}
              title={`Festival Fever Streak: +${progress.startingSpiritChargeBonus}% Starting Spirit Charge`}
              style={{
                background:
                  progress.festivalFeverStreak > 0
                    ? 'linear-gradient(135deg, rgba(255, 77, 121, 0.35) 0%, rgba(255, 209, 102, 0.25) 100%)'
                    : hud.badgeBackground,
                borderColor:
                  progress.festivalFeverStreak > 0
                    ? '#FF85A1'
                    : hud.badgeBorder,
                color:
                  progress.festivalFeverStreak > 0
                    ? '#FFE5EC'
                    : hud.textSecondary,
                fontFamily: theme.numberFontFamily,
              }}
              className="px-2 sm:px-2.5 py-1 rounded-xl border font-black text-[11px] sm:text-sm inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span aria-hidden="true" className="text-xs leading-none">
                🔥
              </span>
              <span className="tabular-nums">
                Fever {progress.festivalFeverStreak}/{GameConstants.maxFestivalFeverStreak}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Settings"
            data-testid="map-settings-button"
            onClick={onOpenSettings}
            style={{
              backgroundColor: hud.badgeBackground,
              borderColor: hud.badgeBorder,
              color: hud.textPrimary,
              width: `${GameConstants.minTouchTarget}px`,
              height: `${GameConstants.minTouchTarget}px`,
            }}
            className="rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 2. Interactive "Shrine Restoration" Diorama Header (cleanly separated above scroll container) */}
      <div
        data-testid="shrine-restoration-header"
        data-collapsed={isShrineCollapsed ? 'true' : 'false'}
        style={{
          maxWidth: `${GameConstants.maxMapColumnWidth}px`,
        }}
        className="relative z-20 w-full px-2.5 pt-1.5 pb-2 shrink-0"
      >
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(48, 24, 64, 0.92) 0%, rgba(33, 16, 46, 0.96) 100%)',
            borderColor: 'rgba(255, 183, 197, 0.65)',
            boxShadow: '0 6px 20px rgba(18, 8, 28, 0.55)',
          }}
          className="w-full rounded-2xl border px-3 py-2 backdrop-blur-md flex flex-col gap-1.5"
        >
          {/* Header Row + Progress Bar Toward Next Landmark + Collapse/Expand Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 min-w-0">
              <Sparkles
                className="w-3.5 h-3.5 text-amber-300 shrink-0"
                aria-hidden="true"
              />
              <span
                style={{
                  fontFamily: theme.titleFontFamily,
                  color: hud.textPrimary,
                }}
                className="text-xs font-black tracking-wide whitespace-nowrap"
              >
                Shrine Restoration
              </span>
              {isShrineCollapsed && (
                <span
                  style={{ color: '#FFE066', fontFamily: theme.numberFontFamily }}
                  className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/35 whitespace-nowrap"
                >
                  {unlockedLandmarkCount}/3 Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end max-w-[260px]">
              <div
                data-testid="shrine-restoration-progress-bar"
                data-progress-pct={progressPct}
                style={{ backgroundColor: hud.progressTrackColor }}
                className="relative flex-1 max-w-[140px] h-2 rounded-full overflow-hidden border border-pink-300/30"
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${hud.progressFillStart}, ${hud.progressFillEnd})`,
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
              <span
                data-testid="shrine-next-landmark-stars"
                style={{
                  fontFamily: theme.numberFontFamily,
                  color: '#FFD166',
                }}
                className="text-[11px] font-black tabular-nums whitespace-nowrap inline-flex items-center gap-0.5"
              >
                <span>
                  {currentStars >= GameConstants.landmark3Stars
                    ? '30/30'
                    : `${currentStars}/${nextLandmark.requiredStars}`}
                </span>
                <Star
                  className="w-3 h-3 fill-current shrink-0"
                  aria-hidden="true"
                />
              </span>

              <button
                type="button"
                data-testid="shrine-header-toggle"
                data-collapsed={isShrineCollapsed ? 'true' : 'false'}
                aria-label={
                  isShrineCollapsed
                    ? 'Expand Shrine Restoration Landmarks'
                    : 'Collapse Shrine Restoration Landmarks'
                }
                onClick={() => {
                  audioService.playClick();
                  setIsShrineCollapsed((prev) => !prev);
                }}
                style={{
                  backgroundColor: hud.badgeBackground,
                  borderColor: hud.badgeBorder,
                  color: hud.textPrimary,
                }}
                className="px-2 py-0.5 rounded-lg border text-[10px] font-extrabold inline-flex items-center gap-0.5 shrink-0 cursor-pointer hover:brightness-110 transition-transform active:scale-95"
              >
                <span>{isShrineCollapsed ? 'Show' : 'Hide'}</span>
                {isShrineCollapsed ? (
                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <ChevronUp className="w-3 h-3" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* 3 Layered SVG Japanese Night-Festival Landmarks (collapsible into slim summary bar) */}
          {!isShrineCollapsed && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {SHRINE_LANDMARKS.map((landmark) => {
                const unlocked = progress.isLandmarkUnlocked(landmark.index);
                return (
                  <div
                    key={landmark.id}
                    data-testid={`shrine-landmark-${landmark.index}`}
                    data-unlocked={unlocked ? 'true' : 'false'}
                    style={{
                      background: unlocked
                        ? 'linear-gradient(180deg, rgba(255, 209, 102, 0.16) 0%, rgba(255, 92, 138, 0.22) 100%)'
                        : 'rgba(24, 12, 34, 0.65)',
                      borderColor: unlocked
                        ? '#FFD166'
                        : 'rgba(123, 101, 136, 0.45)',
                      boxShadow: unlocked
                        ? '0 0 12px rgba(255, 209, 102, 0.28)'
                        : 'none',
                    }}
                    className="rounded-xl border px-1.5 py-1 flex flex-col items-center text-center"
                  >
                    <div className="w-full flex items-center justify-between px-0.5">
                      <span
                        style={{
                          color: unlocked ? '#FFE066' : '#B9A3C9',
                          fontFamily: theme.numberFontFamily,
                        }}
                        className="text-[10px] font-black tabular-nums inline-flex items-center gap-0.5"
                      >
                        <span>{landmark.requiredStars}</span>
                        <Star
                          className="w-2.5 h-2.5 fill-current shrink-0"
                          aria-hidden="true"
                        />
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-1 rounded ${
                          unlocked
                            ? 'bg-amber-400/25 text-amber-200'
                            : 'bg-purple-950/70 text-purple-300/70'
                        }`}
                      >
                        {unlocked ? 'ACTIVE' : 'LOCKED'}
                      </span>
                    </div>

                    <ShrineLandmarkSvg landmark={landmark} unlocked={unlocked} />

                    <span
                      style={{
                        fontFamily: theme.titleFontFamily,
                        color: unlocked ? '#FFFDF9' : '#B9A3C9',
                      }}
                      className="text-[10px] sm:text-[11px] font-extrabold leading-tight line-clamp-1"
                    >
                      {landmark.name}
                    </span>
                    <span
                      data-testid={`shrine-landmark-buff-${landmark.index}`}
                      style={{
                        color: unlocked ? '#FFE066' : '#9E8B9C',
                      }}
                      className="text-[9px] sm:text-[10px] font-bold leading-tight line-clamp-1"
                    >
                      {landmark.buffLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Non-Linear "Spirit Lantern Lattice" & 4. "Row Harmony Chests" */}
      <div
        ref={scrollContainerRef}
        data-testid="map-scroll-container"
        style={{
          paddingTop: '16px',
          paddingBottom: '20px',
        }}
        className="relative z-10 flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"
      >
        <div
          style={{
            maxWidth: `${GameConstants.maxMapColumnWidth}px`,
            height: `${totalHeight}px`,
          }}
          className="relative mx-auto w-full"
        >
          {/* Spirit-Thread Lattice Connections + Grounded Festival Decorations SVG */}
          <svg
            data-testid="lattice-connections-svg"
            viewBox={`0 0 560 ${totalHeight}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full h-full"
          >
            {/* Horizontal Tier guide rails for Tiers 1..5 */}
            {SPIRIT_LATTICE_TIERS.filter((t) => t.hasHarmonyChest).map(
              (tierSpec) => {
                const y = tierYMap[tierSpec.tier];
                const isDone = progress.isTierComplete(tierSpec.tier);
                return (
                  <line
                    key={`tier-rail-${tierSpec.tier}`}
                    x1="54"
                    y1={y}
                    x2="504"
                    y2={y}
                    stroke={
                      isDone
                        ? 'rgba(255, 209, 102, 0.26)'
                        : 'rgba(255, 183, 197, 0.10)'
                    }
                    strokeWidth="2"
                    strokeDasharray="4 6"
                  />
                );
              }
            )}

            {/* Directed Parent -> Child Spirit-Thread Connecting Lines */}
            {SPIRIT_LATTICE_EDGES.map(([fromLvl, toLvl]) => {
              const p0 = nodeByLevel[fromLvl];
              const p1 = nodeByLevel[toLvl];
              if (!p0 || !p1) return null;
              const x0 = (p0.xPct / 100) * 560;
              const y0 = p0.yPx;
              const x1 = (p1.xPct / 100) * 560;
              const y1 = p1.yPx;
              const midY = (y0 + y1) / 2;
              const d = `M ${x0.toFixed(1)} ${y0.toFixed(1)} C ${x0.toFixed(1)} ${midY.toFixed(1)}, ${x1.toFixed(1)} ${midY.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
              const isEdgeUnlocked = progress.isLatticeEdgeUnlocked(
                fromLvl,
                toLvl
              );

              return (
                <g
                  key={`edge-${fromLvl}-${toLvl}`}
                  data-testid={`lattice-edge-${fromLvl}-${toLvl}`}
                  data-edge-unlocked={isEdgeUnlocked ? 'true' : 'false'}
                >
                  {isEdgeUnlocked && (
                    <path
                      d={d}
                      fill="none"
                      stroke="rgba(255, 117, 151, 0.42)"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={isEdgeUnlocked ? '#FFD166' : '#5B466B'}
                    strokeWidth={isEdgeUnlocked ? '3.6' : '2.4'}
                    strokeDasharray={isEdgeUnlocked ? '9 6' : '6 7'}
                    strokeLinecap="round"
                    className={isEdgeUnlocked ? 'animate-spirit-thread' : ''}
                  />
                </g>
              );
            })}

            {/* Grounded Torii gates & stone lanterns on hill mounds along the courtyard */}
            {nodes
              .filter((_, idx) => idx % 4 === 1)
              .map((n, idx) => {
                const decoX = idx % 2 === 0 ? 44 : 445;
                const decoY = n.yPx + 18;
                return (
                  <g
                    key={`deco_${n.level}`}
                    data-testid={`map-deco-${n.level}`}
                    transform={`translate(${decoX}, ${decoY})`}
                  >
                    <ellipse
                      cx="0"
                      cy="18"
                      rx="28"
                      ry="9"
                      fill={mapTheme.midHillColor}
                    />
                    <ellipse
                      cx="0"
                      cy="20"
                      rx="22"
                      ry="6.5"
                      fill={mapTheme.nearHillColor}
                    />
                    {idx % 2 === 0 ? (
                      <g data-testid={`map-torii-${n.level}`}>
                        <rect
                          x="-12"
                          y="10"
                          width="6"
                          height="4"
                          rx="1"
                          fill={mapTheme.stoneLanternColor}
                        />
                        <rect
                          x="6"
                          y="10"
                          width="6"
                          height="4"
                          rx="1"
                          fill={mapTheme.stoneLanternColor}
                        />
                        <rect
                          x="-10"
                          y="-16"
                          width="3.5"
                          height="27"
                          fill={mapTheme.toriiColor}
                        />
                        <rect
                          x="6.5"
                          y="-16"
                          width="3.5"
                          height="27"
                          fill={mapTheme.toriiColor}
                        />
                        <rect
                          x="-18"
                          y="-20"
                          width="36"
                          height="4"
                          rx="1.5"
                          fill={mapTheme.toriiColor}
                        />
                        <rect
                          x="-14"
                          y="-12"
                          width="28"
                          height="3"
                          rx="1"
                          fill={mapTheme.toriiColor}
                        />
                      </g>
                    ) : (
                      <g data-testid={`map-lantern-${n.level}`}>
                        <rect
                          x="-9"
                          y="12"
                          width="18"
                          height="4"
                          rx="1.5"
                          fill={mapTheme.stoneLanternColor}
                        />
                        <rect
                          x="-3"
                          y="-2"
                          width="6"
                          height="14"
                          fill={mapTheme.stoneLanternColor}
                        />
                        <rect
                          x="-7"
                          y="-5"
                          width="14"
                          height="3"
                          rx="1"
                          fill={mapTheme.stoneLanternColor}
                        />
                        <rect
                          x="-5"
                          y="-13"
                          width="10"
                          height="8"
                          rx="1.5"
                          fill={mapTheme.lanternGlowColor}
                        />
                        <polygon
                          points="-10,-13 0,-21 10,-13"
                          fill={mapTheme.stoneLanternColor}
                        />
                      </g>
                    )}
                  </g>
                );
              })}
          </svg>

          {/* 4. "Row Harmony Chests" on the right side of Tiers 1 through 5 */}
          {SPIRIT_LATTICE_TIERS.filter((t) => t.hasHarmonyChest).map(
            (tierSpec) => {
              const yPx = tierYMap[tierSpec.tier];
              const chestState = progress.getTierChestState(tierSpec.tier);
              const clearedInRow = tierSpec.levels.filter(
                (lvl) => progress.bestStarsFor(lvl) >= 1
              ).length;
              const isPopping = poppingChestTier === tierSpec.tier;

              return (
                <div
                  key={`chest-tier-${tierSpec.tier}`}
                  style={{
                    left: '90%',
                    top: `${yPx}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute z-20 flex flex-col items-center"
                >
                  {/* Left Tier Label Tag */}
                  <button
                    type="button"
                    data-testid={`tier-harmony-chest-${tierSpec.tier}`}
                    data-chest-state={chestState}
                    aria-label={`${tierSpec.shortLabel} Harmony Chest (${chestState})`}
                    onClick={() => handleTapChest(tierSpec.tier)}
                    style={{
                      background:
                        chestState === 'claimable'
                          ? 'linear-gradient(135deg, #FFE066 0%, #FF5C8A 100%)'
                          : chestState === 'claimed'
                            ? 'rgba(46, 74, 62, 0.88)'
                            : 'rgba(42, 26, 56, 0.88)',
                      borderColor:
                        chestState === 'claimable'
                          ? '#FFF3B0'
                          : chestState === 'claimed'
                            ? '#34D399'
                            : '#6E567F',
                      boxShadow:
                        chestState === 'claimable'
                          ? '0 0 16px rgba(255, 209, 102, 0.78)'
                          : '0 4px 10px rgba(0,0,0,0.35)',
                    }}
                    className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                      chestState === 'claimable'
                        ? 'animate-current-node-pulse'
                        : ''
                    }`}
                  >
                    {/* Lantern Chest SVG */}
                    <svg
                      viewBox="0 0 40 40"
                      className="w-7 h-7"
                      aria-hidden="true"
                    >
                      <rect
                        x="7"
                        y="14"
                        width="26"
                        height="18"
                        rx="4"
                        fill={
                          chestState === 'claimable'
                            ? '#B45309'
                            : chestState === 'claimed'
                              ? '#065F46'
                              : '#3B2447'
                        }
                        stroke={
                          chestState === 'claimable'
                            ? '#FFF3B0'
                            : chestState === 'claimed'
                              ? '#34D399'
                              : '#8E739E'
                        }
                        strokeWidth="2"
                      />
                      <path
                        d="M 5 15 Q 20 8 35 15 Z"
                        fill={
                          chestState === 'claimable'
                            ? '#FFE066'
                            : chestState === 'claimed'
                              ? '#34D399'
                              : '#63467A'
                        }
                      />
                      <circle
                        cx="20"
                        cy="22"
                        r="3.2"
                        fill={
                          chestState === 'claimable'
                            ? '#FFF3B0'
                            : chestState === 'claimed'
                              ? '#A7F3D0'
                              : '#8E739E'
                        }
                      />
                    </svg>

                    {chestState === 'claimed' && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 text-purple-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  <span
                    style={{
                      fontFamily: theme.titleFontFamily,
                      color:
                        chestState === 'claimable'
                          ? '#FFE066'
                          : chestState === 'claimed'
                            ? '#6EE7B7'
                            : '#CBB8D6',
                    }}
                    className="mt-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-tight whitespace-nowrap"
                  >
                    {chestState === 'claimable'
                      ? 'Claim!'
                      : chestState === 'claimed'
                        ? 'Claimed'
                        : `${ tierSpec.shortLabel } · ${clearedInRow}/${tierSpec.levels.length}`}
                  </span>

                  {/* Celebratory +100 Spirit Coins Pop Animation */}
                  {isPopping && (
                    <span
                      data-testid={`chest-pop-reward-${tierSpec.tier}`}
                      className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-300 text-purple-950 font-black text-xs whitespace-nowrap shadow-md animate-chest-pop"
                    >
                      +100 🪙
                    </span>
                  )}
                </div>
              );
            }
          )}

          {/* 3. Non-Linear Spirit Lantern Lattice Nodes */}
          {nodes.map(({ level, tier, xPct, yPx, isBoss }) => {
            const state = progress.latticeNodeStateFor(level);
            const stars = progress.bestStarsFor(level);
            const isShaking = shakingLevel === level;
            const baseDia = isBoss ? 68 : 56;
            const nodeDiameter = Math.round(
              baseDia * Math.max(0.88, Math.min(1.1, scale))
            );
            const primaryTile = getPrimaryTileForLevel(level, theme);

            const nodeGradient =
              state === LevelNodeState.completed
                ? 'linear-gradient(135deg, #FF85A1 0%, #FF5C8A 55%, #FF4D6D 100%)'
                : state === LevelNodeState.current
                  ? 'linear-gradient(135deg, #FF4D79 0%, #A855F7 52%, #4CC9F0 100%)'
                  : 'rgba(54, 38, 71, 0.88)';

            const borderColor =
              state === LevelNodeState.completed
                ? '#FFD166'
                : state === LevelNodeState.current
                  ? '#4CC9F0'
                  : mapTheme.lockedNodeBorder;

            const textColor =
              state === LevelNodeState.locked
                ? mapTheme.lockedNodeText
                : '#FFFFFF';

            return (
              <div
                key={level}
                style={{
                  left: `${xPct}%`,
                  top: `${yPx}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute flex flex-col items-center"
              >
                <div className="relative flex items-center justify-center">
                  {/* Ornate Kitsune Crest on Apex Shrine Boss Node (Level 9 & 30) */}
                  {isBoss && <BossKitsuneCrestSvg level={level} />}

                  <button
                    ref={(el) => {
                      nodeRefs.current[level] = el;
                    }}
                    type="button"
                    data-testid={`map-node-${level}`}
                    data-tier={tier}
                    data-boss={isBoss ? 'true' : 'false'}
                    data-node-state={state}
                    aria-label={`Level ${level}${isBoss ? ' Shrine Boss' : ''} (${state})`}
                    onClick={() => handleTapNode(level)}
                    style={{
                      width: `${nodeDiameter}px`,
                      height: `${nodeDiameter}px`,
                      background: nodeGradient,
                      borderColor,
                      color: textColor,
                      fontFamily: theme.titleFontFamily,
                      boxShadow:
                        state === LevelNodeState.current
                          ? '0 0 16px rgba(76, 201, 240, 0.72), 0 0 24px rgba(255, 77, 121, 0.55)'
                          : state === LevelNodeState.completed
                            ? '0 0 12px rgba(255, 209, 102, 0.45), 0 4px 10px rgba(0,0,0,0.4)'
                            : '0 4px 10px rgba(0,0,0,0.4)',
                    }}
                    className={`relative rounded-full border-[2.5px] flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                      isShaking ? 'animate-node-shake' : ''
                    }`}
                  >
                    {state === LevelNodeState.current && (
                      <span
                        aria-hidden="true"
                        style={{ borderColor: '#4CC9F0' }}
                        className="pointer-events-none absolute -inset-1.5 rounded-full border-2 animate-current-node-pulse"
                      />
                    )}

                    {/* Subtle 5-petal sakura crest inside the circle */}
                    <svg
                      viewBox="0 0 100 100"
                      data-testid={`sakura-node-svg-${level}`}
                      className="pointer-events-none absolute inset-0 w-full h-full opacity-35"
                      aria-hidden="true"
                    >
                      <g
                        fill="none"
                        stroke={borderColor}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      >
                        {[0, 72, 144, 216, 288].map((deg) => (
                          <path
                            key={deg}
                            transform={`rotate(${deg} 50 50)`}
                            d="M 50 48 C 28 34, 24 10, 43 6 L 50 13 L 57 6 C 76 10, 72 34, 50 48 Z"
                          />
                        ))}
                      </g>
                    </svg>

                    <span className="relative z-10 flex flex-col items-center justify-center">
                      {state === LevelNodeState.locked ? (
                        <>
                          <Lock
                            className="w-3.5 h-3.5 mb-0.5 opacity-80"
                            aria-hidden="true"
                          />
                          <span className="text-xs font-extrabold leading-none">
                            {level}
                          </span>
                        </>
                      ) : (
                        <>
                          {isBoss && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-200 leading-none mb-0.5">
                              BOSS
                            </span>
                          )}
                          <span className="text-base sm:text-lg font-black leading-none">
                            {level}
                          </span>
                        </>
                      )}
                    </span>

                    {/* Primary Tile Preview Icon on Playable / Available Nodes */}
                    {state === LevelNodeState.current && (
                      <span
                        data-testid={`map-node-tile-preview-${level}`}
                        title={primaryTile.label}
                        className="pointer-events-none absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-full bg-purple-950/95 border border-cyan-300 flex items-center justify-center shadow"
                      >
                        <GoalTileMiniIcon style={primaryTile} size={15} />
                      </span>
                    )}

                    {/* Bonus Kitsune Boss Trophy Badge on Defeated Boss Nodes */}
                    {progress.hasBossTrophy(level) && (
                      <span
                        data-testid={`boss-trophy-badge-${level}`}
                        title="Kitsune Boss Trophy Earned"
                        style={{
                          backgroundColor: '#281534',
                          borderColor: '#FFE066',
                          boxShadow: '0 0 8px rgba(255, 224, 102, 0.8)',
                        }}
                        className="pointer-events-none absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shadow-md z-20"
                      >
                        🏆
                      </span>
                    )}
                  </button>

                  {/* Floating Kitsune Mascot Badge next to the highest active node */}
                  {level === activeMascotLevel &&
                    state === LevelNodeState.current && (
                      <div
                        data-testid="map-current-mascot-marker"
                        style={{
                          backgroundColor: mascot.frameBackground,
                          borderColor: mascot.frameBorder,
                        }}
                        className="pointer-events-none absolute -right-10 -top-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center shadow-md animate-mascot-float z-20"
                      >
                        <svg viewBox="0 0 40 40" className="w-6 h-6 sm:w-7 sm:h-7">
                          <polygon
                            points="7,17 4,5 16,12"
                            fill={mascot.furColor}
                          />
                          <polygon
                            points="33,17 36,5 24,12"
                            fill={mascot.furColor}
                          />
                          <ellipse
                            cx="20"
                            cy="23"
                            rx="12"
                            ry="10"
                            fill={mascot.furColor}
                          />
                          <path
                            d="M14 22 Q16 19 18 22"
                            fill="none"
                            stroke="#2B1B3D"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M22 22 Q24 19 26 22"
                            fill="none"
                            stroke="#2B1B3D"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                </div>

                {/* 1 to 3 earned ★ stars underneath completed nodes */}
                {state === LevelNodeState.completed && (
                  <div
                    data-testid={`map-node-stars-${level}`}
                    className="mt-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/45 border border-amber-300/35"
                  >
                    {[1, 2, 3].map((slot) => (
                      <Star
                        key={slot}
                        className="w-3 h-3 fill-current"
                        style={{
                          color:
                            stars >= slot
                              ? starIcon.filledColor
                              : starIcon.emptyColor,
                        }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 7: Shrine Gachapon & Spirit Wardrobe Modal */}
      {isGachaModalOpen && (
        <div
          data-testid="shrine-gachapon-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Shrine Gachapon and Spirit Wardrobe"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            style={{
              maxWidth: '540px',
              background:
                'linear-gradient(180deg, rgba(44, 21, 62, 0.98) 0%, rgba(24, 11, 36, 0.99) 100%)',
              borderColor: '#FFD166',
              boxShadow: '0 14px 40px rgba(0, 0, 0, 0.78)',
            }}
            className="w-full max-h-[90dvh] rounded-3xl border-2 p-3.5 sm:p-5 flex flex-col gap-3 overflow-y-auto text-white"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <h2
                  style={{
                    fontFamily: theme.titleFontFamily,
                    color: '#FFE066',
                  }}
                  className="text-base sm:text-lg font-black tracking-wide flex items-center gap-1.5"
                >
                  <span aria-hidden="true">🎰</span>
                  <span>Shrine Gachapon & Spirit Wardrobe</span>
                </h2>
                <span className="text-[11px] text-pink-200/85 font-semibold">
                  Summon Spirit Companions, upgrade Star Ranks (★1→★3), and equip Matsuri Board Themes!
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div
                  style={{
                    backgroundColor: '#281534',
                    borderColor: '#FFD166',
                    color: '#FFF3B0',
                    fontFamily: theme.numberFontFamily,
                  }}
                  className="px-2.5 py-1 rounded-xl border text-xs font-black inline-flex items-center gap-1"
                >
                  <span aria-hidden="true">🪙</span>
                  <span className="tabular-nums">{progress.spiritCoins}</span>
                </div>

                <button
                  type="button"
                  data-testid="close-gachapon-modal"
                  aria-label="Close Shrine Gachapon Modal"
                  onClick={() => {
                    audioService.playClick();
                    setIsGachaModalOpen(false);
                  }}
                  style={{
                    backgroundColor: hud.badgeBackground,
                    borderColor: hud.badgeBorder,
                    color: hud.textPrimary,
                  }}
                  className="px-2.5 py-1 rounded-xl border text-xs font-extrabold cursor-pointer hover:brightness-110 active:scale-95"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 1. Gachapon Capsule Pull Section */}
            <div
              style={{
                background:
                  'linear-gradient(135deg, rgba(255, 77, 121, 0.18) 0%, rgba(76, 201, 240, 0.16) 100%)',
                borderColor: 'rgba(255, 209, 102, 0.55)',
              }}
              className="rounded-2xl border p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-col">
                  <span
                    style={{ fontFamily: theme.titleFontFamily }}
                    className="text-xs sm:text-sm font-black text-amber-200"
                  >
                    ✨ Sacred Shrine Capsule Machine
                  </span>
                  <span className="text-[11px] text-purple-200/90">
                    {progress.gachaPullCost === 0
                      ? 'Your 1st Shrine Capsule Pull is FREE (0 🪙)!'
                      : `Guaranteed new Companion, Theme, or Star Rank upgrade (${progress.gachaPullCost} 🪙).`}
                  </span>
                </div>

                <button
                  type="button"
                  data-testid="gachapon-pull-button"
                  data-pull-cost={progress.gachaPullCost}
                  data-total-pulls={progress.totalGachaPulls}
                  disabled={progress.spiritCoins < progress.gachaPullCost}
                  onClick={() => {
                    const res = onPerformGachaPull?.() ?? null;
                    if (res) {
                      audioService.playWin();
                      setLastGachaResult(res);
                    }
                  }}
                  style={{
                    background:
                      progress.spiritCoins >= progress.gachaPullCost
                        ? 'linear-gradient(135deg, #FFE066 0%, #FF4D79 55%, #7209B7 100%)'
                        : 'rgba(62, 42, 78, 0.7)',
                    borderColor: '#FFF3B0',
                    color: '#FFFFFF',
                    fontFamily: theme.titleFontFamily,
                    boxShadow:
                      progress.spiritCoins >= progress.gachaPullCost
                        ? '0 0 16px rgba(255, 209, 102, 0.75)'
                        : 'none',
                  }}
                  className="px-3.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-black tracking-wide whitespace-nowrap cursor-pointer transition-transform active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {progress.gachaPullCost === 0
                    ? '🎰 Pull Capsule (FREE · 0 🪙)'
                    : `🎰 Pull Capsule (${progress.gachaPullCost} 🪙)`}
                </button>
              </div>

              {lastGachaResult && (
                <div
                  data-testid="gachapon-pull-result"
                  data-result-kind={lastGachaResult.kind}
                  data-companion-id={lastGachaResult.companionId ?? ''}
                  data-theme-id={lastGachaResult.themeId ?? ''}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 224, 102, 0.24) 0%, rgba(255, 77, 121, 0.32) 100%)',
                    borderColor: '#FFE066',
                  }}
                  className="rounded-xl border px-3 py-2 flex flex-col gap-0.5 animate-pulse"
                >
                  <span
                    style={{
                      fontFamily: theme.titleFontFamily,
                      color: '#FFF3B0',
                    }}
                    className="text-xs sm:text-sm font-black"
                  >
                    {lastGachaResult.headline}
                  </span>
                  <span className="text-[11px] text-pink-100 font-semibold">
                    {lastGachaResult.subtext}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Spirit Companions Roster Grid (4 Companions) */}
            <div className="flex flex-col gap-1.5">
              <span
                style={{ fontFamily: theme.titleFontFamily, color: '#FFB7C5' }}
                className="text-xs font-black uppercase tracking-wider"
              >
                🦊 Spirit Companions Roster (100% Charge Skill)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_COMPANION_IDS.map((compId) => {
                  const spec = SPIRIT_COMPANIONS[compId];
                  const rank = progress.companionRankFor(compId);
                  const unlocked = rank >= 1;
                  const equipped = progress.activeCompanionId === compId;
                  const mult = unlocked ? getCompanionRankMultiplier(rank) : 1;

                  return (
                    <div
                      key={compId}
                      data-testid={`companion-card-${compId}`}
                      data-companion-unlocked={unlocked ? 'true' : 'false'}
                      data-companion-rank={rank}
                      data-companion-equipped={equipped ? 'true' : 'false'}
                      style={{
                        background: equipped
                          ? 'linear-gradient(145deg, rgba(76, 201, 240, 0.22) 0%, rgba(48, 22, 68, 0.92) 100%)'
                          : unlocked
                            ? 'rgba(38, 19, 54, 0.88)'
                            : 'rgba(22, 11, 32, 0.65)',
                        borderColor: equipped
                          ? '#4CC9F0'
                          : unlocked
                            ? spec.accentColor
                            : 'rgba(123, 101, 136, 0.45)',
                      }}
                      className="rounded-2xl border p-2.5 flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="text-xl leading-none"
                          >
                            {spec.emoji}
                          </span>
                          <div className="flex flex-col">
                            <span
                              style={{ fontFamily: theme.titleFontFamily }}
                              className="text-xs font-black text-white leading-tight"
                            >
                              {spec.name}
                            </span>
                            <span
                              style={{ color: spec.accentColor }}
                              className="text-[10px] font-extrabold leading-tight"
                            >
                              {spec.skillName}
                            </span>
                          </div>
                        </div>

                        <span
                          data-testid={`companion-rank-${compId}`}
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${
                            unlocked
                              ? 'bg-amber-400/25 text-amber-200 border border-amber-300/50'
                              : 'bg-purple-950/80 text-purple-300/70 border border-purple-700/40'
                          }`}
                        >
                          {unlocked ? `★${rank} (${mult.toFixed(2)}x)` : 'Locked'}
                        </span>
                      </div>

                      <p className="text-[10px] text-pink-100/85 leading-snug">
                        {spec.description}
                      </p>

                      <button
                        type="button"
                        data-testid={`equip-companion-${compId}`}
                        data-equipped={equipped ? 'true' : 'false'}
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          audioService.playClick();
                          onEquipCompanion?.(compId);
                        }}
                        style={{
                          background: equipped
                            ? 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)'
                            : unlocked
                              ? 'linear-gradient(135deg, #FF4D79 0%, #7209B7 100%)'
                              : 'rgba(48, 30, 62, 0.65)',
                          borderColor: equipped
                            ? '#A7F3D0'
                            : unlocked
                              ? '#FFD166'
                              : 'rgba(123, 101, 136, 0.35)',
                          fontFamily: theme.titleFontFamily,
                        }}
                        className="w-full py-1 rounded-xl border text-[11px] font-black text-white cursor-pointer transition-transform active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {equipped
                          ? 'Equipped ✓'
                          : unlocked
                            ? 'Equip'
                            : 'Locked (Gacha)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Matsuri Board Theme Selector Strip (4 Themes) */}
            <div className="flex flex-col gap-1.5">
              <span
                style={{ fontFamily: theme.titleFontFamily, color: '#FFB7C5' }}
                className="text-xs font-black uppercase tracking-wider"
              >
                🎨 Equippable Matsuri Board Themes
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_BOARD_THEME_IDS.map((themeId) => {
                  const tSpec = MATSURI_BOARD_THEMES[themeId];
                  const unlocked = progress.isThemeUnlocked(themeId);
                  const equipped = progress.activeThemeId === themeId;

                  return (
                    <div
                      key={themeId}
                      data-testid={`theme-card-${themeId}`}
                      data-theme-unlocked={unlocked ? 'true' : 'false'}
                      data-theme-equipped={equipped ? 'true' : 'false'}
                      style={{
                        background: tSpec.gradientCss,
                        borderColor: equipped
                          ? '#FFE066'
                          : unlocked
                            ? tSpec.boardBorderColor
                            : 'rgba(123, 101, 136, 0.45)',
                      }}
                      className="rounded-2xl border p-2 flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white flex items-center gap-1">
                          <span aria-hidden="true">{tSpec.emoji}</span>
                          <span className="truncate">{tSpec.shortName}</span>
                        </span>
                        <span className="text-[9.5px] text-pink-100/80 line-clamp-2 leading-tight">
                          {tSpec.tagline}
                        </span>
                      </div>

                      <button
                        type="button"
                        data-testid={`equip-theme-${themeId}`}
                        data-equipped={equipped ? 'true' : 'false'}
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          audioService.playClick();
                          onEquipTheme?.(themeId);
                        }}
                        style={{
                          background: equipped
                            ? 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)'
                            : unlocked
                              ? 'rgba(28, 14, 42, 0.88)'
                              : 'rgba(28, 14, 42, 0.55)',
                          borderColor: equipped
                            ? '#FFF3B0'
                            : tSpec.boardBorderColor,
                          fontFamily: theme.titleFontFamily,
                        }}
                        className="w-full py-1 rounded-lg border text-[10px] font-black text-white cursor-pointer transition-transform active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {equipped
                          ? 'Equipped ✓'
                          : unlocked
                            ? 'Equip'
                            : 'Locked'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
