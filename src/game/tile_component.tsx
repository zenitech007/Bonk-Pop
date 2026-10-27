import React, { useState } from 'react';
import { GameConstants, kTileIconRatio } from '../core/constants';
import { GameTheme, TileStyle } from '../core/theme/game_theme';
import { GridPos } from '../logic/board';
import { SpecialKind, Tile, TileShape, TileType } from '../logic/tile_type';

export type TileAnimState =
  | 'idle'
  | 'swapping'
  | 'clearing'
  | 'falling'
  | 'shuffling';

export interface TileComponentProps {
  gridPos: GridPos;
  type?: TileType;
  tileOrType?: Tile | TileType;
  theme: GameTheme;
  isSelected: boolean;
  isWiggling?: boolean;
  glowLayers?: number;
  reducedMotion?: boolean;
  animState: TileAnimState;
  offsetX: number; // in cells
  offsetY: number; // in cells
  disabled: boolean;
  onTileTap: (pos: GridPos) => void;
  onSwipeMove: (from: GridPos, to: GridPos) => void;
}

/**
 * Renders a single cute anime face (shiny dark eyes with white catchlights,
 * rosy blush ovals, and a tiny curved smile) inside the SVG coordinate space.
 */
const CuteFaceSvg: React.FC<{ cyOffset?: number; scale?: number }> = ({
  cyOffset = 0,
  scale = 1,
}) => {
  const cy = 52 + cyOffset;
  const eyeX = 13 * scale;
  const eyeR = 4.6 * scale;
  return (
    <g>
      <ellipse
        cx={50 - eyeX - 3.5}
        cy={cy + 5}
        rx={4.5 * scale}
        ry={2.6 * scale}
        fill={GameConstants.cuteBlush}
      />
      <ellipse
        cx={50 + eyeX + 3.5}
        cy={cy + 5}
        rx={4.5 * scale}
        ry={2.6 * scale}
        fill={GameConstants.cuteBlush}
      />
      <circle
        cx={50 - eyeX}
        cy={cy}
        r={eyeR}
        fill={GameConstants.cuteEyeDark}
      />
      <circle
        cx={50 + eyeX}
        cy={cy}
        r={eyeR}
        fill={GameConstants.cuteEyeDark}
      />
      <circle
        cx={50 - eyeX - 1.4}
        cy={cy - 1.5}
        r={eyeR * 0.42}
        fill={GameConstants.cuteEyeHighlight}
      />
      <circle
        cx={50 + eyeX - 1.4}
        cy={cy - 1.5}
        r={eyeR * 0.42}
        fill={GameConstants.cuteEyeHighlight}
      />
      <circle
        cx={50 - eyeX + 1.4}
        cy={cy + 1.4}
        r={eyeR * 0.2}
        fill={GameConstants.cuteEyeHighlight}
      />
      <circle
        cx={50 + eyeX + 1.4}
        cy={cy + 1.4}
        r={eyeR * 0.2}
        fill={GameConstants.cuteEyeHighlight}
      />
      <path
        d={`M ${50 - 4.2 * scale} ${cy + 3.5} Q 50 ${cy + 8.2 * scale} ${50 + 4.2 * scale} ${cy + 3.5}`}
        fill="none"
        stroke={GameConstants.cuteEyeDark}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
    </g>
  );
};

/**
 * Spirit Orb (Step 5 Part A.1):
 * Pearl-white iridescent body, glowing aura, pastel rainbow swirl arc,
 * tiny cute pink fox ears, and smiling anime face. No drop-shadow filter.
 */
const SpiritOrbSvg: React.FC = () => {
  const iconPercent = `${Math.round(kTileIconRatio * 100)}%`;
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: iconPercent, height: iconPercent }}
      className="pointer-events-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF2D6" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#FFB7C5" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#70D6FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer magical glow */}
      <circle cx="50" cy="50" r="48" fill="url(#orbGlow)" />

      {/* Cute fox ears silhouette */}
      <polygon points="26,30 18,6 40,20" fill="#FF85A1" />
      <polygon points="28,28 22,12 37,21" fill="#FFD1DC" />
      <polygon points="74,30 82,6 60,20" fill="#FF85A1" />
      <polygon points="72,28 78,12 63,21" fill="#FFD1DC" />

      {/* Pearl white core */}
      <circle
        cx="50"
        cy="52"
        r="38"
        fill="#FFFDF9"
        stroke="#FFB7C5"
        strokeWidth="3.2"
      />

      {/* Pastel rainbow swirl arc */}
      <path
        d="M 24 50 A 26 26 0 1 1 54 78"
        fill="none"
        stroke="#70D6FF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path
        d="M 28 50 A 22 22 0 1 1 50 74"
        fill="none"
        stroke="#FFB7C5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />

      {/* Highlight & cute face */}
      <ellipse
        cx="36"
        cy="36"
        rx="7"
        ry="4"
        transform="rotate(-25 36 36)"
        fill="rgba(255,255,255,0.9)"
      />
      <CuteFaceSvg cyOffset={3} scale={0.95} />
    </svg>
  );
};

/**
 * Renders 4 bold, 100% opaque alternating white + gold stripes covering ~45% of the piece area
 * (4 stripes * 9 units = 36 units across an 80-unit span = 45.0%), clipped to the piece's shape
 * via SVG `<clipPath>`. Horizontal stripes for row-clearing Slash, vertical stripes for column-clearing Slash.
 */
const ClippedSlashStripes: React.FC<{
  clipId: string;
  orientation: 'row' | 'column';
  theme: GameTheme;
}> = ({ clipId, orientation, theme }) => {
  const sp = theme.specialTile;
  // 4 stripes of thickness 9 across the 80-unit piece span (36 / 80 = 0.45 = 45% area ratio)
  const stripePositions = [16, 35, 54, 73];
  const stripeThickness = 9;
  const isRow = orientation === 'row';

  return (
    <g
      clipPath={`url(#${clipId})`}
      data-testid="slash-clipped-stripes"
      data-orientation={orientation}
      data-stripe-count={sp.slashStripeCount}
      data-stripe-area-ratio={sp.slashStripeAreaRatio}
    >
      {stripePositions.map((pos, idx) => {
        const fill = idx % 2 === 0 ? sp.slashStripeWhite : sp.slashStripeGold;
        return isRow ? (
          <rect
            key={pos}
            x="4"
            y={pos}
            width="92"
            height={stripeThickness}
            fill={fill}
            fillOpacity="1"
            stroke={sp.slashStripeOutline}
            strokeWidth="1.2"
          />
        ) : (
          <rect
            key={pos}
            x={pos}
            y="4"
            width={stripeThickness}
            height="92"
            fill={fill}
            fillOpacity="1"
            stroke={sp.slashStripeOutline}
            strokeWidth="1.2"
          />
        );
      })}
    </g>
  );
};

/**
 * Slash directional edge chevrons at the tile rim so the clear axis (row vs column)
 * reinforces the horizontal/vertical stripes even at 360x640. No drop-shadow filter.
 */
const SlashOverlaySvg: React.FC<{ orientation: 'row' | 'column' }> = ({
  orientation,
}) => {
  const isRow = orientation === 'row';
  return (
    <svg
      viewBox="0 0 100 100"
      data-testid={`slash-direction-overlay-${orientation}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {isRow ? (
        <g>
          {/* Left & Right edge chevron pointers */}
          <polygon
            points="2,50 13,41 13,59"
            fill="#FFFFFF"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="98,50 87,41 87,59"
            fill="#FFFFFF"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          {/* Top & Bottom edge chevron pointers */}
          <polygon
            points="50,2 41,13 59,13"
            fill="#FFFFFF"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="50,98 41,87 59,87"
            fill="#FFFFFF"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
};

/**
 * Burst Tile Overlay: Sparkling sakura petal ring around the tile. No drop-shadow filter.
 */
const BurstOverlaySvg: React.FC = () => {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      viewBox="0 0 100 100"
      data-testid="burst-ring-overlay"
      className="absolute inset-0 w-full h-full pointer-events-none animate-spin-slow"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeDasharray="5 4"
      />
      {petals.map((deg) => (
        <circle
          key={deg}
          cx={50 + 44 * Math.cos((deg * Math.PI) / 180)}
          cy={50 + 44 * Math.sin((deg * Math.PI) / 180)}
          r="4.8"
          fill="#FFE66D"
          stroke="#B45309"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
};

/**
 * Code-drawn vector art for each tile silhouette with soft outlines, glossy highlight,
 * optional SVG-clipped bold opaque Slash stripes (~45% of piece area), and cute face,
 * sized via `kTileIconRatio` (75% of the tile).
 */
const ThemedTileVectorArt: React.FC<{
  style: TileStyle;
  theme: GameTheme;
  clipId: string;
  slashOrientation: 'row' | 'column' | null;
}> = ({ style, theme, clipId, slashOrientation }) => {
  const iconPercent = `${Math.round(kTileIconRatio * 100)}%`;
  const sizeStyle = { width: iconPercent, height: iconPercent };

  switch (style.shape) {
    case TileShape.flower: {
      const petals = [0, 72, 144, 216, 288];
      return (
        <svg
          viewBox="8 8 84 84"
          style={sizeStyle}
          className="pointer-events-none"
          aria-hidden="true"
        >
          {slashOrientation && (
            <defs>
              <clipPath id={clipId}>
                {petals.map((deg) => (
                  <path
                    key={deg}
                    transform={`rotate(${deg} 50 50)`}
                    d="M 50 48 C 34 34, 32 11, 45 8.5 L 50 14 L 55 8.5 C 68 11, 66 34, 50 48 Z"
                  />
                ))}
                <circle cx="50" cy="50" r="18" />
              </clipPath>
            </defs>
          )}
          <g
            stroke={style.outlineColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          >
            {petals.map((deg) => (
              <path
                key={deg}
                transform={`rotate(${deg} 50 50)`}
                d="M 50 48 C 34 34, 32 11, 45 8.5 L 50 14 L 55 8.5 C 68 11, 66 34, 50 48 Z"
                fill={style.baseColor}
              />
            ))}
          </g>
          <circle cx="50" cy="50" r="18" fill={style.accentColor} />
          {slashOrientation && (
            <>
              <ClippedSlashStripes
                clipId={clipId}
                orientation={slashOrientation}
                theme={theme}
              />
              <g
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.5"
                strokeLinejoin="round"
              >
                {petals.map((deg) => (
                  <path
                    key={deg}
                    transform={`rotate(${deg} 50 50)`}
                    d="M 50 48 C 34 34, 32 11, 45 8.5 L 50 14 L 55 8.5 C 68 11, 66 34, 50 48 Z"
                  />
                ))}
              </g>
            </>
          )}
          <ellipse
            cx="40"
            cy="26"
            rx="7"
            ry="4"
            transform="rotate(-20 40 26)"
            fill="rgba(255,255,255,0.65)"
          />
          <CuteFaceSvg cyOffset={1} scale={0.95} />
        </svg>
      );
    }

    case TileShape.lantern: {
      return (
        <svg
          viewBox="9 8 82 84"
          style={sizeStyle}
          className="pointer-events-none"
          aria-hidden="true"
        >
          {slashOrientation && (
            <defs>
              <clipPath id={clipId}>
                <rect x="31" y="13" width="38" height="9" rx="3.5" />
                <rect x="33" y="78" width="34" height="8.5" rx="3.5" />
                <rect x="14" y="20" width="72" height="60" rx="29" />
              </clipPath>
            </defs>
          )}
          <circle
            cx="50"
            cy="11"
            r="3.8"
            fill="none"
            stroke={style.accentColor}
            strokeWidth="3"
          />
          <rect
            x="31"
            y="13"
            width="38"
            height="9"
            rx="3.5"
            fill={style.accentColor}
            stroke={style.outlineColor}
            strokeWidth="3"
          />
          <rect
            x="33"
            y="78"
            width="34"
            height="8.5"
            rx="3.5"
            fill={style.accentColor}
            stroke={style.outlineColor}
            strokeWidth="3"
          />
          <rect
            x="14"
            y="20"
            width="72"
            height="60"
            rx="29"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="3.8"
          />
          <path
            d="M 20 38 Q 50 43 80 38 M 20 62 Q 50 67 80 62"
            fill="none"
            stroke={style.outlineColor}
            strokeOpacity="0.35"
            strokeWidth="2.2"
          />
          {slashOrientation && (
            <>
              <ClippedSlashStripes
                clipId={clipId}
                orientation={slashOrientation}
                theme={theme}
              />
              <rect
                x="14"
                y="20"
                width="72"
                height="60"
                rx="29"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.8"
              />
            </>
          )}
          <ellipse
            cx="34"
            cy="33"
            rx="9"
            ry="5"
            transform="rotate(-22 34 33)"
            fill="rgba(255,255,255,0.6)"
          />
          <CuteFaceSvg cyOffset={0} scale={1.0} />
        </svg>
      );
    }

    case TileShape.triangle: {
      return (
        <svg
          viewBox="9 9 82 82"
          style={sizeStyle}
          className="pointer-events-none"
          aria-hidden="true"
        >
          {slashOrientation && (
            <defs>
              <clipPath id={clipId}>
                <path d="M 50 11 C 63 11, 90 62, 86 77 C 82 88, 18 88, 14 77 C 10 62, 37 11, 50 11 Z" />
              </clipPath>
            </defs>
          )}
          <path
            d="M 50 11 C 63 11, 90 62, 86 77 C 82 88, 18 88, 14 77 C 10 62, 37 11, 50 11 Z"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <rect
            x="32"
            y="60"
            width="36"
            height="25"
            rx="4"
            fill={style.accentColor}
            stroke={style.outlineColor}
            strokeWidth="3"
          />
          {slashOrientation && (
            <>
              <ClippedSlashStripes
                clipId={clipId}
                orientation={slashOrientation}
                theme={theme}
              />
              <path
                d="M 50 11 C 63 11, 90 62, 86 77 C 82 88, 18 88, 14 77 C 10 62, 37 11, 50 11 Z"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.8"
                strokeLinejoin="round"
              />
            </>
          )}
          <ellipse
            cx="43"
            cy="28"
            rx="7"
            ry="4"
            transform="rotate(-30 43 28)"
            fill="rgba(255,255,255,0.85)"
          />
          <CuteFaceSvg cyOffset={-4} scale={0.92} />
        </svg>
      );
    }

    case TileShape.skewer: {
      return (
        <svg
          viewBox="9 9 82 82"
          style={sizeStyle}
          className="pointer-events-none"
          aria-hidden="true"
        >
          {slashOrientation && (
            <defs>
              <clipPath id={clipId}>
                <circle cx="29" cy="71" r="17" />
                <circle cx="50" cy="50" r="18" />
                <circle cx="71" cy="29" r="17" />
              </clipPath>
            </defs>
          )}
          <line
            x1="13"
            y1="87"
            x2="87"
            y2="13"
            stroke="#B07D4F"
            strokeWidth="5.8"
            strokeLinecap="round"
          />
          <circle
            cx="29"
            cy="71"
            r="17"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="3.4"
          />
          <circle
            cx="50"
            cy="50"
            r="18"
            fill="#FFFDF9"
            stroke={style.outlineColor}
            strokeWidth="3.4"
          />
          <circle
            cx="71"
            cy="29"
            r="17"
            fill={style.accentColor}
            stroke={style.outlineColor}
            strokeWidth="3.4"
          />
          {slashOrientation && (
            <>
              <ClippedSlashStripes
                clipId={clipId}
                orientation={slashOrientation}
                theme={theme}
              />
              <circle
                cx="29"
                cy="71"
                r="17"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.4"
              />
              <circle
                cx="50"
                cy="50"
                r="18"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.4"
              />
              <circle
                cx="71"
                cy="29"
                r="17"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.4"
              />
            </>
          )}
          <ellipse
            cx="65"
            cy="23"
            rx="5.5"
            ry="3.2"
            transform="rotate(-25 65 23)"
            fill="rgba(255,255,255,0.7)"
          />
          <ellipse
            cx="44"
            cy="43"
            rx="5.5"
            ry="3.2"
            transform="rotate(-25 44 43)"
            fill="rgba(255,255,255,0.85)"
          />
          <ellipse
            cx="24"
            cy="64"
            rx="5.5"
            ry="3.2"
            transform="rotate(-25 24 64)"
            fill="rgba(255,255,255,0.65)"
          />
          <CuteFaceSvg cyOffset={-1} scale={0.78} />
        </svg>
      );
    }

    case TileShape.mask: {
      return (
        <svg
          viewBox="10 10 80 80"
          style={sizeStyle}
          className="pointer-events-none"
          aria-hidden="true"
        >
          {slashOrientation && (
            <defs>
              <clipPath id={clipId}>
                <path d="M 19 12 L 38 29 L 62 29 L 81 12 L 86 54 L 50 88 L 14 54 Z" />
              </clipPath>
            </defs>
          )}
          <path
            d="M 19 12 L 38 29 L 62 29 L 81 12 L 86 54 L 50 88 L 14 54 Z"
            fill={style.baseColor}
            stroke={style.outlineColor}
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <polygon points="23,21 35,31 22,38" fill={style.accentColor} />
          <polygon points="77,21 65,31 78,38" fill={style.accentColor} />
          <path
            d="M 50 33 L 54 41 L 50 45 L 46 41 Z"
            fill={style.accentColor}
          />
          {slashOrientation && (
            <>
              <ClippedSlashStripes
                clipId={clipId}
                orientation={slashOrientation}
                theme={theme}
              />
              <path
                d="M 19 12 L 38 29 L 62 29 L 81 12 L 86 54 L 50 88 L 14 54 Z"
                fill="none"
                stroke={style.outlineColor}
                strokeWidth="3.8"
                strokeLinejoin="round"
              />
            </>
          )}
          <ellipse
            cx="35"
            cy="40"
            rx="7"
            ry="4"
            transform="rotate(-20 35 40)"
            fill="rgba(255,255,255,0.6)"
          />
          <CuteFaceSvg cyOffset={5} scale={0.95} />
        </svg>
      );
    }
  }
};

/**
 * Renders one tile on the board with its inner icon filling `kTileIconRatio` (75%) of the tile,
 * plus special overlays (bold opaque SVG-clipped Slash stripes, burst petal ring, spirit orb),
 * gold-pink gradient background + bright 2px border on special tiles, and a 1.8s shine sweep
 * disabled under reducedMotion.
 */
const TileComponentInner: React.FC<TileComponentProps> = ({
  gridPos,
  type: propType,
  tileOrType,
  theme,
  isSelected,
  isWiggling = false,
  glowLayers = 0,
  reducedMotion = false,
  animState,
  offsetX,
  offsetY,
  disabled,
  onTileTap,
  onSwipeMove,
}) => {
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const swipedRef = React.useRef(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);

  // Normalize tile or type
  const tile: Tile =
    tileOrType instanceof Tile
      ? tileOrType
      : typeof tileOrType === 'string'
        ? Tile.normal(tileOrType)
        : propType
          ? Tile.normal(propType)
          : Tile.normal(TileType.sakura);

  const tileType = tile.type;
  const isOrb = tile.isOrb;
  const isSpecial = tile.isSpecial;
  const specialKind = tile.special;
  const slashOrientation: 'row' | 'column' | null =
    specialKind === SpecialKind.slashRow
      ? 'row'
      : specialKind === SpecialKind.slashColumn
        ? 'column'
        : null;

  const style = theme.styleFor(tileType);
  const specialTheme = theme.specialTile;
  const iconPercent = `${Math.round(kTileIconRatio * 100)}%`;
  const clipId = `tile-shape-clip-${gridPos.row}-${gridPos.col}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !pointerStartRef.current || swipedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const threshold = rect.width * GameConstants.swipeThresholdFraction;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (Math.hypot(dx, dy) < threshold) return;

    swipedRef.current = true;
    pointerStartRef.current = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      const target = new GridPos(gridPos.row, gridPos.col + (dx > 0 ? 1 : -1));
      onSwipeMove(gridPos, target);
    } else {
      const target = new GridPos(gridPos.row + (dy > 0 ? 1 : -1), gridPos.col);
      onSwipeMove(gridPos, target);
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
  };

  const handleClick = () => {
    if (disabled) return;
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    onTileTap(gridPos);
  };

  // Elemental Twilight Glassmorphic Backing Plates for standard tiles;
  // Special tiles get a vibrant diagonal gold-pink gradient background and a brighter 2px border
  // plus an animated aura ring and distinct corner badge.
  const elementalPlateGradient = `linear-gradient(145deg, ${style.plateGradientStart} 0%, ${style.plateGradientEnd} 100%)`;
  const backgroundStyle = isSelected
    ? `linear-gradient(145deg, ${style.plateGradientEnd} 0%, ${style.plateBorderColor} 140%)`
    : isSpecial
      ? `linear-gradient(135deg, ${specialTheme.cardGradientStart} 0%, ${specialTheme.cardGradientMid} 52%, ${specialTheme.cardGradientEnd} 100%)`
      : elementalPlateGradient;

  const borderColor = isSelected
    ? GameConstants.selectionStroke
    : isSpecial
      ? specialTheme.cardBorderColor
      : style.plateBorderColor;

  // Slightly inset normal tiles sitting on a Glow Square so the pulsing cell underlay frame shines around them
  const baseIdleScale = glowLayers > 0 && !isSpecial ? 0.88 : 1.0;
  let scale = isSelected ? GameConstants.selectedTileScale : baseIdleScale;
  let opacity = 1.0;
  let durationMs: number = GameConstants.swapDurationMs;
  let easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

  if (animState === 'clearing') {
    scale = 0.08;
    opacity = 0.0;
    durationMs = GameConstants.clearDurationMs;
    easing = 'cubic-bezier(0.36, 0, 0.66, -0.56)';
  } else if (animState === 'falling') {
    durationMs = GameConstants.fallDurationMs;
    easing = 'cubic-bezier(0.34, 1.42, 0.64, 1)';
  } else if (animState === 'shuffling') {
    durationMs = GameConstants.shuffleDurationMs;
    easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
  }

  const specialLabel = isOrb
    ? 'Spirit Orb'
    : specialKind === SpecialKind.slashRow
      ? 'Row Slash'
      : specialKind === SpecialKind.slashColumn
        ? 'Column Slash'
        : specialKind === SpecialKind.burst
          ? 'Burst'
          : style.label;

  const cornerBadgeSymbol = isOrb
    ? '★'
    : specialKind === SpecialKind.slashRow
      ? '↔'
      : specialKind === SpecialKind.slashColumn
        ? '↕'
        : '✦';

  return (
    <button
      type="button"
      aria-label={`Row ${gridPos.row + 1} Column ${gridPos.col + 1} ${specialLabel}${isSelected ? ' Selected' : ''}`}
      data-testid={`tile-${gridPos.row}-${gridPos.col}`}
      data-tile-type={tileType}
      data-tile-shape={style.shape}
      data-plate-name={style.plateName}
      data-special-kind={specialKind}
      data-is-special={isSpecial ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      data-wiggling={isWiggling ? 'true' : 'false'}
      data-icon-ratio={kTileIconRatio}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      style={{
        background: backgroundStyle,
        borderColor,
        borderWidth: `${GameConstants.specialTileBorderWidthPx}px`,
        boxShadow: isSelected
          ? `0 0 0 3px ${GameConstants.selectionStroke}, inset 0 0 12px ${style.plateInnerGlowColor}, 0 4px 12px rgba(0,0,0,0.45)`
          : isSpecial
            ? '0 0 0 1.5px rgba(255, 209, 102, 0.85), inset 0 0 8px rgba(255, 255, 255, 0.72), 0 3px 8px rgba(35, 21, 48, 0.45)'
            : `inset 0 0 10px ${style.plateInnerGlowColor}, 0 2px 6px rgba(15, 8, 24, 0.45)`,
        opacity,
        transform: `translate3d(${offsetX * 100}%, ${offsetY * 100}%, 0) scale(${scale})`,
        transition:
          offsetX !== 0 || offsetY !== 0
            ? animState === 'falling' ||
              animState === 'swapping' ||
              animState === 'shuffling'
              ? `transform ${durationMs}ms ${easing}, opacity ${durationMs}ms ease`
              : 'none'
            : `transform ${durationMs}ms ${easing}, opacity ${durationMs}ms ease`,
        zIndex:
          offsetX !== 0 || offsetY !== 0 || isSelected || animState !== 'idle'
            ? 10
            : 1,
      }}
      className={`relative flex aspect-square w-full h-full items-center justify-center overflow-hidden rounded-[22%] border-2 select-none touch-none cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        isWiggling ? 'animate-wiggle' : ''
      }`}
    >
      {/* Selected Tile Animated Glowing Focus Ring */}
      {isSelected && (
        <span
          data-testid="selected-tile-ring"
          aria-hidden="true"
          style={{
            borderColor: GameConstants.selectionStroke,
            boxShadow: `0 0 12px ${GameConstants.selectionStroke}, inset 0 0 8px ${GameConstants.selectionStroke}`,
          }}
          className="pointer-events-none absolute inset-[3%] z-25 rounded-[19%] border-2 animate-pulse"
        />
      )}

      {/* Special Tile Animated Aura Ring & Distinct Corner Badge */}
      {isSpecial && (
        <>
          <span
            data-testid="special-tile-aura-ring"
            aria-hidden="true"
            style={{
              borderColor: '#FFF3B0',
              boxShadow: 'inset 0 0 8px rgba(255, 243, 176, 0.85)',
            }}
            className={`pointer-events-none absolute inset-[3%] z-15 rounded-[19%] border-2 border-dashed ${
              reducedMotion ? '' : 'animate-pulse'
            }`}
          />
          <span
            data-testid="special-tile-corner-badge"
            data-special-badge={specialKind}
            aria-hidden="true"
            style={{
              backgroundColor: '#23122E',
              borderColor: '#FFD166',
              color: '#FFF3B0',
            }}
            className="pointer-events-none absolute top-[4%] right-[4%] z-25 w-[28%] h-[28%] min-w-[11px] min-h-[11px] rounded-full border flex items-center justify-center text-[9px] font-black leading-none shadow"
          >
            {cornerBadgeSymbol}
          </span>
        </>
      )}

      {/* Gentle shine sweep every ~1.8s on special tiles (disabled under reducedMotion) */}
      {isSpecial && !reducedMotion && (
        <span
          data-testid={`special-shine-${gridPos.row}-${gridPos.col}`}
          aria-hidden="true"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${specialTheme.shineSweepColor} 50%, transparent 100%)`,
            animationDuration: `${specialTheme.shineSweepDurationMs}ms`,
          }}
          className="pointer-events-none absolute -inset-[40%] z-20 w-[55%] h-[180%] animate-special-shine"
        />
      )}

      {isOrb ? (
        <SpiritOrbSvg />
      ) : (
        <>
          {style.spriteAssetPath && !slashOrientation && (
            <img
              src={`/${style.spriteAssetPath}`}
              alt={style.label}
              referrerPolicy="no-referrer"
              onLoad={() => setSpriteLoaded(true)}
              onError={() => setSpriteLoaded(false)}
              style={{ width: iconPercent, height: iconPercent }}
              className={
                spriteLoaded ? 'object-contain pointer-events-none' : 'hidden'
              }
            />
          )}
          {(!spriteLoaded || slashOrientation !== null) && (
            <ThemedTileVectorArt
              style={style}
              theme={theme}
              clipId={clipId}
              slashOrientation={slashOrientation}
            />
          )}

          {/* Special overlays */}
          {specialKind === SpecialKind.slashRow && (
            <SlashOverlaySvg orientation="row" />
          )}
          {specialKind === SpecialKind.slashColumn && (
            <SlashOverlaySvg orientation="column" />
          )}
          {specialKind === SpecialKind.burst && <BurstOverlaySvg />}
        </>
      )}
    </button>
  );
};

export const TileComponent = React.memo(
  TileComponentInner,
  (prev, next) =>
    prev.gridPos.row === next.gridPos.row &&
    prev.gridPos.col === next.gridPos.col &&
    prev.tileOrType === next.tileOrType &&
    prev.type === next.type &&
    prev.isSelected === next.isSelected &&
    prev.isWiggling === next.isWiggling &&
    prev.glowLayers === next.glowLayers &&
    prev.reducedMotion === next.reducedMotion &&
    prev.animState === next.animState &&
    prev.offsetX === next.offsetX &&
    prev.offsetY === next.offsetY &&
    prev.disabled === next.disabled &&
    prev.theme === next.theme
);
