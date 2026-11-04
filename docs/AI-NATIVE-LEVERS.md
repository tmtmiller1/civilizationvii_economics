# Native levers for what Economics does by script (2026-11-03)

Status: research only, nothing built. Every lever below that isn't already native needs its probe watched, and the
owner's go, before any data or code is written (the feature gate in the workspace `CLAUDE.md`).

The game's AI plans with its yields, its income per turn, its policy cards, its own preference lists and its
relationships. It meets most of what Economics does as a balance that jumped, a meter that moved or a relationship
that changed, with no rule behind it that it can plan for. This page takes each way Economics changes the game by
script, names the native system that could do the same job where one exists, and gives the cheapest lab probe that
would show it working or not.

Sources: `docs/AI-PLAN.md` section 1 (the 10-31 engine survey, cited and not redone), DESIGN "Native first" and the
probe ladder (section 10: P2, P6, P8, P17, P18, the 1.1 and 1.2 probe notes), `engine-closed.md`,
`mod_ideas_tested/partisans/AI-WAR-FINDINGS.md`, World Congress `SPEC.md` probes D1 to D4, the compiled
`Debug/gameplay-copy.sqlite` read on 2026-11-03 (an Exploration database from a game without Economics loaded, so the
mod's own rows aren't in it), the binary's exported names, and tonight's lab run `2026-11-04T03-13-04`.

## What the engine already settles

These limits decide most rows, so they're stated once here.

- A Gold grant moves the balance, never income: a +100 `grantYield` didn't move `getNetYield` the next turn (P2). So
  the AI's purchases feel a grant, while its income-based strategies (`YieldIncome`), city planning and yield biases
  don't. AI-PLAN 1: no table gives the AI a Gold reserve; purchases gate on the balance, strategies on income.
- There's no runtime modifier attach; modifier rows ship as data, switched on per game only by a setup parameter
  (`engine-closed.md`, `data-rows-no-options-switch`).
- A script can't start an operation or a diplomatic action as an AI: it's accepted and ignored (`engine-closed.md`,
  WC D1). `Culture.unlockTradition` exists but doesn't unlock a card for an AI (Emigration, 2026-10-28).
- A diplomatic action a mod adds is scored by the AI and never started (P18). An existing endeavor rewritten in place
  lost all AI scores, while Military Aid, left an endeavor, is started 7 times in 120 turns (1.1 C13).
- The AI's card pass prices a policy card at face value and scores a gated modifier as if it applies (P17), so a card
  can't be timed to a crisis the mod detects.
- Relationship writes, tonight's run (`2026-11-04T03-13-04`, Exploration, vanilla, AI pairs):
  `changeRelationshipLevel(b, 5)` moved both sides 0 to 5 and filed `LOC_HISTORICAL_EVENT_FROM_FIRE_TUNER`;
  `changeNumFavors(b, 5000)` moved favors 10 to 15 and the level 18 to 23; `changeNumGrievances(b, 5000)` moved
  grievances 0 to 5 and the level -3 to -8. 5000 is 5 points. Favors and grievances move the level one for one and
  are filed with event type -1 and no name. Script grievances turn the AI hostile within a turn: sanctions and enemy
  targeting (AI-WAR-FINDINGS question 2). How a seat pair's breakdown shows favors and the Fire Tuner line on screen
  hasn't been seen (probe M5); a script grievance reads as a blank label with its number (Partisans capture).
- The one per-player switch a script can flip for an AI at runtime is a building: `CREATE_ELEMENT {Kind:
  CONSTRUCTIBLE}` with `Owner` set to an AI lands it in that AI's city centre, and a `GameModifiers` row with
  `REQUIREMENT_CITY_HAS_BUILDING` picks up a building placed after the start (Dams, `engine-closed.md`, watched
  2026-09-28). `DESTROY_ELEMENT` takes it away. The owner has ruled out standing hidden effects (AI-PLAN 4.2; World
  Congress "no hidden buildings"), so every row that leans on this is the owner's call before any probe.
- Native effect types found in the DB that no Economics design has used yet: `EFFECT_CITY_ADJUST_YIELD_CONVERSION`
  (Pachacuti's 10% of Food as Production), `EFFECT_ADJUST_PLAYER_OR_CITY_ALL_PURCHASE_EFFICIENCY` (the price lever the
  1.2 probe watched under Despotism), `EFFECT_PLAYER_ADJUST_GOLDEN_AGE_THRESHOLD` and `EFFECT_ADJUST_MULTIPLY_TREASURY`
  (no base row uses either), `EFFECT_DIPLOMACY_GRANT_DIPLOMATIC_ACTION` (how `DIPLOMACY_ACTION_DEMAND_TRIBUTE` and
  `SABOTAGE_TREASURY` reach a civ; both are `RequiresUnlock`).

## The levers

"Owner" in the blocker column means the row waits on the owner's call about script-placed buildings. All files are
under `ui/`; the writes themselves go out through `econ-session.js:349-379` and `econ-engine.js:457-533`.

| # | Script lever (what Economics does, file:line) | What the AI sees now | Native candidate | AI already plans with it? | Blocker | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Loan principal into a treasury: civ, bond, emergency, refinancing loans (`econ-turn.js:147-157`, `econ-shortfall.js:74`, `:111`, `econ-requests.js:141`) | balance up about 3 s later; income unchanged | Send Gold (`DIPLOMACY_ACTION_SEND_GOLD`), deals (`Game.DiplomacyDeals`) | no: no AI used Send Gold in 85 turns (P18); deals carry no turn count (1.1 C4-C7) | no native loan exists | no native lever, keep the script |
| 2 | Debt service: payments, garnish, dividends paid each turn (`econ-plan.js:366`, `:383`, `econ-commerce.js:187`, `:226`) | balance down after the roll; income, `YieldIncome` strategies and `YieldBiases` blind to it | a building in the borrower's city with a negative Gold line (`Constructible_YieldChanges`), placed and removed by script; a positive one for the lender | yes: income per turn drives its strategies, biases and the Economics Short of Gold row | Owner; amounts come in steps (a ladder of building types); P2's open note that AI building upkeep read 2-6 while the engine charged 0 says use a yield line, not maintenance | needs probe (M1) |
| 3 | Escrow hold of next turn's dues (`econ-escrow.js:82-89`) | a lower balance, which is what its purchases read | none: no reserve parameter; `SaveGoldForVictory` belongs to the Modern economic victory (AI-PLAN 1) | the balance, yes | none | no native lever, keep the script |
| 4 | AI preference factors: Gold bias while debts bite, army and expansion budget in distress, Rearmament's army factor (`econ-escrow.js:106-125`) | its own `YieldBiases` and `AiBudgetBiases` change | `Players.AI.get(pid).scaleAiPreference` is the AI's own planning | yes, watched to change builds and Gold (AI-PLAN 4.7) | none | native now |
| 5 | Build progress: build loans, development loans, public works, path cards (`econ-commerce-read.js:284`, `econ-shortfall.js:387`, `econ-invest-open.js:215`, `econ-crisis-respond.js:549`, `econ-policy.js:185`) | its own chosen build finishes sooner; it keeps the build (P8) | `EFFECT_CITY_GRANT_FREE_PURCHASE_CHARGE` (fixed buildings, data only) | the build is its own choice already | no runtime amount | no native lever, keep the script |
| 6 | The Planned system's take: 20% of Gold income into builds (`econ-macro.js:314-326`; `econ-planned.js:6-7` says no data effect turns Gold into Production) | Gold gone, progress landed; income unchanged | `EFFECT_CITY_ADJUST_YIELD` Gold `Percent` -20 plus `EFFECT_CITY_ADJUST_YIELD_CONVERSION` Gold to Production 20, gated on `REQUIREMENT_PLAYER_HAS_IDEOLOGY` Communism | yes: city yields; picks ideology by its lists (1.2 probe) | the conversion adds rather than moves, hence the paired Percent row; which one applies first is unknown | needs probe (M3) |
| 7 | Trade bills netted per pair, capped by income (`econ-commerce.js:102-131`) | balance moves | the per-import levy (1.1: -1 Gold an import, player-wide); `TradeYields` read 0 | it values routes, not bills | netting and the cap need a script (DESIGN "Native first") | no native lever, keep the script |
| 8 | Tariffs: the AI's level and High's relationship cost (`econ-commerce.js:115`, `:260`; `econ-trade.js:172`) | relationship down, Fire Tuner line | an existing sanction re-pointed to cut the target's trade Gold (`EFFECT_DAE_GRANT_COOPERATIVE_YIELD_SUPPORT_BASE_PER_TURN`, as Sabotage Treasury does) | yes: it scored Hinder Finances 84 times while it stayed a sanction (1.1) | changes a base sanction for every player; the tariff becomes per partner; owner's call | needs probe (E3), after the owner |
| 9 | World-account Gold: cycle Gold, erosion, crisis response costs and subsidies, card administration and legacies (`econ-macro.js:270`, `:287`, `:305`; `econ-crisis-respond.js:204`, `:516`, `:555`, `:571`, `:583`, `:589`; `econ-policy.js:108`, `:214`, `:264`, `:359`) | balance moves; income blind | the standing ones as building Gold lines, as row 2; one-off charges stay grants | yes, through income | Owner; the same steps problem | needs probe (M1 covers it) |
| 10 | Prices: inflation stands in for purchase prices by eroding held Gold; Debase, Bullion and Gold standard raise the mod's market prices (`econ-macro.js:296-305`, `econ-crisis-respond.js:627-659`) | balance shrinks; game prices unchanged | `EFFECT_ADJUST_PLAYER_OR_CITY_ALL_PURCHASE_EFFICIENCY` switched by a placed building; `EFFECT_ADJUST_MULTIPLY_TREASURY` for erosion | prices, yes: its purchases read them; the treasury multiplier is unread | Owner for the building; the multiplier's arguments are unknown and no base row uses it | needs probe (M2, E1) |
| 11 | The celebration meter: citizens' interest and misses, relief, cancel debts, arrears, card support and legacies (`econ-citizens.js:93`, `:107`, `:121`; `econ-arrears.js:96`; `econ-crisis-respond.js:517-524`; `econ-policy.js:232`, `:260`, `:355`) | its next celebration comes sooner or later (P6) | a city Happiness line from a placed building; `EFFECT_PLAYER_ADJUST_GOLDEN_AGE_THRESHOLD` | Happiness yes (`HasHappinessLessThan`, `CITY_STRATEGY_STAY_HAPPY`); the threshold unread | Owner | needs probe (M2) |
| 12 | Influence charges: a missed payment, card prices, opposition, confidence (`econ-plan.js:411`, `econ-commerce.js:203`, `econ-crisis-respond.js:59-61`, `:272`, `econ-policy.js:130`, `:208`) | its Influence stock drops | `DiplomaticActionInfluenceCosts` prices only the game's own actions | the stock, yes | no per-event charge exists | no native lever, keep the script |
| 13 | Grievances: repudiation, tribute, suspended or gold-standard lenders, card costs (`econ-repudiation.js:66`, `econ-crisis-respond.js:154`, `:226`, `econ-policy.js:78`) | the shared level falls one for one; it sanctions and targets within a turn | `EFFECT_PLAYER_GRANT_FAVORS_GRIEVANCES` (fixed civ, leader, allies or all), `EFFECT_DAE_COMPLETE_GRANT_FAVORS_GRIEVANCES` (on an action's stage) | yes, it acts on them (AI-WAR-FINDINGS) | neither native route takes a runtime target; the entry has no name | native now: keep the call; the label is the open part (M5) |
| 14 | Relationship moves: lender hit, witnesses, investment and aid goodwill, bank holiday, rearmament, price supports, cards (`econ-repudiation.js:69`, `econ-invest-open.js:258`, `econ-crisis-respond.js:153`, `:245`, `:604`, `econ-policy.js:251`) | the level moves on both sides; history shows Fire Tuner | Military Aid's `TargetFavors` (the AI's own aid, shipped in `data/econ-investment-diplomacy.sql`) | yes, the level | no per-target native call | no native lever, keep the script |
| 15 | Favors on a loan repaid in full (`econ-plan.js:396`) | favors and level up one for one, unnamed | as row 13 | yes | as row 13 | no native lever, keep the script (M5 shows the label) |
| 16 | Diversionary war: the mod declares a Fascist AI's war (`econ-policy.js:152-156`, `econ-engine.js:120-124`) | a native surprise war it then fights itself | `scaleAiPreference("DiplomaticActions", "DIPLOMACY_ACTION_DECLARE_WAR", f)`, so the AI picks its own target and turn | it chooses wars itself; no declare-war score shows in peacetime (AI-WAR-FINDINGS) | may not move a peacetime AI at all | needs probe (M4) |
| 17 | The AI's money decisions: borrowing, repaying, repudiating, lending, investing, aid, tariffs, crisis responses and cards (`econ-shortfall.js:187-365`, `econ-commerce.js:260`, `:396`, `:472`, `econ-crisis-respond.js:482`, `econ-policy.js:813`, `econ-macro.js:335`) | nothing: the mod decides for it | policy cards (face value, P17); Military Aid for aid (shipped); Demand Tribute for an Exploration tribute line via `EFFECT_DIPLOMACY_GRANT_DIPLOMATIC_ACTION` | cards and Military Aid yes; Demand Tribute only where granted | cards can't be timed to a crisis; a mod action is never started; the catalog's Tribute response is Antiquity-only and Demand Tribute is Exploration-only | no native lever, keep the script; Demand Tribute needs probe (E2) |
| 18 | The player's tax card swap (`econ-fiscal.js:90-98`) | not the AI's door; it slots cards in its own pass (P17) | `CHANGE_TRADITION` is the game's own operation | yes | none | native now |
| 19 | The tax fallback, off by default (`econ-plan.js:148`, `:323-339`) | balance and meter | the tax cards and system tax lines in `data/` | yes | none | native now: the cards replace it |

Count: 4 native now (4, 13, 18, 19), 7 need a probe (2, 6, 8, 9, 10, 11, 16), 8 have no native lever and keep the
script (1, 3, 5, 7, 12, 14, 15, 17); row 17 also carries probe E2 for one candidate. Rows 2, 8, 9, 10 and 11 wait on
the owner's call before their probes.

## Probes

Two games carry all of them: one Modern, one Exploration. Each runs with the Economics working copy and a probe data
mod (`econ-probe-native`, own building types, no foreign keys outside base tables) and every other mod off, the seat on
autoplay. Nothing here re-tests what other mods watched: building placement for an AI (Dams), AI card slotting (P17),
the relationship calls (tonight's run).

| Probe | The one thing it must show | Lab setup | Script to set up? |
| --- | --- | --- | --- |
| M1 Debt line on a building (rows 2, 9; owner first) | The turn after a -10 Gold building is placed in an AI capital, that AI's `getNetYield(YIELD_GOLD)` reads 10 lower and `Player_Treasury.csv` charges it; the same building in the seat's capital shows as a named line in the Gold tooltip (capture); the AI still holds it 10 turns later. A second building with 10 Gold maintenance beside it shows whether AI upkeep is charged at all (P2's open note) | Modern, seed 4242, turn 2 onward | yes: `CREATE_ELEMENT` for the AI and the seat, then reads |
| M2 Price and Happiness switched by a building (rows 10, 11; owner first) | A unit's purchase price in the AI city holding the marker rises by a quarter the turn after placement and falls back the turn after `DESTROY_ELEMENT`; that city's Happiness line drops by 2 and the AI's `CITY_STRATEGY_STAY_HAPPY` shows in its strategy log if it goes under | Modern, same game as M1 | yes: place, read, destroy, read |
| M3 Planned take as a conversion (row 6) | From turn 2, every city of an AI on the probe's gating government reads about a fifth less Gold and the matching Production; the seat on that government sees both lines named in its city yield tooltip (capture). The probe gates on the government the Modern AIs hold at start (all Authoritarianism in P14), so no ideology pick is needed | Modern, same game | no: data only, then reads |
| M4 War by preference (row 16) | An AI given `("DiplomaticActions", "DIPLOMACY_ACTION_DECLARE_WAR", 50)` each turn shows a declare-war row in `AI_DiplomaticActions.csv` or declares in `DiplomacySummary.csv` within 10 turns, against an Unfriendly neighbour, while the control AIs show neither. No row in 10 turns closes the lever | Modern, same game; needs one Unfriendly AI pair (book grievances at turn 2 if none) | yes: one eval a turn |
| M5 How script relationship entries read on screen (rows 13 to 15) | With the seat met to an AI: `changeRelationshipLevel` 5, `changeNumFavors` 5000 and `changeNumGrievances` 5000 between that AI and the seat, then the diplomacy hub's relationship breakdown on that AI (capture). It shows what label, if any, each of the three entries carries; the AI-pair readings from tonight already settle the numbers | Modern, same game, any turn after first meeting | yes: three evals, then open the hub |
| E1 Treasury multiplier (row 10) | A probe modifier of `EFFECT_ADJUST_MULTIPLY_TREASURY` on the seat (`REQUIREMENT_PLAYER_IS_HUMAN`) makes the balance at the roll differ from the old balance plus net income by the multiplier; `Database.log` shows whether the guessed argument names load. No difference in two turns closes it | Exploration, seed 9001, turn 2 onward | no: data only, then reads |
| E2 Demand Tribute granted to every major (row 17) | With `DIPLOMACY_ACTION_DEMAND_TRIBUTE` granted through `EFFECT_DIPLOMACY_GRANT_DIPLOMATIC_ACTION`, `AI_DiplomaticActions.csv` scores it and an AI starts it on a major within 30 turns (`DiplomacySummary.csv`), and the target's Gold line drops by the action's -20 | Exploration, same game, 30 turns | no: data only, then the logs |
| E3 Tariff on a sanction (row 8; owner first) | An existing sanction re-pointed to cut its target's trade Gold is still scored and started by AIs as often as before (compare 1.1's 84 scores) and the target's Gold falls while it runs | Exploration, same game, 40 turns | no: data only, then the logs |

M1 to M5 share one Modern game and E1 to E3 one Exploration game. If the owner says no to buildings, M1 and M2 drop and
E3 waits on its own answer; M3, M4, M5, E1 and E2 still run. None needs a different setup.

## Where it matters most

Debt service as a standing Gold line the AI's income read sees (row 2, probe M1) would let its own strategies, biases
and purchases plan around its loans, where escrow and the preference factors now hedge for it; it needs the owner's
call on script-placed buildings first.

## Marker rules (the owner's go, 2026-11-04)

The owner wants the AI to see Economics' standing effects, so they go on script-placed markers, under these rules:

- A marker is a free City Center building: Population 0, `ExistingDistrictOnly`, `CanBeHidden`,
  `IGNORE_DISTRICT_PLACEMENT_CAP` (six went into a full centre with nothing pushed out, slot probe 2026-11-04), owned
  by a trait no civ has, and tagged `TOWER_MARKER`, which every Tower script that reads a city's buildings skips.
- Markers stand only in the capital's centre, beside the Palace, about ten a civ at most (a ladder of powers of two
  per sign covers up to 1,023 Gold a turn).
- The game counts a marker as a building. Its own rules count buildings by type or tag, so they miss a marker,
  except four narrative rules: two ask whether a plot has at least one building (the Palace already answers yes) and
  two ask whether a city's buildings are all from this age. `tools/marker-count-audit.py` lists any such rule in a
  compiled database and runs before each release (WATCH_LIST 19).
- The `AGELESS` tag keeps a marker out of overbuilds. With no Age and no tag a player's build in a full centre
  replaces it; with the tag (or an Age of the current age) the full centre stays closed and a free slot stays free.
  The "only this age" check stays true with either kind (lab runs, 2026-11-04).
- The Gold rides a city modifier the marker switches on (`EFFECT_CITY_ADJUST_YIELD` with an `Amount` and a `Tooltip`,
  gated on `REQUIREMENT_CITY_HAS_BUILDING`), not a yield on the marker itself. A building's own Gold line is scaled by
  the city's Income percentage (63 cost an AI capital 81.9); the modifier charged exactly 10 and the AI's
  `getNetYield` fell by 10. A player-wide `EFFECT_PLAYER_ADJUST_YIELD` gated on `REQUIREMENT_PLAYER_HAS_CONSTRUCTIBLE`
  did nothing.
- City Details lists markers under Buildings; `CanBeHidden` doesn't hide them there. Owner's call, 2026-11-04: they stay
  in that list with honest names that say what they charge or pay, like "Debt service: -16 Gold", with a description
  that names Economics as the source. The existing markers already read this way ("Partisan Muster", "Changing
  Allegiance", "People who left").
- Partisans' and Cultural Diffusion's markers stand for one turn and Emigration's relief markers are no longer placed,
  so none of them needs `AGELESS`; Economics' standing markers do.

## Lab runs

2026-11-03 evening, the Economics and Partisans working copies plus the probe data mod (`devtools/ai-probe/`,
installed for these games only), every other mod off. Exploration seed 9001 is run `2026-11-04T03-31-59` (a first
start, `03-28-15`, was stopped at turn 1 to add E3's rows). Modern seed 4242 is runs `03-40-51` (crashed on its first
turn roll, see M3) and `03-45-25`. The owner said yes to M1, M2 and E3 as probes only. Readings, scripts and the
game's logs are in the run folders on tp-share; captures are `working_screenshots/aiprobe-*.png`.

- E1, watched: the argument is `Amount`. Four modifiers on the seat, one argument name each, gated on one turn each.
  Only the turn-7 one (`Amount` 3) moved the treasury: 1,037 rose to 1,073 at the roll where 1,041 was due, about 3%
  of the balance, once. `Multiplier`, `Percent` and `Factor` did nothing. It's a one-off change to the balance, so
  income stayed at 9 and `Player_Treasury.csv` has no line for it; the player sees the balance jump with no named
  line. Second sample, run `2026-11-04T05-03-57` (Exploration 9001, `Amount` 5 on the seat): 1,018 rose to 1,077.90
  at turn 3 where 1,027 was due, and 1,095.90 to 1,159.69 at turn 6 where 1,104.90 was due, both exactly 5% of the
  old balance. The turn-6 modifier stayed active through turn 9 and the balance only grew by income on turns 7, 8 and
  9, with nothing taken back when it lapsed at 10: the effect fires once when the modifier turns on, not every turn.
  `Player_Treasury.csv` kept the Gold yield at 9 with no line for it. The control game (`2026-11-04T05-42-53`, same
  seed, no probe mod) went 1,018 to 1,027 and 1,045 to 1,054 on those turns.
- E2, watched: with Demand Tribute granted, the AIs scored it 416 times by turn 100 and started it 46 times
  (`DiplomacySummary.csv`), civ 5 on civ 4 first at turn 41, then civs 1 and 3 on civ 2. All 46 ended "Canceled" the
  same turn, so no tribute changed hands and the target's Gold line never took its -20.
- E3, watched: Hinder Finances re-pointed (its completion now attaches a -50% cut to the target's trade-route yield)
  was still scored, 167 times by turn 100 (43 by turn 36), against 1.1's 84. No AI started it, and no AI started any
  other sanction in this game either, so this game can't say whether the change costs starts. Against a control,
  run `2026-11-04T05-03-57` (probe on) and `2026-11-04T05-42-53` (same seed, no probe mod, the same scripts on the
  same turns, Autoplay on the seat for turns 32 to 40 where the probe game had none): over turns 1 to 40 the AIs
  started 0 sanctions in each game (`DiplomacySummary.csv`), while Hinder Finances was scored 52 times with the probe
  and 51 without, and the other five sanctions 43 to 85 times each in both. The AI doesn't start sanctions in these
  games, so re-pointing one can't change how often it does; the scoring is unchanged.
- M1, watched for the AI's income: the turn after both buildings went into AI 1's capital, its capital read "Debt
  service (probe) -10" in income and "Upkeep test (probe) 10" under building maintenance, and its net Gold read about
  21 lower (186.99 to 165.29). It still held both 11 turns later. The seat's capital showed "Debt service (probe) -10"
  and its net Gold fell 71 to 61 (read from the city's yield breakdown; no capture). P2's question stays open:
  `Player_Treasury.csv` kept AI 1's building maintenance at 15 throughout, so the log doesn't show the upkeep being
  charged even though the income read counts it.
- M2, watched: in AI 2's capital the Line Infantry purchase price went 1,005 to 1,275 the turn after the marker was
  placed (a -25% efficiency is a 27% higher price), stayed there, and was back to 1,005 the turn after
  `DESTROY_ELEMENT`. The city's Happiness showed "Price marker (probe) -2" while it stood. The AI's strategy log
  stopped writing after turn 2, so `CITY_STRATEGY_STAY_HAPPY` wasn't seen.
- M3, watched, then a crash: the conversion takes 20% of the city's net Gold after maintenance, so a city with
  negative Gold loses Production (the seat's capital, -5.4 Gold, read "Planned take (probe) -1.08"); AI capitals with
  0.2 to 1 Gold gained that much Production on about 60. The named line shows as the modifier's `Tooltip`. The
  paired -20% Gold row (`EFFECT_CITY_ADJUST_YIELD`, `Percent`) never showed in any city's Gold. The game then crashed
  on the first turn roll (SIGBUS on the AppHost thread, a deep recursion under `Localization::String::toUTF8`). The
  same seed and sampler without the M3 rows ran 12 turns clean, which points at the conversion; one run each, not
  confirmed.
- M4, watched: `scaleAiPreference` x50 on declare war (sent under both `DiplomaticActions` and
  `DiplomaticGroupBiases`) on AI 1 from turn 2 to 12, with 20 grievances booked between AI 1 and AI 2 (level -25 to
  -33) and between control AIs 3 and 4. No declare-war row and no war between majors in 10 turns. That closes it.
- M5, watched (`aiprobe-m5-relationship-breakdown.png`): the seat's breakdown with AI 1 read "Neutral +15 / Fire
  Tuner +5 / (blank) 0 / Shared Government +10". The script favor (+5) and grievance (-5) are both event type -1, so
  the screen folds them into one blank row that reads 0.

2026-11-04, the follow-up block, Modern seed 4242. The main game is run `2026-11-04T04-27-29` (Economics and Partisans
working copies plus the probe mod, every other mod off). The M3 crash runs are `04-07-48`, `04-12-29`, `04-14-22`,
`04-15-44` and `04-17-33`; the new-action runs are `04-45-10`, `04-48-24` and `04-50-40`. All are on tp-share with
their crash reports, readings and scripts. Captures are `working_screenshots/close-*.png`.

- P2's question, answered: AIs pay building upkeep. A 5,000 Gold maintenance building went into AI 1's capital at
  turn 2 (income about 187). Its `getNetYield(YIELD_GOLD)` read -4,813 the next turn, and its balance went 9,851,
  4,770, 0, -4,763, -9,529 from turn 4 to turn 8 (a 16,000 Gold loan from AI 2 landed at turn 3). Control AI 2 stayed
  between 1,740 and 714 over the same turns. Economics then wrote AI 1 two bond loans of 1,064,632 and 522,063 Gold,
  both in default the same turn; the sizing has no ceiling against a deficit this size.
- M3's crash is the conversion, and only when a script or a screen reads that city's yields. With the
  Gold-to-Production rows and the same seed the game died on the first turn roll four times out of four, the same
  SIGBUS in `Localization::String::toUTF8` each time: with the Tooltip, without it, and with Economics and Partisans
  off. The -20% Gold row alone ran 3 turns clean. The conversion alone with no sampler ran 3 turns clean, and the first
  `city.Yields.getYields()` after that crashed it. The game's own yield bar, production chooser and placement screens
  call `getYields()`, so a player opening a city would crash too. The Tooltip isn't the trigger: the base game's
  conversions carry one and don't crash.
- The paired -20% Gold row applies, with no line of its own. The seat's capital Income read 9.6 where the control
  game read 12, and AI 1's 16.5 where it read 19.5. The cut is taken out of Income before the breakdown's lines, so
  no row names it. A cut that should show needs a `Tooltip`.
- M2's question, answered: an AI marks a city whose Happiness goes negative, and that's all it does. With a -40
  Happiness building in AI 3's capital (-28.8 at turn 2, -34.8 from turn 6), `AI_CityStrategy.csv` logged
  `CITY_STRATEGY_STAY_HAPPY` "Following" for that city at turn 2. AI 2's capital, at -5.8 with no building, got the same
  row that turn. The capital kept building its Lo'i Kalo from turn 2 to turn 17 and never queued a Happiness building.
  Its City Park, Department Store and Radio Station scores rose by the same factor as its other cities' and the control
  AI 4's. `AI_CityStrategy.csv` writes a row only when a strategy changes, so it hadn't stopped last time. With
  `AIVerboseLogging 1` it logged turns 1, 2 and 12 only. `AI_CityDevelopment.csv` carries the per-turn scores.
- Route 3, a new native diplomatic action, closes at the target. A "Probe Pact" endeavor (Local Festivals' rows, a
  new `DiplomacyFavorsGrievancesEventsData` row with its own Name) shows on the seat's diplomacy screen with its
  Influence cost (`close-pact-hub.png`). AIs score it highly (3,353 to 4,192 in `AI_DiplomaticActions.csv`) and five of
  them started it on their own within 7 turns. Every start, the seat's and the AIs', logged Recipient -1 in
  `DiplomacySummary.csv`, never entered its first stage and stayed at 0 of 5, so no breakdown line ever landed. Five
  data variants started the same way: Send Delegation's shape, `RequiresUnlock` 1 granted to every major, a single
  stage at 0, and Local Festivals' UI yield fields. The same start call on Cultural Exchange kept its target. A new
  action added by data doesn't get a target in 1.5.0, so this route needs an existing action re-pointed, as E3 did.
- Owed item 1.4, answered: a script can save. `Network.saveGame` with the quick-save arguments, called from a
  `TurnBegin` listener, saved at turn 8 (result 0). That was after Economics' batch had sent its 7 grants, with the
  glue's landed marker still at the last batch. `Network.loadGame` on it, then a ledger dump: every civ's Gold, the
  loans, investments, crises, responses, legacies and escrow matched the uninterrupted dump. The only difference was
  the stale landed marker. Economics booted with "0 re-sent" and the Gold didn't move in the next 18 seconds, so
  nothing was lost or paid twice.

2026-11-04 afternoon, the slot probe (the owner's go): Modern seed 4242, the Economics and Partisans working copies
plus the probe mod with `data/probe-slots.sql`, every other mod off. Run `2026-11-04T14-25-00` is the main game, run
`2026-11-04T15-00-19` the overbuild follow-up. Both run folders are on the local disk (tp-share wasn't mounted), with
the reads in `slotprobe/` and `overbuild/`. The capture is `working_screenshots/slotprobe-city-details.png`.

- Before: each capital's centre held only its Palace. The seat's centre offered Brickyard, City Park and Grocer, so a
  Grocer placed there filled it to the cap of 2 (population 30 to 31, the centre became a quarter). The AI capitals
  offered the same three in their centres (read through `calculateAllBuildingsPlacements()`; `canStart` answers
  nothing for an AI city from the UI).
- L1 to L6, all six landed in the seat's full centre and in AI 1's: no building or population point went, and the
  quarter flags didn't change. Each line in the city's Gold breakdown reads its data value (-1 to -32). The seat's
  capital lost exactly 63 (-3 to -66; its treasury fell by the net, 52 a turn), AI 1's lost 81.9: its Income carries
  +30% (Crusher of Rebellions 10, 20 unnamed), and that percentage scales the markers too.
- The markers reopened the full centre: Brickyard and City Park were offered there as an overbuild of L1. In run
  `15-00-19` a City Park bought on that centre through the game's own purchase took out L1 and its line, kept the
  Palace and Grocer, added a population point (31 to 32) and left the quarter on; Brickyard was then offered over L2.
  A marker with no Age reads as overbuildable, so a player's build eats one.
- The "Only this age (probe)" +1 Culture line never showed in the capitals: their Granaries, Banks and Temples come
  from earlier ages. It did show in a seat town placed for the purpose (Asuka, City Hall only), and it stayed at +1
  with L1 and PGOLD in that town for 6 turns. The markers' missing Age doesn't break the game's own count of
  current-age buildings.
- PGOLD did nothing. With the marker in AI 2's capital and in the seat's town, no line showed anywhere, AI 2's net
  Gold didn't move over 7 turns, and the seat's treasury fell by its net and no more. The player held the marker
  (`getNumConstructiblesOfType` 1) and `Game.Modifiers.getModifiers()` listed the modifier, so the player effect on
  `COLLECTION_ALL_PLAYERS` with `REQUIREMENT_PLAYER_HAS_CONSTRUCTIBLE` doesn't apply as a game modifier.
- CGOLD charged exactly 10 in AI 3's capital, not scaled by its +20%, the moment it landed: the city 10.8 to 0.8, the
  player 131.99 to 121.99, Economics' income read 13,199 to 12,199 cents. The breakdown named it "City debt line
  (probe)". So a standing Gold line the AI's income read sees works as a city modifier gated on a marker.
- Five AI turns with everything in place: no crash, no marker removed, the AI built its own City Park beside PGOLD.
  `DESTROY_ELEMENT` on all 16 put every read back to its value before, and a turn roll after showed no marker left
  (the seat's +24 that turn was a new Goryeo sea route).
- City Details on the seat's capital lists all six markers under Buildings with names and Gold, with no icon:
  `CanBeHidden` doesn't hide them there.

2026-11-04 afternoon, the age check (the owner's go): the same setup, with two more probe markers, each -1 Gold on
the building, City Center, `IGNORE_DISTRICT_PLACEMENT_CAP`, `TOWER_MARKER`: AGEM has `Age` `AGE_MODERN`, AGEL has no
Age and the `AGELESS` tag. Run `2026-11-04T15-11-43`, on the local disk, reads in `agecheck/`. No captures; every
result below is a read.

- A free slot stays free with either marker. With AGEM in the seat's Palace-only centre and in AI 1's, and AGEL in AI
  2's and AI 3's, each centre still offered Brickyard, City Park and Grocer as plain placements, not overbuilds, and
  `getOverbuildableConstructibleTypes()` listed nothing. The seat bought a Grocer there through the game's own
  purchase: it landed beside AGEM, AGEM stayed, population went 30 to 31 and the centre became a quarter. A seat
  town, Asuka (City Hall plus AGEL), bought a Grocer the same way: it landed beside AGEL, population 2 to 3.
- A full centre stays closed with AGEM. The seat's Palace, Grocer and AGEM offered nothing: no placement, the City
  Park's purchase plots left the centre out, and a purchase on the centre answered `Success` false, so nothing was
  sent and nothing was removed. AI 1's centre (Palace, AGEM, a Grocer added by script) offered nothing either.
- A full centre stays closed with AGEL. With AGEM swapped for AGEL in the seat's centre, the same: no offer, the City
  Park purchase refused, nothing removed. AI 2's and AI 3's full centres and Asuka's (City Hall, AGEL, Grocer)
  offered nothing.
- The control in the same game: L1 (no Age, no tag) added beside AGEL in the seat's full centre brought Brickyard and
  City Park back as overbuilds of L1, and the overbuildable list held L1 alone. A City Park bought there removed L1
  and kept AGEL, the Palace and the Grocer (population 31 to 32). So the game picks the marker by its age: the tag
  or a current-age Age keeps it, no Age loses it.
- "Only this age (probe)" +1 Culture stayed in Asuka with AGEM, with AGEM and AGEL, with AGEL alone, with AGEL and the
  Grocer, and through two turn rolls. The capitals never showed it (their Universities and Pavilions are Exploration
  buildings), so the check still reacts to an older building.
- Each line reads -1: "Current-age marker (probe) -1" and "Ageless marker (probe) -1". The seat's capital lost
  exactly 1 (-3 to -4) and Asuka 1 per marker (0, -1, -2). The AI capitals lost 1.3 (AI 1, 4.5 to 3.2) and 1.2 (AI 2
  and AI 3), their Income percentage scaling the line as before.
- Two turn rolls (turns 1 to 3, AI turns included) left every marker in place and every centre unchanged.
  `DESTROY_ELEMENT` on all five left no probe marker in any city, and each city's Gold rose by what its marker had
  taken (the seat -8 to -7, AI 1 33.1 to 34.4, AI 2 7.2 to 8.4, AI 3 9.6 to 10.8, Asuka -1 to 0).
- For Economics' markers that means the `AGELESS` tag. An `Age` row also kept the centre closed, but it names one
  age, so in Antiquity or Exploration the marker would become an older building at the age change; that case wasn't
  run.
