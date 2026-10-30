# Economics: test plan

Status: sections 1 to 11 cover the loans (DESIGN 4.1 to 4.6 and 4.14), designed 2026-10-06 and revised 2026-10-24;
their unit tier is built to the revised rules ([NOTES.md](NOTES.md), 2026-10-29), and the 1.0 rows of the
balance ladder have run in the simulation (DESIGN 10, dated note). Section 12 covers the parts added 2026-10-24
(DESIGN 4.7 to 4.17), designed only; the tax fallback (12.1) is built as `econ-tax.js`, off by default. No probe has
run. Each table carries the release that ships the part (DESIGN 11). Common tiers:
[test-ladder-2026-10-06.md](../../../mod_ideas_tested/mods_research_and_analysis/test-ladder-2026-10-06.md). Design under test:
[DESIGN.md](DESIGN.md).

## 1. Unit tests (T1)

| Module | Tests | Release |
| --- | --- | --- |
| `econ-loan.js` | the 4.1 record with `kind`, `emergency` and `restructured`; interest `O * r`; amortisation `P / T`; `O` reaches exactly 0 at `T` with no rounding residue (integer cents); the first payment of a new loan; restructure: what's left over 10 turns, rate kept, `m` to 0, flagged once; early repayment any amount | 1.0 |
| `econ-credit.js` | `credit_cap = max(0, (12 + depth_turns - 4 * repudiations) * income) - outstanding`, depth at most 12; the debt-service limit: next turn's payments plus the new loan's first within 35 percent of income, 0 at income 0; `standing` steps of 0.2, 0.1 and 0.3 (0.15 against an enemy at war), floor 0.1; the 20- and 40-turn windows; misses in one turn share a row; emergency principal counted apart | 1.0 |
| `econ-stages.js` | a stage is open from the turn the civ reached it; malformed reads closed; the emergency lender per stage; Economic stages Off opens everything | 1.0 |
| `econ-lenders.js` | a civ lends only with balance (net of principal committed this turn) `>= 2 * P`, not at war, no default against the borrower, no block; `r_L` per DESIGN 4.3 with `depth_factor`; rates stop at `r_cap`, the rates option scaling rate and cap alike; bond and temple at `2 * base / standing * depth_factor`; Antiquity lends at 0.03 from Moneylending; blocks: a default ends with the age, a civ repudiation one age later, a world one in 30 turns; 20- and 30-turn terms need Public debt and, from a civ, a Bank; 10 turns at most while a repudiation counts; emergency offers by stage | 1.0 |
| `econ-payments.js` | a payment the funds can't cover is a miss: `m += 1`, the interest joins `O`, `r = min(r * 1.25, r_cap)`; a paid turn resets `m`; default at `m >= 3`; the last payment clears capitalised interest; garnish `min(ceil(O * 0.1), floor(0.5 * income), cash)` and the income-at-or-below-0 branch from the balance; a block added once per pair | 1.0 |
| `econ-guard.js` | the guard fires below the amenity line (0, from GlobalParameters) and borrows back to it plus one turn of upkeep; `emergency_cap = max(100, 10 * |income|)` and the stop where the next loan would pass it; insolvent after 5 turns at or below 0 | 1.0 |
| `econ-ai.js` | AI borrows the shortfall; lends above `20 * income` with income > 0; accepts a player's offer at `r <= 1.2 * bond rate` only with income > 0 and within its limits; restructures at `m = 2` once; the repudiation rule: an enemy at war, then a hostile lender owed more than `10 * max(|income|, 10)` when insolvent or in default, then the bond market when insolvent at the cap; never Friendly; once per 20 turns | 1.0 |
| `econ-repudiation.js` | every open record with the lender closes as `repudiated`, written off; the grudge `clamp(5 * loss_turns, 10, 40)` in turns of the lender's income (floor 10 Gold) as `{ from, against, amount }`; witnesses -3 as `{ a, b, delta }`, doubled for the bond market and temple treasuries, halved against an enemy at war; the standing record; the block | 1.0 |
| `econ-tax.js` | the script fallback, off unless `taxFallback` is set: the four levels' Gold and celebration percentages of `max(0, income)` and `max(0, happiness)`; Standard moves nothing; War Levy reads Standard outside a war; one change per 5 turns; the fallback's AI rule; a Light remittance the funds can't cover is missed | 1.0 (fallback only if P17 fails) |
| `econ-batch.js` | funds = snapshot + income + world inflows - own payments, civ inflows counting next turn; the lender's balance net of committed principal; the commit row per civ; landed, lost and unknown on reload | 1.0 |
| `econ-conservation.js` | for every civ-to-civ transfer the two `grantYield` amounts sum to 0; bond, temple and tax are the only non-zero-sum parties, each netted as its own line; one net grant per civ; a ledger-wide sum test | 1.0 |
| `econ-plan.js` | the order in DESIGN 4.14 with each payer on its own funds; the same turn with the civs reversed gives the same transfers and ledger; borrow, lend, repay, restructure and repudiate requests and their refusals; the guard's lender by stage and its cap notice once per spell; insolvency notice; AI borrowing standard then emergency then none, largest shortfall first; AI restructuring and repudiation; stage gates; age change; a turn never planned twice; the batch | 1.0 |
| `econ-state.js` | envelope version 2; a version 1 envelope loads with defaults; loan ids stable across reload; blocks, repudiations, counters, taxes and the last batch sanitised; event log cap; settled-loan cap | 1.0 |
| `econ-invariants.js` | debt-1 to debt-7 and the alive-target check, each tripped by a crafted bad plan | 1.0 |

Property tests (`../tests/econ-properties.test.mjs`): 500 random economies over 200 turns across the three ages, with
stage turns, deaths, wars and the tax fallback on in some: every invariant each turn; the civ total moves only by
world-account flows plus the game's own income (an exogenous series); emergency principal never past the cap; the
same seed gives the same ledger with and without a reload between turns; a turn re-planned with the civs reversed
gives the same plan; a turn re-planned from its saved ledger is a no-op.

Balance (`../tests/econ-balance.test.mjs`, `../tests/_balance.mjs`): the 1.0 rows of DESIGN 10's balance ladder over 20
seeded 12-civ 500-turn games, On against Off; results in `../reports/balance-1.0.json` and DESIGN 10's dated note.

Mutation: Stryker on `econ-payments.js`, `econ-credit.js`, `econ-conservation.js` and `econ-plan.js`, house bar high
75, low 60 (`stryker.config.json`); the 2026-10-29 scores are in NOTES.

## 2. Invariants

```
debt-1  sum over active loans of (pending grantYield amounts this tick) == 0 for civ-to-civ loans
debt-2  no loan has O < 0, and no active loan has m >= 3 (DESIGN 4.4 defaults there)
debt-3  no grantYield is issued twice for one (loan, turn)
debt-4  the auto-loan guard never fires twice in one turn
debt-5  envelope size <= 64 KB
debt-6  no payer goes past its funds: what a civ paid out <= max(0, snapshot + income + world inflows) (DESIGN 4.14)
debt-7  the sum of civ grants equals the net of the world accounts (DESIGN 4.14 commit check)
```

## 3. Engine probes (T2)

| Recipe | DESIGN probe | Steps | Expect |
| --- | --- | --- | --- |
| `P1-paired-transfer.json` | P1 | read balances of player and one AI; `eval` grantYield(-100) and grantYield(+100, AI); await 5 s; read | both land; sum unchanged to the cent |
| `P2-income-reads.json` | P2 | log the two `Treasury` maintenance getters and `Stats.getNetYield(YIELD_GOLD)` for 3 turns beside the top bar's value | one combination equals the top bar |
| `P3-turn-timing.json` | P3 | deduct at `PlayerTurnDeactivated`; read same tick, +5 s, next turn | the staleness window measured |
| P4-disband-line.json | P4 | push the balance to -15 in one turn; roll | whether the engine disbands in that turn or the next |
| `P5-relationship.json` | P5 | log the diplomacy relationship level for each pair | readable per pair, or `relation_factor` 1.0 |

Status after the 2026-10-24 sweep of earlier runs (DESIGN 10 has the evidence): P5 settled; P2 and P3 partly settled
(only the top-bar match, the getter shapes and the hook remain); P1 and P4 still need a run.

Recipes: `P1-paired-transfer.json` written 2026-10-06; `P2-income-reads.json`, `P3-turn-timing.json` and
`P4-disband-line.json` written 2026-10-29. P5 needs none (settled). Each validated offline with `validateRecipe` and a
syntax parse of every snippet. None run in a game. P2 to P4 read through the probe mod's `globalThis.__econProbe`
(`devtools/probe-mod/econ-probe/ui/econ-probe.js`), so they run in a game with that mod on; the run order is
`devtools/RUN-SHEET.md`.


Run 2026-10-29 on 1.5.0 in lab games (probes-only registry): P1 passed twice (Exploration 9001; the recipe's
listening step moved before the grant, it had subscribed after the Gold landed); P2, P3 and P4 passed in Antiquity 4242
with the human's capital founded by `FOUND_CITY` first (a lab turn roll never settles the human seat). P4's reads gained
the celebration meter and notifications. Results are in DESIGN 10. The bench's `recipe run` doesn't exit after a
failed `await`; run it under a time limit.

## 4. Acceptance scenarios (T3)

| Id | Start | Steps | Player sees | Engine read |
| --- | --- | --- | --- | --- |
| A1 | Exploration 9001, Public debt reached | borrow 300 from the bond market over 20 turns | balance up next turn; screen lists the loan; each turn the payment shows and the balance moves by it | balances per turn |
| A2 | Same | spend to zero, miss three payments in a row | miss notices; the rate climbs; the missed interest joins the debt; Influence falls; default; garnish; chronicle entry | ledger, balances |
| A2b | Same | miss twice, then pay | the overdue flag clears; standing still carries the two misses for 20 turns; no default | ledger |
| A3 | Exploration 4242 | borrow from an AI | the AI's balance falls by `P` and rises by each payment | AI balance |
| A4 | Same | lend to an AI in shortfall with positive income | the AI accepts by rule; the player's balance rises per turn; an AI with income at or below 0 declines | balances |
| A5 | Modern 9001 | auto-loan guard on, run the treasury dry | an emergency loan appears the turn the balance would go below 0, before any amenity or unit is lost; one notice; the Loans tab shows the remaining allowance | amenities and unit count unchanged |
| A5b | Same | keep the deficit past `emergency_cap` | the guard stops; one notice naming the deficit, its causes and the game's own penalties; the game then takes amenities and units as it does without the mod; after five turns of deficit the notice says insolvent | unit count, amenities |
| A6 | Antiquity 4242 | 60 turns before Commerce, then Commerce | no civ offers and no bond market before Commerce; the guard's loan comes from temple treasuries; after Commerce, 10-turn civ loans at 0.03 and the guard prefers a civ lender; the Loans tab names the civic that opens each part | ledger, balances |
| A7 | Any | Loans Off | screen shows balances only | no write |
| A8 | Exploration 9001 | miss twice, restructure | the Loans tab shows the new 10-turn schedule before confirming; after it the payment is smaller and `m` is 0; a second restructure is refused; refused with income at or below 0 | ledger |
| A9 | Exploration 4242 | owe an AI, repudiate it | the Loans tab shows the Gold kept, the relationship each civ would lose, the new standing and the lenders that close, before confirming; afterwards the records read repudiated, the lender's grievances against the player rise by the grudge, each met civ's relationship falls by 3, the lender refuses for this age and the next, other lenders charge more, the credit limit shrinks and only 10-turn terms are offered for 40 turns; the chronicle has the entry on both sides | grievances, relationships, ledger |
| A9b | Same | owe the bond market, repudiate it | no grievances; each met civ falls by 6; the bond market and the guard are closed for 30 turns | relationships, ledger |
| A10 | Exploration 4242 | lend to an AI, then declare war on it | the AI repudiates the debt the turn the war starts; the player's notification names the repudiation and the amount | ledger, notification |
| A11 | Any | save during a turn, reload | the ledger's last batch matches the turn; no transfer is sent twice; the batch's snapshot and net tell whether the grants landed (P15 decides whether a save can fall in the window at all) | ledger, balances |

## 5. Lifecycle specifics (T4)

`AffectsSavedGames` 0. L6: a save loaded without the mod keeps the Gold that loans moved; nothing else. L3, L4: loans
carry across the transition; lender blocks reset at the age as designed; AI lenders that did not survive the
transition have their loans closed with the outstanding written off and a chronicle entry.

## 6. Crash risks specific to Treasury (T5)

No map write. The risk is a write to a player id that is not alive (a lender eliminated this turn): every `grantYield`
is preceded by `Players.get(pid)?.isAlive`. Fuzz includes eliminating a lender mid-loan. The invalid-id crash family
(`independentName(99)`) means no id is ever derived by arithmetic.

## 7. Performance specifics (T6)

Trivial per turn: a 12-civ turn plan with 96 open loans runs in under 5 ms (`../tests/econ-perf.test.mjs`), against
DESIGN 10's 50 ms allowance; the Treasury screen's 20-turn projection adds 20 plans more and stays under 50 ms with it.

## 8. Pairwise specifics (T7)

| Partner | Test |
| --- | --- |
| Every mod with a Gold-priced action (Canals, Dams, National Parks, Forests, Prospecting, Epidemics) | a purchase and a loan payment in one turn both land once; the stale-read window never double-charges (each mod reads its own charge from its own log, not from the balance) |
| Demographics | debt series; the Gold series shows loan inflows as unexplained income (documented: script-granted yields show no source) |
| Emigration, Partisans (designed) | the default term reaches them |
| Cultural Diffusion | CD's free `purchasePlot` moves no Gold; no interaction |

## 9. Corpus fixtures (T8)

Any mod that reads the treasury for display (`3737200066` Demographics is ours; the top-ten smoke set covers the rest).
Specifically Aventura Resources Stockpile (its market moves Gold through its own writes; both mods must keep separate
logs and neither reads the other's writes as income). Age Progression Customization for term lengths across a short
age.

## 10. Localization (T9)

Loan terms, miss and default notices, lender names (the civ's own name tag), the bond market label, the guard notice,
the Civilopedia chapter stating that script-granted Gold shows no source line in the game's breakdown.

## 11. Done means

As the ladder's T10, with P1 and P3 recorded in `engine-closed.md`.

## 12. The economics parts (DESIGN 4.7 to 4.14)

### 12.1 Unit tests (T1)

Taxes are policy cards the game pays (DESIGN 4.7), so there is no tax module in the batch: the card data is tested
by the data gates (compile, foreign keys, unlock rows) and P17. The script fallback is `econ-tax.js` in section 1.
Inflation ships Off by default (1.2); trade settlement is netted per pair and capped; development loans back only a
city's current build (no escrow); the cycle has the repudiation, world-income and credit-growth events and the Panic
state; Civic market civs get citizen loans (4.17).

| Module | Tests | Release |
| --- | --- | --- |
| `econ-inflation.js` | `pi` is 0 with no bond debt; capped at 0.5 percent; `M` floors each balance at 0 and uses `max(M, 1000)`; only Public debt civs take part; erosion only above `reserve`; loan balances untouched; option Off (the default) moves nothing | 1.2 |
| `econ-prices.js` | class base prices read from rows passed in, an unknown class priced as Bonus; scarcity clamp 0.5 to 3.0; `demand_r` from a `Units` fixture with and without a StrategicResource row, the war term, the Industry term; smoothing 0.8 / 0.2 (0.5 from Capitalism); a resource removed from the table drops out | 1.1 |
| `econ-trade.js` | bill is half the summed prices with the Trade-building terms; each pair netted to one payment from the side with the positive figure; `paid = min(net, 0.10 * max(0, income))`, several partners scaled down evenly, the rest waived and never carried; tariff 0, 10, 25 percent; every civ starts at None; one tariff change per 5 turns; Tariffs Off holds every civ at 0 and the AI rule never fires; importer and exporter amounts sum to 0; city-state and independent routes skipped; High tariff's relationship step once per 5 turns | 1.1 |
| `econ-cycle.js` | mean reversion; `E` doesn't move on a turn with no events; the same event list gives the same `E` after a reload; clamp 0.7 to 1.3, `L` to ±0.2; each event's weight, including default, repudiation (the lender takes part, the repudiator doesn't), peace, routes, world income against 10 turns ago and credit growth; the per-turn cap of ±0.1; the war and trade-route caps; the stage scale `s`; option Off, Mild, Strong scale the weights; Panic: once above leverage 1.5 and `E` above 1.05 with none in 20 turns, `E -= 0.2`, 5 turns, civ lenders stop, `cycle_spread + 0.5`, then back to the range; phase boundaries; cycle Gold sign follows `E + L - 1` | 1.2 |
| `econ-invest.js` | development loan: only the build at the head of the city's queue right now (a build the city hasn't started is refused, no escrow); progress `G / 3` capped at what the build needs, the rest returned in the same batch; the build re-read in the grant's tick; dividend `ceil(G * 0.05)` for 25 turns, 6 percent on a role building; closed with the rest written off when the host loses the city. General: a `grantYield` pair summing to 0; dividend `ceil(G * 0.045 * growth)` with growth clamped 0.5 to 2.0 (0.25 to 3.0 from Capitalism); stays with the civ when a city is lost. Aid: no dividend, no record, relationship +1 per 2.5 turns of the host's income; +1 per 5 and per 7.5 turns for the two kinds. Records carry `kind: "project"` or `"general"`; refused at war or below Neutral; a host can repudiate them like a loan | 1.1 |
| `econ-buildings.js` (Commerce and Banking roles in 1.0, the rest 1.1) | roles from `TypeTags`, `Constructible_Advisories` and `Constructible_YieldChanges` fixtures dumped from 1.5.0: Commerce, Banking (the Bank-yield threshold read from the Bank's own row; Port, bridges and Rail Station excluded by tag), Trade, Warehouse, Industry, economic wonders; a building in two roles counts in both; a test mod's new Gold building joins Commerce, a retagged one moves, a removed one drops; a missing Bank row leaves Banking empty rather than guessing; depth = Gold yield / 4 summed; `depth_factor` cap 0.3, 0.4 with the Banking stage, wonder discount at most 15 percent; `depth_turns` = 2 per Banking building, at most 12; Trade buildings move a bill by 10 percent per building, 30 at most per side; Warehouse cut on a negative `L` only, 30 percent at most; Food warehouse halves a disaster; Industry demand at most +1.0; project dividend 6 percent on a role building; a damaged building counts as nothing when readable | 1.0, 1.1 |
| `econ-plan.js` | the 1.0 batch (`econ-plan.js`) extended with the 4.14 steps 3 to 6: the guard sees bills, erosion, cycle Gold and dividends; one net Gold, Influence and celebration grant per civ per turn with the plan's `addProgress` calls; a turn already planned isn't planned again | 1.1, 1.2 |
| `econ-ai.js` | the tariff, investment and aid rules in DESIGN 6 (taxes are native; the fallback's rule is in `econ-tax.js`) | 1.1 |
| `econ-stages.js` (Moneylending, Coinage and Public debt in 1.0) | anchors resolved from a `ProgressionTreeNodeUnlocks` fixture; an anchor moved to another node by a test mod moves the stage; a civ-unique node unlocking the anchor counts; a missing anchor opens at the next age; each age opens the earlier ages' stages; a stage, once reached, survives the age change; the world stage is the furthest any living major has; cycle scale 0.25, 0.6, 1.0; a part closed to a civ refuses requests and skips its AI rule; loans already running carry on; option Off opens each part at its age start | 1.0, 1.1, 1.2 |
| `econ-legacy.js` | old means an earlier `Age` and no `AGELESS` tag, both from fixtures; a wonder never ages; a building whose `AGELESS` tag a test mod removed ages; one age old holds 1.0 until its role's successor stage, then -0.05 a turn to 0.5; the same city getting a current-age building of the role drops it to the floor at once; two ages old starts at min(w, 0.5) and fades to 0.25; each role's successor stage per the DESIGN 4.16 table; `w` scales depth, `depth_turns` and the Trade bill share; legacy = sum of (1 - w); cushion 1 percent per legacy point, at most 10; Warehouse cut and cushion together at most 35 percent; building over an old building removes its legacy; a project dividend on a building that has aged keeps paying | 1.2 |
| `econ-systems.js` | ideology from the node unlocking each anchor tradition, ahead of government; government table lookup, an unlisted or missing government runs Mixed; each system's row in DESIGN 4.17 against Mixed; the plan takes 20 percent of positive income and splits it by population over cities with a queue, skipping empty queues; Planned prices fixed at `base_c`; bills at the importer's prices; a Religious lender's loan is a partnership; a 10-turn even blend on a change, with one -0.03 reform shock; running loans keep their terms; Capitalism-stage effects only for Market and Mixed; option Off runs every civ as Mixed; citizen loans: the `citizens` account, `citizen_cap` per market town within `credit_cap`, the rate, celebration at twice the interest paid, misses costing celebration and hardship, repudiation's home cost, closed at the age transition | 1.2 |

Property tests: 500 random economies over 200 turns with all parts on: no outstanding amount or price goes negative;
civ-to-civ flows sum to 0 each turn; the sum of all grants equals the bond, tax, inflation and cycle flows; `E` stays
in range; `pi` is 0 on any turn with no bond debt.

Simulation to tune before 1.0.0: 12 civs, 300 turns, Standard options. Report the share of turns in each phase, how many
Panics, the median and worst inflation, total eroded Gold against total bond principal, and how many AI defaults clear.
A run where Depression holds for more than 30 turns, or inflation sits at its cap for more than 20, sends the
constants back to the design.

Mutation: house bar (high 75, low 60) on `econ-plan.js`, `econ-trade.js` and `econ-inflation.js`.

### 12.2 Invariants

```
econ-1  per turn, civ-to-civ flows (loans, trade bills, dividends) sum to 0
econ-2  per turn, the sum of all grants = bond + tax + inflation + cycle flows
econ-3  at most one Gold, one Influence and one celebration grant per civ per turn
econ-4  no grant to a city-state, an independent, the bond market id, or a player who isn't alive
econ-5  markets envelope size <= 32 KB
```

### 12.3 Engine probes (T2)

Status after the 2026-10-24 sweep (DESIGN 10 has the evidence): P9, P10 and P12 are settled by reads that ship
in Demographics and need no recipe. P11 needs only the population-loss read; P8 only whether the AI keeps its build;
P13 only the AI tech read; P7 only an AI's per-route imports; P14 both reads across a transition. P6 still needs
a full run. Recipes for P6, P13, P15, P17 and P18 written and validated offline 2026-10-29 (`devtools/RUN-SHEET.md` has
the order); P7, P8, P11 and P14 still have none. None run in a game.

| Recipe | DESIGN probe | Steps | Expect |
| --- | --- | --- | --- |
| `P6-celebration-push.json` | P6 | read one AI's meter and threshold; grant minus the threshold; roll until it celebrates; compare with a control civ | the celebration starts later by about the turns the grant was worth |
| `P7-ai-routes.json` | P7 | from the UI context, log `Trade.getCurrentTradeRoutes()` for each AI with the imports on each route | per-route imports readable for an AI, or the route-count fallback |
| `P8-ai-keeps-build.json` | P8 | `addProgress(30)` on an AI city's current build; read `currentProductionTypeHash` for 3 turns | the AI keeps the build the grant landed on |
| `P11-disaster-pop.json` | P11 | probe data mod raising `RandomEventFrequencies`; on each `RandomEventOccurred`, read the nearest settlement's population before and after | a population loss can be tied to the event |
| `P13-ai-techs.json` | P13 | mid-age save; for each AI log `Techs.isNodeUnlocked(type)` on each tech anchor | answers that match each AI's research |
| `P14-ai-government.json` | P14 | log `Culture.getGovernmentType()` and `Culture.getChosenIdeology()` for each AI before and after an age transition, and after an ideology is taken | both readable for each AI and change with its picks |
| `P15-save-window.json` | P15 | one timed batch of grants to every AI; every `StartSaveRequest` logged with its time; the autosave file times after the game | whether a save can fall inside the ~3 s before the grants land |
| `P17a-tax-cards-setup.json`, `P17b-tax-cards-after-drive.json` | P17 | with the probe mod: the cards, slot, strategies and unlock rows at turn 1; after a 50-turn `lab drive`, each AI's active card and slot count, and the player's `CHANGE_TRADITION` swap under `canSwapCultureSlot` | an AI slots a card; the swap lands when the game allows it; the breakdown names the card (by hand) |
| `P18-aid-action.json` | P18 | with the probe mod: the aid action in `GameInfo`; the player door through the diplomacy operation; both balances after; the AI's use from `AI_DiplomaticActions.csv` | the proposer loses 100 and the target gains 100; an AI proposes or accepts it |


Run 2026-10-29: P13 settled (AI tech reads match each AI's research); P15 watched (a save request comes about 3 s
after the local turn ends, a batch lands in about 1 s); P17a and P17b passed for the setup and both doors, and the
player's swap needs Deactivate before Activate when the slots are full (recipe `P17b` still sends Activate alone, so its
step 9 fails; the pair is in the run's notes); P18 ran, the AI scores the action and never starts it. P6 wasn't needed:
the AI slots the cards. The steering pair is owed.

### 12.4 Acceptance scenarios (T3)

| Id | Start | Steps | Player sees | Engine read | Release |
| --- | --- | --- | --- | --- | --- |
| E1 | Exploration 9001 | slot Heavy Taxation for 10 turns, then Light | the game's yield breakdown names the card; Gold up then down; the celebration comes later, then sooner; the Fiscal tab's forecast matched what happened; an AI's card changes when it's short or at war (P17) | balance, meter, `getActiveTraditions` | 1.0 |
| E2 | Exploration 9001, Inflation On in setup | borrow 1000 from the bond market with a large idle balance | inflation shows above 0; the balance above the reserve shrinks each turn; paying the bond back takes inflation to 0; with the default (Off) nothing erodes | balances, ledger | 1.2 |
| E3 | Modern 4242 | make a trade route to an AI that imports a scarce resource, while it imports from you too | one netted bill each turn on the Trade tab for the side that owes more, within 10 percent of the payer's income; the other side's balance rises by it; a High tariff lowers it and the relationship falls every 5 turns | both balances, relationship | 1.1 |
| E4 | Modern 4242 | a development loan of 300 on an AI city's current build | the city's build jumps by `G / 3` (capped at what it needs, the rest returned); 15 Gold a turn comes back for 25 turns; relationship up by the host's-income rule | AI build progress, balances | 1.1 |
| E4b | Modern 4242 | try a development loan on a build the AI city hasn't started; a general investment of 300 in a second AI; 100 aid to a third | the first is refused (only the current build); the general dividend moves with the second AI's income; aid raises the relationship and pays nothing back | AI build progress, balances, relationships | 1.1 |
| E5 | Modern 4242 | Business cycle Strong; let two AIs go to war, then make peace; later lend the world into leverage above 1.5 in a boom | a Slump named after the war in the turn notification; the two warring civs' Gold falls further than the others'; recovery toward Steady after peace; prices follow `E` on the Markets tab; a Panic: its own notification, civ lenders stop for 5 turns, bond rates up, then a Slump | ledger `E`, `L` and event history | 1.2 |
| E6 | Any | all options Off | the Economics screen only shows balances | no grant | each |
| E7 | Modern 4242 | Tariffs Off, same route as E3 | no tariff setting on the Fiscal tab; the full bill each turn | both balances | 1.1 |
| E8 | Antiquity 4242, 60 turns into Exploration | play normally, research Currency, Commerce, then Economics | Markets greyed until Code of Laws, War Levy after Currency, AI loans offered after Commerce, the bond market and guard after Economics (temple treasuries before it); each greyed part names the tech or civic that opens it | stage turns in the ledger for each civ | 1.0 |
| E9 | Exploration 9001 | build a Bank, then a second; make a route from a city with a Market and Guildhall into an AI city with none; build Granary and Saw Pit before a war | the Treasury tab lists each building by role; the credit limit grows by 2 turns of income per Bank and 20- and 30-turn terms appear; the bill on that route is 20 percent higher; the war's local hit is smaller than an AI's with no warehouses | ledger depth, bills, `L` per civ | 1.0 (depth), 1.1, 1.2 |
| E10 | Antiquity 4242 into Exploration and Modern | enter Exploration with three Markets; research Guilds; build a Guildhall in one Market city; reach Economics; carry a Bank into Modern and build a Stock Exchange beside one | the Treasury tab shows each Market at 1.0 until Guilds, then fading; the Guildhall city's Market drops to 0.5 at once; Commerce fades after Economics; old Banks at 1.0 into Modern until the Stock Exchange city drops to 0.5; legacy and its cushion grow on the World tab | weights, legacy and `L` per civ per turn | 1.2 |
| E11 | Modern 4242 | play to an ideology: Communism in one game, Fascism in another, Democracy in a third | the Fiscal tab names the system and its changes; under Communism the tax levels give way to the plan, cities' builds advance by the plan's share, prices on the Markets tab hold still; under Fascism War Levy is open in peace and the war turns into a local boom then a slump at peace; each change blends over 10 turns | system per civ per turn, plan production, `L` | 1.2 |
| E12 | Antiquity 4242 as Classical Republic | borrow from the citizens with two market towns | the Loans tab offers citizen loans within `citizen_cap`; the celebration meter rises by twice each turn's interest; a miss costs celebration, not Influence | meter, ledger | 1.2 |

### 12.5 Pairwise specifics (T7)

| Partner | Test |
| --- | --- |
| Strategic Resources That Matter | with Modern Supply Chains on and off, `demand_r` follows its `Units` rows |
| Epidemics, Emigration, Partisans (designed) | the cycle and tax terms reach them through Commons topics |
| A test mod that adds a Gold building and deletes a resource | depth counts the new building; the deleted resource has no price and no bill |
| Warehouse Overbuilding (Workshop 3517656064), Aging Warehouses | they change warehouse tags; roles follow the compiled tags, so a building they change moves role or drops out |

### 12.6 Changes to the built loan model

Done 2026-10-29. DESIGN 4.15 moves loans between civs into Antiquity (Moneylending) and the bond market to Public
debt. The model's Antiquity dormancy (`isActiveAge`, NOTES choice 23) is gone: `econ-stages.js` reads the stage turns
the glue passes per civ (`civ.stages = { moneylending, publicDebt }`), Antiquity has `base_rate` 0.03, temple
treasuries lend emergency loans before Public debt, and the dormancy test is replaced by the stage tests in section 1
(`econ-lenders`, `econ-plan` "stage gates") and scenario A6. The glue's half, resolving each anchor node through
`ProgressionTreeNodeUnlocks` and recording the turn, is `econ-stages.js` in 12.1.
