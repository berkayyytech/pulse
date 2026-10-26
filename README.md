# Pulse — Open-Source BYO-Client-ID Music Client for Spotify

> **Legal & Non-Affiliation Disclaimer:**  
> **Pulse is an independent, free, open-source, non-commercial software project and is NOT affiliated with, endorsed by, certified by, or sponsored by Spotify AB.**  
> "Spotify" is a registered trademark of Spotify AB. All streamed audio, catalog metadata, and album artwork remain the property of Spotify AB and respective rightsholders. Pulse ships **zero API keys, client secrets, or shared credentials** — each user supplies their own personal Spotify Developer Client ID. See [`LEGAL_AND_COMPLIANCE.md`](./LEGAL_AND_COMPLIANCE.md) for the full compliance and attribution checklist.

---

## Why Pulse Instead of Client Patching (Spicetify)?

Binary patchers inject custom CSS and JavaScript into Spotify's proprietary desktop client DOM — breaking whenever Spotify ships an internal layout or CEF update. **Pulse** takes a clean, officially supported path:

- **Zero binary patching:** Standalone app powered strictly by the **Spotify Web API** and **Web Playback SDK** (plus **Spotify Connect** remote control).
- **Bring Your Own Client ID:** Designed around Spotify's 2026 Development Mode rules (~5 authorized users per app, active Premium required on app owner).
- **Unbreakable CSS Token Themes & 5 Surface Engines:** Choose from **25 built-in themes** across **Frutiger Aero (`aero`)**, **Solid Matte (`matte`)**, **Terminal & Hardware (`terminal`)**, **Neo-Brutalist (`brutalist`)**, **Borderless Minimal (`minimal`)**, and **Liquid Glass (`glass`)**, plus 3 shell layouts (`Split Panels`, `Bottom Bar`, `Zen Stage`), 4 artwork presentations (including spinning vinyl), and 4 typography stacks — all bound to `--pulse-*` CSS custom properties (`tokens.css`) and validated by Zod.
- **248 Local Achievements & Interactive Easter Eggs:** Earn 248 Bronze-to-Mythic trophies and Listener Ranks purely on-device (zero telemetry) by listening to music, curating playlists, customizing themes, and discovering hidden Easter eggs (Konami Code, Star Fox barrel roll, bouncing DVD screensaver, 2007 Frutiger soap bubbles, Winamp tribute, DJ vinyl scratch, and more).
- **Sandboxed Web Worker Plugins:** Plugins declare explicit permissions (`read:player`, `ui:slot`, `network:<hostname>`) and run inside isolated Web Workers with **zero access to OAuth tokens**.
- **2026 API Resilience:** Defensive Zod schemas normalize renamed fields (`items` / `item`), handle omitted fields (`popularity`, `product`, `email`, `label`), batch unified `/me/library` calls ($\le 40$ URIs), clamp `/search` to `limit <= 10`, honor `429 Retry-After`, and degrade `403` endpoints gracefully with human explanations.
- **Same Codebase Everywhere:** Runs as an installable **Static PWA** (zero backend server) and as a native **Tauri v2** desktop app.

---

## Step-by-Step: Creating Your Spotify Client ID (3 Minutes)

### Step 1 — Create an App in the Spotify Developer Dashboard
1. Sign into [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) using an account with **active Spotify Premium**.
2. Click **Create app**.
3. Enter any App Name (e.g., `My Pulse Client`) and App Description (`Personal Pulse music player`).
4. Under **Which API/SDKs are you planning to use?**, check **both**:
   - `[x] Web API`
   - `[x] Web Playback SDK`

> `![Screenshot Placeholder: Spotify Dashboard Create App form with Web API and Web Playback SDK checked](./docs/screenshots/01-create-app.png)`

### Step 2 — Register the Exact Redirect URI (Never Use `localhost`)
Spotify disallows `http://localhost` in Redirect URIs. Copy the exact URI shown in Pulse's Onboarding Wizard:

- **PWA / Local Dev Browser:** `http://127.0.0.1:5173/auth/callback` *(or `http://127.0.0.1:4173/auth/callback` for `npm run preview`, or `https://<your-static-domain>/auth/callback` when deployed)*
- **Tauri Desktop App:** `http://127.0.0.1:43821/auth/callback`

Paste it into **Redirect URIs**, click **Add**, and click **Save** at the bottom of the page.

> `![Screenshot Placeholder: Redirect URIs section showing http://127.0.0.1:5173/auth/callback added and saved](./docs/screenshots/02-redirect-uri-127-0-0-1.png)`

### Step 3 — Verify Allowlist Under "Users and Access"
If you sign in with the same Spotify account that created the app, you're automatically authorized. If you add up to 5 household/test seats, open **Settings → Users and Access** and add each person's name and Spotify account email.

> `![Screenshot Placeholder: Spotify Dashboard Users and Access tab](./docs/screenshots/03-users-and-access-allowlist.png)`

### Step 4 — Paste Your Client ID into Pulse
1. Copy the **32-character hexadecimal Client ID** *(never copy or paste the Client Secret — Pulse uses PKCE and never needs a secret)*.
2. Paste it into Pulse's **Client ID Setup** screen and click **Save & Test PKCE Sign-In**.

> `![Screenshot Placeholder: Pulse Onboarding Wizard showing green validated 32-hex Client ID and PKCE Sign-In button](./docs/screenshots/04-pulse-pkce-onboarding.png)`

---

## Running Pulse (Desktop `.exe` or Browser PWA)

### Option A — Standalone Windows Desktop App (`.exe`)
- **Portable Executable:** Double-click `release/Pulse.exe` (or `src-tauri/target/release/Pulse.exe`) — runs immediately with zero installation.
- **Windows Setup Installer:** Run `release/Pulse_0.1.0_x64-setup.exe` (or `src-tauri/target/release/bundle/nsis/Pulse_0.1.0_x64-setup.exe`) to add Start Menu & Desktop shortcuts.
- **Spotify Dashboard Redirect URI for Desktop `.exe`:** `http://127.0.0.1:43821/auth/callback`

### Option B — Development & Static PWA Build

#### Prerequisites
- **Node.js 22+** and **npm 10+**
- *(For building the native `.exe` from source)*: **Rust (`rustup`)** + **MinGW-w64 / MSVC**

#### Commands

```bash
# 1. Install workspace dependencies
npm install

# 2. Start web development server on http://127.0.0.1:5173
npm run dev

# 3. Build native Windows desktop .exe + NSIS installer
npm run desktop:build

# 4. Run native Tauri v2 desktop window in live-reload dev mode
npm run desktop:dev

# 5. Build static PWA bundle into ./dist & preview on http://127.0.0.1:4173
npm run build
npm run preview

# 6. Run quality gates
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

### Special Window Modes
- **Compact Mini-Player:** Open `http://127.0.0.1:5173/?mode=mini` (or click the Mini-Player button in the playback bar).
- **OBS Studio Browser Source Overlay:** Add a Browser Source in OBS pointing to `http://127.0.0.1:5173/?mode=obs` (`520×140`, transparent background).
- **Command Palette:** Press `Ctrl+K` (`Cmd+K` on macOS) anywhere to jump between views, control playback, apply themes, run plugin commands, or remap keyboard shortcuts.

---

## Developing Themes & Sandboxed Plugins

### Creating a Plugin (`create-pulse-plugin`)
```bash
node packages/create-pulse-plugin/src/cli.ts my-plugin
```
Plugins declare permissions in `manifest.json` (validated by `@pulse/plugin-sdk` v1.0) and load via **Plugins → Plugin Developer Hot-Reload Server** (`http://127.0.0.1:4580/manifest.json`).

---

## Known Limitations from Spotify's API (2026 Development Mode)

Pulse designs transparently around Spotify's official February/March 2026 Web API rules rather than attempting unsupported workarounds:

1. **App Owner Must Maintain Spotify Premium:** Development Mode apps require the Client ID owner to hold an active Spotify Premium subscription. If Premium lapses, Spotify returns `403 Forbidden` across Web API and Web Playback SDK calls.
2. **~5 Authorized Users per Client ID:** Each Development Mode Client ID is limited to ~5 allowlisted test users in *Dashboard → Users and Access*. Every Pulse user therefore brings their own Client ID.
3. **`localhost` Prohibited in Redirect URIs:** Spotify rejects `http://localhost:*`. Local HTTP Redirect URIs must use explicit IPv4/IPv6 loopback literals (`http://127.0.0.1:<port>/auth/callback` or `http://[::1]:<port>/auth/callback`); hosted PWAs require `https://`.
4. **Search `limit` Reduced from 50 to 10:** `GET /v1/search` maximum `limit` is `10` (default `5`) in Development Mode. Pulse clamps search requests to `10` automatically so Spotify never rejects queries with `400 Invalid limit`.
5. **Unowned Editorial & Algorithmic Playlists Omit `items`:** Fetching editorial/algorithmic playlists you do not own (`GET /v1/playlists/{id}`) returns basic header metadata with `items` omitted (`undefined`) or `403`. Pulse detects `itemsRestrictedByDevMode` and explains why in the UI.
6. **Unified Library Endpoints (`<= 40` URIs per Request):** Entity-specific save/remove/check endpoints (`PUT/DELETE /me/tracks`, `/me/albums`, `/me/following`) were replaced by `PUT /v1/me/library`, `DELETE /v1/me/library`, and `GET /v1/me/library/contains` capped at **40 Spotify URIs** per request. Pulse chunks bulk operations automatically.
7. **Removed Catalog & Discovery Endpoints:** `GET /v1/artists/{id}/top-tracks`, batch multi-ID endpoints (`GET /v1/tracks?ids=...`, `/albums`, `/artists`), `/browse/new-releases`, `/browse/categories`, `/recommendations`, and `/audio-features` were removed from Development Mode. Artist pages in Pulse combine discography (`GET /v1/artists/{id}/albums`), your saved tracks by that artist, and strictly opt-in Last.fm/MusicBrainz context.
8. **Removed Object Fields:** `user.product`, `user.email`, `user.country`, `user.explicit_content`, `user.followers`, `track.popularity`, `track.available_markets`, `track.external_ids`, `artist.popularity`, `artist.followers`, and `album.label` are omitted in 2026 responses and never required by Pulse.
9. **Web Playback SDK EME / Widevine Support:** Streaming audio directly inside Pulse via the Web Playback SDK requires standard EME support (available in Chrome/Edge/Firefox PWAs and Windows Tauri `WebView2`). On OS WebViews lacking Widevine (such as macOS `WKWebView`), Pulse automatically switches to **Spotify Connect Remote Control Mode** without bundling unauthorized DRM modules.

---

## Documentation Index
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Folder layout, strict module boundaries, data flow diagrams, and 2026 endpoint table.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Development workflow, 2026 API guardrails, MSW contract testing, and accessibility rules.
- [`LEGAL_AND_COMPLIANCE.md`](./LEGAL_AND_COMPLIANCE.md) — Legal disclaimer & Spotify Developer Terms / Attribution compliance checklist.
- [`LICENSE`](./LICENSE) — MIT License.
