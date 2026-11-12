# BITZ

A multiplayer 3D football-card collecting game with its own server. Walk a flat white world, earn cash while you
play, buy packs from the Pack Seller, open them anywhere, sell duplicates to the Card Buyer, fill the Dealer's orders,
complete club albums, trade with friends and climb the live **net worth** leaderboard.

Plain Node (20 or newer), two dependencies (`ws`, `postgres`), no build step.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

Environment:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000). |
| `STAKKZ_DATABASE_URL` | Postgres connection string. Accounts, cards and the world are saved as one versioned snapshot. |
| `STAKKZ_SECRET` | HMAC secret for the sealed wallet copies browsers hold. Keep it stable. |
| `DATA_FILE` | JSON file used when no database is configured (local play). |
| `BITZ_FILE_ACCOUNTS=1` | Allow sign-up with file persistence (local play and tests only; never on an ephemeral host). |
| `STAKKZ_MOVED_TO` | Old address only: forward every visitor and their sign-in to the new address. |

## The game in one page

- **Earn**: $8,000 a minute while connected and active. ×3 inside the Gold Circle. Inside the Purple Circle cash
  pauses and a free RED HOT pack arrives every 40 seconds. One connection per account earns; nothing accrues while
  the tab is hidden, after ten idle minutes, or offline.
- **Three collections**, each a 5-card pack and a 10-pack box at 9.5× the pack price:
  RED HOT ($15,000), GOLDEN STAR ($35,000, an autograph in every pack, mostly from squad players),
  EUROPEAN NIGHTS ($150,000, elite players only, higher minimum rarity). Every pack guarantees a Rare or better.
  The best card is always revealed last. GOD PACK and the Welcome Pack are reward-only.
- **265 players**: the custom Premier League 2026/27 roster (20 clubs × 11 main + 25 bonus) plus 20 Champions League
  stars. Values come from one desirability number per player and one base per edition (`src/econ.js`).
- **Net worth** = cash + book value of the cards you own now + 80% of unopened packs. Milestones at $50k, $250k,
  $1m, $5m, $25m and $100m pay once, on verified peak net worth.
- **Card Buyer** pays 65% of book value. Locked, showcased, numbered and signed cards are protected.
- **The Dealer** keeps four standing orders that pay over the odds and calls live races (first valid hand-over wins).
- **Collector book** remembers the best edition of every player you personally packed, even after you sell it.
  Owning all 11 main players of a club at once pays a European Nights pack and the club scarf.
- **1 of 1 tracker**: one card of each 1/1 edition exists per player, ever; serials are issued server-side.

## Code map

| Path | What it is |
|---|---|
| `server.js` | HTTP + WebSocket server, persistence, API, leaderboard, the one-time economy migration. |
| `src/roster.js`, `src/catalogue.js` | The 265 players and 26 clubs, validated at import. |
| `src/econ.js` | Every price, odds table, edition, value and timer. The simulator reads the same file. |
| `src/cards.js` | Packs, guarantees, serials, the book, selling, trades, Top 5, clubs, milestones, net worth. |
| `src/dealer.js` | Standing orders and live races. |
| `src/friends.js`, `src/social.js`, `src/auth.js`, `src/core.js`, `src/progression.js`, `src/shop.js` | Friends, the live world and earnings, accounts, profiles, levels, cosmetics. |
| `public/index.html`, `bitz.css`, `app.js` | The page, the design system, boot/HUD/menu/socket. |
| `public/world.js`, `avatar.js`, `avatar-data.js`, `world-layout.js` | The 3D world, characters, pets, stands, circles. |
| `public/cards-art.js`, `cards-ui.js` | Card, pack and box art; every card screen. |
| `public/portraits/` | `placeholder.png` plus any real `<player-id>.png` you add later. Missing files redirect to the placeholder. |

## Tests and tools

```bash
npm test                      # unit + integration (real server and socket)
node tools/econ-sim.mjs 1500  # economy simulation with the real odds
npm install --no-save playwright && npx playwright install chromium
node tests/browser.mjs        # real Chrome, desktop + iPhone size; screenshots in qa-screens/
PW_CHANNEL=chrome node tests/browser.mjs   # use an installed Google Chrome instead
```

## Footballer portraits

All 265 player names are validated by the catalogue tests. BITZ reads individual player photos through
`public/portraits/manifest.js`. The images are local, cached, and mapped to stable player IDs. Every
card, pack reveal, collection page, trade, profile, and card inspection uses the same portrait resolver.

`tools/sync-portraits.mjs` imports images from explicitly identified Wikidata footballers and checks
Wikimedia Commons licences before caching an image. Selected player-specific Commons photos are also
included for names that cannot safely be matched automatically. It records original file pages and
authors in `public/portraits/credits.json`, with a public list at
`/portraits/credits.html`. See `public/portraits/report.json` for the current coverage and any players
still missing photographs. Unresolved players use `public/portraits/placeholder.png`, never a random face.

To refresh: run `node tools/sync-portraits.mjs`, or the **Import licensed footballer portraits**
GitHub Action. Then run `node tests/portraits.mjs` and `node tests/portrait-visual.mjs`
(Playwright Chromium required). The latter captures actual player cards in desktop and mobile layouts.

Player photo licences are not necessarily endorsements or releases of publicity rights.
Game autograph artwork is fictional, not an authentic player signature.

## Deploying

`render.yaml` runs `npm start`. Set `STAKKZ_DATABASE_URL` and `STAKKZ_SECRET` in the service. The first time an
account is touched after deploying, its old balance, cards and packs are archived on the account record
(`wallet.archive.v1`) and the new economy starts at $0 with a Welcome Pack. This happens once per account and never
again. Take a database snapshot before deploying; see `docs/REBUILD-2026-11.md`.
