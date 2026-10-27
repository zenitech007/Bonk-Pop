import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioService } from '../core/audio_service';
import { GameConstants, kGameTitle, kIdleHintDelayMs, kSpecialWaveDelayMs } from '../core/constants';
import {
  LayoutInsets,
  LayoutSpec,
  readSafeAreaInsets,
  ScreenLayout,
  ScreenSize,
} from '../core/layout/screen_layout';
import { GameTheme, MascotExpression } from '../core/theme/game_theme';
import { SakuraFestivalTheme } from '../core/theme/sakura_festival_theme';
import {
  ProgressNotifier,
  SharedPreferencesProgressRepository,
} from '../data/progress_repository';
import { Board, GridPos, ResolveStep } from '../logic/board';
import {
  calculateMoveSpiritCoins,
  GameState,
  GameStatus,
  getCascadeComboCallout,
} from '../logic/game_state';
import { Levels } from '../logic/levels';
import { MatchFinder } from '../logic/match_finder';
import {
  MATSURI_BOARD_THEMES,
  SPIRIT_COMPANIONS,
} from '../logic/progress';
import { GameSettingsData, globalSettingsNotifier } from '../logic/settings';
import {
  BentoBoosterId,
  LevelStartDialog,
} from '../screens/dialogs/level_start_dialog';
import { SettingsDialog } from '../screens/dialogs/settings_dialog';
import { MapScreen, MatsuriParticleCanvas } from '../screens/map_screen';
import { StartScreen } from '../screens/start_screen';
import { SpecialKind, Tile, TileType } from '../logic/tile_type';
import {
  BoardComponent,
  BurstParticle,
  FloatingScorePopup,
  WaveVisualEffect,
} from './board_component';
import { EndAndPauseOverlays } from './hud/end_overlays';
import { ActiveShrineBuffBadge, HudPanel } from './hud/hud_panel';
import { TileAnimState } from './tile_component';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MutableBurstParticle {
  id: number;
  row: number;
  col: number;
  dx: number;
  dy: number;
  color: string;
}

/**
 * Pre-allocated 80-particle pool (Step 6 Part 0.5) for zero-GC object reuse during cascades.
 */
const PARTICLE_POOL: MutableBurstParticle[] = Array.from(
  { length: GameConstants.maxBurstParticles },
  (_, idx) => ({
    id: idx + 1,
    row: 0,
    col: 0,
    dx: 0,
    dy: 0,
    color: '#FFB7C5',
  })
);

interface PetalSpec {
  readonly id: number;
  readonly leftPct: number;
  readonly sizePx: number;
  readonly durationSec: number;
  readonly delaySec: number;
}

export type AppScreenMode = 'start' | 'map' | 'game';

function resolveInitialRoute(): {
  screen: AppScreenMode;
  levelNumber: number;
} {
  if (typeof window === 'undefined') {
    return { screen: 'start', levelNumber: 1 };
  }
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get('screen');
  const levelParam = Number(params.get('level') ?? '1');
  const validLevel =
    Number.isFinite(levelParam) &&
    levelParam >= 1 &&
    levelParam <= GameConstants.totalLevels
      ? Math.floor(levelParam)
      : 1;
  if (screenParam === 'game' || params.get('autostart') === '1') {
    return { screen: 'game', levelNumber: validLevel };
  }
  if (screenParam === 'map') {
    return { screen: 'map', levelNumber: validLevel };
  }
  return { screen: 'start', levelNumber: validLevel };
}

/**
 * Step 5 Host Application & Game Shell mirroring `lib/main.dart` and `lib/game/match_game.dart`.
 * - Game Name: "Bonk Pop" (`kGameTitle`).
 * - Special Tiles: Line 4 -> Slash, T/L/Cross -> Burst, Line 5 -> Spirit Orb.
 * - Multi-wave chain reactions & special combos.
 * - Audio & BGM loops synthesized license-free with throttling and volume controls.
 * - Settings (Music/SFX volume, Vibration, Reduced Motion) persisted under `bonk_pop_settings_v1`.
 * - Focused Polish: 6s idle hint wiggler, screen shake, mascot reaction expressions.
 */
export const MatchGame: React.FC<{ theme?: GameTheme }> = ({
  theme = SakuraFestivalTheme.instance,
}) => {
  const initialRoute = useMemo(() => resolveInitialRoute(), []);
  const [screen, setScreen] = useState<AppScreenMode>(initialRoute.screen);
  const [previewLevelNumber, setPreviewLevelNumber] = useState<number | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [isPreloading, setIsPreloading] = useState(true);

  // Preload fonts and audio with a simple "Bonk Pop" splash (under 2s; continues on error)
  useEffect(() => {
    let cancelled = false;
    const minSplashPromise = delay(240);
    const fontsPromise =
      typeof document !== 'undefined' && 'fonts' in document
        ? Promise.resolve(document.fonts.ready).catch(() => undefined)
        : Promise.resolve();
    const audioPromise = audioService.preloadAll().catch(() => undefined);

    Promise.race([
      Promise.all([minSplashPromise, fontsPromise, audioPromise]),
      delay(GameConstants.splashMaxWaitMs),
    ]).finally(() => {
      if (!cancelled) {
        setIsPreloading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Settings subscription
  const [settings, setSettings] = useState<GameSettingsData>(
    globalSettingsNotifier.settings
  );
  useEffect(() => {
    return globalSettingsNotifier.addListener((s) => setSettings(s));
  }, []);

  // Progress persistence notifier
  const [progressNotifier] = useState<ProgressNotifier>(
    () => new ProgressNotifier(new SharedPreferencesProgressRepository())
  );
  const [, setProgressTick] = useState(0);

  // Live viewport size, safe-area insets & ScreenLayout spec
  const [viewportSize, setViewportSize] = useState<ScreenSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));
  const [safeInsets, setSafeInsets] = useState<LayoutInsets>(() =>
    readSafeAreaInsets()
  );

  const layout = useMemo<LayoutSpec>(
    () => ScreenLayout.compute(viewportSize, safeInsets),
    [viewportSize, safeInsets]
  );

  // Core pure-logic GameState & Board
  const [equippedLevelBoosters, setEquippedLevelBoosters] = useState<
    readonly BentoBoosterId[]
  >([]);
  const [gameState] = useState<GameState>(() => {
    const initialBuffs = progressNotifier.progress.resolveActiveBuffs();
    return new GameState(Levels.forNumber(initialRoute.levelNumber), {
      extraMoves: initialBuffs.extraMoves,
      scoreAndCoinBonus: initialBuffs.scoreAndCoinBonus,
      startingSpecialTile: initialBuffs.startingSpecialTile,
      festivalFeverStreak: progressNotifier.progress.festivalFeverStreak,
      carryOverBento: progressNotifier.progress.carryOverBento,
      activeCompanionId: progressNotifier.progress.activeCompanionId,
      companionRank: progressNotifier.progress.activeCompanionRank,
    });
  });
  const [board, setBoard] = useState<Board>(() => {
    const initialBoard = Board.generate();
    const initialLevel = Levels.forNumber(initialRoute.levelNumber);
    if (initialLevel.festivalBlockers) {
      initialBoard.initBlockers(initialLevel.festivalBlockers);
    }
    return initialBoard;
  });
  const [, setTick] = useState(0);
  const [selectedPos, setSelectedPos] = useState<GridPos | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [takeoutBentoPacked, setTakeoutBentoPacked] = useState(false);
  const [tileStates, setTileStates] = useState<Record<string, TileAnimState>>(
    {}
  );
  const [tileOffsets, setTileOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const [floatingScores, setFloatingScores] = useState<FloatingScorePopup[]>(
    []
  );
  const [centerPopup, setCenterPopup] = useState<{
    text: string;
    scale: number;
  } | null>(null);
  const [cascadeComboBanner, setCascadeComboBanner] = useState<{
    text: string;
    cascadeDepth: number;
  } | null>(null);
  const [elementalPowerCallout, setElementalPowerCallout] = useState<
    string | null
  >(null);
  const [kitsuneSkillCallout, setKitsuneSkillCallout] = useState<
    string | null
  >(null);
  const [floatingCoinGain, setFloatingCoinGain] = useState<{
    id: number;
    amount: number;
  } | null>(null);
  const [pulsingTargetKeys, setPulsingTargetKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());

  // Polish states: Hint positions, wave effects, screen shake, glow shimmer
  const [hintPositions, setHintPositions] = useState<GridPos[]>([]);
  const [waveEffects, setWaveEffects] = useState<WaveVisualEffect[]>([]);
  const [shimmeringGlowKeys, setShimmeringGlowKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [screenShakeOffset, setScreenShakeOffset] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [isBoardShaking, setIsBoardShaking] = useState(false);

  const particleIdRef = useRef(1);
  const waveIdRef = useRef(1);
  const bannerTimerRef = useRef<number | null>(null);
  const cascadeBannerTimerRef = useRef<number | null>(null);
  const elementalCalloutTimerRef = useRef<number | null>(null);
  const kitsuneSkillTimerRef = useRef<number | null>(null);
  const coinGainTimerRef = useRef<number | null>(null);
  const targetPulseTimerRef = useRef<number | null>(null);
  const idleHintTimerRef = useRef<number | null>(null);
  const boardShakeTimerRef = useRef<number | null>(null);
  const winSavedForRunRef = useRef(false);

  const forceRender = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Ensure document title matches kGameTitle ("Bonk Pop")
  useEffect(() => {
    document.title = kGameTitle;
  }, []);

  // Dev-only test hooks for automated browser verification of special tiles & levels
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    (
      window as unknown as {
        __bonkPopTestHooks?: {
          setTileSpecial: (
            row: number,
            col: number,
            special: string,
            type?: string
          ) => void;
          winLevel: (
            levelNumber: number,
            stars: number,
            score?: number
          ) => void;
          claimTierChest: (tierNumber: number) => void;
          resetProgress: () => void;
          simulateCascadeOutcome: (params: {
            cascadeDepth: number;
            has4PlusMatch: boolean;
            targetKey?: string;
            elementalPower?: string;
          }) => void;
        };
      }
    ).__bonkPopTestHooks = {
      setTileSpecial: (
        row: number,
        col: number,
        special: string,
        type?: string
      ) => {
        const current = board.tileAt(row, col);
        const tileType =
          (type as typeof TileType[keyof typeof TileType]) ??
          current?.type ??
          TileType.sakura;
        const kind = special as typeof SpecialKind[keyof typeof SpecialKind];
        board.setAt(
          new GridPos(row, col),
          kind === SpecialKind.orb ? Tile.orb() : new Tile(tileType, kind)
        );
        forceRender();
      },
      winLevel: (levelNumber: number, stars: number, score = 12000) => {
        progressNotifier.recordWin({ levelNumber, stars, score });
      },
      claimTierChest: (tierNumber: number) => {
        progressNotifier.claimTierChest(tierNumber);
      },
      resetProgress: () => {
        progressNotifier.resetProgress();
      },
      simulateCascadeOutcome: ({
        cascadeDepth,
        has4PlusMatch,
        targetKey,
        elementalPower,
      }) => {
        const callout = getCascadeComboCallout({
          cascadeDepth,
          has4PlusMatch,
        });
        if (callout) {
          setCascadeComboBanner({ text: callout, cascadeDepth });
        }
        if (elementalPower) {
          setElementalPowerCallout(elementalPower);
        }
        const resolvedBuffs =
          progressNotifier.progress.resolveActiveBuffs(equippedLevelBoosters);
        const earnedCoins = calculateMoveSpiritCoins({
          cascadeDepth,
          has4PlusMatch,
          scoreAndCoinBonus: resolvedBuffs.scoreAndCoinBonus,
        });
        if (earnedCoins > 0) {
          progressNotifier.addSpiritCoins(earnedCoins);
          setFloatingCoinGain({
            id: particleIdRef.current++,
            amount: earnedCoins,
          });
        }
        if (targetKey) {
          setPulsingTargetKeys(new Set([targetKey]));
        }
      },
    };
  }, [board, equippedLevelBoosters, forceRender, progressNotifier]);

  // Background music management
  useEffect(() => {
    if (screen === 'start' || screen === 'map') {
      audioService.playMusic('bgm_calm');
    } else if (screen === 'game') {
      audioService.playMusic('bgm_level');
    }
  }, [screen]);

  // Subscribe to progress updates
  useEffect(() => {
    const unsub = progressNotifier.addListener(() => {
      setProgressTick((t) => t + 1);
    });
    return unsub;
  }, [progressNotifier]);

  // Live window resize & orientation listener
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setSafeInsets(readSafeAreaInsets());
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Idle Hint Timer (6 seconds)
  const resetIdleTimer = useCallback(() => {
    setHintPositions([]);
    if (idleHintTimerRef.current !== null) {
      window.clearTimeout(idleHintTimerRef.current);
      idleHintTimerRef.current = null;
    }
    if (
      screen === 'game' &&
      !isBusy &&
      !isPaused &&
      !gameState.isGameOver &&
      !settings.reducedMotion
    ) {
      idleHintTimerRef.current = window.setTimeout(() => {
        const move = Board.findPossibleMove(board);
        if (move) {
          setHintPositions([move[0], move[1]]);
        }
      }, kIdleHintDelayMs);
    }
  }, [board, gameState.isGameOver, isBusy, isPaused, screen, settings.reducedMotion]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleHintTimerRef.current !== null) {
        window.clearTimeout(idleHintTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  // Subscribe to GameState changes; save progress BEFORE Win dialog buttons become active
  useEffect(() => {
    const unsubscribe = gameState.addListener(() => {
      forceRender();
      if (gameState.isGameOver && bannerTimerRef.current === null) {
        if (gameState.status === GameStatus.won && !winSavedForRunRef.current) {
          winSavedForRunRef.current = true;
          audioService.playWin();
          progressNotifier.recordWin({
            levelNumber: gameState.level.number,
            stars: gameState.stars,
            score: gameState.score,
          });
        } else if (gameState.status === GameStatus.lost) {
          audioService.playLose();
        }
        bannerTimerRef.current = window.setTimeout(() => {
          setShowEndDialog(true);
        }, GameConstants.endBannerHoldMs);
      }
    });
    return () => {
      unsubscribe();
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, [forceRender, gameState, progressNotifier]);

  // Update body dataset for diagnostics & automated tests
  useEffect(() => {
    document.body.dataset.screen = screen;
    document.body.dataset.layoutMode = layout.mode;
    document.body.dataset.sizeClass = layout.sizeClass;
    document.body.dataset.state =
      screen === 'game' ? gameState.status : screen;
  }, [gameState.status, layout.mode, layout.sizeClass, screen]);

  // Back button / Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) {
          return;
        }
        if (previewLevelNumber !== null) {
          return;
        }
        if (screen === 'game' && !gameState.isGameOver) {
          setIsPaused((prev) => !prev);
        } else if (screen === 'map') {
          setScreen('start');
        }
      }
    };

    const handlePopState = () => {
      if (screen === 'game' && !gameState.isGameOver) {
        setIsPaused(true);
        window.history.pushState({ bonkPop: 'game' }, '');
      } else if (screen === 'map') {
        setScreen('start');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [gameState.isGameOver, previewLevelNumber, screen, showSettings]);

  const backgroundPetals = useMemo<PetalSpec[]>(() => {
    return Array.from({ length: GameConstants.maxBackgroundPetals }, (_, i) => ({
      id: i,
      leftPct: (i * 100) / GameConstants.maxBackgroundPetals + ((i * 7) % 5),
      sizePx: 8 + (i % 5) * 2,
      durationSec: 9 + (i % 6) * 1.8,
      delaySec: -((i * 2.3) % 12),
    }));
  }, []);

  const triggerScreenShake = useCallback(
    async (magnitude: number) => {
      setIsBoardShaking(true);
      if (typeof document !== 'undefined') {
        document
          .querySelectorAll(
            '[data-testid="board-container-wrapper"], [data-testid="board-shake-wrapper"], [data-testid="board-grid"]'
          )
          .forEach((el) => el.setAttribute('data-shaking', 'true'));
      }
      if (boardShakeTimerRef.current !== null) {
        window.clearTimeout(boardShakeTimerRef.current);
      }
      boardShakeTimerRef.current = window.setTimeout(() => {
        setIsBoardShaking(false);
        setScreenShakeOffset({ x: 0, y: 0 });
        if (typeof document !== 'undefined') {
          document
            .querySelectorAll(
              '[data-testid="board-container-wrapper"], [data-testid="board-shake-wrapper"], [data-testid="board-grid"]'
            )
            .forEach((el) => el.setAttribute('data-shaking', 'false'));
        }
        boardShakeTimerRef.current = null;
      }, 300);

      if (settings.reducedMotion) return;
      const offsets = [
        { x: magnitude, y: -magnitude * 0.75 },
        { x: -magnitude * 0.85, y: magnitude * 0.7 },
        { x: magnitude * 0.65, y: -magnitude * 0.5 },
        { x: -magnitude * 0.45, y: magnitude * 0.35 },
        { x: magnitude * 0.25, y: -magnitude * 0.2 },
        { x: 0, y: 0 },
      ];
      for (const off of offsets) {
        setScreenShakeOffset(off);
        await delay(50);
      }
      setScreenShakeOffset({ x: 0, y: 0 });
    },
    [settings.reducedMotion]
  );

  const spawnClearParticles = useCallback(
    (cleared: GridPos[]) => {
      if (settings.reducedMotion) return;
      let count = 0;
      const maxParticles = GameConstants.maxBurstParticles;
      outer: for (const pos of cleared) {
        for (let i = 0; i < GameConstants.burstParticlesPerTile; i++) {
          if (count >= maxParticles) break outer;
          const angle =
            (i * 2 * Math.PI) / GameConstants.burstParticlesPerTile +
            (pos.row + pos.col) * 0.25;
          const dist = 16 + (i % 2) * 12;
          const slot = PARTICLE_POOL[count];
          slot.id = particleIdRef.current++;
          slot.row = pos.row;
          slot.col = pos.col;
          slot.dx = Math.round(Math.cos(angle) * dist);
          slot.dy = Math.round(Math.sin(angle) * dist);
          slot.color =
            i % 2 === 0
              ? theme.clearEffect.primaryColor
              : theme.clearEffect.secondaryColor;
          count++;
        }
      }
      setBurstParticles(PARTICLE_POOL.slice(0, count));
    },
    [settings.reducedMotion, theme]
  );

  const spawnFloatingScore = useCallback(
    (cleared: GridPos[], points: number, cascadeIndex: number) => {
      if (cleared.length === 0) return;
      let sumRow = 0;
      let sumCol = 0;
      for (const c of cleared) {
        sumRow += c.row;
        sumCol += c.col;
      }
      const id = particleIdRef.current++;
      const popup: FloatingScorePopup = {
        id,
        text: `+${points}`,
        row: sumRow / cleared.length,
        col: sumCol / cleared.length,
        scale: 1 + Math.min(cascadeIndex, 4) * 0.14,
      };
      setFloatingScores((prev) => [...prev, popup]);
      window.setTimeout(() => {
        setFloatingScores((prev) => prev.filter((item) => item.id !== id));
      }, GameConstants.floatingScoreDurationMs);
    },
    []
  );

  const replayResolveSteps = useCallback(
    async (
      workingBoard: Board,
      steps: ResolveStep[],
      stepScores: number[]
    ) => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const cascadeNum = i + 1;

        // Cascade Word Banner ("Nice!", "Sugoi!", "Kami-sama!")
        const popupWord = theme.cascadeWordFor(cascadeNum);
        if (popupWord) {
          setCenterPopup({
            text: popupWord,
            scale: 1 + Math.min(cascadeNum - 2, 3) * 0.14,
          });
        }

        // Synthesized Pentatonic Cascade Chime (C4, D4, E4, G4, A4) + Match SFX
        const chimeTone = audioService.playCascadeChime(cascadeNum);
        if (typeof document !== 'undefined') {
          document.body.dataset.lastCascadeChime = chimeTone.note;
        }
        audioService.playMatch(cascadeNum);

        // Multi-wave special tile execution
        if (step.waves && step.waves.length > 0) {
          for (const wave of step.waves) {
            const nextWaves: WaveVisualEffect[] = [];
            let hadBurstOrOrb = false;

            for (const act of wave.activated) {
              const wid = waveIdRef.current++;
              let kind: WaveVisualEffect['kind'] = 'burst';

              if (act.kind === 'slashRow') {
                kind = 'slashRow';
                audioService.playSlash();
              } else if (act.kind === 'slashColumn') {
                kind = 'slashColumn';
                audioService.playSlash();
              } else if (act.kind === 'burst') {
                kind = 'burst';
                audioService.playBurst();
                hadBurstOrOrb = true;
              } else if (act.kind === 'orb') {
                kind = 'orb';
                audioService.playOrb();
                hadBurstOrOrb = true;
              }

              nextWaves.push({
                id: wid,
                kind,
                row: act.cell.row,
                col: act.cell.col,
              });
            }

            setWaveEffects(nextWaves);
            if (hadBurstOrOrb) {
              triggerScreenShake(7);
            }

            await delay(kSpecialWaveDelayMs);
            setWaveEffects([]);
          }
        }

        // Floating score popup
        if (i < stepScores.length) {
          spawnFloatingScore(step.cleared, stepScores[i], i);
        }

        // Clear tiles animation & Glow Square shimmer
        const clearingStates: Record<string, TileAnimState> = {};
        for (const pos of step.cleared) {
          clearingStates[pos.key] = 'clearing';
        }
        const glowRemovals = gameState.lastStepGlowRemovals[i] ?? [];
        if (glowRemovals.length > 0) {
          setShimmeringGlowKeys(new Set(glowRemovals.map((gEvt) => gEvt.pos.key)));
          spawnFloatingScore(
            glowRemovals.map((gEvt) => gEvt.pos),
            glowRemovals.length * GameConstants.glowLayerClearedBonus,
            i
          );
        }
        setTileStates(clearingStates);
        spawnClearParticles(step.cleared);

        await delay(
          settings.reducedMotion ? 80 : GameConstants.clearDurationMs
        );
        setBurstParticles([]);
        setShimmeringGlowKeys(new Set());

        // Apply post-step board state for falls & refills
        if (step.postStepGrid) {
          for (let r = 0; r < workingBoard.size; r++) {
            for (let c = 0; c < workingBoard.size; c++) {
              workingBoard.setAt(new GridPos(r, c), step.postStepGrid[r][c]);
            }
          }
        } else {
          for (const sp of step.createdSpecials) {
            workingBoard.setAt(sp.cell, sp.tile);
          }
        }

        // Falls & refills animation
        const startOffsets: Record<string, { x: number; y: number }> = {};
        const fallStates: Record<string, TileAnimState> = {};

        for (const fall of step.falls) {
          const key = fall.to.key;
          startOffsets[key] = { x: 0, y: fall.from.row - fall.to.row };
          fallStates[key] = 'falling';
        }
        for (const spawn of step.refills) {
          const key = spawn.target.key;
          startOffsets[key] = { x: 0, y: spawn.startRow - spawn.target.row };
          fallStates[key] = 'falling';
        }

        setTileStates({});
        setTileOffsets(startOffsets);
        forceRender();

        await delay(25);
        setTileStates(fallStates);
        setTileOffsets({});
        await delay(
          settings.reducedMotion ? 60 : GameConstants.fallDurationMs
        );

        setTileStates({});
        if (i < steps.length - 1) {
          await delay(
            settings.reducedMotion ? 40 : GameConstants.stepPauseMs
          );
        }
      }

      // Check if board needs shuffle
      if (!Board.hasPossibleMove(workingBoard)) {
        setCenterPopup({ text: 'Shuffle!', scale: 1.1 });
        const moves = Board.shuffleBoard(workingBoard);

        const initialOffsets: Record<string, { x: number; y: number }> = {};
        const shuffleStates: Record<string, TileAnimState> = {};
        for (const move of moves) {
          const key = move.to.key;
          initialOffsets[key] = {
            x: move.from.col - move.to.col,
            y: move.from.row - move.to.row,
          };
          shuffleStates[key] = 'shuffling';
        }

        setTileOffsets(initialOffsets);
        forceRender();
        await delay(25);
        setTileStates(shuffleStates);
        setTileOffsets({});
        await delay(
          settings.reducedMotion ? 100 : GameConstants.shuffleDurationMs
        );
        setTileStates({});
      }

      await delay(120);
      setCenterPopup(null);
    },
    [
      forceRender,
      gameState.lastStepGlowRemovals,
      settings.reducedMotion,
      spawnClearParticles,
      spawnFloatingScore,
      theme,
      triggerScreenShake,
    ]
  );

  const handleSwapCells = useCallback(
    async (a: GridPos, b: GridPos) => {
      if (
        isBusy ||
        isPaused ||
        gameState.isGameOver ||
        !board.areAdjacent(a, b)
      ) {
        return;
      }
      setIsBusy(true);
      setCenterPopup(null);
      resetIdleTimer();
      audioService.playSwap();

      const dx = b.col - a.col;
      const dy = b.row - a.row;
      const preSwapGrid = board.toGrid();

      setTileStates({
        [a.key]: 'swapping',
        [b.key]: 'swapping',
      });
      setTileOffsets({
        [a.key]: { x: dx, y: dy },
        [b.key]: { x: -dx, y: -dy },
      });
      await delay(settings.reducedMotion ? 60 : GameConstants.swapDurationMs);

      board.swap(a, b);
      setTileOffsets({});
      setTileStates({});
      forceRender();

      // Snapshot swapped board before resolving so step-by-step replay starts from pre-clear tiles
      const swappedGrid = board.toGrid();
      const actualResult = Board.resolveBoard(board, {
        playerMovedCell: b,
        playerSwapOriginCell: a,
      });

      if (actualResult.steps.length === 0) {
        // Invalid swap: animate back, swap model back, do NOT consume move
        await delay(30);
        audioService.playClick();
        setTileStates({
          [a.key]: 'swapping',
          [b.key]: 'swapping',
        });
        setTileOffsets({
          [a.key]: { x: dx, y: dy },
          [b.key]: { x: -dx, y: -dy },
        });
        await delay(settings.reducedMotion ? 60 : GameConstants.swapDurationMs);
        board.swap(a, b);
        setTileOffsets({});
        setTileStates({});
        forceRender();
        setIsBusy(false);
        resetIdleTimer();
        return;
      }

      // Restore swappedGrid onto board so replayResolveSteps animates each step cleanly
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          board.setAt(new GridPos(r, c), swappedGrid[r][c]);
        }
      }

      // Save 1-Move Rewind snapshot before applying move & resolve steps
      gameState.saveTurnSnapshot(board, preSwapGrid);

      // Valid swap: consume move and execute steps
      const prevCollect = { ...gameState.collectProgress };
      const prevGlow = gameState.glowLayersRemaining;
      const prevScore = gameState.score;

      gameState.beginResolving();
      gameState.useMove(board);

      const stepScores = gameState.applyResolveSteps(actualResult.steps, board);

      // Detect which target objectives decreased / progressed on this move
      const nextPulsing = new Set<string>();
      for (const [tileId, prevRem] of Object.entries(prevCollect)) {
        const nextRem = gameState.collectProgress[tileId] ?? 0;
        if (nextRem < prevRem) {
          nextPulsing.add(tileId);
        }
      }
      if (gameState.glowLayersRemaining < prevGlow) {
        nextPulsing.add('glow');
      }
      if (gameState.score > prevScore) {
        nextPulsing.add('score');
      }
      if (nextPulsing.size > 0) {
        setPulsingTargetKeys(nextPulsing);
        if (targetPulseTimerRef.current !== null) {
          window.clearTimeout(targetPulseTimerRef.current);
        }
      }

      // Cascade Combo Callout Banner ("2x Spirit Chain!", "3x Festival Fever!", "4x+ Kitsune Overload!")
      const callout = gameState.lastMoveComboCallout;
      if (callout) {
        setCascadeComboBanner({
          text: callout,
          cascadeDepth: gameState.lastMoveCascadeDepth,
        });
        if (cascadeBannerTimerRef.current !== null) {
          window.clearTimeout(cascadeBannerTimerRef.current);
        }
      }

      // Asymmetric Elemental Signature Callout Badge
      const elementalCallout = gameState.lastTriggeredElementalPower;
      if (elementalCallout) {
        setElementalPowerCallout(elementalCallout);
        if (elementalCalloutTimerRef.current !== null) {
          window.clearTimeout(elementalCalloutTimerRef.current);
        }
        elementalCalloutTimerRef.current = window.setTimeout(() => {
          setElementalPowerCallout(null);
          elementalCalloutTimerRef.current = null;
        }, GameConstants.elementalCalloutHoldMs);
      }

      // Live Spirit Coin Drops for 4+ matches, 2+ cascade waves, and Red Lantern Nova
      const coinsEarned = gameState.lastMoveCoinsEarned;
      if (coinsEarned > 0) {
        progressNotifier.addSpiritCoins(coinsEarned);
        setFloatingCoinGain({
          id: particleIdRef.current++,
          amount: coinsEarned,
        });
        if (coinGainTimerRef.current !== null) {
          window.clearTimeout(coinGainTimerRef.current);
        }
        coinGainTimerRef.current = window.setTimeout(() => {
          setFloatingCoinGain(null);
          coinGainTimerRef.current = null;
        }, GameConstants.floatingCoinGainDurationMs);
      }

      await replayResolveSteps(board, actualResult.steps, stepScores);

      if (nextPulsing.size > 0) {
        targetPulseTimerRef.current = window.setTimeout(() => {
          setPulsingTargetKeys(new Set());
          targetPulseTimerRef.current = null;
        }, GameConstants.targetPulseDurationMs);
      }
      if (callout) {
        cascadeBannerTimerRef.current = window.setTimeout(() => {
          setCascadeComboBanner(null);
          cascadeBannerTimerRef.current = null;
        }, GameConstants.cascadeBannerHoldMs);
      }

      gameState.evaluate();
      setIsBusy(false);
      resetIdleTimer();
    },
    [
      board,
      forceRender,
      gameState,
      isBusy,
      isPaused,
      progressNotifier,
      replayResolveSteps,
      resetIdleTimer,
      settings.reducedMotion,
    ]
  );

  // Kitsune Spirit Companion Meter: Activate Skill at 100% Charge (0 Moves)
  const handleActivateKitsuneSkill = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver || !gameState.isSpiritReady) {
      return;
    }
    gameState.setActiveCompanion(
      progressNotifier.progress.activeCompanionId,
      progressNotifier.progress.activeCompanionRank
    );
    const res = gameState.activateKitsuneSkill(board);
    if (!res) return;

    audioService.playOrb();
    setSelectedPos(null);
    triggerScreenShake(7);

    if (res.bonusCoins > 0) {
      progressNotifier.addSpiritCoins(res.bonusCoins);
      setFloatingCoinGain({
        id: particleIdRef.current++,
        amount: res.bonusCoins,
      });
      if (coinGainTimerRef.current !== null) {
        window.clearTimeout(coinGainTimerRef.current);
      }
      coinGainTimerRef.current = window.setTimeout(() => {
        setFloatingCoinGain(null);
        coinGainTimerRef.current = null;
      }, GameConstants.floatingCoinGainDurationMs);
    }

    setKitsuneSkillCallout(res.calloutText);
    if (kitsuneSkillTimerRef.current !== null) {
      window.clearTimeout(kitsuneSkillTimerRef.current);
    }
    kitsuneSkillTimerRef.current = window.setTimeout(() => {
      setKitsuneSkillCallout(null);
      kitsuneSkillTimerRef.current = null;
    }, GameConstants.kitsuneSkillCalloutHoldMs);

    if (res.clearedCells.length > 0) {
      spawnFloatingScore(res.clearedCells, res.bonusScore, 1);
      spawnClearParticles(res.clearedCells);
      window.setTimeout(() => setBurstParticles([]), 240);
    }

    forceRender();
  }, [
    board,
    forceRender,
    gameState,
    isBusy,
    isPaused,
    progressNotifier,
    spawnClearParticles,
    spawnFloatingScore,
    triggerScreenShake,
  ]);

  // Kitsune Spirit Companion Meter: Boost to 100% Charge for 25 🪙
  const handleCoinBoostKitsune = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver) return;
    const boosted = gameState.boostSpiritChargeWithCoins(progressNotifier);
    if (boosted) {
      audioService.playMatch(2);
      forceRender();
    }
  }, [forceRender, gameState, isBusy, isPaused, progressNotifier]);

  // 1-Move Time-Slip Rewind (1st free, subsequent 15 🪙)
  const handleRewindMove = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver || !gameState.canRewind) {
      return;
    }
    const rewound = gameState.rewindLastMove(board, progressNotifier);
    if (rewound) {
      audioService.playSwap();
      setSelectedPos(null);
      setCenterPopup({ text: '↺ Time-Slip Rewind!', scale: 1.05 });
      window.setTimeout(() => setCenterPopup(null), 650);
      forceRender();
    }
  }, [board, forceRender, gameState, isBusy, isPaused, progressNotifier]);

  // Lucky Shuffle (20 🪙, 0 moves, shuffles movable tiles + upgrades 1 random tile into a Special Tile)
  const handleLuckyShuffle = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver) return;
    const res = gameState.luckyShuffle(board, progressNotifier);
    if (res) {
      audioService.playMatch(2);
      setSelectedPos(null);
      setCenterPopup({ text: 'Lucky Shuffle!', scale: 1.1 });
      window.setTimeout(() => setCenterPopup(null), 700);
      forceRender();
    }
  }, [board, forceRender, gameState, isBusy, isPaused, progressNotifier]);

  // Second Wind Continue (40 🪙 for +5 moves, 100% spirit charge, and streak protection)
  const handleSecondWindContinue = useCallback(() => {
    if (gameState.status !== GameStatus.lost) return;
    const ok = gameState.activateSecondWind(progressNotifier);
    if (!ok) return;

    audioService.playWin();
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setShowEndDialog(false);
    setKitsuneSkillCallout('Second Wind! +5 Moves & 100% Spirit!');
    if (kitsuneSkillTimerRef.current !== null) {
      window.clearTimeout(kitsuneSkillTimerRef.current);
    }
    kitsuneSkillTimerRef.current = window.setTimeout(() => {
      setKitsuneSkillCallout(null);
      kitsuneSkillTimerRef.current = null;
    }, GameConstants.kitsuneSkillCalloutHoldMs);
    forceRender();
  }, [forceRender, gameState, progressNotifier]);

  // Pack Takeout Bento on Level Victory (25 🪙, or 0 🪙 at Fever Tier 5)
  const handlePackTakeoutBento = useCallback(() => {
    if (gameState.status !== GameStatus.won || takeoutBentoPacked) return;
    const packed = gameState.packTakeoutBento(progressNotifier);
    if (packed) {
      audioService.playMatch(2);
      setTakeoutBentoPacked(true);
      forceRender();
    }
  }, [forceRender, gameState, progressNotifier, takeoutBentoPacked]);

  // Bento Forge Dock: Toggle Pocket Mode
  const handleTogglePocketMode = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver) return;
    audioService.playClick();
    setSelectedPos(null);
    gameState.togglePocketMode();
    forceRender();
  }, [forceRender, gameState, isBusy, isPaused]);

  // Bento Forge Dock: Click a Bento Slot (arms filled slot for deploy, or arms Pocket Mode if empty)
  const handleClickBentoSlot = useCallback(
    (slotIndex: number) => {
      if (isBusy || isPaused || gameState.isGameOver) return;
      audioService.playClick();
      setSelectedPos(null);
      gameState.armBentoSlot(slotIndex);
      forceRender();
    },
    [forceRender, gameState, isBusy, isPaused]
  );

  // Bento Forge Dock: Intercept board tap when Pocket Mode is active or a Bento slot is armed
  const handleSpecialInteractionTap = useCallback(
    (pos: GridPos): boolean => {
      if (isBusy || isPaused || gameState.isGameOver) return false;

      // A. Pocket a Special Tile from the board (0 Moves)
      if (gameState.pocketModeActive) {
        const tile = board.getAt(pos);
        if (!tile || !tile.isSpecial) {
          return false;
        }
        const pocketed = gameState.pocketSpecialFromBoard(board, pos);
        if (pocketed) {
          audioService.playMatch(1);
          setSelectedPos(null);
          forceRender();
          return true;
        }
        return false;
      }

      // B. Deploy an armed Bento Special onto targetPos
      if (gameState.armedBentoSlotIndex !== null) {
        const slotIdx = gameState.armedBentoSlotIndex;
        const deployOut = gameState.deployBentoSpecial(board, slotIdx, pos);
        if (!deployOut) return false;

        audioService.playBurst();
        setSelectedPos(null);
        triggerScreenShake(6);

        if (gameState.lastTriggeredElementalPower) {
          setElementalPowerCallout(gameState.lastTriggeredElementalPower);
          if (elementalCalloutTimerRef.current !== null) {
            window.clearTimeout(elementalCalloutTimerRef.current);
          }
          elementalCalloutTimerRef.current = window.setTimeout(() => {
            setElementalPowerCallout(null);
            elementalCalloutTimerRef.current = null;
          }, GameConstants.elementalCalloutHoldMs);
        }

        const coinsEarned = gameState.lastMoveCoinsEarned;
        if (coinsEarned > 0) {
          progressNotifier.addSpiritCoins(coinsEarned);
          setFloatingCoinGain({
            id: particleIdRef.current++,
            amount: coinsEarned,
          });
          if (coinGainTimerRef.current !== null) {
            window.clearTimeout(coinGainTimerRef.current);
          }
          coinGainTimerRef.current = window.setTimeout(() => {
            setFloatingCoinGain(null);
            coinGainTimerRef.current = null;
          }, GameConstants.floatingCoinGainDurationMs);
        }

        if (deployOut.steps[0] && deployOut.stepScores[0]) {
          spawnFloatingScore(
            deployOut.steps[0].cleared,
            deployOut.stepScores[0],
            0
          );
          spawnClearParticles(deployOut.steps[0].cleared);
          window.setTimeout(() => setBurstParticles([]), 240);
        }

        forceRender();
        return true;
      }

      return false;
    },
    [
      board,
      forceRender,
      gameState,
      isBusy,
      isPaused,
      progressNotifier,
      spawnClearParticles,
      spawnFloatingScore,
      triggerScreenShake,
    ]
  );

  // C. Bento Fusion (Combine 2 Docked Specials -> Super Matsuri Cross Blast)
  const handleFuseBento = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver || !gameState.canFuseBento) {
      return;
    }
    const fuseOut = gameState.fuseBentoSpecials(board);
    if (!fuseOut) return;

    audioService.playOrb();
    setSelectedPos(null);
    triggerScreenShake(9);

    if (gameState.lastTriggeredElementalPower) {
      setElementalPowerCallout(gameState.lastTriggeredElementalPower);
      if (elementalCalloutTimerRef.current !== null) {
        window.clearTimeout(elementalCalloutTimerRef.current);
      }
      elementalCalloutTimerRef.current = window.setTimeout(() => {
        setElementalPowerCallout(null);
        elementalCalloutTimerRef.current = null;
      }, GameConstants.elementalCalloutHoldMs);
    }

    if (fuseOut.bonusCoins > 0) {
      progressNotifier.addSpiritCoins(fuseOut.bonusCoins);
      setFloatingCoinGain({
        id: particleIdRef.current++,
        amount: fuseOut.bonusCoins,
      });
      if (coinGainTimerRef.current !== null) {
        window.clearTimeout(coinGainTimerRef.current);
      }
      coinGainTimerRef.current = window.setTimeout(() => {
        setFloatingCoinGain(null);
        coinGainTimerRef.current = null;
      }, GameConstants.floatingCoinGainDurationMs);
    }

    spawnFloatingScore(fuseOut.clearedCells, fuseOut.bonusScore, 2);
    spawnClearParticles(fuseOut.clearedCells);
    window.setTimeout(() => setBurstParticles([]), 260);
    forceRender();
  }, [
    board,
    forceRender,
    gameState,
    isBusy,
    isPaused,
    progressNotifier,
    spawnClearParticles,
    spawnFloatingScore,
    triggerScreenShake,
  ]);

  const resetOverlayTimer = useCallback(() => {
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    if (cascadeBannerTimerRef.current !== null) {
      clearTimeout(cascadeBannerTimerRef.current);
      cascadeBannerTimerRef.current = null;
    }
    if (elementalCalloutTimerRef.current !== null) {
      clearTimeout(elementalCalloutTimerRef.current);
      elementalCalloutTimerRef.current = null;
    }
    if (kitsuneSkillTimerRef.current !== null) {
      clearTimeout(kitsuneSkillTimerRef.current);
      kitsuneSkillTimerRef.current = null;
    }
    if (coinGainTimerRef.current !== null) {
      clearTimeout(coinGainTimerRef.current);
      coinGainTimerRef.current = null;
    }
    if (targetPulseTimerRef.current !== null) {
      clearTimeout(targetPulseTimerRef.current);
      targetPulseTimerRef.current = null;
    }
    setShowEndDialog(false);
  }, []);

  const handleStartLevel = useCallback(
    (
      levelNumber: number,
      equippedBoosters?: readonly BentoBoosterId[]
    ) => {
      audioService.playClick();
      const baseConfig = Levels.forNumber(levelNumber);
      const activeBoosters = equippedBoosters ?? [];
      setEquippedLevelBoosters(activeBoosters);

      const carriedBento = progressNotifier.consumeCarryOverBento();
      const resolvedBuffs =
        progressNotifier.progress.resolveActiveBuffs(activeBoosters);

      resetOverlayTimer();
      winSavedForRunRef.current = false;
      setTakeoutBentoPacked(false);
      setPreviewLevelNumber(null);
      setIsPaused(false);
      setIsBusy(false);
      setSelectedPos(null);
      setTileStates({});
      setTileOffsets({});
      setBurstParticles([]);
      setFloatingScores([]);
      setCenterPopup(null);
      setCascadeComboBanner(null);
      setElementalPowerCallout(null);
      setKitsuneSkillCallout(null);
      setFloatingCoinGain(null);
      setPulsingTargetKeys(new Set());
      gameState.loadLevel(baseConfig, {
        extraMoves: resolvedBuffs.extraMoves,
        scoreAndCoinBonus: resolvedBuffs.scoreAndCoinBonus,
        startingSpecialTile: resolvedBuffs.startingSpecialTile,
        festivalFeverStreak: progressNotifier.progress.festivalFeverStreak,
        carryOverBento: carriedBento,
        activeCompanionId: progressNotifier.progress.activeCompanionId,
        companionRank: progressNotifier.progress.activeCompanionRank,
      });
      const nextBoard = Board.generate();
      if (baseConfig.festivalBlockers) {
        nextBoard.initBlockers(baseConfig.festivalBlockers);
      }
      if (resolvedBuffs.startingSpecialTile) {
        const centerCell = new GridPos(3, 3);
        const existing = nextBoard.tileAt(3, 3);
        if (existing) {
          nextBoard.setAt(
            centerCell,
            new Tile(existing.type, SpecialKind.slashRow)
          );
        }
      }
      setBoard(nextBoard);
      setScreen('game');
      if (typeof window !== 'undefined') {
        window.history.pushState({ bonkPop: 'game', level: levelNumber }, '');
      }
    },
    [gameState, progressNotifier, resetOverlayTimer]
  );

  const handleRestartLevel = useCallback(() => {
    audioService.playClick();
    if (gameState.status === GameStatus.lost) {
      progressNotifier.recordLoss({
        levelNumber: gameState.level.number,
        score: gameState.score,
      });
    }
    resetOverlayTimer();
    winSavedForRunRef.current = false;
    setTakeoutBentoPacked(false);
    setIsPaused(false);
    setIsBusy(false);
    setSelectedPos(null);
    setTileStates({});
    setTileOffsets({});
    setBurstParticles([]);
    setFloatingScores([]);
    setCenterPopup(null);
    setCascadeComboBanner(null);
    setElementalPowerCallout(null);
    setKitsuneSkillCallout(null);
    setFloatingCoinGain(null);
    setPulsingTargetKeys(new Set());
    const resolvedBuffs =
      progressNotifier.progress.resolveActiveBuffs(equippedLevelBoosters);
    gameState.loadLevel(gameState.level, {
      extraMoves: resolvedBuffs.extraMoves,
      scoreAndCoinBonus: resolvedBuffs.scoreAndCoinBonus,
      startingSpecialTile: resolvedBuffs.startingSpecialTile,
      festivalFeverStreak: progressNotifier.progress.festivalFeverStreak,
      activeCompanionId: progressNotifier.progress.activeCompanionId,
      companionRank: progressNotifier.progress.activeCompanionRank,
    });
    const nextBoard = Board.generate();
    if (gameState.level.festivalBlockers) {
      nextBoard.initBlockers(gameState.level.festivalBlockers);
    }
    if (resolvedBuffs.startingSpecialTile) {
      const centerCell = new GridPos(3, 3);
      const existing = nextBoard.tileAt(3, 3);
      if (existing) {
        nextBoard.setAt(
          centerCell,
          new Tile(existing.type, SpecialKind.slashRow)
        );
      }
    }
    setBoard(nextBoard);
  }, [equippedLevelBoosters, gameState, progressNotifier, resetOverlayTimer]);

  const handleNextLevel = useCallback(() => {
    audioService.playClick();
    const next = Levels.nextAfter(gameState.level.number);
    if (!next) {
      resetOverlayTimer();
      setIsPaused(false);
      setScreen('map');
      return;
    }
    handleStartLevel(next.number);
  }, [gameState.level.number, handleStartLevel, resetOverlayTimer]);

  const handleQuitToMap = useCallback(() => {
    audioService.playClick();
    if (gameState.status === GameStatus.lost) {
      progressNotifier.recordLoss({
        levelNumber: gameState.level.number,
        score: gameState.score,
      });
    }
    resetOverlayTimer();
    setIsPaused(false);
    setIsBusy(false);
    setSelectedPos(null);
    setScreen('map');
  }, [gameState, progressNotifier, resetOverlayTimer]);

  const handleNewBoard = useCallback(() => {
    if (isBusy || isPaused || gameState.isGameOver) return;
    audioService.playClick();
    const nextBoard = Board.generate();
    if (gameState.level.festivalBlockers) {
      nextBoard.initBlockers(gameState.level.festivalBlockers);
    }
    setBoard(nextBoard);
    setSelectedPos(null);
    setTileStates({});
    setTileOffsets({});
    setBurstParticles([]);
    setCenterPopup(null);
    resetIdleTimer();
  }, [gameState.isGameOver, isBusy, isPaused, resetIdleTimer]);

  const progress = progressNotifier.progress;
  const activeBoardTheme =
    MATSURI_BOARD_THEMES[progress.activeThemeId] ??
    MATSURI_BOARD_THEMES.sakura_twilight;
  const gradientCss = activeBoardTheme.gradientCss;
  const mapTheme = theme.mapTheme;
  const activeShrineBuffs: readonly ActiveShrineBuffBadge[] =
    progress.resolveActiveBuffs(equippedLevelBoosters).activeBadges;
  const previewLevelConfig =
    previewLevelNumber !== null ? Levels.forNumber(previewLevelNumber) : null;
  const activeCompanionSpec =
    SPIRIT_COMPANIONS[progress.activeCompanionId] ?? SPIRIT_COMPANIONS.kitsune;

  return (
    <main
      data-board-theme={progress.activeThemeId}
      style={{ background: gradientCss }}
      className="relative w-full h-[100dvh] overflow-hidden select-none"
    >
      {/* Procedural Scenic Background: Bottom-Anchored Dusk Hills, Torii Silhouette & Falling Sakura Petals */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden z-0"
      >
        <svg
          viewBox="0 0 1440 260"
          preserveAspectRatio="xMidYMax slice"
          className="absolute bottom-0 left-0 w-full h-[28vh] max-h-[240px] opacity-85"
        >
          <path
            d="M0,180 Q320,85 720,155 T1440,130 L1440,260 L0,260 Z"
            fill={mapTheme.farHillColor}
          />
          <g
            transform="translate(1120, 92)"
            fill={mapTheme.toriiColor}
            opacity="0.65"
          >
            <rect x="-34" y="0" width="68" height="7" rx="3" />
            <rect x="-26" y="13" width="52" height="5" rx="2" />
            <rect x="-20" y="6" width="6" height="48" />
            <rect x="14" y="6" width="6" height="48" />
          </g>
          <path
            d="M0,210 Q420,130 880,195 T1440,175 L1440,260 L0,260 Z"
            fill={mapTheme.nearHillColor}
          />
        </svg>

        {backgroundPetals.map((p) => (
          <span
            key={p.id}
            style={{
              left: `${p.leftPct}%`,
              width: `${p.sizePx * 1.4}px`,
              height: `${p.sizePx}px`,
              backgroundColor: theme.background.petalColor,
              animationDuration: `${p.durationSec}s`,
              animationDelay: `${p.delaySec}s`,
            }}
            className="sakura-petal absolute -top-6 rounded-full opacity-45"
          />
        ))}
      </div>

      {/* Screen 1: Start Screen */}
      {screen === 'start' && (
        <StartScreen
          theme={theme}
          layout={layout}
          totalStars={progress.totalStars}
          maxStars={GameConstants.totalLevels * 3}
          onPlay={() => {
            audioService.playClick();
            setScreen('map');
          }}
          onOpenSettings={() => {
            audioService.playClick();
            setShowSettings(true);
          }}
        />
      )}

      {/* Screen 2: Level Map Screen */}
      {screen === 'map' && (
        <MapScreen
          theme={theme}
          layout={layout}
          progress={progress}
          onSelectLevel={(lvl) => {
            audioService.playClick();
            setPreviewLevelNumber(lvl);
          }}
          onClaimTierChest={(tierNumber) => {
            audioService.playWin();
            progressNotifier.claimTierChest(tierNumber);
          }}
          onPerformGachaPull={() => progressNotifier.performGachaPull()}
          onEquipCompanion={(id) => {
            const updated = progressNotifier.equipCompanion(id);
            gameState.setActiveCompanion(
              updated.activeCompanionId,
              updated.activeCompanionRank
            );
          }}
          onEquipTheme={(id) => {
            progressNotifier.equipTheme(id);
          }}
          onBack={() => {
            audioService.playClick();
            setScreen('start');
          }}
          onOpenSettings={() => {
            audioService.playClick();
            setShowSettings(true);
          }}
        />
      )}

      {/* Screen 3: Game Screen with Responsive HUD & Board */}
      {screen === 'game' && (
        <section
          aria-label="Level Board"
          data-testid="game-screen-wrapper"
          data-board-theme={progress.activeThemeId}
          style={{
            background: activeBoardTheme.gradientCss,
          }}
          className="relative w-full h-full overflow-hidden"
        >
          {/* Floating Sakura Petal & Lantern Ember Particle Canvas */}
          <MatsuriParticleCanvas
            width={layout.screen.width}
            height={layout.screen.height}
            reducedMotion={settings.reducedMotion}
          />

          {/* Top HUD / Bottom Bar (Portrait) & Side Panels (Landscape) */}
          <div className="z-20">
            <HudPanel
              theme={theme}
              layout={layout}
              level={gameState.level}
              movesLeft={gameState.movesLeft}
              score={gameState.score}
              collectProgress={gameState.collectProgress}
              glowLayersRemaining={gameState.glowLayersRemaining}
              spiritCoins={progress.spiritCoins}
              floatingCoinGain={floatingCoinGain}
              activeShrineBuffs={activeShrineBuffs}
              pulsingTargetKeys={pulsingTargetKeys}
              bentoDock={gameState.bentoDock}
              pocketModeActive={gameState.pocketModeActive}
              armedBentoSlotIndex={gameState.armedBentoSlotIndex}
              canFuseBento={gameState.canFuseBento}
              spiritCharge={gameState.spiritCharge}
              activeCompanionId={progress.activeCompanionId}
              companionRank={progress.activeCompanionRank}
              festivalFeverStreak={gameState.festivalFeverStreak}
              canRewind={gameState.canRewind}
              rewindCost={gameState.rewindCost}
              yokaiBossHp={gameState.yokaiBossHp}
              yokaiBossMaxHp={gameState.yokaiBossMaxHp}
              bossTurnCounter={gameState.bossTurnCounter}
              status={gameState.status}
              disabled={isBusy}
              onPauseClick={() => {
                audioService.playClick();
                setIsPaused(true);
              }}
              onNewBoardClick={handleNewBoard}
              onTogglePocketMode={handleTogglePocketMode}
              onClickBentoSlot={handleClickBentoSlot}
              onFuseBento={handleFuseBento}
              onActivateKitsuneSkill={handleActivateKitsuneSkill}
              onCoinBoostKitsune={handleCoinBoostKitsune}
              onRewindMove={handleRewindMove}
              onLuckyShuffle={handleLuckyShuffle}
            />
          </div>

          {/* Central 8x8 Board Container */}
          <div
            data-testid="board-container-wrapper"
            data-board-theme={progress.activeThemeId}
            data-shaking={isBoardShaking ? 'true' : 'false'}
            style={{
              position: 'absolute',
              left: `${layout.board.left}px`,
              top: `${layout.board.top}px`,
              width: `${layout.board.width}px`,
              height: `${layout.board.height}px`,
              boxShadow: activeBoardTheme.boardGlowShadow,
              borderRadius: '24px',
            }}
            className="z-10 flex items-center justify-center"
          >
            <BoardComponent
              board={board}
              theme={theme}
              boardSizePx={layout.board.width}
              uiScale={layout.uiScale}
              selectedPos={selectedPos}
              isBusy={isBusy || isPaused || gameState.isGameOver}
              tileStates={tileStates}
              tileOffsets={tileOffsets}
              burstParticles={burstParticles}
              floatingScores={floatingScores}
              centerPopup={centerPopup}
              cascadeComboBanner={cascadeComboBanner}
              elementalPowerCallout={elementalPowerCallout}
              hintPositions={hintPositions}
              waveEffects={waveEffects}
              screenShakeOffset={screenShakeOffset}
              isShaking={isBoardShaking}
              glowRemainingGrid={gameState.glowRemainingGrid}
              shimmeringGlowKeys={shimmeringGlowKeys}
              reducedMotion={settings.reducedMotion}
              onSelectPos={(p) => {
                resetIdleTimer();
                setSelectedPos(p);
              }}
              onSwapCells={handleSwapCells}
              onSpecialInteractionTap={handleSpecialInteractionTap}
            />

            {/* Spirit Companion Skill Callout Banner */}
            {(kitsuneSkillCallout || gameState.lastKitsuneSkillCallout) && (
              <div
                data-testid="kitsune-skill-callout"
                data-active-companion={progress.activeCompanionId}
                style={{
                  background:
                    'linear-gradient(135deg, #4CC9F0 0%, #7209B7 55%, #FF4D79 100%)',
                  borderColor: '#FFE066',
                  color: '#FFFFFF',
                  fontFamily: theme.titleFontFamily,
                  boxShadow: '0 0 18px rgba(76, 201, 240, 0.85)',
                }}
                className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full border-2 text-xs sm:text-sm font-black tracking-wide whitespace-nowrap animate-bounce"
              >
                {activeCompanionSpec.emoji}{' '}
                {kitsuneSkillCallout ?? gameState.lastKitsuneSkillCallout}
              </div>
            )}
          </div>

          {/* Win, Lose & Pause Overlays */}
          <EndAndPauseOverlays
            theme={theme}
            layout={layout}
            level={gameState.level}
            status={gameState.status}
            score={gameState.score}
            stars={gameState.stars}
            collectProgress={gameState.collectProgress}
            glowLayersRemaining={gameState.glowLayersRemaining}
            spiritCoins={progress.spiritCoins}
            festivalFeverStreak={gameState.festivalFeverStreak}
            takeoutBentoCost={gameState.takeoutBentoCost}
            takeoutBentoPacked={takeoutBentoPacked}
            bentoSpecialsCount={gameState.filledBentoSlots.length}
            isPaused={isPaused}
            showEndDialog={showEndDialog}
            onResume={() => {
              audioService.playClick();
              setIsPaused(false);
            }}
            onRestart={handleRestartLevel}
            onNextLevel={handleNextLevel}
            onQuitToMap={handleQuitToMap}
            onNewBoard={handleNewBoard}
            onPackTakeoutBento={handlePackTakeoutBento}
            onSecondWindContinue={handleSecondWindContinue}
          />
        </section>
      )}

      {/* Level Start Dialog (Bento Preview Drawer) */}
      {previewLevelConfig && (
        <LevelStartDialog
          theme={theme}
          layout={layout}
          level={previewLevelConfig}
          bestStars={progress.bestStarsFor(previewLevelConfig.number)}
          bestScore={progress.bestScoreFor(previewLevelConfig.number)}
          totalStars={progress.totalStars}
          onPlay={(boosters) =>
            handleStartLevel(previewLevelConfig.number, boosters)
          }
          onClose={() => {
            audioService.playClick();
            setPreviewLevelNumber(null);
          }}
        />
      )}

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          theme={theme}
          layout={layout}
          allUnlocked={progress.highestUnlocked >= GameConstants.totalLevels}
          onClose={() => setShowSettings(false)}
          onResetConfirmed={() => {
            progressNotifier.resetProgress();
          }}
          onToggleUnlockAll={(unlocked) => {
            if (unlocked) {
              progressNotifier.unlockAllLevels();
            } else {
              progressNotifier.resetProgress();
            }
          }}
        />
      )}

      {/* Step 6 Part 0.4: Simple "Bonk Pop" Loading Splash while fonts and audio preload */}
      {isPreloading && (
        <div
          data-testid="loading-splash"
          style={{ background: gradientCss }}
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300"
        >
          <div
            style={{
              backgroundColor: theme.startScreen.emblemBackground,
              borderColor: theme.startScreen.emblemBorder,
              boxShadow: `0 0 28px ${theme.startScreen.titleGlowColor}`,
            }}
            className="px-8 py-6 rounded-3xl border-[3px] flex flex-col items-center gap-2"
          >
            <h1
              style={{
                fontFamily: theme.titleFontFamily,
                color: theme.startScreen.titleFillStart,
                textShadow: `0 3px 0 ${theme.startScreen.titleStrokeColor}`,
              }}
              className="text-3xl sm:text-4xl font-black tracking-wide"
            >
              {kGameTitle}
            </h1>
            <span
              style={{
                fontFamily: theme.titleFontFamily,
                color: theme.startScreen.subtitleColor,
              }}
              className="text-xs font-bold tracking-widest uppercase opacity-90"
            >
              Loading Festival...
            </span>
          </div>
        </div>
      )}
    </main>
  );
};
