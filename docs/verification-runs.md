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

Every in-game check of prompt 4's phases 1 to 8, none watched. The game wasn't available on 2026-10-29 (another
session held the lab), so each was built against the probe results in DESIGN 10 and the model's tests, and waits for a
lab session. Each line says what the player sees when it works, the setup it needs, and where the code is. Setup
"vanilla" means every other user mod off; "usual set" the Tower mods as the registry has them. Antiquity seed 4242 and
Exploration seed 9001 are the probe run's seeds.

### Phase 1: batch and ledger

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 1.3 | Save and reload mid-turn: the Loans tab shows the same loans and payments; the next turn's batch runs once (`already-planned` isn't logged twice, no second grant) | same | `ui/econ-session.js` `loadSession`, `ui/econ-plan.js` `skipReason` |
| 1.4 | The reload check: a save forced in the second after `TurnBegin` (before the grants land, P15's window) reloads with `[Economics] batch Bn re-sent for player 0` and the balance ends where the ledger says | same | `ui/econ-session.js` `resendLostBatch`, `ui/econ-batch.js` `batchStatus` |
| 1.6 | The order-free resolve holds in game: the same seed and loans give the same transfers whatever order `Players.getAliveMajorIds()` lists civs in (compare `UI.log` of two runs) | same | `ui/econ-turn.js` `turnContext` |
| 1.7 | A payment with a balance below the payment is missed, not overdrawn: the balance never goes below `-income` after a batch, and the engine's bankruptcy banner shows only when it would have anyway | Antiquity 4242, vanilla, a player who spends to near 0 | `ui/econ-batch.js` `funds`, debt-6 |
| 1.8 | The per-turn cost: `tower-bench cost tower-economics --yes` reads the batch under 50 ms at 8 civs (2026-10-30, A and B: the batch line reads 3 to 26 ms at 6 civs, 41 ms the first turn; `tower-bench cost` in Exploration 9001, 2 games each way: 214 ms a turn on against off, inside ±298 ms of noise, heap +2.7 MB) | any | `ui/econ-session.js` `runTurn` log line |
| 1.9 | Load a save made before its turn's batch ran (a save request that beat the batch, or one copied from the turn before the mod's first batch): `UI.log` has `turn N (load catch-up from turn N-1)` once, the payments land, and the next `TurnBegin` runs the next turn as usual; if the local turn was already active, the notification shows at load (2026-10-30, A: the age change's reload logged `load catch-up from turn 120` once; a save from the turn before isn't tested) | same | `ui/econ-bootstrap.js` `catchUp` |

### Phase 2: player loans

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 2.1 | Loans tab, Borrow: the bond market and each civ that will lend show with rate, payment, total interest and the share of income the payments would take with the loan; Borrow queues the request and the principal arrives next turn; the notification names the loan (2026-10-30, B2: the offers (bond and civs, rate, payment, interest, share of income) read through the view model, and Borrow from the queue landed next turn; the click is owed. AIs not yet met offered too) | Exploration 9001, vanilla | `ui/econ-view-borrow.js`, `ui/econ-notify.js` |
| 2.3 | Repay all or half: the next payment takes the extra and the loan closes early, with a `closed` line in the Treasury flows (2026-10-30, B2: repay half watched (35.00 to 12.50 outstanding); repay all and the closed line owed) | same | `ui/econ-requests.js` `addExtra` |
| 2.4 | Spend to 0 and miss three payments in a row: three miss notices with the climbing rate, Influence -5 each, then the default notice; the garnish lines show each turn; the lender refuses a new loan for the age | same | `ui/econ-plan.js` `recordMiss`, `garnishOne` |
| 2.5 | Restructure an overdue loan: the preview shows the 10-turn schedule, after confirming the next payment is the smaller one, a second restructure button is greyed; with income at or below 0 the refusal names it | same | `ui/econ-view-loans.js` `restructureConfirm`, `ui/econ-requests.js` `restructureLoan` |
| 2.8 | Lend to an AI in shortfall with positive income: it accepts by rule, the player's balance falls by `P` and rises each turn; an AI with income at or below 0 declines with the reason in the notice (2026-10-30, B: the decline with its reason watched (no AI was short); the accept side owed) | Exploration 4242 | `ui/econ-requests.js` `lendRefusal`, `ui/econ-ai.js` `aiAccepts` |

### Phase 3: guard

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 3.1 | With income below 0 and the balance about to cross 0, the guard's loan lands the turn before the crossing: no unit is disbanded, the notice names the amount and the lender | Antiquity 4242, vanilla, before Commerce (temple treasuries) | `ui/econ-shortfall.js` `guardFor`, `ui/econ-guard.js` |
| 3.2 | The same after Commerce (a civ lender when cheaper) and in Exploration after Economics (the bond market; temple treasuries no longer named) | Antiquity 4242 after turn ~40; Exploration 9001 | `ui/econ-lenders.js` `emergencyOffersFor` |
| 3.4 | At `emergency_cap` the guard stops with one notice naming the cap, the deficit and the disband line; the game's own penalties then apply as P4's negative-income branch shows (which unit goes, and when, is itself unwatched) | same, deficit held past the cap | `ui/econ-shortfall.js` `noteCap` |
| 3.5 | The Loans tab switch: Off and the guard stays out (balance crosses 0, penalties apply); On again and it fires; the switch survives a reload | same | `ui/econ-session.js` `setGuard` |
| 3.6 | After five turns of income at or below 0 the insolvency notice shows once, and the Treasury tab's line stays while it holds | same | `ui/econ-plan.js` `trackIncome` |

### Phase 4: repudiation

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 4.3 | An AI repudiates the player's loan the turn a war between them starts: the notification names it, the record reads repudiated, grievances booked on the AI against the player | Exploration 4242, lend then declare war | `ui/econ-shortfall.js` `aiRepudiate` |
| 4.4 | The chronicle entry on both sides (the Treasury flows line and the ledger event) (2026-10-30: the ledger event carries `chronicle: 1`; the Treasury flows line owed) | same | `ui/econ-notice-text.js` `describeEvent` |

### Phase 5: tax cards

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 5.1 | The tax slot appears when the age's root civic completes (policy slots +1, as P17 saw at Chiefdom), in all three ages (2026-10-30, A: the cards unlock at Chiefdom, but the player's policy slots read 2 at turn 31 where P17 saw 4; read `getNumCultureSlots` before and after Chiefdom) | Antiquity 4242, then an Exploration and a Modern start | `data/econ-tax-cards.sql` (slot row), `data/econ-tax-gameeffects.xml` |
| 5.2 | The Fiscal tab lists Light, Heavy and War Levy with the forecast under each; Slot sends the change and the card reads slotted; swapping with every slot full goes Deactivate then Activate within the turn; when `canSwapCultureSlot` reads false the buttons grey and the note says so (2026-10-30, A: `swapTo` returned `no-swap` while `canSwapCultureSlot` read false (the Autoplay seat had just chosen cards); owed) | same | `ui/econ-fiscal.js` `swapTo`, `ui/econ-view-fiscal.js` |
| 5.2a | The forecast reads right: after slotting a card, its Gold and Happiness change on the tab match what the settlements then show (within rounding), and the celebration turns move the way the tab said. The starting Gold line now reads the civ's net and matches the top bar (watched 2026-10-30, 0.4.0, below) | same | `ui/econ-fiscal.js` `readFiscal`, `ui/econ-tax-cards.js` `cardForecast` |
| 5.3 | The policy menu shows the same card as slotted, and clearing it there clears it on the tab | same | `ui/econ-fiscal.js` `readCards` |
| 5.4 | Each card shows on a city's yield breakdown under its own name with the right percentage (hover; P17 left this open) | same | `data/econ-tax-gameeffects.xml` (Tooltip argument) |
| 5.5 | War Levy pays only at war: the breakdown line appears when a formal war starts and goes when peace is made | same, a declared war | `data/econ-tax-gameeffects.xml` (REQUIREMENT_PLAYER_HAS_X_WARS) |
| 5.6 | Under Heavy Taxation the next celebration comes later and a settlement's happiness moves as P17 measured (32 to 20); under Light the other way | same | the cards' Happiness modifiers |

### Phase 6: AI and soak

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 6.6 | Whether repudiated lenders go to war with the repudiator more often (P16): counted and called inconclusive if small | same | DESIGN 10, P16 |
| 6.7 | `tower-bench cost tower-economics --yes` for the per-turn cost | same | `ui/econ-session.js` |

### Phase 7: alongside other mods

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 7.1 | Phases 1 to 5's main checks (1.1, 2.1, 2.4, 3.1, 4.1, 5.2) once with the usual set: Demographics, Emigration and Partisans read Gold and relationships too; note anything that moves differently, and that the Demographics Gold-per-turn chart shows the loans' grants as balance moves and not as income (2026-10-30, D3: a 20 Gold bond loan landed and paid 2.8, 2.7, 2.6 a turn with the usual set; the other main checks owed) | Exploration 9001, usual set | `docs/compatibility.md` |
| 7.3 | Partisans' hardship from the tax cards (its own read of `isTraditionActive`) once Partisans reads the `TRADITION_ECONOMICS_*` types | same | Partisans |

### Phase 8: single-player only

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 8.1 | In a hotseat game `UI.log` has `[Economics] v0.2.0 loaded; multiplayer game, the mod is off` once, no batch line, no grant, the dock button absent | a hotseat start, vanilla | `ui/econ-bootstrap.js` `boot`, `ui/econ-engine.js` `isMultiplayer` |
| 8.2 | The same in a LAN-hosted game | a LAN host | same |

### Screens

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| S.1 | The screen opens from the dock button and from a click on the turn notification, draws framed with its own styles at 720p without horizontal scroll (the CSS and HTML load from `fs://game/tower-economics/`), `tower-bench lint` on the live screen passes (no dropped declarations), the tab bar keeps its selection across re-renders (2026-10-30, A: opens full window with its CSS from `fs://game/tower-economics/`, five tabs, no horizontal scroll at 2880 by 1800, `lint` clean for the screen; 720p and the notification click owed) | any, vanilla | `ui/econ-screen.js`, `ui/econ-screen.css` |
| S.2 | The Treasury tab's projection bars and the flows list read right against the ledger; the buildings block counts the Market and Bank | any | `ui/econ-view-treasury.js` |
| S.3 | The turn notification shows once per turn in the game's language, and its click opens the screen. The wording and the tenth-of-a-Gold floor were watched 2026-10-30 (0.4.0, below); a notice naming loans needs a player loan open | any | `ui/econ-notify.js` |
| S.4 | The pill's text follows the debt and turns red in default (2026-10-30: reads "No debt" (A, D); the default state owed) | any | `ui/econ-dock.js` `refreshPill` |
| S.5 | The dock button shows the coin icon (the SVG served from `fs://game/tower-economics/images/`), not a blank square | any | `ui/econ-dock.js` `ICON_URL` |

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
| C.1 | The setup screen shows Markets and trade bills, Tariffs and Foreign investment, all On; the boot line `[Economics] v0.3.0 loaded; ...` lists `markets`, `tariffs` and `investment` in its options | any, vanilla, then the usual set | A, D: the boot line lists `markets`, `tariffs` and `investment`, all true, in vanilla and the usual set |
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
| T.1 | Each card's line on a settlement's Gold and Happiness breakdown reads the flat amount, not a percentage (hover). Heavy (+4, -2) and War Levy at war (+8, -4) were read by script from `getYieldsForType` on 2026-10-30 (0.4.0, below); Light (-2 Gold, +4 Happiness) is owed, since no AI took it, and the hover itself is for a person | Antiquity 4242, vanilla, Light slotted (the player's own swap) | `data/econ-tax-gameeffects.xml` |
| T.3 | The Fiscal tab's forecast under each card equals the card's amounts times your settlements, and after a swap the settlements' summed Gold and Happiness move by that much | Antiquity 4242 | `ui/econ-tax-cards.js` `cardForecast`, `ui/econ-fiscal.js` `readFiscal` |

### Data and load

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.2 | With each option Off: Markets Off shows the Markets tab's off note and no bills; Tariffs Off hides the tariff row; Foreign investment Off greys the Trade tab's investment block; all three plus Loans Off and the batch logs `skipped, all-off` (2026-10-30, C: everything Off loads only `economics-game` and `economics-ai-lists`; the batch still logs `0 transfer(s)`, not `skipped, all-off`) | any, each option Off in turn | `ui/econ-session.js` `readOptions`, `ui/econ-plan.js` `skipReason` |
| C.3 | The markets envelope survives a save and reload: the Markets tab's prices and history and your tariff are the same after the reload | Exploration 9001 | `ui/econ-markets.js`, `ui/econ-session.js` `writeMarkets` |
| C.4 | A 0.2.0 save loads into 0.3.0 with its loans intact and no investments (ledger version 2 read as 3) | a 0.2.0 save | `ui/econ-state.js` `sanitizeLedger` |
| C.5 | The per-turn cost with the 1.1 reads on, at 8 civs: `tower-bench cost tower-economics --yes` under 50 ms | Exploration 9001 | `ui/econ-session.js` `readCommerce` |

### Prices

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.6 | The Markets tab lists this age's resources with a price, the copies held and a history bar per turn; a hand count of the copies of three resources on the map matches "copies held" (counted once at the origin, imports not again) (2026-10-30, B: `session().markets` holds prices and history; the tab and the hand count owed) | Exploration 9001, after 10 turns | `ui/econ-commerce-read.js` `readMarket`, `ui/econ-prices.js` |
| C.7 | A war between two majors lifts the price of this age's strategic resources over the next turns, and it eases after peace (smoothing 0.8, so a few percent a turn). In vanilla Exploration no unit names a strategic resource, so this needs Modern or Strategic Resources That Matter | Modern 4242, or the usual set | `ui/econ-prices.js` `demandPct` |

### Trade settlement

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.8 | With a route importing from an AI and the AI importing from you, the Trade tab shows one bill per partner, the side owing more pays, and both balances move by the same amount at the next `TurnBegin` (`UI.log` turn line counts the transfer); the turn notification has the trade line (2026-10-30, B: Japan's bill paid the player about 5 Gold a turn, the balance rising by it over net income; the paying side owed) | Exploration 9001, a route each way | `ui/econ-commerce.js` `settleTradeFor`, `ui/econ-view-trade.js` |
| C.11 | Where the game pays an exporter for a route, if it does: `getTradeYields()` read 0 in every route city in the 1.1 probes (C9). Read a route city's Gold yield breakdown by hand (or `calculateAllResourceTradeYields`); if the payment is found, point `readTradeIncomeCents` at it and the Trade tab's row shows (2026-10-30, B: `tradeIncomeCents` reads 0 for every civ, as `getTradeYields` read 0 in the 1.1 probe) | Exploration 9001, a person | `ui/econ-commerce-read.js` `readTradeIncomeCents` |
| C.12 | A Bazaar or Guildhall in the exporting city raises that route's bill by 10 percent; one in the importing city lowers it | same | `ui/econ-commerce-read.js` `routeEnds` |
| C.13 | "Routes you could make" lists foreign cities with what a route would bring and the bill it would add. C2 found `projectPossibleTradeRoutes` answers with `importPayloads` by turn 40; the tab's list is unwatched | same | `ui/econ-commerce-read.js` `readPossibleRoutes` |
| C.14 | Bills follow a war: a route a war ends drops out of the next turn's bill | same, a declared war | `ui/econ-commerce-read.js` |

### Tariffs

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.15 | The tariff row reads "Tariffs open with Imperialism" until that civic, then offers None, Low and High; a change shows "takes effect next turn", then the wait note for five turns | Exploration 9001, Imperialism granted | `ui/econ-view-fiscal.js` `tariffRows` |
| C.16 | Low and High lower what you pay that partner by 10 and 25 percent on the Trade tab and in the balances | same, a route importing | `ui/econ-trade.js` `owedByPair` |
| C.17 | A High tariff costs 1 relationship with each exporter you bill every five turns (`getRelationshipLevel` before and after) and the notification says why | same | `ui/econ-trade.js` `highTariffCosts` |
| C.18 | When you set High, each AI you import from sets High two turns later (a `tariff` event in the ledger) and drops back to None after you do | same | `ui/econ-trade.js` `aiTariffWanted` |

### Investment and aid

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.19 | A development loan on an AI city's current build: the build's progress jumps (by the points shown, scaled up by the city's production bonuses), only the Gold the progress used leaves your treasury, and the return arrives each turn for 25 turns; relationship up by the shown points | Exploration 9001, Guilds on both sides, a Neutral AI | `ui/econ-invest-open.js` `openInvestment`, `ui/econ-commerce-read.js` `sendProgress` |
| C.20 | How much progress a grant lands as (NOTES finding L: 20 sent read as 76.5): one development loan on a city with no production bonuses, percent before and after. P8's keep is settled (C3) | same | `ui/econ-commerce-read.js` `sendProgress` |
| C.21 | A city with nothing queued has no development loan button; at war or Unfriendly the buttons say why | same | `ui/econ-view-commerce.js` `investTargets` |
| C.22 | General investment: the Gold lands in the AI's treasury; the return each turn moves with its income (higher when it grows) | Exploration 9001, Colonialism on both sides | `ui/econ-invest.js` `dividendDue` |
| C.23 | Aid: Gold to the AI, nothing back, relationship up by the shown points | any, at peace | `ui/econ-invest-open.js` |
| C.24 | An AI Friendly with you offers an investment: the notification names it, the Trade tab shows it with Accept and Decline; Accept opens it (Gold or progress arrives next turn), Decline drops it, an unanswered offer is gone after three turns | Exploration 9001, a Friendly AI with 20 turns of income in hand | `ui/econ-commerce.js` `aiInvest` |
| C.25 | A host losing the city a development loan backs: the record closes, the notice names the Gold lost | a captured city | `ui/econ-invest.js` `lostCityWriteOff` |
| C.26 | Missing a return three times puts the record in default, the investor's later investments in you are refused, and the garnish runs | the player hosting, balance held low | `ui/econ-commerce.js` `payDividend` |
| C.27 | Repudiating an investor from the Loans tab closes what you host from it, with the grievance and witness costs of a loan repudiation | the player hosting | `ui/econ-repudiation.js` |
| C.28 | AI aid: an AI Friendly with a civ in default sends it 5 turns of its income once in the age (ledger event `invest` with aid 1) | soak | `ui/econ-commerce.js` `aiAid` |

### Military Aid's initiator pays

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.35 | The data group loads with Foreign investment on (`Database.log` clean) and is absent with it off | Exploration 9001, vanilla | `data/econ-investment-*.{xml,sql}` |
| C.36 | An AI that starts Military Aid loses 2 Gold a turn (scaled by age) while its target gains 2, for the endeavor's turns: `Player_Treasury.csv` for both, the levy-free way C13 couldn't separate (compare the same seed with the option off) | Exploration 9001, 120 turns, `AIVerboseLogging 1` | same |
| C.37 | AIs still start Military Aid about as often with the charge as without (C13 counted 7 in 120 turns with no charge on the levy game) | same, on and off | same |
| C.38 | The yield breakdown names "Military Aid sent" on the initiator (hover) | a person | `LOC_ECONOMICS_MILAID_PAY_NAME` |

### Roles, other mods, soak

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| C.29 | The Treasury tab counts Trade, Warehouse and Industry buildings: a Bazaar counts as Trade, a Granary as Warehouse, a Factory as Industry | Exploration then Modern | `ui/econ-depth.js` `rolesOf` |
| C.30 | NOTES finding J: an Exploration civ with Antiquity Markets standing reads them as Trade but not Commerce (the Market's `GOLD` tag is gone in Exploration's database); read `__towerEconomics.input().civs[k].depthTurns` and the Treasury block | Antiquity 4242 into Exploration | `ui/econ-engine.js` `readBuildings` |
| C.31 | A test mod that adds a Gold building, retags another and removes a resource: depth, the Trade count and the Markets list follow it | a small test mod | `ui/econ-engine.js` `buildingData`, `ui/econ-commerce-read.js` `readMarket` |
| C.32 | Warehouse Overbuilding alongside: building over a warehouse changes the Warehouse count and nothing else | usual set with Warehouse Overbuilding | `ui/econ-depth.js` |
| C.33 | 100 turns of `lab drive` in Exploration with 0.3.0 on, and the same seed with Markets, Tariffs and Foreign investment Off: no crash or hang; per civ the bills paid and received, tariffs set, investments, aid and returns, against each AI's balance; route counts on and off (whether the bill changes how many merchants the AI sends) | Exploration 9001, vanilla | `ui/econ-bootstrap.js` |
| C.34 | Phases C.8, C.17, C.19 once with the usual set: Demographics' Gold chart shows the bills as balance moves | Exploration 9001, usual set | `docs/compatibility.md` |

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
| M.1 | The three 1.2 options show under Game Options with Inflation Off, Business cycle Standard and Economic systems On; the boot line `[Economics] v0.4.0 loaded` names them in its options | vanilla, shell | `config/econ-setup.sql`, `ui/econ-bootstrap.js` |
| M.2 | The systems group loads with Economic systems and Taxes on in each age (`Database.log` clean), and is absent with either off; `GovernmentModifiers` holds the age's `MOD_ECONOMICS_SYS_*` rows | Antiquity 4242, then each transition | `data/econ-systems*.{xml,sql}` |
| M.3 | Against a database with every DLC row removed, `PRAGMA foreign_key_check` lists the same rows before and after the systems SQL | the release check, all three ages | same |
| M.4 | The ledger's windows carry on across an age change: a miss from the old age's last turns still counts in standing (the first-turn batch was watched 2026-10-30, 0.4.0, below) | transition, a player loan open across it | `ui/econ-turn-count.js`, `ui/econ-session.js` `turnNow` |
| M.5 | A save made after a change in 0.3.0, loaded in 0.4.0, runs its next batch | a 0.3.0 save past an age change, if one exists | `ui/econ-turn-count.js` `countTurn` |

### The business cycle

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.6 | A war between two AIs: the World tab's index drops the turn after it starts (by 0.005 before any civ has Public debt, 0.012 from it, 0.02 from Capitalism), both warring civs' own index lower than the others', "a war declared" listed with both names | Exploration, two AIs at war (the transition game's wars) | `ui/econ-macro.js` `cycleStep` |
| M.7 | Peace lifts both; the index drifts back toward 1.00 between events | same | `ui/econ-cycle.js` |
| M.8 | A capture by combat weighs on the civ that lost the settlement; a city-state incorporated (`BY_INCORPORATE_CITY_STATE`) weighs nothing | a war with a capture | `ui/econ-macro-read.js` `captureEvent` |
| M.9 | A flood or eruption on a civ's land: "a disaster" on the World tab for that civ, twice the weight when its settlement lost population by the next turn, half with a Granary-type food warehouse there | the M6 `disasters` overlay | `ui/econ-macro-read.js` `disasterEvent` |
| M.10 | The age's crisis: "the age's crisis" on its first turn, then a small weight each turn it runs | an age past progress 84 | `ui/econ-cycle.js` `crisisEvents` |
| M.11 | A boom pays cycle Gold and a slump charges it (`Player_Treasury.csv` against the turn's ledger transfer `CY<pid>`); bond rates on the Loans tab move with the player's own index | any game with the index off 1.00 | `ui/econ-macro.js` `cycleInflows`, `macroPayerSteps` |
| M.13 | A reload replays the same index and events (save, reload, compare the World tab and `__towerEconomics.session().macro`) | any | `ui/econ-macro-state.js` |
| M.14 | A Panic: the World tab's red pill, its notification, civ lenders refusing for five turns, bond rates up by half. Needs leverage above 1.5 in a boom from Banking, which the balance run never reached (NOTES finding Q): the player borrowing heavily in a boom, or a scripted ledger (merged run 2026-10-30: the Panic, its notice and no loans for five turns watched at Modern t35; the pill and the bond-rate rise owed) | Exploration past Urban Planning, a heavy borrower | `ui/econ-macro.js` `startPanic` |
| M.15 | The pill reads "debt · phase" with the cycle on, plus inflation with Inflation on | any | `ui/econ-bootstrap.js` `pillSource` |

### Inflation (option On)

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.16 | Bond debt beside idle Gold: the World tab shows a rate above 0 with its cause; the Treasury tab shows the reserve and next turn's erosion; the balance above the reserve shrinks by that each turn (transfer `IN<pid>`); bond rates rise | Exploration 9001, Inflation On, the player borrowing from the bond market with a large balance | `ui/econ-macro.js` `inflationStep`, `erodeFor` |
| M.17 | Repaying the bond loan takes the rate back to 0; with the option Off nothing erodes and the World tab says so | same | same |

### Old buildings

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.19 | Antiquity Markets in Exploration: the Treasury tab lists each at 1.00 "full until you reach" Guilds or Economics, then fading 0.05 a turn to 0.50 after the civic; Commerce reads through the remembered roles though the Market's `GOLD` tag is gone (NOTES finding J) | Antiquity 4242 into Exploration with Markets standing | `ui/econ-macro-read.js` `cityEconomy`, `ui/econ-legacy.js` |
| M.20 | A Guildhall built in a Market city drops that Market to its floor at once, "a newer building with its role stands in this city" | same | `ui/econ-legacy.js` `roleWeight` |
| M.21 | Into Modern: Antiquity Markets at 0.50 fading to 0.25, Exploration Banks full until Capitalism; the World tab's legacy and cushion grow | the second transition | same |
| M.22 | Depth and the credit limit follow the weights (`__towerEconomics.input().civs[k].depthFactorPct` before and after a fade) | same | `ui/econ-depth.js` `computeDepth` |
| M.23 | Warehouse Overbuilding alongside: a warehouse it strips of `AGELESS` ages and fades | usual set with Warehouse Overbuilding | `ui/econ-legacy.js` `isOld` |

### Economic systems

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.24 | The Fiscal tab names the system from the government (Classical Republic: Civic market), keeps it through the first turn of an age when the government reads none, and shows the blend's turns after a change; each AI's system in `__towerEconomics.session().macro.systems` | Antiquity 4242 and the transition (M4: none on turn 1, picks on turn 2) | `ui/econ-systems.js` `nextSystems`, `ui/econ-view-fiscal.js` |
| M.25 | With Heavy Taxation slotted under Despotism, a city's Gold breakdown shows +1 "Palace economy" beside the card's +4; under Classical Republic, Light Taxation shows +1 Happiness "Civic market"; War Levy under Authoritarianism pays in peace | a person hovering, or `city.Yields` before and after a swap | `data/econ-systems-gameeffects.xml` |
| M.26 | An ideology takes over in Modern: Communism reads Planned, the Corporatist government rows stand aside for a Democracy, and Fascism's branch-root rows pay War Levy in peace | Modern, the M5 game's ideologies | same, `ui/econ-macro-read.js` `readIdeology` |
| M.27 | Citizen loans: a Classical Republic player sees "your citizens" on the Loans tab within its cap; the meter rises by twice each turn's interest; a miss costs celebration, not Influence; repudiating them costs the meter 10 turns of its gain and closes them 30 turns | Antiquity 4242 as Classical Republic with two market towns | `ui/econ-lenders.js` `withCitizens`, `ui/econ-citizens.js` |
| M.29 | The plan: a Communist civ's cities' builds advance by its take each turn (`addProgress` log lines, one per city), the Fiscal tab shows the take, and its bills use the class prices | Modern, a Communist civ | `ui/econ-macro.js` `planFor` |
| M.30 | A Theocracy's loan to the player: its interest follows the player's income (payment parts before and after the player's income moves) | Exploration, a Theocracy lending | `ui/econ-plan.js` `payOne` |
| M.31 | Tribute borrows from civs only (no bond offer on the Loans tab); a Corporatist host refuses general investment with the reason "their economic system takes development loans only" | Exploration and Modern | `ui/econ-lenders.js`, `ui/econ-invest-open.js` |
| M.32 | The AI aids a Friendly civ in its own Depression (ledger `invest` with aid 1) | soak with a war-torn civ | `ui/econ-commerce.js` `aiAid` |

### Soak and other mods

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| M.33 | 100 turns of `lab drive` across a transition with every 1.2 part on (Inflation On), and the same seed with Inflation, Business cycle and Economic systems Off: no crash or hang; per turn E and each civ's phase, system, cycle Gold, erosion, citizen loans and the plan; `tower-bench cost tower-economics --yes` | Antiquity 4242, vanilla | `ui/econ-bootstrap.js` |
| M.34 | Whether the world leans to Boom in play as in the simulation (NOTES finding P): the share of turns in each phase over that soak | same | `ui/econ-cycle.js` |
| M.35 | M.6, M.19 and M.24 once with the usual set: Demographics charts the cycle Gold as balance moves, Partisans and Emigration read the celebration meter's moves | Antiquity 4242, usual set | `docs/compatibility.md` |
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
| G.1 | A transition game: on each age's first pick every AI takes the government `docs/government-biases.md` gives its civ, and the tally per age matches the table (for the civs in that game) (merged run 2026-10-30: watched for the 15 civs of that game; other civs owed) | Antiquity start through Modern with Economic systems On, AI civs from the table, vanilla | `data/econ-government-biases.sql` |
| G.2 | The changed picks move: Carthage takes Oligarchy and Maurya Classical Republic in Antiquity; Iceland and Shawnee Theocracy, Spain, Goryeo and the Pirate Republic Plutocracy in Exploration; Great Britain and Meiji Elective Republic, Buganda Authoritarianism in Modern (merged run 2026-10-30: Goryeo and Meiji watched; the rest owed) | the same game, or a start in each age with those civs | same |
| G.3 | Heian takes Classical Republic by its corrected row, and a civ that had no row (Babylon, Gaul, Silla, England, Joseon, Ottomans) takes its new pick rather than the age's first government (merged run 2026-10-30: Heian and the Ottomans watched; the rest owed) | Antiquity, Exploration and Modern starts with them | same |
| G.4 | With Economic systems Off the picks fall back to the game's own (Spain Feudal Monarchy, Meiji Authoritarianism) | one Exploration and one Modern start, Economic systems Off | `economics.modinfo` `systems-option-on` |
| G.5 | The game starts and the rows load without the DLC civs' parents: `Modding.log` and `Database.log` show the file loaded with no error | a game with a DLC switched off, or the lab's compiled database with a DLC disabled | same |
| G.6 | A shared `GovernmentBiases` row at 50 on `TRAIT_LEADER_MAJOR_CIV` (the probe's `gov bias` arm) no longer moves any civ off its own pick | Antiquity 4242 with the probe overlay | same |
| G.7 | Each AI's system in `__towerEconomics.session().macro.systems` follows its pick, three systems in Antiquity and Exploration and at least two in Modern before the ideologies (merged run 2026-10-30: watched; Antiquity had two systems because no civ in the game leans to Oligarchy) | the G.1 game | `ui/econ-systems.js` |

## Owed: Light and War Levy (arms)

Light Taxation at -1 Gold and +6 Happiness, and War Levy at +2 Gold and -1 Happiness in peace with +6 and -3 more at
war (DESIGN 4.7, NOTES 101 and finding V). The shapes were watched in the Light arms' probe games on 2026-10-30
(`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-light-arms.md`, arm 10 and every arm's War Levy), and in the
built mod on the same day (L.2 to L.7 under "Watched 2026-10-30 (merged build)"). L.1's later ages are left open.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| L.1 | Some AIs but not all slot Light, each once grown and short of Happiness (arm 10: Hawaii t69, Persia t92, Dai Viet t107); Goryeo and Hawaii still take Heavy at their second slot, and the AIs take War Levy (merged run 2026-10-30: Antiquity watched, 2 of 5; in Exploration and Modern all five AIs slot Light and keep it, at high Happiness: see "Watched 2026-10-30 (merged build)"; Light by age answers it in 0.5.1, LA.2 below) | Antiquity 4242, `--setup fast --quick`, Economics alone, 110 turns of `lab drive` with a per-turn card reading | `ui/econ-tax-cards.js` `CARD_LEVELS`, `data/econ-tax-gameeffects.xml` |

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
| LA.1 | A Light holder's first settlement shows "Light Taxation" at 1 off Gold and +6 Happiness in Antiquity, +4 in Exploration, +3 in Modern; the database holds `MOD_ECONOMICS_LIGHT_HAPPINESS_AQ` 6, `_EX` 4, `_MO` 3 and each age's Light card names `LOC_ECONOMICS_CARD_LIGHT_DESCRIPTION_<age>` | the three-age game | `ui/econ-tax-cards.js` `CARD_LEVELS`, `data/econ-tax-gameeffects.xml`, `data/econ-tax-cards-*.xml` |
| LA.2 | How many AIs slot Light in Exploration and Modern at +4 and +3, against the merged watch's 5 of 5 from t13 to t57 at 35 to 266 Happiness; Antiquity still about 2 of 5, grown and short of Happiness. The owner judges the count | same | the tally's "AIs slotting Light" line per age |
| LA.3 | The Fiscal tab in Exploration reads Light as "Gold -1, Happiness +4" and its forecast as 4 Happiness a settlement; in Modern +3 | same, the screen's DOM at each age's last turn | `ui/econ-view-fiscal.js` `cardBlock`, `ui/econ-tax-cards.js` `cardForecast` |
| LA.4 | The policy menu's Light card reads "-1 Gold and +6 Happiness in each settlement." in Antiquity, +4 in Exploration, +3 in Modern | same, a policy-screen read or a capture | `text/en_us/ModText.xml` |
| LA.5 | Each age starts with Taxes on and `Database.log` clean; a Feudal Monarchy civ holding Light shows "Manorial economy" +1 Gold beside Light's 1 off and +4 | same | `data/econ-systems.sql` |
| TD.1 | An AI holding a tariff drops it about 20 turns after it started (up to 25 with the 5-turn limit) while at peace with the civ behind it: a `tariff-eased` ledger event naming the AI and the other civ, then a `tariff` event to None | Modern from turn 1 (the Tariffs stage opens there), the three-age game | `ui/econ-trade.js` `easeTariffs`, `ui/econ-commerce.js` `aiTariff` |
| TD.2 | After easing off, the AI stays down while the other side still holds High: no raise in the 5 turns after any `tariff-eased` event (the tally prints `RE-RAISE` if one happens), and pairs that stood at High on both sides both end at None | same | `ui/econ-trade.js` `stillEased` |
| TD.3 | At the end of Modern most AIs are at None (the merged watch had all five at High from t11 to t143); `session().markets.tariffPeace` and `tariffEased` hold the counts and easings by "ai-other" | same | `ui/econ-markets.js` |
| TD.4 | A war between an AI and a civ it had eased off clears the easing (the pair leaves `tariffEased`), and a tariff that war gives reason for comes back | a Modern war between two traders, if the game has one | `ui/econ-trade.js` `easeOne` |
| TD.5 | An AI Friendly with the player doesn't answer the player's tariff, and drops one it already answered at once | Exploration or Modern, the human Friendly with a trading AI | same |
| TD.6 | A 0.5.0 save loaded into 0.5.1 with AIs at High: they drop about 20 turns after the load | a Modern save from the merged watch, if one was kept | `ui/econ-markets.js` `sanitizeMarkets` |

## Owed: Heavy after Priesthood and the bar pill (0.5.2)

- HP.1 Antiquity: Heavy Taxation shows in the policy list only once Code of Laws is done; Light at Chiefdom as before.
- HP.2 The AIs' first Heavy picks come after their Code of Laws, and Priesthood gets slotted by some.
- BP.1 The debt pill sits in the top resource bar after the settlement limit, in the world view and the city view,
  and redraws after a turn and after a borrow; the dock button still opens the screen.
- TN.1 No turn notice for a net under 2 Gold; a larger one reads in whole Gold ("-13", not "-12.5").
- BR.1 The setup screen reads "Base Interest Rate" with the new tooltip.

## Owed: Economic swings (0.5.3)

Built 2026-10-30, offline only (NOTES 118). Nothing here has been seen in a game.

- SW.1 The setup screen lists Economic swings after Business cycle, Volatile by default, with the three descriptions.
- SW.2 On Volatile, over a 100-turn soak into Exploration, the World tab's index leaves 0.85 to 1.07: a slump runs
  on for several turns after the war or crisis that started it, and a boom overshoots before it turns. The cycle line
  on the Treasury tab and the turn notice show tens of Gold in a deep slump for a civ with about 60 income.
- SW.3 The AIs carry a Volatile depression: no AI default the turns after one starts, and their own balances stay
  above the game's negative line (the auto-loan guard covers them where it must).
- SW.4 A save made mid-depression with the index below 0.7 loads with the same index (`__towerEconomics.session()
  .macro.cycle.e`), not 1.0.
- SW.5 On Gentle the cycle runs as 0.5.2 did; on Mild a Panic drops the index by 0.1.

## Owed: UI polish

Built 2026-10-31 on the `ui-polish` branch, offline only: the fake-DOM tests in `tests/econ-views.test.mjs` and
`tests/econ-view-tabs.test.mjs` cover the rules and the text keys, and nothing here has been seen in a game. One
Antiquity game reaches UP.1 to UP.6 and UP.9 (Economics alone, Antiquity seed 4242, `--setup fast --quick`, the screen
open on turn 1, again after Code of Laws and again after Moneylending); UP.7 and UP.8 are captures of the same screen
at three window sizes.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| UP.1 | Turn 1, Treasury tab: no Debt figure in the strip at the top, no "Owed on loans", "Loan payments due next turn" or "Share of income going to loans" rows, no debt-service scale (and no "At a glance" box when the cycle and inflation are off too), and "Next 20 turns" draws one gold line with "Balance in 20 turns" under it and no "With your loans" legend | Antiquity turn 1 | `ui/econ-view-tabs.js` `sectionsFor` (`treasury.loanFigures`), `ui/econ-view-treasury.js` `balanceProjection` |
| UP.2 | The turn the Loans tab appears (Moneylending, an emergency loan, or a citizens' offer), the Debt figure and the Treasury tab's three loan rows, the scale and the two-line chart appear | same game, after Moneylending | same |
| UP.3 | With Economic stages Off, turn 1's Treasury tab shows the loan rows, the scale and the two-line chart | Antiquity, Economic stages Off | same |
| UP.4 | The Loans tab's "Your limits" reads "Most you can borrow over 10 turns" with the figure the borrow form's amount opens on, and both say the same; when the payment limit holds it back, the line under it reads "A bigger loan would push your loan payments past 50% of your income, and lenders stop there." Picking 20 turns changes the figure in both places | after Moneylending, a human seat with a low income (about 10 to 20 Gold) | `ui/econ-view-borrow.js` `borrowLimit`, `limitLines`; `ui/econ-view-loans.js` `limitsSection` |
| UP.5 | Before Code of Laws, the Treasury tab has a "Send aid" section: the amount, then a card per met civ with its Aid line and relationship gain; Aid opens the confirmation and next turn the Treasury history reads "... sent ... Gold of aid". A civ the Spoil Guard hides has no card | Antiquity, before Code of Laws, one civ met and one not | `ui/econ-view-trade.js` `aidSection`, `ui/econ-view-tabs.js` (`treasury.aid`) |
| UP.6 | After Code of Laws the "Send aid" section is gone from the Treasury tab and aid is on the Trade tab only | same game, after Code of Laws | same |
| UP.7 | At 1720p full screen the screen's body text reads at the size of the Civilopedia's text and the section titles a step larger; the frame ends a little under the last section rather than at the bottom of the screen, with a 50vh floor, and a long tab (Loans after Moneylending) still reaches 93vh and scrolls | 1720p full screen; Treasury on turn 1 and Loans later | `ui/econ-screen.css` (`.econ-screen-frame`, every `font-size`) |
| UP.8 | At 1280x720 and at a 4:3 window the screen still fits: the frame stays inside the window, the tab scrolls, the columns stack at 4:3, and nothing is cut off at the right | windowed 1280x720 and 1024x768 | same |
| UP.9 | The citizens' offer card in the borrow form reads "Your citizens" as its title, while a loan from them reads "Owed to your citizens" | Antiquity as Classical Republic with a Commerce building, so the citizens offer | `ui/econ-view-borrow.js` `lenderTitle`, `text/en_us/ModText.xml` |

## Owed: model fixes

Built 2026-10-30 on the `model-fixes` branch, offline only (NOTES findings P to U and W to Y, choices from 102). Nothing here has
been seen in a game.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| F.1 | Over a 100-turn soak the World tab shows Slump and Steady turns and, once loans run, Boom; a turn listed "the world's income growing faster than usual" or "slower than usual" matches the world's income in the log against its own trend; a boom of five turns or more lists "a long boom running out of steam" (merged run 2026-10-30: Slump, Steady, Boom and "a long boom running out of steam" watched; the trend lines against the log owed) | Antiquity 4242 into Exploration, every 1.2 part on | `ui/econ-cycle.js` `trendEvents`, `overheatEvents` |
| F.2 | A save made mid-boom and loaded keeps the trend and the boom's turn count (`__towerEconomics.session().macro.cycle.trend`, `boomTurns`) | any game with the cycle on | `ui/econ-macro-state.js` |
| F.3 | A Communist civ's plan at 4 Gold a point: the take's Gold over 4 is the points the cities' builds gain that turn (`addProgress` log lines); with a mod that changes `GOLD_PURCHASE_MULTIPLIER`, the points follow its value | Modern, a Communist civ | `ui/econ-planned.js` `planSplit`, `ui/econ-session.js` `readParams` |
| F.4 | At 20 Gold of income, asking the bond market for 300 Gold over 10 turns is refused for the credit limit, the notice says the most is 83 Gold over 10 turns, and "Borrow that instead" on the Loans tab borrows 83 | Exploration with Public debt, a human seat at about 20 Gold | `ui/econ-requests.js` `mostBorrowCents`, `ui/econ-view-borrow.js` |
| F.5 | Before Public debt, the Loans tab offers 10- and 20-turn terms and a civ lends over 20 turns at 1.5 percent; the setup screen's Rates text and the stage names read the new figures | Antiquity 4242 after Commerce | `ui/econ-lenders.js` `termRefusal`, `ui/econ-view-model.js` `termsOpen` |
| F.6 | An AI with a city building something takes a bond or civ loan now and then (ledger loan with source `ai-build`, about once per 10 turns per AI while its phase is Steady or Boom), and the build's progress jumps by the loan's Gold over 4 the same turn (`addProgress` log line naming the loan) (merged run 2026-10-30: the loans watched, 39 in Exploration and 81 in Modern; the `addProgress` line naming the loan wasn't in `UI.log`, so the progress jump is owed) | soak, Exploration with Public debt | `ui/econ-shortfall.js` `aiBuildBorrow` |
| F.7 | The World tab's leverage reads in turns of the world's income, goes red above 1.7, and a boom with leverage above it after Banking starts a Panic with its notice; the next one waits 60 turns (merged run 2026-10-30: leverage in turns and the Panic with its notice watched at Modern t35; red above 1.7 and the 60-turn wait owed) | soak past Urban Planning | `ui/econ-cycle.js` `leverPct`, `panicStarts`; `ui/econ-view-world.js` |
| F.8 | On the first turn of Exploration, a civ holding more than the cap gets "The age change kept 6,000 of your ... Gold" in its notice and the Treasury history lists every civ that was cut; the ledger takes the engine's balance as it stands | Antiquity 4242, the human holding over 6,000 at the change (a `grantYield` before `lab age-change`) | `ui/econ-plan.js` `ageGoldCuts` |
| F.9 | The turn notice reads "from trade bills and the business cycle"; a turn with two wars declared reads "after 2 wars declared"; the Fiscal tab reads "next turn" one turn from a celebration (merged run 2026-10-30: "from trade bills and the business cycle" watched; the war count and the celebration line owed) | any soak with the human trading | `ui/econ-notice-text.js` `composeArgs`, `causeItems`; `ui/econ-view-fiscal.js` |
| F.10 | Trade bills read a few tenths of a Gold a copy on the Trade tab and the cap line rarely shows "waived"; an AI that pays a big Neutral partner sets Low (ledger `tariff` event), one Unfriendly with a big partner sets High, and a Low tariff the player sets is answered with Low two turns later and dropped when the player drops it (merged run 2026-10-30: bills of a few tenths and AI High and Low watched in Modern; all five held High 130 turns, which 0.5.1 answers with TD.1 to TD.6; the player's Low answered is owed) | Exploration after Imperialism, the human with routes to two AIs | `ui/econ-trade.js` `aiTariffWanted`, `ui/econ-commerce.js` `aiTariff` |
| F.11 | With an AI in default, the Trade tab greys its general investment with the reason and a "Set up a development loan instead" button; the button lists that AI's builds at the same Gold and sends nothing until one is picked; a general request queued anyway is refused with the notice line naming the development loan | Exploration after Colonialism, an AI pushed into default (a deficit spell, or a probe) | `ui/econ-view-trade.js` `projectCard`, `ui/econ-invest-open.js` `investRequestRefusal` |
| F.12 | A Classical Republic player paying 3 Gold of interest to its citizens sees the celebration meter rise by 18 that turn (6 a Gold, the same as Light Taxation's 6 Happiness for its 1 Gold) | Antiquity 4242 as Classical Republic with two market towns | `ui/econ-citizens.js` `interestCelebrationCents` |

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

## Owed: whole-Gold payments

Built 2026-10-31 (NOTES 119). The engine fact was watched that day; the fix itself hasn't been seen in a game.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| WG.1 | Over 10 turns with the cycle's small shares, an AI's balance moves by a whole Gold every few turns, and the sum it moved matches the sum of its nets to within one Gold | Antiquity, cycle Standard | `ui/econ-batch.js` `commitBatch` |
| WG.2 | A UI reload in the middle of a turn logs `0 re-sent` when every payment was under a Gold or landed | same | `ui/econ-session.js` `resendLostBatch` |
| WG.3 | `__towerEconomics.session().glue.landed` names the civs paid this turn a few seconds after `TurnBegin` | same | `ui/econ-session.js` `noteLanded` |

## Owed: Spoil Guard

Built 2026-10-31, offline only (`ui/econ-spoil.js`, `ui/econ-options.js`). Nothing here has been seen in a game.

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| SG.1 | Options, Mods shows an Economics group with a Spoil Guard checkbox, ticked, from the main menu and in a game | any | `ui/econ-options.js` |
| SG.2 | With civs unmet: the Trade tab and the lending chips list only met civs, and a World event between unmet civs reads "an unmet civilization" | Antiquity, early turns | `ui/econ-spoil.js`, `ui/econ-view-summary.js` |
| SG.3 | Unticked, every civ is listed (the unmet ones with "you haven't met them yet"); ticked again after a game restart, the choice is kept | any | `ui/econ-settings.js` |
| SG.4 | With Demographics installed and its guard on, unticking ours still hides unmet civs | Demographics on | `ui/econ-spoil.js` `combinedPolicy` |
| SG.5 | Meeting a civ adds it to the Trade tab on the next redraw | first contact | `ui/econ-spoil.js` `civHidden` |

## Owed: ui-pass

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| U.1 | A controller: the tab bar's bumpers change tab; accept on a button, chip or stepper step presses it (they're `fxs-activatable`); focus shows on chips and steps | any, a controller | `ui/econ-dom.js` `control` |
| U.2 | Escape closes the screen | any, a person at the keyboard | `ui/econ-screen.js` `onEngineInput` |
| U.3 | Hovering a chart's turn shows that turn in the readout under it; hovering a figure shows its tooltip | any, a person | `ui/econ-dom.js` `lineChart` |
| U.4 | The Loans tab appears before Commerce for a temple or emergency loan, and for a Civic market civ with a Commerce building, then goes when the loan closes; a remembered Loans tab falls back to Treasury | Antiquity, income below 0 / Classical Republic | `ui/econ-view-tabs.js` |
| U.5 | A save loaded from 0.5.2 says nothing about tabs already open, then announces the next one | a 0.5.2 save | `ui/econ-session.js` `noteOpened` |
| U.6 | The tariff row appears with Imperialism and the chips set a tariff, its line beside it | Exploration | `ui/econ-view-fiscal.js` |
| U.7 | Inflation's scale on the Treasury and World tabs with Inflation on and Public debt reached | Exploration, Inflation On | `ui/econ-view-instruments.js` |
| U.8 | The screen at 1280x720 and at a 4:3 window: one column, nothing cut off | window sizes | `ui/econ-screen.css` |
| U.9 | The turn notification itself in the train, the opening sentence first (the lines were read from `UI.log`, the notification wasn't opened) | any | `ui/econ-notify.js` |
