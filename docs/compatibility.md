# Compatibility with other mods

Last reviewed 2026-10-29 against Economics 0.3.0 on Civilization VII 1.5.0. Nothing has run in a game yet, so every
line below is read from code. "Read from code, not run" means it hasn't been tried in a game: treat it as a prediction
with its reasoning laid out, and the cheapest test that would settle it is named beside it.

This file records what Economics touches, which kinds of mod touch the same things, and what a player would see when
both are enabled. Other authors' mods are described by what they do, not by name.

## What Economics touches

Everything a conflict could come through. A mod has to touch one of these to conflict with Economics.

| Surface | What Economics does with it |
| --- | --- |
| Setup screen (shell scope) | Adds twelve options under Game Options, ids `ECONOMICS_*` (`config/econ-setup.sql`) |
| Database (game scope), Taxes on | Three policy cards per age (`TRADITION_ECONOMICS_<LEVEL>_<AGE>`) in the game's own `POLICY_CULTURE_SLOT`, six flat-yield modifiers (`MOD_ECONOMICS_*`), one extra policy slot granted by each age's root civic, unlock rows on the root civics and on the node that unlocks the Market, two AI strategies with a Gold and a Happiness yield bias. Every unlock row selects through the tree tables, so a mod that moves or renames a civic moves the cards with it |
| Database (game scope), always | One notification type, `NOTIFICATION_ECONOMICS_TURN` |
| Civilopedia text | The four Civilopedia History Corrections files every Tower mod carries, only with Civilopedia Expanded: Independents in use |
| Gold, Influence, celebration meter | `Players.grantYield` once per civ per turn at `TurnBegin`, netted; the amounts are a loan's principal, payments, garnish, and -5 Influence per missed payment |
| Grievances and relationships | `changeNumGrievances` on a repudiator against its lender, `changeRelationshipLevel` -3 (or -6, -2) with each civ the repudiator has met, only on a repudiation |
| The policy change | `CHANGE_TRADITION` for the local player only, from the Fiscal tab, and only when `canSwapCultureSlot` allows |
| Scripts (game scope) | `ui/econ-bootstrap.js` and what it imports; `Controls.define("screen-economics")`, `Controls.decorate("panel-sub-system-dock")` for the button and pill |
| Shared settings | The `economics` slice of the `modSettings` `localStorage` entry: the last tab and the dock-button switch |
| Saved game state | Two configuration values: `tower-economics` (the ledger, at most 64 KB) and `tower-economics-glue` (stage turns, civs seen, queued requests, the guard switch, the turn count across ages, the roles each building type had in its own age, the cycle's events since the last batch) |
| Globals | `globalThis.__towerEconomics` (the console surface) |
| Engine events | `TurnBegin`, `PlayerTurnActivated`, `TraditionChanged` (listened to only during a swap), and from 1.2 `CityTransfered`, `CityRazingStarted`, `RandomEventOccurred` |
| Database (game scope), Economic systems and Taxes on (1.2) | 19 flat-yield modifiers (`MOD_ECONOMICS_SYS_*`) gated on a slotted tax card, attached as `GovernmentModifiers` to Despotism, Classical Republic, Feudal Monarchy, Revolutionary Authoritarianism, Authoritarianism and Bureaucratic Monarchy, and as `KIND_MODIFIER` unlocks on the node that unlocks Dirigisme; each row selects through `Governments`, `Traditions` and `Modifiers`, so a government or card a game lacks skips its rows |
| Governments, ideologies, buildings and events (1.2) | Reads each major's `Culture.getGovernmentType` and `getChosenIdeology`, `GameInfo.Governments`, `Ideologies`, `Buildings` (the unique trait) and each building's `Age` and `AGELESS` tag, `Game.CrisisManager`, `GameplayMap.getOwner` and `getOwningCityFromXY` for a disaster's plot, and each city's population; listens to `CityTransfered`, `CityRazingStarted` and `RandomEventOccurred`; writes one more configuration value, `tower-economics-macro` (the business cycle and each civ's system, at most 32 KB) |
| Trade, resources and builds (1.1) | Reads each major's `Resources.getResources()` with `Game.Resources.getOriginCity`, its routes, its cities' build queues and Trade Income, `GameInfo.Resources` and `Units.StrategicResource`; writes `BuildQueue.addProgress` on a city's current build for a development loan, and one more configuration value, `tower-economics-markets` (prices, tariffs, at most 32 KB) |

## Reads of other mods' state

None. Building roles, stages, resources and the units that name a strategic resource are read from `GameInfo` with
every mod applied, so a mod that adds a resource gets it a price, and one that gives units strategic resources
(Strategic Resources That Matter) raises those resources' demand.

## Summary

| Kind of mod | Result | Status |
| --- | --- | --- |
| Changes building tags or Gold yields (warehouse overbuilding, aging warehouses, rebalances) | Building roles follow the compiled `TypeTags` and `Constructible_YieldChanges`, so a changed building moves role or drops out; the Bank's own yield sets the Banking bar | Read from code, not run. Test: a game with a tag mod on, the Treasury tab's building counts against the city's buildings |
| Moves or renames civics or techs | The cards and the slot follow the root civics of the main tree and the Market's unlock node; stages follow the anchor's unlock node; a renamed node that no longer exists skips the row and the stage opens by age | Read from code and the database copy (`tests/econ-data.test.mjs`) |
| Adds policy cards or policy slots | Both sets of cards show in the same slots; the tax slot is one more slot for any card. A mod that removes `POLICY_CULTURE_SLOT` would drop the cards (cascade) and the mod would run without taxes | Read from code, not run |
| Moves Gold by script (the other Tower mods' Gold-priced actions, trade mods) | Both land; Economics reads the balance fresh at `TurnBegin` and never again that turn, so another mod's same-turn charge is seen next turn. A payer is never pushed below its income's worth of Gold by Economics, so another mod's charge can't be the one that goes unpaid because of it | Read from code, not run. Test: a Canals dig and a loan payment in one turn |
| Reads Gold per turn or balances (Demographics, Emigration, Partisans) | The grants show as balance moves, not as income (`getNetYield` doesn't include a grant, P2), so a per-turn Gold chart sees no change and a balance chart sees the loan | Read from the probe, not run with the mods |
| Books grievances or moves relationships (Emigration's war refugees, diplomacy mods) | Additive: the game sums them | Known engine behaviour |
| Adds a dock button (Demographics, Emigration, Mod Commons) | One more button; Mod Commons isn't released, so the button is Economics' own decorator | Read from code, not run |
| Adds its own setup options | Both sets show; `ECONOMICS_*` ids and sort indexes 2200 to 2211 don't collide with any found | Read from code, not run |
| Adds or renames governments, or changes their modifiers (government mods, Leugi's Government Flavour) | A government the mod's table doesn't list runs a mixed economy; the systems' modifiers attach only to governments that exist and stack with any a mod adds | Read from code and the database copies, not run |
| Removes `AGELESS` from a building (Warehouse Overbuilding) | The building ages and fades by its roles, as DESIGN 4.16 says it should | Read from code, not run |
| Adds resources or changes resource classes | A new resource gets a price from its class; a removed one drops out of the Markets tab and the bills | Read from code, not run |
| Changes trade routes or Trade Income (route mods, Port-of-Nations-style cards) | The engine's own Trade Income is untouched and shown beside the bill; the bill follows the imports the game reports, wherever they came from | Read from code, not run |
| Sets city production by script | A development loan's `addProgress` adds to the same build; both land | Read from code, not run |
| Two copies of Economics installed at once | `INSERT OR IGNORE` keeps the setup rows from rolling back; two bootstraps find the harness global and the second stands down | Read from code, not run |

## Known interactions

- `tower-bench check` will list `globalThis.SettingsKeeper` as a global this mod shares with every other Tower mod
  that carries the Tower Settings Keeper file. That is the keeper's own protocol: the first copy to run installs
  itself and every later copy finds it and leaves it in place, the newest build winning.
- Partisans reads a civ's active policy cards for its hardship; it will see the tax cards once it names the
  `TRADITION_ECONOMICS_*` types (DESIGN 4.7's hardship column), which is Partisans' change, not this mod's.
