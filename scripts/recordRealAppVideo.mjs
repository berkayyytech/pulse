#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'release');

// 1. Locate FFmpeg binary
function findFfmpeg() {
  const wingetPath = resolve(
    process.env.LOCALAPPDATA || 'C:\\Users\\berka\\AppData\\Local',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe'
  );
  if (existsSync(wingetPath)) {
    return wingetPath;
  }
  return 'ffmpeg';
}

// 2. Synthesize Drake "One Dance" inspired 104 BPM dancehall / synth groove
function generateSoundtrack(durationSec = 34, sampleRate = 44100) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // 104 BPM = ~0.5769s per beat, 2.3077s per 4-beat measure
  const bpm = 104;
  const beatLen = 60 / bpm;
  const barLen = beatLen * 4;

  // Key: Bb minor / Db major (Drake "One Dance" harmonic progression)
  // Bbm -> Gbmaj7 -> Db -> Ab
  const chords = [
    { bass: 58.27, notes: [233.08, 277.18, 349.23, 466.16] }, // Bbm
    { bass: 46.25, notes: [185.00, 233.08, 277.18, 349.23] }, // Gb
    { bass: 69.30, notes: [277.18, 349.23, 415.30, 554.37] }, // Db
    { bass: 51.91, notes: [207.65, 261.63, 311.13, 415.30] }, // Ab
  ];

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const barProgress = (t % (barLen * 4)) / barLen;
    const chordIndex = Math.min(3, Math.floor(barProgress));
    const chord = chords[chordIndex];

    // Master volume envelope (fade in 1.2s, fade out last 2.2s)
    let masterEnv = 1.0;
    if (t < 1.2) {
      masterEnv = t / 1.2;
    } else if (t > durationSec - 2.2) {
      masterEnv = Math.max(0, (durationSec - t) / 2.2);
    }

    // 1. Deep Sub Bass (Warm 808 style sine with subtle second harmonic)
    const bassTone = Math.sin(2 * Math.PI * chord.bass * t) + 0.3 * Math.sin(4 * Math.PI * chord.bass * t);
    const bass = bassTone * 0.22;

    // 2. Warm Lush Analog Pad
    let pad = 0;
    for (let n = 0; n < chord.notes.length; n++) {
      const f = chord.notes[n];
      pad += (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t)) * 0.035;
    }

    // 3. Dancehall / Afrobeats rhythmic pluck on off-beats (the "One Dance" syncopation)
    const sixteenth = beatLen / 4;
    const stepInBar = Math.floor((t % barLen) / sixteenth);
    const stepTime = (t % barLen) % sixteenth;
    // Classic syncopation on steps 3, 6, 11, 14
    const isPluckStep = stepInBar === 3 || stepInBar === 6 || stepInBar === 11 || stepInBar === 14;
    let pluck = 0;
    if (isPluckStep) {
      const pluckEnv = Math.exp(-24 * stepTime);
      const noteIdx = (stepInBar % chord.notes.length);
      const pluckFreq = chord.notes[noteIdx] * 2;
      pluck = (Math.sin(2 * Math.PI * pluckFreq * t) + 0.4 * Math.sin(4 * Math.PI * pluckFreq * t)) * pluckEnv * 0.16;
    }

    // 4. Drums: Soft Kick on beats 0 & 2, syncopated rimshot on 3, 6, 11, 14
    const beatTime = t % beatLen;
    const isKickBeat = Math.floor((t % barLen) / beatLen) % 2 === 0;
    let kick = 0;
    if (isKickBeat && beatTime < 0.25) {
      const kickEnv = Math.exp(-22 * beatTime);
      kick = Math.sin(2 * Math.PI * (74 * (1 - beatTime * 2.8)) * beatTime) * kickEnv * 0.24;
    }

    // Soft shaker on every 16th note
    const shakerEnv = Math.exp(-40 * stepTime);
    const noise = (Math.random() * 2 - 1) * shakerEnv * 0.03;

    // Stereo mix
    const leftSample = (bass + pad * 0.9 + pluck * 0.75 + kick + noise * 0.8) * masterEnv;
    const rightSample = (bass + pad * 0.9 + pluck * 1.25 + kick + noise * 1.2) * masterEnv;

    const clamp = (val) => Math.max(-1, Math.min(1, val));
    buffer.writeInt16LE(Math.floor(clamp(leftSample) * 32767), offset);
    buffer.writeInt16LE(Math.floor(clamp(rightSample) * 32767), offset + 2);
    offset += 4;
  }

  return buffer;
}

// 3. Virtual Mouse Cursor & Navigation Helpers
async function clickElement(page, selector, textHint = '') {
  try {
    const el = await page.$(selector);
    if (!el) {
      console.log(`[Cursor] Note: Element not found: ${selector} ${textHint}`);
      return;
    }
    const box = await el.boundingBox();
    if (!box) return;

    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await page.evaluate(({ x, y }) => {
      window.__moveCursor?.(x, y, false);
    }, { x: targetX, y: targetY });

    await page.waitForTimeout(380);

    await page.evaluate(({ x, y }) => {
      window.__moveCursor?.(x, y, true);
    }, { x: targetX, y: targetY });

    await el.click().catch(() => undefined);
    await page.waitForTimeout(250);
  } catch (err) {
    console.log(`[Cursor] Click error: ${err.message}`);
  }
}

async function moveCursorTo(page, x, y) {
  await page.evaluate(({ x, y }) => {
    window.__moveCursor?.(x, y, false);
  }, { x, y });
  await page.waitForTimeout(350);
}

async function setCaption(page, text) {
  await page.evaluate((t) => {
    window.__setCaption?.(t);
  }, text);
}

async function main() {
  console.log('🎬 Pulse Real-Software Screen Capture Generator');
  console.log('================================================');

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const tempDir = join(OUTPUT_DIR, '.video-real-temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const ffmpegBin = findFfmpeg();
  console.log(`✓ FFmpeg binary: ${ffmpegBin}`);

  // 1. Start local Vite preview server for the actual Pulse software
  console.log('🚀 Launching real Pulse web runtime server on http://127.0.0.1:4173...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    cwd: ROOT_DIR,
    shell: true,
  });

  // Give preview 2.5 seconds to bind
  await new Promise((r) => setTimeout(r, 2500));

  let browser = null;
  let context = null;

  try {
    // 2. Launch Chromium with Playwright video recording
    console.log('🌐 Opening real Pulse software in Chromium (1280x720 60fps)...');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({
      headless: true,
      args: ['--enable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: tempDir,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();

    // Inject user's Spotify Client ID and external LRCLIB opt-in before document load
    await page.addInitScript(() => {
      localStorage.setItem('pulse.spotify.clientId', '6d4f26ad93674fb1bba5bdf2541e66c2');
      localStorage.setItem('pulse.auth.accountTier', 'spotify-premium');
      localStorage.setItem(
        'pulse.privacy.externalSources',
        JSON.stringify({
          lrclibEnabled: true,
          musicBrainzEnabled: true,
          coverArtArchiveEnabled: true,
          lastFmEnabled: false,
        })
      );
    });

    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

    // Inject virtual mouse cursor and animated lower-third caption banner
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.id = '__virtual_cursor__';
      cursor.style.position = 'fixed';
      cursor.style.left = '640px';
      cursor.style.top = '360px';
      cursor.style.width = '18px';
      cursor.style.height = '18px';
      cursor.style.borderRadius = '50%';
      cursor.style.backgroundColor = '#10b981';
      cursor.style.border = '2px solid #ffffff';
      cursor.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.95)';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '999999';
      cursor.style.transition = 'left 0.42s cubic-bezier(0.16, 1, 0.3, 1), top 0.42s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s ease';
      cursor.style.transform = 'translate(-50%, -50%)';
      document.body.appendChild(cursor);

      const banner = document.createElement('div');
      banner.id = '__feature_caption__';
      banner.style.position = 'fixed';
      banner.style.bottom = '22px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.padding = '10px 24px';
      banner.style.borderRadius = '999px';
      banner.style.background = 'rgba(5, 11, 8, 0.92)';
      banner.style.backdropFilter = 'blur(16px)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.5)';
      banner.style.boxShadow = '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.3)';
      banner.style.color = '#ffffff';
      banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = '700';
      banner.style.letterSpacing = '0.02em';
      banner.style.zIndex = '999998';
      banner.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
      banner.textContent = 'Pulse // Next-Gen Glass Audio Player (MIT)';
      document.body.appendChild(banner);

      window.__setCaption = (text) => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(-50%) translateY(8px)';
        setTimeout(() => {
          banner.textContent = text;
          banner.style.opacity = '1';
          banner.style.transform = 'translateX(-50%) translateY(0)';
        }, 200);
      };

      window.__moveCursor = (x, y, click = false) => {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        if (click) {
          cursor.style.transform = 'translate(-50%, -50%) scale(0.68)';
          setTimeout(() => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          }, 180);
        }
      };
    });

    console.log('🎥 Recording live interaction tour of real Pulse software...');

    // ACT 1: Intro to Frutiger Aero Glass Interface (0.0s - 3.5s)
    await setCaption(page, 'Pulse // Next-Gen Glass Audio Player (MIT)');
    await moveCursorTo(page, 400, 260);
    await page.waitForTimeout(1600);
    await moveCursorTo(page, 760, 280);
    await page.waitForTimeout(1400);

    // ACT 2: Spotify Search & Drake Playback (3.5s - 9.5s)
    await setCaption(page, 'Powered by Client ID 6d4f26ad… • Searching Drake');
    await clickElement(page, 'input.gp-search-input');
    await page.waitForTimeout(200);
    await page.type('input.gp-search-input', 'Drake', { delay: 90 });
    await page.waitForTimeout(500);

    await setCaption(page, 'Now Playing • Drake — One Dance (Album: Views)');
    // Click on the first track row (Drake — One Dance)
    await clickElement(page, '.gp-track-row:first-child');
    // Let vinyl spin and waveform animate
    await page.waitForTimeout(2800);

    // ACT 3: Synced Lyrics from LRCLIB (9.5s - 15.0s)
    await setCaption(page, 'Live Synced Lyrics (LRCLIB) • "Baby, I like your style…"');
    await clickElement(page, 'button[aria-label="Synced lyrics & metadata"]');
    // Pause to let synced lyrics load and display
    await page.waitForTimeout(3800);
    // Close lyrics drawer
    await clickElement(page, 'button[aria-label="Close synced lyrics"], button[aria-label="Close lyrics drawer"]');
    await page.waitForTimeout(800);

    // ACT 4: Zero Spotify Premium Required • Local Playlists & Files (15.0s - 20.0s)
    await setCaption(page, 'Zero Spotify Premium Required • Offline Playlists & MP3 Import');
    // Clear search box
    await clickElement(page, 'input.gp-search-input');
    await page.evaluate(() => {
      const input = document.querySelector('input.gp-search-input');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Click "Playlists" tab in Left Glass Browser
    await clickElement(page, 'button[role="tab"]:has-text("Playlists")');
    await page.waitForTimeout(1800);

    // Click "Local" tab to show local library
    await clickElement(page, 'button[role="tab"]:has-text("Local")');
    await page.waitForTimeout(1600);

    // ACT 5: Instant Aesthetic Engine / Dynamic Themes (20.0s - 27.0s)
    await setCaption(page, 'Instant Aesthetic Engine • 6 Distinct Visual Themes');
    // Open Settings gear
    await clickElement(page, 'button[aria-label="Open Settings"]');
    await page.waitForTimeout(1000);

    // Click Tokyo Neon Dusk (Vaporwave/Cyberpunk)
    await setCaption(page, 'Tokyo Neon Dusk • Cyberpunk Glass Theme');
    await clickElement(page, 'button:has-text("Tokyo Neon Dusk"), button:has-text("Vaporwave")');
    await page.waitForTimeout(1600);

    // Click Phosphor Matrix CRT Terminal
    await setCaption(page, 'Phosphor CRT Terminal • Retro Monochromatic Green');
    await clickElement(page, 'button:has-text("Phosphor CRT"), button:has-text("Matrix")');
    await page.waitForTimeout(1600);

    // Click Neo-Brutalist Zine
    await setCaption(page, 'Neo-Brutalist Zine • High-Contrast Editorial Style');
    await clickElement(page, 'button:has-text("Neo-Brutalist"), button:has-text("Brutalist")');
    await page.waitForTimeout(1600);

    // Return to Frutiger Aero 2007
    await setCaption(page, 'Frutiger Aero 2007 • Liquid Glass & Dynamic Caustics');
    await clickElement(page, 'button:has-text("Frutiger Aero")');
    await page.waitForTimeout(1200);

    // ACT 6: Background Silent Auto-Updates (27.0s - 31.0s)
    await setCaption(page, 'Silent Background Auto-Updates • Powered by GitHub Releases');
    // Scroll down in Settings to reveal UpdateSettingsCard
    await page.evaluate(() => {
      const sheet = document.querySelector('.gp-settings-sheet, [role="dialog"], main');
      if (sheet) sheet.scrollTop = 350;
    });
    await page.waitForTimeout(2400);

    // Close Settings
    await clickElement(page, 'button[aria-label="Close Settings"]');
    await page.waitForTimeout(800);

    // ACT 7: Outro & Download CTA (31.0s - 34.0s)
    await setCaption(page, 'Pulse • 100% Free & Open Source • github.com/berkayyytech/pulse');
    await moveCursorTo(page, 640, 360);
    await page.waitForTimeout(3000);

    console.log('✓ Screen recording completed. Closing Chromium session...');
    await context.close();
    await browser.close();
  } finally {
    // Kill the preview server
    if (preview && preview.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/T', '/PID', preview.pid.toString()], { shell: true });
      } else {
        preview.kill();
      }
    }
  }

  // Find the captured webm file
  const recordedFiles = readdirSync(tempDir).filter((f) => f.endsWith('.webm'));
  if (recordedFiles.length === 0) {
    throw new Error('No video file was captured.');
  }
  const rawWebmPath = join(tempDir, recordedFiles[0]);
  console.log(`✓ Real software video captured: ${rawWebmPath}`);

  // Synthesize background soundtrack
  console.log('🎵 Generating 104 BPM dancehall / synth soundtrack...');
  const wavBuffer = generateSoundtrack(34, 44100);
  const audioPath = join(tempDir, 'soundtrack.wav');
  writeFileSync(audioPath, wavBuffer);

  // Encode final MP4 with FFmpeg
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

  const ffmpegRun = spawn(ffmpegBin, ffmpegArgs, { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    ffmpegRun.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  // Generate animated GIF preview
  const finalGifPath = join(OUTPUT_DIR, 'pulse-showcase.gif');
  console.log('🖼️ Generating animated GIF preview...');
  const gifRun = spawn(ffmpegBin, [
    '-y',
    '-i', finalMp4Path,
    '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    '-t', '16',
    finalGifPath,
  ], { stdio: 'ignore' });
  await new Promise((resolve) => gifRun.on('close', resolve));

  // Cleanup temp files
  try {
    unlinkSync(audioPath);
    unlinkSync(rawWebmPath);
  } catch {
    // ignore
  }

  console.log('\n🎉 ================================================');
  console.log('✅ Real-Software Presentation Video Successfully Rendered!');
  console.log(`📹 MP4 Video: ${finalMp4Path}`);
  console.log(`🖼️ Animated GIF: ${finalGifPath}`);
  console.log('================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Video generation failed:', err);
  process.exit(1);
});
