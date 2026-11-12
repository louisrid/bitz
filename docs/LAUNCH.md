# BITZ v1 launch checklist

**One public site:** https://stakkz.onrender.com/

**GitHub:** louisrid/bitz, production source branch `main`.
Do not create a second Render or Netlify deployment for this release.

## Automated verification

After each change to `main`, run:

```bash
BITZ_EXPECT_SHA="$(git rev-parse HEAD)" node tools/launch-smoke.mjs
```

This checks the public site, exact deployment build, working persistence flag,
main browser entry point, versioned assets and several real player photographs.
It uses read-only requests and creates no accounts or cards.

The existing CI suite verifies the 265-player roster, odds and pack guarantees,
serial uniqueness, economy, accounts, trading, progression, 3D world and
desktop/mobile-sized Chromium layout.

## Production prerequisites

- Only one public URL, `https://stakkz.onrender.com/`; no parallel production instances.
- An existing persistent database and the original stable `STAKKZ_SECRET` must be
  configured in Render. Never reset secrets or copy/change production account data.
- `/api/ping` should respond `ok: true`, `persistent: true` and the
  expected Git commit prefix in `build`.
- `/api/ready` should return HTTP 200. It returns 503 if no persistent store
  is configured. Keep health check on `/api/ping` until database configuration
  has been verified against the live service.
- Take a production database snapshot before any schema or economy migration.
  This release does not add one.
- Check sign-up, sign-in, trading, pack opening and account recovery after
  refresh on a real phone, plus desktop. The automated mobile check emulates touch.
- Do not describe this as fully live until the actual Render deployment and
  public smoke test have passed.

## Known limitations

- 252 of 265 footballers have local, attributed photographs. Thirteen use
  the stable placeholder until a verified photograph is available.
- Password recovery is not self-service. Existing password policy remains unchanged.
- Game autographs are digital illustrations, not authentic signed memorabilia.
- Football photo licences and player/publicity permissions need a separate
  review before any commercial public promotion.

**Release rule:** a green GitHub check means the code passed CI, not that
Render deployed it or that the public service has durable account storage.
