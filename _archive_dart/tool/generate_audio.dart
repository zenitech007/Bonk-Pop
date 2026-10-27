import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

/// Pure Dart PCM WAV audio synthesizer for "Bonk Pop" (Step 5 Part B).
/// Generates original, license-free Japanese pentatonic SFX and seamless music loops.
void main() {
  final dirs = [
    'assets/audio/sfx',
    'assets/audio/music',
    'public/assets/audio/sfx',
    'public/assets/audio/music',
  ];

  for (final dir in dirs) {
    Directory(dir).createSync(recursive: true);
  }

  final sfxFiles = <String, Float32List Function()>{
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

  final musicFiles = <String, Float32List Function()>{
    'bgm_calm.wav': synthBgmCalm,
    'bgm_level.wav': synthBgmLevel,
  };

  for (final entry in sfxFiles.entries) {
    final bytes = createWavBytes(entry.value());
    File('assets/audio/sfx/${entry.key}').writeAsBytesSync(bytes);
    File('public/assets/audio/sfx/${entry.key}').writeAsBytesSync(bytes);
  }

  for (final entry in musicFiles.entries) {
    final bytes = createWavBytes(entry.value());
    File('assets/audio/music/${entry.key}').writeAsBytesSync(bytes);
    File('public/assets/audio/music/${entry.key}').writeAsBytesSync(bytes);
  }

  stdout.writeln('Successfully synthesized all Bonk Pop audio WAV files in Dart!');
}

Uint8List createWavBytes(Float32List samples, {int sampleRate = 22050}) {
  const numChannels = 1;
  const bitsPerSample = 16;
  final byteRate = (sampleRate * numChannels * bitsPerSample) ~/ 8;
  final blockAlign = (numChannels * bitsPerSample) ~/ 8;
  final dataSize = samples.length * 2;
  final totalSize = 44 + dataSize;
  final bytes = Uint8List(totalSize);
  final bd = ByteData.sublistView(bytes);

  // RIFF
  bytes.setRange(0, 4, 'RIFF'.codeUnits);
  bd.setUint32(4, 36 + dataSize, Endian.little);
  bytes.setRange(8, 12, 'WAVE'.codeUnits);

  // fmt
  bytes.setRange(12, 16, 'fmt '.codeUnits);
  bd.setUint32(16, 16, Endian.little);
  bd.setUint16(20, 1, Endian.little); // PCM
  bd.setUint16(22, numChannels, Endian.little);
  bd.setUint32(24, sampleRate, Endian.little);
  bd.setUint32(28, byteRate, Endian.little);
  bd.setUint16(32, blockAlign, Endian.little);
  bd.setUint16(34, bitsPerSample, Endian.little);

  // data
  bytes.setRange(36, 40, 'data'.codeUnits);
  bd.setUint32(40, dataSize, Endian.little);

  var offset = 44;
  for (var i = 0; i < samples.length; i++) {
    final s = samples[i].clamp(-1.0, 1.0);
    final val = s < 0 ? (s * 0x8000).toInt() : (s * 0x7FFF).toInt();
    bd.setInt16(offset, val.clamp(-32768, 32767), Endian.little);
    offset += 2;
  }

  return bytes;
}

const double d4 = 293.66;
const double f4 = 349.23;
const double g4 = 392.00;
const double a4 = 440.00;
const double c5 = 523.25;
const double d5 = 587.33;
const double f5 = 698.46;
const double a5 = 880.00;

Float32List synthClick() {
  const sr = 22050;
  final len = (sr * 0.045).toInt();
  final buf = Float32List(len);
  final rng = Random(42);
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = exp(-t * 90);
    final noise = (rng.nextDouble() * 2 - 1) * 0.4;
    final tone = sin(2 * pi * 1200 * t) * 0.6;
    buf[i] = (noise + tone) * env * 0.7;
  }
  return buf;
}

Float32List synthSwap() {
  const sr = 22050;
  final len = (sr * 0.1).toInt();
  final buf = Float32List(len);
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = sin((pi * i) / len) * (1 - i / len);
    final freq = 420 + sin(t * 30) * 80;
    buf[i] = sin(2 * pi * freq * t) * env * 0.55;
  }
  return buf;
}

Float32List synthMatch(int cascade) {
  const sr = 22050;
  final len = (sr * 0.35).toInt();
  final buf = Float32List(len);
  final pitchMult = pow(1.12, min(cascade - 1, 6));
  final baseFreq = g4 * pitchMult;
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = exp(-t * 11);
    final f1 = sin(2 * pi * baseFreq * t);
    final f2 = sin(2 * pi * baseFreq * 2.01 * t) * 0.4;
    final f3 = sin(2 * pi * baseFreq * 3.02 * t) * 0.2;
    buf[i] = (f1 + f2 + f3) * env * 0.65;
  }
  return buf;
}

Float32List synthSlash() {
  const sr = 22050;
  final len = (sr * 0.28).toInt();
  final buf = Float32List(len);
  final rng = Random(13);
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = sin((pi * i) / len) * exp(-t * 8);
    final freq = 1200 * exp(-t * 12) + 200;
    final noise = (rng.nextDouble() * 2 - 1) * 0.25;
    buf[i] = (sin(2 * pi * freq * t) * 0.75 + noise) * env * 0.7;
  }
  return buf;
}

Float32List synthBurst() {
  const sr = 22050;
  final len = (sr * 0.38).toInt();
  final buf = Float32List(len);
  final rng = Random(99);
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = exp(-t * 12);
    final punch = sin(2 * pi * (160 * exp(-t * 18)) * t) * 0.8;
    final sparkle = sin(2 * pi * 980 * t) * 0.35;
    final noise = (rng.nextDouble() * 2 - 1) * 0.2;
    buf[i] = (punch + sparkle + noise) * env * 0.75;
  }
  return buf;
}

Float32List synthOrb() {
  const sr = 22050;
  final len = (sr * 0.65).toInt();
  final buf = Float32List(len);
  for (var i = 0; i < len; i++) {
    final t = i / sr;
    final env = sin(min(1.0, t * 12) * (pi / 2)) * exp(-t * 4);
    final trem = 1 + 0.15 * sin(2 * pi * 7 * t);
    final s1 = sin(2 * pi * d5 * t);
    final s2 = sin(2 * pi * f5 * t) * 0.8;
    final s3 = sin(2 * pi * a5 * t) * 0.7;
    final s4 = sin(2 * pi * (d5 * 2) * t) * 0.4;
    buf[i] = ((s1 + s2 + s3 + s4) / 2.9) * env * trem * 0.7;
  }
  return buf;
}

Float32List synthWinFanfare() {
  const sr = 22050;
  final len = (sr * 1.2).toInt();
  final buf = Float32List(len);
  final notes = [
    (f: d5, start: 0.0, dur: 0.25),
    (f: f5, start: 0.24, dur: 0.25),
    (f: a5, start: 0.48, dur: 0.7),
  ];
  for (final n in notes) {
    final startIdx = (n.start * sr).toInt();
    final noteLen = (n.dur * sr).toInt();
    for (var i = 0; i < noteLen && startIdx + i < len; i++) {
      final t = i / sr;
      final env = sin(min(1.0, t * 25) * (pi / 2)) * exp(-t * 3.8);
      final s = sin(2 * pi * n.f * t) + 0.3 * sin(4 * pi * n.f * t);
      buf[startIdx + i] += s * env * 0.45;
    }
  }
  return buf;
}

Float32List synthLoseJingle() {
  const sr = 22050;
  final len = (sr * 0.9).toInt();
  final buf = Float32List(len);
  final notes = [
    (f: g4, start: 0.0, dur: 0.4),
    (f: d4, start: 0.36, dur: 0.52),
  ];
  for (final n in notes) {
    final startIdx = (n.start * sr).toInt();
    final noteLen = (n.dur * sr).toInt();
    for (var i = 0; i < noteLen && startIdx + i < len; i++) {
      final t = i / sr;
      final env = exp(-t * 4.5);
      final s = sin(2 * pi * n.f * t) * 0.8 + 0.2 * sin(3 * pi * n.f * t);
      buf[startIdx + i] += s * env * 0.45;
    }
  }
  return buf;
}

Float32List synthBgmCalm() {
  const sr = 22050;
  const bpm = 88;
  const beatSec = 60 / bpm;
  const loopBeats = 16;
  const durSec = loopBeats * beatSec;
  final len = (sr * durSec).toInt();
  final buf = Float32List(len);

  final melodyNotes = [
    (beat: 0, f: d4),
    (beat: 2, f: f4),
    (beat: 4, f: a4),
    (beat: 6, f: d5),
    (beat: 8, f: c5),
    (beat: 10, f: a4),
    (beat: 12, f: g4),
    (beat: 14, f: f4),
  ];

  for (final m in melodyNotes) {
    final startIdx = (m.beat * beatSec * sr).toInt();
    final noteSamples = (sr * beatSec * 2.5).toInt();
    for (var i = 0; i < noteSamples; i++) {
      final targetIdx = (startIdx + i) % len;
      final t = i / sr;
      final env = exp(-t * 2.8);
      final s = sin(2 * pi * m.f * t) * 0.6 +
          sin(4 * pi * m.f * t) * 0.25 +
          sin(6 * pi * m.f * t) * 0.1;
      buf[targetIdx] += s * env * 0.32;
    }
  }

  for (var i = 0; i < len; i++) {
    final t = i / sr;
    buf[i] += sin(2 * pi * 146.83 * t) * 0.08;
  }

  return buf;
}

Float32List synthBgmLevel() {
  const sr = 22050;
  const bpm = 112;
  const beatSec = 60 / bpm;
  const loopBeats = 16;
  const durSec = loopBeats * beatSec;
  final len = (sr * durSec).toInt();
  final buf = Float32List(len);

  final festivalPattern = [
    (beat: 0, f: d4),
    (beat: 1, f: f4),
    (beat: 2, f: g4),
    (beat: 3, f: a4),
    (beat: 4, f: d5),
    (beat: 5, f: c5),
    (beat: 6, f: a4),
    (beat: 7, f: g4),
    (beat: 8, f: f4),
    (beat: 9, f: g4),
    (beat: 10, f: a4),
    (beat: 11, f: c5),
    (beat: 12, f: d5),
    (beat: 13, f: a4),
    (beat: 14, f: f4),
    (beat: 15, f: d4),
  ];

  for (final m in festivalPattern) {
    final startIdx = (m.beat * beatSec * sr).toInt();
    final noteSamples = (sr * beatSec * 1.6).toInt();
    for (var i = 0; i < noteSamples; i++) {
      final targetIdx = (startIdx + i) % len;
      final t = i / sr;
      final env = exp(-t * 5.2);
      final s = sin(2 * pi * m.f * t) * 0.5 + sin(3 * pi * m.f * t) * 0.2;
      buf[targetIdx] += s * env * 0.28;
    }
  }

  for (var b = 0; b < loopBeats; b += 2) {
    final startIdx = (b * beatSec * sr).toInt();
    for (var i = 0; i < 400 && startIdx + i < len; i++) {
      final t = i / sr;
      final tap = sin(2 * pi * 750 * t) * exp(-t * 80) * 0.18;
      buf[startIdx + i] += tap;
    }
  }

  return buf;
}
