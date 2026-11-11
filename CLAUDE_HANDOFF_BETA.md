# Stakkz beta handoff for Claude — 11 November 2026

## LATEST: GAMEPLAY FINALISATION PART 1, IMPLEMENTED ON BETA

This section supersedes earlier gameplay mode and player-count descriptions. **Keep this implementation when doing Part 2, which is focused on polish of the existing 3D world. Do not rebuild.**

- The authoritative shared engine is `public/engine.js`; validation is `src/core.js`, server time ticks are `server.js`, and AI decisions are `src/bots.js`. `public/index.html` remains the existing 3D client.
- 2–6 seats, any viable human/0–4 Easy/Medium/Hard bot combination. Added a distinct sixth colour. Lobby size and all client state validators updated.
- Modes: QUICK 25m, **FAST FUN 35m default**, LONG 45m; Classic remains available. Automatic turn timers: 2 players 50s, 3 45s, 4 40s, 5 35s, 6 30s. The only optional Advanced mode setting is the turn timer. Existing UI sizing is unchanged.
- **Paid starting portfolios:** all players initially have £1,500 before buying 3 randomly selected, fairly balanced deeds; with 5–6 players, 2 deeds. Deduct each purchase from starting cash. No changes to board, original property price/rent tables, utility or station base rents.
- Hotels are now buyable after 3 houses per property. The existing hotel level (5) and original rent table remain, so the fourth build jumps 3→5. Downgrading jumps 5→3. Updated net worth, bankruptcy refunds, rent tooltip, build buttons and bot ROI logic accordingly.
- Four existing stations support **STAY** or **TRAVEL** after normal rent/purchase/auction resolution. Destination is one of the other three stations, no chained travel, destination rent or Start bonus. Depart from owned station free; depart from unowned station £50 to bank; depart from another player's station £50 to the owner **after ordinary landing rent**. Travelling ends the turn. Bots consider fares/destinations. Existing 3D board temporarily displays persistent blue rings over eligible destinations and those tiles can be tapped. The chooser supplies clear named buttons.
- Auctions now use a 10-second per-bid timer with visible countdown. At the last 5 minutes the server activates FINAL CHAOS once, clears pending trades, doubles ordinary rent and broadcasts a message. The indicator is absolutely positioned over the 3D stage to avoid shifting the desktop/mobile toolbar.
- At timed deadline the **server** finalises the game even if players disconnect, are trading, deciding a purchase, or are in auction. Leading valid auction bid is settled, unpaid debts reduce debtor's final net value, and rankings use cash + deed value + paid building value. The last surviving player still wins immediately. Normal rewards, stats, rematches and persistence remain.
- New tests: `tests/gameplay-finalisation.mjs` covers 2–6, paid portfolios, modes, timer adaptation, server action validation for travel, ownership fees, no chaining, early hotel and downgrade, doubled rent, chaos trade cancellation, deadlines/winner payouts and bot station decisions. `tests/integration.mjs` now also tests a six-seat HTTP match; `tests/browser-smoke.mjs` now checks selected Fast Fun mode and stable 3D board dimensions when Advanced is opened; the existing 1800-step bot simulations handle the new travel stage.
- The complete new game rules and client inline JS **passed direct V8 execution/syntax verification** in this ChatGPT session. GitHub Actions were queued behind numerous prior auto-deploy commits at the time of this update; do not claim all latest CI jobs passed until their results are checked. Existing pre-Part-1 five-job workflow was green.
- Production `main` is untouched; all source changes are on `beta-ui-bots-account-sync-20261111`. No new infrastructure was created. Render Free PostgreSQL still expires **11 December 2026**, has no backups, and needs a production-grade replacement before shipping.
- For Part 2: preserve all the above rules, account/session code, stable Profile-width left panel, existing board and scene, responsive controls, and working game actions. Aim for smoother 3D visuals and polish without camera/layout jumps or rewriting the core systems.

## Critical status

**Preserve this work. DO NOT overwrite files from an older Claude Artifact or merge the branch without the user's approval.**

- Repository: `louisrid/stakkz`
- Development branch: `beta-ui-bots-account-sync-20261111`
- Draft PR: https://github.com/louisrid/stakkz/pull/1
- Beta site: https://stakkz-beta-test-20261111.onrender.com
- Production: https://stakkz.onrender.com (Render service `stakkz`, `main` branch)
- **Only the beta branch/service has been modified. Production `main` has not been edited.** GitHub comparison verified `main` is the ancestor of this branch.
- Dedicated staging database: Render PostgreSQL 18, `stakkz-beta-store`, Frankfurt. Private `STAKKZ_DATABASE_URL` supplied by Render Blueprint `exs-dbqceam7bikc73ani6h0`, `render-stakkz-beta.yaml`. No DB credentials committed to Git.
- **IMPORTANT: Free Render database expires 11 December 2026, has no backups and MUST NOT be treated as production-grade player persistence.**

## Product requirements preserved

1. Compact bold Stakkz original identity: Coolvetica-style lowercase logo, black outlines, pixel-art cash, animated prize wheel and shop, white background and colourful 3D city. No gratuitous redesign.
2. Four top-level tabs: Create Party, Join Party, **Profile**, Shop. Original "Play"/"Play solo" removed from navigation.
3. **Desktop menu width always equals Profile's original width**: `--sw: clamp(390px,35vw,560px)` in `public/index.html`; no more tab-specific 330/410px widths or grid-column animation. Lobby stable rather than moving the stage when seats fill.
4. Mobile keeps one stable board/stage width and height through tab switches, portrait and landscape; sensible scrollable controls and no horizontal clipping.
5. Replace unnecessary whole-panel DOM re-creation with `patchHTML` for Settings, profile selection, menu/navigation, lobby, player cards, dice/action dock, game logs and auction banner. Remove white full-panel flashes and title overlay wipe. Preserve button identities and focus.
6. Add 0–4 server-authoritative AI bots in Create Party, with Easy, Medium and Hard modes. Realistic casual strategic mistakes, property-set valuation, ROI building, bid/reserve behaviour, jail, trades and debt choices. Bots remain in rematches.
7. Username/password accounts (email not required) with password-hashed auth and multi-device session identity. Coins, outfits, loot and active rooms backed by server database.
8. An active game can be rejoined as the same user on another device, with **120 seconds** disconnect grace in production; then disconnected active player is removed. Closing/backgrounding is not equivalent to actively pressing Leave.

## Accounts: precise operation

- Unregistered guests have a randomly generated browser-local key `stakkz-key`. It is **not based on IP** and is **not shared across devices**.
- A guest registers in Profile with a unique username (3–20 ASCII letters/digits/underscores) and password (10–128 characters), no email confirmation. The server associates the guest's current account with those credentials.
- Passwords use per-user salted scrypt. Each device gets its own random login bearer token, stored locally as `stakkz-session`; the server holds only token hashes. Sessions expire after 60 days and multiple devices are supported. There is **no password-reset recovery flow yet**.
- Login on phone and laptop maps to the same persistent user ID, account inventory and stored game progress. `GET /api/my-party` finds that account's active match, and WebSocket sends latest server state. The app tries the remembered local room code and then the server-side active match lookup.
- Presence heartbeat runs when an online game is actively viewed; if connection closes, the server allows two minutes for reconnect. After that period, the server forfeits that player; you can still sign into the account, but not reclaim the forfeited active seat.
- Clicking **Leave party** in a lobby removes the player immediately. A bot-only lobby closes; if the host leaves and another human remains, that human is promoted to host. Leaving a running game via **Menu > Leave game** forfeits that seat immediately. Explicit leave has no two-minute grace.
- Sign-out revokes that device's session; other devices remain signed in. The UI clears previous account character/identity from guest view. Cannot sign out while inside an active match.
- Do not publish tokens, service keys, DB URLs or `STAKKZ_SECRET`; preserve existing signing secret to keep sealed wallet restores valid.

## Database and durability

- The approved $0 Supabase Stakkz project was **not** created: Supabase blocked it due to the owner's existing limit of two active free projects (ZEUS and Football Card Battles). Other projects were not touched. Do not pause/delete/repurpose/upgrade these without specific user permission.
- Instead the user now has a free isolated **Render PostgreSQL** beta database, private network access, linked only to `stakkz-beta-test-20261111`.
- `server.js` supports `STAKKZ_DATABASE_URL` with pinned `postgres@3.4.9` and optional older Supabase REST storage; it persists room/account/session snapshots in `stakkz_state`.
- **Bugs found and fixed during real testing:** PostgreSQL JSONB was read back as a JSON *string*, so restarted servers originally ignored saved data. Boot now parses the string into the saved object. Rolling deploys originally wrote stale empty snapshots on SIGTERM; shutdown now flushes only actual dirty changes. DB snapshot updates use an optimistic revision number so an outgoing instance cannot overwrite the newer instance's state.
- Real Render logs after the fix showed `Persistent storage ready: 1 accounts, 1 parties` after a redeploy, confirming actual account and game recovery.
- The simple whole-state snapshot remains beta architecture, not a high-scale transactional multi-instance backend. Upgrade to durable backed-up storage and design transactional or ownership-locked state management before a public launch.

## Automated testing (all passed)

- GitHub Actions `43093900737`: all five jobs **SUCCESS** (`smoke`, `browser`, `postgres`, `visual`, `staging`).
- `tests/beta-smoke.mjs`: JS parsing, basic bots and password/token tests.
- `tests/integration.mjs`: registration, wrong password, independent device sessions, bot parties, host leave/handoff, wallet and match restoration after a simulated restart.
- `tests/bot-simulation.mjs`: long-running game simulations for Easy/Medium/Hard bots.
- `tests/reconnect-grace.mjs`: a new device resumes before timeout, and an offline player is correctly removed afterwards. Uses test-only accelerated 4-second grace; production is hardcoded to 120 seconds.
- `tests/browser-smoke.mjs`: real Chrome login, settings toggle DOM identity, creating bot parties, starting a game, emulated iPhone signing in and resuming that same live game, consistent UI dimensions across Create/Join/Profile/Shop. Layouts tested desktop 1440x900, 1280x800, 1024x768, 901x640; mobile 390x844, 375x667, 430x932, 844x390. No horizontal overflow or broad tab-width shifts.
- `tests/visual-stage.mjs`: **real WebGL** city and character rendered on desktop Chrome 1440 and emulated iPhone-sized Chrome 390. Screenshots in CI artifact `stakkz-webgl-visual-check`. These are Chrome WebGL simulations, not physical Safari tests.
- `tests/postgres-rollover.mjs`: runs two independent servers against a real disposable PostgreSQL 18, proves newer accounts survive rolling deployments, rejects stale writes and restores accounts after a restart.
- `tests/staging-live-smoke.mjs`: real hosted beta + private Render Postgres registration, login, bot party creation, game start and rejoin.

## Still required before merging/deploying to production

1. Acquire **permanent, backed-up database** before 11 December 2026. Do not ship production accounts on expiring Render Free Postgres. Any paid service/upgrade requires user cost approval.
2. Manual QA on **actual iPhone Safari** (3D performance, scroll/touch, app switching, background, screen rotation), and actual desktop browser. Automated iPhone viewport simulations are not equivalent to real Safari.
3. Verify real wall-clock 120-second disconnect on a physical device, including deliberate Leave and session switching.
4. Decide account recovery if passwords are forgotten (currently none) and whether guest progress from production main needs migration. Beta database is separate from live production guest wallets.
5. Review snapshot/transactional durability and prevent multi-device simultaneous action conflicts at scale.
6. Preserve all existing game mechanics, aesthetics, prize wheel, in-game progression and previously implemented functionality.
7. Only then consider PR #1 merge into `main` with user's explicit sign-off.

## Design/UI follow-up

The user specifically dislikes menu panels resizing as tabs change, large white flashes and the whole 3D scene sliding. Keep the fixed Profile-width desktop split. When refining, use targeted element changes rather than rebuilding the whole DOM or animating main grid dimensions. Visually compare actual WebGL screenshots, then retest at multiple viewport widths. Do not recreate the game or replace the whole index file with an older Artifact.
