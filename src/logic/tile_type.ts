/**
 * Five distinct tile types, each paired with a unique silhouette and colour
 * so the board is clear and readable for colour-blind players.
 * Mirrors `lib/logic/tile_type.dart`.
 */
export enum TileType {
  sakura = 'sakura',
  lantern = 'lantern',
  onigiri = 'onigiri',
  dango = 'dango',
  foxMask = 'foxMask',

  // Aliases for Step 1 backwards compatibility
  circle = 'sakura',
  square = 'lantern',
  triangle = 'onigiri',
  diamond = 'dango',
  star = 'foxMask',
}

export enum TileShape {
  flower = 'flower',
  lantern = 'lantern',
  triangle = 'triangle',
  skewer = 'skewer',
  mask = 'mask',
}

export const ALL_TILE_TYPES: readonly TileType[] = [
  TileType.sakura,
  TileType.lantern,
  TileType.onigiri,
  TileType.dango,
  TileType.foxMask,
];

/**
 * Special tile kinds created by bigger matches and chain reactions (Step 5 Part 0).
 */
export enum SpecialKind {
  none = 'none',
  slashRow = 'slashRow',
  slashColumn = 'slashColumn',
  burst = 'burst',
  orb = 'orb',
}

/**
 * Represents an individual tile in a board cell (Step 5 Part 0).
 * Holds both `type` (colour/shape) and `special` kind.
 * The Spirit Orb has no colour (type is ignored for matching).
 * Slash and burst keep their colour and match normally with normal tiles of that colour.
 */
export class Tile {
  readonly type: TileType;
  readonly special: SpecialKind;

  constructor(type: TileType, special: SpecialKind = SpecialKind.none) {
    this.type = type;
    this.special = special;
  }

  static normal(type: TileType): Tile {
    return new Tile(type, SpecialKind.none);
  }

  static slashRow(type: TileType): Tile {
    return new Tile(type, SpecialKind.slashRow);
  }

  static slashColumn(type: TileType): Tile {
    return new Tile(type, SpecialKind.slashColumn);
  }

  static burst(type: TileType): Tile {
    return new Tile(type, SpecialKind.burst);
  }

  static orb(type: TileType = TileType.sakura): Tile {
    return new Tile(type, SpecialKind.orb);
  }

  get isSpecial(): boolean {
    return this.special !== SpecialKind.none;
  }

  get isOrb(): boolean {
    return this.special === SpecialKind.orb;
  }

  get isSlash(): boolean {
    return (
      this.special === SpecialKind.slashRow ||
      this.special === SpecialKind.slashColumn
    );
  }

  get isBurst(): boolean {
    return this.special === SpecialKind.burst;
  }

  copyWith(params: { type?: TileType; special?: SpecialKind }): Tile {
    return new Tile(
      params.type ?? this.type,
      params.special ?? this.special
    );
  }

  matchesColor(other: Tile | null | undefined): boolean {
    if (!other) return false;
    if (this.isOrb || other.isOrb) return false;
    return this.type === other.type;
  }

  equals(other: Tile | null | undefined): boolean {
    if (!other) return false;
    if (this.isOrb && other.isOrb) return true;
    return this.type === other.type && this.special === other.special;
  }

  toString(): string {
    return this.special === SpecialKind.none
      ? `Tile(${this.type})`
      : `Tile(${this.type}, ${this.special})`;
  }
}
