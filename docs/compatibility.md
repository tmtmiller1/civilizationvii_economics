# Compatibility with other mods

Last reviewed 2026-10-29 against Economics 0.1.0 on Civilization VII 1.5.0. Nothing has run in a game yet, so every
line below is read from code. "Read from code, not run" means it hasn't been tried in a game: treat it as a prediction
with its reasoning laid out, and the cheapest test that would settle it is named beside it.

This file records what Economics touches, which kinds of mod touch the same things, and what a player would see when
both are enabled. Other authors' mods are described by what they do, not by name.

## What Economics touches

Everything a conflict could come through. A mod has to touch one of these to conflict with Economics.

| Surface | What Economics does with it |
| --- | --- |
| Setup screen (shell scope) | Adds six options under Game Options, ids `ECONOMICS_*` (`config/econ-setup.sql`) |
| Database (game scope) | The gated data groups are empty in 0.1.0. Prompt 4 adds the tax policy cards and their unlocks (Taxes on) and the AI weighting lists (AI on), each written by SQL that selects through its parent table |
| Civilopedia text | The four Civilopedia History Corrections files every Tower mod carries, only with Civilopedia Expanded: Independents in use |
| Scripts (game scope) | `ui/econ-bootstrap.js` logs one line. Nothing else runs in 0.1.0 |
| Shared settings | The `economics` slice of the `modSettings` `localStorage` entry, not written yet |
| Saved game state | None yet; the ledger envelope (`tower-economics`, version 2) arrives with prompt 4 |
| Globals | `globalThis.__towerEconomics`, not set yet |

## Reads of other mods' state

None yet.

## Summary

| Kind of mod | Result | Status |
| --- | --- | --- |
| Changes warehouse or other building tags (Warehouse Overbuilding, Aging Warehouses) | Building roles follow the compiled tags, so a building they change moves role or drops out (TEST-PLAN 12.5) | Read from the design; the roles arrive with prompt 4 |
| Adds its own setup options | Both sets show; `ECONOMICS_*` ids and sort indexes 2200 to 2205 collide with nothing found | Read from code, not run |
| Two copies of Economics installed at once | `INSERT OR IGNORE` keeps the setup rows from rolling back; the scripts' behaviour is unpredictable, as for every mod | Known engine behaviour |

## Known interactions

- `tower-bench check` will list `globalThis.SettingsKeeper` as a global this mod shares with every other Tower mod
  that carries the Tower Settings Keeper file. That is the keeper's own protocol: the first copy to run installs
  itself and every later copy finds it and does nothing, the newest build winning.
