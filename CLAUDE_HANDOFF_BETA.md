# STAKKZ — Claude handoff (11 November 2026)

## Read this first
Changes are committed to development branch `beta-ui-bots-account-sync-20261111`. Production branch `main` is deliberately untouched. The live game at `https://stakkz.onrender.com` has NOT been changed by this work. Review the development branch and its PR before merging or deploying. Do not overwrite the branch with an older Claude-generated index.html.

## User requirements
1. Eliminate white-screen/whole-panel blinks when tapping Settings buttons, selecting cosmetics, filters, navigation or other controls. Only the affected element should visibly update.
2. Remove the entire top-level Play page and Play solo button.
3. Rename visible Me navigation to Profile, retaining its internal `me` page identifier.
4. Create party: choose 0–4 server-run AI opponents with Easy, Medium, Hard difficulty, designed as believable casual Monopoly players; human friends can still join if seats remain.
5. Username/password login without mandatory email, device-independent accounts, coins, shop inventory, live party resume and two-minute temporary-disconnection grace.
6. Desktop + mobile, no broad redesign or regressions.

## Implemented in the development branch
- `public/index.html`: removed top-level Play and Play solo navigation; visible Me -> Profile; Create party adds bot count/difficulty; settings selection updates individual buttons instead of rebuilding the whole modal; `patchHTML` diffs dynamic panels and modal markup in place, preserving focus/scroll and avoiding broad flashing; Profile includes an Account & sync section with signup/login/logout when persistent storage is available; guest sessions remain supported; signed-in sessions persisted locally on each device, and active-party lookup enables cross-device rejoin.
- `src/bots.js`: server-side bot decisions (buy, auction, cash reserves, jail, building ROI, trade evaluation, debt), different risk/mistake rates by level.
- `src/core.js`: bot seats added during party creation, retained for rematches and excluded from human wallet rewards.
- `src/auth.js`: usernames, salted scrypt password hashes, revocable per-device random sessions stored as token hashes, session expiry.
- `server.js`: auth register/login/logout, auth identity lookup, active-party lookup, heartbeat, 120-second disconnect grace then removal from active game, server-driven bot turns, optional external persistent store via backend-only Supabase REST.
- `tests/beta-smoke.mjs` and `.github/workflows/beta-validation.yml`: syntax plus smoke checks.

## Crucial configuration dependency — do not merge and claim finished without it
Render Free storage is ephemeral. Without external persistent storage, usernames and party state would be lost at service restart. For safety the new UI disables account registration unless cloud storage is configured. The code supports a dedicated Supabase PostgREST table with these **Render-only** environment variables:
- `STAKKZ_STORE_URL`: `https://<dedicated-project-ref>.supabase.co/rest/v1/stakkz_state`
- `STAKKZ_STORE_KEY`: the **secret/service-role** API key for that dedicated project. Never expose to browser, client code or Git.
- `STAKKZ_SECRET`: existing signing key; retain its current value, do not rotate.

In a **new dedicated Supabase project** (do not reuse unrelated existing projects), set up the schema:

```sql
create table if not exists public.stakkz_state (
  id text primary key,
  state jsonb not null
);
alter table public.stakkz_state enable row level security;
revoke all on public.stakkz_state from anon, authenticated;
-- No permissive public RLS policy. Only the backend service role accesses data.
```

The server expects GET `?id=eq.main&select=state` and POST upsert `?on_conflict=id`, with `apikey` and Bearer headers, to this endpoint. It refuses startup if configured cloud storage is inaccessible.

**Do not start a new Supabase project or incur charges silently.** Explain the required project setup to the user and ask which organisation/project to use if necessary.

## Important behavioural details
- Existing guest accounts derive identity from a random 48-character browser-local key, NOT IP. Username signup associates the old guest identity with login credentials, then replaces the local guest key. Login on a second device maps to the same server-side player id.
- A signed-in device discovers an active party via `/api/my-party` and subscribes again; the WebSocket stream synchronises game state. At 120 seconds without an authenticated gameplay heartbeat, server removes the disconnected player's seat by the existing quit rules.
- Bots are authoritative server actors, never fake browser clients; a human cannot claim a bot's id through the guest bearer key.
- Session tokens are sensitive; display no secrets in user-facing docs.
- Bot difficulty is intentionally fallible/casual. Hard bot evaluates full colour-set value and building ROI; Easy makes more impulsive decisions.
- The external storage implementation currently snapshots the entire game state under one row and saves about every 4 seconds. Appropriate for a private 3-friend beta only, **not a scale-out production backend**, and should be scrutinised for concurrency/restore edge cases.

## Validate before merge
1. GitHub Actions syntax and smoke tests pass on the development branch.
2. Launch local/staging Node server, test signup/login, wrong password and signout, session persistence after a restart with real database.
3. Create room with 0,1,4 bots at all difficulties; test humans joining, turn timers, bidding, purchasing, bankruptcies, winner, rematch, coin awards.
4. Confirm iPhone portrait/landscape, desktop narrow/wide and browser audio toggles do not blink the whole screen on interaction.
5. Sign in on iPhone, start game, close app, sign in on laptop within 120 seconds; recover same identity and exact live party state; after two minutes verify session removal and game continuity.
6. Verify bot ticks and persistence after Render Free spin-down/deploy; no duplicate payments, coins, account changes or false resume.
7. Review privacy/security, denial-of-service, rate-limits on auth endpoints, stale-session behaviour and client-side XSS safety.
8. Keep live `main` unchanged until all critical checks pass.

## Known unfinished items to prioritise
- Database project/table/Render variables have NOT been configured.
- Actual browser-device and hosted integration QA NOT verified yet.
- Auth rate limiting currently shares a general IP bucket; add username/password login abuse protection.
- Snapshots can lose up to a few seconds of changes on unexpected shutdown and need robust durable transaction semantics if expanding beyond private beta.
- `STAKKZ_SECRET` must not be changed; previously signed wallet backups depend on it.


## Additional verification completed in this session
- Added `tests/integration.mjs`: end-to-end HTTP server with simulated durable database, registration/login, another-device identity, server restart and party recovery.
- Added `tests/bot-simulation.mjs`: 1,800-step game simulations at each difficulty and multiple server bot actions.
- Added `tests/browser-smoke.mjs`: actual headless desktop Chrome account signup; Settings music toggle retains the same button DOM node (no whole-dialog rebuild); party creation with two hard bots; starting the game; emulated iPhone logs into the same username and resumes the active game; no horizontal overflow.
- GitHub Actions run 43088555201: **both smoke and browser jobs passed**. The browser smoke test deliberately disables WebGL to test the browser interactions independently of GPU availability, so real 3D rendering and performance on actual iPhones are not yet verified.
- Further reduced flashing in `public/index.html` by updating lobby nodes in place and avoiding unnecessary 3D scene rebuilds for unchanged player scene data.
- Rate limiting added to auth endpoint; durable writes serialised, successful signup/login/logout now await storage acknowledgement.

## Costs/decisions requiring user input
Supabase projects list (11 Nov 2026) showed two active projects (ZEUS; Football Card Battles), and three inactive projects. Supabase Free allows two active projects; additional dedicated Stakkz project may require a plan change or changes to active projects. **Do not create, pause, repurpose, delete or upgrade another project without the user's explicit permission and a verified quote.** Dedicated isolated project preferred. User has exactly one visible organisation: `louisrid's Org`. The required project-specific service role key cannot be retrieved from our existing project list; use Render server-only env var once authorised. Render connector was newly linked during this work; verify capabilities before acting.

## Updated completion definition
All of the above branch tests passed, but deployment is **not finished** until an isolated persistent database is configured, Render env vars set, independent staging verified with real Supabase, and a safe merge/deploy is authorised. The 2-minute disconnect-to-removal timing remains unverified with an actual 120-second wall-clock device test.
