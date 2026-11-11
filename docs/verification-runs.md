# What has been watched, and the runs behind it

The first in-game checks are under "Watched 2026-10-30". Version 0.2.0 (2026-10-29) was built and checked offline
only: `npm run release:gate` (248 tests, tsc, ESLint, check-esm, coverage), Stryker on the rule modules, and the tax
SQL applied to a copy of the compiled 1.5.0 Exploration database (`tests/econ-data.test.mjs` with `CIV7_GAMEPLAY_DB`
set). The reader-facing account is the [README](../README.md); this file is the evidence behind it, in the form
Canals' `docs/verification-runs.md` uses.

## The load check (owed from 0.1.0)

The first lab run has to show, with every other mod off: the mod registers and loads (`Modding.log`), the setup SQL
compiles without an error (`Database.log`), the six options show on the setup screen with their defaults, the boot
line `[Economics] v0.2.0 loaded; turn N, ...` appears in `UI.log`, the tax data groups load in each age without a
database error, and `tower-bench check tower_mods_in_dev/economics` passes. Then the same with the usual set.

## Owed

The 2026-11-02 sweep ("Watched 2026-11-02" below) cleared most of these tables; the rows that remain carry a note where a
run reached part of them. Every in-game check of prompt 4's phases 1 to 8, none watched when first written. The game wasn't available on 2026-10-29 (another
session held the lab), so each was built against the probe results in DESIGN 10 and the model's tests, and waits for a
lab session. Each line says what the player sees when it works, the setup it needs, and where the code is. Setup
"vanilla" means every other user mod off; "usual set" the Tower mods as the registry has them. Antiquity seed 4242 and
Exploration seed 9001 are the probe run's seeds.

### Phase 1: batch and ledger

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 1.3 | Save and reload mid-turn: the Loans tab shows the same loans and payments (a seat loan open; the 2026-11-11 morning run had none, the seat had no borrowing room); the next turn's batch running once after a reload was watched 2026-11-11 | same | `ui/econ-session.js` `loadSession`, `ui/econ-plan.js` `skipReason` |
| 1.4 | The reload check: a save forced in the second after `TurnBegin` (before the grants land, P15's window) reloads with `[Economics] batch Bn re-sent for player 0` and the balance ends where the ledger says | same | `ui/econ-session.js` `resendLostBatch`, `ui/econ-batch.js` `batchStatus` |
| 1.6 | The order-free resolve holds in game: the same seed and loans give the same transfers whatever order `Players.getAliveMajorIds()` lists civs in (compare `UI.log` of two runs) | same | `ui/econ-turn.js` `turnContext` |
| 1.9 | Load a save made before its turn's batch ran (a save request that beat the batch, or one copied from the turn before the mod's first batch): `UI.log` has `turn N (load catch-up from turn N-1)` once, the payments land, and the next `TurnBegin` runs the next turn as usual; if the local turn was already active, the notification shows at load (2026-10-30, A: the age change's reload logged `load catch-up from turn 120` once; a save from the turn before isn't tested) | same | `ui/econ-bootstrap.js` `catchUp` |

### Phase 2: player loans

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 2.8 | Lend to an AI in shortfall with positive income: it accepts by rule, the player's balance falls by `P` and rises each turn; an AI with income at or below 0 declines with the reason in the notice (2026-10-30, B: the decline with its reason watched (no AI was short); 2026-10-31, the fifth run: the accept side watched four times on the Ottomans, through the queue; the click on the Lend form is still owed) | Exploration 4242 | `ui/econ-requests.js` `lendRefusal`, `ui/econ-ai.js` `aiAccepts` |

### Phase 3: guard

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### Phase 4: repudiation

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### Phase 5: tax cards

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 5.2a | The celebration turns move the way the Fiscal tab said after slotting a card (the Gold and Happiness change matching the settlements was watched in all three ages 2026-11-11) | same | `ui/econ-fiscal.js` `readFiscal`, `ui/econ-tax-cards.js` `cardForecast` |
| 5.4 | Each card on a city's yield breakdown, by hand with the mouse (the line named after the card, at its flat amount, was read by script in all three ages 2026-11-11) | same | `data/econ-tax-gameeffects.xml` (Tooltip argument) |
| 5.5 | War Levy pays only at war: the breakdown line appears when a formal war starts and goes when peace is made (2026-10-31, eleventh run: War Levy's +2 Gold line read on the capital at peace; the seat's own `forceDeclareWar` didn't take, so the at-war line is owed) (2026-11-04, run `2026-11-04T06-54-20`: Goryeo declared war on the seat and the capital read "War Levy=2; War Levy=6" Gold and "War Levy=1; War Levy=3" Happiness, the +8 and -4; the line going at peace is owed) | same, a declared war | `data/econ-tax-gameeffects.xml` (REQUIREMENT_PLAYER_HAS_X_WARS) |
| 5.6 | Under Heavy Taxation the next celebration comes later, under Light sooner (the Happiness moves were watched 2026-11-11: the capital at +3 went to +9 under Light and +1 under Heavy) | same | the cards' Happiness modifiers |

### Phase 6: AI and soak

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### Phase 7: alongside other mods

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### Phase 8: single-player only

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 8.1 | In a hotseat game `UI.log` has `[Economics] v0.2.0 loaded; multiplayer game, the mod is off` once, no batch line, no grant, the dock button absent | a hotseat start, vanilla | `ui/econ-bootstrap.js` `boot`, `ui/econ-engine.js` `isMultiplayer` |
| 8.2 | The same in a LAN-hosted game | a LAN host | same |

### Screens

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| S.1 | The screen opens from the dock button and from a click on the turn notification, draws framed with its own styles at 720p without horizontal scroll (the CSS and HTML load from `fs://game/tower-economics/`), `tower-bench lint` on the live screen passes (no dropped declarations), the tab bar keeps its selection across re-renders (2026-10-30, A: opens full window with its CSS from `fs://game/tower-economics/`, five tabs, no horizontal scroll at 2880 by 1800, `lint` clean for the screen; 720p and the notification click owed) | any, vanilla | `ui/econ-screen.js`, `ui/econ-screen.css` |
| S.2 | The Treasury tab's flows list reads right against the ledger once Economics moves Gold, and the buildings block counts a Bank (2026-11-11: "Balance in 20 turns" 586 matched the balance 926 plus 20 turns of -17, and the block counted the capital's Market as its one Commerce building) | any | `ui/econ-view-treasury.js` |
| S.3 | The turn notification shows once per turn in the game's language, and its click opens the screen. The wording and the tenth-of-a-Gold floor were watched 2026-10-30 (0.4.0, below); a notice naming loans needs a player loan open | any | `ui/econ-notify.js` |
| S.4 | The pill's text follows the debt and turns red in default (2026-10-30: reads "No debt" (A, D); the default state owed) (2026-10-31, tenth run: the pill read "In default · Slump" in red on the human seat's default; capture `working_screenshots/econ-watch-2026-10-31/r1-loans-t40.png`) | any | `ui/econ-dock.js` `refreshPill` |

## Watched 2026-10-30

Economics 0.3.0, a clean release build of commit `41e5239`, in lab games driven by script through
`globalThis.__towerEconomics` and the screen's view model, every reading in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-build-checks.md`. Games: A vanilla, Antiquity 4242, 129 turns
into Exploration; B, B2, B3 vanilla, Exploration 9001 with the Economics civic bought at turn 1 (B no loan, the
control; B2 a 50 Gold bond loan; B3 a 50 Gold loan from Japan); C vanilla, Antiquity 4242 with every option Off; D,
D2, D3 the usual set, Exploration 9001. The load check above was watched in A and D: the groups load
(`economics-game`, `economics-tax-effects`, `economics-investment`, `economics-ai-lists`, the age's tax cards),
`Database.log` has no error, the options read their defaults in game, `[settings-keeper] ready` and
`[Economics] v0.3.0 loaded; turn 1, ...` are in `UI.log`, `tower-bench check` is clean. The setup screen's text is
still for a person.

| # | What the player sees when it works | Setup | Reading |
| --- | --- | --- | --- |
| 1.1 | A bond loan queued from the console (`__towerEconomics.request({ kind: "borrow", borrower: me, lender: "bond", principal: 30000, term: 10 })`) lands at the next `TurnBegin`: the balance rises by 300 within about 1 s, `UI.log` has `[Economics] turn N (TurnBegin N): 1 transfer(s), 1 grant(s)` | Exploration 9001, vanilla, Public debt reached (or Economic stages Off) | B2: a 50 Gold bond loan queued at turn 11 landed at turn 12's `TurnBegin` (191 in the control game, 241 here), `turn 12 (TurnBegin 12): 10 transfer(s), 6 grant(s)`, the notice naming it. 300 Gold was refused at income 20 (credit limit) |
| 1.2 | Each following turn the balance moves by exactly the payment the Loans tab shows, and the lender's (an AI's) balance rises by the same amount in the same turn | same, with a civ lender | B2: bond payments 6.9 and 6.7 Gold, principal down 5 a turn; B3: Japan's balance -50 the turn its loan opened, the player paying it 6.0 a turn |
| 1.5 | A turn isn't applied twice when `TurnBegin` fires more than once for one turn (log shows one batch per turn number over 20 turns) | same | A: 129 `[Economics] turn N` lines for 129 turns across the Antiquity-to-Exploration change, none twice |
| 2.2 | Borrow from an AI: its balance falls by `P` that turn and rises by each payment | Exploration 4242, vanilla | B3: Japan's balance 50 lower the turn the loan opened (707.14 to 657.14 against the control), then its 6.0 Gold payment each turn |
| 2.6 | The limits refuse: a principal over the credit limit shows "over your credit limit" on the offer row and is refused in the turn notice; one whose payment passes 35 percent of income shows the service refusal | same | B: 300 Gold refused, "over your credit limit"; D2: 50 Gold at income 9 refused, "the payments would take more than 35 percent of your income" |
| 2.7 | 20- and 30-turn terms appear only with Public debt, and from a civ only with a Bank; a civ with Moneylending alone offers 10 | Antiquity 4242 then Exploration | A at turn 3: terms [10]; B with Public debt: [10, 20, 30], and at 20 turns only the bond market offers (no civ had a Bank) |
| 3.3 | A dip with positive income: the guard does nothing, the balance reads 0 after the roll, and nothing is disbanded (P4) | Antiquity 4242 | A at turn 31: income +5, a -185 grant left -20, next turn 0 with no loan, no guard record and 7 units before and after |
| 4.1 | Repudiate an AI lender: the preview's numbers (Gold kept, grudge, witnesses, standing, closure); after confirming no Gold moves, the lender's grievances against the player read `grudge * 1000` higher in the relationship panel, each met civ's relationship reads 3 lower (`getRelationshipLevel` before and after), the lender's offers disappear this age and next, other rates rise and the credit limit shrinks by 4 turns of income | Exploration 4242, vanilla | B3: grudge 10, Japan's relationship 10 lower than in the control game from the next turn, the witness 3 lower, Japan's offers gone for the age, other civs 2.0% to 2.86% and the bond 4.0% to 5.71%. The grievance line in the relationship panel is by eye |
| 4.2 | Repudiate the bond market: no grievance, each met civ reads 6 lower, the bond market and the guard are closed for 30 turns (the Loans tab says so, a guard case logs `guard-blocked`) | same | B2: 7.50 Gold written off, no grievance, both met civs 6 lower than the control game, the bond market blocked until turn 48 and no offers afterwards |
| 5.2b | A card not unlocked yet reads "Opens with" and the node's name (War Levy in Antiquity: Currency) | Antiquity 4242, before Currency | A at turn 1: War Levy's opener reads Currency, Light and Heavy's Chiefdom; the tab draws "Opens with Chiefdom" |
| 5.7 | With Taxes Off at setup the cards, the slot and the strategies are absent and the Fiscal tab says the option is off | any, Taxes Off | C: no Economics cards or strategies in the database, the tax groups not loaded, the Fiscal tab says "The Taxes option is off for this game, so there are no tax cards." |
| 6.1 | 100 turns of `lab drive` across the Antiquity-to-Exploration change with the mod on, then the same seed with it off: no crash, no hang; `UI.log` has one `[Economics] turn N` line per turn | Antiquity 4242, vanilla | A: 120 Antiquity turns, `lab age-change` and 9 Exploration turns, no crash or hang (the off side on this seed is the 1.2 `transition` probe game) |
| 6.2 | Per civ from the ledger events: AI loans (`ai-shortfall`), guard loans, defaults, restructures and repudiations counted; each AI's emergency loans stop at its cap | same | A: no AI loan, guard loan, default, restructure or repudiation in 129 turns; no AI went short |
| 6.3 | Each AI's tax card every turn beside its balance, income and war state (`__towerEconomics.cards(pid)` per civ, or a probe row): does it tax harder when short, levy at war, ease off when flush; P17 saw Light only, so Heavy and War Levy taken by an AI at all is the first thing to read | same | A: Heavy at fresh slots (Goryeo turn 26, Hawaii 29, the human seat 33), War Levy taken by all six by turn 66, mostly at peace, Light never |
| 6.4 | The strategy rows switching on and off in `AI_Victories.csv` (`STRATEGY_ECONOMICS_SHORT_OF_GOLD` Following then Forbidden as income passes 10; `STRATEGY_ECONOMICS_FLUSH` at 40) | same, `AIVerboseLogging 1` | A: Short of Gold Following for all at turn 2, Forbidden as income passed 10 (turns 7 to 60); Flush Following for Hawaii at 65 and Persia at 75, Stopped and on again (85, 105); the same in Exploration |
| 6.5 | The AI solvency target (DESIGN 10): AIs with positive income in the off run don't default or take emergency loans in the on run; compare AI civs with each other, the human seat holds one city under Autoplay | same | A: no AI with positive income defaulted or took an emergency loan |
| 6.8 | The AI's building-upkeep read (P2's open half): an AI's `upkeepCents` beside its balance change the turn it finishes a Library, since the per-building read gave 2 to 6 Gold where the engine charged 0. The human's figure should match `Logs/Player_Treasury.csv` now that the getter gets the row's `$index` | same | A at turn 108: the human's 13 matched `Player_Treasury.csv`; the AIs read 2, 8, 7 and 23 where the engine charged 0, 2, 3 and 15. Still apart |
| 7.2 | The dock button sits beside Demographics' and Emigration's and opens the screen over the HUD; the pill reads beside it | same | D: Demographics, Economics and Emigration side by side in the dock (x 645, 702, 850), the pill between Economics and Emigration without overlap |
| C.9 | The bill never passes a tenth of the payer's income; at income 0 or below nothing is paid; anything over the cap shows as waived and isn't owed next turn | same, the player's income pushed low | B at turn 24: Japan owed the player 14.37, paid 5.01, 9.36 waived; the Pirate Republic owed Silla 7.98, paid 3.83 |
| C.10 | The imports read for AI pairs: an AI importing from another AI shows a bill between them in `__towerEconomics.session().lastPlan.trade`. The 1.1 probes settled the reads underneath (C8: per-route imports for AIs add up; C14: copies count once at the origin); the bill itself is unwatched | same | B: `lastPlan.trade` holds AI pairs (Silla to France paid in full, the Pirate Republic to Silla and to France) |

## Watched 2026-10-30 (0.4.0)

Economics 0.4.0 (`217638b`, the installed `Mods/economics`), two lab games read by script, every reading in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-watch-040.md`. Runs: `2026-10-30-watch-040-vanilla`
(Economics alone, Antiquity 4242, 119 turns, the age change, Exploration turns 1 and 2) and
`2026-10-30-watch-040-usualset` (the owner's usual set, the same seed, 116 turns and the change). Both `--setup fast`
(Settler difficulty).

| # | What the player sees when it works | Setup | Reading |
| --- | --- | --- | --- |
| T.1 (part) | Heavy and War Levy read their flat amounts on each settlement's breakdown | vanilla | Heavy: a "Heavy Taxation" line of 4.00 in Gold income and a 2.00 Happiness deduction in every settlement of Hawaii and Goryeo (t30); War Levy at war: 8.00 and 4.00 in every settlement of Hawaii, Goryeo and Dai Viet (t118). An AI's Gold moves by 3.2, not 4, under Settler's -20% Gold modifier on AI income. Light owed |
| T.2 | AIs slot Heavy at fresh slots as arm 3 did; Heavy or War Levy more than Light | vanilla, 119 turns | Light never; Heavy by 4 of 5 AIs (Goryeo t27, Hawaii t29, Dai Viet t31, Persia t118), at the fresh slot as in arm 3; War Levy by all 5 (Dai Viet t34, Goryeo 44, Greece 48, Persia 53, Hawaii 87). At war the AIs held War Levy on 85 of 130 civ-turns, otherwise no tax card; at peace War Levy 139 civ-turns, Heavy 26, nothing 255. Strategy rows in `AI_Victories.csv`; Short of Gold left by turn 17 for four AIs |
| T.4 | A peaceful AI holding War Levy gets nothing from it | vanilla | Greece at t51, War Levy slotted, no war: no levy line on Gold or Happiness in its three settlements |
| M.4 (part) | The first turn of a new age runs a batch | vanilla and usual set | `turn 121 (load catch-up from turn 120)` at the reload, `turn 121 (TurnBegin 1): skipped, already-planned`, `turn 122 (TurnBegin 2)` with transfers; ledger `lastTurn` 121 then 122. The loan-miss half owed |
| M.18 | The age change's Gold cap | vanilla, the human at 5,207 and Persia at 11,432 by `grantYield` | The cap is the map script's `capGold` (`age-transition-post-load.js`), 6,000 into Exploration under Play Now's keep-more setting (3,000 under the default setting, not reached in the lab). Persia 11,432 to exactly 6,000 at Exploration t1, the human's 5,207 kept. The ledger snapshot took 6,000 with no event for the cut |
| S.3 (part) | The notice names what moved the treasury and stays quiet below a tenth | vanilla and usual set | vanilla Antiquity 45 notices (38 "from trade bills, the business cycle", 5 cycle, 1 trade, 1 system change), usual set 22 (cycle and the system change); no "+0.0" or "-0.0"; the smallest ±0.1 |
| 5.2a (part) | The Fiscal tab's Gold line matches the top bar's net Gold | vanilla and usual set | "Your civilization now, Gold a turn" 3 and 6 against the top bar's +3 and +6 (vanilla t30, t51); 5 and 12 against +5 and +12 (usual set t31, t61) |
| Finding L | `addProgress` lands at the amount sent times the city's production multiplier for that kind of item | vanilla | human city 5 gave 5.00 and 10 gave 10.00; AI unit 5 gave 3.00 (Settler's -40% unit modifier), AI building 10 gave 8.00 (-20%); the grant held, and the next turn added the city's production times the same factor. The 0-to-76.5 jump is a `currentBuildProgress` of 0 on an item switched to that turn |


## Watched 2026-10-30 (merged build)

The `fceb040` build (main after the model-fixes merge), released with `./release.sh` and run from `Mods/economics` in
one lab game: Economics alone, Antiquity seed 4242, `--setup fast --quick`, `lab drive` through all three ages
(117, 117 and 143 turns). Every reading is in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-watch-merged.md`. The Autoplay seat is left out of the AI
counts; its batch sometimes runs while Autoplay is on, which reads it as an AI.

| # | What the player sees when it works | Setup | Reading |
| --- | --- | --- | --- |
| L.1 (Antiquity) | Some AIs but not all slot Light once grown and short of Happiness; Heavy at the second slot; War Levy taken | vanilla, Antiquity 4242 | Persia t82 (4 settlements, Happiness 5) and Greece t95 (all 4 unhappy, at war); Heavy Goryeo t27, Hawaii t29; War Levy all 5. In Exploration and Modern all five AIs slot Light and keep it, picked at 35 to 266 Happiness a turn |
| L.2 | War Levy's lines at peace and at war | same | +2 Gold and 1 Happiness off at peace on every holder; at war +2 and +6, 1 and 3 |
| L.3 | "Light Taxation" at -1 Gold and +6 Happiness | same | every Light holder's first settlement, all three ages |
| L.4 | The Fiscal tab's War Levy card and forecast | same, the screen's DOM | "Gold +2, Happiness -1", "While you're at war: Gold +8, Happiness -4", "about +2 Gold and -1 Happiness a turn" |
| L.5 | "Civic market" +2 Happiness under Light | same | Greece, Classical Republic, Antiquity t95 on |
| L.6 | Corporatist War Levy at peace, +8 and -4 in all | Modern | Qajar and Russia: War Levy 2 and "Corporatist economy" 6 on Gold, 1 and 3 off Happiness |
| L.7 | The game starts in each age with Taxes on, `Database.log` clean | all three ages | started each age; no error in any `Database.log` |
| G.1, G.2, G.3, G.7 (part) | Each AI's first pick is its table row; the systems follow | same game | Antiquity Classical Republic 5, Despotism 1 (Persia); Exploration Feudal Monarchy 2, Theocracy 3, Plutocracy 1 (Goryeo); Modern Elective Republic 1 (Meiji), Bureaucratic Monarchy 2, Authoritarianism 3 (Ottomans); no later change. Systems: 2, 3 and 2, then Market and Planned with the ideologies |
| F.6 (part) | AI build loans | Exploration and Modern | 39 and 81 `ai-build` loans, 10 turns, 12 to 796 Gold, 0.38% to 2.29% a turn. One default: Qajar's bond loan from Exploration's last turns, when its income fell from +134 to -21 at the change |
| F.10 (part) | AIs set tariffs and answer | Modern | Qajar and Russia High t3, Ottomans Low t4 then High t9, Iceland t5, Siam t11; nobody dropped back in 130 turns |
| F.7, M.14 (part) | A Panic from a leveraged boom | Modern | t35: E 1.05 to 0.86, the `panic` event, the notice "A financial Panic: for 5 turns civilizations stop lending...", no loans for five turns, then a slump |
| M.12 | The phase notice names the phase and causes on a change only | all ages | "Business cycle: Boom, after credit growing fast and ...", "Steady, after ... a long boom running out of steam" |
| M.28 | Classical Republic AIs borrow from their citizens | Antiquity | 23 `ai-citizens` loans (Greece, Hawaii, Goryeo, Dai Viet), 42 to 210 Gold at about 1.1%, none missed |
| F.1 (part) | Slump, Steady and Boom over a long game | all ages | Antiquity always Steady world-wide; Boom Exploration t101 and Modern t23 and t31; Slump Modern t35 and t72 to t117; no Depression |

Found: the World tab's event rows and the Loans tab's Lend row show civ names as raw keys
("LOC_CIVILIZATION_PERSIA_NAME"), since `civName` returns `civilizationName` without `Locale.compose`; the Borrow rows
show names. Not fixed.

## Watched 2026-10-30 (0.5.1)

The `006c1a8` build (0.5.1) from `dist/economics`, in one lab game: Economics alone, seed 4242, `--setup fast --quick`,
started straight in Exploration (no Antiquity), `lab drive` through Exploration (117 turns), `lab age-change`, then 51
Modern turns. Every reading is in `mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-check-051.md`. The boot
line read `[Economics] v0.5.1 loaded` in both ages.

| # | What the player sees when it works | Setup | Reading |
| --- | --- | --- | --- |
| LA.1 (Exploration, Modern) | "Light Taxation" 1 off Gold and +4 Happiness in Exploration, +3 in Modern; the rows read 6, 4 and 3 | the 0.5.1 game | the database rows `_AQ` 6, `_EX` 4, `_MO` 3 read in game; every holder's first settlement +4 in Exploration, +3 in Modern; the card keys `_EX` and `_MO` |
| LA.2 (count) | How many AIs slot Light at +4 and +3 | same | Exploration 5 of 5, first picks t21 to t39 at 23 to 50 Happiness a turn; Modern 3 of 5 by t51 (Ottomans t16, Russia t27, Mughal t29, at 93 to 177 Happiness). The owner judges |
| LA.3 | The Fiscal tab's Light card and forecast by age | same, the screen's DOM | Exploration t10 "Gold -1, Happiness +4", "about -3 Gold and +12 Happiness a turn" (3 settlements); Modern t6 "Gold -1, Happiness +3", "about -4 Gold and +12 Happiness a turn" (4) |
| LA.4 (text) | The Light card's description by age | same | `Locale.compose` of the card keys: "-1 Gold and +6 / +4 / +3 Happiness in each settlement." The policy menu wasn't opened |
| LA.5 (part) | Each age starts with Taxes on, `Database.log` clean | Exploration, Modern | both ages; only the game's own `StartupErrorMessages.xml` lines |
| TD.1 | An AI eases off a civ 20 turns into peace, or at once when Friendly | Modern | by peace: Qajar off Siam t24 and Russia t25, Russia off Qajar t25 and Mughal t31, Mughal off Russia t31, each 20 turns after its count began; by friendship: Mughal off the Ottomans t10, the Ottomans off Mughal t11, Russia off Siam t12 |
| TD.2 | No raise again after easing off | Modern | no raise in the 5 turns after any easing, nor in the 20 turns to t51; Qajar and Russia, High at each other, both ended at None |
| TD.3 | Most AIs at None by the end | Modern | all five at None from t31 to t51 (Qajar and Siam t25, Ottomans t26, Russia and Mughal t31); `tariffPeace` and `tariffEased` by "ai-other" |

Not reached: LA.1 and LA.2 for Antiquity (this game had none), the policy menu for LA.4, the "Manorial economy" line
(LA.5), TD.4 (no war between AIs that had eased off each other), TD.5 for the player (the seat never set a tariff) and
TD.6 (no 0.5.0 save loaded).

## The model (offline)

| Check | Where | Observation |
| --- | --- | --- |
| The 1.0 rules (DESIGN 4.1 to 4.6, 4.14) | `tests/econ-*.test.mjs`, plus the engine-free scan | pass, 2026-10-29, after the port from `mod_ideas_tested/economics` and the guard's income condition (P4) |
| Invariants debt-1 to debt-7 and alive-target | `tests/econ-invariants.test.mjs`, `tests/econ-properties.test.mjs` | hold over 500 random economies |
| Balance rows of DESIGN 10 | `tests/econ-balance.test.mjs`, `reports/balance-1.0.json` | run 2026-10-29 in the research copy; the owner's reading of "Borrowing pays" is open |
| The glue against a fake engine | `tests/econ-session.test.mjs`, `tests/econ-notify.test.mjs`, `tests/econ-fiscal.test.mjs` | every civ read by the same calls; the ledger written before the grants; one net grant per civ; a lost batch re-sent; the swap's Deactivate-then-Activate order; building upkeep asked by row index; 2026-10-29 |
| The entry script against a fake engine | `tests/econ-boot.test.mjs` (the game's own modules resolve to a stub) | one boot line, the batch at `TurnBegin`, the notification once at the local turn; a pre-batch save catches up once at load; multiplayer logs once and listens to nothing; 2026-10-29 |
| The tax-card numbers and forecast | `tests/econ-tax-cards.test.mjs`, `tests/econ-data.test.mjs` | the modifiers and every description row agree with `CARD_LEVELS`; the forecast takes the active card out before putting another in; celebration turns as the policies button counts them; 2026-10-29. Each age's cards point at that age's modifiers and description, and the forecast takes the age's amounts (Light by age, 2026-10-30) |
| The tabs against a fake DOM | `tests/econ-views.test.mjs` | each tab draws; Borrow, Repay, Restructure, Repudiate, Lend, the guard switch and Slot queue what the model expects; 2026-10-29 |
| The tax data against the compiled database | `tests/econ-data.test.mjs` (`CIV7_GAMEPLAY_DB`) | the unlock rows land on Economics and Piety, the slot once, the strategies' rows, foreign keys clean on the touched tables; 1.5.0 Exploration copy, 2026-10-29 |
| Mutation | `stryker.config.json`, `docs/NOTES.md` | last run 2026-10-29 (see NOTES) |

## The runs, in order

| Run | Question | Observation |
| --- | --- | --- |
| | | |

## 2026-10-29 evening: first loads, inside another session's usual-set games

Economics 0.2.0 (the release build, installed by the owner's request) loaded in two Partisans lab games with the
owner's usual mod set, Exploration and Modern, seed 4242, turns 1 to 6. Lines in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-29-partisans-usual-set/`. Watched:

- The mod loads in both ages, reads its six setup options with their defaults, and finds no ledger in a new game.
- The turn batch runs once at each TurnBegin, 4 to 10 ms, 0 transfers (nothing to do in turns 1 to 6).
- A bug: `dock button: TypeError: pillNode.replaceWith is not a function` at turn 1. The game's page has no
  `Element.replaceWith` (engine-closed). Fixed in the working copy the same evening (the pill swaps through
  `parentNode.replaceChild`; the fake page in the tests no longer offers `replaceWith`, and a gate test rejects the
  call in `ui/`). Watched the same evening in a Partisans Modern usual-set game, seed 4242, turns 1 to 8: 9
  `[Economics]` lines, no dock error (`modern-seed4242-turns1-8-dockfix.log`). The pill drawing beside the button is
  still to see on screen.

## Owed: 1.1 Commerce and the flat tax cards (0.3.0)

Built 2026-10-29 and checked offline only (`npm run release:gate`, Stryker on the 1.1 modules, the 1.1 balance rows).
Each line says what the player sees when it works, the setup it needs, and where the code is. The 1.1 probe run
(`mod_ideas_tested/economics/devtools/RUN-SHEET-1.1.md`, Exploration seed 9001) can reach most of the data and AI
lines in one game.

### Tax cards as flat amounts

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| T.1 | Each card's line on a settlement's Gold and Happiness breakdown, by hand with the mouse (every card's flat amounts were read by script by 2026-11-11, Light in all three ages) | Antiquity 4242, vanilla | `data/econ-tax-gameeffects.xml` |

### Data and load

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.5 | The per-turn cost with the 1.1 reads on, at 8 civs: `tower-bench cost tower-economics --yes` under 50 ms (2026-11-11, default civ count: about 129 ms ±86, over the mark; see the second morning batch) | Exploration 9001 | `ui/econ-session.js` `readCommerce` |

### Prices

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.7 | A war between two majors lifts the price of this age's strategic resources over the next turns, and it eases after peace (smoothing 0.8, so a few percent a turn). In vanilla Exploration and Modern no unit names a strategic resource (2026-11-11: ten turns of the seat at war in vanilla Modern, and again with Strategic Resources That Matter at its defaults, left `session().markets.strategic` empty and lifted no price; that mod writes `Units.StrategicResource` only from its gate files, which a setup option loads) | Modern 4242 with Strategic Resources That Matter's gate option on | `ui/econ-prices.js` `demandPct` |

### Trade settlement

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.11 | Where the game pays an exporter for a route, if it does: `getTradeYields()` read 0 in every route city in the 1.1 probes (C9). Read a route city's Gold yield breakdown by hand (or `calculateAllResourceTradeYields`); if the payment is found, point `readTradeIncomeCents` at it and the Trade tab's row shows (2026-10-30, B: `tradeIncomeCents` reads 0 for every civ, as `getTradeYields` read 0 in the 1.1 probe) | Exploration 9001, a person | `ui/econ-commerce-read.js` `readTradeIncomeCents` |

### Tariffs

All watched 2026-11-04; see "Watched 2026-11-04" below.

### Investment and aid

All watched 2026-11-04; see "Watched 2026-11-04" below.

### Military Aid's initiator pays

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.36 | An AI that starts Military Aid loses 2 Gold a turn (scaled by age) while its target gains 2, for the endeavor's turns: `Player_Treasury.csv` for both, the levy-free way C13 couldn't separate (compare the same seed with the option off) | Exploration 9001, 120 turns, `AIVerboseLogging 1` | same |
| C.37 | AIs still start Military Aid about as often with the charge as without (C13 counted 7 in 120 turns with no charge on the levy game) | same, on and off | same |
| C.38 | The yield breakdown names "Military Aid sent" on the initiator (hover) | a person | `LOC_ECONOMICS_MILAID_PAY_NAME` |

### Roles, other mods, soak

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### The model (offline), 2026-10-29

| Check | Where | Observation |
| --- | --- | --- |
| Prices, bills, tariffs, investment, the 1.1 plan steps and AI rules | `tests/econ-{prices,trade,invest,commerce,markets}.test.mjs` | pass; every plan in `econ-commerce` passes the commit checks (debt-1, debt-6, debt-7, alive-target, econ-3) |
| The 1.1 glue against a fake engine | `tests/econ-commerce-read.test.mjs` | imports grouped by origin city, majors only; copies at the origin; builds and what's left; progress on the city found by its key; the markets envelope written with the ledger |
| The Markets and Trade tabs and the tariff row | `tests/econ-views.test.mjs`, `tests/econ-view-commerce.test.mjs` | each draws; Accept, invest and tariff queue the requests the model expects |
| The 1.1 balance rows | `tests/econ-balance-commerce.test.mjs`, `reports/balance-1.1.json` | bills sum to zero, no payer past 10% of income, markets envelope about 10 KB, a turn in about 0.1 ms; the cap binds on most settlement rows (NOTES finding K) |
| Military Aid's initiator charge against the compiled database | `tests/econ-data.test.mjs` with `CIV7_GAMEPLAY_DB` | the stage row lands once on 1.5.0 Exploration and Modern copies, foreign keys clean; a copy without Military Aid's stage skips the row |

## Owed: 1.2 Macro (0.4.0)

Built 2026-10-30, offline only, against the M-probe results of the same night
(`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-macro-results.md`). Nothing below has been watched in a
game. Antiquity seed 4242 is the M-probes' seed; "transition" means `lab age-change` across one or both changes, as the
M3 and M4 run did. Each line says what the player sees when it works, the setup it needs, and where the code is.

### Data, load and the turn count

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.3 | Against a database with every DLC row removed, `PRAGMA foreign_key_check` lists the same rows before and after the systems SQL | the release check, all three ages | same |
| M.5 | A save made after a change in 0.3.0, loaded in 0.4.0, runs its next batch | a 0.3.0 save past an age change, if one exists | `ui/econ-turn-count.js` `countTurn` |

### The business cycle

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.7 | Peace lifts both; the index drifts back toward 1.00 between events | same | `ui/econ-cycle.js` |
| M.8 | A capture by combat weighs on the civ that lost the settlement; a city-state incorporated (`BY_INCORPORATE_CITY_STATE`) weighs nothing | a war with a capture | `ui/econ-macro-read.js` `captureEvent` |
| M.9 | A flood or eruption on a civ's land: "a disaster" on the World tab for that civ, twice the weight when its settlement lost population by the next turn, half with a Granary-type food warehouse there | the M6 `disasters` overlay | `ui/econ-macro-read.js` `disasterEvent` |
| M.10 | The age's crisis: "the age's crisis" on its first turn, then a small weight each turn it runs | an age past progress 84 | `ui/econ-cycle.js` `crisisEvents` |
| M.11 | A boom pays cycle Gold and a slump charges it (`Player_Treasury.csv` against the turn's ledger transfer `CY<pid>`); bond rates on the Loans tab move with the player's own index | any game with the index off 1.00 | `ui/econ-macro.js` `cycleInflows`, `macroPayerSteps` |

### Inflation (option On)

All watched 2026-11-04; see "Watched 2026-11-04" below.

### Old buildings

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

### Economic systems

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.27 | Citizen loans: a Classical Republic player sees "your citizens" on the Loans tab within its cap; the meter rises by twice each turn's interest; a miss costs celebration, not Influence; repudiating them costs the meter 10 turns of its gain and closes them 30 turns (2026-11-02, run A: citizens' loans within the cap, the meter rising by the interest; a miss and a repudiation of them are owed) | Antiquity 4242 as Classical Republic with two market towns | `ui/econ-lenders.js` `withCitizens`, `ui/econ-citizens.js` |

### Soak and other mods

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.36 | The World tab, the Fiscal system section and the Treasury's old buildings at 720p, and `tower-bench lint` on the live screen | a person, or `lab` captures | `ui/econ-view-world.js` |

### The model (offline), 2026-10-30

| Check | Where | Observation |
| --- | --- | --- |
| The cycle, inflation, old buildings, systems, citizen loans and the plan | `tests/econ-{cycle,inflation,legacy,systems,citizens,macro-state}.test.mjs` | pass |
| The 1.2 batch steps | `tests/econ-macro.test.mjs` | pass; every plan passes the commit checks (debt-1, debt-6, debt-7, alive-target, econ-3) |
| The 1.2 glue against a fake engine | `tests/econ-macro-read.test.mjs`, `tests/econ-turn-count.test.mjs` | governments and ideologies, old-building weights with remembered roles, the engine events kept to the batch, the macro envelope written, a new age's first batch runs |
| The World tab, the Fiscal system section, the Treasury's inflation lines and old buildings | `tests/econ-view-macro.test.mjs` | each draws the keys and numbers expected |
| The systems' data against the compiled databases | `tests/econ-data.test.mjs` with `CIV7_GAMEPLAY_DB` on 1.5.0 Antiquity, Exploration and Modern copies | each age attaches only its own rows (6, 7 and 4 government rows, 2 on Fascism's root), foreign keys clean; a copy missing a government and two cards skips their rows |
| The 1.2 balance rows | `tests/econ-balance-macro.test.mjs`, `reports/balance-1.2.json` | the hard rows pass; the cycle-shape, system-diversity and plan rows miss their starting targets (DESIGN 10) |

## Owed: government biases

Each civilization leans toward one government in its own age (DESIGN 4.17, `docs/government-biases.md`,
`data/econ-government-biases.sql`). Built and checked offline on 2026-10-30; nothing here has been watched in a game.
The tally reads each AI's pick from `Game_Gossip.csv` (`GOSSIP_CHANGE_GOVERNMENT`) or from the government events the
probe logs, and the human seat under Autoplay counts like an AI.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| G.5 | The game starts and the rows load without the DLC civs' parents: `Modding.log` and `Database.log` show the file loaded with no error | a game with a DLC switched off, or the lab's compiled database with a DLC disabled | same |
| G.6 | A shared `GovernmentBiases` row at 50 on `TRAIT_LEADER_MAJOR_CIV` (the probe's `gov bias` arm) no longer moves any civ off its own pick | Antiquity 4242 with the probe overlay | same |

## Owed: Light and War Levy (arms)

Light Taxation at -1 Gold and +6 Happiness, and War Levy at +2 Gold and -1 Happiness in peace with +6 and -3 more at
war (DESIGN 4.7, NOTES 101 and finding V). The shapes were watched in the Light arms' probe games on 2026-10-30
(`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-light-arms.md`, arm 10 and every arm's War Levy), and in the
built mod on the same day (L.2 to L.7 under "Watched 2026-10-30 (merged build)"). L.1's later ages are left open.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| L.1 | Some AIs but not all slot Light, each once grown and short of Happiness (arm 10: Hawaii t69, Persia t92, Dai Viet t107); Goryeo and Hawaii still take Heavy at their second slot, and the AIs take War Levy (merged run 2026-10-30: Antiquity watched, 2 of 5; in Exploration and Modern all five AIs slot Light and keep it, at high Happiness: see "Watched 2026-10-30 (merged build)"; Light by age answers it in 0.5.1, LA.2 below) (2026-10-31, eleventh run: Hawai'i and Goryeo slotted Light at turn 29, Persia and Dai Viet War Levy at 37, Goryeo swapped to War Levy at 40) | Antiquity 4242, `--setup fast --quick`, Economics alone, 110 turns of `lab drive` with a per-turn card reading | `ui/econ-tax-cards.js` `CARD_LEVELS`, `data/econ-tax-gameeffects.xml` |

## Owed: Light by age and tariffs coming down (0.5.1)

Watched 2026-10-30 in an Exploration-start game (see "Watched 2026-10-30 (0.5.1)"): LA.1 to LA.3 for Exploration
and Modern, LA.4's text, LA.5's age starts, TD.1 to TD.3. Still owed: the Antiquity half of LA.1 and LA.2, the policy
menu (LA.4), the "Manorial economy" line (LA.5), TD.4, TD.5 and TD.6.

Built 2026-10-30, offline only (NOTES choices 114 and 115, finding Z). Light Taxation's Happiness is +6 in Antiquity,
+4 in Exploration and +3 in Modern, Gold -1 in each; an AI eases off a civ behind its tariff after 20 turns in a row at
peace with it, or at once when they're Friendly. One three-age game in the merged watch's setup reaches every line
here: Economics alone, Antiquity seed 4242, `--setup fast --quick`, `lab drive` through all three ages with
`mod_ideas_tested/economics/devtools/econ-watch-merged-sample.js` read every turn and each age's dump tallied by
`tally-watch-merged.py` (both updated for these lines). The boot line reads `[Economics] v0.5.1 loaded`.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| TD.1 | An AI holding a tariff drops it about 20 turns after it started (up to 25 with the 5-turn limit) while at peace with the civ behind it: a `tariff-eased` ledger event naming the AI and the other civ, then a `tariff` event to None | Modern from turn 1 (the Tariffs stage opens there), the three-age game | `ui/econ-trade.js` `easeTariffs`, `ui/econ-commerce.js` `aiTariff` |
| TD.2 | After easing off, the AI stays down while the other side still holds High: no raise in the 5 turns after any `tariff-eased` event (the tally prints `RE-RAISE` if one happens), and pairs that stood at High on both sides both end at None | same | `ui/econ-trade.js` `stillEased` |
| TD.3 | At the end of Modern most AIs are at None (the merged watch had all five at High from t11 to t143); `session().markets.tariffPeace` and `tariffEased` hold the counts and easings by "ai-other" | same | `ui/econ-markets.js` |

## Owed: Heavy after Priesthood and the bar pill (0.5.2)

- BP.1 The debt pill sits in the top resource bar after the settlement limit, in the world view and the city view,
  and redraws after a turn and after a borrow; the dock button still opens the screen.

## Owed: Economic swings (0.5.3)

Built 2026-10-30, offline only (NOTES 118). Nothing here has been seen in a game.

- SW.2, SW.3, SW.5: watched 2026-11-04 (see "Watched 2026-11-04 (Antiquity 4242 ...)").
- SW.4: watched 2026-11-02 (run A, a reload at 0.6145).

## Owed: UI polish

Built 2026-10-31 on the `ui-polish` branch, offline only: the fake-DOM tests in `tests/econ-views.test.mjs` and
`tests/econ-view-tabs.test.mjs` cover the rules and the text keys, and nothing here has been seen in a game. One
Antiquity game reaches UP.1 to UP.6 and UP.9 (Economics alone, Antiquity seed 4242, `--setup fast --quick`, the screen
open on turn 1, again after Code of Laws and again after Moneylending); UP.7 and UP.8 are captures of the same screen
at three window sizes.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| UP.2 | With a loan open, the Treasury's chart draws its second line (the Loans tab arriving with Commerce, the Debt figure and the three loan rows were watched 2026-11-11 with no loan, one line) | same game, after Moneylending, a loan | same |
| UP.7 | At 1720p full screen the screen's body text reads at the size of the Civilopedia's text and the section titles a step larger; the frame ends a little under the last section rather than at the bottom of the screen, with a 50vh floor, and a long tab (Loans after Moneylending) still reaches 93vh and scrolls | 1720p full screen; Treasury on turn 1 and Loans later | `ui/econ-screen.css` (`.econ-screen-frame`, every `font-size`) |
| UP.8 | At 1280x720 and at a 4:3 window the screen still fits: the frame stays inside the window, the tab scrolls, the columns stack at 4:3, and nothing is cut off at the right | windowed 1280x720 and 1024x768 | same |
| UP.9 | The citizens' offer card in the borrow form reads "Your citizens" as its title, while a loan from them reads "Owed to your citizens" (2026-11-02, run A: "Owed to your citizens" on the loan; the offer card's title is owed) | Antiquity as Classical Republic with a Commerce building, so the citizens offer | `ui/econ-view-borrow.js` `lenderTitle`, `text/en_us/ModText.xml` |

## Owed: model fixes

Built 2026-10-30 on the `model-fixes` branch, offline only (NOTES findings P to U and W to Y, choices from 102). Nothing here has
been seen in a game.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| F.2 | A save made mid-boom and loaded keeps the trend and the boom's turn count (`__towerEconomics.session().macro.cycle.trend`, `boomTurns`) | any game with the cycle on | `ui/econ-macro-state.js` |
| F.6 | An AI with a city building something takes a bond or civ loan now and then (ledger loan with source `ai-build`, about once per 10 turns per AI while its phase is Steady or Boom), and the build's progress jumps by the loan's Gold over 4 the same turn (`addProgress` log line naming the loan) (merged run 2026-10-30: the loans watched, 39 in Exploration and 81 in Modern; the `addProgress` line naming the loan wasn't in `UI.log`, so the progress jump is owed) | soak, Exploration with Public debt | `ui/econ-shortfall.js` `aiBuildBorrow` |

## Watched 2026-10-30 (ui-pass: tabs by stage, the screen's new look)

Four lab games on 2026-10-30, every other mod off, the `ui-pass` build installed over Mods/economics and put back
after (`mod_ideas_tested/economics/devtools/restore-ui-pass-2026-10-30.sh`, its log in `devtools/probe-runs/`: 0 rows
differ, option files the same, Mods/economics the installed 0.5.2). Antiquity seed 4242 with the stage nodes unlocked
one a turn by `tower-bench do unlock`, and Exploration seed 9001 with Economics, Mercantilism, Colonialism,
Cartography and Guilds unlocked the same way. Captures in `working_screenshots/econ-ui-pass/`.

| What was watched | Where |
| --- | --- |
| Antiquity turn 1 shows Treasury and Fiscal only; the guard switch and the cycle's Gold sit on the Treasury tab; the tab ends "Opens next: the Markets and Trade tabs ..., with Code of Laws" | `antiquity/01-*` |
| Code of Laws opens Markets and Trade together, Currency opens World, Commerce opens Loans; each turn's notice leads with one sentence (`UI.log`: "Economics: the Markets and Trade tabs are open ...", "... the World tab is open ...", "... the Loans tab is open. Other civilizations will lend to you now.") | `antiquity/02-*` to `04-*` |
| The dock button carries a gold dot while a newly opened tab hasn't been looked at; its tooltip names the tabs (`glue.fresh` read back) | `options/` run, `antiquity/earlier-options-run/turn8-dock-marker-crop.png` |
| A locked tax card is left out and named on the Fiscal tab's "Opens next" line; the cards show Gold and Happiness with the game's icons | `antiquity/04-after-commerce-fiscal.png` |
| Exploration: the bond market and lending open with Economics, development loans and general investment with Guilds and Colonialism, each with its own notice sentence | `UI.log` of the Exploration game |
| Every tab draws in the new look; the cycle on one dial, debt service on its scale with the 50% limit marked, line charts with scale, turn labels, legend and the readout | `exploration/01-*`, `06-*`, `10-*` |
| Repay, borrow, lend and aid open a confirmation in place with now against after; a borrow confirmed twice in the same moment queued one request; the line after a repay sits beside the loan | `exploration/02-*` to `07-*` |
| The bar pill reads "Debt 22 · Steady" after a loan landed | `exploration/09-next-turn-pill-crop.png` |
| What Economics moved last turn opens to its parts ("Loans -8.3") | `exploration/11-*` |

## Watched 2026-10-31 (0.5.4: whole-Gold payments, Spoil Guard, UI polish)

One lab game, seed 4242, Antiquity, the usual mod set, full screen on the Retina display (3024x1890). Captures in
`working_screenshots/econ-0.5.4/antiquity/` (t01, t55 and t101 for each tab the player could see).

- WG.1: turns 2 to 15, each AI's cycle share carried (player 3: -51, -92, then paid -1 Gold with -28 carried), and
  every balance moved by what its row paid, to the cent.
- WG.2: a UI reload on turn 15 logged `0 re-sent`; the same reload on 0.5.3 that morning logged 5.
- WG.3: `glue.landed` named the civs paid on turns 11 and 14 (player 3; players 1 and 3), and nobody on turns with
  nothing paid.
- SG.2: turn 1 the pill read "Unmet civilizations hidden: 5", turn 55 "2" (the owner dropped the pill afterwards: it
  crowded the title); the Trade tab listed only Greece, Goryeo and Dai Viet,
  and neither unmet civ (Persia, Hawai'i) appeared anywhere.
- UP.1: turn 1 Treasury with no loan rows, no scale, one balance line and no Debt figure.
- UP.2: after Commerce (set through the game's civic operation and granted Culture, turn 101) the Debt figure, the
  three loan rows and the scale came back.
- UP.4: "Most you can borrow over 10 turns" 70 in the limits panel and the form, with the payment-limit line.
- UP.5 and UP.6: "Send aid" on Treasury on turn 1 ("You haven't met anyone to send aid to yet"), gone by turn 55 with
  aid on the Trade tab.
- UP.9: the citizens' offer card titled "Your citizens".
- Found and fixed after the run: on turn 101, with nothing owed, the chart still compared "with your loans" against
  "without them", a 13 Gold gap that was only the cycle's share. The comparison now waits for a loan the player owes
  (built, not watched).

## Watched 2026-10-31, second run (Spoil Guard, stages Off, small windows)

Two lab games, seed 4242, Antiquity, Economic stages Off (`--setup ECONOMICS_STAGES=ECONOMICS_STAGES_OFF`), the usual
mod set: one windowed at 1280x720, one at 4:3 (the game opened at 1920x1440). Captures in
`working_screenshots/econ-0.5.4/stages-off-1280x720/` and `stages-off-4x3/`.

- SG.1 (in a game): Options, Add-ons has an Economics group with a ticked Spoil Guard checkbox. The main menu's Options
  wasn't opened; the launch logged no Economics errors there.
- SG.3: unticked through the checkbox and confirmed, the stored slice read `"spoilGuard":false` in the page and in
  `LocalStorage.sqlite` on disk; with Demographics' guard off too, the lending chips and the Trade tab listed all five
  civilizations, the unmet ones with "you haven't met them yet".
- SG.4: with ours off and Demographics publishing `met-civs-only`, the Trade tab and the chips still left the unmet
  civilizations out.
- SG.5: ours back on, the Trade tab listed nobody until turn 29, then Greece and Dai Viet, the two just met.
- UP.3: turn 1 Treasury with stages Off showed the loan rows and the scale, one balance line with nothing owed.
- Two lines once a loan is owed: a 30 Gold bond loan on turn 30, and the chart showed "With your loans" and "Without
  them".
- UP.8, 1280x720: every tab scrolls inside the frame. Found and fixed: the strip took nearly half the height (now
  tighter under 48rem, the small print dropped); the borrow form opened on 10 while the most was 0 (now the amount
  and offers wait until there's room, and a limit of 0 for want of income says so). Both watched after the fix.
- UP.8, 4:3: found the stacked columns collapsed to nothing (a row layout's flex basis of 0), squeezing each section
  into the next with the frame at its floor. Fixed (`flex: 0 0 auto` when stacked) and watched: Loans and Treasury
  stack in full and scroll, the frame 1382 of 1440 tall.

## Watched 2026-10-31, third run (the AI rules of DESIGN 6)

One lab game, seed 4242, started in Modern, Economic stages Off, Economics alone plus a throwaway probe
(`mod_ideas_tested/economics/devtools/probe-mod-ai/econ-probe-ai-watch`): every major civ meets every other at the
start, the Ottomans lose 15 Gold a settlement from turn 4, Persia loses 1 more a settlement every second turn, and
Hawaii and Dai Viet lean to Elective Republic. A per-turn script (`devtools/econ-ai-watch-sample.js`) kept Goryeo
Friendly with the human seat, Persia and the Ottomans, kept Hawaii Friendly with Goryeo, kept Hawaii, Goryeo and Dai
Viet above 25 turns of income, emptied the Ottomans' treasury at turn 4, and accepted the first offer to the human.
61 turns. Readings in `mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-ai-watch/`, tallied by
`devtools/tally-ai-watch.py`. The relationships and the Gold top-ups were set by script; every loan, investment, aid
and restructure below was the AI rule's own decision.

- Emergency loan from an AI lender (6, AI borrowing at or below 0 income): the Ottomans, income -25, took 97.65 Gold
  from Goryeo at turn 5 (`guard`, not yet insolvent), missed three payments and defaulted at turn 9.
- Aid (C.28): Goryeo sent the defaulted Ottomans 715 Gold at turn 10; their balance went from 44 to 760. Hawaii,
  Dai Viet and Persia followed at turns 13, 17 and 21, each once in the age. Relationship +10, +3, +3, +2.
- Investment between AIs (6): development loans to Friendly hosts (the Ottomans and Hawaii into Goryeo, Goryeo into
  Persia), 25 turns of returns, four records closed on schedule; one missed return (Persia, turn 21).
- Offers to the human (C.24): six from Goryeo, Hawaii and Dai Viet; the first, a development loan, was accepted and
  opened (I5, 135 progress points). One Goryeo general investment at turn 23 opened without an offer while the seat
  read as an AI under Autoplay.
- Investing from Capitalism (4.15): Hawaii and Dai Viet, both Market and Neutral to each other, invested in each
  other ten times, general and development, and offered general investment to the Neutral human seat.
- Restructuring: no AI met its trigger (two missed payments in a row with income above 0). Persia's income held
  between 105 and 200 under the probe. Watched by setting Dai Viet's 632 Gold build loan from Hawaii (L20) to two
  misses at turn 61: at turn 62 the rule restructured 505.60 Gold over 10 turns, the payment fell from about 66 to
  53.47, and 53.18 and 52.89 followed.
- Not reachable as written: a short AI with income above 0 never borrows a standard loan, and never accepts the
  player's loan (2.8). The engine wipes a negative balance while income is positive (P4), so the projected dip only
  comes with income at or below 0; and an AI whose payments run past its balance plus income is already past the 35
  percent service limit, so any standard loan is refused. Offline: an AI at 0 Gold, income +20, 36 due, missed and
  borrowed nothing. Answered by the distress read of AI-PLAN 4.1 (stage A, the fifth run below).

## Watched 2026-10-31, fourth run (the engine's script surface and `scaleAiPreference`)

Three short Modern games (seed 4242, `--setup fast --quick`, the usual mod set, no probe mod), for `docs/AI-PLAN.md`.

- API: from a mod's context, for AI players and AI-to-AI pairs, `Game.Diplomacy.getAgendaNames` and
  `getAgendaDescriptions` answer (every leader's two agendas); `Diplomacy.getPlayerRelationshipHistory(b)` returns the
  events with amounts and `getFavorGrievanceEventTypeName` names them (shared government +10, leader agenda -10,
  trade route favor +10, close land claim -20 at turn 13); `Trade.countPlayerTradeRoutesTo(b)` counts (1 route Xerxes
  to Alexander); capitals and `GameplayMap.getPlotDistance` give distance. `Players.AI.get(pid)` exposes
  `requestUnit`, `requestConstructible`, `scaleAiPreference`, `clearRequest`, `getProgressionTreePath` and the two
  settle and placement helpers. `Stats.getMilitaryStrength()` returned null without arguments; its signature is open.
- `scaleAiPreference(system, item, factor)`: treated against control over 30 turns, AI-PLAN 4.7. The untreated AIs
  stayed in step across the two runs; the three treated ones moved the way their arguments pointed (army budget x50:
  23 units against 21; Gold yield bias x50: income 204 against 105). One replicate.

Lab stopped and restored after each game; registry unchanged. Readings in `~/.tower-bench/runs/2026-10-31T13-40-08`,
`T14-04-19` and `T14-09-18` (about 630 MB together), scripts and logs under `mod_ideas_tested/economics/devtools/`.

## Watched 2026-10-31, fifth run (AI plan stage A: the distress read, refinancing, short payments, the garnish floor)

Two lab games, seed 4242, Modern, `--setup fast,ECONOMICS_STAGES=ECONOMICS_STAGES_OFF --quick`, the usual mod set,
the stage A build (commit `2b99755`, then the dues fix below) copied into `Mods/economics` for the runs (the 0.5.4
copy is kept in `_backups/econ-stage-a-2026-10-31/`). A per-turn script
(`mod_ideas_tested/economics/devtools/econ-stage-a-sample.js`) wrote four situations into the live ledger at turn 2
and then emptied the treasuries each turn: Persia and the human seat with a 3-turn bond loan whose slice is 1.5
turns of income; the Ottomans the same, with the seat's loan for 0.3 turns of income queued before each batch;
Hawai'i with a 3-turn loan of 13 turns of income, past its credit cap; Goryeo with a bond loan already in default
and 4.61 Gold left (the first AI watch run's turn-40 figure). Run 1: 20 turns (`~/.tower-bench/runs/2026-10-31T18-05-48`);
run 2, after the fix: 10 turns (`2026-10-31T18-14-00`). Drive logs, the per-turn dumps and `UI.log` are under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-stage-a/`. No invariant line in either `UI.log`.

- A short AI with income above 0 takes a refinancing loan before its payment (AI-PLAN 4.1): Persia, run 1 turns 3
  to 5 (L12, L15, L18 from the bond market, `refinance` events with the dues and funds), Hawai'i turns 5 and 9 to 11
  once its outstanding came under its cap (L19, L21 to L23), and run 2 Persia turn 4 (L11, 71.44 Gold) and Hawai'i
  turns 5 and 6. The loans carry `source: refinance`, 10 turns, not emergency.
- The player's loan to a short AI is accepted on the credit cap alone: run 1 turns 3 to 6, the seat's 14.86, 14.91,
  15.00 and 15.00 Gold to the Ottomans each opened as `lend` (L11, L13, L16, L20) while the Ottomans' dues passed
  their funds; at turns 7 and 8 the request was refused `loan-limit` (six open). In run 2 the Ottomans weren't
  short and every offer was `declined`, as the rule says.
- Short payments pay what there is (AI-PLAN 4.1): Hawai'i, over its cap, paid 191.33 of 518.41 Gold on L9 at turn
  3 and 327.08 joined the loan (`miss` with `paid`, `due`, `capitalised`; `short` event `credit-cap`), then 77.00 of
  519.57 at turn 4; the Ottomans, with nothing in hand, paid 0 (the plain miss). The human seat's notice at run 1
  turn 4 read `paid 13881, due 14007, short 126` on L6, and its `refinance` notice carried the amount, the lender
  and the dues.
- A default closes: Goryeo's 4.61 Gold took the 1 Gold floor each turn (4.61, 3.61, 2.61, 1.61) and closed at turn 6
  with 0.61 forgiven, in both runs. The Ottomans' L11 (defaulted at turn 6 on the seat's loan, 15.26 Gold) was
  garnished 1.53, 1.38, 1.24 and then the 1 Gold floor, and closed at turn 19 with 0.99 forgiven. The seat got the
  `defaulted-on` and `restructure-ask` notices.
- Found and fixed between the runs: in run 1 a refinanced civ still came up short by its slump charge, to the
  cent (Persia turn 3: 2.73 short, the cycle charge 2.73; the seat turn 4: 1.26 and 1.26). The cycle's charge, the
  plan's take and erosion come off a payer's funds before its loans, and the dues read left them out. They're in it
  now (`econ-distress.js` `macroDues`), and run 2 had no miss on a turn a civ refinanced (run 1 had three).
- Not a defect, noted: the Ottomans' balance stayed below 0 for four turns with income above 0 (-401, -281, -161,
  -39), so the engine's negative-balance wipe (P4, watched on the human seat) didn't apply to that AI. The hole was
  the script's own (run 1 emptied a lender's treasury before the build loans it had just made went out); run 2
  empties to the batch's own expectation and had no such hole.
- Aid clearing a default to the giver wasn't driven: no AI was Friendly with a civ in default to it in these runs
  (owed below).

## Watched 2026-10-31, sixth run (AI plan stage B: escrow and the AI's preference factors)

One lab game, seed 4242, Modern, the same setup as the fifth run, the stage B build (commit `ea90f87`) in
`Mods/economics`, 21 turns (`~/.tower-bench/runs/2026-10-31T18-28-44`; drive log, dumps and `UI.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-stage-b/`). The script
(`devtools/econ-stage-b-sample.js`) wrote Persia a 10-turn bond loan of 3 turns of income and the Ottomans a 3-turn
loan of 4.5 turns of income at turn 2, emptied the Ottomans' treasury on turns 3 to 6, and from turn 16 gave Hawai'i a
3-turn loan of 4.5 turns of income with its treasury emptied each turn, so a civ would be short with the escrow in
place. Every AI also took its own build loans at turns 2, 12 and 22. No invariant line and no
`scaleAiPreference failed` line in `UI.log`.

- The hold: from turn 2 every indebted AI put next turn's dues into escrow after its payments (`EH` transfers, the
  ledger's rows), and each turn the engine balance read after the batch equalled the batch's snapshot plus what it
  was paid, hold included (`landed` on every AI row of every turn), so the Gold was out of the treasury the AI
  spends from.
- The payment from escrow: at turn 3 the Ottomans' 23.65 came back (`ER2`) and their payments of 23.65 and 75.95
  were made; at turn 4, after their treasury was emptied to 9.24, the 98.88 released covered the 98.88 due to the
  cent, no miss. Persia the same every turn of its 10-turn loan (released 69.18 at turn 4, paid 17.08 and 52.10).
- Conservation: the batch nets add up with the escrow as a world line both ways; no `debt-8` or other invariant
  line in 21 turns.
- Distress and the two-turn hold: Hawai'i was short at turns 18 and 19 (refinanced 50.69 and 126.31), held nothing
  on those turns (nothing left after paying), held 118.77 at turn 20 (two turns of its 61.67 dues, the turn after
  its last short turn) and 61.01 at turn 21.
- The preference factors: every AI's Gold bias went out every turn (`YIELD_GOLD` 2.0 to 5 on all five, since their
  build loans put the service past a tenth of income nearly every turn); Hawai'i's army and expansion budgets read
  0.25 on turns 18 to 20 (in distress, Gold factor 5) and 1 again from turn 21. What the factors do to the AIs'
  builds wasn't measured here (the direction was, in the fourth run at x50).
- Not seen: the Treasury tab's "In escrow" line (the data behind it, `treasuryView.escrowCents`, read right in the
  unit tests; the drawn tab needs a capture), and the escrow across an age change (owed below).
- For the owner: with the build loans sized to half of income, the Gold bias sat between 2 and 5 on all five AIs
  for most of the game. AI-PLAN 4.2's tenth-of-income threshold was meant for a civ paying debts, and the build loan
  puts every AI there. Whether that's wanted, or the threshold should sit above the build loan's own service, is a
  call for the balance run and the owner.

## Watched 2026-10-31, seventh run (AI plan stage C: the look-ahead, early repayment, restructuring from no misses)

One lab game, seed 4242, Modern, the same setup as the fifth run, the stage C build (commit `b046831`) in
`Mods/economics`, 20 turns (`~/.tower-bench/runs/2026-10-31T18-42-52`; drive log, dump and `UI.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-stage-c/`). The script (`devtools/econ-stage-c-sample.js`)
wrote at turn 2 a 20-turn bond loan at 2% a turn to Hawai'i while it held well above its reserve, a 3-turn loan of 13
turns of income to Persia, and a 10-turn loan whose payment was 1.5 turns of income to the human seat, whose
treasury was emptied each turn from turn 3; at turn 12 a 3-turn loan of 8.6 turns of income to the Ottomans with
their treasury emptied; at turn 17 the same again with the bond market and the temple treasuries blocked for them
in the ledger. No invariant line in `UI.log`.

- An AI repays early: at turn 3 all five AIs, each above its reserve, put half its surplus into its dearest loan
  through the payment's extra (`repay-early` events with the reserve; Hawai'i's L7 at 2%: 596.70 paid with 555.75
  of extra, closed; the four build loans closed the same way); at turn 4 Persia put 696 into its 2,100 Gold loan and
  Hawai'i closed its last build loan. The extra rode on the regular payment, as the player's does.
- The notice: the seat, paying 140 a turn on 92 to 113 of income, was carried by the escrow for seven turns (each
  turn's hold shrank), then at turn 10 the look-ahead said next turn's 140.07 wouldn't fit the 135.77 it was on
  course to have (`short-ahead`, gap 4.30), and at turn 11 the guard refinanced the 0.18 missing and the notice
  repeated for the turn after (gap 26.05); turn 12 refinanced 20.65.
- An AI restructures before a miss: at turn 13 the Ottomans' gap sat inside their credit room (Modern banks add up
  to 12 turns of income to the cap), so they refinanced instead, 463.27 and 270.58, as the order says. With the
  lenders blocked, at turn 18 they restructured the new 1,066 Gold loan at `m = 0` first (the biggest payment), the
  `restructure` event before the `miss`, and the payment went on the new schedule.
- Found and fixed after the run: with nothing in hand (the Ottomans' balance sat at -123 from the script's own
  emptying, with income 124, so their funds were about a Gold), the rule went on to restructure every loan it had,
  six in one turn, which no schedule could fix. It now restructures one loan a turn (commit `90b27d0`).
- The seat's own refinancing and the escrow meant the player never saw a `short` notice with the guard off (the
  guard was on); the restructure button from `m = 0` and the reserve rows on the Loans tab weren't drawn (owed below).

## Watched 2026-10-31, eighth run (AI plan stage D: credit reputation and the AI's repudiation weighing)

One lab game, seed 4242, Modern, the same setup as the fifth run, the stage D build (commit `ebfce20`) in
`Mods/economics`, 22 turns (`~/.tower-bench/runs/2026-10-31T19-01-09`; drive log, dump and `UI.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-stage-d/`). The script
(`devtools/econ-stage-d-sample.js`) read each AI's strength at turn 2 (`getMilitaryStrength` answered nothing, so the
combat-unit count: 15 for all five), wrote Persia a 20-turn loan from Dai Viet worth 6 turns of its income and set
Persia Unfriendly to Dai Viet, and wrote Goryeo a loan from Dai Viet with nine of ten payments made; at turn 14,
with Persia at 17 combat units to Dai Viet's 15, the Persia loan again; at turn 18 the Ottomans a loan from Hawai'i
and a war between them through the engine's own `Diplomacy.forceDeclareWar` (on the player's Diplomacy object; it
took, `isAtWarWith` read true the next turn). No invariant line and no failed booking in `UI.log`.

- The weighing, the Unfriendly-and-weaker branch: at turn 15 Persia repudiated the 1,022.94 Gold it owed Dai Viet
  (`repudiation`, grudge 32); the engine read 32 grievances on Dai Viet and the relationship fell from -47 to -90
  (the lender's own hit of -24, sized like the grudge, with the witnesses' -3 each); Persia's reputation went to 70
  (`credit-rep -30`). The first loan at turn 2 wasn't repudiated: every AI read 15 combat units, so nobody was
  weaker, and Persia, flush, repaid it early at turn 4 instead.
- The war branch: at turn 19 the Ottomans, at war with Hawai'i since the turn before, repudiated the 744 Gold
  (grudge 23, read back as 23 on Hawai'i; witnesses -2, the lender -17; reputation 85, the halved cost).
- The climb back: Persia's 70 at turn 15 had mended to 72.77 by turn 22 (half-life 50), then +2 for the tenth
  payment on time and +5 for repaying L8 in full put it at 79.77; the Ottomans' 85 reached 90.41 with a loan repaid
  and 93.54 with aid given. The rows carry the turn, so a reload mends from the same point.
- Favors: Goryeo's tenth payment on Dai Viet's loan at turn 3 booked `favors 4>5:5`, and the engine's
  `getNumFavors(5)` on Goryeo read 0 before and 5 after (the engine keeps favors in thousandths, as grievances, so
  the call books `5 * 1000`), then 15 as the game added its own.
- Not seen: the Loans tab's reputation figure and the repudiation preview's lender line as drawn; what the booked
  favors do to the relationship over time (the fourth run read the favor events, not their weight); a 0.5.4 save
  loading its standing as the opening reputation in a game (unit-tested).

## Watched 2026-10-31, ninth run (AI plan stage E: stakes behind investment, aid and lending)

One lab game, seed 4242, Modern, the same setup as the fifth run, the stage E build (commit `a302f53`) in
`Mods/economics`, 21 turns (`~/.tower-bench/runs/2026-10-31T19-19-15`; drive log, dump and `UI.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-stage-e/`). The script
(`devtools/econ-stage-e-sample.js`) held Hawai'i at a level of 30 with Goryeo, Dai Viet at 0 with Persia, kept
Goryeo flush to turn 5 and emptied its treasury from turn 6; at turn 18 it wrote a defaulted 200 Gold loan from the
Ottomans to Goryeo into the ledger. No invariant line in `UI.log`.

- The pair facts reached the model: every met pair's row carried the engine's level number (10 at the start,
  30 for Hawai'i and Goryeo once set, 44 between Persia and Hawai'i by turn 5), the routes between them as they
  opened (r1, r2), the capital distances (12 to 44 plots), and the agenda rows (Persia's -10 toward everyone from
  turn 10, Dai Viet's +10 toward the seat, -5 toward the rest), with alliances none. The plan's own stakes followed:
  Hawai'i in Goryeo 10 at turn 3, 19 once a route and the level's drift came in; Persia in Dai Viet 0; Persia's
  stakes in everyone below 2 from turn 10 on its agenda and falling levels.
- Investment by stake, not the clock: ten AI investments in eight turns, each to the host the investor had the most
  at stake in, none repeated while one was open. Turn 3: Hawai'i and Goryeo into each other at a stake of 10
  (270 and 165 Gold of build progress, 4 turns of income each); turn 4: Persia into Hawai'i, the Ottomans and Dai
  Viet into each other, each at the threshold of 8 (a level of 15 or 20 with capitals within 20 plots); turn 5:
  the Ottomans into Goryeo (12.7), Hawai'i into Persia (23.7, 8 turns of income capped by what it could spare),
  and Goryeo's 604 Gold offer to the seat (12.7); turn 6 Goryeo into the Ottomans; turn 8 Hawai'i into the
  Ottomans. Persia, at stakes under 2 from turn 10, invested in nobody after turn 4.
- Aid by stake: at turn 19, Goryeo in default on the 200 Gold it owed the Ottomans, the Ottomans (stake 27 in
  Goryeo, level 42, so 1 point short of nothing: the one point's worth) sent 377 Gold of aid: `aid-cleared` 200 on
  that loan, which closed, and 177 Gold to Goryeo's treasury (`invest` with `cleared 20000`); `aidTurns` noted
  turn 19, and no second aid to Goryeo followed. That is stage A's owed item A.1 as well.
- The lending gate: Dai Viet, at a stake of 0 with Persia, still lent it a build loan at turn 2 (0 passes); the
  Unfriendly-lender refusal is unit-tested and wasn't driven here (owed below).
- Not seen: what the booked favors and the agenda-driven stakes do over a long game; the Trade tab showing the AI's
  stake behind an offer (no screen reads it yet).

## Watched 2026-10-31, tenth run (the AI plan's owed items and the build loan as a want)

One lab game, seed 4242, Modern, `--setup fast,ECONOMICS_STAGES=ECONOMICS_STAGES_OFF --quick`, the usual mod set,
windowed 1600x1000, the HEAD build (`83f6902`, then `8a36e49` deployed at turn 17 with a UI reload) in
`Mods/economics`. 40 turns in four drives (`~/.tower-bench/runs/2026-10-31T21-28-11`; the four scripts, the drive log
and `UI.log` under `mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r1/`; captures of the three tabs
at turn 40 in `working_screenshots/econ-watch-2026-10-31/`). No invariant line in `UI.log`. The scripts wrote loans
into the live ledger, moved relationship levels, emptied treasuries and queued the human seat's requests; the screen
was opened by script and its text read back (opening on one turn and reading on the next, since a same-turn read
failed four times in six).

- A.2: the seat's 150 Gold of aid to Goryeo, which had defaulted on 45 Gold owed to the seat, cleared that debt
  first (`aid-cleared`, the notice "45 Gold of it cleared the debt", Goryeo's record closed). The Treasury history
  showed a raw `LOC_ECONOMICS_EVENT_INVEST_AID_CLEARED` tag for the line: the key was missing and is in now.
- B.1: the Treasury tab read "In escrow for next turn's payments 44.3" beside "Loan payments due next turn 44.3"
  while the seat owed, and 0 after its loans closed.
- C.1: "Reserve ... 1060" and "You hold this much above it ... 3171.3" on the Loans tab, and with the guard off and
  the seat short, "Next turn's payments of 171.89 Gold won't fit the 75 Gold you're on course to have".
- C.2: both on-schedule loans had an enabled Restructure button.
- C.3: with the guard off and the treasury emptied, the notice read "Your payments of 171.89 Gold pass the 154.00
  Gold you have by 17.89, and the guard is off", then the paid-part line (144.85 of 162.74 paid, the rest
  capitalised). With the guard back on the next payment was made in full.
- C.4: Dai Viet, past its cap with its only other loan already restructured and its treasury emptied, restructured
  its own bond loans one a turn (turns 28 and 29), then at turn 30 sent the seat the `restructure-ask` notice on the
  seat's on-time loan (no miss); the seat's "Let them restructure" request restructured it (payments 22.28 to 18.23).
  The button itself showed on the lent loan ("Lent to Đại Việt ... Let them restructure").
- D.1: "Credit reputation ... 77" as a whole number after the seat's repudiation (76.62 in the history line).
- D.2: a loan from Goryeo repaid in full booked 5 favors (`favors 0>4:5`) and Goryeo's level with the seat moved
  from 20 to 25 the same turn, twice (turns 7 and 14).
- E.1: Persia at -40 (stake -13.3) made no offer on the borrow form while Hawai'i, Goryeo, Dai Viet and the bond
  market did.
- E.2: a shared enemy (Dai Viet and the Ottomans both at war with Goryeo) lifted the Ottomans' stake in Dai Viet by
  4 and the Ottomans' first investment went there.
- E.3: Hawai'i's offer declined at turn 3 wasn't repeated until turn 18 (it had no spare Gold until a grant at
  turn 17), when it came back.
- E.4: Persia with Dai Viet at -70 read `PLAYER_RELATIONSHIP_HOSTILE` from the engine and the stake carried the -6;
  at -54 the enum read `UNFRIENDLY` and the -6 was gone; at -63 Hostile again. The band's top sits between -54 and
  -63, as the ×30 reading says.
- W.1 to W.3: before the fix no build loan opened in 16 turns because the first city's quick build hid a slow one
  (one loan at turn 2 on a build the AI changed the same turn). With the city picked for its reason: Hawai'i on a
  wonder 8 turns out (L17, L26) and Goryeo on a Port 9 turns out with +9 Gold (L18, L27; `turnsLeft` and
  `buildGoldYield` read from the engine), each sized to 30% of income (first payment 27.09 on 93 of income), one open
  at a time, none for the civs in distress or with quick builds. Goryeo at 26 to 28% service took none.
- Also watched on the way: F.4's service-limit line and "Borrow that instead", UP.4's "Most you can borrow" with the
  form opening on it, M.14's Panic (turn 23, from the injected loans), the pill reading "In default · Slump" in red
  (S.4), WG.2's `0 re-sent` on the UI reload at turn 17, and the World tab's leverage in red at 5.4 turns (F.7).
- Not reached: A.3 (the seat's credit cap was used up by its repudiation and default; folded into the Antiquity
  run), B.3 (two games), C.7 (the Modern market read lists no strategic class), D.3 (needs a 0.5.4 save).
- For the owner: when the world entered a Depression at turn 12, every AI pair with a stake of 10 or more aided
  each other within two turns (nine aids, about 2,800 Gold), since "a host in its own Depression" holds for all of
  them at once. The rule reads as designed; whether a world Depression should open aid everywhere is a design call.
- Noted again: an AI's balance stays below 0 for turns with income above 0 (the Ottomans and Dai Viet here), the
  engine's wipe applying to the human seat only (NOTES finding AA).

## Watched 2026-10-31, eleventh run (Antiquity into Exploration, every other mod off)

One lab game, seed 4242, Antiquity, every other mod off, `--setup fast,ECONOMICS_INFLATION=ECONOMICS_INFLATION_ON
--quick`, stages On, the HEAD build in `Mods/economics`, 112 Antiquity turns, `lab age-change`, 16 Exploration turns
(`~/.tower-bench/runs/2026-10-31T21-46-55`; the script, drive log, `UI.log` and `Database.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r2/`; captures in
`working_screenshots/econ-watch-2026-10-31/r2-*.png`). The seat's income was pushed below 0 from the bench with 22
warriors (free at Settler) and 8 horsemen (4 Gold each), and back with `remove unit`. No invariant line in `UI.log`,
`Database.log` clean in both ages.

- 3.1: at 3 Gold with income -23 the guard's temple loan (L8, 56 Gold over 10 turns at 2.94%) landed before the
  crossing, with the notice naming the amount and the lender. 3.6: the insolvency notice at the fifth turn of income
  below 0, and the Treasury tab's "Insolvent" line while it held. 3.4: `guard-cap` at turn 65 once the three
  temple loans had used the 150 Gold allowance; the game then disbanded a unit a turn for three turns (39, 38, 37)
  with the balance held at 0. 1.7: the misses paid nothing and the balance never went below 0.
- 2.4's rate climb on the way: 2.94% to 3.68% to 4.59% to 5.40% to the 6% cap over three misses.
- U.4: the Loans tab appeared with the temple loan before Moneylending (the tab bar read Treasury, Loans, Fiscal,
  Markets, Trade at turn 61).
- UP.1, UP.5, UP.6: on turn 11 the Treasury tab had no Debt figure and no loan rows; its "Send aid" section read
  "You haven't met anyone to send aid to yet", then listed Greece and Goryeo once met (SG.5), and was gone at turn
  41 once the Trade tab opened. SG.2: only met civs listed.
- M.24: the Fiscal tab read "A mixed economy until you choose a government" on turn 3 and "Civic market" from turn 11;
  in Exploration "Manorial economy" under Feudal Monarchy. G.1, G.7: the Exploration picks matched the table for all
  six (Mongolia and Sengoku Feudal Monarchy, Abbasid, Hawai'i and Majapahit Theocracy, Goryeo Plutocracy) and the
  systems followed (manorial, religious, mercantile). Antiquity: Persia Despotism, the rest Classical Republic.
- F.8: "The age change kept 6000 of Sengoku Japan's 6640 Gold" in the Treasury history on Exploration's turn 2.
- M.15: the pill read "No debt · Steady", "Debt 56 · Steady", "In default · Slump".
- WG.3: `glue.landed` named the civs paid each turn. M.28: 23 citizens' loans across the AIs.
- L.2 and T.1: "War Levy=2" on the capital's Gold breakdown at peace, by script. M.2 and C.35: the data groups
  loaded in both ages with no error.
- Not reached: F.5 and A.3 (the seat's income stayed below 0 after the units were removed, so no civ would lend to
  it); 5.5 (the seat's `forceDeclareWar` didn't take); B.2 (the loan open at the change was paid off in the nine
  turns the age change ran); M.19 in Exploration (the Antiquity Market wasn't listed; the twelfth run watched the
  rule on an Exploration start instead).

## Watched 2026-10-31, twelfth run (Exploration on a fresh seat, every other mod off)

One lab game, seed 9001, Exploration, every other mod off, Inflation On, stages On, 59 turns in three drives
(`~/.tower-bench/runs/2026-10-31T22-04-19`; three scripts, the drive log, `UI.log` and `Database.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r3/`; captures `r3-*.png`). The closed-event
fix (`ce079aa`) was deployed at turn 37 with a UI reload. No invariant line in `UI.log`.

- 2.1: the borrow form listed Persia and Sengoku with rate, payment, interest in all and the share of income, the
  request landed next turn (L7) with its notice. F.5: 10- and 20-turn terms before Public debt.
- 2.3: "L15 paid off.", "L17 paid off.", "L19 paid off." and "I3 paid in full." in the Treasury history once the
  closed event named both sides (it hadn't, so the line was missing: fixed and watched).
- 2.4 and 2.5, with the guard off (the guard's refinancing otherwise borrows for the dues): L27 missed three times
  with the climbing rate (1.0% to 1.25%, 1.56%, 1.95%), Influence -5 a miss, then its default and the garnish;
  L28 restructured after two misses (payments 27.3 to 9.67, misses cleared) and its Restructure then greyed with
  "This loan has been restructured once already"; L27 in default greyed with "A loan in default can't be
  restructured". The lender's block record followed; a new loan to it was refused at the six-loan limit.
- 4.3: with Persia at war with the seat (Persia's own `forceDeclareWar`), the seat's 600 Gold loan to it was
  repudiated the next turn (`repudiation`, the seat's notice, the block record).
- C.19 and C.20: a development loan of 20 Gold on Sengoku's Guildhall sent 18 (6 points at the age's rate), the
  build moved from 278.6 to 329.0 production the next turn against its own 45 a turn, and 1.08 Gold came back each
  turn. C.21: Persia's rows read "you can't invest in a civilization you're at war with or that's Unfriendly to
  you; aid only needs peace". C.24: Sengoku's offer of 23 Gold accepted from the queue opened as progress the next
  turn. C.26: a hosted investment whose returns passed the seat's income missed three times (Influence -5 each) and
  defaulted, then the garnish ran. C.27: repudiating the Pirates closed what the seat hosted, cost 30 reputation
  and 3 relationship with each met civ. C.13: "Routes you could make" listed foreign cities with the bill each
  would add. C.6: the Markets tab's rows. C.29: Trade 3, Warehouse 12, Industry 0.
- M.6: the AI war at turn 1 took the index from 1.000 to 0.988 the next turn; the World tab's causes list read as
  designed. M.19 and M.20 on an Exploration start: "Academy, Roma: 1.00 fading", "Lighthouse, Roma: 0.50 at its
  floor: a newer building with its role stands in this city". M.15: "Debt 1.5 · Steady · 0.1% inflation".
- F.4: "That's what's left of your credit limit" beside the most; C.3: prices continuous across the UI reload.
- 3.2 (Exploration half): the seat's refinancing came from the bond market once Public debt was reached (turn 43).
- Not reached: the seat's own `forceDeclareWar` (4.3 needed the AI's), the tariff row (U.6, no Imperialism), M.17.

## Watched 2026-10-31, thirteenth run (Exploration with the usual mod set)

One lab game, seed 9001, Exploration, the usual set (Demographics, Emigration, Partisans, Aging Warehouses, the
rest), Inflation On, 23 turns (`~/.tower-bench/runs/2026-10-31T22-27-22`; the script, drive log and `UI.log` under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r4/`). The pills build (`acab484`) was deployed at
turn 21 with a UI reload. No invariant or error line in `UI.log`.

- 7.1 and C.34: with the set, a civ loan opened and paid, three misses with the guard off, a repudiation that cost
  Persia's level with the seat 30 and the witness 3, bills between AI pairs each turn, an AI's guard loan; the batch
  took 11 to 18 ms a turn (1.8, 6.7).
- M.23 and C.32: with Aging Warehouses, the Treasury's old buildings listed "Saw Pit, Roma: 1.00 fading",
  "Brickyard", "Granary" beside the Academy and the walls (the vanilla game lists none of the warehouses).
- M.35: the index moved on the AI war, the old buildings and "Manorial economy, set by your government" read as in
  vanilla. SG.4 and SG.2: with Demographics on, the Trade tab listed the two met civs, and the World tab's causes
  read "a disaster (an unmet civilization)".
- The new pills: "Debt 50.4" plain beside "Steady", then "In default" red beside "Steady" plain (captures
  `r4-pills-t22.png`, `r4-pills-default-t23.png`; the inflation pill's text key loads at the next game start).

## Watched 2026-10-31, fourteenth run (the setup options off)

Two short lab games, seed 9001, Exploration, every other mod off (`2026-10-31T22-33-23` and `T22-38-21`; logs under
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r5/`). 5a: Markets, Tariffs, Foreign investment,
Economic systems and Economic stages Off, 8 turns; 5b: Loans, Taxes and the Business cycle Off as well, 4 turns.

- C.2: the Markets and Trade tabs read "The Markets and trade bills option is off for this game" with no bills,
  the Trade tab "The Foreign investment option is off for this game", the Fiscal tab had no tariff row, and with
  Loans off as well the batch logged `skipped, all-off` each turn. 5.7: "The Taxes option is off for this game, so
  there are no tax cards." The boot line listed the options.
- G.4: with Economic systems Off every civ, the Pirates and Silla included, took Feudal Monarchy, the game's own
  pick; the Fiscal tab read "Economic systems are off in this game; every civilization runs a mixed economy."
- UP.3: with stages Off the Treasury tab showed the loan rows, the escrow line, the scale and the chart from the
  first turns. With the cycle off and nothing owed the top bar showed no pill.
- Noted: with Markets off the Trade tab still reads "The most you pay in bills a turn 0.3" above the off note.

## Owed: AI plan stage E

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| E.1 | An AI that's Unfriendly with the player (a stake under 0) makes no loan offer on the Loans tab's borrow form, and comes back once Neutral (2026-10-31, tenth run: Persia at -40 made no offer while Hawai'i, Goryeo and Dai Viet did; at 0 its agenda rows kept its stake under 0, so "comes back once Neutral" reads "comes back once its stake is 0 or more") | a game where an AI dislikes the player | `ui/econ-stake.js` `lenderGate`, `ui/econ-lenders.js` `declines` |

## Watched 2026-10-31, fifteenth run (crises and responses)

One lab game, seed 4242, Modern, the usual mod set, stages Off, crises On, 22 turns (`2026-11-01T00-17-53`; logs,
the sample script and the captures under `mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r6/` and
`working_screenshots/econ-watch-2026-10-31/r6-*.png`). The world index was set to 0.70 by script at turn 1 and
again at turn 19, with the 30-turn spacing cleared, for a second crisis; the seat's own responses had to be
written into the ledger by script (see the defect below).

- X.1: at turn 2 every civ's index read a Depression and the `crisis-start` event fired for all six; the seat's
  notice read `crisis-start:depression`. The World tab's Crisis section drew "Depression", the turns in, the
  index note and the causes line ("Since turn 20, after the world's income growing slower than usual, a disaster, a
  trade war and the Dust Bowl" in the second crisis), with "What you're doing" and "What you can do" under it
  (`r6-crisis-world-t21.png`, `-b.png`). The crisis ended at turn 8 once the index passed 0.80 (`crisis-end`, 6
  turns, `by: rearmament` for the AIs). A second crisis opened at turn 20 for all six.
- X.4 (part): the Modern menu drew Public works, Relief, the Bank holiday, Deposit insurance, Off the gold standard
  and Price supports, each with its history line (the WPA and the TVA, the Emergency Banking Act, the FDIC and
  Glass-Steagall), its Now, Price and It leaves lines and a Choose it button; the "Doing nothing" note drew while
  the seat had no response. Rearmament, Confidence, Austerity and the Hoover-line marks sat below the part of the
  panel the reads and captures reached.
- X.5 (part): a Public works row written into the seat's ledger paid 48 Gold a turn (8 a settlement, six
  settlements) into its builds each turn (`0>progress:4800:works`, progress rows on two cities), put
  `public-works@0=100` and `public-works=25` into the cycle's events, and the panel listed it under "What you're
  doing" as "until the crisis ends" with an End it button and the menu's own card reading "it's already running".
  Choosing it from the panel wasn't reached: see the defect below.
- X.6: two legacies written into the seat's ledger drew on the Fiscal tab under "What your choices left":
  "Deposit insurance, carries into the next age" with its four effects, and "Relief ended early, 8 turns left, -2
  Happiness a settlement while it lasts" (`r6-legacies-fiscal-t21.png`). The `legacy-ended` notice and a world
  legacy weren't reached.
- X.7: at turn 2 all five AIs took Rearmament (`response`, `source: ai`), each adding `rearmament@<pid>=50` to the
  cycle's events every turn and a `rearmament` legacy to turn 22; the responses ended at turn 12 and the Bonus Army
  marched on every civ from turn 7 (`bonus-army=-100` for five turns). In the second crisis, with Rearmament used
  up for the age, four AIs took Deposit insurance (240 to 394 Gold, two turns of income) and Dai Viet went off the
  gold standard (`gold-standard@5=100`). Worth a look: every AI read `atWar` true at turn 2 of a Modern start, so
  the war rule chose Rearmament for all five ahead of their systems (`ui/econ-crisis-respond.js` `aiPick`,
  `ui/econ-engine.js` `readAtWar`).
- X.9: three High tariffs set at turn 14 did nothing while the world stayed above 0.80; once it fell at turn 20
  `trade-war=-50` joined the cycle's events each turn and the panel's causes line read "a trade war". The Dust Bowl
  (`dust-bowl@0=-25`) and a disaster showed in the same line.
- Noted: the AI-plan invariant econ-3 fired once, at turn 5 (`4:327684`): two development-loan progress grants of
  90 landed on one Goryeo city in one turn (log lines `progress 90 on 4:327684 (I2)` and `(I5)`), outside the
  crises code. The panel reads "1 turns in" on a crisis's first turn. In the response cards the Now, Price and It
  leaves text is right-aligned and wraps back under its label, and the Fiscal tab's "What your choices left"
  heading runs into its own subtitle.
- Not reached: the seat choosing a response from the panel or the request queue, and its cost and "sent" line
  (X.5); Antiquity's and Exploration's menus (X.2, X.3); the bank holiday on a seat loan (X.8); the bank run
  (X.10); the Civilopedia pages (X.11); the option Off (X.12).

Build defect found: `REQUEST_KINDS` in `ui/econ-session.js` lists borrow, lend, repay, restructure, repudiate, tax,
tariff and invest but not `respond`, so `queueRequest` refuses every crisis response from the seat. The drive log
shows it at turns 4, 5, 9 and 11:

```
acts req {"kind":"respond","pid":0,"response":"public-works"} -> false
acts req {"kind":"respond","pid":0,"response":"relief"} -> false
acts req {"kind":"respond","pid":0,"response":"relief","cancel":true} -> false
acts req {"kind":"respond","pid":0,"response":"deposit-insurance"} -> false
```

- Fixed after the run: `respond` added to `REQUEST_KINDS` (a test queues a response and its cancel); and `readAtWar`
  now counts only majors the civ has met, because the game's `isAtWarWith` answers true for a pair that hasn't met
  (its own diplomacy-manager filters the same call by `hasMet`), which is what read every AI as at war at turn 2 and
  sent all five to Rearmament (X.7). Taking a response from the panel and an AI's pick at a Modern start are still
  owed a watch.

The panel's Choose it and End it buttons go through the same queue, so they fail the same way for a player.

## Watched 2026-10-31, sixteenth run (crises and responses after the queue fix)

One lab game, seed 4242, Modern, the usual mod set, stages Off, crises On, 27 turns (`2026-11-01T00-43-17`; the
sample script, the drive log and `UI.log` under `mod_ideas_tested/economics/devtools/probe-runs/2026-10-31-watch-r7/`,
the captures `working_screenshots/econ-watch-2026-10-31/r7-*.png`). The tree at `ff68140` was copied into the game's
`Mods/economics` for the run and the 0.5.4 copy put back after. The world index was set to 0.70 by script at turn
1 and to 0.60 at turn 12 with the 30-turn spacing rows cleared, for two Depressions; a Credit panic came on its
own at turn 24. Every seat request went through the queue this time (`-> true` at turns 5, 8, 9, 11, 14 and 17).

- X.5: at turn 4 the drive pressed the panel's first Choose it (Public works) through the DOM, the confirmation
  drew ("Choose Public works? Price: the Gold, every turn it runs ... It leaves: the builds themselves. Confirm
  Cancel"), its Confirm sent the request and the line read "Sent: crisis response. It goes through at the start of
  next turn; until then you can take it back under Queued for next turn.", with the request listed under Queued for
  next turn. Turn 5: `response:0/depression/public-works/0/request`, the seat's `response` notice, 48 Gold a turn
  into its builds (`0>progress:4800:works`, progress rows on two cities) and `public-works@0=100` in the cycle's
  events; the panel then listed it under "What you're doing" as "until the crisis ends" with an End it button
  (`r7-crisis-world-t7.png`). Relief by queue at turn 5 paid `0>citizens:600:relief` and 24 celebration points a
  turn from turn 6. Deposit insurance by queue at turn 17 cost two turns of income (`0>bond:14600:response`,
  `response:0/depression/deposit-insurance/14600/request`, the notice carrying the 146 Gold) and wrote the
  `deposit-insurance` legacy for the age (the seat is Corporatist, so no carry-over).
- X.5, the End it path: at turn 16 the drive pressed End it on the standing Relief card; the confirmation read
  "End Relief? Ending relief while the crisis still runs is remembered: -2 Happiness a settlement for 10 turns."
  and its Confirm sent the request. Turn 17: `response-ended:0/relief`, the `relief-ended` legacy to turn 27 and
  `-1200:relief-ended` on the celebration meter each turn (2 Happiness a settlement, six settlements); turn 27 the
  `legacy-ended:relief-ended` notice. The first crisis's cancel at turn 9 landed after Relief had run out on its own
  (`response-ended` and `refused:0/not-running` on the same turn, no mark), which is the rule.
- X.4: the whole Modern menu drew in a three-column grid: Public works, Bank holiday, Deposit insurance (158 Gold
  now), Off the gold standard, Price supports, Confidence, each with its history line, its Now, Price and It leaves
  facts aligned under their labels, and Austerity below with its caution pill (`r7-crisis-world-t15.png`). The
  Hoover-line marks are the caution colour on Austerity's pill and the price lines in the loss colour.
- X.6: the Fiscal tab's "What your choices left" with its subtitle on the heading line, then "Rearmed, Your
  neighbours noticed the army you raised in the slump, 16 turns left", "Relief ended early, -2 Happiness a settlement
  while it lasts, 8 turns left" and "Deposit insurance ... for the age" (`r7-legacies-fiscal-t19.png`); the section
  stays away while the seat has no legacy (`r7-fiscal-t12.png`).
- X.7, the AIs' picks with the war rule off: `atWar` read false for all six civs at turns 1 to 4 (the fifteenth run
  read true). All five AIs still took Rearmament at turn 2, this time by preference: every AI reads Corporatist at a
  Modern start and Rearmament is that system's first preference in the catalog. In the second crisis, with
  Rearmament used for the age, Persia, the Ottomans, Hawai'i and Dai Viet took Deposit insurance (202 to 328 Gold,
  `response:1/depression/deposit-insurance/32808/ai`) and Goryeo, whose dues passed its income, the Bank holiday
  (`bank-holiday@4=200`, the legacy to turn 33). In the Credit panic at turn 24 four went off the gold standard
  (`debts-cut:1/1440` and the rest, `gold-standard@1=100` each turn) and Goryeo took Deposit insurance.
- Rearmament (ddb9cc7): each rearming civ paid a Gold a settlement a turn to the cycle (`1>cycle:600` to
  `5>cycle:600` every turn from turn 3 to 11, six settlements each; `0>cycle:600:rearmament` for the seat from turn
  15 to 25). The turn the seat took it, the three civs whose capitals lie within 20 plots lost a level with it
  (`rel 2~0:-1 4~0:-1 5~0:-1`; Persia and Hawai'i farther off, untouched) and the seat's `rearmament` legacy ran to
  turn 35. The World tab's "What moved it" read "rearmament (Heian Japan) +0.005" each turn, and from turn 18 "the
  Bonus Army marching" for every civ.
- The crisis panel's turns pill read "2 turns in" at turn 4, "5 turns in" at turn 7 and "3 turns in" at turn 16;
  on a crisis's first turn it still read "1 turns in". Fixed after the run: `LOC_ECONOMICS_CRISIS_TURNS` and
  `LOC_ECONOMICS_CRISIS_TURNS_LEFT` carry the game's plural construct, so the first turn reads "1 turn in" (not
  watched; X.14).
- Noted again: invariant econ-3 fired once at turn 5 (`4:327684`, two development-loan progress grants on one
  Goryeo city), the same line as the fifteenth run, outside the crises code. No other error line in `UI.log`. Fixed
  after the run: `openInvestment` joins a second investment in the same city on the same turn to the first progress
  row, as the AI build loan and public works already did (tested; the invariant line should stay out of `UI.log` on
  the next run, X.15).
- Not reached: Antiquity's and Exploration's menus (X.2, X.3); the bank holiday on a seat loan (X.8); the bank run
  (X.10); the Civilopedia pages (X.11); the option Off (X.12); tribute's doubled bills (X.13).

## Owed: crises and responses (2026-10-31, unreleased)

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| X.13 | Tribute's doubled bills on the Trade tab: while the tribute legacy runs, the payer's Trade tab shows its bill to the levier at twice the plain figure, the same bill the batch sends (2026-11-04, run `2026-11-04T14-35-06`: the levy and the doubled settlements were watched, but `tradeView` in `ui/econ-view-commerce.js` builds the tab's bills without the crisis or system terms, so the payer's tab read "you owe 36, pay 12" while the batch charged 70 and sent 46; and the levy turn's bill settles before the response, so 9 of the 10 turns came out doubled; see "Watched 2026-11-04 (X.13)") | Antiquity 4242, a Tribute-system civ in a debt crisis with a weaker Unfriendly importer, after the tab fix | `ui/econ-view-commerce.js` `tradeView`, `ui/econ-commerce.js` `tradeTermsOf`, `ui/econ-plan.js` `proposeStep` |
| X.16 | A press on a top-bar pill opens the screen where the matter is (140f29e, tested, not watched): the debt pill on the Loans tab, "In default" on the loan in trouble, the phase pill on the World tab's cycle or on the Crisis section in a crisis, the inflation pill on the World tab's inflation; a press with the screen already open moves it there; each pill's tooltip says where it goes. A scripted `action-activate` on `.econ-bar-pills .econ-pill--press` covers the wiring; a press by hand through the game's input is the part only a person can watch (2026-11-02, run C: each pill's action event landed the screen on its tab and card; the press by hand is owed) | Modern 4242, the usual set, the index pushed to 0.70 and a seat loan written in default | `ui/econ-pills.js`, `ui/econ-dock.js` `pillRow`, `ui/econ-screen.js` `openScreen`, `landOn` |
| X.18 | The cycle dial's tooltip, hovered: its four bold headings on their own lines (the `[B]` and `[N]` markup rendered, not shown raw). The text itself was read 2026-11-11: the player's index and phase, the world's, and "At 1.00 it neither pays nor charges you" at 1.00 | any game with the cycle on, the World tab, hover the dial | `ui/econ-view-instruments.js` `cycleTip`, `LOC_ECONOMICS_GAUGE_CYCLE_TIP` |

## Owed: the build loan as a want (2026-10-31, unreleased)

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

## Owed: AI plan stage D

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

## Owed: AI plan stage C

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

## Owed: AI plan stage B

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

## Owed: AI plan stage A

Built 2026-10-31 (commit `2b99755` and the dues fix). The rules above were watched; these weren't. The AI's aid
clearing a default to the giver (A.1 here before) was watched in the ninth run.

A.3 watched 2026-11-04 (see "Watched 2026-11-04 (Antiquity 4242 ...)").

## Owed: whole-Gold payments

Built 2026-10-31 (NOTES 119). The engine fact was watched that day; the fix itself hasn't been seen in a game.

WG.1 watched 2026-11-04 (see "Watched 2026-11-04 (Antiquity 4242 ...)").

## Owed: Spoil Guard

Built 2026-10-31, offline only (`ui/econ-spoil.js`, `ui/econ-options.js`). Nothing here has been seen in a game.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |

## Owed: ui-pass

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| U.1 | A controller: the tab bar's bumpers change tab; accept on a button, chip or stepper step presses it (they're `fxs-activatable`); focus shows on chips and steps | any, a controller | `ui/econ-dom.js` `control` |
| U.2 | Escape closes the screen | any, a person at the keyboard | `ui/econ-screen.js` `onEngineInput` |
| U.3 | Hovering a chart's turn shows that turn in the readout under it; hovering a figure shows its tooltip | any, a person | `ui/econ-dom.js` `lineChart` |
| U.8 | The screen at 1280x720 and at a 4:3 window: one column, nothing cut off | window sizes | `ui/econ-screen.css` |
| U.9 | The turn notification itself in the train, the opening sentence first (the lines were read from `UI.log`, the notification wasn't opened) | any | `ui/econ-notify.js` |

## Watched 2026-11-04 (standing Gold lines and the Markets tab, Exploration 9001, every other mod off)

Run `2026-11-04T18-23-11` (moved to tp-share, `Mac offload 2026-11-04/tower-bench-runs/`, reads in `sl/`): Exploration
seed 9001, `--setup fast --quick`, the Economics working copy alone, turns 1 to 5 without Autoplay. Script help: three
loans written into the ledger at turn 1 (Silla to Persia, the bond market to France and to the seat). The AIs repaid
theirs at once and then borrowed on their own (Pirate Republic from Silla, Persia from Sengoku, Pirate Republic from
France), so the lines below come from the AIs' own loans. Captures in `working_screenshots/econ-lines-2026-11-04/`.

- Placement, after a fix: the first batch's CREATE_ELEMENT requests, sent at TurnBegin, were all dropped (five
  requests logged, no marker in any capital); the same request sent by hand during the seat's turn landed at once. The
  batch now keeps the wanted lines in the glue and the markers go up 0.8 s into the local player's turn, and on a load
  that opens on that turn (`placeLinesNow`, `econ-bootstrap.js`). Watched after a UI reload: at turn 3 Rome held
  DEBT 4 + 2 (its 6 Gold due), Persia DEBT 8 + 4 + 1 and its lender Sengoku LOAN 8 + 4 + 1 (13 each side), and at
  turn 4 Pirate Republic DEBT 2 + 1 with France LOAN 2 + 1.
- City Details: Rome's Buildings tab lists "DEBT SERVICE: -2 GOLD" and "DEBT SERVICE: -4 GOLD" under the Palace
  (`city-details-rome-buildings-crop.png`). The capitals' Gold breakdowns name each line: Persia's under Deductions
  ("Debt service: -8 Gold = 8.00", "Debt service: -2 Gold = 2.00"), Sengoku's under Income ("Loan repayments: +8 Gold
  = 8.00", "+2"). Read by script, not captured as a hover.
- AI income: Rome's Gold per turn read 9, then 3 the moment its 6 Gold of lines landed; Pirate Republic's 13.1, then
  10.1 with 3 Gold (`Player_Treasury.csv` turn 3 and 4 the same).
- Balances: for every AI with lines, the balance after the batch equals the snapshot plus the payment to the cent,
  with the lines counted back (turn 4: Persia engine -1300, grant -9600; Sengoku +1300, +10700; turn 5: Pirate
  Republic -300, France +300). The seat's balance runs ahead of that by its own Gold per turn, which lands after the
  batch on the human's turn; it did the same on turns 2 and 3, before any lines stood. No "invariant" line in `UI.log`.
- A loan closing: Persia repaid Sengoku's loan at the turn 4 batch and both capitals were empty of lines on that turn.
- Positive lines land short in some AI cities (a finding, not fixed): a Debt service line sits under Deductions and
  charges its face value; a Loan repayments line sits under Income, which the game multiplies by the city's Income
  share. In France's and Silla's capitals a +4 line paid 3.6 (France's children 12, its Income 10.8), in Persia's
  about 0.98, in the seat's 4. Economics counts the face value back, so such a lender ends about a tenth of its line
  short each turn. The multiplier isn't a line in the breakdown.
- Markets tab: the opening note ("These are Economics' own world prices; the game itself doesn't price resources..."),
  the "Economics" tag under Price, and Horses opened by script to "Target 8.7 Gold = 5 base (Treasure resource) × 1.73
  scarce (6 civilizations, 2 copies)", the pace line, "You don't trade it", five levers, and the chart with the Price
  and Target lines and a mark at turn 2 whose hover read "1 more copies in the world" (`markets-horses-open-2000.png`).
  The plural is fixed in the text since (`{1_Count : plural ...}`), unwatched. No raw LOC key on the tab. The board
  lists two rows named Gold (12.3 and 6.5) and two named Silver; they're different resource types with one name.

## Watched 2026-11-04 (X.13, Antiquity 4242, AI levier)

Run `2026-11-04T14-35-06` (local disk; tp-share wasn't mounted): Antiquity 4242, the Economics and Partisans working
copies, every other mod off, `--quick`, `lab drive` under Autoplay to turn 130. Reads and scripts are in the run
folder's `x13/`. Script help: at turn 99 to 117 seat towns (Sagami, Heijo) and merchants placed to look for a second
importer (below), and at turn 118 a defaulted 200 Gold loan from Goryeo written into Persia's ledger. Nothing else was
forced: Persia was in Despotism on its own, Unfriendly with Hawai'i since about turn 80, and stronger (12 combat units
to 4).

- The levy: Persia's debt crisis opened at turn 119 and its AI took Tribute that turn ("response ... source ai"; a
  queued request for the same response was refused as "once"). Hawai'i paid `TR3-1` 114 Gold, two turns of its 57
  income, and booked 10 grievances against Persia. The legacy row read `tribute`, civs `[3]`, turns 119 to 129.
- The doubled bill: the batch's own terms put Hawai'i's bill to Persia at 35 cents gross, owed 70 with the legacy and
  35 without; Persia's bill to Hawai'i stayed 24 and Goryeo's to the seat stayed as it was. The netted settlement
  `B3-1` went 5 (turn 119) to 50, 48, 49, 47, 47, 46, 46, 46, 46 (turns 120 to 128) and back to 11 at 129 when the
  legacy ended. On the levy turn the bill settled before the response was taken, so 9 settlements came out doubled,
  not 10.
- The Trade tab doesn't show it. `tradeView` read for Hawai'i "they owe 24, you owe 36, pay 12" on every turn of the
  legacy: it builds the bills without the crisis terms (and without the system terms, 36 against the batch's 35), so a
  payer seat would see a third of what it pays. The file's header says the tab shows the bill the next batch sends.
- No second importer of Persia could be had. Persia and Hawai'i share a landmass the other four can't reach in
  Antiquity (units and towns placed there for them never landed). In the east the AIs ignored merchants placed in
  valid target cities, all but Goryeo, which took one at once (`4<0`, turn 107); Greece and Dai Viet walked theirs
  away, and the seat's own route to Greece (by `MAKE_TRADE_ROUTE` from the target city) ended at turn 118 when the seat
  went to war with Greece and Dai Viet. The control is the reverse bill and the other pair, both unchanged.

## Watched 2026-11-04, last runs (Modern 4242 with the usual set, its control, old saves, four soaks, Antiquity into Modern)

The working copies of Economics and Partisans in `Mods/` (Economics' debug switch on, as in the tree). Scripts, samples
and each game's `UI.log` are in `2026-11-04T06-54-20/last/` with the run folders on tp-share. Everything forced is
logged in the samples' "acts" column.

Run `2026-11-04T06-54-20`: Modern 4242, the usual set (the owner's enabled mods, the local Economics and Partisans
copies in place of the Workshop Partisans), `--quick`, 66 turns without Autoplay, sample `g1.js`. Script help: the six
civs met through placed scouts (removed the next turn); the seat set to Authoritarianism with Modernization granted and
War Levy slotted at turn 1; Political Theory and its two prerequisites granted at 13 (the Democracy branch grant at 5
needed it), then the Democracy branch at 13, Fascism at 22, Communism at 25; the Ottomans and Dai Viet read as allied
and Dai Viet as Democracy through a `Players.get` wrapper (the engine refuses alliances and ideology changes for an AI
from the UI); Hawai'i given two bond loans (a third of its income at 2, then 1.5 times it at 13) and its treasury taken
down to 5 Gold whenever it passed 40 on turns 3 to 30 (B.3); a Persian loan to the seat repudiated at 3 (6.6); two
defaulted loans from Persia written in and the world index set to 0.70 at 11, again at 34 and at 47 (crises are 30 turns
apart). Run `2026-11-04T07-19-38` is its control: the same script with `ECONOMICS_AI_OFF` and no repudiation, 60 turns.

- M.26: with Authoritarianism and War Levy at peace the capital's Gold read "War Levy=2; Corporatist economy=6" and its
  Happiness "War Levy=1; Corporatist economy=3". The turn after the Democracy branch (13) the Corporatist lines were
  gone (Gold 27, Happiness 34) and the seat read Market. The turn after the Fascism branch (22), still at peace,
  "Corporatist economy=6" and "=3" were back: those are the branch root's rows. The turn after Communism (25) the seat
  read `IDEOLOGY_COMMUNISM`, system Planned, phase "outside" the cycle. `getChosenIdeology` follows the last branch
  granted.
- F.3, M.29 (seat): once the capital had a build still open at the batch, each turn the plan sent `PL0` 8 Gold to the
  plan account and `UI.log` had "progress 2 on 0:65536 (PL0)" (11 turns, one line a turn for its one city); 4 Gold a
  point. A 4-Gold take gave 1 point. The Fiscal tab read "The plan this turn 8.4" with the note "A fifth of your Gold
  income goes into your cities' builds, split by population, at 3 Gold a point of production." The price half is in run
  `07-44-22` below.
- E.2: in this game (Ottomans allied to Dai Viet) the Ottomans' stake in Dai Viet went from 6.3 to 12.3 and their first
  investment went to Dai Viet (I1, turn 3). Dai Viet was the richer of the two neighbours, so run `07-44-22` repeated
  turns 1 to 5 with the Ottomans allied to Goryeo instead (income 86 against Dai Viet's 130, both at a base stake of
  6.3): the stake in Goryeo went to 12.3 and the first investment went to Goryeo (I1, turn 3).
- X.10: Persia took the bank run at 12 (`bank-run` event, Depression, two defaults). At 13 its own L went from -24 to
  -169: the decay to -19, the turn's Rearmament +50 and the bank run's -200, against +31 without it. The -0.02 lands on
  the lender's own index the next turn.
- 6.6 (P16): Persia's relationship with the seat went from 0 to -9 the turn of the repudiation and sat at -15 to -32 for
  the rest of the 66 turns; in the control (no repudiation) it sat at +10 to 0 for 30 turns, then drifted to -17. Persia
  declared no war on the seat in either game. One pair of games and no war: inconclusive, as the row allows.
- B.3: Hawai'i's Gold factor read 4.54 to 3.19 on the first loan and 5 on the second; its army and expansion budgets
  read 0.38 and 0.25 on turns 14 to 18 and 0.25 on 27 to 29, while it ran short. Against the control the builds differ
  (a Settler started at 14 and a 7th city at 21, a Cuirassier at 24 where the control built a Harbor), but its army
  didn't shrink: 22 to 23 units in those windows against 21 in the control, 26 to 30 later against 20 to 24. Over these
  windows the 0.25 budgets don't show as fewer units or less settling. The Gold balances parted from 18: Hawai'i sat at
  -9 to -246 under the factor against -63 to +96 in the control.
- 7.3: Partisans has no read of the `TRADITION_ECONOMICS_*` cards; its misery check reads
  `city.Happiness.netHappinessPerTurn` (`ui/pt-engine.js`), so the tax cards reach it through each settlement's
  Happiness. AI settlements under Light read "Light Taxation=3" in their Happiness. The seat's own swap to Heavy at 31
  and 37 came back "no-swap" (`canSwapCultureSlot` false, the Fiscal tab: "The game isn't allowing a policy change right
  now."), so no card change on the seat was read.
- Invariants: no "invariant" line in either game's `UI.log`. An AI's reduced-cost Public works showed `PWB5` (bond to
  Dai Viet, 29.76 Gold) beside `PW5` (48 Gold to progress) on turns 12 to 25, and `PWB3`/`PW3` for Hawai'i's New Deal at
  48 to 53. Goryeo's Diversionary war at war with the seat (it declared at 49) paid `PLA4-48-4`, `PLP4-48-4` and
  `PLM4-48-4` each turn; Off-book bills' one grant used `PL4-48-8` and a legacy's production `PLPLG4`, each once a turn.
- Found: the Economics notice "Your LOC_ECONOMICS_REQUEST_POLICY was refused: none of your settlements is building
  anything." `LOC_ECONOMICS_REQUEST_POLICY` has no text row (the policy request's name).
- Found: the Fiscal tab's plan note says 3 Gold a point; the plan buys at `GOLD_PURCHASE_MULTIPLIER` (4 here, 2 with the
  test mod), and its "The plan this turn" shows the fifth of income (8.4) where the take, in whole points, was 8.
- Also seen, 5.5's war half: when Goryeo declared war on the seat (49) the capital's Gold read "War Levy=2; War Levy=6"
  and its Happiness "War Levy=1; War Levy=3", the card's +8 and -4; the war hadn't ended when the game stopped.
- The seat's celebration prep at 55 overshot (its Happiness had fallen to 0 in the war) and it started celebrating; the
  Fiscal tab then read "Next celebration you're celebrating now". The "next turn" line is in Antiquity below.

Runs `2026-11-04T07-38-07`, `07-39-35` and `07-42-17` built the old saves, each with its commit installed from a
temporary worktree (`d1245a8` 0.5.4, `90e22f4` 0.5.0, `a6fab13` 0.5.2) and the C.31 test mod in `Mods/`: the 0.5.4 save
with Goryeo in default to the Ottomans and the seat repudiating a Persian loan, with a 3% bond loan of its own; the
0.5.0 save with the five AIs' tariffs written at High; the 0.5.2 save in Antiquity with the seat's Moneylending and
Public debt stages set. Run `07-44-22` (the working copy and the test mod) loaded each one.

- D.3: the 0.5.4 save loaded with `creditRep` rows the seat at 7000 (the repudiation, 0.70) and Goryeo at 8000 (the
  default, 0.80); the seat's bond loan kept 3% and the other loans their rates.
- U.5: the 0.5.2 save loaded with the Loans tab and both loan sections taken as told, and no notice about them on the
  load turn or the next. With Trade and Coinage set at 7, turn 8's notice read "Economics: the Markets and Trade tabs
  are open. ... | Economics: the World tab is open. ..."
- TD.6: the 0.5.0 save's five High tariffs stood at the load (turn 4). The next turn four AIs eased off (`tariff-eased`,
  they were Friendly); at 7, the first change the 5-turn limit allowed, three went to None and one to Low, and Goryeo to
  None at 8. None went back to High in the 26 turns after the load (Low at most). They drop well before 20 turns.
- C.31: the test mod (`econ-c31-test`: a Counting House copied from the Stock Exchange with the Gold tag and 6 Gold, the
  Department Store moved from the Trade tag to the Gold tag, Dates removed, `GOLD_PURCHASE_MULTIPLIER` 2) read through:
  the Counting House as Commerce, the Department Store as Commerce and not Trade, 54 resources in the Markets list and
  no Dates. Both placed in the seat's capital at 2: at 3 the seat read 1 Commerce settlement (0 before) and depth factor
  97 (100 before), and the capital's Trade count stayed 1.
- F.3's price: with the multiplier at 2, `params.goldPerPointCents` read 200 and the seat's plan sent 2 Gold for 1
  point.

Four soaks, every other mod off, `--setup fast --quick`, `lab drive` under Autoplay with the read-only sample `soak.js`:
run `2026-11-04T07-52-35` Antiquity 4242 with every part on and Inflation On (119 Antiquity and 25 Exploration turns);
run `08-05-10` the same seed with Inflation, Business cycle and Economic systems Off (118 and 29); run `08-16-53`
Exploration 9001 with the default options (100 turns); run `08-28-37` the same with Markets, Tariffs and Foreign
investment Off (100 turns).

- C.33, M.33: no crash or hang in the four. `lab drive` stopped once in each Antiquity soak at the age change with "the
  local player is out" while the seat was alive (two cities at Exploration turn 10); a second drive went on. The earlier
  soak's "knocked out at Exploration turn 8" was the same stop. No "invariant" line in any soak's `UI.log`; the errors
  are the game's own `unit-flags.js` "Expected this.unit to be non-null".
- M.33, every part on: the index ran 0.888 to 1.057 in Antiquity and 0.923 to 1.061 in Exploration; systems went from
  Mixed to Civic market (Tribute for civ 1) in Antiquity and Manorial, Religious and Mercantile in Exploration; the
  inflation rate stayed 0 (no Public debt stage reached), so no erosion; AIs opened 24 loans and closed 24 (40 early
  repayments), no default, one debt crisis (civ 2, which took its Programme). Cycle Gold per civ over the soak: -5 to
  -29 Gold. With the three parts Off: the index sat at 1.00, all six civs Steady and Mixed, one loan opened in 147
  turns, no crisis, the trade bills still paid.
- M.33, `tower-bench cost tower-economics --yes --turns 20 --seed 4242 --replicates 1 --age AGE_ANTIQUITY` (report
  `cost-2026-11-04T09-11-29.json`): 1202 ms a turn off against 1201 on (noise 23 ms, so no cost it can tell), the
  game's memory 143 MB higher with Economics on and its UI heap 1.9 MB higher, error lines the same.
- M.34: every part on, the Antiquity soak's civ-turns were Steady 71%, Boom 15%, Slump 13%, no Depression; the
  Exploration soak's were Slump 66%, Steady 34%, no Boom. In play the world doesn't lean to Boom the way finding P's
  simulation did; Exploration leaned to Slump.
- C.33: with the defaults, Exploration routes went from 0 to 19, the AIs made 8 investments (4 open at most) and 5
  closed, civs 3, 4 and 5 received 168 to 280 Gold of dividends and civ 1 paid 660, trade bills ran -71 to +84 Gold a
  civ over the 100 turns, 19 loans. No AI set a tariff in 100 turns. With Markets, Tariffs and Foreign investment Off,
  no bill, investment or tariff; the routes the game itself held at turn 101 (counted with `readRoutes`) were 12 against
  19 in the default game; the index ran 0.799 to 1.023 (Slump 75%, Steady 23%, Depression 2%), seven crises (six
  Depressions, one debt) against none, and cycle Gold ran -537 to -840 a civ against -245 to -787.

Run `2026-11-04T08-40-32`: Antiquity 4242, every other mod off, `--setup fast --quick`, Antiquity turns 1 to 37
without Autoplay (sample `g2.js`), then `lab drive` under Autoplay into Exploration and Modern. Script help: the seat's
capital founded and three towns placed at turn 1, Chiefdom granted, Classical Republic set at 2; the nearest AI (5) read
as Despotism through a `Players.get` wrapper; scouts placed so civs meet (turns 1 and 3); the index set to 0.70 at 5 and
held until Liturgies had run; the seat's Influence set to 300 for Liturgies, then emptied on four turns; for X.13 a seat
merchant at AI 5's capital, a seat town 5 plots from it, three warriors for AI 5, a defaulted Persian loan to AI 5 and
the seat and AI 5 set Unfriendly (turn 6), Currency, the Wheel, Sailing and Code of Laws for the seat (8); Happiness
granted at 36 for the celebration line; the index, its history and the cycle's war list set for F.9 (below).

- A Programme short of Influence: Liturgies ran from 7 (rid `0-6-1`). With the seat's Influence emptied, turns 9 and 10
  paid `PLA0-6-1` (administration, 0.30 Gold) and `PLR0-6-1` (arrears, 4 Gold, then 6) on the same turn, with the
  notice `policy-arrears`; no "invariant" line in `UI.log`. With 24c's Modern half (run `06-54-20`), the per-card ids
  hold in both places the debt-3 line came from.
- F.9's celebration line: with 25 Happiness left to the next celebration and the seat at 0 a turn, the Fiscal tab's
  Light Taxation row read "Happiness a turn, against now +30 ... Next celebration next turn" (turn 37).
- F.9's war count: on Modern turn 27, with two AI pairs able to declare (`canDeclareWarOn` answers `{Success: true}`)
  and the seat in Boom, the index put at the Boom line (1.0556 with the seat's L at -36, the turn before at 1.0956) and
  civ 1's wars on civs 2 and 3 declared that turn; the next notice read "Business cycle: Steady, after 2 wars declared
  and credit growing fast." In Antiquity two AI pairs couldn't be had (the AIs had met in three pairs, and an AI's
  `forceDeclareWar` on the seat didn't take that turn); one war there gave "Business cycle: Slump, after a war declared
  and the world's income growing slower than usual." (turn 35).
- X.13: not watched. AI 5 (read as Despotism) took Tribute when the Depression opened (turn 6) and found no payer: the
  seat read Neutral at -9 and all six civs' strength read 0 (no combat units yet). The seat's merchant couldn't open a
  route: the engine answered "No Trade Routes currently possible", `getNearestCityInTradeNetwork` found no seat city in
  the network, with the seat town 5 plots from the target and Currency granted. AI 5's own route from the seat showed at
  Antiquity turn 112, and the age ended at 113, before a seat crisis and its Tribute could be set up.
- M.21: at the move into Modern, Antiquity Markets and Lighthouses read 0.50 for Commerce and Trade in each civ that
  had one (civs 2 and 5 still had a Market at 1.0 in Exploration, cut to 0.50 at the transition). Read through
  `readEconomy` on the mod's own turn count (`glue.turns.base` 233), the same buildings weigh 0.50 on Modern's first
  turn, 0.45, 0.40, 0.35, 0.30 and 0.25 on the sixth, and 0.25 at turn 25. (The per-turn sample passed `Game.turn`,
  which starts again each age, so it showed 0.50 all through Modern; the mod's own reads use the counted turn.)

## Watched 2026-11-04 (Antiquity 4242 soak, three forced games, every other mod off)

Four lab games on the working copies of Economics and Partisans (copied into `Mods/` before the first launch), every
other mod off. Run `2026-11-04T06-03-40`: Antiquity 4242, default options, `lab drive` under Autoplay with nothing
forced after setup, 139 Antiquity turns and 8 Exploration turns, read-only sample `soak.js` (it also wraps
`Players.grantYield` to record the mod's own Gold calls). The seat was knocked out at Exploration turn 8, so the soak
stopped there. Run `2026-11-04T06-24-59`: Antiquity 4242, turns without Autoplay, sample `g2.js`; the seat founded its
capital and got three towns at turn 1 (`CREATE_ELEMENT`), Chiefdom granted and Classical Republic set, scouts placed
by the AI capitals to meet them, Moneylending written into every civ's stages at turn 3, the seat read as Despotism
through a `Players.get` wrapper for A.3, AI 1 given two towns at 27, the index set by script for F.9 and held at 0.50
from 22 to 43. Run `2026-11-04T06-35-41`: Exploration 9001, Economic swings Gentle and Business cycle Mild, sample
`g3.js`. Run `2026-11-04T06-38-23`: Modern 4242, sample `g4.js`. Scripts, samples and each game's `UI.log` are in the
run folders on tp-share (`aq4242/`).

- F.5: Greece lent the seat 30 Gold over 20 turns at 1.5% (L1, turn 7, `ratePpm` 15000); the notice read "A loan of 30
  Gold from Greece has landed, at 1.5% a turn over 20 turns." `civOffers` asks the lender for Moneylending
  too, and in the soak the AIs reached it only at turns 140 and 141, which explains the 11-02 refusals at turn 89.
- A.3: with the seat read as Despotism (Palace economy at 8, so civ lenders only) and a 2-turn loan it couldn't pay
  injected at 9 with its Gold at 0, the guard borrowed from Greece on 10 (L3, 6.4 Gold over 10 turns at 1.56%) and 11
  (L4, 8.9 Gold), and L2 closed at 11 with no miss. The notice: "Your payments of 17.6 Gold passed what you had, so the
  guard borrowed the 6.4 Gold missing from Greece over 10 turns."
- HP.1: the seat's Code of Laws came at 40 and Heavy Taxation unlocked on that turn (`isTraditionUnlocked` false at
  39, true at 40); Light was held by AIs from 22. HP.2: Heavy unlocked for each AI on its own Code of Laws turn (1 at
  70, 2 at 53, 3 at 63, 4 at 62, 5 at 65), and four AIs slotted it after that: 5 at 65, 4 at 69, 1 at 70, 3 at 85.
- WG.1: the mod's Gold calls to each civ were whole Gold on every turn (139 turns), and on each turn they equalled the
  batch row's `paid` except turn 98, whose batch ran late and landed with 99's. Over any 10 straight turns the paid
  sum and the net sum differ by the carry at the window's two ends (at most 1.93 Gold, under 1 Gold from the game's
  start). AI purchases can't enter this read, since it counts the mod's own grant calls.
- SW.2: Volatile with nothing forced ran from 0.918 to 1.073 over 139 Antiquity turns (Slump 127 civ-turns, Boom 83,
  Steady 624), so in Antiquity the index stays inside 0.85 to 1.07 except one touch of the top; no Depression and no
  Panic. Pushed once to 0.60 in Modern, momentum took it to the 0.50 floor, then 0.55, 0.64, 0.75, 0.86, 0.95, 1.03
  and an overshoot to 1.115 by turn 18.
- SW.3: after that push, the five AIs ran a 5-turn Depression (9 to 13) with no miss or default and every balance above
  0 (lowest 18 Gold). In the Antiquity game held at 0.50 for 21 turns, no AI missed a payment and no balance went
  below 0 (lowest 22 Gold; the AIs had been topped to 1500 at turn 9 for A.3).
- SW.5: Gentle and Mild read in the options. E set to 1.10 at turn 4: the Panic at 5 took it from 1.090 to 0.990,
  0.1, and the next turn moved only by the reversion (0.990 to 0.991; Volatile would have carried 0.08 more). With
  `lastPanic` 59 turns back no Panic came; at 60 one did (turn 10). E set to 0.60 came back at 0.70. The seat's cycle
  Gold was 20% of (index - 1) times income: -1.62 Gold at index 0.6995 on 27 Gold.
- C.30, by building: through the age change, the Antiquity Market and Lighthouse read Trade only in Exploration's data
  (`readBuildings`: `MARKET[T]`, the Market has no tags there), and the role memory (`glue.roles.BUILDING_MARKET`
  "ct") puts Commerce back, so the Treasury and depth count them as Commerce and Trade. On an Exploration start there's
  no memory: Markets and Lighthouses count as Trade only and every civ reads 0 Commerce settlements. A Modern start is
  the same for Exploration Banks (`BANK[T]`, memory empty).
- M.21 (Banks), M.22: on the Modern start, with Capitalism written into the seat's stages at 4, its Bank's Trade
  weight went 0.95, 0.90 and on by 0.05 a turn to 0.70, other civs' Banks stayed at 1.00, and the legacy and cushion
  grew 500 bp and 5 a turn (`cush` 5 to 30). With the Bank's Exploration roles put in the memory ("cbt") and
  Capitalism cleared, the seat's depth read factor 96 and depth turns 2; with Capitalism back at 20, depth turns fell to
  1 the next turn and the factor went 96, 96, 97 as the Commerce weight faded (0.95, 0.90, 0.85).
- F.1: the 107 income events of the soak each match the world income series against the trend before the turn (step
  of 5 points, capped at 0.01), with no mismatch. The World tab (seat given Coinage at 66 to open it) listed "67: the
  world's income growing faster than usual +0.005", "64: ... slower than usual -0.005" and "63: ... -0.010", the
  logged weights 50, -50 and -100. Notices through the soak read "Business cycle: Slump, after the world's income
  growing slower than usual." and "Boom, after the world's income growing faster than usual."
- LA.5: the seat as Feudal Monarchy holding Light (Exploration start, Economics civic granted): its capital's Gold read
  "Manorial economy=1" under income and "Light Taxation=1" under deductions, its Happiness "Light Taxation=4".
- Found, F.9: on two AI declarations on the seat in one turn (65) the notice read "Business cycle: Slump, after Slump
  wars declared." `composeLines` in `ui/econ-notify.js` passes `(key) => loc(key)` to `composeArgs`, which drops a
  counted cause's number, so the outer `{1_Phase}` fills `{1_Count}`. The Treasury's history passes `api.loc` and is
  fine. The two AI-AI wars of turn 20 didn't reach a notice, since the seat was already in Slump.
- Found: `UI.log` has "invariant debt-3 on turn N: PL0-23-9:N" on each of Liturgies' three short turns, and
  "PL4-15-1" for an AI's Programme in arrears in the Exploration game: `econ-arrears.js` and `econ-policy.js` both emit
  `PL<rid>` in one turn. The charges landed.

## Watched 2026-11-04 (Exploration 9001, Inflation On, every other mod off)

One lab game, run `2026-11-04T05-03-57`: Exploration seed 9001, `--setup fast,ECONOMICS_INFLATION=ECONOMICS_INFLATION_ON
--quick`, the working copies of Economics and Partisans in `Mods/`, plus the AI-NATIVE-LEVERS probe data mod (E1, E3).
Turns 1 to 11 without Autoplay, then `lab drive` and single turns without Autoplay to turn 73. A control game with the
same seed and no probe mod is run `2026-11-04T05-42-53` (41 turns). Scripts, drive logs and the game's logs are in the
run folders on tp-share (`ex9001/`); captures are `working_screenshots/ex9001-*.png`. Script help, all of it logged:
a seat route to Sengoku made with a placed merchant at turn 12, Colonialism, Economics, Guilds, Urban Planning and
Imperialism granted to the seat with `GRANT_TREE_NODE`, the other civs met by placed scouts, Sengoku's and France's
Chartered companies stage written into the stage record (the engine refuses tree grants for an AI from the UI, and
Culture pushes never reached Colonialism), Persia read as a Theocracy through a `Players.get` wrapper (the engine
refuses `CHANGE_GOVERNMENT` for an AI), and Rome's three resources taken off the map at turn 34 so the seat imports
more than it sells.

- C.8: from turn 35 the seat paid Sengoku each turn (`B0-3` 0.28 Gold, Sengoku's balance up by the same), the turn
  notice read "Trade bills: you paid 0.3 Gold and received 0 Gold", and the Trade tab "You owe for your imports 0.4,
  They owe for theirs 0, You pay 0.4" (`ex9001-f11-instead-t35.png`).
- C.12: a Bazaar placed in Sengoku's importing city (14,40) showed in the route read the next turn (importer
  buildings 0 to 1) and that route's bill read 74 against 82 without it. The Guildhall placed in Sengoku's exporting
  city at turn 13 showed the same way (exporter buildings 2 to 3), and each building moves the bill 10 points of the
  base. A fourth building adds nothing: the share stops at 30 percent, so the Bazaar placed in a city with four left
  the bill where it was.
- C.14: Sengoku declared war on the seat at turn 58; at 59 the route was gone and the seat's bill line was empty.
- U.6, C.15: before Imperialism (control game, turn 12) the Fiscal tab has no tariff row at all, and its "Opens next"
  line names the Light Taxation card, which comes first. With Imperialism the row reads "Your tariff None" with the
  chips None, Low (10 percent) and High (25 percent); pressing Low showed "Your change takes effect next turn"
  (`ex9001-tariff-low-sent-t32.png`), and after a change the row reads "A tariff can change once every five turns"
  (control, turn 41). A request one turn early was refused `too-soon`.
- C.16: on the live route read, the seat's bill to Sengoku was 39 with no tariff, 35 at Low and 29 at High; the
  transfers moved with it (23 at Low, 19 to 20 at High, Manorial's 20 percent off applied after).
- C.17: with the seat at High from turn 51, turn 56 brought the notice "Your High tariff cost 1 relationship with each
  civilization you import from (1)" and Sengoku's level with the seat fell by 1.
- C.18, F.10: the seat's Low (in force at 46) was answered by Sengoku's Low at 48, and the seat's High (51) by
  Sengoku's High at 53, each a `tariff` event. When the seat dropped to None at 40, Sengoku's answering Low dropped the
  same turn.
- TD.5: Sengoku made Friendly at turn 53 eased off the seat at once (`tariff-eased`, turn 54), but its High stayed in
  the ledger until turn 58, the AI's next allowed change, and then went to Low for another partner. It didn't answer
  the seat's High again. That's the rule as DESIGN 6 states it: a Friendly AI eases off at once, and the level it
  drops to waits for the 5-turn limit like any change (NOTES 115). The old TD.5 row's "drops one it already answered
  at once" was wrong about the level; the item is met.
- C.22: 200 Gold of general investment in Sengoku opened at turn 34 with Sengoku's income at 47.91. The dividend
  followed that income: 5.92 Gold at an income of 31.5, 14.37 at 76.5 and 16.05 at 85.4, against 9.00 flat. Nothing
  was paid on turns 36 to 38 while Sengoku ran Suspend payments.
- M.30: Persia (read as Religious) lent the seat 50 Gold over 20 turns at turn 39, recorded as a partnership with the
  seat's income of 48 as its base. Four knights took the seat's income to 20 and the interest part fell from 0.45 to
  0.21 the next turn, while the bond loan's interest stayed on its flat rate.
- M.16: with 2,505 Gold and a 50-Gold bond loan, the Treasury tab read "Safe from inflation up to 580" and "Lost to
  inflation next turn -9.6", and the `IN0` transfer took 8 to 10 Gold each turn after
  (`ex9001-treasury-reserve-erosion-t34.png`).
- M.14, F.7: the seat holding Banking, heavy bond loans on the AIs and the index at 1.08 started a Panic at turn 24.
  The top-bar pill read "Panic" in the warning colour, the World tab showed the red strip "Panic until turn 29:
  civilizations aren't lending to each other and bond rates are up by half", and "As turns of the world's income 8.2"
  in red (`ex9001-panic-world-t25.png`). The bond market's 10-turn rate went from 1.7% before to 2.8% during, the
  extra above half being the 0.5% inflation. The spacing on the default Volatile swings is 80 turns, not 60 (60 is
  Gentle, as DESIGN 4.11 says): with the boom held and `lastPanic` set so the next batch was 79 turns on, no Panic
  came; at 80 turns on, one did (turn 31).
- F.11: with France and Sengoku in default, the Trade tab greyed their general investment with "they're in default and
  won't take general investment. A development loan on one of their builds is still open to you." and a "Set up a
  development loan instead" button. Pressing it opened "A development loan to Sengoku Japan: 300 Gold into one build"
  with Sengoku's builds at that Gold, and nothing was sent. A general request queued anyway was refused, and the notice
  read "Your investment was refused: they're in default ... You can still put 20 Gold into one of French Empire's
  builds as a development loan from the Trade tab."
- C.25: a development loan into Sengoku's city at 17,36 (turn 50); the seat took the city at turn 72 and the next
  turn I4 closed with 14.85 Gold written off, the notice reading "I4 is closed and the 14.9 Gold still to come is lost:
  the city changed hands or a party is gone."
- D.1: after the seat repudiated its bond loan (turn 42), the Loans tab showed "Credit rating 70" with the value in
  `econ-negative`. The preview for Persia read "You keep 42.5 Gold and stop paying. Achaemenid Persia books a grudge
  of 10 grievances against you and its relationship with you moves -10; 4 civilizations you've met each move -3; your
  credit rating falls to 40; Achaemenid Persia won't lend to you for the rest of this age and the whole of the next;
  your credit limit loses 4 turns of income, and you can only borrow over 10 turns for the next 40 turns."
  (`ex9001-d1-repudiate-preview-t42.png`).
- Found: `UI.log` has "invariant debt-3 on turn N: PW3:N" on every turn of Sengoku's Public works (31 to 35), since
  `econ-crisis-respond.js` sends the bond subsidy and the spend into the build under the same id `PW<pid>` in one
  turn. The Panic test's moved `lastPanic` also let a third Panic start at turn 33; that one is the test's doing.

## W22, 2026-11-10 (the 1.5.1 sweep)

Game 1.5.1 (build 26334429), seed 4242, Economics alone. Three games: Modern with loans on and guard off, Antiquity
driven 40 turns, Exploration driven 20. Prep and restore: `devtools/w22-prep.sh`, `devtools/w22-restore.sh` (0
registry rows differ after). Modern read with `devtools/econ-w22-read.js`.

- Modern, the seat at -3,000 with a bond loan written in, the Ottomans at -6,000, the world index at 0.70:
  - The price premium: the capital's Airfield 4,200 Gold before, 5,376 on the first turn below zero, 5,460 after
    (+30%); back to 4,200 after the bankruptcy.
  - A crisis opened for all six civs the next turn and the five AIs took Rearmament; it ended on turn 18.
  - The Ottomans weighed bankruptcy on their first turn after the warnings, repudiated their bond loan and declared
    (-5,845 to -54).
  - The seat: units disbanded on ramp turns 3, 5, 7, 8 and 9, the capital shut on turn 8 with every marker in place
    (price, gloom, shut). Dai Viet aided the seat in its Depression (660 Gold).
  - The seat's bankruptcy through the Treasury tab's button and Confirm: -2,041 to +113, the capital reopened
    (Production 34 to 66), the price and gloom markers down, the REPUDIATED note markers up, the notification naming
    the bond repudiation and the bankruptcy.
  - Persia set to -500: "Treasury below zero: -2 Happiness" in each of its settlements.
  - AI capitals carry "Debt service: -32 Gold" and "Economy costs: -N Gold" lines; the seat, past its overdraft,
    carried no debt line, as the lines stand only as far as a civ can pay.
- Antiquity, 40 turns: the AIs slotted Light Taxation and War Levy (Goryeo's capital "War Levy" +2 Gold, -1
  Happiness); Coinage opened on turns 34 to 38. The seat, a Classical Republic, slotted Light through `swapTo` once
  the game allowed a swap (turn 45, "no-swap" before): "Light Taxation" -1 Gold, +6 Happiness and "Civic market" +2
  Happiness on its capital.
- Exploration, 20 turns: trade bills each turn, the cycle and the systems, four AI build loans opened, repaid early and
  landed as progress (four `progress` lines), Guild patronage at turn 19. No civ reached Imperialism and no investment
  opened in the 20 turns.
- No `[Economics]` error or invariant line in any of the three games, nothing from Economics in `Database.log` or
  `Modding.log`.

## W21, 2026-11-10 (1.5.1: the Treasury tab below zero)

Game 1.5.1 (build 26334429), Modern seed 4242, Economics alone, guard off. Prep and restore:
`devtools/w21-prep.sh`, `devtools/w21-restore.sh` (0 registry rows differ after). The seat set to -3,000 on turn 11,
with no units that cost upkeep.

- On 1.5.1 the game still resets a negative treasury at the update and the charge-back still puts it back
  ("restore: 0 had -2964, the update wiped it; charged back -2902"); the debt paid down 31 a turn under the interest
  cap (-2,966, -2,934, -2,902, -2,871).
- Fixed and watched: past the overdraft the tab now says so, "You're 2271 Gold past your overdraft. Payments you can't
  cover now go unpaid, every settlement has 15 less Happiness, and everything you buy costs 30% more." On turn 4 below
  zero with no units, the disbanding line was gone (`w21-treasury-past-no-units-crop.png`).
- Two tanks placed for the seat: on turn 5 the ramp disbanded one, and with one left the tab showed the disbanding
  line again (`w21-treasury-with-units-crop.png`).
- Found and fixed: the tanks' upkeep took income from 60 to 45 and the tab worked the overdraft out again at 450, while
  the turn held 600 (`holdOverdrafts`). The tab now uses the held overdraft: "Overdraft 600", "2256 Gold past"
  (`w21-treasury-held-overdraft-crop.png`).

## W20, 2026-11-10 (probe: a strategy keyed on Classical Republic, toward Light Taxation)

Antiquity seed 4242, Economics alone, two 60-turn `lab drive` games (runs `2026-11-10T13-39-33` and `T13-44-15`).
Arm A had `devtools/w20-probe-civic-market.sql` appended to the installed `econ-tax-cards.sql`: a strategy on
`GovernmentMatches GOVERNMENT_CLASSICAL_REPUBLIC` raising a `YIELD_HAPPINESS` bias of 300 (the compiled DB held its
condition). Arm B ran without it. Sampled each turn with `devtools/econ-w20-cards.js`.

- Four of the five AIs ran a Classical Republic from turn 11 in both games (208 AI-turns each).
- Light Taxation held: 17 of those turns with the strategy, 19 without. War Levy: 29 with, 49 without. The two games
  first differ at turn 28 and the picks move about by a turn or a civ either way.
- The strategy didn't raise how often a Classical Republic AI takes Light, as P17 found for the strategy rows at +50.
  Nothing was built from it.

## W19, 2026-11-10 (an AI changes its mind, the bankruptcy named in the turn's line)

Modern seed 4242, Economics alone, loans off, guard off. Prep and restore: `devtools/w19-prep.sh`,
`devtools/w19-restore.sh` (0 registry rows differ after).

- The seat at -1,000 declared bankruptcy (queued by script); the turn's notification opened "Your treasury moved by
  +1002 Gold this turn, from trade bills, the business cycle and your bankruptcy."
- Persia at about 5 turns of income under (+136) carried its debt through its first weighing (-533, -389, -244 on
  turns 1 to 3, one unit disbanded). Ten tanks placed for it by script took its income to +4; on its next weighing it
  declared: staying 1,955 Gold against bankruptcy 300, 240 written off.

## W18, 2026-11-10 (the weighing reweighted, bankruptcy with loans, the confirm card, two older items)

Three lab games, Economics alone. Prep and restore: `devtools/w18-prep.sh`, `devtools/w18-restore.sh` (0 registry
rows differ after).

- The weighing, Modern 4242, loans off: the reads it uses came through for every AI (6 settlements, 15 units with
  upkeep, production 162 to 199). Persia at -828 (5.6 turns of income) on its third turn: the plan input dumped from
  the game and run offline declared it (staying 2,202 Gold against 1,779), so an AI at its first weighing went
  bankrupt from about 5 turns of income under, before any unit or building mattered. Reweighted (`prudence` 2, a unit
  at 1 turn of income, a shut settlement at 1.5 times its share) and deployed in the same game: Persia carried it,
  -693 to +7 in five turns, one unit disbanded; the Ottomans at -1,369 on about +145 (9 turns) carried it too, -1,129
  to -321 over seven turns, four units disbanded and one settlement shut on turn 8, no bankruptcy.
- Bankruptcy with loans open, Modern 4242, loans on: the seat's own borrowing was refused (`service-cap`, income 37),
  so a bond loan (L9, 306 owed) and one from Persia (L10, 204) were put in the ledger by script and the treasury set
  to -1,966. The Treasury tab's "Declare bankruptcy" pressed through its handler (`action-activate`) opened the
  confirm card (`working_screenshots/economics-overdrawn-2026-11-10/treasury-bankrupt-confirm-crop.png`); Confirm
  queued `{ kind: "bankrupt", pid: 0 }` with "Sent: bankruptcy. It goes through at the start of next turn". Next turn:
  the treasury +61, both loans repudiated (written off 306 and 204), Persia's grudge 10 and its relationship with the
  seat -10 to -36, credit -30 twice, and the notification: "You repudiated 306 Gold owed to the bond market. | You
  repudiated 204 Gold owed to Achaemenid Persia. | You declared bankruptcy. ... | Your treasury is back above zero."
  Its first line read "moved by +1968 Gold this turn, from trade bills and the business cycle", without the
  bankruptcy; fixed offline (`FLOW_OF` bankruptcy, "your bankruptcy"), not seen in a game.
- A build point's price (24): AI build loans and a development project bought progress at 3.44 to 3.48 Gold a point
  (L5 340.06 for 98, L7 417.6 for 120, I7 614.19 for 177), one at 3.02 (L4), against the old flat 4.
- An Exploration start (C.30): the seat's Lighthouse, with no roles remembered from Antiquity, counts as 1 Commerce
  and 1 Trade building on the Treasury tab and shows under Old buildings "full until you reach Economics"
  (`exploration-treasury-commerce.png`); the Ottomans' Market counts the same way. The Lighthouse carries the Market's
  data (Economic and Trade advisories, +4 Gold), so the count is the game's own. The Modern half was in W15's
  capture (a Bank: Commerce 1, Banking 1).

## W17, 2026-11-10 (the AI weighs bankruptcy)

Modern seed 4242, Economics alone, guard off. Prep and restore: `devtools/w17-prep.sh`, `devtools/w17-restore.sh` (0
registry rows differ after). Read with `devtools/econ-w17-read.js`.

- Loans on: the Ottomans set to -3,000 and Persia to -1,000 refinanced at once into bond loans (L9 2,170 and L10
  695, `refinance`), so neither stayed deep and no weighing came up. Refinancing comes first, as intended.
- Loans off (a second game): the Ottomans at -2,766 with +139 weighed bankruptcy on their first turn after the
  warnings, turn 14: staying 13,262 Gold against bankruptcy 1,672; they declared, writing off 2,624. Persia at -300
  with +152 was clear in two turns. Then Persia set to -1,100: -960, -819, -673, -514, -351, -167, +22 over seven
  turns, two units disbanded on the ramp (17 to 15), no settlement shut, no bankruptcy.
- Not seen in a game: an AI riding out the units and declaring on the turn its buildings would shut (tests only).

## W16, 2026-11-10 (the interest cap and bankruptcy)

Same setup as W15: turn 11, the seat at -3,000, the Ottomans at -6,000. Prep and restore: `devtools/w16-prep.sh`,
`devtools/w16-restore.sh` (0 registry rows differ after). Read with `devtools/econ-w16-read.js`.

- The cap: every overdraft charge read `capped 1` (the seat 18 then 30 a turn, the Ottomans about 70). Both paid down:
  the seat -2,979, -2,946, -2,914; the Ottomans -5,829 to -5,212 by turn 18. In W15 both sank every turn.
- The seat's bankruptcy: the Treasury tab showed "Declare bankruptcy" under the overdraft rows
  (`working_screenshots/economics-overdrawn-2026-11-10/treasury-bankrupt-button-crop.png`). The request it sends
  (`{ kind: "bankrupt", pid: 0 }`, queued by script, no click) went through at the next batch: the treasury from
  -2,914 to +60 (0 plus a turn's income), Heian-Kyo's Happiness 5 to 20 with the gloom markers down, and the
  notification "You declared bankruptcy. The 2914 Gold you were overdrawn is written off ...". No charge-back after.
  Set below zero again, the tab read "You can declare bankruptcy again from turn 45" in place of the button
  (`treasury-bankrupt-wait-crop.png`).
- The AI: the Ottomans declared on ramp turn 8 (turn 19), before any settlement shut: -5,212 to -50 that turn and +57
  the next, every penalty down (OTTOMANS9 Production 48 to 61, Happiness -7 to 5), and the seat's notification read
  "Ottomans declared bankruptcy: 5068 Gold of overdraft written off and every loan it had repudiated."

## W15, 2026-11-10 (an AI's settlements shut, the Treasury tab's row)

Modern seed 4242, Settler, the Economics working copy alone, guard off. Turn 11: the seat set to -3,000 (+37 a turn,
one town placed), the Ottomans to -6,000 (+116). Prep and restore: `devtools/w15-prep.sh`, `devtools/w15-restore.sh`
(0 registry rows differ after). Read each turn with `devtools/econ-w15-read.js`.

- The Ottomans' ramp: warnings turns 1-2, a unit on turns 3, 5, 7, 8, 9, 10, 11 (15 units down to 9). On turn 8
  OTTOMANS9 shut (Production 48 to 24, Happiness -7 to -15).
- Found: on turns 10 and 11 the plan wanted 2 settlements and only 1 stayed shut. `standingRows` capped every marker
  line at its rungs' sum, and SHUT has one rung. A count isn't capped now (`econ-standing.js`). After the fix, a
  second run of the ramp shut OTTOMANS9 on turn 8 and their capital on turn 10 (Production 75 to 32, Happiness 3 to
  -8), logged "shut for 2: 2 settlement(s)".
- Found: after a UI reload the seat's turn ended before any batch had run in the new session, the restore was off, and
  the Ottomans' -7,343 was wiped to -77. The restore now runs whenever the saved ledger has a last batch. Watched: set
  to -6,000, reloaded, turn ended: "restore: 2 had -6000, the update wiped it; charged back -5826".
- The gloom in a shut settlement: the game's Happiness breakdown listed each GLOOM marker at +8, +4, +2, +1 against
  its -8, -4, -2, -1, alongside the Palace's (or City Hall's), Temple's and City Park's Happiness taken away. Heian-Kyo
  went 20 to 5 with the gloom and to -1 shut: 15 of gloom back, 21 of building Happiness gone.
- The Treasury tab (`working_screenshots/economics-overdrawn-2026-11-10/`): "Settlements with their buildings shut
  down" first read 4, the ramp's number, with one settlement shut (the seat's new town has no building upkeep). It
  now counts the settlements holding the marker, and read 1.
- Seen on the way: below zero the interest outruns income. The Ottomans at about -6,000 with +150 to +200 a turn went
  deeper every turn (-5,870 to -7,926 over 22 turns), and the seat at -3,000 with +64 went -3,044 to -3,745.

## W13 and W14, 2026-11-10 (the debt stays, the ramp, buildings shut down)

Modern seed 4242, Settler, the Economics working copy, guard off. W13 added a probe file with two shutdown markers.

- Shutdown levers (W13, Persia's capital): a marker gating `EFFECT_CITY_ADJUST_SPECIFIC_CONSTRUCTIBLE_MAINTENANCE`
  (class BUILDING, Percent -100) took building upkeep 12 to 0 and net Gold 115 to 127; one gating
  `EFFECT_CITY_ADJUST_CONSTRUCTIBLE_YIELD` (class BUILDING, Percent -100 a yield) took Production 72 to 35.5 and
  Science 28 to 17.3. Both came back when the markers went, except that the upkeep row's Happiness half (YieldType
  "YIELD_GOLD, YIELD_HAPPINESS") stayed off: Persia's University, Shipyard and Wharf read 0 Happiness upkeep against
  3 in other capitals. SHUT uses Gold only; in W14 the seat's buildings read the normal Gold and Happiness upkeep after
  reopening.
- The debt stays (W13): the seat at -60 with +7 and the Ottomans at -500 with +145 were wiped to 0 at each update and
  charged back at once (`restore:` lines), and the Ottomans climbed out from below zero over three turns. The seat lost
  a tank each turn with income at +45 and +61, and the game removed no unit itself (lines at -1,000,000).
- The ramp (W14, the seat at -800 with six tanks and a town): turns 1-2 no unit, turn 2's warning; tanks on turns 3, 5,
  7, then 8, 9, 10; on turn 7 the buildings warning, on turn 8 Heian-Kyo shut (Production 54 to 23, Happiness 5 to -1,
  "The buildings of Heian-Kyo have shut down"). The fresh town had no building upkeep and was never shut. Lifted to
  +2,000, every marker came down: Production 54, Happiness 20, "Your treasury is back above zero ... any shut
  buildings are back to normal".
- Found and fixed in W14: the Ottomans at -130 held read +30 on the batch snapshot, which counts their 160 of debt
  lines back, so they paid no penalty; below zero is now judged on the treasury held (`heldCents`). After the fix they
  went turn 1, 2 (warnings), 3 (a unit). The batch row's `overdraft` and `below` weren't saved; now they are, so a
  reload keeps the held overdraft and the ramp's count.

## W10, 2026-11-10 (what the game does to a treasury below zero)

Four lab games, Modern seed 4242, Settler, every Economics option off so the batch skipped and nothing but the game
moved Gold. Tanks placed by script pushed income below zero (the seat 4 tanks, net -48; the Ottomans 12, net -111).

- A negative balance carries over with no floor. Set to -150 with +69 a turn, the Ottomans went -81, -11, +74. Set
  to +10 with -48, the seat went -38, -86, -134, -182.
- Nothing happens to a civ below zero. Over 4 to 5 turns under zero no unit disbanded, no city's Happiness moved,
  and the only message was one `NOTIFICATION_ADVISOR_WARNING_ECONOMIC`. `NOTIFICATION_BANKRUPT_START` never came.
- The game's bankruptcy lines change nothing. With `GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE` and `_AMENITY_LOSS_LINE`
  at -10 (vanilla), -1000 and +1000, the Ottomans played their turns identically, Happiness per city included; at
  +1000 the seat held 356 to 500 Gold under the line with income -48 and kept every tank.
- Overturned by W11 and W12 the same night: these games only had civs with negative income or no units. With
  positive income and units, the update sets a negative balance to 0 and the game disbands a unit, as the 10-29
  entry in engine-closed.md already said. The disband line controls the disbanding (at -1000 no unit went); none of
  the four values stops the reset to 0. A `grantYield` of the wiped amount at the civ's `PlayerTurnActivated` puts
  the debt back exactly (W12: two AIs at -500 with about +150, three turns).

## Watched 2026-11-10, fourth game (prices measured per civ, the seat's REPAID note)

Run `2026-11-10T03-09-46`: Modern seed 4242, Deity, Inflation On, the Economics working copy plus the W5 and W8 probes.
Prep and restore: `devtools/w9-prep.sh`, `devtools/w9-restore.sh` (0 registry rows differ after).

- The table wasn't enough: on one turn the same 25% stack (16+8+1) raised the seat's prices 24.95% and Hawaii's
  26.5% (Factory 3,900 to 4,872 and 3,796 to 4,804); each civ's own purchase modifiers combine with it. The glue now
  measures each change: a purchase price (the dearest building the capital can buy) read before and 1.5 s after the
  new markers, the ratio kept per civ (`econ-price-read.js`), the next stack scaled from it. Watched: from a clean
  start every civ's stack was measured (seat 26 at +26.0%, AIs 4 at +3.6%); a turn later the seat stood 29 for a
  28.80% level, the Treasury tab read "Your prices, from inflation +28.9%", and the seat's Factory, Schoolhouse and
  Rail Station measured with and without the markers on that turn rose 28.92, 28.95 and 28.95%.
- The seat's REPAID note, watched: a recorded repudiation of Persia (turn 1), an amends loan from Persia at turn 11
  (L3, 1.08% a turn), repaid in full: made good at turn 12, and with the turn left open every civ's history read "They
  repaid a loan in full" (2 + 1) toward the seat. The turn-18 miss in run `02-41-59` came with the turn ended about a
  second after the markers went up.

## Watched 2026-11-10, third game (price calibration, an unhappy captured town, the seat's one-off charge, amends)

Run `2026-11-10T02-41-59`: Modern seed 4242, Deity, Inflation Off, the Economics working copy plus the W5 transfer and
W8 gloom probes, turns by hand, fixes deployed mid-game (`deploy --prove`, no file STALE). Prep and restore:
`devtools/w8-prep.sh`, `devtools/w8-restore.sh` (0 registry rows differ after).

- Price markers, measured (`devtools/econ-w8-calibrate.js`): 19 stacks on Hawaii, 48 prices each across six cities,
  every price back to its base when the markers came down. The rise follows the stack's total: 1% gave 0.90, 8%
  7.44, 16% 16.15, 32% 34.64, 64% 71.47, 127% 144.02 (prices round down to steps of 4 Gold, and large stacks compound).
  Economics now stands the stack whose measured rise is nearest the level and shows that rise (`PRICE_CALIBRATION`).
- A captured town at a different percentage, watched: Goryeo's capital with its Loan repayments markers (23 Gold) went
  to Persia; the town read +30% (-28 Happiness: "Income Penalty from Unhappiness" -80) against Persia's capital +110%.
  Taking the town's markers down moved Persia's net Gold 411.39 to 381.49: they paid 29.90, the town's 23 x 1.30, where
  the capital's rule gives 48.30. The next batch counted back -310 cents for Persia, the per-city figure (the old rule
  gave +1,530).
- The seat's one-off charge, watched after a fix: at 2 Gold with standing lines of 10 and income 12, the batch paid out
  24 and the seat read -10 once its income landed. Its lines go up after its own roll, so the batch had counted their
  charge back as already taken; the seat's funds now leave that charge out (`rollPendingCents`). Rerun: funds 14, the
  batch took 2 (2 -> 0 at 55 ms), its income landed (0 -> 12 at 468 ms), the held-back 12 went out (12 -> 0 at
  1,382 ms); it never read below 0.
- Amends, watched after two fixes. The Ottomans' recorded repudiation of Hawaii cooled at turn 11, but no loan came:
  an AI lends only with 20 turns of income in hand (Hawaii had about 15). The wronged lender now takes amends at 5.
  Then the seat, 10 turns after repudiating Persia, had no offer: Persia's gate wanted a reputation of 50 (the seat had
  41) and a stake of 0 (Persia's was -16.9), both put there by the repudiation; the wronged lender now waives both.
  After that the Ottomans took L5 from Hawaii (1,059 Gold, 10 turns, 0.80% a turn, 1.5x Hawaii's rate), and the seat
  took L7 from Persia (50 Gold at 2.51%; 200 was over its credit cap, which said it could take 105). The seat repaid L7
  at once: closed, made good at turn 18, reputation back to 78.7, Persia's two script favors (+5, +5). The Ottomans
  repaid L5 early and were made good at turn 22: Economics' REPAID note (2 + 1) showed "They repaid a loan in full"
  with the Ottomans in every civ's history. The seat's own REPAID note at turn 18 didn't fire although the markers
  stood; the same markers placed by hand on the seat did. That turn was ended about a second after they went up.

## Watched 2026-11-10, second game (inflation end to end, the seat at 2 Gold, a captured town, an AI repudiation)

Run `2026-11-10T02-04-37`: Modern seed 4242, Deity, Inflation On, the Economics working copy alone plus the W5
transfer probe, 14 turns by `lab drive` with `mod_ideas_tested/economics/devtools/econ-w7-sample.js`, then a turn by
hand. Prep and restore: `devtools/w7-prep.sh`, `devtools/w7-restore.sh` (0 registry rows differ after). Captures in
`working_screenshots/econ-w-2026-11-09/w7-*.png`.

- Inflation end to end, watched. Bond loans written at turn 2 set the rate to 0.5% a turn; the seat's level rose
  0.55% then 1.15% on its own and its capital held a 1% price marker at turn 4. Set to 20% at turn 5, the markers
  stood at 21% two turns later. On one turn, with the level at 31.2% and 16+8+4+2+1 standing, the seat's Factory cost
  4,884 Gold with the markers and 3,660 with them taken down: +33.4%, so the rungs add up a little above their sum
  (8+4 had read +11.7% in the price game). The Treasury tab read "Your prices, from inflation +32.5%" and "Rise next
  turn +1.3%" (Corporatist: twice the rate) (`w7-treasury-prices.png`).
- The seat at 2 Gold, watched: its treasury set to 2 Gold at turn 11 with a loan payment due. Traced every 10 ms from
  the batch: 2 Gold, then 1 at 49 ms (the grant: the payment less what its Debt service line had already taken at
  the roll), then +66 at 357 ms when its income landed. It never read below 0; the line carries the payment, so the
  batch's own grant is small. A charge that isn't on a line (a one-off cost) can still take the seat below 0 for the
  third of a second before its income lands.
- A captured capital, watched with the per-city count-back built before the run: Goryeo's capital (a lender, so it
  held Loan repayments lines) went to Persia at turn 9. At turn 10 Persia held the town's LOAN 16+2+1, WORLD and PRICE
  markers, and the batch counted them back at the town's own percentage; it read +110%, the same as Persia's capital,
  so the old capital-only rule would have given the same -239.10 here. The next batch took the town's markers down.
- An AI repudiating a loan, watched: the Ottomans owed Hawaii 4,000, declared war on it at turn 4 and repudiated at
  turn 5. From turn 6 every other civ, the seat, Persia, Hawaii, Goryeo and the Dai Viet, read "They repudiated a
  loan -2" with the Ottomans (the witnesses' 3 halved at war); the seat's breakdown with Alexander read "From Their
  Leader Agenda +2 / Shared Government +10 / They repudiated a loan -2" (`w7-ottomans-repudiated.png`).

## Watched 2026-11-10 (paying lines by Income percentage, the roll's floor, prices, the age change, a lost grant)

Run `2026-11-10T00-35-36`: Modern seed 4242, Deity, Inflation On, the Economics working copy alone plus the W5
transfer probe, 16 turns by `lab drive` with `mod_ideas_tested/economics/devtools/econ-w6-sample.js`, then turns 17
to 35 by hand with fixes deployed mid-game (`UI.reloadUI()`, `deploy --prove` with no file STALE). Prep and restore:
`devtools/w6-prep.sh`, `devtools/w6-restore.sh` (0 registry rows differ after). Run `2026-11-10T01-00-05`:
Exploration 4242 through the age change. One more Modern 4242 game for the price route, inflation Off.

- Paying lines, watched after a fix. `readIncomePct` indexed `getYields()` with `YieldTypes.YIELD_GOLD`, a hash, so it
  read 0 and nothing was scaled: at Deity (+100% for every Modern AI: +80 handicap, +20 Modern) Persia's Economy
  receipts of 261 landed as about 522 and the batch counted back 261. Fixed (`GameInfo.Yields.lookup("YIELD_GOLD")
  .$index`); after it, each AI capital read +100% (Persia +115%) and the paying lines stood at half (Ottomans' 54 as
  27, Persia's Loan repayments 41 as 20).
- A part of a Gold, watched after a fix. A line scaled by 115% moved Persia 12.70 at the roll, and `grantYield` pays
  whole Gold, so a grant of 18.70 paid 18. The batch row now rounds the grant and carries the part: Persia's next
  grant was a whole 20, the 0.18 carried, and its balance ended at snapshot + payment to the cent.
- The roll's floor, as read at the time (the W10 games disproved the floor: see that section). Traced every 20 ms: each
  civ's Gold lands at its own activation (the seat's, then the AIs' after the seat ends its turn), so the batch at
  TurnBegin runs before any income for the turn lands. The roll ends at max(0, balance + net income): the Ottomans set
  to -150 with +111 came out at 0, set to -50 with +115 at 65. The 11-09 run's -41 was this: the batch left AI 2 at -41,
  its roll added income less 161 of lines (+24), and the game forgave the -17 while the next batch counted the 161 back
  as paid. Charging lines now fit in what the batch leaves the civ (`standingRows`). Watched over 20 AI rolls after the
  fix: the closest, the Dai Viet at -438 after the batch with +478 net, rolled to +40 with nothing forgiven. A change
  that counted only the seat's income was tried first and reverted: the trace showed no AI's income is in its balance at
  the batch.
- Repudiation, watched: the seat's history read "You repudiated a loan" with each other civ.
- Trade bills lines, watched with world prices x60 by script to turn 12: bills of 32 to 37 Gold stood as BILL and
  BILLIN markers.
- A capital captured, watched: BUILDING_W5_XFER handed Goryeo's capital to Persia at turn 10; at turn 11 Persia held
  the town's old markers and Goryeo none, at turn 12 the town's were gone and Goryeo's new capital had its lines. On
  that one turn the town's paying lines were counted back at Persia's capital percentage.
- A lost grant on reload, watched: Gold grants held back for batch 33 (`Players.grantYield` wrapped), the game saved
  in that state and loaded: "6 re-sent", five civs at snapshot + payment exactly, Persia 0.70 short (the part-of-a-Gold
  finding above).
- The age change, watched (run `2026-11-10T01-00-05`): the transition had no roll (the seat's 703.02 at the end of
  Exploration was its first Modern snapshot), the first Modern batch counted nothing back, and the markers were taken
  down and the new lines and the age's fresh price ladder put up on the first Modern turn.
- Prices, a route that works watched with markers placed by hand (inflation Off): a game modifier over all cities,
  gated on the city holding the marker, raised all six Hawaiian cities' purchase prices (Factory 3,524 to 3,788 for 8%,
  3,936 for 8+4%), Goryeo's didn't move, and removing the markers put every price back at once and through the next
  turn. Two other routes failed: on the player itself nothing changed; over the owner's cities with an owner
  requirement it applied once per city and never came off (run `01-00-05`).

## Watched 2026-11-09 (standing lines: Economy costs, paying lines, reload; the named-grievance probes)

Run `2026-11-09T23-18-22` (`~/.tower-bench/runs/`): Modern seed 4242, `--setup fast --quick` (Settler), the Economics
working copy alone with the W1 probe rows, 18 turns by `lab drive` with
`mod_ideas_tested/economics/devtools/econ-lines-w1-sample.js`, then two turns without Autoplay. Script help at turn 2:
three civ loans written into the ledger (AI 1 to AI 2, AI 3 to the seat, the seat to AI 4), the world index held at
0.50 to turn 16, the seat +3,000 Gold and +500 Influence; the seat asked for Relief once its Depression opened. Prep
and restore: `devtools/w1-prep.sh`, `devtools/w1-restore.sh` (0 registry rows differ after).

- Economy costs lines, watched: from turn 11 every capital held WORLD markers beside its Debt service and Loan
  repayments ones, and the capitals' Gold breakdowns listed them under "Minus Deductions" ("Economy costs: -64 Gold",
  "-32", "-8"...). The seat's line at turn 16 was 40 = cycle Gold 34.18 + Relief 6.00, whole Gold each. For every AI,
  every turn, the balance after the batch equalled the snapshot plus the payment to the cent ("d 0"); the seat ran
  ahead by its own Gold per turn as before.
- Paying lines, measured: the Income node of `city.Yields.getYields()` carries the percent steps, the Loan
  repayments lines sit in its base, and Deductions has none. AI 1's capital: Unhappiness -9.89, Crusher of Rebellions
  +10, the Settler handicap -20 and Modern's `MO_HANDICAP_GOLD_SCALING` +20, net +0.11%; AI 3's: Unhappiness -4.79%.
  The 11-04 shortfall was the same mechanism (Exploration Settler, -20% with no Modern +20).
- Reload, part watched: a save taken in a `TurnBegin` listener and loaded at once gave every civ the same balance as
  the uninterrupted turn, "0 re-sent", and the wanted markers went up 5 s after the load from boot (every capital's
  markers equal to its lines). The save was written after the grants landed, so the lost-grant window wasn't hit.
- Markets plural, watched: `LOC_ECONOMICS_MARKETS_MARK_GAIN` reads "1 more copy in the world" and "2 more copies";
  the loss line likewise.
- Trade bills lines: not reached; Modern bills in this game were 7 to 38 cents.
- Finding, not fixed: AI 2's balance went 2,000 to 703 to 105 to 32 to -41 Gold (turn 20) and -27 (turn 21). Its
  turn-21 batch paid out about 273 Gold (cycle 61.03, price supports 73.12, a payment 38.10, a dividend 32.02, the
  escrow hold 69.22) against funds of about 247 (snapshot 161, all of it the lines' charge, plus escrow and dividends
  in). `funds()` counts the turn's income on top of the snapshot (DESIGN 4.14); whether a negative treasury is meant
  to be possible there is the open question.

Runs `2026-11-09T23-29-29`, `23-32-34`, `23-36-49`: the same setup with the W2 to W4 probe rows
(`mod_ideas_tested/economics/devtools/w1-probe/`), markers placed by script at turn 9. Results in
`docs/AI-NATIVE-LEVERS.md` "Lab runs 2026-11-09"; captures `working_screenshots/econ-w-2026-11-09/`.

## Watched 2026-11-03, third round (crisis paths)

Lab run `2026-11-03T11-42-35`, Modern seed 4242, Economics and Partisans working copies, sample
`mod_ideas_tested/economics/devtools/econ-paths-p8-sample.js`, with tanks placed by the bench.

- Watched: a strong Fascist AI at peace taking Diversionary war and the mod declaring its war; a capture read as a
  capture and counted toward the War economy's goal; Lend-lease's doubled relationship and bond half against the same
  gift without it; the 9-point hard times under Austerity in a deep Depression, read by both mods.
- Not watched: a rising tipped by hard times (no settlement below 0 Happiness).

## Watched 2026-11-03, second round (crisis paths)

Lab runs `2026-11-03T10-56-09` (Antiquity into Exploration) and `2026-11-03T11-18-23` (Modern), seed 4242, Economics
and Partisans working copies, samples `mod_ideas_tested/economics/devtools/econ-paths-p{3,5,6,7}-sample.js`.

- Watched: Land reform, Lottery loan and Debt into shares taken by AIs and settled; Debt into shares tested five turns
  after its crisis; New Deal programmes and Bank regulation taken by the seat and judged; Lend-lease taken with two
  other civs at war, its gift and the bond market's half; the revised panel text on screen.
- Not watched: a capture for the War economy, a rising from hardship, a strong Fascist AI's war at peace, Lend-lease's
  doubling side by side (WATCH_LIST 24b).

## Watched 2026-11-03 (crisis paths, uncommitted build)

Lab runs `2026-11-03T04-00-25` (Antiquity into Exploration) and `2026-11-03T04-20-45` (Modern), seed 4242, Economics
and Partisans working copies, the index pushed under 0.80 by the samples in
`mod_ideas_tested/economics/devtools/econ-paths-p{1,3,4}-sample.js`. The account is in
[CRISIS-PATHS-BUILD-REPORT.md](CRISIS-PATHS-BUILD-REPORT.md).

- Watched: Liturgies taken by the seat, charged in Influence and Gold, Sustained and Earned with its legacy and the
  drift on the Fiscal tab; the pill, header and turn notices naming it; Merchant charter taken twice by the Plutocracy
  AI and Compromised; Self-sufficiency, Off-book bills and Diversionary war taken by the Fascist AIs; the hardship
  figure read alike by both mods; the Influence refusal on the seat when the game held less than the price.
- Not watched: the Democracy cards running, Lend-lease, Debt into shares, Lottery loan, Land reform, a script-declared
  war, a capture counted for the War economy, a rising from hardship (WATCH_LIST 24b).

## Watched 2026-11-02 (the WATCH_LIST sweep: aid rescale, Antiquity into Exploration, Exploration, Modern, options off)

Five lab games on the working tree of 2026-11-02 (the aid rescale, uncommitted at the time), copied into
`Mods/economics` for the runs and the 0.5.4 copy put back after. The scripts, drive logs and `UI.log` of each game
are under `mod_ideas_tested/economics/devtools/probe-runs/2026-11-02-watch/` (`notes-a.md` holds the turn-by-turn
notes), the captures under `working_screenshots/econ-watch-2026-11-02/`. Run A: Antiquity 4242, every other mod
off, Inflation On, 112 turns, `lab age-change`, 17 Exploration turns (`2026-11-02T23-36-57`), with two script
save-and-reload cycles at turns 84 and 88. Run B: Exploration 9001, every other mod off, Inflation On, 57 turns
(`2026-11-03T00-00-07`). Run C: Modern 4242, the usual set, stages Off, Inflation On, 48 turns
(`2026-11-03T00-07-28`). Runs D1 and D2: Exploration 9001, every other mod off, 8 and 5 turns, Crises Off and
every option Off. No invariant, `econ-3` or getMilitaryStrength line in any `UI.log`.

- Aid and relationship (2026-11-02): the Trade tab's Aid line reads "300 Gold as a gift: relationship +20" for
  Antiquity hosts (the cap), "+13" and "+20" at Exploration incomes of 53 and 20 Gold, "+2" to "+6" at Modern
  incomes of 150 to 300 Gold (captures `a-trade-aid-ex17.png`, `b-trade-aid300-ex57.png`, `c-trade-mo48.png`).
  With the stepper at 10 Gold the line greys to "too little for them to notice. Send at least 22.5 Gold."
  (`b-trade-aid10-ex57.png`; a whole-Gold minimum after the run) while a 20-Gold host still reads "+2". A 10-Gold
  gift by queue is `refused: too-small`; 300 Gold to Greece moved its level 10 to 30 the next turn (+20 booked),
  300 to Persia +11 (level 10 to 21). The development-loan and general lines end at the Gold that comes back, with
  no relationship figure. With too little Gold in hand both lines read "you don't hold that much Gold" first.
- Antiquity (run A): Light slotted by Goryeo t26 and Hawai'i t29 with "Light Taxation=6" on their capitals' Happiness
  (LA.1, LA.2, L.1's Antiquity half: 2 of 5), War Levy on all five by t54, Heavy on none by t84 (HP.2 not seen).
  The seat's Heavy card unlocked at t36, well after Light's t9 (HP.1 by the gap; the civic's own turn wasn't read).
  The Fiscal tab's card forecasts against the capital's lines (T.3 for one settlement). Greece's script war on the
  seat (t58 to t62) left War Levy at +2 (5.5: a formal war by hand is still owed). Two AI wars on one turn gave
  `war-declared` causes x2 (F.9's count line didn't reach a notice since the seat's Gold moved under 2 Gold); the
  trend line "after the world's income growing slower than usual" read in a notice (F.1). The AIs' citizens' loans
  ran all game (M.28). Index 0.70 at t84: every civ in Depression at t85, the Antiquity menu at t87 and t111 (X.2:
  Public works, Relief, Bank holiday, Cancel the debts, Debase the coin, Tribute greyed "your economic system can't
  take it", The temple lends ...; AI picks tribute, cancel-debts x3, bank-holiday). The seat's own debt crisis t107.
  Moneylending never came to the Autoplay seat (no Commodities); written into the glue at t89: a 20-turn civ loan
  was `no-offer` twice from a Hostile Greece (F.5 still owed); A.3's refinancing came from the citizens (L17 paid
  with no miss, closed next turn); citizens' loans L18, L20, L22 with the celebration meter +30/+48 a turn (M.27,
  F.12) and "Owed to your citizens" as the card's title (UP.9's loan half). The repudiate preview at t108 showed a
  raw `LOC_ECONOMICS_REPUDIATE_PREVIEW` (ten placeholders; fixed to nine) and "Payments left 1 turns" (fixed with the
  plural construct). Reload at t84: 11 loan records, 0 re-sent, same loans and trend after (1.3, F.2's trend).
  Reload at t88 with the guard off and the index at 0.6145: both survived (3.5, SW.4). The swings ran 0.50 to
  1.08 across the game (SW.2's range, the 0.50 from the pushed index).
- The age change (run A): L24 (40 Gold, 20 turns) open across it with two misses at t110 and t111 (guard off):
  "Last age ... Nothing paid on L24 (2 missed in a row)" and the reputation at 92.73 on Exploration's turn 2 (M.4);
  the seat's escrow 2.26 there on the first turn and paying (B.2); `turn 121 (load catch-up from turn 120)` once
  (1.9). The Exploration picks matched the table again (G.1, G.7); "Manorial economy" on the header. The Treasury's
  buildings read Commerce 3, Trade 3, "Market, Heian-Kyo: 0.50" under old buildings (C.30's claim not shown;
  inconclusive). "Routes you could make" listed seven foreign cities at Exploration t17 (C.2).
- Exploration (run B): the Exploration menu (X.3: Public works, Relief, Bank holiday, Suspend payments, Charter a
  company, Navigation acts, Bullion fleets, Lend to the crown, Confidence, Austerity; AI picks Suspend x4, Public
  works). The seat's Autoplay routes had Sengoku and Persia paying the seat each turn ("They owe for theirs 0.7, You
  receive 0.7"; C.8's paying side still owed). A bond loan beside idle Gold (M.16): the World tab read "Inflation
  Each turn 0.1% / Owed to the bond market 339.4 / Gold the members hold 7328.5" on its scale (U.7), erosion
  transfers each turn; repaid, the erosion fell to 0 within three turns (M.17). The boom at 1.49 with heavy bond
  loans gave no Panic without Banking (M.14 still owed). No Theocracy among the met civs (M.30 owed). The general
  line stays out before Chartered companies (F.11 moved to Modern).
- Modern (run C): the seat's Bank holiday skipped its bond payment three turns with no miss and resumed on the
  fourth (X.8); Persia with two defaults to it in a Depression: `bank-run` and `bank-failures`, and the borrow form
  without Persia (X.10, less the -0.02 read); "Depression 1 turn in" on the crisis's first turn (X.14); the debt
  pill's action event landed the screen on the Loans tab with the defaulted loan's card, the phase pill on the World
  tab's crisis card, the inflation pill on the World tab (X.16, the hand press still a person's); no `econ-3` across
  47 turns of AIs backing each other's builds (X.15) and no strength warning (X.17). "their economic system takes
  development loans only" greyed the Corporatist hosts' general lines (M.31). A script war between an eased pair
  cleared the easing and the tariff came back (TD.4). Hawai'i's Planned take (`plan` transfers) from t30 (M.29's
  AI half). All six civs stayed Authoritarian and Corporatist for 48 turns (M.26 not reached). The crises ran the
  Modern catalogue: Depression, debt, Runaway inflation (Confidence), Price shock (Price supports), Credit panic
  (deposit insurance), a trade collapse, with two of the seat's crises side by side on the World tab.
- Options off (runs D1, D2): with Crises Off the index pushed to 0.49 opened no crisis and the World tab had no
  Crisis section, the boot line reading `crises: false` (X.12). With every option off the World tab said the cycle
  and inflation are off and the batch logged `skipped, all-off` on the first turn at the normal level and at debug
  after (the working tree runs with DBG on, so every turn showed; a release shows one). The Loans tab still drew a
  borrow form with lenders: fixed after the run (the tab, its forms and the Treasury's guard rows now follow the
  Loans option).
- Fixed from the runs: the repudiate preview's tenth placeholder; "1 turns" plurals; the section subtitle cut at
  the panel's edge (it wraps now); the aid minimum in whole Gold.
- For a person: 5.5 (a declared war), 5.2 (a slot on a held seat), SG.1/SG.3 (the Options screen), X.11 (the
  Civilopedia), X.18 (the dial's tooltip), U.1 to U.3, U.8/UP.7/UP.8 (window sizes), C.38, T.1's hover, 8.1/8.2
  (hotseat and LAN), the setup screen's text.

## Watched 2026-11-11 (night): staged lab probes, Economics as deployed in Mods/economics

Lab games run from staged probe files (`tools/plans/night-2026-11-10/`, its RESULTS.md has every reading). Play Now
seed 4242, every other mod off unless named; the deployed copy, which differs from this folder in `econ-params.js`,
`econ-view-treasury.js` and the translations. Rows taken off the Owed tables: LA.4, LA.3, 5.2, 5.3, 4.4, X.12, SG.4.

- LA.4, LA.3: Light reads "-1 Gold and +6 Happiness in each settlement" in Antiquity, +4 in Exploration, +3 in Modern,
  on the policy text and the Fiscal tab.
- 5.2, 5.3: Light slotted from the Fiscal tab and held by the game's policy state; in Code of Laws' turn (which opens
  Heavy) a swap to Heavy went Deactivate then Activate and Heavy was active at once; clearing answered "cleared" and
  the policy state held no card. A swap asked a turn later is refused and the tab says "The game isn't allowing a
  policy change right now", so the window closes at the turn's end.
- 4.4: repudiating the bond loan wrote the ledger event and the Treasury flows lines "repudiated 30 Gold owed to the
  bond market (6 grievances)" and "credit rating moved -30 (repudiation) to 70".
- X.12: with the option Off the boot line reads `"crises":false` and no crisis opened in 9 turns.
- SG.4: with Demographics on and ours unticked, unmet civs stayed off the Trade tab; ours ticks back on.
- Partly: 5.1 (one slot after Chiefdom and after Economics; in Modern the slots read 3 before and after
  Modernization, so Modern's +1 is still owed); 5.2a (the capital moved by exactly the card's -1 Gold, +6 Happiness;
  the celebration turns not read); T.1 (Light's lines on the capital's breakdown read "Light Taxation" 1 and 6 by
  script; the hover is a person's); S.2 (the flows list and the buildings block read; the projection bars not);
  X.11 (the Civilopedia group with 6 pages; the search is a person's); BP.1 (the pill in the top bar in the world
  view and with a city open); 3.5 (the console switch reads back off, then on; the reload half owed).
- TD.1 doesn't match its row: Modern AIs set Low tariffs from turn 5 and eased them 1 to 11 turns later (turns 8, 12,
  13, 16), not about 20 turns on, then set None. No re-raise within 5 turns of an easing (TD.2's first half); no pair
  stood at High, so its second half wasn't reached. Owner call whether the shorter hold is right.
- Note, not a player bug: `swapTo` takes the slotted card out before asking the game for the new one, so a call the
  game refuses leaves no card (a probe asked for Heavy before it was unlocked and lost Light). The Fiscal tab only
  offers unlocked cards; the console API can still do it.
- P2 (DESIGN section 10): on the turn an AI finished a Library its balance moved by its net Gold read the turn
  before, and from the next turn by the lower net the Library's upkeep left (Greece 6 then 4, Dai Viet 5 then 3,
  Hawai'i 12 then 10), so `getNetYield` agrees with what the engine charges AIs, one turn on.

## Watched 2026-11-11 (morning): staged lab probes, Economics as deployed in Mods/economics

Same setup as the night section above (`tools/plans/night-2026-11-10/RESULTS.md`, "Morning runs"). Rows taken off the
Owed tables: 3.5, 5.1, M.1, BR.1, SW.1, S.5, M.13; trimmed: 1.3, 5.2a, 5.4, 5.6, T.1, X.18, SG.1.

- 3.5: guard switched off, quick save, quick load in the same session: the boot line after the load reads
  `"guard":false`, the switch still reads off a turn later, and switching it on reads back on.
- 1.3 (part): after the reload the next turn's batch ran once (one `turn 4 (TurnBegin 4)` line, no `already-planned`).
  No seat loan was open: the bond market refused a loan "over your credit limit" at an income of -15.
- 5.1: one policy slot after the age's root civic in all three ages (Chiefdom, Economics, Modernization: 0 to 1), with
  the age's three cards unlocked.
- 5.2a (part), 5.4 (part), T.1 (part): after slotting Light the capital moved by what the Fiscal tab said: Antiquity
  0 to -1 Gold and +3 to +9 Happiness, Exploration 3 to 2 and 19 to 23, Modern -3 to -4 and 20 to 23; the breakdowns
  name "Light Taxation" at 1 Gold and 6, 4 and 3 Happiness.
- 5.6 (part): Heavy after Light in Code of Laws' turn: the capital read +4 Gold and +1 Happiness ("Heavy Taxation" 4
  and 2 on its breakdowns) against +3 Happiness with no card.
- M.1, BR.1, SW.1: Create Game lists the options in order Loans, Auto-loan guard, AI borrowing and lending, Base
  Interest Rate, Taxes, Economic stages, Markets and trade bills, Tariffs, Foreign investment, Inflation, Business
  cycle, Economic swings, Economic systems, Crises and responses; Inflation Off, Business cycle Standard, Economic swings
  Volatile and Economic systems On by default; Base Interest Rate reads "The rate every loan starts from: 1.5 percent a
  turn in Antiquity, 1 in Exploration and 0.75 in Modern at Standard. ..." with Low, Standard and High each described.
  The boot line names the options.
- SG.1 (part): from the main menu, Options opens on 1.5.1's Add-ons tab with an Economics group and Spoil Guard ticked.
- S.5: the dock button's icon is the coin SVG mask from `fs://game/tower-economics/images/econ-dock-icon.svg`, tinted,
  58 px wide.
- X.18 (part): the dial's tooltip text composes with the player's and the world's index and phase and the pay line.
- M.13: Modern, the seat at war with a met AI for three turns, then quick save and quick load: the cycle state read the
  same after the load (world index 0.9805, its history 1.00, 1.00, 0.988, 0.977, 0.9805, the war and the four new
  route events, each civ's phase).
- C.7 (not reached): see its row; no strategic resource was in the market's list in vanilla Modern or with Strategic
  Resources That Matter at its defaults, and factory resources fell 10 to 45% over ten turns at war.

## Watched 2026-11-11 (second morning batch): staged lab probes, Economics as deployed in Mods/economics

Same setup as the sections above (`tools/plans/night-2026-11-10/RESULTS.md`, "Second morning batch"). Rows taken off
the Owed tables: C.6, X.11, SG.1, TN.1, G.2, G.3, M.25, SG.3; trimmed: M.25, UP.2, SG.3; C.5 measured and over its mark.

- SG.1: in an Antiquity game, Options opens on the Add-ons tab with the Economics group and Spoil Guard ticked
  (`econ-ingame/01-options-ingame.png`).
- SG.3 (part): with the guard unticked the Trade tab lists all five AI civs, none met, each with "you haven't met them
  yet"; ticked again, none is listed. In an Exploration game ten turns in, with three of five AIs unmet, none of the
  unmet three is named on the Treasury, World, Trade, Markets or Fiscal tab.
- X.11: the six "Crises and responses" pages draw with 7 to 12 chapters each and no raw text key, and the
  Civilopedia's search for "New Deal" finds the Modern page.
- M.25 (part): under Despotism with Heavy Taxation slotted, the capital's Gold breakdown reads "Heavy Taxation" 4 and
  "Palace economy" 1.
- UP.2 (part): Antiquity, before Commerce the tabs read Treasury, Fiscal, Markets, Trade; with Commerce (Commodities)
  the Loans tab sits second, the header shows "Debt 0, you owe nothing", and the Treasury lists Owed on loans, Loan
  payments due next turn and Set aside for next turn's payments (`econ-ingame/12-loans-tab.png`).
- C.6: Exploration 9001, turn 11: the Markets tab's Copies match the improved tiles of each resource in majors' land
  for all eight counted (Gold 2, Silver 2, Niter 5, Furs 8, Ivory 5, Cocoa, Spices and Rubies 1). Copies count improved
  tiles only: Cocoa and Spices each had a second, unimproved tile in a major's land. The tab also lists a second Gold
  row and a second Silver row at 12.3 with 0 copies, beside the held ones (Gold 9, Silver 8.7): the game's
  `RESOURCE_GOLD_DISTANT_LANDS` and `RESOURCE_SILVER_DISTANT_LANDS` share the plain names. Owner call: name them apart
  (for example "Gold (Distant Lands)") or fold them into one row. The owner's call (2026-11-11): name them apart; built
  as `resourceLabel` with the game's own "Distant Lands" text, not watched yet (WATCH_LIST 24).
- M.25 (part): Classical Republic with Light Taxation: the capital's Happiness breakdown reads "Light Taxation" 6 and
  "Civic market" 2 (the data's amount; the row's earlier "+1" was out of date), 3 to 11 in all.
- C.5: `tower-bench cost tower-economics --yes --seed 9001 --age AGE_EXPLORATION` (Play Now's default civ count, two
  games each way, 20 turns): about 129 ms a turn with Economics on (median 1804 ms off, 1933 on, noise ±86), and the JS
  heap 4 MB higher. That's over the 50 ms mark, so C.5 stays owed as a fix, not a watch. Report:
  `~/.tower-bench/runs/cost-2026-11-11T12-21-11.json`.
- TN.1: the 44 turn notices in the night's and morning's UI logs: every "Your treasury moved by" line reads whole Gold
  (+26, +4), and none was sent for a smaller net. The separate "Trade bills: you paid 0 Gold and received 0.6 Gold"
  line comes every turn at amounts under 2 Gold and in tenths (0.5 to 1.2 over 18 turns in a row). Owner call: hold
  trade bill lines to the same 2 Gold floor and whole Gold, or keep them. The owner's call (2026-11-11): show what the
  game does, so the line now reads in whole Gold the way the payment lands and is left out under a Gold each way.
- G.2, G.3: three games of 30 turns with Economics alone, one per age, the changed and row-less civs as the AIs. Every
  AI took the government its Economics row favors: Antiquity, Carthage and Silla Oligarchy, Maurya, Babylon and Gaul
  Classical Republic; Exploration, Iceland and Shawnee Theocracy, Spain, the Pirate Republic and England Plutocracy;
  Modern, Great Britain Elective Republic, Buganda and the Ottomans Authoritarianism, Joseon Bureaucratic Monarchy.
- M.25 (rest): Exploration, Revolutionary Authoritarianism with War Levy slotted, at peace with everyone: the capital
  reads "War Levy" 2 Gold and 1 Happiness and "Corporatist economy" 6 Gold and 3 Happiness.
- SG.3 (rest): unticked in a game, the choice is written at once to the game's `LocalStorage.sqlite`
  (`"economics":{"lastTab":"markets","spoilGuard":false}`), the store the mod reads at launch. A relaunch inside one
  lab run isn't possible (the lab puts that file back at stop, which is also why a second lab game read it ticked), so
  the file on disk is the reading.
- S.2 (part): Exploration 9001, turn 6: the Treasury's "Balance in 20 turns" read 586, the balance 926 plus 20 turns of
  -17; the buildings block read Commerce 1 (the capital's Market), Banking 0 (no Bank), Trade 1, Warehouse 3.

