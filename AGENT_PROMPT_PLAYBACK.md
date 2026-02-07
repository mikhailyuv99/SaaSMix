# Agent Prompt – SaaS Mix Playback (Fix Once and For All)

Use this document as the **authoritative specification** when fixing frontend audio playback in SaaS Mix. Implement the required behavior and fix the bugs listed below.

---

## 1. Project Overview

- **SaaS Mix**: Web app for automatic vocal mixing. Users upload raw vocal stems + instrumentals (WAV), apply presets, get mixed output.
- **Stack**: Next.js 14, React, TypeScript, Tailwind CSS.
- **Playback**: **Web Audio API on PC** (desktop); **HTML5 `Audio` on mobile** (detected via `isMobileRef`).
- **Main file**: `frontend/app/page.tsx` (~3700 lines). Use search/grep to find: `startPlaybackAtOffset`, `playAll`, `mixFinishIntervalRef`, `patchedPlayable`, `pendingPlayableAfterMixRef`, `VocalNodes`, gains (raw/mixed), `seekTo`, `togglePlayMode`.

---

## 2. Track Types & Toggle

- **All tracks** (lead, adlibs, instrumental) must behave the same way. No special logic for instrumental (except it has no Avant/Après if it has no mixed URL).
- Each **vocal** track has two modes: **Avant** (raw) and **Après** (mixed). Toggle is via **gains only** – no seek, no pause/play unless necessary for sync.
- Tracks can be played together: **multi-track playback must stay in sync**. All tracks must start at the same time and stay aligned.

---

## 3. BUGS TO FIX (Current Behavior → Required Behavior)

### BUG 1 – PC: Autoplay does not start after mix completes

- **Current**: User has to press Play manually to hear the mixed version.
- **Required**: As soon as the mix job completes, playback must **start automatically** from the beginning (offset 0) in **mixed mode**, without the user pressing Play. The user should hear the mixed result immediately.
- **Where to look**: Mix finish handler in `page.tsx` (search for `mixedAudioUrl`, `patchedPlayable`, `startPlaybackAtOffset(ctx, patchedPlayable, 0)`). PC branch runs when `!isMobileRef.current`; it may call `ctx.resume().then(() => startPlaybackAtOffset(...))` when context is suspended. **Ensure** autoplay is actually triggered: e.g. if the context is suspended, the browser may require a user gesture to resume – in that case consider starting playback as soon as the user next interacts, or ensure `ctx.resume()` is called in a context that leads to playback starting. Also ensure nothing (e.g. `stopAll()`, state updates, or errors) prevents or overwrites the call to `startPlaybackAtOffset(ctx, patchedPlayable, 0)`.

### BUG 2 – Mobile: Instrumental starts instantly, mixed vocal starts too late

- **Current**: After mix finishes and user presses Play, the instrumental starts right away but the mixed vocal starts with a noticeable delay. Tracks are out of sync.
- **Required**: **All tracks must start at the same time.** There must be **no delay** between instrumental and mixed vocal (or any other track). Every track’s active source (raw or mixed per playMode) must begin playback in the same moment.
- **Where to look**: Mobile path in `startPlaybackAtOffset` (inside `if (isMobileRef.current)`). Currently the code builds `mediaToPlay` (instrumental + raw + mixed elements), sets `currentTime` and calls `.play()` on all of them immediately. The mixed vocal is a **new** `Audio()` with `src = mixedAudioUrl` – it may not be loaded yet, so its `play()` effectively starts late when the file loads. Instrumental/raw may already be cached or load faster, so they start first. **Fix**: Do **not** call `.play()` on any element until **every** track’s **active** source (the one that will be heard given current playMode) is ready (e.g. `readyState >= 2` or `canplaythrough`). Then set `currentTime` on all active elements to the start offset, then call `.play()` on all of them in the same synchronous block (or same tick). Optionally preload mixed URLs when mix completes (e.g. using the existing preload or a dedicated cache) so that when the user taps Play, all sources are already ready.

### BUG 3 – Mobile: Delay when switching between raw and mixed (Avant / Après)

- **Current**: When the user toggles Avant/Après on mobile, there is a noticeable delay and/or desync.
- **Required**: Toggle must feel **instant**. Prefer switching via **gains only** (mute one source, unmute the other) so both elements stay in sync. If you must sync `currentTime` between the active and inactive element, do it **synchronously** or in the same frame; avoid waiting on `canplaythrough` or multiple `requestAnimationFrame` steps that add delay. All tracks must remain in sync after the toggle.

### BUG 4 – All tracks must play simultaneously in every scenario

- **Required**: Whether on PC or mobile, after mix or on first Play, when toggling Avant/Après or when seeking: **all tracks must play (or pause) together and stay in sync.** No track should start earlier or later than the others. No offset between tracks.

---

## 4. REQUIRED Behavior – PC (Web Audio API)

| Scenario                      | Expected behavior                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **After mix completes**       | **Autoplay** from offset 0 in **mixed mode**, immediately. User must **not** need to press Play.                |
| **Mixed audio on first play** | Mixed audio must be **audible right away** – no need to seek first to “unlock” sound.                            |
| **Seek (scrub on timeline)**  | Seek must be **instant** and correct. No double playback, no ghost audio, no drift.                             |
| **Toggle Avant / Après**      | Switch via **gains only**. No audible glitch, no desync.                                                         |
| **Raw + mixed buffers**       | Both raw and mixed buffers exist; gains control which is heard. When switching modes, only gains change.         |

---

## 5. REQUIRED Behavior – Mobile (HTML5 Audio)

| Scenario                 | Expected behavior                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **First Play**           | **No delay.** All tracks (instrumental + vocal raw/mixed) start **at the same time**. |
| **After mix, then Play** | Same: all tracks start together; mixed vocal must **not** start later than instrumental. |
| **Toggle Avant / Après** | **No delay**, no desync. Prefer gains only; if syncing position, do it instantly. |
| **Multi-track playback** | All tracks play together and **stay in sync**. No offset between tracks.           |
| **Play button**          | Must be triggered in a **user gesture** context (browser requirement).             |

---

## 6. Past Failures – DO NOT REPEAT

- **Double playback on seek**: Do not start playback twice when seeking (e.g. avoid calling `playAllRef` or `startPlaybackAtOffset` from inside seek logic).
- **Mixed silent until first seek**: On PC, mixed audio must be audible from the **first** play; do not rely on a seek to “unlock” it.
- **Await ensureAllBuffersLoaded on mix finish**: Do **not** use `await ensureAllBuffersLoaded` before `startPlaybackAtOffset` when mix completes. The mixed buffer is already in `buffersRef` at that point.
- **Special handling for instrumental**: Treat instrumental like any other track for sync and start time; no separate “instrumental first” logic that causes other tracks to lag.

---

## 7. Code Hints

- **Mix finish handler**: Search for `mixedAudioUrl`, `patchedPlayable`, `stopAll()`, then `startPlaybackAtOffset(ctx, patchedPlayable, 0)`. PC: ensure this path **always** runs and that suspended context is handled so playback actually starts (e.g. `ctx.resume().then(...)` must eventually call `startPlaybackAtOffset`; consider also calling it when context is already running without relying on async).
- **Mobile start**: In `startPlaybackAtOffset` when `isMobileRef.current`, collect only the **active** source per track (e.g. for vocal in mixed mode, only the mixed `Audio`; for instrumental, the single `Audio`). Wait until **all** of these are ready (e.g. `readyState >= 2` or `canplaythrough`), then set `currentTime` on all, then `play()` on all in the same tick. Do not call `play()` on elements that are not yet loaded and expect them to sync later – that causes the “instrumental first, vocal later” delay.
- **Mobile toggle**: In `togglePlayMode`, for mobile use gains (and volume) only if possible. If you must sync `currentTime` between raw and mixed elements, do it in one place without extra async or rAF chains that add delay.
- **Seek**: `seekTo` should only update existing playback (stop old source, start new at offset); it must **not** call `playAll` or `startPlaybackAtOffset` in a way that causes double playback.

---

## 8. Acceptance Criteria (Checklist)

Before considering the task done, verify:

- [ ] **PC**: After mix completes, playback starts **automatically** from 0 in mixed mode (user does **not** press Play).
- [ ] **PC**: Mixed audio is audible on first play; seek is instant with no double playback; toggle Avant/Après via gains only, no desync.
- [ ] **Mobile**: When user presses Play (including after mix), **all tracks start at the same time** – no delay between instrumental and mixed vocal.
- [ ] **Mobile**: Toggle Avant/Après has **no noticeable delay** and no desync between tracks.
- [ ] **Mobile**: Multi-track playback stays in sync in all scenarios.
- [ ] Instrumental is not given special “start first” logic; all tracks start simultaneously.

---

## 9. Instructions for the Agent

1. **Read** `frontend/app/page.tsx` and locate: `startPlaybackAtOffset`, `playAll`, mix finish block (where `mixedAudioUrl` is set and `patchedPlayable` is used), `togglePlayMode`, `seekTo`, mobile branch (`isMobileRef.current`), and where `mediaToPlay` / `.play()` are used on mobile.
2. **Fix BUG 1 (PC autoplay)**: Ensure that when mix completes on PC, `startPlaybackAtOffset(ctx, patchedPlayable, 0)` is invoked and that playback actually starts (no silent failure, no need for user to press Play). Check suspended context handling and any code that might clear or override playback.
3. **Fix BUG 2 (Mobile simultaneous start)**: On mobile, ensure no `.play()` is called until every track’s active source is ready; then set `currentTime` on all and call `.play()` on all in the same tick so all tracks start together.
4. **Fix BUG 3 (Mobile toggle delay)**: Make Avant/Après toggle instant on mobile (gains/volume only; if syncing position, do it synchronously).
5. **Respect** section 6 (past failures) and sections 4–5 (required behavior). Use **small, incremental changes**; if something breaks (e.g. double playback), revert and try a different approach.
6. **Test** on both desktop (Chrome/Firefox) and mobile (or device emulation) and confirm the acceptance criteria above.
