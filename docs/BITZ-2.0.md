# BITZ 2.0

A minimalist multiplayer social collecting game.

Walk and jump in a compact white lobby, see your friends and their equipped outfits, collect pets and cosmetics, earn gold, gain levels, and open mystery boxes. The existing Shop styling and catalogue are retained.

## Architecture

- `server.js`: HTTP, authentication, persisted account records, controlled shop and social transport.
- `src/social.js`: WebSocket presence, movement, profile updates, safe emotes. No combat, dropped items, zombie AI, trading or archived world state.
- `src/core.js`: wallet handling, purchasing, passive gold, server-authoritative mystery-box rewards.
- `src/progression.js`: cumulative XP, levels, milestone collectibles, gold rewards.
- `public/loot-rules.js`: one shared rarity model for server picks and accurate client display.
- `public/voxel-world.js`: small empty-plate 3D floor and edge.
- `public/index.html` and `public/bitz2.css`: Shop-matched social UI, cosmetics, My Stuff and prize reveal.

## Safety and rollback

All existing account records, balances, owned possessions, auth users, sessions and historical game records retain their stored keys. **No database wipe or schema migration is required.**

The complete pre-rebuild code is preserved in `rollback/pre-bitz-2-2026-11-12`; legacy world, client, board core and server implementations are also in `legacy/`. Old board parties remain persisted but cannot execute.

To restore, deploy the rollback branch in full; do not mix an old server with the new account rules or world layout.

## Configuration

- `BITZ_GOLD_PER_MINUTE`: default `500000`, clamped to 1,000–2,000,000.
- `BITZ_TEST_BETRAYAL=1`: allows admin-only, **dry-run** risky interaction tests over the WebSocket. No gold/items can be taken.
- `STAKKZ_ADMINS`: comma-separated registered account usernames permitted to run experimental actions; defaults to `louis`.
- `STAKKZ_DATABASE_URL` or existing `STAKKZ_STORE_URL` and `STAKKZ_STORE_KEY`: persistent account store.
- `STAKKZ_SECRET`: existing account seal HMAC key, must remain unchanged.

## Tests

`node tests/bitz2-unit.mjs` validates economy, XP, rarity, no duplicates and archived purchasing restrictions.

`node tests/bitz2-integration.mjs` starts the real HTTP and WebSocket server with isolated persistence and exercises registration, sign-in, buying, loot, friends, character/pet persistence, player movement and dry-run experimentation.

`node tests/bitz2-browser.mjs` validates the real desktop/mobile UI with Playwright (requires Playwright and Chrome). The workflow also runs the existing PostgreSQL rollover and overlapping-writer tests. None of these tests use production credentials or production player data.

No competitive minigames or five giant box collections have been introduced. Cosmic and Legends are small, independently configurable collection prototypes.
