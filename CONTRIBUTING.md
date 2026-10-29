# Contributing

Economics is a Civilization VII mod: a game-scope script that keeps the loan ledger and moves Gold, Influence and
grievances through the engine's own calls, plus the policy cards and setup options that live in the game's data. This
page covers the setup, the checks to run before you submit, and the conventions the code follows.

## Typed JavaScript, no build step

The game loads the `.js` files in `ui/` directly as ES modules, so what ships is what you wrote, readable and
unminified. Types come from JSDoc annotations checked by `tsc --noEmit` (`checkJs`, strict), so the `/** @param … */`
blocks are the type system; the model's data shapes are in `types/econ-model.d.ts` and the engine globals in
`types/civ7-engine.d.ts`. Don't add `.ts` files or a build step.

## Setup

```sh
npm install
```

## Before you submit: `npm run verify`

```sh
npm run verify
```

It has to pass with zero errors and zero warnings. It runs:

1. `eslint ui tests scripts`: correctness rules and the size limits below.
2. `tsc --noEmit`, then `node --check` on every module and script, then `scripts/check-esm.mjs`, which catches what a
   per-file check can't: a name exported twice, an import whose file doesn't exist, and a named import the target
   module doesn't export. Each of these stops the whole mod from loading in game.
3. Every `tests/*.test.mjs` under `node --test`: the model's unit, property, invariant, balance and perf tests, and
   the gates (i18n parity, LOC keys, modinfo closure and cycles, core imports, no empty catch, Civilopedia pages,
   engine-free model modules).

`npm run release:gate` runs verify and then the tests again under c8; the coverage report lands in `coverage/`.
`npm run mutation` runs Stryker on the rule modules (`stryker.config.json`), house bar high 75, low 60.

## Style limits (enforced by ESLint)

- cyclomatic complexity ≤ 10
- max statements per function ≤ 18
- max nesting depth ≤ 4
- max parameters ≤ 5 (bundle extras into one options or context object)
- max lines per function ≤ 50, per file ≤ 500
- line length ≤ 120 (strings, templates, regular expressions and URLs exempt)

When a function trips a limit, pull out a small named helper rather than switching the rule off. Tests are exempt
from the length and complexity limits.

## How the model is fed

The loan model (`ui/econ-plan.js` and the modules it imports) is engine-free: plain data in, transfers out. The glue
that reads the game and sends the grants is prompt 4's work; what it has to provide and what it gets back is written
down in [docs/glue-contract.md](docs/glue-contract.md). `tests/engine-free.test.mjs` fails on any engine global in a
model module, so the boundary stays where it is.

## Conventions

- The numbers live in `ui/econ-params.js`, each with the DESIGN section it comes from. The rules are pure functions
  pinned by the tests; a change to a rule changes a test.
- Engine reads are guarded. A read that throws gives its fallback and the turn carries on; nothing throws out of a
  handler. Hold a city or unit by its component id and re-resolve it each turn, never the object.
- Logging goes through `ui/econ-log.js`, tagged `[Economics]`. `console.log` never reaches `UI.log`; the module
  writes with `console.error`, which does. `DBG` gates the chatty lines and `release.sh` forces it off.
- Settings live in the `economics` slice of the shared `modSettings` `localStorage` key. Never add a top-level
  `localStorage` key. Read the slice once and cache it: a read costs about 6.5 ms.
- Every string a player sees is a `LOC_ECONOMICS_` tag in `text/en_us/` and in all eleven other languages.
  `tests/i18n.test.mjs` checks parity, languages and placeholders; [text/README.md](text/README.md) has the workflow.
- Gameplay rows are written by SQL that selects through the parent table, so a missing DLC or a changed tree skips the
  row instead of stopping game creation; each data group is gated by its setup option. Types, tags and ages the
  scripts use are read from `GameInfo` at runtime, never from a list. `GameInfo` tables have no `some`, `every`,
  `map` or `reduce`: use `for...of`, `find` or `filter`.
- Major civs only. City-states and independents never borrow, pay, lend or get investment. Single-player writes only.
- `ui/settings-keeper.js` is the Tower Settings Keeper, copied unchanged from its own repo. Don't edit it here.
  `scripts/steam-changelog.mjs` is the same file in every Tower mod; keep it identical.
- Comments say why: engine behaviour, workarounds, the design section a rule comes from. Never what the next line
  does, process history or test counts.
- Never copy, import or run another mod's files. Economics reads other mods' state and globals only, as listed in
  [docs/compatibility.md](docs/compatibility.md).

## Naming

- Functions are camelCase and start with a verb; constants that never change are UPPER_SNAKE_CASE; files are
  kebab-case with the `econ-` prefix, so the game's loader can't mix them up with another mod's files.
- Booleans read as a yes/no question: `isOpen`, `hasStage`, `fitsService`.
- Names say what the thing is. No abbreviations a reader has to decode (`loan`, not `l`; `format…`, not `fmt…`), and
  single letters only for loop counters, short comparators and conventional math. `pid` (a player id) and `ctx` (the
  turn context) are fine: the game and the codebase use them everywhere.
- Exported names never start with `_`. An export that exists only for tests says so in its name (`_resetForTests`).
- Verbs keep one meaning across the mod:

| Verb | Means |
| --- | --- |
| `read…` | reads the engine (`Players`, `GameInfo`, `Configuration`) and returns plain data |
| `compute…` | pure math on data already read; no engine or DOM |
| `resolve…` | looks something up, with a fallback when it is missing |
| `get…` | returns stored state or a setting |
| `format…` | turns a value into display text |
| `build…` | creates and returns a DOM element (or a data structure) without attaching it |
| `render…` | fills a host element the caller passes in |
| `make…` | returns a configured object (a factory) |
| `plan…` | one turn of the model: data in, transfers out |

- These names end up in players' saves and settings and never change: the mod id `tower-economics`, the save
  envelope (`MOD_ID` and `VERSION` in `ui/econ-state.js`), every `LOC_ECONOMICS_` tag, the setup parameter ids
  `ECONOMICS_*`, the settings slice `economics`, the CSS prefix `--econ-` / `econ-`, and the harness global
  `globalThis.__towerEconomics`. Renaming one needs a migration.

## Project layout

```
economics.modinfo            the manifest: shell group (setup SQL, text), game group (scripts), gated data groups
config/econ-setup.sql        the setup options (shell scope)
data/                        the level 1 gameplay rows, one file per setup option that gates them
ui/econ-bootstrap.js         the game-scope entry script
ui/econ-log.js               [Economics] log lines, the DBG switch
ui/econ-plan.js              one turn of the ledger; imports the model below
ui/econ-{money,params,loan,credit,stages,lenders,payments,guard,ai,repudiation,tax,conservation,batch,state,
         invariants,turn,requests,shortfall}.js   the engine-free loan model (DESIGN 4.1 to 4.6, 4.14)
text/<locale>/ModText.xml    the strings (12 locales)
history-corrections/         the Civilopedia History Corrections text every Tower mod carries
docs/                        DESIGN.md, TEST-PLAN.md, NOTES.md, the glue contract, compatibility, verification runs
tests/                       the model's tests, the gates, fixtures dumped from the compiled gameplay DB
types/                       JSDoc types for the model and the engine globals (dev only)
scripts/                     check-esm, the Steam change-note script, the README PDF build, the fixture dump
devtools/                    development only, never shipped
```

## Trying a change in game

The game runs the copy in its `Mods/` folder, not the repo. `node tools/tower-bench/tower-bench.mjs deploy
tower_mods_in_dev/economics --yes` (from the workspace root) replaces that copy with the files that ship; a mod folder
new to the game registers on its first launch and loads on the second. [devtools/README.md](devtools/README.md)
describes the lab run and the probe mods. The mod's log lines carry the `[Economics]` prefix in `Logs/UI.log`.

## Releasing

See [docs/release-checklist.md](docs/release-checklist.md). `./release.sh` runs `npm run verify`, builds
`dist/economics/` and its zip with `DBG` forced off, audits the zip against an allow-list and writes the Workshop
manifest. Change notes come from `CHANGELOG.steam.txt`, which `node scripts/steam-changelog.mjs sync` keeps in step
with `CHANGELOG.md`.

## License

Changes go under the same terms as the mod: the Tower Mod License 1.0 in [LICENSE](LICENSE), with
`ui/settings-keeper.js` under MIT. By sending a change, you agree I can release it under those terms.
