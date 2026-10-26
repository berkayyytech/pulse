export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'mythic';

export type AchievementCategory =
  | 'listening'
  | 'playback'
  | 'curator'
  | 'explorer'
  | 'theming'
  | 'studio'
  | 'habits'
  | 'mastery'
  | 'secrets';

export const ACHIEVEMENT_CATEGORY_LABELS: Readonly<Record<AchievementCategory, string>> = {
  listening: 'Listening Time',
  playback: 'Playback & Deck',
  curator: 'Library & Curator',
  explorer: 'Search & Explorer',
  theming: 'Themes & Aero',
  studio: 'Studio & Power',
  habits: 'Habits & Streaks',
  mastery: 'Mastery Ranks',
  secrets: 'Secrets & Eggs',
};

export const TIER_XP: Readonly<Record<AchievementTier, number>> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
  mythic: 150,
};

export type AchievementMetricKey =
  | 'listeningSeconds'
  | 'sessionSecondsPeak'
  | 'tracksStarted'
  | 'tracksCompleted'
  | 'skipNextCount'
  | 'skipPrevCount'
  | 'seekCount'
  | 'pauseToggles'
  | 'uniqueTracksPlayed'
  | 'uniqueArtistsPlayed'
  | 'playlistsCreated'
  | 'playlistsOpened'
  | 'smartPlaylistsCreated'
  | 'tracksSavedCount'
  | 'searchesPerformed'
  | 'uniqueSearchQueries'
  | 'lyricsOpenedCount'
  | 'queueOpenedCount'
  | 'uriImportsOpened'
  | 'themeSwitchesCount'
  | 'uniqueThemesTried'
  | 'customColorsEdited'
  | 'customPresetsSaved'
  | 'commandPaletteOpens'
  | 'commandPaletteRuns'
  | 'settingsOpenedCount'
  | 'shuffleToggles'
  | 'repeatCycles'
  | 'appSessionsCount'
  | 'distinctDaysActive'
  | 'unlockedNonMetaCount';

export type AchievementFlagKey =
  | 'playedLongTrack'
  | 'playedShortTrack'
  | 'playedEpicTrack'
  | 'openedMiniPlayer'
  | 'openedObsOverlay'
  | 'openedDevicePicker'
  | 'triedAeroSurface'
  | 'triedAllFiveAeroThemes'
  | 'triedMatteSurface'
  | 'triedBrutalistSurface'
  | 'triedMinimalSurface'
  | 'triedAllSurfaces'
  | 'triedVinylArtwork'
  | 'triedSharpArtwork'
  | 'triedBottomBarLayout'
  | 'triedZenStageLayout'
  | 'triedMonoFont'
  | 'triedSerifFont'
  | 'triedBubblesTexture'
  | 'shortcutRemapped'
  | 'pluginInstalled'
  | 'themeJsonExported'
  | 'themeJsonImported'
  | 'privacyInspected'
  | 'sampleLibraryLaunched'
  | 'playedEarlyMorning'
  | 'playedMidday'
  | 'playedGoldenHour'
  | 'playedLateNight'
  | 'playedWitchingHour'
  | 'eggKonami'
  | 'eggVinylScratch'
  | 'eggBarrelRoll'
  | 'eggMatrixRain'
  | 'eggDvdBounce'
  | 'eggDvdCornerHit'
  | 'eggWinampLlama'
  | 'eggClubRave'
  | 'eggFrutigerPromise'
  | 'eggVaporwave'
  | 'eggRainyWindow'
  | 'eggTeapot418'
  | 'eggTableFlip'
  | 'eggSettingsTap5'
  | 'volZeroSilence'
  | 'volMaxEleven'
  | 'volAnswer42'
  | 'volSyncClock';

export interface AchievementDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly secretHint?: string;
  readonly category: AchievementCategory;
  readonly tier: AchievementTier;
  readonly secret?: boolean;
  readonly metric?: AchievementMetricKey;
  readonly target?: number;
  readonly unit?: string;
  readonly flag?: AchievementFlagKey;
}

function metricSeries(
  category: AchievementCategory,
  metric: AchievementMetricKey,
  unit: string,
  entries: readonly [
    id: string,
    target: number,
    tier: AchievementTier,
    title: string,
    description: string,
  ][],
): AchievementDefinition[] {
  return entries.map(([id, target, tier, title, description]) => ({
    id,
    title,
    description,
    category,
    tier,
    metric,
    target,
    unit,
  }));
}

function flagEntry(
  id: string,
  category: AchievementCategory,
  tier: AchievementTier,
  flag: AchievementFlagKey,
  title: string,
  description: string,
  secretHint?: string,
): AchievementDefinition {
  return {
    id,
    title,
    description,
    ...(secretHint ? { secretHint } : {}),
    category,
    tier,
    flag,
    secret: category === 'secrets',
  };
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  // =========================================================================
  // 1. LISTENING TIME & SESSION ENDURANCE (28)
  // =========================================================================
  ...metricSeries('listening', 'listeningSeconds', 'sec', [
    ['listen-5s', 5, 'bronze', 'Needle Drop', 'Listen to 5 seconds of music in Pulse.'],
    ['listen-30s', 30, 'bronze', 'Soundcheck Complete', 'Accumulate 30 seconds of active playback.'],
    ['listen-1m', 60, 'bronze', 'First Minute on Air', 'Listen to 1 full minute of music.'],
    ['listen-3m', 180, 'bronze', 'Radio Single', 'Reach 3 minutes of cumulative listening time.'],
    ['listen-5m', 300, 'bronze', 'Five-Minute Warmup', 'Listen for 5 total minutes.'],
    ['listen-10m', 600, 'bronze', 'EP Length', 'Accumulate 10 minutes of active music playback.'],
    ['listen-15m', 900, 'silver', 'Side A Finished', 'Listen for 15 cumulative minutes.'],
    ['listen-30m', 1800, 'silver', 'Half-Hour Broadcast', 'Listen to 30 minutes of music.'],
    ['listen-45m', 2700, 'silver', 'Full LP Runtime', 'Reach 45 minutes of cumulative playback.'],
    ['listen-1h', 3600, 'silver', 'One-Hour Studio Lock', 'Listen for 1 full hour in Pulse.'],
    ['listen-2h', 7200, 'gold', 'Double Album Club', 'Accumulate 2 hours of listening time.'],
    ['listen-3h', 10800, 'gold', 'Festival Setlist', 'Reach 3 hours of total listening time.'],
    ['listen-5h', 18000, 'gold', 'Road Trip Soundtrack', 'Listen for 5 cumulative hours.'],
    ['listen-10h', 36000, 'gold', 'Ten-Hour Audiophile', 'Accumulate 10 hours of music playback.'],
    ['listen-15h', 54000, 'platinum', 'Transatlantic Flight', 'Listen for 15 cumulative hours.'],
    ['listen-24h', 86400, 'platinum', '24-Hour Radio Pirate', 'Accumulate an entire day (24 hours) of music.'],
    ['listen-50h', 180000, 'platinum', 'Fifty-Hour Heavy Rotation', 'Reach 50 hours of playback time.'],
    ['listen-100h', 360000, 'platinum', 'Centurion Listener', 'Cross 100 hours of listening in Pulse.'],
    ['listen-250h', 900000, 'mythic', 'Quarter-Thousand Sonic Monk', 'Listen for 250 cumulative hours.'],
    ['listen-500h', 1800000, 'mythic', 'Eternal Resonance (500h)', 'Reach 500 hours of active music listening.'],
  ]),
  ...metricSeries('listening', 'sessionSecondsPeak', 'sec', [
    ['sess-1m', 60, 'bronze', 'Settling In', 'Keep Pulse open for 1 continuous minute.'],
    ['sess-5m', 300, 'bronze', 'Desk Companion', 'Run a single session for 5 minutes.'],
    ['sess-15m', 900, 'silver', 'Deep Focus Block', 'Keep a single session running for 15 minutes.'],
    ['sess-30m', 1800, 'silver', 'Pomodoro Plus', 'Stay in one Pulse session for 30 minutes.'],
    ['sess-1h', 3600, 'gold', 'Unbroken Flow State', 'Keep Pulse running for 1 hour straight.'],
    ['sess-2h', 7200, 'gold', 'Late Shift Companion', 'Maintain a 2-hour continuous session.'],
    ['sess-4h', 14400, 'platinum', 'Studio Marathon', 'Run a single uninterrupted 4-hour session.'],
    ['sess-8h', 28800, 'mythic', 'Full Workday Broadcast', 'Keep Pulse running for 8 hours in one session.'],
  ]),

  // =========================================================================
  // 2. PLAYBACK & TRANSPORT DECK (46)
  // =========================================================================
  ...metricSeries('playback', 'tracksStarted', 'tracks', [
    ['play-1', 1, 'bronze', 'Hello World of Sound', 'Start playing your very first track.'],
    ['play-3', 3, 'bronze', 'Three-Song Burst', 'Start 3 tracks in Pulse.'],
    ['play-5', 5, 'bronze', 'High Five Queue', 'Start 5 tracks.'],
    ['play-10', 10, 'bronze', 'Warm Amplifier', 'Start 10 tracks.'],
    ['play-20', 20, 'silver', 'Twenty Spins', 'Start 20 tracks.'],
    ['play-35', 35, 'silver', 'Jukebox Regular', 'Start 35 tracks.'],
    ['play-50', 50, 'silver', 'Half-Century Spins', 'Start 50 tracks.'],
    ['play-75', 75, 'silver', 'Selector on Duty', 'Start 75 tracks.'],
    ['play-100', 100, 'gold', 'Triple-Digit DJ', 'Start 100 tracks in Pulse.'],
    ['play-200', 200, 'gold', 'Two-Hundred Club', 'Start 200 tracks.'],
    ['play-350', 350, 'gold', 'Crate Veteran', 'Start 350 tracks.'],
    ['play-500', 500, 'platinum', 'Five-Hundred Grooves', 'Start 500 tracks.'],
    ['play-1000', 1000, 'platinum', 'Thousand-Track Milestone', 'Start 1,000 tracks.'],
    ['play-2500', 2500, 'mythic', 'Broadcast Station', 'Start 2,500 tracks.'],
    ['play-5000', 5000, 'mythic', 'Five-Thousand Legends', 'Start 5,000 tracks in Pulse.'],
  ]),
  ...metricSeries('playback', 'tracksCompleted', 'tracks', [
    ['comp-1', 1, 'bronze', 'No-Skip Respect', 'Listen through a track to the very end.'],
    ['comp-3', 3, 'bronze', 'Attentive Ears', 'Finish 3 tracks to completion.'],
    ['comp-10', 10, 'silver', 'Album Purist', 'Complete 10 tracks without cutting out early.'],
    ['comp-25', 25, 'silver', 'Every Outro Matters', 'Complete 25 full tracks.'],
    ['comp-50', 50, 'gold', 'Fifty Full Spins', 'Finish 50 tracks to the end.'],
    ['comp-100', 100, 'gold', 'Zero-Skip Discipline', 'Complete 100 full tracks.'],
    ['comp-250', 250, 'platinum', 'Devoted Listener', 'Complete 250 tracks all the way through.'],
    ['comp-500', 500, 'platinum', 'Half-Thousand Completions', 'Finish 500 full tracks.'],
    ['comp-1000', 1000, 'mythic', 'Thousand Final Chords', 'Complete 1,000 tracks to the last note.'],
  ]),
  ...metricSeries('playback', 'skipNextCount', 'skips', [
    ['skip-1', 1, 'bronze', 'Not Feeling This One', 'Skip forward to the next track once.'],
    ['skip-5', 5, 'bronze', 'Vibe Check', 'Skip forward 5 times.'],
    ['skip-15', 15, 'silver', 'Restless Thumb', 'Skip forward 15 times.'],
    ['skip-40', 40, 'silver', 'Speed-Dating Songs', 'Skip forward 40 times.'],
    ['skip-100', 100, 'gold', 'Ruthless A&R', 'Skip forward 100 times.'],
    ['skip-300', 300, 'platinum', 'Infinite Channel Surfer', 'Skip forward 300 times.'],
  ]),
  ...metricSeries('playback', 'skipPrevCount', 'rewinds', [
    ['prev-1', 1, 'bronze', 'Run That Back', 'Use Previous Track once.'],
    ['prev-5', 5, 'bronze', 'Wait, Play It Again', 'Use Previous Track 5 times.'],
    ['prev-15', 15, 'silver', 'Bridge Connoisseur', 'Use Previous Track 15 times.'],
    ['prev-50', 50, 'gold', 'Time Loop Specialist', 'Use Previous Track 50 times.'],
  ]),
  ...metricSeries('playback', 'seekCount', 'seeks', [
    ['seek-1', 1, 'bronze', 'Needle Placement', 'Scrub the seek bar to jump within a song.'],
    ['seek-5', 5, 'bronze', 'Skip the Intro', 'Scrub the seek bar 5 times.'],
    ['seek-20', 20, 'silver', 'Drop Hunter', 'Scrub the seek bar 20 times.'],
    ['seek-75', 75, 'gold', 'Waveform Surgeon', 'Scrub the seek bar 75 times.'],
    ['seek-200', 200, 'platinum', 'Precision Tape Splicer', 'Scrub the seek bar 200 times.'],
  ]),
  ...metricSeries('playback', 'pauseToggles', 'toggles', [
    ['pause-1', 1, 'bronze', 'Hold That Thought', 'Toggle Play/Pause once.'],
    ['pause-10', 10, 'bronze', 'Intermission Director', 'Toggle Play/Pause 10 times.'],
    ['pause-40', 40, 'silver', 'Stop-and-Go Traffic', 'Toggle Play/Pause 40 times.'],
    ['pause-150', 150, 'gold', 'Tactile Button Addict', 'Toggle Play/Pause 150 times.'],
  ]),
  flagEntry('flag-long-track', 'playback', 'silver', 'playedLongTrack', 'Prog Odyssey', 'Play a song longer than 5 minutes.'),
  flagEntry('flag-short-track', 'playback', 'bronze', 'playedShortTrack', 'Two-Minute Punk', 'Play a compact song under 2 minutes 30 seconds.'),
  flagEntry('flag-epic-track', 'playback', 'gold', 'playedEpicTrack', 'Symphonic Marathon', 'Play a magnum opus longer than 8 minutes.'),

  // =========================================================================
  // 3. CURATOR, LIBRARY & VARIETY (34)
  // =========================================================================
  ...metricSeries('curator', 'uniqueTracksPlayed', 'songs', [
    ['utrk-1', 1, 'bronze', 'First Impression', 'Play 1 unique song.'],
    ['utrk-3', 3, 'bronze', 'Trio of Tunes', 'Play 3 distinct songs.'],
    ['utrk-5', 5, 'bronze', 'Handful of Hits', 'Play 5 distinct songs.'],
    ['utrk-10', 10, 'silver', 'Ten Distinct Cuts', 'Play 10 unique tracks.'],
    ['utrk-25', 25, 'silver', 'Eclectic Rotation', 'Play 25 unique tracks.'],
    ['utrk-50', 50, 'gold', 'Fifty Fresh Grooves', 'Play 50 unique tracks.'],
    ['utrk-100', 100, 'gold', 'Crate Digger 100', 'Play 100 distinct tracks.'],
    ['utrk-250', 250, 'platinum', 'Deep Catalog Diver', 'Play 250 unique tracks.'],
    ['utrk-500', 500, 'platinum', 'Living Archive (500)', 'Play 500 distinct tracks.'],
    ['utrk-1000', 1000, 'mythic', 'Encyclopedia of Sound', 'Play 1,000 unique tracks.'],
  ]),
  ...metricSeries('curator', 'uniqueArtistsPlayed', 'artists', [
    ['uart-1', 1, 'bronze', 'Solo Act', 'Listen to your first artist in Pulse.'],
    ['uart-3', 3, 'bronze', 'Three-Act Bill', 'Listen to 3 distinct artists.'],
    ['uart-5', 5, 'silver', 'Indie Lineup', 'Listen to 5 distinct artists.'],
    ['uart-10', 10, 'silver', 'Festival Poster', 'Listen to 10 distinct artists.'],
    ['uart-25', 25, 'gold', 'Genre Hopper', 'Listen to 25 distinct artists.'],
    ['uart-50', 50, 'gold', 'Fifty Voices', 'Listen to 50 distinct artists.'],
    ['uart-100', 100, 'platinum', 'World Tour Passport', 'Listen to 100 distinct artists.'],
    ['uart-250', 250, 'mythic', 'Omnivorous Ears (250)', 'Listen to 250 distinct artists.'],
  ]),
  ...metricSeries('curator', 'playlistsCreated', 'playlists', [
    ['plc-1', 1, 'bronze', 'Mixtape Maker', 'Create your first playlist inside Pulse.'],
    ['plc-3', 3, 'silver', 'Mood Architect', 'Create 3 playlists.'],
    ['plc-5', 5, 'silver', 'Five-Star Curator', 'Create 5 playlists.'],
    ['plc-10', 10, 'gold', 'Ten Custom Crates', 'Create 10 playlists.'],
    ['plc-25', 25, 'platinum', 'Chief Programming Officer', 'Create 25 playlists.'],
  ]),
  ...metricSeries('curator', 'playlistsOpened', 'playlists', [
    ['plo-1', 1, 'bronze', 'Opening the Sleeve', 'Open a playlist in the browser.'],
    ['plo-5', 5, 'bronze', 'Shelf Browser', 'Inspect 5 playlists.'],
    ['plo-15', 15, 'silver', 'Playlist Tourist', 'Inspect 15 playlists.'],
    ['plo-40', 40, 'gold', 'Archivist on Patrol', 'Inspect 40 playlists.'],
  ]),
  ...metricSeries('curator', 'smartPlaylistsCreated', 'rulesets', [
    ['smart-1', 1, 'silver', 'Boolean DJ', 'Save your first Smart Playlist rule set.'],
    ['smart-3', 3, 'gold', 'Query Crafter', 'Save 3 Smart Playlist rule sets.'],
    ['smart-5', 5, 'gold', 'Dynamic Librarian', 'Save 5 Smart Playlist rule sets.'],
    ['smart-10', 10, 'platinum', 'Algorithmic Sovereignty', 'Save 10 Smart Playlist rule sets.'],
  ]),
  ...metricSeries('curator', 'tracksSavedCount', 'saves', [
    ['save-1', 1, 'bronze', 'Keeper', 'Save or batch-add tracks in your library.'],
    ['save-10', 10, 'silver', 'Growing Collection', 'Save or batch-add 10 library items.'],
    ['save-50', 50, 'gold', 'Vault Curator', 'Save or batch-add 50 library items.'],
  ]),

  // =========================================================================
  // 4. SEARCH, LYRICS, QUEUE & EXPLORER (28)
  // =========================================================================
  ...metricSeries('explorer', 'searchesPerformed', 'searches', [
    ['srch-1', 1, 'bronze', 'Seeking Signal', 'Run your first search query.'],
    ['srch-3', 3, 'bronze', 'Curious Listener', 'Perform 3 searches.'],
    ['srch-10', 10, 'silver', 'Crate Scout', 'Perform 10 searches.'],
    ['srch-25', 25, 'silver', 'Catalog Detective', 'Perform 25 searches.'],
    ['srch-50', 50, 'gold', 'Fifty Queries Deep', 'Perform 50 searches.'],
    ['srch-100', 100, 'gold', 'Metadata Hound', 'Perform 100 searches.'],
    ['srch-250', 250, 'platinum', 'Index Whisperer', 'Perform 250 searches.'],
    ['srch-500', 500, 'mythic', 'Oracle of the Search Bar', 'Perform 500 searches.'],
  ]),
  ...metricSeries('explorer', 'uniqueSearchQueries', 'terms', [
    ['usrch-3', 3, 'bronze', 'Three New Leads', 'Search for 3 distinct terms.'],
    ['usrch-10', 10, 'silver', 'Ten Horizons', 'Search for 10 distinct terms.'],
    ['usrch-25', 25, 'silver', 'Broad Taste', 'Search for 25 distinct terms.'],
    ['usrch-50', 50, 'gold', 'Uncharted Rabbit Hole', 'Search for 50 distinct terms.'],
    ['usrch-100', 100, 'platinum', 'Hundred-Query Explorer', 'Search for 100 distinct terms.'],
  ]),
  ...metricSeries('explorer', 'lyricsOpenedCount', 'opens', [
    ['lyr-1', 1, 'bronze', 'What Did They Say?', 'Open the Synced Lyrics & Metadata drawer.'],
    ['lyr-5', 5, 'silver', 'Karaoke Rehearsal', 'Open the Lyrics drawer 5 times.'],
    ['lyr-15', 15, 'silver', 'Verse Analyst', 'Open the Lyrics drawer 15 times.'],
    ['lyr-40', 40, 'gold', 'Lead Vocalist', 'Open the Lyrics drawer 40 times.'],
    ['lyr-100', 100, 'platinum', 'Poet Laureate of Lyrics', 'Open the Lyrics drawer 100 times.'],
  ]),
  ...metricSeries('explorer', 'queueOpenedCount', 'opens', [
    ['que-1', 1, 'bronze', 'Up Next Inspector', 'Open the Playback Queue drawer.'],
    ['que-5', 5, 'silver', 'Setlist Planner', 'Open the Queue drawer 5 times.'],
    ['que-20', 20, 'gold', 'Sequencing Obsessive', 'Open the Queue drawer 20 times.'],
    ['que-50', 50, 'platinum', 'Master of Ceremonies', 'Open the Queue drawer 50 times.'],
  ]),
  ...metricSeries('explorer', 'uriImportsOpened', 'opens', [
    ['imp-1', 1, 'bronze', 'Direct Link', 'Open the Spotify Link / URI Import dialog.'],
    ['imp-5', 5, 'silver', 'URI Teleporter', 'Open the Import dialog 5 times.'],
    ['imp-20', 20, 'gold', 'Clipboard Express', 'Open the Import dialog 20 times.'],
  ]),
  flagEntry('flag-mini', 'explorer', 'silver', 'openedMiniPlayer', 'Pocket Sized', 'Launch the compact Mini-Player mode.'),
  flagEntry('flag-obs', 'explorer', 'gold', 'openedObsOverlay', 'Streamer Ready', 'Open the transparent OBS Now-Playing overlay.'),
  flagEntry('flag-devices', 'explorer', 'bronze', 'openedDevicePicker', 'Connect Handshake', 'Open the Spotify Connect device picker.'),

  // =========================================================================
  // 5. THEMES, FRUTIGER AERO & VISUAL ENGINE (36)
  // =========================================================================
  ...metricSeries('theming', 'themeSwitchesCount', 'switches', [
    ['thm-1', 1, 'bronze', 'Fresh Coat of Paint', 'Apply a theme preset once.'],
    ['thm-3', 3, 'bronze', 'Mood Ring', 'Switch themes 3 times.'],
    ['thm-5', 5, 'silver', 'Wardrobe Change', 'Switch themes 5 times.'],
    ['thm-10', 10, 'silver', 'Interior Decorator', 'Switch themes 10 times.'],
    ['thm-20', 20, 'gold', 'Twenty Makeovers', 'Switch themes 20 times.'],
    ['thm-35', 35, 'gold', 'Restless Stylist', 'Switch themes 35 times.'],
    ['thm-50', 50, 'platinum', 'Fifty Shades of Tokens', 'Switch themes 50 times.'],
    ['thm-100', 100, 'platinum', 'Centurion Stylist', 'Switch themes 100 times.'],
    ['thm-200', 200, 'mythic', 'Shapeshifter Supreme', 'Switch themes 200 times.'],
  ]),
  ...metricSeries('theming', 'uniqueThemesTried', 'themes', [
    ['uthm-2', 2, 'bronze', 'Second Opinion', 'Try 2 distinct theme presets.'],
    ['uthm-5', 5, 'silver', 'Tasting Flight', 'Try 5 distinct theme presets.'],
    ['uthm-10', 10, 'silver', 'Half the Wardrobe', 'Try 10 distinct theme presets.'],
    ['uthm-15', 15, 'gold', 'Aesthetic Connoisseur', 'Try 15 distinct theme presets.'],
    ['uthm-20', 20, 'platinum', 'Twenty Worlds Visited', 'Try 20 distinct theme presets.'],
    ['uthm-25', 25, 'mythic', 'Complete Lookbook (All 25)', 'Experience all 25 built-in themes!'],
  ]),
  ...metricSeries('theming', 'customColorsEdited', 'edits', [
    ['col-1', 1, 'bronze', 'Tint Tinkerer', 'Customize a live color token picker.'],
    ['col-5', 5, 'silver', 'Colorist', 'Tweak live color tokens 5 times.'],
    ['col-15', 15, 'gold', 'Palette Alchemist', 'Tweak live color tokens 15 times.'],
    ['col-40', 40, 'platinum', 'Pixel Perfectionist', 'Tweak live color tokens 40 times.'],
  ]),
  ...metricSeries('theming', 'customPresetsSaved', 'presets', [
    ['csav-1', 1, 'silver', 'Signature Look', 'Save your own custom theme preset.'],
    ['csav-3', 3, 'gold', 'Boutique Designer', 'Save 3 custom theme presets.'],
    ['csav-5', 5, 'gold', 'Theme Author', 'Save 5 custom theme presets.'],
    ['csav-10', 10, 'platinum', 'Design System Architect', 'Save 10 custom theme presets.'],
  ]),
  flagEntry('flag-aero', 'theming', 'silver', 'triedAeroSurface', '2007 Called, Everything Is Shiny', 'Activate the glossy Frutiger Aero surface engine.'),
  flagEntry('flag-aero-all', 'theming', 'platinum', 'triedAllFiveAeroThemes', 'Frutiger Aero Historian', 'Experience all 5 Frutiger Aero & Aqua presets.'),
  flagEntry('flag-matte', 'theming', 'bronze', 'triedMatteSurface', 'Anti-Glare Studio', 'Switch to the opaque Solid Matte surface engine.'),
  flagEntry('flag-brutal', 'theming', 'silver', 'triedBrutalistSurface', 'Concrete & Heavy Ink', 'Activate the 2px Neo-Brutalist surface engine.'),
  flagEntry('flag-minimal', 'theming', 'silver', 'triedMinimalSurface', 'Less, But Better', 'Activate the seamless Borderless Minimal surface.'),
  flagEntry('flag-all-surf', 'theming', 'gold', 'triedAllSurfaces', 'Master of Five Materials', 'Try Glass, Frutiger Aero, Matte, Minimal, and Brutalist.'),
  flagEntry('flag-vinyl', 'theming', 'silver', 'triedVinylArtwork', 'Warm Wax 33⅓ RPM', 'Switch album art presentation to Spinning Vinyl.'),
  flagEntry('flag-sharp', 'theming', 'bronze', 'triedSharpArtwork', 'Crisp Gatefold Sleeve', 'Switch album art presentation to Sharp Sleeve.'),
  flagEntry('flag-bottom', 'theming', 'silver', 'triedBottomBarLayout', 'Classic Docked Deck', 'Switch the player layout to Bottom Bar.'),
  flagEntry('flag-zen', 'theming', 'silver', 'triedZenStageLayout', 'Zen Listening Sanctuary', 'Switch the player layout to Zen Stage.'),
  flagEntry('flag-mono', 'theming', 'bronze', 'triedMonoFont', 'Fixed-Width Fidelity', 'Switch typography to Monospace.'),
  flagEntry('flag-serif', 'theming', 'bronze', 'triedSerifFont', 'Editorial Typesetter', 'Switch typography to Editorial Serif.'),
  flagEntry('flag-bubbles', 'theming', 'silver', 'triedBubblesTexture', 'Effervescent Soap Bubbles', 'Enable the Frutiger Soap Bubbles backdrop.'),

  // =========================================================================
  // 6. STUDIO, SHORTCUTS, PLUGINS & POWER USER (26)
  // =========================================================================
  ...metricSeries('studio', 'commandPaletteOpens', 'opens', [
    ['cmd-1', 1, 'bronze', 'Ctrl+K Initiate', 'Open the Command Palette once.'],
    ['cmd-5', 5, 'silver', 'Keyboard Pilot', 'Open the Command Palette 5 times.'],
    ['cmd-15', 15, 'silver', 'Mouse Optional', 'Open the Command Palette 15 times.'],
    ['cmd-40', 40, 'gold', 'Launcher Reflex', 'Open the Command Palette 40 times.'],
    ['cmd-100', 100, 'platinum', 'Command-Line Virtuoso', 'Open the Command Palette 100 times.'],
  ]),
  ...metricSeries('studio', 'commandPaletteRuns', 'commands', [
    ['crun-1', 1, 'bronze', 'Action Dispatched', 'Execute a command from the Command Palette.'],
    ['crun-5', 5, 'silver', 'Quick Draw', 'Execute 5 Command Palette actions.'],
    ['crun-20', 20, 'gold', 'Operator Speed', 'Execute 20 Command Palette actions.'],
    ['crun-75', 75, 'platinum', 'Zero-Latency Workflow', 'Execute 75 Command Palette actions.'],
  ]),
  ...metricSeries('studio', 'settingsOpenedCount', 'opens', [
    ['set-1', 1, 'bronze', 'Under the Hood', 'Open the Settings & Studio sheet.'],
    ['set-5', 5, 'bronze', 'Tinkerer', 'Open Settings 5 times.'],
    ['set-15', 15, 'silver', 'Control Freak', 'Open Settings 15 times.'],
    ['set-40', 40, 'gold', 'Bench Technician', 'Open Settings 40 times.'],
    ['set-100', 100, 'platinum', 'Chief Systems Engineer', 'Open Settings 100 times.'],
  ]),
  ...metricSeries('studio', 'shuffleToggles', 'toggles', [
    ['shuf-1', 1, 'bronze', 'Roll the Dice', 'Toggle Shuffle mode once.'],
    ['shuf-5', 5, 'silver', 'Controlled Entropy', 'Toggle Shuffle 5 times.'],
    ['shuf-25', 25, 'gold', 'Dealer of Fate', 'Toggle Shuffle 25 times.'],
  ]),
  ...metricSeries('studio', 'repeatCycles', 'cycles', [
    ['rep-1', 1, 'bronze', 'Encore!', 'Cycle Repeat mode once.'],
    ['rep-5', 5, 'silver', 'Loop Pedal', 'Cycle Repeat mode 5 times.'],
    ['rep-25', 25, 'gold', 'Certified Earworm', 'Cycle Repeat mode 25 times.'],
  ]),
  flagEntry('flag-remap', 'studio', 'silver', 'shortcutRemapped', 'Custom Keybinds', 'Remap any keyboard shortcut to your liking.'),
  flagEntry('flag-plugin', 'studio', 'gold', 'pluginInstalled', 'Sandboxed Extender', 'Install or enable a sandboxed Web Worker plugin.'),
  flagEntry('flag-json-out', 'studio', 'bronze', 'themeJsonExported', 'Open-Source Sharer', 'Export a theme pack as JSON.'),
  flagEntry('flag-json-in', 'studio', 'silver', 'themeJsonImported', 'Validated Pack Importer', 'Validate and import a JSON theme pack.'),
  flagEntry('flag-privacy', 'studio', 'bronze', 'privacyInspected', 'Trust, Verify', 'Inspect the Zero-Telemetry Privacy & Sources page.'),
  flagEntry('flag-demo', 'studio', 'bronze', 'sampleLibraryLaunched', 'Test Drive', 'Explore Pulse using the offline Sample Library.'),

  // =========================================================================
  // 7. HABITS, SESSIONS & TIME OF DAY (20)
  // =========================================================================
  ...metricSeries('habits', 'appSessionsCount', 'sessions', [
    ['boot-1', 1, 'bronze', 'First Launch', 'Boot up Pulse for the first time.'],
    ['boot-3', 3, 'bronze', 'Familiar Face', 'Open Pulse across 3 sessions.'],
    ['boot-5', 5, 'silver', 'Five-Time Visitor', 'Open Pulse across 5 sessions.'],
    ['boot-10', 10, 'silver', 'Daily Driver Candidate', 'Open Pulse across 10 sessions.'],
    ['boot-25', 25, 'gold', 'Twenty-Five Launches', 'Open Pulse across 25 sessions.'],
    ['boot-50', 50, 'platinum', 'Home Turf', 'Open Pulse across 50 sessions.'],
    ['boot-100', 100, 'mythic', 'Hundred-Boot Veteran', 'Open Pulse across 100 sessions.'],
  ]),
  ...metricSeries('habits', 'distinctDaysActive', 'days', [
    ['day-1', 1, 'bronze', 'Day One', 'Use Pulse on your first calendar day.'],
    ['day-2', 2, 'bronze', 'Back Tomorrow', 'Use Pulse on 2 distinct calendar days.'],
    ['day-3', 3, 'silver', 'Three-Day Rhythm', 'Use Pulse on 3 distinct days.'],
    ['day-5', 5, 'silver', 'Workweek Companion', 'Use Pulse on 5 distinct days.'],
    ['day-7', 7, 'gold', 'Full Week Rotation', 'Use Pulse on 7 distinct days.'],
    ['day-14', 14, 'gold', 'Fortnight Fidelity', 'Use Pulse on 14 distinct days.'],
    ['day-30', 30, 'platinum', 'Monthly Resident', 'Use Pulse on 30 distinct calendar days.'],
    ['day-60', 60, 'mythic', 'Two-Month Devotee', 'Use Pulse on 60 distinct calendar days.'],
  ]),
  flagEntry('tod-early', 'habits', 'silver', 'playedEarlyMorning', 'Sunrise Coffee Spin', 'Play music between 5:00 AM and 7:59 AM.'),
  flagEntry('tod-midday', 'habits', 'bronze', 'playedMidday', 'High-Noon Soundtrack', 'Play music between 11:00 AM and 1:59 PM.'),
  flagEntry('tod-golden', 'habits', 'bronze', 'playedGoldenHour', 'Golden Hour Glow', 'Play music between 5:00 PM and 7:59 PM.'),
  flagEntry('tod-night', 'habits', 'silver', 'playedLateNight', 'Midnight Headphones', 'Play music between 11:00 PM and 1:59 AM.'),
  flagEntry('tod-witch', 'habits', 'gold', 'playedWitchingHour', '3 AM Existential Queue', 'Play music between 2:00 AM and 4:59 AM.'),

  // =========================================================================
  // 8. MASTERY & COMPLETION RANKS (12)
  // =========================================================================
  ...metricSeries('mastery', 'unlockedNonMetaCount', 'badges', [
    ['meta-1', 1, 'bronze', 'First Trophy on the Shelf', 'Unlock your very first achievement.'],
    ['meta-5', 5, 'bronze', 'Getting the Hang of It', 'Unlock 5 achievements.'],
    ['meta-10', 10, 'silver', 'Double-Digit Collector', 'Unlock 10 achievements.'],
    ['meta-25', 25, 'silver', 'Quarter-Century Badges', 'Unlock 25 achievements.'],
    ['meta-50', 50, 'gold', 'Fifty-Badge Club', 'Unlock 50 achievements.'],
    ['meta-75', 75, 'gold', 'Seasoned Completionist', 'Unlock 75 achievements.'],
    ['meta-100', 100, 'platinum', 'Triple-Digit Hall of Fame', 'Unlock 100 achievements.'],
    ['meta-125', 125, 'platinum', 'Halfway to Immortality', 'Unlock 125 achievements.'],
    ['meta-150', 150, 'platinum', 'Studio Grandmaster', 'Unlock 150 achievements.'],
    ['meta-175', 175, 'mythic', 'Sonic Polymath (175)', 'Unlock 175 achievements.'],
    ['meta-200', 200, 'mythic', 'Two-Hundred Club Legend', 'Unlock 200 achievements!'],
    ['meta-225', 225, 'mythic', 'Pantheon of Pulse (225)', 'Unlock 225 achievements across Pulse!'],
  ]),

  // =========================================================================
  // 9. SECRET EASTER EGGS & AUDIO QUIRKS (18)
  // =========================================================================
  flagEntry(
    'egg-konami',
    'secrets',
    'mythic',
    'eggKonami',
    'Up, Up, Down, Down, Left, Right, B, A',
    'Entered the legendary 1986 Konami Code on your keyboard!',
    'A classic 10-key cheat code from gaming history…',
  ),
  flagEntry(
    'egg-scratch',
    'secrets',
    'gold',
    'eggVinylScratch',
    'Grandmaster Turntablist',
    'Clicked the hero album cover 7 times rapidly to scratch the deck!',
    'Try tapping the album artwork like a DJ scratching a record…',
  ),
  flagEntry(
    'egg-barrel',
    'secrets',
    'gold',
    'eggBarrelRoll',
    'Star Fox Barrel Roll',
    'Typed "do a barrel roll" into the search bar and survived a 360° spin!',
    'Peppy Hare had famous advice for pilots in the search bar…',
  ),
  flagEntry(
    'egg-matrix',
    'secrets',
    'gold',
    'eggMatrixRain',
    'Follow the White Rabbit',
    'Summoned cascading green phosphor code rain via the search bar!',
    'Search for a 1999 sci-fi simulation where code falls like rain…',
  ),
  flagEntry(
    'egg-dvd',
    'secrets',
    'gold',
    'eggDvdBounce',
    'Lobby DVD Screensaver',
    'Summoned the bouncing DVD screensaver logo across Pulse!',
    'Three letters from home video nostalgia in the search box…',
  ),
  flagEntry(
    'egg-dvd-corner',
    'secrets',
    'mythic',
    'eggDvdCornerHit',
    'IT ACTUALLY HIT THE CORNER!',
    'Witnessed the bouncing DVD logo strike an exact corner of the window!',
    'Summon the bouncing logo and wait for geometry perfection…',
  ),
  flagEntry(
    'egg-llama',
    'secrets',
    'gold',
    'eggWinampLlama',
    'Whips the Llama’s Synth',
    'Paid tribute to 1997 Winamp MP3 history!',
    'Search for a famous 90s MP3 player or its camelid mascot…',
  ),
  flagEntry(
    'egg-rave',
    'secrets',
    'gold',
    'eggClubRave',
    'Club Pulse VIP',
    'Unleashed the 16-band rainbow spectrum equalizer!',
    'Search for "rave" or "party" to light up the dancefloor…',
  ),
  flagEntry(
    'egg-aero-promise',
    'secrets',
    'gold',
    'eggFrutigerPromise',
    'The Future We Were Promised',
    'Summoned the 2007 Frutiger Aero bubble shower via search!',
    'Search for the glossy 2007 aesthetic name…',
  ),
  flagEntry(
    'egg-vaporwave',
    'secrets',
    'gold',
    'eggVaporwave',
    'ＭＡＣＩＮＴＯＳＨ ＰＬＵＳ ４２０',
    'Basked in the neon sunset grid of 1980s mallsoft nostalgia!',
    'Search for a slowed-down neon bust-statue microgenre…',
  ),
  flagEntry(
    'egg-rain',
    'secrets',
    'silver',
    'eggRainyWindow',
    'Beats to Relax / Study To',
    'Turned on cozy window raindrops while listening!',
    'Search for weather or study beats…',
  ),
  flagEntry(
    'egg-teapot',
    'secrets',
    'gold',
    'eggTeapot418',
    'HTTP 418: I’m a Teapot',
    'Asked the Command Palette to ":coffee" and hit RFC 2324!',
    'Try ordering ":coffee" inside Ctrl+K…',
  ),
  flagEntry(
    'egg-flip',
    'secrets',
    'silver',
    'eggTableFlip',
    'Respect the Mixing Console',
    'Flipped and politely un-flipped the studio desk via ":flip" in Ctrl+K!',
    'Type ":flip" inside the Command Palette…',
  ),
  flagEntry(
    'egg-devtap',
    'secrets',
    'gold',
    'eggSettingsTap5',
    'Secret Arcade Inspector',
    'Tapped the "Settings" title 5 times like unlocking Android Developer Options!',
    'What happens on phones when you tap a settings header 5 times?',
  ),
  flagEntry(
    'vol-zero',
    'secrets',
    'silver',
    'volZeroSilence',
    '4′33″ (John Cage)',
    'Dialed playback volume all the way down to pure 0% silence.',
    'Sometimes the quietest volume setting speaks loudest…',
  ),
  flagEntry(
    'vol-max',
    'secrets',
    'silver',
    'volMaxEleven',
    'These Go to Eleven',
    'Cranked the Pulse volume fader all the way to 100%.',
    'Why make 10 louder when you can push the fader to maximum?',
  ),
  flagEntry(
    'vol-42',
    'secrets',
    'gold',
    'volAnswer42',
    'Hitchhiker’s Gain Stage',
    'Set playback volume to the exact Answer to Life, the Universe, and Everything (42%).',
    'Tune the volume slider to Douglas Adams’ favorite number…',
  ),
  flagEntry(
    'vol-sync',
    'secrets',
    'gold',
    'volSyncClock',
    'Angel Numbers on the Clock',
    'Started a track when the clock minute showed matching digits (:00, :11, :22, :33, :44, :55).',
    'Press play when the clock minutes mirror each other…',
  ),
];

export interface ListenerRank {
  readonly level: number;
  readonly title: string;
  readonly currentXp: number;
  readonly nextLevelXp: number;
}

const RANK_TITLES: readonly string[] = [
  'Bedroom Listener',
  'Tape Deck Novice',
  'Crate Browser',
  'Vinyl Selector',
  'Booth Operator',
  'Mix Engineer',
  'Mastering Specialist',
  'Frutiger Time Traveler',
  'Acoustic Alchemist',
  'Grand Sonic Architect',
];

export function computeListenerRank(totalXp: number): ListenerRank {
  const level = Math.floor(totalXp / 150) + 1;
  const titleIdx = Math.min(RANK_TITLES.length - 1, Math.floor((level - 1) / 3));
  return {
    level,
    title: RANK_TITLES[titleIdx] ?? 'Grand Sonic Architect',
    currentXp: totalXp,
    nextLevelXp: level * 150,
  };
}
