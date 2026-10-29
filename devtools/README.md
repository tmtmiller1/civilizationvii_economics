# Economics devtools

Nothing here ships. `release.sh` leaves the whole folder out.

Until prompt 4 moves them, the probe mod for P17 and P18, the probe run sheet and the foreign-key precheck live in
`mod_ideas_tested/economics/devtools/`, and the tower-bench recipes for the engine probes in
`mod_ideas_tested/economics/tests/recipes/`. The glue contract the probes feed is
[docs/glue-contract.md](../docs/glue-contract.md).

| Path | What it is |
| --- | --- |
| (none yet) | The in-game harness behind the acceptance checks arrives with prompt 4, driven through `globalThis.__towerEconomics`. |

## A lab run

```
# from the workspace root
node tools/tower-bench/tower-bench.mjs mods                               # nobody else holds the game; see which copies are live
node tools/tower-bench/tower-bench.mjs deploy tower_mods_in_dev/economics --yes   # the game's copy of the mod
node tools/tower-bench/tower-bench.mjs lab start --seed 4242 --age AGE_ANTIQUITY
...
node tools/tower-bench/tower-bench.mjs lab stop                           # restores saves, options and the registry
```

The lab backs up the mod registry before the game starts and puts it back at `lab stop`. A mod folder new to the game
registers itself the first time the game launches with it in `Mods/`, so the first lab start after copying it in only
registers it; the second loads it. Check `uptime` and `pgrep -x CivilizationVII` first, run one game at a time, and
drive it with scripted probes only, never synthetic key events.

The mod's log lines carry the `[Economics]` prefix in `Logs/UI.log`. `DBG` in `ui/econ-log.js` turns on the per-turn
lines.
