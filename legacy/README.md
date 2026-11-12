# Legacy systems (BITZ 1.x)

These files are **not loaded** by BITZ 2.0. They preserve the last adventure environment for potential restoration.

- `voxel-world.adventure.js`: mountains, vegetation, caves, wildlife, waterfall and exploration renderer.
- `world-layout.adventure.js`: exploration coordinates and destinations.

The rollback branch `rollback/pre-bitz-2-2026-11-12` and the full Git history preserve the rest of the original game code, including Monopoly board gameplay, trading, weapons, zombies, clans and account-data formats. BITZ 2.0 keeps persistent account data untouched.

To restore a legacy system, restore its archived implementation **and** the matching client/server routes, tests and presentation from the rollback ref. Never restore only the UI buttons.
