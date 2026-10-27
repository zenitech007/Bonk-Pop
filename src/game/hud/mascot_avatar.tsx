import React, { useState } from 'react';
import { GameConstants } from '../../core/constants';
import { GameTheme, MascotExpression } from '../../core/theme/game_theme';

export interface MascotAvatarProps {
  theme: GameTheme;
  expression: MascotExpression;
  size?: number;
}

/**
 * Round mascot portrait featuring our original Chibi Fox Spirit (Kitsune)
 * with 4 expressions: normal, happy (win), worried (<= 5 moves), and sad (lose).
 * Uses sprite assets in `assets/themes/sakura_festival/mascot_*.png` if present,
 * falling back to clean code-drawn vector shapes.
 * Mirrors `lib/game/hud/mascot_avatar.dart`.
 */
export const MascotAvatar: React.FC<MascotAvatarProps> = ({
  theme,
  expression,
  size = 64,
}) => {
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const mascot = theme.mascot;
  const assetPath = mascot.spriteAssets[expression];

  return (
    <div
      role="img"
      aria-label={`Kitsune mascot (${expression})`}
      data-testid="mascot-avatar"
      data-expression={expression}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: mascot.frameBackground,
        borderColor: mascot.frameBorder,
        boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), inset 0 0 10px ${mascot.cheekColor}33`,
      }}
      className="relative rounded-full border-[2.5px] overflow-hidden shrink-0 flex items-center justify-center"
    >
      {assetPath && (
        <img
          src={`/${assetPath}`}
          alt={`Kitsune mascot ${expression}`}
          referrerPolicy="no-referrer"
          onLoad={() => setSpriteLoaded(true)}
          onError={() => setSpriteLoaded(false)}
          className={
            spriteLoaded
              ? 'w-full h-full object-cover pointer-events-none'
              : 'hidden'
          }
        />
      )}
      {!spriteLoaded && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          {/* Left & Right Fox Ears */}
          <polygon
            points="16,44 12,10 42,28"
            fill={mascot.furColor}
            stroke={mascot.earInnerColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon points="19,38 17,17 36,29" fill={mascot.earInnerColor} />
          <polygon
            points="84,44 88,10 58,28"
            fill={mascot.furColor}
            stroke={mascot.earInnerColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon points="81,38 83,17 64,29" fill={mascot.earInnerColor} />

          {/* Chibi Kitsune Head */}
          <ellipse
            cx="50"
            cy="58"
            rx="34"
            ry="29"
            fill={mascot.furColor}
            stroke={mascot.earInnerColor}
            strokeWidth="2.5"
          />

          {/* Forehead Sakura Leaf / Festival Diamond Mark */}
          <path d="M 50 35 L 54 42 L 50 47 L 46 42 Z" fill={mascot.earInnerColor} />

          {/* Rosy Blush Cheeks */}
          <ellipse
            cx="31"
            cy="64"
            rx="6.5"
            ry="3.8"
            fill={mascot.cheekColor}
            opacity="0.7"
          />
          <ellipse
            cx="69"
            cy="64"
            rx="6.5"
            ry="3.8"
            fill={mascot.cheekColor}
            opacity="0.7"
          />

          {/* Dynamic Expressions */}
          {expression === MascotExpression.normal && (
            <g>
              <circle cx="37" cy="56" r="5.2" fill={GameConstants.cuteEyeDark} />
              <circle cx="63" cy="56" r="5.2" fill={GameConstants.cuteEyeDark} />
              <circle cx="35.3" cy="54.2" r="2.1" fill={GameConstants.cuteEyeHighlight} />
              <circle cx="61.3" cy="54.2" r="2.1" fill={GameConstants.cuteEyeHighlight} />
              <path
                d="M 44 64 Q 50 70 56 64"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </g>
          )}

          {expression === MascotExpression.happy && (
            <g>
              {/* Happy curved anime eyes */}
              <path
                d="M 31 57 Q 37 49 43 57 M 57 57 Q 63 49 69 57"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              {/* Big cheerful open smile */}
              <path
                d="M 42 63 Q 50 74 58 63 Z"
                fill={mascot.earInnerColor}
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            </g>
          )}

          {expression === MascotExpression.worried && (
            <g>
              {/* Slanted worried eyebrows */}
              <path
                d="M 29 49 L 42 45 M 58 45 L 71 49"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <circle cx="37" cy="57" r="5.2" fill={GameConstants.cuteEyeDark} />
              <circle cx="63" cy="57" r="5.2" fill={GameConstants.cuteEyeDark} />
              <circle cx="35.5" cy="55.5" r="2" fill={GameConstants.cuteEyeHighlight} />
              <circle cx="61.5" cy="55.5" r="2" fill={GameConstants.cuteEyeHighlight} />
              {/* Wavy nervous mouth + sweat drop */}
              <path
                d="M 43 67 Q 46.5 64 50 67 T 57 67"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M 76 44 C 73 49, 73 53, 76 53 C 79 53, 79 49, 76 44 Z"
                fill="#4CC9F0"
              />
            </g>
          )}

          {expression === MascotExpression.sad && (
            <g>
              {/* Droopy sad eyes + tears */}
              <path
                d="M 31 55 Q 37 61 43 55 M 57 55 Q 63 61 69 55"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="32" cy="61" r="2.2" fill="#4CC9F0" />
              <circle cx="68" cy="61" r="2.2" fill="#4CC9F0" />
              {/* Frown */}
              <path
                d="M 43 69 Q 50 62 57 69"
                fill="none"
                stroke={GameConstants.cuteEyeDark}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
      )}
    </div>
  );
};
