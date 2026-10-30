# What has been watched, and the runs behind it

Nothing in a running game yet. Version 0.2.0 (2026-10-29) was built and checked offline only: `npm run release:gate`
(248 tests, tsc, ESLint, check-esm, coverage), Stryker on the rule modules, and the tax SQL applied to a copy of the
compiled 1.5.0 Exploration database (`tests/econ-data.test.mjs` with `CIV7_GAMEPLAY_DB` set). The reader-facing
account is the [README](../README.md); this file is the evidence behind it, in the form Canals' `docs/verification-runs.md`
uses.

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
| 1.1 | A bond loan queued from the console (`__towerEconomics.request({ kind: "borrow", borrower: me, lender: "bond", principal: 30000, term: 10 })`) lands at the next `TurnBegin`: the balance rises by 300 within about 1 s, `UI.log` has `[Economics] turn N (TurnBegin N): 1 transfer(s), 1 grant(s)` | Exploration 9001, vanilla, Public debt reached (or Economic stages Off) | `ui/econ-session.js` `runTurn`, `ui/econ-bootstrap.js` `onTurnBegin` |
| 1.2 | Each following turn the balance moves by exactly the payment the Loans tab shows, and the lender's (an AI's) balance rises by the same amount in the same turn | same, with a civ lender | `ui/econ-session.js` `sendPlan`, `ui/econ-plan.js` `payOne` |
| 1.3 | Save and reload mid-turn: the Loans tab shows the same loans and payments; the next turn's batch runs once (`already-planned` isn't logged twice, no second grant) | same | `ui/econ-session.js` `loadSession`, `ui/econ-plan.js` `skipReason` |
| 1.4 | The reload check: a save forced in the second after `TurnBegin` (before the grants land, P15's window) reloads with `[Economics] batch Bn re-sent for player 0` and the balance ends where the ledger says | same | `ui/econ-session.js` `resendLostBatch`, `ui/econ-batch.js` `batchStatus` |
| 1.5 | A turn isn't applied twice when `TurnBegin` fires more than once for one turn (log shows one batch per turn number over 20 turns) | same | `ui/econ-plan.js` `skipReason` |
| 1.6 | The order-free resolve holds in game: the same seed and loans give the same transfers whatever order `Players.getAliveMajorIds()` lists civs in (compare `UI.log` of two runs) | same | `ui/econ-turn.js` `turnContext` |
| 1.7 | A payment with a balance below the payment is missed, not overdrawn: the balance never goes below `-income` after a batch, and the engine's bankruptcy banner shows only when it would have anyway | Antiquity 4242, vanilla, a player who spends to near 0 | `ui/econ-batch.js` `funds`, debt-6 |
| 1.8 | The per-turn cost: `tower-bench cost tower-economics --yes` reads the batch under 50 ms at 8 civs | any | `ui/econ-session.js` `runTurn` log line |
| 1.9 | Load a save made before its turn's batch ran (a save request that beat the batch, or one copied from the turn before the mod's first batch): `UI.log` has `turn N (load catch-up from turn N-1)` once, the payments land, and the next `TurnBegin` runs the next turn as usual; if the local turn was already active, the notification shows at load | same | `ui/econ-bootstrap.js` `catchUp` |

### Phase 2: player loans

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 2.1 | Loans tab, Borrow: the bond market and each civ that will lend show with rate, payment, total interest and the share of income the payments would take with the loan; Borrow queues the request and the principal arrives next turn; the notification names the loan | Exploration 9001, vanilla | `ui/econ-view-borrow.js`, `ui/econ-notify.js` |
| 2.2 | Borrow from an AI: its balance falls by `P` that turn and rises by each payment | Exploration 4242, vanilla | `ui/econ-requests.js` `borrowRefusal` |
| 2.3 | Repay all or half: the next payment takes the extra and the loan closes early, with a `closed` line in the Treasury flows | same | `ui/econ-requests.js` `addExtra` |
| 2.4 | Spend to 0 and miss three payments in a row: three miss notices with the climbing rate, Influence -5 each, then the default notice; the garnish lines show each turn; the lender refuses a new loan for the age | same | `ui/econ-plan.js` `recordMiss`, `garnishOne` |
| 2.5 | Restructure an overdue loan: the preview shows the 10-turn schedule, after confirming the next payment is the smaller one, a second restructure button is greyed; with income at or below 0 the refusal names it | same | `ui/econ-view-loans.js` `restructureConfirm`, `ui/econ-requests.js` `restructureLoan` |
| 2.6 | The limits refuse: a principal over the credit limit shows "over your credit limit" on the offer row and is refused in the turn notice; one whose payment passes 35 percent of income shows the service refusal | same | `ui/econ-requests.js` `limitRefusal` |
| 2.7 | 20- and 30-turn terms appear only with Public debt, and from a civ only with a Bank; a civ with Moneylending alone offers 10 | Antiquity 4242 then Exploration | `ui/econ-view-model.js` `termsOpen`, `ui/econ-lenders.js` `termRefusal` |
| 2.8 | Lend to an AI in shortfall with positive income: it accepts by rule, the player's balance falls by `P` and rises each turn; an AI with income at or below 0 declines with the reason in the notice | Exploration 4242 | `ui/econ-requests.js` `lendRefusal`, `ui/econ-ai.js` `aiAccepts` |

### Phase 3: guard

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 3.1 | With income below 0 and the balance about to cross 0, the guard's loan lands the turn before the crossing: no unit is disbanded, the notice names the amount and the lender | Antiquity 4242, vanilla, before Commerce (temple treasuries) | `ui/econ-shortfall.js` `guardFor`, `ui/econ-guard.js` |
| 3.2 | The same after Commerce (a civ lender when cheaper) and in Exploration after Economics (the bond market; temple treasuries no longer named) | Antiquity 4242 after turn ~40; Exploration 9001 | `ui/econ-lenders.js` `emergencyOffersFor` |
| 3.3 | A dip with positive income: the guard does nothing, the balance reads 0 after the roll, and nothing is disbanded (P4) | Antiquity 4242 | `ui/econ-guard.js` `guardDecision` ("income-positive") |
| 3.4 | At `emergency_cap` the guard stops with one notice naming the cap, the deficit and the disband line; the game's own penalties then apply as P4's negative-income branch shows (which unit goes, and when, is itself unwatched) | same, deficit held past the cap | `ui/econ-shortfall.js` `noteCap` |
| 3.5 | The Loans tab switch: Off and the guard stays out (balance crosses 0, penalties apply); On again and it fires; the switch survives a reload | same | `ui/econ-session.js` `setGuard` |
| 3.6 | After five turns of income at or below 0 the insolvency notice shows once, and the Treasury tab's line stays while it holds | same | `ui/econ-plan.js` `trackIncome` |

### Phase 4: repudiation

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 4.1 | Repudiate an AI lender: the preview's numbers (Gold kept, grudge, witnesses, standing, closure); after confirming no Gold moves, the lender's grievances against the player read `grudge * 1000` higher in the relationship panel, each met civ's relationship reads 3 lower (`getRelationshipLevel` before and after), the lender's offers disappear this age and next, other rates rise and the credit limit shrinks by 4 turns of income | Exploration 4242, vanilla | `ui/econ-requests.js` `repudiateFor`, `ui/econ-engine.js` `bookGrievance`, `bookRelationship` |
| 4.2 | Repudiate the bond market: no grievance, each met civ reads 6 lower, the bond market and the guard are closed for 30 turns (the Loans tab says so, a guard case logs `guard-blocked`) | same | `ui/econ-repudiation.js` |
| 4.3 | An AI repudiates the player's loan the turn a war between them starts: the notification names it, the record reads repudiated, grievances booked on the AI against the player | Exploration 4242, lend then declare war | `ui/econ-shortfall.js` `aiRepudiate` |
| 4.4 | The chronicle entry on both sides (the Treasury flows line and the ledger event) | same | `ui/econ-notice-text.js` `describeEvent` |

### Phase 5: tax cards

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 5.1 | The tax slot appears when the age's root civic completes (policy slots +1, as P17 saw at Chiefdom), in all three ages | Antiquity 4242, then an Exploration and a Modern start | `data/econ-tax-cards.sql` (slot row), `data/econ-tax-gameeffects.xml` |
| 5.2 | The Fiscal tab lists Light, Heavy and War Levy with the forecast under each; Slot sends the change and the card reads slotted; swapping with every slot full goes Deactivate then Activate within the turn; when `canSwapCultureSlot` reads false the buttons grey and the note says so | same | `ui/econ-fiscal.js` `swapTo`, `ui/econ-view-fiscal.js` |
| 5.2a | The forecast reads right: "Your settlements now" shows the summed city Gold and Happiness and the same turns to the next celebration as the policies button's tooltip; after slotting a card, its Gold and Happiness change on the tab match what the settlements then show (within rounding), and the celebration turns move the way the tab said | same | `ui/econ-fiscal.js` `readFiscal`, `ui/econ-tax-cards.js` `cardForecast` |
| 5.2b | A card not unlocked yet reads "Opens with" and the node's name (War Levy in Antiquity: Currency) | Antiquity 4242, before Currency | `ui/econ-fiscal.js` `openerName` |
| 5.3 | The policy menu shows the same card as slotted, and clearing it there clears it on the tab | same | `ui/econ-fiscal.js` `readCards` |
| 5.4 | Each card shows on a city's yield breakdown under its own name with the right percentage (hover; P17 left this open) | same | `data/econ-tax-gameeffects.xml` (Tooltip argument) |
| 5.5 | War Levy pays only at war: the breakdown line appears when a formal war starts and goes when peace is made | same, a declared war | `data/econ-tax-gameeffects.xml` (REQUIREMENT_PLAYER_HAS_X_WARS) |
| 5.6 | Under Heavy Taxation the next celebration comes later and a settlement's happiness moves as P17 measured (32 to 20); under Light the other way | same | the cards' Happiness modifiers |
| 5.7 | With Taxes Off at setup the cards, the slot and the strategies are absent and the Fiscal tab says the option is off | any, Taxes Off | `economics.modinfo` criteria `taxes-on-*` |

### Phase 6: AI and soak

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 6.1 | 100 turns of `lab drive` across the Antiquity-to-Exploration change with the mod on, then the same seed with it off: no crash, no hang; `UI.log` has one `[Economics] turn N` line per turn | Antiquity 4242, vanilla | `ui/econ-bootstrap.js` |
| 6.2 | Per civ from the ledger events: AI loans (`ai-shortfall`), guard loans, defaults, restructures and repudiations counted; each AI's emergency loans stop at its cap | same | `ui/econ-shortfall.js` `aiBorrow` |
| 6.3 | Each AI's tax card every turn beside its balance, income and war state (`__towerEconomics.cards(pid)` per civ, or a probe row): does it tax harder when short, levy at war, ease off when flush; P17 saw Light only, so Heavy and War Levy taken by an AI at all is the first thing to read | same | `data/econ-tax-cards.sql` strategies |
| 6.4 | The strategy rows switching on and off in `AI_Victories.csv` (`STRATEGY_ECONOMICS_SHORT_OF_GOLD` Following then Forbidden as income passes 10; `STRATEGY_ECONOMICS_FLUSH` at 40) | same, `AIVerboseLogging 1` | `data/econ-tax-cards.sql` |
| 6.5 | The AI solvency target (DESIGN 10): AIs with positive income in the off run don't default or take emergency loans in the on run; compare AI civs with each other, the human seat holds one city under Autoplay | same | `tests/_balance.mjs` for the offline reading |
| 6.6 | Whether repudiated lenders go to war with the repudiator more often (P16): counted and called inconclusive if small | same | DESIGN 10, P16 |
| 6.7 | `tower-bench cost tower-economics --yes` for the per-turn cost | same | `ui/econ-session.js` |
| 6.8 | The AI's building-upkeep read (P2's open half): an AI's `upkeepCents` beside its balance change the turn it finishes a Library, since the per-building read gave 2 to 6 Gold where the engine charged 0. The human's figure should match `Logs/Player_Treasury.csv` now that the getter gets the row's `$index` | same | `ui/econ-engine.js` `readBuildingUpkeep` |

### Phase 7: alongside other mods

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 7.1 | Phases 1 to 5's main checks (1.1, 2.1, 2.4, 3.1, 4.1, 5.2) once with the usual set: Demographics, Emigration and Partisans read Gold and relationships too; note anything that moves differently, and that the Demographics Gold-per-turn chart shows the loans' grants as balance moves and not as income | Exploration 9001, usual set | `docs/compatibility.md` |
| 7.2 | The dock button sits beside Demographics' and Emigration's and opens the screen over the HUD; the pill reads beside it | same | `ui/econ-dock.js` |
| 7.3 | Partisans' hardship from the tax cards (its own read of `isTraditionActive`) once Partisans reads the `TRADITION_ECONOMICS_*` types | same | Partisans |

### Phase 8: single-player only

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| 8.1 | In a hotseat game `UI.log` has `[Economics] v0.2.0 loaded; multiplayer game, the mod is off` once, no batch line, no grant, the dock button absent | a hotseat start, vanilla | `ui/econ-bootstrap.js` `boot`, `ui/econ-engine.js` `isMultiplayer` |
| 8.2 | The same in a LAN-hosted game | a LAN host | same |

### Screens

| # | What the player sees when it works | Setup | Source |
| --- | --- | --- | --- |
| S.1 | The screen opens from the dock button and from a click on the turn notification, draws framed with its own styles at 720p without horizontal scroll (the CSS and HTML load from `fs://game/tower-economics/`), `tower-bench lint` on the live screen passes (no dropped declarations), the tab bar keeps its selection across re-renders | any, vanilla | `ui/econ-screen.js`, `ui/econ-screen.css` |
| S.2 | The Treasury tab's projection bars and the flows list read right against the ledger; the buildings block counts the Market and Bank | any | `ui/econ-view-treasury.js` |
| S.3 | The turn notification shows once per turn with the net Gold line and the notices, in the game's language, and its click opens the screen | any | `ui/econ-notify.js` |
| S.4 | The pill's text follows the debt and turns red in default | any | `ui/econ-dock.js` `refreshPill` |
| S.5 | The dock button shows the coin icon (the SVG served from `fs://game/tower-economics/images/`), not a blank square | any | `ui/econ-dock.js` `ICON_URL` |

## The model (offline)

| Check | Where | Observation |
| --- | --- | --- |
| The 1.0 rules (DESIGN 4.1 to 4.6, 4.14) | `tests/econ-*.test.mjs`, plus the engine-free scan | pass, 2026-10-29, after the port from `mod_ideas_tested/economics` and the guard's income condition (P4) |
| Invariants debt-1 to debt-7 and alive-target | `tests/econ-invariants.test.mjs`, `tests/econ-properties.test.mjs` | hold over 500 random economies |
| Balance rows of DESIGN 10 | `tests/econ-balance.test.mjs`, `reports/balance-1.0.json` | run 2026-10-29 in the research copy; the owner's reading of "Borrowing pays" is open |
| The glue against a fake engine | `tests/econ-session.test.mjs`, `tests/econ-notify.test.mjs`, `tests/econ-fiscal.test.mjs` | every civ read by the same calls; the ledger written before the grants; one net grant per civ; a lost batch re-sent; the swap's Deactivate-then-Activate order; building upkeep asked by row index; 2026-10-29 |
| The entry script against a fake engine | `tests/econ-boot.test.mjs` (the game's own modules resolve to a stub) | one boot line, the batch at `TurnBegin`, the notification once at the local turn; a pre-batch save catches up once at load; multiplayer logs once and listens to nothing; 2026-10-29 |
| The tax-card numbers and forecast | `tests/econ-tax-cards.test.mjs`, `tests/econ-data.test.mjs` | the modifiers and every description row agree with `CARD_LEVELS`; the forecast takes the active card out before putting another in; celebration turns as the policies button counts them; 2026-10-29 |
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
  call in `ui/`). Watched the same evening in a Partisans Modern usual-set game, seed 4242, turns 1 to 8: 9 `[Economics]` lines,
  no dock error (`modern-seed4242-turns1-8-dockfix.log`). The pill drawing beside the button is still to see on screen.
