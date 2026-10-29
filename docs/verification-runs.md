# What has been watched, and the runs behind it

Nothing in a running game yet. Version 0.1.0 (2026-10-29) was built and checked offline only: `npm run release:gate`
(193 tests, tsc, ESLint, check-esm, coverage) and `./release.sh`. The reader-facing account is the
[README](../README.md); this file is the evidence behind it, in the form Canals' `docs/verification-runs.md` uses.

## The load check (owed)

The first lab run has to show, with every other mod off: the mod registers and loads (`Modding.log`), the setup SQL
compiles without an error (`Database.log`), the six options show on the setup screen with their defaults, the boot
line `[Economics] v0.1.0 loaded; nothing runs yet` appears in `UI.log`, the two empty gated data files load without
an error, and `tower-bench check tower_mods_in_dev/economics` passes. Then the same with the usual set.

## The model (offline)

| Check | Where | Observation |
| --- | --- | --- |
| The 1.0 rules (DESIGN 4.1 to 4.6, 4.14) | `tests/econ-*.test.mjs`, 152 tests, plus the engine-free scan | pass, 2026-10-29, after the port from `mod_ideas_tested/economics` |
| Invariants debt-1 to debt-7 and alive-target | `tests/econ-invariants.test.mjs`, `tests/econ-properties.test.mjs` | hold over 500 random economies |
| Balance rows of DESIGN 10 | `tests/econ-balance.test.mjs`, `reports/balance-1.0.json` | run 2026-10-29 in the research copy; the owner's reading of "Borrowing pays" is open |
| Mutation | `stryker.config.json`, `docs/NOTES.md` | last run 2026-10-29 in the research copy, before the port |

## The runs, in order

| Run | Question | Observation |
| --- | --- | --- |
| | | |
