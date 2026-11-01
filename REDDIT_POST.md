# Reddit Post — Pulse v1.0.3

## Title
```text
Pulse v1.0.3: A lightweight liquid glass Spotify client + offline local audio player for Windows
```

---

## Post Body (Copy & Paste directly into Reddit)

Pulse v1.0.3: A lightweight liquid glass Spotify client + offline local audio player for Windows

**What is it?** Pulse is a zero-telemetry, lightweight desktop music player built with a modern liquid glass aesthetic that seamlessly bridges your live Spotify library with offline local audio playback.

Instead of running heavy web wrappers that hog hundreds of megabytes of memory, Pulse is compiled using a native **Rust (Tauri 2.0) + Vite/React** architecture. It implements a dual-engine audio controller that allows you to hot-swap between Spotify Connect and offline IndexedDB audio streams with zero latency, no procedural artifacts, and clean audio isolation.

**What's new in v1.0.3**

* **Isolated Dual-Engine Pipeline**: Completely rewritten playback router between Spotify Connect / Web SDK and HTML5 Web Audio. Switching from imported local tracks to Spotify immediately halts local audio playback with zero bleed or synthesizer fallbacks.
* **Pure Real Data Mode**: Stripped out all mock/curated placeholders. The offline library and playlists now operate exclusively on genuine user files and authenticated Spotify data.
* **Zero Shared Quotas (BYO Client ID)**: Uses direct client-side PKCE authentication with your own free Spotify Developer Client ID. No middleman relay servers, no shared API rate limits, and tokens never leave your local machine.
* **Liquid Glass & Adaptive Palette**: Glassmorphic interface featuring real-time dominant color extraction from current album artwork, along with high-contrast accessibility and non-glass themes (CRT Retro, Brutalist, and OLED Dark).
* **Local File Library & Drag-and-Drop**: Drop any MP3, FLAC, WAV, or M4A directly into the browser. Files are stored and cached locally with offline custom playlist management.
* **Synced Lyrics Engine**: Synchronized line-by-line vocal timing with dynamic auto-scroll and external metadata enrichment.
* **Integrated In-App Auto-Updater**: Native background update checks and one-click NSIS installation directly within the settings interface.

**Installation**

Build from source (requires Node 20+ and Rust):

```bash
git clone https://github.com/berkayyy/pulse
cd pulse
npm install
npm run desktop:build
```

*(Note: Pre-compiled standalone binaries (`Pulse.exe`) and the 5.9MB Windows installer (`Pulse_1.0.3_x64-setup.exe`) are available in the GitHub Releases tab!)*

**Links**

* **GitHub (Source & Releases)**: https://github.com/berkayyy/pulse

---

## Media to Attach on Reddit
Attach either of the generated media files located in the `release/` folder when creating the post:
- `release/pulse-presentation.mp4` (Full HD video demo)
- `release/pulse-showcase.gif` (Autoplaying animated preview)
