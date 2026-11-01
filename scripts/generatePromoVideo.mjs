#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'release');

// 1. Locate FFmpeg binary
function findFfmpeg() {
  const check = spawnSync('where.exe', ['ffmpeg'], { encoding: 'utf8' });
  if (check.status === 0 && check.stdout.trim()) {
    const firstLine = check.stdout.trim().split(/\r?\n/)[0];
    if (firstLine && existsSync(firstLine.trim())) {
      return firstLine.trim();
    }
  }

  const wingetPath = resolve(
    process.env.LOCALAPPDATA || 'C:\\Users\\berka\\AppData\\Local',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe'
  );
  if (existsSync(wingetPath)) {
    return wingetPath;
  }

  throw new Error('FFmpeg was not found. Please install ffmpeg or add it to PATH.');
}

// 2. Synthesize ambient electronic synthwave soundtrack (16-bit Stereo PCM WAV)
function generateSoundtrack(durationSec = 32, sampleRate = 44100) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt Subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data Subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Chords progression across 32s (4 chords x 8s each)
  // Chord 1 (0-8s): Fmaj7 (F3=174.61, A3=220, C4=261.63, E4=329.63, Bass=87.31)
  // Chord 2 (8-16s): G (G3=196.00, B3=246.94, D4=293.66, F4=349.23, Bass=98.00)
  // Chord 3 (16-24s): Em7 (E3=164.81, G3=196.00, B3=246.94, D4=293.66, Bass=82.41)
  // Chord 4 (24-32s): Am7 (A3=220.00, C4=261.63, E4=329.63, G4=392.00, Bass=110.00)
  const chords = [
    { bass: 87.31, notes: [174.61, 220.0, 261.63, 329.63, 523.25] },
    { bass: 98.00, notes: [196.0, 246.94, 293.66, 349.23, 587.33] },
    { bass: 82.41, notes: [164.81, 196.0, 246.94, 293.66, 659.25] },
    { bass: 110.0, notes: [220.0, 261.63, 329.63, 392.0, 523.25] },
  ];

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.min(3, Math.floor((t / durationSec) * 4));
    const chord = chords[chordIndex];

    // Master fade in (0-1.5s) and fade out (30-32s)
    let masterEnv = 1.0;
    if (t < 1.5) {
      masterEnv = t / 1.5;
    } else if (t > durationSec - 2.0) {
      masterEnv = Math.max(0, (durationSec - t) / 2.0);
    }

    // Warm Sub Bass (Sine wave with slight saturation)
    const bassFreq = chord.bass;
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.28;

    // Polyphonic Warm Glass Pad (detuned sine/triangle blend)
    let pad = 0;
    for (let n = 0; n < chord.notes.length; n++) {
      const f = chord.notes[n];
      const detune = 1.002;
      const v1 = Math.sin(2 * Math.PI * f * t);
      const v2 = Math.sin(2 * Math.PI * (f * detune) * t);
      pad += (v1 + v2) * 0.045;
    }

    // Shimmering High Pluck / Arpeggio (16th notes tempo ~ 118 BPM => beat = 0.508s)
    const beatLen = 0.508;
    const arpIdx = Math.floor((t % (beatLen * 2)) / (beatLen / 2)) % chord.notes.length;
    const arpFreq = chord.notes[arpIdx] * 2;
    const arpEnv = Math.exp(-12 * (t % (beatLen / 2)));
    const pluck = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.12;

    // Rhythmic Soft Kick Pulse on downbeats
    const kickTime = t % beatLen;
    const kickEnv = Math.exp(-22 * kickTime);
    const kick = Math.sin(2 * Math.PI * (68 * (1 - kickTime * 3)) * kickTime) * kickEnv * 0.22;

    // Gentle stereo panning
    const leftSample = (bass + pad * 0.9 + pluck * 0.7 + kick) * masterEnv;
    const rightSample = (bass + pad * 0.9 + pluck * 1.3 + kick) * masterEnv;

    const clamp = (val) => Math.max(-1, Math.min(1, val));
    const intL = Math.floor(clamp(leftSample) * 32767);
    const intR = Math.floor(clamp(rightSample) * 32767);

    buffer.writeInt16LE(intL, offset);
    buffer.writeInt16LE(intR, offset + 2);
    offset += 4;
  }

  return buffer;
}

async function main() {
  console.log('🎬 Pulse Automated Video Presentation Generator');
  console.log('================================================');

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const ffmpegBin = findFfmpeg();
  console.log(`✓ Detected FFmpeg: ${ffmpegBin}`);

  const tempDir = join(OUTPUT_DIR, '.video-temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // 1. Synthesize background soundtrack
  console.log('🎵 Synthesizing high-fidelity ambient synthwave soundtrack (28s)...');
  const wavBuffer = generateSoundtrack(28, 44100);
  const audioPath = join(tempDir, 'pulse_soundtrack.wav');
  writeFileSync(audioPath, wavBuffer);
  console.log(`✓ Soundtrack written: ${audioPath}`);

  // 2. Launch Chromium and record presentation HTML
  console.log('🌐 Launching Chromium engine to capture presentation scenes...');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: tempDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const showcaseUrl = pathToFileURL(join(ROOT_DIR, 'scripts', 'showcase.html')).href;

  console.log('📹 Recording high-definition 60fps presentation...');
  await page.goto(showcaseUrl, { waitUntil: 'load' });

  // Wait for the timeline in showcase.html to complete (passing null for arg so options is 3rd param)
  await page.waitForFunction(() => window.__IS_SHOWCASE_DONE__ === true, null, {
    timeout: 60000,
    polling: 500,
  });

  await page.waitForTimeout(500);
  await context.close();
  await browser.close();

  // Find the recorded webm file in tempDir
  const recordedFiles = readdirSync(tempDir).filter((f) => f.endsWith('.webm'));
  if (recordedFiles.length === 0) {
    throw new Error('No video file was produced by Playwright.');
  }

  const rawWebmPath = join(tempDir, recordedFiles[0]);
  console.log(`✓ Raw presentation captured: ${rawWebmPath}`);

  // 3. Encode final MP4 with FFmpeg (H.264 High Profile + AAC 192k audio)
  const finalMp4Path = join(OUTPUT_DIR, 'pulse-presentation.mp4');
  console.log('⚡ Encoding final MP4 with H.264 & stereo soundtrack...');

  const ffmpegArgs = [
    '-y',
    '-i', rawWebmPath,
    '-i', audioPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    finalMp4Path,
  ];

  const ffmpegRes = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'inherit' });
  if (ffmpegRes.status !== 0) {
    throw new Error(`FFmpeg encoding failed with status ${ffmpegRes.status}`);
  }

  // 4. Generate a quick animated GIF preview for social media & GitHub README
  const finalGifPath = join(OUTPUT_DIR, 'pulse-showcase.gif');
  console.log('🖼️ Generating animated GIF preview for GitHub README & Discord...');
  const gifArgs = [
    '-y',
    '-i', finalMp4Path,
    '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    '-t', '16',
    finalGifPath,
  ];
  spawnSync(ffmpegBin, gifArgs, { stdio: 'ignore' });

  // Cleanup temporary files
  try {
    unlinkSync(audioPath);
    unlinkSync(rawWebmPath);
  } catch {
    // ignore
  }

  console.log('\n🎉 ================================================');
  console.log('✅ Video presentation successfully generated!');
  console.log(`📹 MP4 Video: ${finalMp4Path}`);
  console.log(`🖼️ Animated GIF: ${finalGifPath}`);
  console.log('================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Video generation failed:', err);
  process.exit(1);
});
