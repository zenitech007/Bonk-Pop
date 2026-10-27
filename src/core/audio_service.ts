import {
  GameConstants,
  kAudioMaxConcurrentSounds,
  kAudioMinThrottleGapMs,
} from './constants';
import { GameSettingsData, globalSettingsNotifier } from '../logic/settings';

export const ALL_SFX_NAMES = [
  'click',
  'swap',
  'match',
  'match_c2',
  'match_c3',
  'match_c4',
  'slash',
  'burst',
  'orb',
  'win',
  'lose',
] as const;

export const ALL_MUSIC_TRACKS = ['bgm_calm', 'bgm_level'] as const;
export type MusicTrackName = (typeof ALL_MUSIC_TRACKS)[number];

export const CASCADE_PENTATONIC_TONES = [
  { note: 'C4', frequencyHz: 261.63 },
  { note: 'D4', frequencyHz: 293.66 },
  { note: 'E4', frequencyHz: 329.63 },
  { note: 'G4', frequencyHz: 392.0 },
  { note: 'A4', frequencyHz: 440.0 },
] as const;

export type CascadeChimeNote =
  (typeof CASCADE_PENTATONIC_TONES)[number]['note'];

export function getCascadeChimeTone(cascadeStep: number): {
  readonly note: CascadeChimeNote;
  readonly frequencyHz: number;
} {
  const index = Math.max(
    0,
    Math.min(
      CASCADE_PENTATONIC_TONES.length - 1,
      Math.floor(Number.isFinite(cascadeStep) ? cascadeStep : 1) - 1
    )
  );
  return CASCADE_PENTATONIC_TONES[index];
}

/**
 * Pure Audio and Haptics Service for "Bonk Pop" (Step 5 Part B & Step 6 Part 0.7).
 * - Starts music ONLY after the first user tap/gesture (`hasUserInteracted`).
 * - Crossfades smoothly between `bgm_calm` and `bgm_level` over `GameConstants.musicCrossfadeMs` (500ms).
 * - Pauses music and audio context when the tab is hidden (`visibilitychange`) and resumes when visible.
 * - Enforces minimum 60ms throttle gap (`kAudioMinThrottleGapMs`) between identical SFX.
 * - Caps concurrent SFX voices to max 6 (`kAudioMaxConcurrentSounds`).
 * - Triggers haptic vibration patterns (`light`, `medium`, `heavy`) when enabled.
 * - Fail-safe: never throws or blocks execution on audio errors or offline/autoplay restrictions.
 */
export class AudioService {
  private static instanceVal: AudioService | null = null;
  private audioCtx: AudioContext | null = null;
  private soundBuffers = new Map<string, AudioBuffer>();
  private rawAudioBytes = new Map<string, ArrayBuffer>();
  private lastPlayTime = new Map<string, number>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private bgmAudio: HTMLAudioElement | null = null;
  private fadingOutAudios = new Set<HTMLAudioElement>();
  private crossfadeTimerId: number | null = null;
  private currentBgmTrack: MusicTrackName | null = null;
  private hasUserInteracted = false;
  private pausedByVisibility = false;
  private settings: GameSettingsData = globalSettingsNotifier.settings;

  private constructor() {
    globalSettingsNotifier.addListener((s) => {
      this.settings = s;
      if (this.bgmAudio) {
        const targetVol = Math.max(0, Math.min(1, s.musicVolume));
        this.bgmAudio.volume = targetVol;
        if (targetVol <= 0.01 && !this.bgmAudio.paused) {
          this.bgmAudio.pause();
        } else if (
          targetVol > 0.01 &&
          this.bgmAudio.paused &&
          this.hasUserInteracted &&
          !this.pausedByVisibility &&
          this.currentBgmTrack
        ) {
          this.bgmAudio.play().catch(() => {});
        }
      }
    });

    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.hasUserInteracted = true;
        this.ensureContext();
        if (
          this.currentBgmTrack &&
          this.settings.musicVolume > 0.01 &&
          (!this.bgmAudio || this.bgmAudio.paused)
        ) {
          this.startOrCrossfadeTrack(this.currentBgmTrack);
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pausedByVisibility = true;
          if (this.bgmAudio && !this.bgmAudio.paused) {
            try {
              this.bgmAudio.pause();
            } catch {}
          }
          for (const fading of this.fadingOutAudios) {
            try {
              fading.pause();
            } catch {}
          }
          if (this.audioCtx && this.audioCtx.state === 'running') {
            this.audioCtx.suspend().catch(() => {});
          }
        } else {
          this.pausedByVisibility = false;
          if (this.audioCtx && this.audioCtx.state === 'suspended' && this.hasUserInteracted) {
            this.audioCtx.resume().catch(() => {});
          }
          if (
            this.hasUserInteracted &&
            this.currentBgmTrack &&
            this.settings.musicVolume > 0.01 &&
            this.bgmAudio &&
            this.bgmAudio.paused
          ) {
            this.bgmAudio.play().catch(() => {});
          }
        }
      });
    }
  }

  static get instance(): AudioService {
    if (!AudioService.instanceVal) {
      AudioService.instanceVal = new AudioService();
    }
    return AudioService.instanceVal;
  }

  get isUserUnlocked(): boolean {
    return this.hasUserInteracted;
  }

  get activeTrack(): MusicTrackName | null {
    return this.currentBgmTrack;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (
        this.audioCtx &&
        this.audioCtx.state === 'suspended' &&
        this.hasUserInteracted &&
        !this.pausedByVisibility
      ) {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Preloads SFX and music files during the initial loading splash (Step 6 Part 0.4).
   * Never throws if an asset fails to fetch or decode.
   */
  async preloadAll(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    try {
      const sfxTasks = ALL_SFX_NAMES.map(async (name) => {
        try {
          const resp = await fetch(`/assets/audio/sfx/${name}.wav`);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            this.rawAudioBytes.set(name, buf);
          }
        } catch {
          // Ignore individual asset failure
        }
      });
      await Promise.allSettled(sfxTasks);
    } catch {
      // Never block app launch
    }
  }

  async loadBuffer(name: string, url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (this.soundBuffers.has(name)) {
      return this.soundBuffers.get(name)!;
    }
    try {
      let arrayBuf = this.rawAudioBytes.get(name);
      if (!arrayBuf) {
        const resp = await fetch(url);
        arrayBuf = await resp.arrayBuffer();
      } else {
        arrayBuf = arrayBuf.slice(0);
      }
      const decoded = await ctx.decodeAudioData(arrayBuf);
      this.soundBuffers.set(name, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  playSfx(name: string, pathUrl?: string): void {
    this.hasUserInteracted = true;
    if (this.settings.sfxVolume <= 0.01) return;

    const now = performance.now();
    const last = this.lastPlayTime.get(name) ?? -Infinity;
    if (now - last < kAudioMinThrottleGapMs) {
      return; // Throttled: same sound at most once per 60ms
    }
    this.lastPlayTime.set(name, now);

    // Concurrency limit: at most 6 active sounds at once
    if (this.activeSources.size >= kAudioMaxConcurrentSounds) {
      const oldest = this.activeSources.values().next().value;
      if (oldest) {
        try {
          oldest.stop();
        } catch {}
        this.activeSources.delete(oldest);
      }
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const url = pathUrl ?? `/assets/audio/sfx/${name}.wav`;
    const cached = this.soundBuffers.get(name);

    const playWithBuffer = (buf: AudioBuffer) => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buf;

        const gainNode = ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, this.settings.sfxVolume));

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        this.activeSources.add(source);
        source.onended = () => {
          this.activeSources.delete(source);
        };
        source.start(0);
      } catch {}
    };

    if (cached) {
      playWithBuffer(cached);
    } else {
      this.loadBuffer(name, url).then((buf) => {
        if (buf) playWithBuffer(buf);
      });
    }
  }

  private lastChimeTone: {
    note: CascadeChimeNote;
    frequencyHz: number;
  } | null = null;

  get lastPlayedCascadeChime(): {
    readonly note: CascadeChimeNote;
    readonly frequencyHz: number;
  } | null {
    return this.lastChimeTone;
  }

  /**
   * Plays a synthesized Web Audio Matsuri wind-chime tone (C4, D4, E4, G4, A4)
   * matching the cascade wave depth (1..5+).
   */
  playCascadeChime(cascadeStep = 1): {
    readonly note: CascadeChimeNote;
    readonly frequencyHz: number;
  } {
    const tone = getCascadeChimeTone(cascadeStep);
    this.lastChimeTone = tone;
    this.hasUserInteracted = true;

    if (this.settings.sfxVolume <= 0.01) {
      return tone;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      return tone;
    }

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.frequencyHz, now);
      // Subtle harmonic shimmer upward at the tail
      osc.frequency.exponentialRampToValueAtTime(
        tone.frequencyHz * 1.008,
        now + 0.22
      );

      const peakGain = Math.max(0.02, Math.min(0.32, this.settings.sfxVolume * 0.26));
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Never block gameplay if Web Audio synth is unavailable
    }

    return tone;
  }

  playClick(): void {
    this.playSfx('click');
  }

  playSwap(): void {
    this.playSfx('swap');
    this.vibrate('light');
  }

  playMatch(cascade = 1): void {
    this.playCascadeChime(cascade);
    if (cascade <= 1) {
      this.playSfx('match');
    } else if (cascade === 2) {
      this.playSfx('match_c2');
    } else if (cascade === 3) {
      this.playSfx('match_c3');
    } else {
      this.playSfx('match_c4');
    }
  }

  playSlash(): void {
    this.playSfx('slash');
    this.vibrate('medium');
  }

  playBurst(): void {
    this.playSfx('burst');
    this.vibrate('medium');
  }

  playOrb(): void {
    this.playSfx('orb');
    this.vibrate('heavy');
  }

  playWin(): void {
    this.playSfx('win');
  }

  playLose(): void {
    this.playSfx('lose');
  }

  playMusic(track: MusicTrackName, forceFromUserTap = false): void {
    if (typeof window === 'undefined') return;
    if (forceFromUserTap) {
      this.hasUserInteracted = true;
    }

    const previousTrack = this.currentBgmTrack;
    this.currentBgmTrack = track;

    // Music starts ONLY after the first user tap/interaction
    if (!this.hasUserInteracted || this.pausedByVisibility) {
      return;
    }

    if (previousTrack === track && this.bgmAudio) {
      this.bgmAudio.volume = Math.max(0, Math.min(1, this.settings.musicVolume));
      if (this.bgmAudio.paused && this.settings.musicVolume > 0.01) {
        this.bgmAudio.play().catch(() => {});
      }
      return;
    }

    this.startOrCrossfadeTrack(track);
  }

  private startOrCrossfadeTrack(track: MusicTrackName): void {
    if (typeof window === 'undefined') return;

    const targetVolume = Math.max(0, Math.min(1, this.settings.musicVolume));
    const outgoing = this.bgmAudio;

    if (this.crossfadeTimerId !== null) {
      window.clearInterval(this.crossfadeTimerId);
      this.crossfadeTimerId = null;
    }

    const incoming = new Audio(`/assets/audio/music/${track}.wav`);
    incoming.loop = true;
    this.bgmAudio = incoming;

    if (targetVolume <= 0.01) {
      incoming.volume = 0;
      if (outgoing) {
        try {
          outgoing.pause();
          outgoing.src = '';
        } catch {}
      }
      return;
    }

    // If there is an active playing outgoing track, crossfade over ~500ms
    if (outgoing && !outgoing.paused) {
      this.fadingOutAudios.add(outgoing);
      const startOutVol = outgoing.volume;
      incoming.volume = 0;
      incoming.play().catch(() => {});

      const durationMs = GameConstants.musicCrossfadeMs;
      const stepMs = 25;
      const totalSteps = Math.max(1, Math.round(durationMs / stepMs));
      let step = 0;

      this.crossfadeTimerId = window.setInterval(() => {
        step++;
        const t = Math.min(1, step / totalSteps);
        const currentTarget = Math.max(0, Math.min(1, this.settings.musicVolume));
        try {
          outgoing.volume = Math.max(0, startOutVol * (1 - t));
          if (this.bgmAudio === incoming) {
            incoming.volume = currentTarget * t;
          }
        } catch {}

        if (t >= 1) {
          if (this.crossfadeTimerId !== null) {
            window.clearInterval(this.crossfadeTimerId);
            this.crossfadeTimerId = null;
          }
          try {
            outgoing.pause();
            outgoing.src = '';
          } catch {}
          this.fadingOutAudios.delete(outgoing);
        }
      }, stepMs);
    } else {
      if (outgoing) {
        try {
          outgoing.pause();
          outgoing.src = '';
        } catch {}
      }
      incoming.volume = targetVolume;
      incoming.play().catch(() => {});
    }
  }

  stopMusic(): void {
    if (this.crossfadeTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.crossfadeTimerId);
      this.crossfadeTimerId = null;
    }
    for (const fading of this.fadingOutAudios) {
      try {
        fading.pause();
        fading.src = '';
      } catch {}
    }
    this.fadingOutAudios.clear();
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
      } catch {}
      this.currentBgmTrack = null;
    }
  }

  vibrate(pattern: 'light' | 'medium' | 'heavy'): void {
    if (
      !this.settings.vibration ||
      typeof navigator === 'undefined' ||
      !navigator.vibrate
    ) {
      return;
    }
    try {
      switch (pattern) {
        case 'light':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(28);
          break;
        case 'heavy':
          navigator.vibrate([40, 30, 60]);
          break;
      }
    } catch {}
  }
}

export const audioService = AudioService.instance;
