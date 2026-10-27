import { GameConstants } from '../constants';

export enum LayoutMode {
  portrait = 'portrait',
  landscape = 'landscape',
}

export enum SizeClass {
  compact = 'compact',
  medium = 'medium',
  expanded = 'expanded',
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export interface LayoutInsets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const ZERO_INSETS: LayoutInsets = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

export class LayoutRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;

  constructor(left: number, top: number, width: number, height: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  static readonly zero = new LayoutRect(0, 0, 0, 0);

  static fromLTWH(
    left: number,
    top: number,
    width: number,
    height: number
  ): LayoutRect {
    return new LayoutRect(left, top, width, height);
  }

  get right(): number {
    return this.left + this.width;
  }

  get bottom(): number {
    return this.top + this.height;
  }

  get isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  overlaps(other: LayoutRect): boolean {
    if (this.isEmpty || other.isEmpty) return false;
    const eps = 1e-4;
    return (
      this.left + eps < other.right &&
      this.right - eps > other.left &&
      this.top + eps < other.bottom &&
      this.bottom - eps > other.top
    );
  }

  isInside(container: LayoutRect): boolean {
    if (this.isEmpty) return true;
    const eps = 1e-4;
    return (
      this.left >= container.left - eps &&
      this.top >= container.top - eps &&
      this.right <= container.right + eps &&
      this.bottom <= container.bottom + eps
    );
  }
}

export interface LayoutSpec {
  readonly screen: ScreenSize;
  readonly safeInsets: LayoutInsets;
  readonly safeRect: LayoutRect;
  readonly mode: LayoutMode;
  readonly sizeClass: SizeClass;
  readonly uiScale: number;
  readonly textScale: number;
  readonly contentColumn: LayoutRect;
  readonly hud: LayoutRect;
  readonly hudContent: LayoutRect;
  readonly board: LayoutRect;
  readonly bottomBar: LayoutRect;
  readonly leftPanel: LayoutRect;
  readonly rightPanel: LayoutRect;
  readonly mergeRightIntoLeftPanel: boolean;
  readonly tileSize: number;
  readonly dialogMaxWidth: number;
  readonly isPortrait: boolean;
  readonly isLandscape: boolean;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Reads safe-area insets from URL query (`?insets=top,right,bottom,left`) or CSS `env(safe-area-inset-*)`.
 */
export function readSafeAreaInsets(): LayoutInsets {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return ZERO_INSETS;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const insetsParam = params.get('insets');
    if (insetsParam) {
      const parts = insetsParam.split(',').map((n) => Number.parseFloat(n.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n >= 0)) {
        return {
          top: parts[0],
          right: parts[1],
          bottom: parts[2],
          left: parts[3],
        };
      }
    }

    const rootStyle = window.getComputedStyle(document.documentElement);
    const parseInset = (prop: string): number => {
      const raw = rootStyle.getPropertyValue(prop).trim();
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    return {
      top: parseInset('--safe-area-inset-top'),
      right: parseInset('--safe-area-inset-right'),
      bottom: parseInset('--safe-area-inset-bottom'),
      left: parseInset('--safe-area-inset-left'),
    };
  } catch {
    return ZERO_INSETS;
  }
}

/**
 * Pure, unit-tested responsive layout calculator mirroring `lib/core/layout/screen_layout.dart`.
 */
export class ScreenLayout {
  static compute(
    screen: ScreenSize,
    safeInsets: LayoutInsets = ZERO_INSETS,
    rawTextScale = 1.0
  ): LayoutSpec {
    const mode =
      screen.height >= screen.width
        ? LayoutMode.portrait
        : LayoutMode.landscape;

    const shortestSide = Math.min(screen.width, screen.height);
    let sizeClass: SizeClass;
    if (shortestSide < GameConstants.compactMaxShortSide) {
      sizeClass = SizeClass.compact;
    } else if (shortestSide <= GameConstants.mediumMaxShortSide) {
      sizeClass = SizeClass.medium;
    } else {
      sizeClass = SizeClass.expanded;
    }

    const safeLeft = safeInsets.left;
    const safeTop = safeInsets.top;
    const safeWidth = Math.max(
      0,
      screen.width - safeInsets.left - safeInsets.right
    );
    const safeHeight = Math.max(
      0,
      screen.height - safeInsets.top - safeInsets.bottom
    );
    const safeRect = LayoutRect.fromLTWH(
      safeLeft,
      safeTop,
      safeWidth,
      safeHeight
    );

    const contentShortSide = Math.min(safeWidth, safeHeight);
    const uiScale = clamp(
      contentShortSide / GameConstants.uiScaleReferenceShortSide,
      GameConstants.minUiScale,
      GameConstants.maxUiScale
    );
    const textScale = clamp(
      rawTextScale,
      GameConstants.minTextScale,
      GameConstants.maxTextScale
    );

    const dialogMaxWidth = clamp(
      safeWidth * GameConstants.dialogWidthFraction,
      Math.min(safeWidth, GameConstants.minDialogWidth),
      Math.min(safeWidth, GameConstants.maxDialogWidth)
    );

    const minBoardSide = GameConstants.minTileSize * GameConstants.gridSize;

    if (mode === LayoutMode.portrait) {
      const colWidth = Math.min(
        safeWidth,
        GameConstants.maxPortraitContentColumnWidth
      );
      const contentColumn = LayoutRect.fromLTWH(
        safeLeft + (safeWidth - colWidth) / 2,
        safeTop,
        colWidth,
        safeHeight
      );

      const hudHeight = clamp(
        screen.height * GameConstants.portraitHudHeightFraction,
        GameConstants.minHudHeight,
        GameConstants.maxHudHeight
      );
      const hud = LayoutRect.fromLTWH(safeLeft, safeTop, safeWidth, hudHeight);

      const hudInnerWidth = Math.min(
        safeWidth,
        GameConstants.maxHudContentWidth
      );
      const hudContent = LayoutRect.fromLTWH(
        safeLeft + (safeWidth - hudInnerWidth) / 2,
        safeTop,
        hudInnerWidth,
        hudHeight
      );

      const bottomBarHeight = clamp(
        screen.height * GameConstants.portraitBottomBarHeightFraction,
        GameConstants.minBottomBarHeight,
        GameConstants.maxBottomBarHeight
      );
      const widthFraction =
        sizeClass === SizeClass.compact
          ? GameConstants.compactBottomBarWidthFraction
          : GameConstants.regularBottomBarWidthFraction;
      const bottomBarWidth = Math.min(
        safeWidth * widthFraction,
        GameConstants.maxBottomBarWidth
      );

      const rawRemainingHeight = safeHeight - hudHeight - bottomBarHeight;
      const desiredBottomMargin =
        screen.height * GameConstants.portraitBottomMarginFraction;
      const desiredGap = screen.height * GameConstants.portraitBoardGapFraction;

      const totalExtraSpace = Math.max(3, rawRemainingHeight - minBoardSide);
      const bottomMargin = Math.min(
        desiredBottomMargin,
        Math.max(1, totalExtraSpace * 0.3)
      );
      const bottomBarTop = safeRect.bottom - bottomMargin - bottomBarHeight;
      const bottomBar = LayoutRect.fromLTWH(
        safeLeft + (safeWidth - bottomBarWidth) / 2,
        bottomBarTop,
        bottomBarWidth,
        bottomBarHeight
      );

      const spanBetweenHudAndBottom = Math.max(0, bottomBar.top - hud.bottom);
      const verticalGap = Math.min(
        desiredGap,
        Math.max(1, (spanBetweenHudAndBottom - minBoardSide) / 2)
      );

      const maxBoardHeight = Math.max(
        0,
        spanBetweenHudAndBottom - 2 * verticalGap
      );
      const maxBoardWidth = Math.max(
        Math.min(safeWidth, minBoardSide),
        safeWidth * (1 - 2 * GameConstants.portraitSideMarginFraction)
      );

      const boardSide = Math.min(
        GameConstants.maxBoardSide,
        Math.min(maxBoardWidth, maxBoardHeight)
      );
      const boardLeft = safeLeft + (safeWidth - boardSide) / 2;
      const boardTop =
        hud.bottom + (spanBetweenHudAndBottom - boardSide) / 2;
      const board = LayoutRect.fromLTWH(
        boardLeft,
        boardTop,
        boardSide,
        boardSide
      );

      return {
        screen,
        safeInsets,
        safeRect,
        mode,
        sizeClass,
        uiScale,
        textScale,
        contentColumn,
        hud,
        hudContent,
        board,
        bottomBar,
        leftPanel: LayoutRect.zero,
        rightPanel: LayoutRect.zero,
        mergeRightIntoLeftPanel: false,
        tileSize: boardSide / GameConstants.gridSize,
        dialogMaxWidth,
        isPortrait: true,
        isLandscape: false,
      };
    }

    // Landscape mode
    const colWidth = Math.min(safeWidth, GameConstants.maxMapColumnWidth);
    const contentColumn = LayoutRect.fromLTWH(
      safeLeft + (safeWidth - colWidth) / 2,
      safeTop,
      colWidth,
      safeHeight
    );

    const desiredVMargin =
      screen.height * (GameConstants.landscapeBoardMarginFraction / 2);
    const vMargin = Math.min(
      desiredVMargin,
      Math.max(1, (safeHeight - minBoardSide) / 2)
    );
    const maxBoardByHeight = Math.max(0, safeHeight - 2 * vMargin);
    const maxBoardByWidth = Math.max(
      Math.min(safeWidth * 0.62, minBoardSide),
      safeWidth * GameConstants.landscapeBoardMaxWidthFraction
    );

    const boardSide = Math.min(
      GameConstants.maxBoardSide,
      Math.min(maxBoardByHeight, maxBoardByWidth)
    );
    const boardLeft = safeLeft + (safeWidth - boardSide) / 2;
    const boardTop = safeTop + (safeHeight - boardSide) / 2;
    const board = LayoutRect.fromLTWH(
      boardLeft,
      boardTop,
      boardSide,
      boardSide
    );

    const sideFreeSpace = Math.max(0, (safeWidth - boardSide) / 2);
    const mergeRight =
      sideFreeSpace < GameConstants.minRightPanelFreeSpaceFactor * uiScale;
    const panelGap = Math.max(6, Math.min(16, sideFreeSpace * 0.08));
    const maxAvailableSideWidth = Math.max(0, sideFreeSpace - 2 * panelGap);
    const targetPanelWidth = Math.min(
      screen.width * GameConstants.landscapePanelWidthFraction,
      GameConstants.maxLandscapePanelWidth
    );
    const panelWidth = Math.min(targetPanelWidth, maxAvailableSideWidth);

    const leftPanelHeight = boardSide;
    const leftPanelLeft = board.left - panelGap - panelWidth;
    const leftPanel = LayoutRect.fromLTWH(
      leftPanelLeft,
      board.top,
      panelWidth,
      leftPanelHeight
    );

    let rightPanel: LayoutRect;
    if (mergeRight) {
      rightPanel = LayoutRect.zero;
    } else {
      const rightPanelHeight = Math.min(boardSide, 220 * uiScale);
      const rightPanelLeft = board.right + panelGap;
      const rightPanelTop = safeTop + (safeHeight - rightPanelHeight) / 2;
      rightPanel = LayoutRect.fromLTWH(
        rightPanelLeft,
        rightPanelTop,
        panelWidth,
        rightPanelHeight
      );
    }

    return {
      screen,
      safeInsets,
      safeRect,
      mode,
      sizeClass,
      uiScale,
      textScale,
      contentColumn,
      hud: LayoutRect.zero,
      hudContent: LayoutRect.zero,
      board,
      bottomBar: LayoutRect.zero,
      leftPanel,
      rightPanel,
      mergeRightIntoLeftPanel: mergeRight,
      tileSize: boardSide / GameConstants.gridSize,
      dialogMaxWidth,
      isPortrait: false,
      isLandscape: true,
    };
  }
}
