import React from 'react';
import { GameTheme } from '../core/theme/game_theme';
import { Board, GridPos } from '../logic/board';
import { MatchFinder } from '../logic/match_finder';
import { TileType } from '../logic/tile_type';
import { TileAnimState, TileComponent } from './tile_component';

export interface BurstParticle {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly dx: number;
  readonly dy: number;
  readonly color: string;
}

export interface FloatingScorePopup {
  readonly id: number;
  readonly text: string;
  readonly row: number;
  readonly col: number;
  readonly scale: number;
}

export interface WaveVisualEffect {
  readonly id: number;
  readonly kind: 'slashRow' | 'slashColumn' | 'burst' | 'orb';
  readonly row: number;
  readonly col: number;
}

export interface BoardComponentProps {
  board: Board;
  theme: GameTheme;
  boardSizePx: number;
  uiScale: number;
  selectedPos: GridPos | null;
  isBusy: boolean;
  tileStates: Record<string, TileAnimState>;
  tileOffsets: Record<string, { x: number; y: number }>;
  burstParticles: BurstParticle[];
  floatingScores: FloatingScorePopup[];
  centerPopup: { text: string; scale: number } | null;
  cascadeComboBanner?: { text: string; cascadeDepth: number } | null;
  elementalPowerCallout?: string | null;
  hintPositions?: GridPos[];
  waveEffects?: WaveVisualEffect[];
  screenShakeOffset?: { x: number; y: number };
  isShaking?: boolean;
  glowRemainingGrid?: readonly (readonly number[])[];
  shimmeringGlowKeys?: ReadonlySet<string>;
  reducedMotion?: boolean;
  onSelectPos: (pos: GridPos | null) => void;
  onSwapCells: (a: GridPos, b: GridPos) => void;
  onSpecialInteractionTap?: (pos: GridPos) => boolean;
}

/**
 * Draws the rounded glowing 8x8 board container sized to exact `boardSizePx` from `LayoutSpec`,
 * clips falling refill tiles to the board area, renders cell-bound 1-layer and 2-layer glow squares,
 * special tile blast waves, petal bursts, rising score popups, and handles idle hint wiggling and screen shake.
 */
export const BoardComponent: React.FC<BoardComponentProps> = ({
  board,
  theme,
  boardSizePx,
  uiScale,
  selectedPos,
  isBusy,
  tileStates,
  tileOffsets,
  burstParticles,
  floatingScores,
  centerPopup,
  cascadeComboBanner = null,
  elementalPowerCallout = null,
  hintPositions = [],
  waveEffects = [],
  screenShakeOffset = { x: 0, y: 0 },
  isShaking = false,
  glowRemainingGrid,
  shimmeringGlowKeys,
  reducedMotion = false,
  onSelectPos,
  onSwapCells,
  onSpecialInteractionTap,
}) => {
  const handleTileTap = (tappedPos: GridPos) => {
    if (isBusy) return;

    if (onSpecialInteractionTap && onSpecialInteractionTap(tappedPos)) {
      return;
    }

    if (!selectedPos) {
      onSelectPos(tappedPos);
    } else if (selectedPos.equals(tappedPos)) {
      onSelectPos(null);
    } else if (board.areAdjacent(selectedPos, tappedPos)) {
      const from = selectedPos;
      onSelectPos(null);
      onSwapCells(from, tappedPos);
    } else {
      onSelectPos(tappedPos);
    }
  };

  const handleSwipeMove = (from: GridPos, to: GridPos) => {
    if (isBusy) return;
    if (board.isBounds(to) && board.areAdjacent(from, to)) {
      onSelectPos(null);
      onSwapCells(from, to);
    }
  };

  const hintKeys = new Set(hintPositions.map((p) => p.key));
  const glowStyle = theme.glowCell;

  const cells: React.ReactNode[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      const pos = new GridPos(row, col);
      const key = pos.key;
      const tile = board.tileAt(row, col);
      const type: TileType = tile?.type ?? TileType.sakura;
      const tileStyle = theme.styleFor(type);
      const offset = tileOffsets[key] ?? { x: 0, y: 0 };
      const animState = tileStates[key] ?? 'idle';
      const isWiggling = hintKeys.has(key) && !isBusy && selectedPos === null;
      const glowLayers = glowRemainingGrid?.[row]?.[col] ?? 0;
      const isShimmering = shimmeringGlowKeys?.has(key) ?? false;
      const blocker = board.blockerAt(row, col);

      cells.push(
        <div
          key={key}
          data-testid={`board-cell-${row}-${col}`}
          data-cell-id={`cell-${row}-${col}`}
          data-tile-type={type}
          data-plate-name={tileStyle.plateName}
          data-glow-layers={glowLayers}
          data-blocker-type={blocker?.type ?? ''}
          data-blocker-layers={blocker?.layers ?? 0}
          className="relative w-full h-full aspect-square flex items-center justify-center"
        >
          {/* Cell-bound Glow Square Underlay (1 or 2 layers) */}
          {glowLayers > 0 && (
            <div
              data-testid={`glow-underlay-${row}-${col}`}
              data-layers={glowLayers}
              style={{
                background:
                  glowLayers >= 2
                    ? `linear-gradient(135deg, ${glowStyle.layer2Fill}, ${glowStyle.layer2GradientEnd})`
                    : `linear-gradient(135deg, ${glowStyle.layer1Fill}, ${glowStyle.layer1GradientEnd})`,
                borderColor:
                  glowLayers >= 2
                    ? glowStyle.layer2OuterBorder
                    : glowStyle.layer1Border,
                boxShadow:
                  glowLayers >= 2
                    ? `0 0 12px ${glowStyle.layer2Shadow}, inset 0 0 10px ${glowStyle.layer2Shadow}`
                    : `0 0 8px ${glowStyle.layer1Shadow}, inset 0 0 6px ${glowStyle.layer1Shadow}`,
              }}
              className={`pointer-events-none absolute -inset-[3%] z-0 rounded-[24%] border-2 ${
                !reducedMotion && glowLayers === 1 ? 'animate-pulse' : ''
              }`}
            >
              {glowLayers >= 2 && (
                <span
                  data-testid={`glow-double-border-${row}-${col}`}
                  style={{
                    borderColor: glowStyle.layer2InnerBorder,
                    boxShadow: `inset 0 0 6px ${glowStyle.layer2Shadow}`,
                  }}
                  className="pointer-events-none absolute inset-[9%] rounded-[18%] border-2"
                />
              )}
            </div>
          )}

          {/* Glow Layer Removal Shimmer & Small Stars (or simple fade in reduced motion) */}
          {isShimmering && (
            <div
              data-testid={`glow-shimmer-${row}-${col}`}
              style={{
                background: `radial-gradient(circle, ${glowStyle.shimmerStarColor} 0%, ${glowStyle.layer2Fill} 60%, transparent 100%)`,
              }}
              className={`pointer-events-none absolute -inset-[6%] z-20 rounded-[24%] ${
                reducedMotion
                  ? 'opacity-45 transition-opacity duration-200'
                  : 'animate-ping opacity-80'
              }`}
            >
              {!reducedMotion && (
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full overflow-visible"
                  aria-hidden="true"
                >
                  {[
                    { cx: 16, cy: 18, r: 10 },
                    { cx: 84, cy: 16, r: 9 },
                    { cx: 18, cy: 84, r: 9 },
                    { cx: 82, cy: 82, r: 10 },
                  ].map((st, idx) => (
                    <path
                      key={idx}
                      transform={`translate(${st.cx}, ${st.cy}) scale(${st.r / 10})`}
                      d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z"
                      fill={glowStyle.shimmerStarColor}
                    />
                  ))}
                </svg>
              )}
            </div>
          )}

          <TileComponent
            gridPos={pos}
            type={type}
            tileOrType={tile ?? type}
            theme={theme}
            isSelected={selectedPos?.equals(pos) ?? false}
            isWiggling={isWiggling}
            glowLayers={glowLayers}
            reducedMotion={reducedMotion}
            animState={animState}
            offsetX={offset.x}
            offsetY={offset.y}
            disabled={isBusy}
            onTileTap={handleTileTap}
            onSwipeMove={handleSwipeMove}
          />

          {/* Phase 5 Custom Festival Blocker Overlays */}
          {blocker && blocker.type === 'paper_lantern' && blocker.layers > 0 && (
            <div
              data-testid={`blocker-paper_lantern-${row}-${col}`}
              data-layers={blocker.layers}
              style={{
                background:
                  'radial-gradient(circle, rgba(255, 77, 109, 0.35) 0%, rgba(180, 24, 58, 0.58) 100%)',
                borderColor: '#FFE066',
                boxShadow: '0 0 10px rgba(255, 209, 102, 0.65)',
              }}
              className="pointer-events-none absolute inset-[2%] z-25 rounded-[22%] border-2 flex items-center justify-center"
            >
              <span
                style={{
                  backgroundColor: '#2B0918',
                  borderColor: '#FFE066',
                  color: '#FFF3B0',
                }}
                className="absolute -top-1 -right-1 px-1 rounded-full border text-[9px] font-black leading-tight"
              >
                🏮{blocker.layers}
              </span>
            </div>
          )}

          {blocker && blocker.type === 'sugar_mold' && blocker.layers > 0 && (
            <div
              data-testid={`blocker-sugar_mold-${row}-${col}`}
              data-layers={blocker.layers}
              data-sides-hit={Array.from(blocker.sidesHit).join(',')}
              style={{
                background:
                  'linear-gradient(135deg, rgba(255, 235, 179, 0.28) 0%, rgba(255, 158, 187, 0.36) 100%)',
                borderColor: '#FFD166',
                boxShadow: 'inset 0 0 8px rgba(255, 224, 102, 0.6)',
              }}
              className="pointer-events-none absolute inset-0 z-25 rounded-[18%] border-2 flex items-end justify-end p-0.5"
            >
              {row === blocker.row && col === blocker.col && (
                <span
                  style={{
                    backgroundColor: '#3A1830',
                    borderColor: '#FFD166',
                    color: '#FFE066',
                  }}
                  className="px-1 rounded-full border text-[8px] font-black leading-tight"
                >
                  🍬{blocker.layers}/4
                </span>
              )}
            </div>
          )}

          {blocker && blocker.type === 'torii_gate' && (
            <div
              data-testid={`blocker-torii_gate-${row}-${col}`}
              data-cleansed={blocker.cleansed ? 'true' : 'false'}
              style={{
                borderColor: blocker.cleansed ? '#4CC9F0' : '#FF3B6B',
                background: blocker.cleansed
                  ? 'linear-gradient(180deg, rgba(76, 201, 240, 0.35) 0%, transparent 65%)'
                  : 'linear-gradient(180deg, rgba(255, 59, 107, 0.48) 0%, rgba(88, 28, 135, 0.28) 75%)',
              }}
              className="pointer-events-none absolute inset-0 z-25 rounded-[20%] border-t-4 flex items-start justify-center"
            >
              <span
                style={{
                  backgroundColor: blocker.cleansed ? '#0F2942' : '#3B0A26',
                  borderColor: blocker.cleansed ? '#4CC9F0' : '#FF85A1',
                  color: blocker.cleansed ? '#A5F3FC' : '#FFE5EC',
                }}
                className=" -mt-1.5 px-1 rounded-full border text-[8px] font-black leading-tight"
              >
                ⛩️
              </span>
            </div>
          )}

          {blocker && blocker.type === 'slate_curse' && blocker.layers > 0 && (
            <div
              data-testid={`blocker-slate_curse-${row}-${col}`}
              style={{
                background:
                  'linear-gradient(145deg, rgba(51, 65, 85, 0.86) 0%, rgba(30, 41, 59, 0.92) 100%)',
                borderColor: '#94A3B8',
                boxShadow: 'inset 0 2px 6px rgba(15, 23, 42, 0.85)',
              }}
              className="pointer-events-none absolute inset-[3%] z-25 rounded-[20%] border-2 flex items-center justify-center"
            >
              <span className="text-[10px] font-black text-slate-200 drop-shadow">
                🪨
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  const validMove = Board.findPossibleMove(board);
  const frame = theme.boardFrame;
  const hud = theme.hud;
  const padPx = Math.max(4, Math.round(boardSizePx * 0.018));
  const gapPx = Math.max(2, Math.round(boardSizePx * 0.011));
  const cellSizePx = (boardSizePx - padPx * 2 - gapPx * 7) / 8;

  const shakingActive =
    isShaking || screenShakeOffset.x !== 0 || screenShakeOffset.y !== 0;

  return (
    <div
      data-testid="board-shake-wrapper"
      data-shaking={shakingActive ? 'true' : 'false'}
      style={{
        transform: `translate3d(${screenShakeOffset.x}px, ${screenShakeOffset.y}px, 0)`,
        transition: 'transform 45ms ease-out',
      }}
      className="relative shrink-0 flex items-center justify-center"
    >
      {/* Dynamic Floating Matsuri Combo Banner above the board */}
      {cascadeComboBanner && (
        <div
          data-testid="cascade-combo-banner"
          data-cascade-depth={cascadeComboBanner.cascadeDepth}
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 77, 121, 0.96) 0%, rgba(116, 36, 98, 0.96) 55%, rgba(255, 209, 102, 0.96) 100%)',
            borderColor: '#FFF3B0',
            color: '#FFFDF9',
            fontFamily: theme.titleFontFamily,
            boxShadow:
              '0 0 22px rgba(255, 209, 102, 0.78), 0 6px 16px rgba(15, 8, 24, 0.65)',
          }}
          className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-45 px-4 py-1 rounded-full border-2 font-black text-xs sm:text-sm tracking-wide whitespace-nowrap animate-bounce"
        >
          {cascadeComboBanner.text}
        </div>
      )}

      {/* Sleek Floating Elemental Signature Callout Badge above the board */}
      {elementalPowerCallout && (
        <div
          data-testid="elemental-power-callout"
          data-power-text={elementalPowerCallout}
          style={{
            background:
              'linear-gradient(135deg, rgba(16, 48, 86, 0.96) 0%, rgba(88, 28, 92, 0.96) 55%, rgba(255, 196, 86, 0.96) 100%)',
            borderColor: '#4CC9F0',
            color: '#FFFDF9',
            fontFamily: theme.titleFontFamily,
            boxShadow:
              '0 0 20px rgba(76, 201, 240, 0.85), 0 6px 16px rgba(12, 8, 24, 0.7)',
          }}
          className={`pointer-events-none absolute ${
            cascadeComboBanner ? 'top-10' : 'top-2'
          } left-1/2 -translate-x-1/2 z-46 px-3.5 py-1 rounded-full border-2 font-black text-xs sm:text-sm tracking-wide whitespace-nowrap animate-chest-pop`}
        >
          ✨ {elementalPowerCallout}
        </div>
      )}

      <div
        data-testid="board-grid"
        data-shaking={shakingActive ? 'true' : 'false'}
        data-busy={isBusy ? 'true' : 'false'}
        data-board-size={Math.round(boardSizePx)}
        data-valid-swap={
          validMove ? `${validMove[0].key}:${validMove[1].key}` : ''
        }
        style={{
          width: `${boardSizePx}px`,
          height: `${boardSizePx}px`,
          padding: `${padPx}px`,
          gap: `${gapPx}px`,
          backgroundColor: frame.backgroundColor,
          borderColor: frame.borderColor,
          borderRadius: `${Math.round(frame.cornerRadius * Math.min(1.15, uiScale))}px`,
          boxShadow: `0 0 ${frame.glowBlurRadius}px ${frame.glowColor}, inset 0 0 14px rgba(255, 183, 197, 0.14)`,
        }}
        className="relative border-2 overflow-hidden grid grid-cols-8 grid-rows-8 shrink-0 select-none touch-none"
      >
        {cells}

        {/* Special Activation Wave Visual Effects (Slash Beams, Burst Rings, Orb Sparks) */}
        {waveEffects.map((wave) => {
          const topPx = padPx + wave.row * (cellSizePx + gapPx) + cellSizePx / 2;
          const leftPx = padPx + wave.col * (cellSizePx + gapPx) + cellSizePx / 2;

          if (wave.kind === 'slashRow') {
            return (
              <div
                key={wave.id}
                style={{
                  top: `${topPx}px`,
                  left: 0,
                  right: 0,
                  height: `${cellSizePx * 0.9}px`,
                  transform: 'translateY(-50%)',
                  background:
                    'linear-gradient(90deg, rgba(255,230,109,0) 0%, rgba(255,244,204,0.9) 50%, rgba(255,230,109,0) 100%)',
                  boxShadow: '0 0 16px rgba(255, 230, 109, 0.9)',
                }}
                className="pointer-events-none absolute z-25 animate-pulse rounded-full"
              />
            );
          }

          if (wave.kind === 'slashColumn') {
            return (
              <div
                key={wave.id}
                style={{
                  left: `${leftPx}px`,
                  top: 0,
                  bottom: 0,
                  width: `${cellSizePx * 0.9}px`,
                  transform: 'translateX(-50%)',
                  background:
                    'linear-gradient(180deg, rgba(255,230,109,0) 0%, rgba(255,244,204,0.9) 50%, rgba(255,230,109,0) 100%)',
                  boxShadow: '0 0 16px rgba(255, 230, 109, 0.9)',
                }}
                className="pointer-events-none absolute z-25 animate-pulse rounded-full"
              />
            );
          }

          if (wave.kind === 'burst') {
            return (
              <div
                key={wave.id}
                style={{
                  top: `${topPx}px`,
                  left: `${leftPx}px`,
                  width: `${cellSizePx * 2.8}px`,
                  height: `${cellSizePx * 2.8}px`,
                  transform: 'translate(-50%, -50%)',
                  border: '4px solid #FFE66D',
                  boxShadow:
                    '0 0 24px #FFB7C5, inset 0 0 16px rgba(255, 230, 109, 0.6)',
                  backgroundColor: 'rgba(255, 183, 197, 0.25)',
                }}
                className="pointer-events-none absolute z-25 rounded-full animate-ping"
              />
            );
          }

          if (wave.kind === 'orb') {
            return (
              <div
                key={wave.id}
                style={{
                  top: `${topPx}px`,
                  left: `${leftPx}px`,
                  width: `${boardSizePx * 0.9}px`,
                  height: `${boardSizePx * 0.9}px`,
                  transform: 'translate(-50%, -50%)',
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(112,214,255,0.4) 45%, rgba(255,183,197,0) 75%)',
                  boxShadow: '0 0 35px rgba(255, 255, 255, 0.9)',
                }}
                className="pointer-events-none absolute z-25 rounded-full animate-pulse"
              />
            );
          }

          return null;
        })}

        {/* Clear Petal / Sparkle Burst Layer */}
        {burstParticles.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {burstParticles.map((p) => {
              const leftPct = ((p.col + 0.5) / board.size) * 100;
              const topPct = ((p.row + 0.5) / board.size) * 100;
              return (
                <span
                  key={p.id}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    backgroundColor: p.color,
                    transform: `translate3d(${p.dx}px, ${p.dy}px, 0) rotate(${p.dx * 3}deg)`,
                    transition:
                      'transform 240ms ease-out, opacity 240ms ease-out',
                  }}
                  className="absolute w-3 h-2 rounded-full opacity-90 shadow-sm"
                />
              );
            })}
          </div>
        )}

        {/* Rising Floating Score Popups ("+180", "+360") at the centre of cleared groups */}
        {floatingScores.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            {floatingScores.map((fs) => {
              const leftPct = ((fs.col + 0.5) / board.size) * 100;
              const topPct = ((fs.row + 0.5) / board.size) * 100;
              return (
                <span
                  key={fs.id}
                  data-testid="floating-score-popup"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    fontFamily: theme.numberFontFamily,
                    color: hud.textPrimary,
                    fontSize: `${Math.round(18 * fs.scale * uiScale)}px`,
                    textShadow: `0 2px 8px ${frame.backgroundColor}, 0 0 4px ${theme.bannerStripe.stripePrimary}`,
                  }}
                  className="floating-score-rise absolute -translate-x-1/2 -translate-y-1/2 font-extrabold whitespace-nowrap"
                >
                  {fs.text}
                </span>
              );
            })}
          </div>
        )}

        {/* Big Japanese Cascade Combo Word banner ("Nice!", "Sugoi!", "Kami-sama!") */}
        {centerPopup && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <span
              data-testid="combo-word-banner"
              style={{
                fontFamily: theme.titleFontFamily,
                transform: `scale(${centerPopup.scale})`,
                color: theme.bannerStripe.textColor,
                textShadow: `0 3px 0 ${frame.borderColor}, 0 0 16px ${theme.bannerStripe.stripePrimary}`,
                fontSize: `${Math.round(36 * uiScale)}px`,
              }}
              className="font-black tracking-wider animate-bounce select-none"
            >
              {centerPopup.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
