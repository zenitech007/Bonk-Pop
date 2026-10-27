import * as fs from 'fs';
import * as path from 'path';

/**
 * Pure TypeScript PCM WAV synthesizer for "Bonk Pop" (Step 5).
 * Generates original Japanese pentatonic chimes, bamboo clicks, whooshes,
 * and seamless background music loops. 100% license-free and mathematically synthesized.
 */

function createWavBuffer(samples: Float32Array, sampleRate = 22050): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(val), offset);
    offset += 2;
  }

  return buffer;
}

// Japanese Yo / In pentatonic frequencies: D4 (293.66), F4 (349.23), G4 (392.00), A4 (440.00), C5 (523.25), D5 (587.33)
const D4 = 293.66;
const F4 = 349.23;
const G4 = 392.00;
const A4 = 440.00;
const C5 = 523.25;
const D5 = 587.33;
const F5 = 698.46;
const A5 = 880.00;

function synthClick(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.045);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 90);
    const noise = (Math.random() * 2 - 1) * 0.4;
    const tone = Math.sin(2 * Math.PI * 1200 * t) * 0.6;
    buf[i] = (noise + tone) * env * 0.7;
  }
  return buf;
}

function synthSwap(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.1);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.sin((Math.PI * i) / len) * (1 - i / len);
    const freq = 420 + Math.sin(t * 30) * 80;
    buf[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.55;
  }
  return buf;
}

function synthMatch(cascade = 1): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.35);
  const buf = new Float32Array(len);
  const pitchMult = Math.pow(1.12, Math.min(cascade - 1, 6));
  const baseFreq = G4 * pitchMult;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 11);
    const f1 = Math.sin(2 * Math.PI * baseFreq * t);
    const f2 = Math.sin(2 * Math.PI * baseFreq * 2.01 * t) * 0.4;
    const f3 = Math.sin(2 * Math.PI * baseFreq * 3.02 * t) * 0.2;
    buf[i] = (f1 + f2 + f3) * env * 0.65;
  }
  return buf;
}

function synthSlash(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.28);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.sin((Math.PI * i) / len) * Math.exp(-t * 8);
    // Pitch sweeps rapidly downward (whoosh/blade)
    const freq = 1200 * Math.exp(-t * 12) + 200;
    const noise = (Math.random() * 2 - 1) * 0.25;
    buf[i] = (Math.sin(2 * Math.PI * freq * t) * 0.75 + noise) * env * 0.7;
  }
  return buf;
}

function synthBurst(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.38);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 12);
    // Low punch + mid sparkle
    const punch = Math.sin(2 * Math.PI * (160 * Math.exp(-t * 18)) * t) * 0.8;
    const sparkle = Math.sin(2 * Math.PI * 980 * t) * 0.35;
    const noise = (Math.random() * 2 - 1) * 0.2;
    buf[i] = (punch + sparkle + noise) * env * 0.75;
  }
  return buf;
}

function synthOrb(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.65);
  const buf = new Float32Array(len);
  // Shimmering mystical pentatonic chord: D5, F5, A5
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.sin(Math.min(1, t * 12) * (Math.PI / 2)) * Math.exp(-t * 4);
    const trem = 1 + 0.15 * Math.sin(2 * Math.PI * 7 * t);
    const s1 = Math.sin(2 * Math.PI * D5 * t);
    const s2 = Math.sin(2 * Math.PI * F5 * t) * 0.8;
    const s3 = Math.sin(2 * Math.PI * A5 * t) * 0.7;
    const s4 = Math.sin(2 * Math.PI * (D5 * 2) * t) * 0.4;
    buf[i] = ((s1 + s2 + s3 + s4) / 2.9) * env * trem * 0.7;
  }
  return buf;
}

function synthWinFanfare(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 1.2);
  const buf = new Float32Array(len);
  // Triumphant 3-note melody: D5 -> F5 -> A5 with resonance
  const notes = [
    { f: D5, start: 0.0, dur: 0.25 },
    { f: F5, start: 0.24, dur: 0.25 },
    { f: A5, start: 0.48, dur: 0.7 },
  ];
  for (const n of notes) {
    const startIdx = Math.floor(n.start * sr);
    const noteLen = Math.floor(n.dur * sr);
    for (let i = 0; i < noteLen && startIdx + i < len; i++) {
      const t = i / sr;
      const env = Math.sin(Math.min(1, t * 25) * (Math.PI / 2)) * Math.exp(-t * 3.8);
      const s = Math.sin(2 * Math.PI * n.f * t) + 0.3 * Math.sin(4 * Math.PI * n.f * t);
      buf[startIdx + i] += s * env * 0.45;
    }
  }
  return buf;
}

function synthLoseJingle(): Float32Array {
  const sr = 22050;
  const len = Math.floor(sr * 0.9);
  const buf = new Float32Array(len);
  // Gentle 2-note sigh: G4 -> D4
  const notes = [
    { f: G4, start: 0.0, dur: 0.4 },
    { f: D4, start: 0.36, dur: 0.52 },
  ];
  for (const n of notes) {
    const startIdx = Math.floor(n.start * sr);
    const noteLen = Math.floor(n.dur * sr);
    for (let i = 0; i < noteLen && startIdx + i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 4.5);
      const s = Math.sin(2 * Math.PI * n.f * t) * 0.8 + 0.2 * Math.sin(3 * Math.PI * n.f * t);
      buf[startIdx + i] += s * env * 0.45;
    }
  }
  return buf;
}

function synthBgmCalm(): Float32Array {
  // 12-second seamless calm loop (koto / bell arpeggios on D-minor pentatonic)
  const sr = 22050;
  const bpm = 88;
  const beatSec = 60 / bpm;
  const loopBeats = 16;
  const durSec = loopBeats * beatSec; // ~10.9 sec
  const len = Math.floor(sr * durSec);
  const buf = new Float32Array(len);

  const melodyNotes = [
    { beat: 0, f: D4 },
    { beat: 2, f: F4 },
    { beat: 4, f: A4 },
    { beat: 6, f: D5 },
    { beat: 8, f: C5 },
    { beat: 10, f: A4 },
    { beat: 12, f: G4 },
    { beat: 14, f: F4 },
  ];

  for (const m of melodyNotes) {
    const startSec = m.beat * beatSec;
    const startIdx = Math.floor(startSec * sr);
    const noteSamples = Math.floor(sr * beatSec * 2.5);
    for (let i = 0; i < noteSamples; i++) {
      const targetIdx = (startIdx + i) % len;
      const t = i / sr;
      const env = Math.exp(-t * 2.8);
      // Soft plucked harmonic
      const s =
        Math.sin(2 * Math.PI * m.f * t) * 0.6 +
        Math.sin(4 * Math.PI * m.f * t) * 0.25 +
        Math.sin(6 * Math.PI * m.f * t) * 0.1;
      buf[targetIdx] += s * env * 0.32;
    }
  }

  // Warm bass drone on D3
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const drone = Math.sin(2 * Math.PI * 146.83 * t) * 0.08;
    buf[i] += drone;
  }

  return buf;
}

function synthBgmLevel(): Float32Array {
  // 12-second upbeat festival loop (faster pentatonic bells + gentle percussion tap)
  const sr = 22050;
  const bpm = 112;
  const beatSec = 60 / bpm;
  const loopBeats = 16;
  const durSec = loopBeats * beatSec; // ~8.57 sec
  const len = Math.floor(sr * durSec);
  const buf = new Float32Array(len);

  const festivalPattern = [
    { beat: 0, f: D4 },
    { beat: 1, f: F4 },
    { beat: 2, f: G4 },
    { beat: 3, f: A4 },
    { beat: 4, f: D5 },
    { beat: 5, f: C5 },
    { beat: 6, f: A4 },
    { beat: 7, f: G4 },
    { beat: 8, f: F4 },
    { beat: 9, f: G4 },
    { beat: 10, f: A4 },
    { beat: 11, f: C5 },
    { beat: 12, f: D5 },
    { beat: 13, f: A4 },
    { beat: 14, f: F4 },
    { beat: 15, f: D4 },
  ];

  for (const m of festivalPattern) {
    const startSec = m.beat * beatSec;
    const startIdx = Math.floor(startSec * sr);
    const noteSamples = Math.floor(sr * beatSec * 1.6);
    for (let i = 0; i < noteSamples; i++) {
      const targetIdx = (startIdx + i) % len;
      const t = i / sr;
      const env = Math.exp(-t * 5.2);
      const s =
        Math.sin(2 * Math.PI * m.f * t) * 0.5 +
        Math.sin(3 * Math.PI * m.f * t) * 0.2;
      buf[targetIdx] += s * env * 0.28;
    }
  }

  // Gentle woodblock tap on beats 0, 4, 8, 12
  for (let b = 0; b < loopBeats; b += 2) {
    const startIdx = Math.floor(b * beatSec * sr);
    for (let i = 0; i < 400 && startIdx + i < len; i++) {
      const t = i / sr;
      const tap = Math.sin(2 * Math.PI * 750 * t) * Math.exp(-t * 80) * 0.18;
      buf[startIdx + i] += tap;
    }
  }

  return buf;
}

export function generateAllAudioFiles(): void {
  const dirs = [
    'assets/audio/sfx',
    'assets/audio/music',
    'public/assets/audio/sfx',
    'public/assets/audio/music',
  ];

  for (const dir of dirs) {
    fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
  }

  const sfxFiles: Record<string, () => Float32Array> = {
    'click.wav': synthClick,
    'swap.wav': synthSwap,
    'match.wav': () => synthMatch(1),
    'match_c2.wav': () => synthMatch(2),
    'match_c3.wav': () => synthMatch(3),
    'match_c4.wav': () => synthMatch(4),
    'slash.wav': synthSlash,
    'burst.wav': synthBurst,
    'orb.wav': synthOrb,
    'win.wav': synthWinFanfare,
    'lose.wav': synthLoseJingle,
  };

  const musicFiles: Record<string, () => Float32Array> = {
    'bgm_calm.wav': synthBgmCalm,
    'bgm_level.wav': synthBgmLevel,
  };

  for (const [name, generator] of Object.entries(sfxFiles)) {
    const wav = createWavBuffer(generator());
    fs.writeFileSync(path.resolve('assets/audio/sfx', name), wav);
    fs.writeFileSync(path.resolve('public/assets/audio/sfx', name), wav);
  }

  for (const [name, generator] of Object.entries(musicFiles)) {
    const wav = createWavBuffer(generator());
    fs.writeFileSync(path.resolve('assets/audio/music', name), wav);
    fs.writeFileSync(path.resolve('public/assets/audio/music', name), wav);
  }

  console.log('Successfully generated all original audio WAV files in assets and public!');
}

generateAllAudioFiles();

