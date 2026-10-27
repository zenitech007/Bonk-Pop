import { TileShape, TileType } from '../../logic/tile_type';
import {
  BackgroundStyle,
  BannerStripeStyle,
  BoardFrameStyle,
  ClearEffectStyle,
  DialogFrameStyle,
  GameTheme,
  HudStyle,
  MapThemeStyle,
  MascotExpression,
  MascotStyle,
  ParticleKind,
  SidePanelStyle,
  SpecialTileThemeStyle,
  StarIconStyle,
  StartScreenStyle,
  ThemeButtonStyle,
  TileStyle,
} from './game_theme';

/**
 * Default "Sakura Festival" anime theme with Step 4 Start, Map, and Landscape panel styles.
 * Mirrors `lib/core/theme/sakura_festival_theme.dart`.
 */
export class SakuraFestivalTheme extends GameTheme {
  static readonly instance = new SakuraFestivalTheme();

  get name(): string {
    return 'Sakura Festival';
  }

  get titleFontFamily(): string {
    return "'M PLUS Rounded 1c', 'Outfit', sans-serif";
  }

  get numberFontFamily(): string {
    return "'M PLUS Rounded 1c', 'JetBrains Mono', monospace";
  }

  get cascadeWords(): readonly string[] {
    return ['Nice!', 'Sugoi!', 'Kawaii!', 'Yatta!!'];
  }

  get background(): BackgroundStyle {
    return {
      gradientColors: ['#2B1B3D', '#4A2545', '#7C3E66'],
      petalColor: '#FFB7C5',
      distantHillColor: '#391C42',
      nearHillColor: '#26122E',
      toriiGateColor: '#D9385A',
      sakuraTreeTrunkColor: '#3D2036',
      sakuraCanopyColor: '#FF9EBB',
      imageAssetPath: 'assets/themes/sakura_festival/background.png',
    };
  }

  get boardFrame(): BoardFrameStyle {
    return {
      backgroundColor: 'rgba(35, 21, 48, 0.86)',
      borderColor: '#FFB7C5',
      glowColor: 'rgba(255, 133, 161, 0.42)',
      cornerRadius: 22,
      glowBlurRadius: 24,
    };
  }

  get clearEffect(): ClearEffectStyle {
    return {
      primaryColor: '#FFB7C5',
      secondaryColor: '#FFF3B0',
      particleType: ParticleKind.petals,
    };
  }

  get hud(): HudStyle {
    return {
      panelBackground: 'rgba(52, 28, 66, 0.92)',
      panelBorder: '#FFB7C5',
      badgeBackground: '#23122E',
      badgeBorder: '#FF85A1',
      lowMovesColor: '#FF4D6D',
      progressTrackColor: '#1D0F26',
      progressFillStart: '#FF758F',
      progressFillEnd: '#FFD166',
      textPrimary: '#FFFDF9',
      textSecondary: '#FFC2D1',
      checkMarkColor: '#34D399',
      railSlotBackground: 'rgba(29, 15, 38, 0.45)',
      railSlotBorder: 'rgba(255, 133, 161, 0.35)',
    };
  }

  get starIcon(): StarIconStyle {
    return {
      filledColor: '#FFD166',
      filledStrokeColor: '#B45309',
      emptyColor: '#3B2447',
      emptyStrokeColor: '#7C5285',
      glowColor: 'rgba(255, 209, 102, 0.55)',
    };
  }

  get bannerStripe(): BannerStripeStyle {
    return {
      backgroundColor: 'rgba(43, 25, 46, 0.96)',
      borderColor: '#FFD166',
      stripePrimary: '#FF4D6D',
      stripeSecondary: '#FFFDF9',
      textColor: '#FFFDF9',
    };
  }

  get buttonStyle(): ThemeButtonStyle {
    return {
      primaryBackground: '#FF5C8A',
      primaryBorder: '#FFC2D1',
      primaryText: '#FFFFFF',
      secondaryBackground: '#3E234E',
      secondaryBorder: '#D69EC2',
      secondaryText: '#FFE5EC',
      dangerBackground: '#E11D48',
      dangerBorder: '#FFB3C1',
      dangerText: '#FFFFFF',
      glossColor: 'rgba(255, 255, 255, 0.28)',
      cornerRadius: 16,
    };
  }

  get dialogFrame(): DialogFrameStyle {
    return {
      backgroundColor: 'rgba(43, 25, 46, 0.98)',
      headerBackground: '#432349',
      borderColor: '#FFB7C5',
      glowColor: 'rgba(255, 117, 143, 0.45)',
      brokenHeartColor: '#FF4D6D',
      overlayScrimColor: 'rgba(15, 8, 22, 0.74)',
      cornerRadius: 26,
    };
  }

  get mascot(): MascotStyle {
    return {
      furColor: '#FFF5E4',
      earInnerColor: '#FF758F',
      cheekColor: '#FF85A1',
      frameBackground: '#23122E',
      frameBorder: '#FFB7C5',
      spriteAssets: {
        [MascotExpression.normal]:
          'assets/themes/sakura_festival/mascot_normal.png',
        [MascotExpression.happy]:
          'assets/themes/sakura_festival/mascot_happy.png',
        [MascotExpression.worried]:
          'assets/themes/sakura_festival/mascot_worried.png',
        [MascotExpression.sad]: 'assets/themes/sakura_festival/mascot_sad.png',
      },
    };
  }

  get startScreen(): StartScreenStyle {
    return {
      titleFillStart: '#FFF3B0',
      titleFillEnd: '#FF85A1',
      titleStrokeColor: '#4A1936',
      titleGlowColor: 'rgba(255, 107, 158, 0.55)',
      subtitleColor: '#FFE5EC',
      emblemBackground: 'rgba(46, 23, 59, 0.82)',
      emblemBorder: '#FFB7C5',
    };
  }

  get sidePanel(): SidePanelStyle {
    return {
      backgroundColor: 'rgba(52, 28, 66, 0.92)',
      borderColor: '#FFB7C5',
      glowColor: 'rgba(255, 133, 161, 0.32)',
      cornerRadius: 24,
    };
  }

  get mapTheme(): MapThemeStyle {
    return {
      skyGradient: ['#1F112B', '#3D1E42', '#6B325C', '#94496E'],
      farHillColor: '#4A244B',
      midHillColor: '#351939',
      nearHillColor: '#241028',
      pathFillColor: '#F3D5E5',
      pathOutlineColor: '#B56589',
      pathDashColor: '#FF85A1',
      toriiColor: '#E63956',
      stoneLanternColor: '#9E8B9C',
      lanternGlowColor: '#FFD166',
      completedNodeFill: '#FF7597',
      completedNodeBorder: '#FFF3B0',
      completedNodeText: '#FFFFFF',
      currentNodeFill: '#FF4D79',
      currentNodeBorder: '#FFE066',
      currentNodeGlow: 'rgba(255, 158, 187, 0.68)',
      currentNodeText: '#FFFFFF',
      lockedNodeFill: '#4A3856',
      lockedNodeBorder: '#7B6588',
      lockedNodeText: '#CBB8D6',
      optionalMapAssets: {
        torii: 'assets/themes/sakura_festival/map_torii.png',
        lantern: 'assets/themes/sakura_festival/map_lantern.png',
        tree: 'assets/themes/sakura_festival/map_tree.png',
      },
    };
  }

  get tileStyles(): readonly TileStyle[] {
    return [
      {
        id: TileType.sakura,
        label: 'Pink Sakura',
        baseColor: '#FF85A1',
        accentColor: '#FFD6E0',
        outlineColor: '#B5385A',
        shape: TileShape.flower,
        plateName: 'magenta-plum',
        plateGradientStart: 'rgba(84, 24, 72, 0.86)',
        plateGradientEnd: 'rgba(116, 36, 98, 0.90)',
        plateBorderColor: '#FFB7C5',
        plateInnerGlowColor: 'rgba(255, 183, 197, 0.44)',
        spriteAssetPath: 'assets/themes/sakura_festival/sakura.png',
      },
      {
        id: TileType.lantern,
        label: 'Red Lantern',
        baseColor: '#FF4D4D',
        accentColor: '#FFC145',
        outlineColor: '#9E1B1B',
        shape: TileShape.lantern,
        plateName: 'crimson-ember',
        plateGradientStart: 'rgba(92, 22, 36, 0.86)',
        plateGradientEnd: 'rgba(128, 34, 52, 0.90)',
        plateBorderColor: '#FFC145',
        plateInnerGlowColor: 'rgba(255, 193, 69, 0.44)',
        spriteAssetPath: 'assets/themes/sakura_festival/lantern.png',
      },
      {
        id: TileType.onigiri,
        label: 'Rice Onigiri',
        baseColor: '#FFFDF7',
        accentColor: '#2E5A44',
        outlineColor: '#5E7A6B',
        shape: TileShape.triangle,
        plateName: 'pearl-indigo',
        plateGradientStart: 'rgba(46, 40, 82, 0.86)',
        plateGradientEnd: 'rgba(68, 60, 112, 0.90)',
        plateBorderColor: '#CCFBF1',
        plateInnerGlowColor: 'rgba(204, 251, 241, 0.40)',
        spriteAssetPath: 'assets/themes/sakura_festival/onigiri.png',
      },
      {
        id: TileType.dango,
        label: 'Sweet Dango',
        baseColor: '#A8E6CF',
        accentColor: '#FF9AA2',
        outlineColor: '#4D8B74',
        shape: TileShape.skewer,
        plateName: 'emerald-jade',
        plateGradientStart: 'rgba(18, 66, 56, 0.86)',
        plateGradientEnd: 'rgba(30, 96, 82, 0.90)',
        plateBorderColor: '#A8E6CF',
        plateInnerGlowColor: 'rgba(255, 154, 162, 0.42)',
        spriteAssetPath: 'assets/themes/sakura_festival/dango.png',
      },
      {
        id: TileType.foxMask,
        label: 'Blue Fox Mask',
        baseColor: '#4CC9F0',
        accentColor: '#FF5964',
        outlineColor: '#1D6FA5',
        shape: TileShape.mask,
        plateName: 'sapphire-slate',
        plateGradientStart: 'rgba(16, 40, 78, 0.86)',
        plateGradientEnd: 'rgba(26, 64, 116, 0.90)',
        plateBorderColor: '#4CC9F0',
        plateInnerGlowColor: 'rgba(76, 201, 240, 0.45)',
        spriteAssetPath: 'assets/themes/sakura_festival/fox_mask.png',
      },
    ];
  }

  get specialTile(): SpecialTileThemeStyle {
    return {
      slashBandColor: '#FFD166',
      slashChevronColor: '#FFFDF9',
      slashStripeWhite: '#FFFFFF',
      slashStripeGold: '#FFD166',
      slashStripeOutline: '#B45309',
      slashStripeAreaRatio: 0.45,
      slashStripeCount: 4,
      cardGradientStart: '#FFF0AD',
      cardGradientMid: '#FFC8DD',
      cardGradientEnd: '#FF7597',
      cardBorderColor: '#FFF6BA',
      shineSweepColor: 'rgba(255, 255, 255, 0.72)',
      shineSweepDurationMs: 1800,
      burstRingColor: '#FFD1E0',
      burstPetalColor: '#FF85A1',
      orbCoreColor: '#FFFFFF',
      orbSwirlColor: '#FFE066',
      orbGlowColor: '#FF85A1',
      beamColor: '#FFF9FC',
      beamGlowColor: '#FFD1E0',
      burstWaveColor: '#FF85A1',
    };
  }
}
