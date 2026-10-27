import React, { useState } from 'react';
import { Play, Settings, Sparkles } from 'lucide-react';
import { GameConstants, kGameTitle } from '../core/constants';
import { LayoutMode, LayoutSpec } from '../core/layout/screen_layout';
import { GameTheme } from '../core/theme/game_theme';

export interface StartScreenProps {
  readonly theme: GameTheme;
  readonly layout: LayoutSpec;
  readonly totalStars: number;
  readonly maxStars: number;
  readonly onPlay: () => void;
  readonly onOpenSettings: () => void;
}

/**
 * Step 4 Part A.1: Start screen for "Bonk Pop".
 * - Shows "Bonk Pop" title in rounded anime style with chunky outline, drop shadow,
 *   and squash-and-stretch bonk bounce on appear.
 * - Shows code-drawn Kitsune mascot bobbing gently; tapping plays a playful "head bonk"
 *   squash animation with little stars.
 * - Big glossy "Play" button that opens the Level Map.
 * - Small "Settings" gear button in the top-right corner.
 * - Adapts to Portrait (stacked in centred contentColumn) and Landscape (title + mascot left, Play right).
 */
export const StartScreen: React.FC<StartScreenProps> = ({
  theme,
  layout,
  totalStars,
  maxStars,
  onPlay,
  onOpenSettings,
}) => {
  const [bonkAnimKey, setBonkAnimKey] = useState(0);
  const [bonkCount, setBonkCount] = useState(0);

  const hud = theme.hud;
  const starIcon = theme.starIcon;
  const mascot = theme.mascot;
  const startStyle = theme.startScreen;
  const btn = theme.buttonStyle;
  const scale = layout.uiScale;
  const isLandscape = layout.mode === LayoutMode.landscape;

  const handleMascotBonk = () => {
    setBonkCount((c) => c + 1);
    setBonkAnimKey((k) => k + 1);
  };

  const titleAndMascot = (
    <div className="flex flex-col items-center text-center">
      <div
        style={{
          backgroundColor: startStyle.emblemBackground,
          borderColor: startStyle.emblemBorder,
          color: startStyle.subtitleColor,
          fontSize: `${Math.round(11 * scale)}px`,
        }}
        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl border font-extrabold uppercase tracking-widest mb-2.5 shadow-md"
      >
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Sakura Festival Match-3</span>
      </div>

      {/* Game Title "Bonk Pop" with squash-and-stretch bonk bounce on appear */}
      <h1
        data-testid="start-game-title"
        style={{
          fontFamily: theme.titleFontFamily,
          color: startStyle.titleFillStart,
          fontSize: `${Math.round(52 * scale)}px`,
          textShadow: `0 4px 0 ${startStyle.titleStrokeColor}, 0 8px 20px rgba(0,0,0,0.55), 0 0 18px ${startStyle.titleGlowColor}`,
          WebkitTextStroke: `2px ${startStyle.titleStrokeColor}`,
        }}
        className="font-black tracking-wide leading-none select-none animate-title-bonk"
      >
        {kGameTitle}
      </h1>

      {/* Interactive Kitsune Mascot with gentle float + tap head-bonk */}
      <button
        type="button"
        data-testid="start-mascot-button"
        aria-label="Bonk Kitsune Mascot"
        onClick={handleMascotBonk}
        style={{
          width: `${Math.round(146 * scale)}px`,
          height: `${Math.round(146 * scale)}px`,
        }}
        className="relative mt-4 mb-1.5 flex items-center justify-center cursor-pointer focus:outline-none group"
      >
        <div
          key={bonkAnimKey}
          className={`w-full h-full flex items-center justify-center ${
            bonkAnimKey > 0 ? 'animate-mascot-bonk' : 'animate-mascot-float'
          }`}
        >
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full overflow-visible drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
          >
            {/* Outer glowing festival ring */}
            <circle
              cx="60"
              cy="62"
              r="46"
              fill={mascot.frameBackground}
              stroke={mascot.frameBorder}
              strokeWidth="3.5"
            />
            {/* Fox ears */}
            <polygon
              points="24,52 16,14 48,36"
              fill={mascot.furColor}
              stroke="#2B1B3D"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <polygon
              points="26,45 21,22 42,36"
              fill={mascot.earInnerColor}
            />
            <polygon
              points="96,52 104,14 72,36"
              fill={mascot.furColor}
              stroke="#2B1B3D"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <polygon
              points="94,45 99,22 78,36"
              fill={mascot.earInnerColor}
            />
            {/* Head */}
            <ellipse
              cx="60"
              cy="66"
              rx="34"
              ry="29"
              fill={mascot.furColor}
              stroke="#2B1B3D"
              strokeWidth="2.5"
            />
            {/* Red festival mask forehead markings */}
            <path
              d="M28 56 Q60 36 92 56 Q77 42 60 44 Q43 42 28 56 Z"
              fill={mascot.cheekColor}
            />
            {/* Cheerful anime eyes */}
            <path
              d="M41 64 Q47 56 53 64"
              fill="none"
              stroke="#2B1B3D"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <path
              d="M67 64 Q73 56 79 64"
              fill="none"
              stroke="#2B1B3D"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            {/* Rosy cheeks */}
            <ellipse
              cx="38"
              cy="72"
              rx="5.5"
              ry="3.2"
              fill={mascot.cheekColor}
              opacity="0.65"
            />
            <ellipse
              cx="82"
              cy="72"
              rx="5.5"
              ry="3.2"
              fill={mascot.cheekColor}
              opacity="0.65"
            />
            {/* Cute smile */}
            <path
              d="M54 74 Q60 80 66 74"
              fill="none"
              stroke="#2B1B3D"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Little head-bonk stars when tapped */}
            {bonkAnimKey > 0 && (
              <g className="animate-bonk-stars">
                <polygon
                  points="30,14 32,20 38,20 33,24 35,30 30,26 25,30 27,24 22,20 28,20"
                  fill={starIcon.filledColor}
                  stroke={starIcon.filledStrokeColor}
                  strokeWidth="1.2"
                />
                <polygon
                  points="60,4 62,10 68,10 63,14 65,20 60,16 55,20 57,14 52,10 58,10"
                  fill={starIcon.filledColor}
                  stroke={starIcon.filledStrokeColor}
                  strokeWidth="1.2"
                />
                <polygon
                  points="90,14 92,20 98,20 93,24 95,30 90,26 85,30 87,24 82,20 88,20"
                  fill={starIcon.filledColor}
                  stroke={starIcon.filledStrokeColor}
                  strokeWidth="1.2"
                />
              </g>
            )}
          </svg>
        </div>
      </button>

      <span
        data-testid="mascot-bonk-caption"
        style={{
          color: hud.textSecondary,
          fontSize: `${Math.round(12 * scale)}px`,
        }}
        className="font-bold"
      >
        {bonkCount > 0
          ? `Bonk! ★ x${bonkCount}`
          : 'Tap Kitsune for a lucky bonk!'}
      </span>
    </div>
  );

  const playColumn = (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        data-testid="start-play-button"
        onClick={onPlay}
        style={{
          backgroundColor: btn.primaryBackground,
          borderColor: btn.primaryBorder,
          color: btn.primaryText,
          fontFamily: theme.titleFontFamily,
          fontSize: `${Math.round(26 * scale)}px`,
          padding: `${Math.round(14 * scale)}px ${Math.round(46 * scale)}px`,
          borderRadius: `${btn.cornerRadius}px`,
          boxShadow: `0 8px 0 rgba(0,0,0,0.35), 0 14px 28px rgba(0,0,0,0.45), inset 0 2px 0 ${btn.glossColor}`,
        }}
        className="border-2 font-black tracking-wide inline-flex items-center gap-3 cursor-pointer transition-transform active:translate-y-1 active:scale-95"
      >
        <Play className="w-7 h-7 fill-current" aria-hidden="true" />
        <span>Play</span>
      </button>

      <div
        style={{
          backgroundColor: hud.badgeBackground,
          borderColor: hud.badgeBorder,
          color: hud.textSecondary,
          fontSize: `${Math.round(12 * scale)}px`,
        }}
        className="px-3.5 py-1.5 rounded-xl border font-extrabold inline-flex items-center gap-1.5"
      >
        <span style={{ color: starIcon.filledColor }}>★</span>
        <span>
          {totalStars} / {maxStars} Festival Stars
        </span>
      </div>
    </div>
  );

  return (
    <section
      data-testid="start-screen"
      style={{
        paddingTop: `${layout.safeInsets.top}px`,
        paddingBottom: `${layout.safeInsets.bottom}px`,
        paddingLeft: `${16 + layout.safeInsets.left}px`,
        paddingRight: `${16 + layout.safeInsets.right}px`,
      }}
      className="relative z-10 w-full h-full flex flex-col items-center justify-center select-none"
    >
      {/* Top-right Settings gear button */}
      <div
        style={{
          top: `${16 + layout.safeInsets.top}px`,
          right: `${16 + layout.safeInsets.right}px`,
        }}
        className="absolute z-20"
      >
        <button
          type="button"
          aria-label="Settings"
          data-testid="start-settings-button"
          onClick={onOpenSettings}
          style={{
            backgroundColor: hud.badgeBackground,
            borderColor: hud.badgeBorder,
            color: hud.textPrimary,
            width: `${Math.max(GameConstants.minTouchTarget, Math.round(44 * scale))}px`,
            height: `${Math.max(GameConstants.minTouchTarget, Math.round(44 * scale))}px`,
          }}
          className="rounded-full border-2 flex items-center justify-center cursor-pointer shadow-lg transition-transform active:scale-95"
        >
          <Settings className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Responsive Portrait / Landscape Content Container */}
      <div
        style={{
          maxWidth: isLandscape
            ? '860px'
            : `${GameConstants.maxMapColumnWidth}px`,
        }}
        className={`w-full flex ${
          isLandscape
            ? 'flex-row items-center justify-around gap-8'
            : 'flex-col items-center justify-center gap-6'
        }`}
      >
        {titleAndMascot}
        {playColumn}
      </div>
    </section>
  );
};
