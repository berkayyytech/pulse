# Legal Disclaimer & Spotify Attribution / Branding Compliance

## 1. Non-Affiliation & Non-Commercial Disclaimer

**Pulse** is an independent, community-developed, free and open-source software project released under the [MIT License](./LICENSE).

- **Not Affiliated with Spotify:** Pulse is **not** affiliated with, endorsed by, certified by, or sponsored by Spotify AB or any of its subsidiaries.
- **Trademarks:** "Spotify" and Spotify logos are trademarks or registered trademarks of Spotify AB. Pulse uses its own original application name, icon (`public/icons/pulse-icon.svg`), and "Studio Glass & Warm Phosphor" visual design system.
- **Non-Commercial Use Only:** Pulse contains zero advertisements, zero paywalls, zero subscriptions, zero hosted multi-user proxy backends, and zero telemetry or data harvesting.
- **Bring Your Own Client ID:** Pulse distributes zero Spotify API credentials. Each user creates and configures their own personal Development Mode Client ID under their own acceptance of the [Spotify Developer Terms](https://developer.spotify.com/terms).

---

## 2. Spotify Attribution, Branding & Developer Terms Compliance Checklist

| Requirement | Pulse Implementation | Status |
| :--- | :--- | :--- |
| **Official APIs Only** | Uses only `accounts.spotify.com` (PKCE `S256`), `api.spotify.com/v1`, and `sdk.scdn.co/spotify-player.js`. Never calls undocumented internal desktop/web private APIs. | Verified |
| **No Hardcoded Client ID or Secret** | Zero keys in source, build artifacts, or CI configs; PKCE public client flow with encrypted `TokenVault` storage. | Verified |
| **No Audio Stream Ripping, Caching, or Ad/DRM Bypass** | Audio playback uses only the official Spotify Web Playback SDK (Premium + standard OS/Browser EME) or remote control of official Spotify Connect devices. Service Worker (`src/sw.ts`) explicitly ignores Spotify API and audio/SDK origins. | Verified |
| **Uncropped Artwork Integrity** | Album and playlist artwork in `NowPlayingBar`, `LibraryView`, and `CompactNowPlayingView` renders intact without overlays, distortion, or cropping that obscures artist/album art. | Verified |
| **Direct Attribution Links Back to Spotify** | `NowPlayingBar` displays a direct `"Open on Spotify"` link pointing to the item's canonical `external_urls.spotify` URL whenever Spotify content is active. | Verified |
| **Clear Labeling of Non-Spotify External Data** | Synced lyrics (`LRCLIB`), recording/ISRC gap metadata (`MusicBrainz`, `Cover Art Archive`), and artist bios (`Last.fm`) are strictly opt-in (off by default) and explicitly badged (`Source: LRCLIB`, `External: MusicBrainz`, `External: Last.fm`) so external data is never misattributed to Spotify. | Verified |
| **Distinct App Identity** | Named "Pulse" with warm amber/teal studio palette (`#F5A623` / `#2DD4BF`), avoiding confusion with Spotify's green brand marks or official client UI. | Verified |
| **Complete User Data Deletion** | `Privacy & Sources` provides one-click deletion of all cached Spotify metadata in IndexedDB and all encrypted tokens in `TokenVault`. | Verified |
