import { TileShape, TileType } from '../../logic/tile_type';

export enum ParticleKind {
  petals = 'petals',
  sparkles = 'sparkles',
  stars = 'stars',
}

export enum MascotExpression {
  normal = 'normal',
  happy = 'happy',
  worried = 'worried',
  sad = 'sad',
}

export interface TileStyle {
  readonly id: TileType;
  readonly label: string;
  readonly baseColor: string;
  readonly accentColor: string;
  readonly outlineColor: string;
  readonly shape: TileShape;
  readonly plateName: string;
  readonly plateGradientStart: string;
  readonly plateGradientEnd: string;
  readonly plateBorderColor: string;
  readonly plateInnerGlowColor: string;
  readonly spriteAssetPath?: string;
}

export interface BackgroundStyle {
  readonly gradientColors: readonly string[];
  readonly petalColor: string;
  readonly distantHillColor: string;
  readonly nearHillColor: string;
  readonly toriiGateColor: string;
  readonly sakuraTreeTrunkColor: string;
  readonly sakuraCanopyColor: string;
  readonly imageAssetPath?: string;
}

export interface BoardFrameStyle {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly glowColor: string;
  readonly cornerRadius: number;
  readonly glowBlurRadius: number;
}

export interface ClearEffectStyle {
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly particleType: ParticleKind;
}

export interface HudStyle {
  readonly panelBackground: string;
  readonly panelBorder: string;
  readonly badgeBackground: string;
  readonly badgeBorder: string;
  readonly lowMovesColor: string;
  readonly progressTrackColor: string;
  readonly progressFillStart: string;
  readonly progressFillEnd: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly checkMarkColor: string;
  readonly railSlotBackground: string;
  readonly railSlotBorder: string;
}

export interface StarIconStyle {
  readonly filledColor: string;
  readonly filledStrokeColor: string;
  readonly emptyColor: string;
  readonly emptyStrokeColor: string;
  readonly glowColor: string;
}

export interface BannerStripeStyle {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly stripePrimary: string;
  readonly stripeSecondary: string;
  readonly textColor: string;
}

export interface ThemeButtonStyle {
  readonly primaryBackground: string;
  readonly primaryBorder: string;
  readonly primaryText: string;
  readonly secondaryBackground: string;
  readonly secondaryBorder: string;
  readonly secondaryText: string;
  readonly dangerBackground: string;
  readonly dangerBorder: string;
  readonly dangerText: string;
  readonly glossColor: string;
  readonly cornerRadius: number;
}

export interface DialogFrameStyle {
  readonly backgroundColor: string;
  readonly headerBackground: string;
  readonly borderColor: string;
  readonly glowColor: string;
  readonly brokenHeartColor: string;
  readonly overlayScrimColor: string;
  readonly cornerRadius: number;
}

export interface MascotStyle {
  readonly furColor: string;
  readonly earInnerColor: string;
  readonly cheekColor: string;
  readonly frameBackground: string;
  readonly frameBorder: string;
  readonly spriteAssets: Record<MascotExpression, string>;
}

export interface StartScreenStyle {
  readonly titleFillStart: string;
  readonly titleFillEnd: string;
  readonly titleStrokeColor: string;
  readonly titleGlowColor: string;
  readonly subtitleColor: string;
  readonly emblemBackground: string;
  readonly emblemBorder: string;
}

export interface SidePanelStyle {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly glowColor: string;
  readonly cornerRadius: number;
}

export interface MapThemeStyle {
  readonly skyGradient: readonly string[];
  readonly farHillColor: string;
  readonly midHillColor: string;
  readonly nearHillColor: string;
  readonly pathFillColor: string;
  readonly pathOutlineColor: string;
  readonly pathDashColor: string;
  readonly toriiColor: string;
  readonly stoneLanternColor: string;
  readonly lanternGlowColor: string;
  readonly completedNodeFill: string;
  readonly completedNodeBorder: string;
  readonly completedNodeText: string;
  readonly currentNodeFill: string;
  readonly currentNodeBorder: string;
  readonly currentNodeGlow: string;
  readonly currentNodeText: string;
  readonly lockedNodeFill: string;
  readonly lockedNodeBorder: string;
  readonly lockedNodeText: string;
  readonly optionalMapAssets: Readonly<Record<string, string>>;
}

export interface SpecialTileThemeStyle {
  readonly slashBandColor: string;
  readonly slashChevronColor: string;
  readonly slashStripeWhite: string;
  readonly slashStripeGold: string;
  readonly slashStripeOutline: string;
  readonly slashStripeAreaRatio: number;
  readonly slashStripeCount: number;
  readonly cardGradientStart: string;
  readonly cardGradientMid: string;
  readonly cardGradientEnd: string;
  readonly cardBorderColor: string;
  readonly shineSweepColor: string;
  readonly shineSweepDurationMs: number;
  readonly burstRingColor: string;
  readonly burstPetalColor: string;
  readonly orbCoreColor: string;
  readonly orbSwirlColor: string;
  readonly orbGlowColor: string;
  readonly beamColor: string;
  readonly beamGlowColor: string;
  readonly burstWaveColor: string;
}

export interface GlowCellThemeStyle {
  readonly layer1Fill: string;
  readonly layer1GradientEnd: string;
  readonly layer1Border: string;
  readonly layer1Shadow: string;
  readonly layer2Fill: string;
  readonly layer2GradientEnd: string;
  readonly layer2OuterBorder: string;
  readonly layer2InnerBorder: string;
  readonly layer2Shadow: string;
  readonly shimmerStarColor: string;
}

/**
 * Abstract GameTheme contract read by the entire game, screens, HUD, and modals.
 * Mirrors `lib/core/theme/game_theme.dart`.
 */
export abstract class GameTheme {
  abstract get name(): string;
  abstract get tileStyles(): readonly TileStyle[];
  abstract get background(): BackgroundStyle;
  abstract get boardFrame(): BoardFrameStyle;
  abstract get clearEffect(): ClearEffectStyle;
  abstract get hud(): HudStyle;
  abstract get starIcon(): StarIconStyle;
  abstract get bannerStripe(): BannerStripeStyle;
  abstract get buttonStyle(): ThemeButtonStyle;
  abstract get dialogFrame(): DialogFrameStyle;
  abstract get mascot(): MascotStyle;
  abstract get startScreen(): StartScreenStyle;
  abstract get sidePanel(): SidePanelStyle;
  abstract get mapTheme(): MapThemeStyle;
  abstract get specialTile(): SpecialTileThemeStyle;
  abstract get cascadeWords(): readonly string[];
  abstract get titleFontFamily(): string;
  abstract get numberFontFamily(): string;

  get glowCell(): GlowCellThemeStyle {
    return {
      layer1Fill: 'rgba(255, 214, 102, 0.30)',
      layer1GradientEnd: 'rgba(255, 158, 187, 0.36)',
      layer1Border: '#FFD166',
      layer1Shadow: 'rgba(255, 209, 102, 0.65)',
      layer2Fill: 'rgba(255, 230, 109, 0.50)',
      layer2GradientEnd: 'rgba(255, 133, 161, 0.54)',
      layer2OuterBorder: '#FFF3B0',
      layer2InnerBorder: '#FF9EBB',
      layer2Shadow: 'rgba(255, 224, 102, 0.92)',
      shimmerStarColor: '#FFF3B0',
    };
  }

  styleFor(type: TileType): TileStyle {
    return (
      this.tileStyles.find((style) => style.id === type) ?? this.tileStyles[0]
    );
  }

  styleForId(tileId: string): TileStyle {
    return (
      this.tileStyles.find((style) => style.id === tileId) ?? this.tileStyles[0]
    );
  }

  cascadeWordFor(cascadeCount: number): string | null {
    if (cascadeCount < 2 || this.cascadeWords.length === 0) return null;
    const index = Math.min(
      Math.max(cascadeCount - 2, 0),
      this.cascadeWords.length - 1
    );
    return this.cascadeWords[index];
  }
}

