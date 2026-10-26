# Contributing to Pulse

Thank you for helping build a fast, open, officially compliant Spotify client!

---

## Core Engineering & Compliance Guardrails

1. **Never Commit Credentials or Secrets**
   - Never hardcode or commit a Spotify `client_id`, `client_secret`, `access_token`, `refresh_token`, or third-party API key anywhere in source code, tests, fixtures, or CI workflows.
   - Pulse uses **OAuth 2.0 Authorization Code with PKCE (`S256`)** exclusively.

2. **Respect Spotify's Developer Terms**
   - Do **not** propose PRs that bypass ads, circumvent Spotify Premium checks, strip/tamper with EME/Widevine DRM, download/rip audio streams, or scrape web-player private internal APIs (`spclient`).
   - All Spotify communication must go through documented `https://api.spotify.com/v1/*` endpoints and `https://sdk.scdn.co/spotify-player.js`.

3. **2026 Development Mode Endpoint Discipline**
   - All network calls to Spotify **must** be added as typed methods on [`src/api/spotifyClient.ts`](./src/api/spotifyClient.ts) backed by defensive Zod schemas in [`src/api/schemas/`](./src/api/schemas/).
   - Never call removed pre-2026 endpoints (`PUT/DELETE /me/tracks`, `POST /users/{id}/playlists`, `GET /playlists/{id}/tracks`, `GET /artists/{id}/top-tracks`, or batch `GET /tracks?ids=...`).
   - Never assume removed fields (`popularity`, `available_markets`, `user.product`, `user.email`, `album.label`) exist on payloads.
   - Always clamp `/v1/search` `limit` to $\le 10$ and chunk `/v1/me/library` URI lists to $\le 40$.

4. **Strict Module & Security Boundaries**
   - ESLint enforces that only `src/features/auth` and `src/features/privacy` may import `@/platform/tokenVault`.
   - Third-party external enrichments (LRCLIB, MusicBrainz, Cover Art Archive, Last.fm) must remain **disabled (`false`) by default** until explicitly opted in by the user, and must render a visible source attribution pill in the UI.
   - Themes may only set `--pulse-*` CSS custom properties validated by `ThemePackSchema`.
   - Plugins must execute inside Web Workers via `src/features/plugins/pluginSandboxHost.ts` with zero access to tokens.

---

## Local Verification Checklist Before Opening a PR

Run all checks from the repository root:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

### Accessibility & Performance Standards
- **WCAG 2.1 AA:** Maintain $\ge 4.5:1$ text contrast, keyboard operability for every interactive control, semantic ARIA labels on icon buttons, and `:focus-visible` outlines.
- **Reduced Motion:** Respect `@media (prefers-reduced-motion: reduce)` and `[data-reduced-motion="true"]`.
- **Large Libraries:** Lists capable of exceeding 200 items must use `@tanstack/react-virtual`.
