# BITZ rebuild, November 2026: what changed and where it stands

Branch `wip/game-rebuild`. Nothing on `main` or the live site has been touched.

## What the game is now

Thirteen systems and nothing else: the white multiplayer world; the Pack Seller, Card Buyer and Dealer stands; passive
cash with the Gold and Purple circles; three collections with packs and boxes; collecting, selling and trading; the
club collector book; net worth, milestones and the leaderboard; profiles and Top 5; the 1 of 1 tracker; full-screen
card inspection; pack opening with a few hidden surprises.

## Removed from the active game

Monopoly (board, bots, parties, timers), the adventure world, zombies, weapons and combat, clans, loot and mystery
boxes and their stores, the Hall of Pulls, the Wardrobe stand (cosmetics live in MENU › Style & Pets), the nine old
pack products, the Purple Pack and Ultraviolet set, the 294-player fictional catalogue, the daily reward, the
Buyer's Hot List, partial club rewards, the 25% club multiplier, weekly prizes, the licensed-photo workflow, seven
stylesheets and `legacy/`. Everything remains in git history and in the three `rollback/*` branches.

## Preserved

Accounts, passwords and sessions (`src/auth.js` unchanged), the sealed-wallet restore, the Postgres snapshot with
rolling-deploy protection, every owned cosmetic, outfit, pet and look, names, friends (now explicit requests),
card serial issuance and the handoff for a future address move.

## The economy (from `src/econ.js`, verified by `tools/econ-sim.mjs`)

| | RED HOT | GOLDEN STAR | EUROPEAN NIGHTS |
|---|---|---|---|
| Pack / box | $15,000 / $142,500 | $35,000 / $332,500 | $150,000 / $1,425,000 |
| Expected book value per pack | 1.03× price | 0.96× price | 0.98× price |
| Median pack | 0.66× | 0.65× | 0.70× |
| Packs worth at least their price | 27% | 26% | 26% |
| Sell everything back | 67% of price | 63% | 64% |
| 1/1 frequency | 1 in 5,000 packs | 1 in 1,000 | 1 in 1,000 |

Red Hot is $15,000 rather than the $8,000 first suggested. At $8,000 a Purple Circle pack every 40 seconds was worth
half of the Gold Circle's $24,000 a minute, so nobody would have used it. At $15,000 the two circles are different but
close: after 30 minutes (1,500 simulated sessions each) the Gold Circle holds a median $730k in cash while the Purple
Circle holds $684k in cards with 144 of 265 players discovered. Opening packs does not destroy net worth (a Red Hot
buyer keeps 99.6% of a pure cash player's median) and no buy-open-sell loop returns more than 67% of the price.
Dealer orders lift the Purple strategy to $697k at 30 minutes and $2.91m at two hours, level with pure cash.
Onboarding: about $58k net worth after two minutes in the Gold Circle with the Welcome Pack.

Values: one desirability number per player (0.5 to 40, compressed with a 0.85 power) times one base per edition.
A Golden Signature of a squad player is worth about $2,500; an unsigned Full Art Haaland about $228,000; the
1 of 1 Masterpiece Mbappé about $20.7m.

## Migration safety

- Each account migrates once, lazily, the first time it is touched (`src/cards.js` `migrate`): its old balance,
  cards, packs, boxes, XP and daily state move to `wallet.archive.v1`; cash becomes $0, cards empty, one Welcome
  Pack, level 1. `wallet.econ.v = 2` marks it done; a second run is a no-op (tested).
- Cosmetics, pets, name, look and friends are untouched. Old serial keys use a different season prefix, so nothing
  can collide with the new ones.
- Before deploying, take a Neon snapshot or branch of the production database. The snapshot row stays the same
  shape; the old server can still read it if a rollback is needed (the three `rollback/*` branches hold the code).
- Not done: I have no access to the production database, so the backup itself has not been taken.

## Verification

- `tests/cards-unit.mjs` (17 checks): roster counts, three sets, values, migration, Welcome Pack, buying, 6,000-pack
  odds against the published table with the Rare guarantee, Golden Star's autograph guarantee, European Nights'
  elite pool, serials (no 1/1 twice), Buyer protections, the book after selling and trading, atomic trades, club
  claims, net worth and milestones, Dealer orders and races, friends.
- `tests/integration.mjs` (22 checks): real server and socket, earnings and both circles, one earner per account,
  proximity-checked stands, bulk opening, quotes and sales, two registered accounts, friends, a trade, profiles,
  leaderboard scopes, the 1/1 tracker, Dealer orders, a restart with everything persisted.
- `tests/browser.mjs` (27 checks, real Chrome at 1440×900 and 390×844 iPhone size): loading screen, Welcome Pack
  tear and reveal, values, placeholder portraits, white world, HUD overlaps, both circles, the Pack Seller, a box
  opened with skip, the Golden Star autograph, selling duplicates, the book, Top 5, profile with 3D avatar,
  inspection, leaderboard, tracker, Dealer, style, a milestone claim, persistence across refresh, touch controls,
  no horizontal overflow, no console errors. Screenshots in `qa-screens/`.
- Not done: no physical iPhone has run it. The mobile checks are Chrome at iPhone size with touch emulation.

## Hidden details (all honest: nothing changes odds or results)

One tear in twelve bursts instead of peeling; a 1 of 1 dims the room and lights only the card, flashes the whole
server's sky gold and makes the Dealer shout; signed cards write their ink as they flip; holding a Holo-or-better
card still for three seconds in inspection sweeps a spectrum across it; five unbroken minutes in the Gold Circle puts
coins in orbit around you; completing a club sets off confetti and the Pack Seller cheers; pets hop when you pull
something big; NPCs turn to face you, wave when you arrive, and one conversation in twelve gets a rarer line.

## Left to do after this branch

- Real portraits: drop `public/portraits/<player-id>.png` files in; nothing else changes.
- A physical iPhone pass (Safari touch, safe areas, performance).
- A production database snapshot before the first deploy of this branch, then merge to `main`.
- Optional: sound files instead of the synthesised tones; glTF models if hand-authored assets are wanted later.
