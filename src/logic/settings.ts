import { GameConstants, kSettingsStorageKey } from '../core/constants';

/**
 * Settings model for "Bonk Pop" (Step 5 Part C & Step 6 Part 0.6 / Part C).
 * Stored under `bonk_pop_settings_v1` with schema version `1`.
 * - Default `reducedMotion` follows the OS `prefers-reduced-motion` query until the player changes the switch.
 * - Backward-compatible with all Step 5 saved settings JSON payloads.
 */
export interface GameSettingsData {
  readonly version?: number;
  readonly musicVolume: number; // 0.0 to 1.0 (default 0.7)
  readonly sfxVolume: number; // 0.0 to 1.0 (default 0.8)
  readonly vibration: boolean; // default true
  readonly reducedMotion: boolean; // default follows OS prefers-reduced-motion until changed
  readonly reducedMotionUserSet?: boolean;
}

interface HostEnvironment {
  localStorage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem?(key: string): void;
  };
  matchMedia?: (query: string) => {
    matches: boolean;
    addEventListener?: (type: string, listener: (e: { matches: boolean }) => void) => void;
  };
}

function getHostEnv(): HostEnvironment {
  return (typeof globalThis !== 'undefined' ? globalThis : {}) as unknown as HostEnvironment;
}

export function detectOsReducedMotion(): boolean {
  try {
    const env = getHostEnv();
    if (typeof env.matchMedia === 'function') {
      return Boolean(env.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
    }
  } catch {
    // Ignore environment lookup errors
  }
  return false;
}

export const defaultSettings: GameSettingsData = {
  version: GameConstants.settingsSchemaVersion,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  vibration: true,
  reducedMotion: detectOsReducedMotion(),
  reducedMotionUserSet: false,
};

export class SettingsRepository {
  private readonly storageKey: string;
  private readonly customStorage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  private readonly osReducedMotionProvider: () => boolean;

  constructor(
    storageKey: string = kSettingsStorageKey,
    customStorage?: {
      getItem(key: string): string | null;
      setItem(key: string, value: string): void;
    },
    osReducedMotionProvider: () => boolean = detectOsReducedMotion
  ) {
    this.storageKey = storageKey;
    this.customStorage = customStorage;
    this.osReducedMotionProvider = osReducedMotionProvider;
  }

  private getStorage() {
    return this.customStorage ?? getHostEnv().localStorage;
  }

  load(): GameSettingsData {
    const osDefault = this.osReducedMotionProvider();
    const fallback: GameSettingsData = {
      ...defaultSettings,
      reducedMotion: osDefault,
      reducedMotionUserSet: false,
    };

    const storage = this.getStorage();
    if (!storage) {
      return fallback;
    }

    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw || raw.trim().length === 0) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return fallback;

      const hasExplicitReducedMotion = typeof parsed.reducedMotion === 'boolean';
      const userSet =
        typeof parsed.reducedMotionUserSet === 'boolean'
          ? parsed.reducedMotionUserSet
          : hasExplicitReducedMotion;

      return {
        version: GameConstants.settingsSchemaVersion,
        musicVolume:
          typeof parsed.musicVolume === 'number' && !Number.isNaN(parsed.musicVolume)
            ? Math.max(0, Math.min(1, parsed.musicVolume))
            : fallback.musicVolume,
        sfxVolume:
          typeof parsed.sfxVolume === 'number' && !Number.isNaN(parsed.sfxVolume)
            ? Math.max(0, Math.min(1, parsed.sfxVolume))
            : fallback.sfxVolume,
        vibration:
          typeof parsed.vibration === 'boolean'
            ? parsed.vibration
            : fallback.vibration,
        reducedMotion:
          userSet && hasExplicitReducedMotion ? parsed.reducedMotion : osDefault,
        reducedMotionUserSet: userSet,
      };
    } catch {
      return fallback;
    }
  }

  save(settings: GameSettingsData): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(
        this.storageKey,
        JSON.stringify({
          version: GameConstants.settingsSchemaVersion,
          musicVolume: settings.musicVolume,
          sfxVolume: settings.sfxVolume,
          vibration: settings.vibration,
          reducedMotion: settings.reducedMotion,
          reducedMotionUserSet: settings.reducedMotionUserSet ?? false,
        })
      );
    } catch {
      // Fail silently if storage quota exceeded
    }
  }
}

export type SettingsListener = (settings: GameSettingsData) => void;

export class SettingsNotifier {
  private current: GameSettingsData;
  private readonly repo: SettingsRepository;
  private readonly listeners = new Set<SettingsListener>();

  constructor(repo = new SettingsRepository()) {
    this.repo = repo;
    this.current = this.repo.load();

    // Follow OS prefers-reduced-motion changes dynamically until the player flips the switch
    try {
      const env = getHostEnv();
      const mq = env.matchMedia?.('(prefers-reduced-motion: reduce)');
      mq?.addEventListener?.('change', (e) => {
        if (!this.current.reducedMotionUserSet) {
          this.current = {
            ...this.current,
            reducedMotion: Boolean(e.matches),
          };
          this.notify();
        }
      });
    } catch {
      // Ignore if matchMedia addEventListener is unavailable
    }
  }

  get settings(): GameSettingsData {
    return this.current;
  }

  update(patch: Partial<GameSettingsData>): void {
    const userSetReducedMotion =
      patch.reducedMotion !== undefined
        ? true
        : this.current.reducedMotionUserSet ?? false;
    this.current = {
      ...this.current,
      ...patch,
      reducedMotionUserSet: userSetReducedMotion,
    };
    this.repo.save(this.current);
    this.notify();
  }

  reload(): void {
    this.current = this.repo.load();
    this.notify();
  }

  addListener(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}

export const globalSettingsNotifier = new SettingsNotifier();
