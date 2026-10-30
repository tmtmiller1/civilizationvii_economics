# Economics: model notes

Status: engine-free model built 2026-10-06 and brought up to the revised design on 2026-10-29, tested offline under Node
(`npm run verify`); the engine glue and the screens built the same day against prompt 1's probe results (DESIGN 10), the
1.1 parts the same night and the 1.2 parts on 2026-10-30, none of it watched in a game yet. This file records where
DESIGN left a choice open, the choice the model or the glue makes, and the test that pins it. Test names are quoted;
files are under `../tests/`. The 2026-10-24 revision settled or replaced some of the 2026-10-06 choices; those rows say
so, with the DESIGN section that now holds the rule.

## Ambiguities and the choice made

| # | Question DESIGN leaves open | Choice | Pinned by |
| --- | --- | --- | --- |
| 1 | Does interest compound on a missed payment? | Replaced by DESIGN 4.4 (2026-10-24): the missed interest is added to `O`, `m += 1`, `r = min(r * 1.25, r_cap)`, -5 Influence. The slice still moves to the next turn, so a missed loan runs past `T` and the last payment takes whatever is left, capitalised interest included | `econ-payments`: "a payment the funds can't cover is a miss...", "the last scheduled payment closes the loan at 0, capitalised interest included" |
| 2 | Order of interest, amortisation and garnish | Replaced by DESIGN 4.14: write-offs; AI repudiation and restructuring, then player requests; the tax fallback if on; then, per payer, garnish on defaulted loans and scheduled payments oldest first; then the guard; then AI borrowing largest shortfall first. Interest and amortisation are one payment | `econ-plan`: "garnish is taken before scheduled payments", "payments run oldest loan first", "the turn is order-free" |
| 3 | "Would fall below zero after the turn's own income" | Replaced by DESIGN 4.14: a payer's funds are its snapshot balance plus income plus what world accounts put in this turn, less what it has already paid out. Gold from other civs counts from the next turn. Payments are all or nothing per loan | `econ-batch`: "funds: snapshot + income + world inflows..."; `econ-plan`: "Gold from another civ counts next turn..." |
| 4 | When is the first payment? | The turn after the loan opens. Principal lands on the opening turn | `econ-plan`: "borrow from the bond market: principal arrives this turn, the first payment is next turn" |
| 5 | `P / T` in integer cents | Cumulative schedule: slice k is `floor(P*k/T) - floor(P*(k-1)/T)`; slices sum to `P` exactly, and at or past term the whole remainder is due. After a restructure `P` is what was outstanding and `T` is 10 | `econ-loan`: "property: paying every slice reaches exactly 0 at T...", "restructure (DESIGN 4.4)..." |
| 6 | Rate representation | Integer parts per million, rounded half up at each step; interest rounds to the cent. Standing is now in hundredths (was tenths) so the 0.15 at-war repudiation term is an integer | `econ-payments`: "the rate steps per miss..."; `econ-credit`: "standing: 1.0, minus 0.2..." |
| 7 | Does a defaulted loan accrue interest? | No. Only the garnish runs, until `O = 0`, then the loan closes. The lender block stays for the age | `econ-payments`: "a defaulted loan pays the garnish from what's there, no interest, and closes at 0" |
| 8 | Garnish rounding | Settled by DESIGN 4.5: `min(ceil(O * 0.1), floor(0.5 * income), cash)` with income above 0; `min(ceil(O * 0.05), floor(0.1 * balance), cash)` otherwise. `cash` is the payer's funds this turn floored at 0, `balance` the snapshot balance floored at 0 | `econ-payments`: the two "garnish with income..." tests; `econ-plan`: "garnish is bound by cash..." |
| 9 | Guard "shortfall" | Settled by DESIGN 4.6: back to the guard line (the amenity line, 0) plus one turn of upkeep, over 10 turns | `econ-guard`: "the guard fires below the amenity line (0)..." |
| 10 | Is the guard or AI shortfall loan bound by `credit_cap`? | Settled by DESIGN 4.2 and 4.6: emergency loans skip both limits and have `emergency_cap` instead. An AI with positive income first tries a standard loan within the limits, and takes an emergency loan only past them (DESIGN 6) | `econ-plan`: "AI borrowing: past the 4.2 limits or insolvent it takes an emergency loan..." |
| 11 | Guard when a world lender has blocked the player | It respects the block, logs `guard-blocked`, and borrows nothing; a bond-market repudiation therefore turns the guard off for 30 turns, as DESIGN 4.5 says | `econ-plan`: "repudiating the bond market..." |
| 12 | Term of rule-made loans | Settled by DESIGN 6: every rule-made loan is 10 turns, AI-to-AI included (was 20) | `econ-plan`: "AI borrowing (DESIGN 6): a short AI takes a standard 10-turn loan..." |
| 13 | Which civs an AI borrower asks | AI civs that pass 4.3 and section 6 (`income > 0`, `balance > 20 * income`), cheapest rate first, then the bond market from Public debt. The human is never lent from by rule. An insolvent civ gets no civ lender (DESIGN 6: "never to an insolvent one") | `econ-plan`: "AI borrowing (DESIGN 6)...", `econ-shortfall.js` `emergencyLenders` |
| 14 | `20 * income` when income is 0 or negative | Any positive balance would pass; the model requires income > 0 to lend | `econ-ai`: "an AI with no positive income never lends" |
| 15 | Player lending | Settled by DESIGN 5: the AI accepts when it is in shortfall, `r <= 1.2 * its bond rate`, its income is positive and the loan fits its credit and debt-service limits; the player must hold `P` in this turn's funds; war, a block, a term it can't take or AI Off refuse. The service test closes finding E | `econ-plan`: "player lends: ..."; `econ-ai`: "an AI in shortfall accepts..." |
| 16 | Early repayment | Rides on the turn's payment (or garnish), capped by `O` and by funds; ignored on a miss and on the opening turn, so one loan never has two transfers in one turn | `econ-plan`: "early repayment request...", "repay requests for unknown, closed or same-turn loans are ignored" |
| 17 | "Missed payment in the last 20 turns" | Turns `t` with `turn - t < 20`. A restructure counts as one more miss (DESIGN 4.4). A civ's misses in one turn share one row `{ pid, turn, n }`, which bounds the envelope | `econ-credit`: "standing windows...", "misses in one turn share a row..." |
| 18 | "Active default anywhere" | Loans in default where the civ is the borrower, with any lender | `econ-credit`: "outstanding counts active and defaulted loans..." |
| 19 | Rates option values | 0.75, 1.0, 1.25 times every rate, `r_cap` included, so the cap keeps its 4x meaning under each option | `econ-lenders`: "rates stop at r_cap..., the rates option scales rate and cap alike" |
| 20 | A party eliminated mid-loan | Closed at once, outstanding written off, a `writeoff` event; nothing is sent to it | `econ-plan`: "lender eliminated mid-loan..." (two tests) |
| 21 | New age | Default blocks end; a civ repudiation's block lasts one more age; world-lender blocks run on their 30 turns; loans, misses, repudiations and standing carry over; new loans use the new base rate. The first turn a ledger sees isn't an age change | `econ-plan`: "a new age: default blocks end, a repudiation block lasts one more age..."; `econ-lenders`: "blocks (DESIGN 4.5)..." |
| 22 | Running the same turn twice (stale read, reload) | `ledger.lastTurn` makes a second plan for the same turn a no-op. The ledger also keeps the last batch (id, each civ's snapshot balance and net Gold, Influence and celebration), and `batchStatus` reads landed, lost or unknown per civ on reload; a lost row's net is what the glue re-sends | `econ-plan`: "a turn already planned is not planned again..."; `econ-batch`: "on load, a balance at snapshot + income + net landed..."; `econ-properties`: "a loan is never planned twice..." |
| 23 | Loans Off and Antiquity | Loans Off: no transfer, no event, ledger untouched. The Antiquity dormancy is gone (TEST-PLAN 12.6): stages gate the parts (choice 27) | `econ-plan`: "Loans Off: no write of any kind", "stage gates (TEST-PLAN 12.6)..." |
| 24 | World account ids | The strings `bond`, `temple` and `tax`, never a number, so none can reach `grantYield` as a player id; `alive-target` fails if one does | `econ-invariants`: "alive-target fails on a grant to a dead or unknown player, or to a world account" |
| 25 | Envelope size (debt-5) | DESIGN 9 fixes the event log at 100 and the envelope at 64 KB and leaves the loan counts open. With the 4.1 record's new fields the caps are 6 open loans per borrower (was 8) and 32 settled loans kept (was 64); the worst case the caps allow for 12 civs fits. Save drops events, then settled loans, never an open one. The open-loan cap is only an envelope bound now: `emergency_cap` is what stops a guard from chaining | `econ-state`: "envelope: the worst case the caps allow..."; `econ-plan`: "the open-loan limit..." |
| 26 | debt-2 says `m > 3` while active | DESIGN 4.4 defaults at `m >= 3`, so the check is the stricter `m >= 3` while active | `econ-invariants`: "debt-2 fails on ... an active loan at three misses" |
| 27 | How stages reach the model | The glue records the turn each civ reached a stage (DESIGN 4.15, `isNodeUnlocked` on the anchor's node) and passes `civ.stages = { moneylending, publicDebt }`; the model only asks whether a stage is open on this turn. Economic stages Off (`options.stages: false`) opens everything. Civ loans need Moneylending on both sides; the bond market and 20- and 30-turn terms need the borrower's Public debt; a civ lender needs a Bank (`depthTurns > 0`) for those terms | `econ-stages`; `econ-lenders`: "stage gates...", "terms (DESIGN 4.3)..."; `econ-plan`: "stage gates (TEST-PLAN 12.6)..." |
| 28 | Who can ask for a restructure | The borrower, or a human lender answering the AI's ask. The bond market and AI lenders accept the borrower's request by rule. An AI borrower at `m = 2` restructures by itself unless the lender is human, in which case the human gets a `restructure-ask` notice each turn it stands and a `restructure` request with the lender's pid performs it | `econ-plan`: "restructuring (DESIGN 4.4)...", "restructuring by the AI rule..." |
| 29 | Who the witnesses are | Every other living major civ with a relations row with the repudiator, the lender left out (it gets the grudge instead). The glue passes a row for each pair the civ has met | `econ-repudiation`: "repudiating a civ closes every open record..."; `econ-plan`: "repudiating a civ (DESIGN 4.5)..." |
| 30 | Halving -3 relationship | Rounded half up to -2 against an enemy at war; -6 for the bond market and temple treasuries, which never halves (a world account can't be at war) | `econ-repudiation`: "witnesses: -3 each; doubled...; halved..." |
| 31 | The grudge in integer grievances | `divRound(5 * writtenOff, max(1000 cents, lender income))`, clamped 10 to 40. Only civ lenders get a grievance row; the glue books it on the repudiator against the lender | `econ-repudiation`: "grudge (DESIGN 4.5)..." |
| 32 | "Open emergency principal" for `emergency_cap` | What's still outstanding on the civ's open emergency loans, so paying one down frees the allowance as DESIGN 4.6 says | `econ-credit`: "...emergency principal counted apart"; `econ-plan`: "guard cap..." |
| 33 | "Told once" at the cap | One `guard-cap` notice per spell: the ledger keeps the last turn the cap stopped a loan per civ, and a stop that follows one on the turn before is quiet. The notice carries the deficit, the cap, the insolvency flag and the disband line | `econ-plan`: "guard cap: at emergency_cap the guard stops with one notice per spell..." |
| 34 | AI "at `emergency_cap`" for the bond-market repudiation | The cap stopped a loan for that civ on the turn before (the repudiation step runs before the borrowing step) | `econ-ai`: "repudiation rule (DESIGN 6)..."; `econ-shortfall.js` `aiRepudiate` |
| 35 | AI emergency principal | The same as the human's guard loan: back to the engine's amenity line plus one turn of upkeep, capped by `emergency_cap`, through the one `guardDecision`. `upkeepCents` comes from the glue for every civ, the way `incomeCents` does (the `Treasury` getters read for any player from the UI context; P2 names them). An AI differs only in trying a standard loan first while short but solvent (DESIGN 6). Earlier on 2026-10-29 the AI borrowed the bare shortfall against a line of 0; changed the same day so the AI plays the rule the player gets | `econ-plan`: "an AI's emergency loan is the human's guard loan...", "AI borrowing: past the 4.2 limits..." |
| 36 | Depth in 1.0 | Commerce and Banking roles ship in 1.0 (DESIGN 11); the glue computes `depthTurns` (0 to 12) and `depthFactorPct` per civ from the buildings and passes them in; the model applies them to `credit_cap` and the rates and treats `depthTurns > 0` as "has a Bank" | `econ-credit`: "credit cap: (12 + depth_turns ...)"; `econ-lenders`: "r_L = base / standing * relation_factor ... * depth_factor" |
| 37 | The tax fallback's "falling" and happiness inputs | The fallback is off unless `options.taxFallback` is set. "Balance falling" means below the balance the last batch snapshotted (`ledger.lastBatch`), and income below 0 on the first turn; the celebration share needs `civ.happinessCents` from the glue. A Light remittance the funds can't cover is missed, not carried | `econ-tax`: "the plan runs taxes only with the fallback flag on..." |
| 38 | Order of refusals | Credit cap before the debt-service limit; a term gate is named only where the lender would lend at 10 turns, otherwise the refusal is `no-offer` | `econ-plan`: "borrow refusals...", "term refusals name the gate..." |
| 39 | Where the batch runs | `TurnBegin`, right after the roll: every balance is fresh, nobody has spent, and a negative balance with positive income has just been wiped (P3, P4). The model's "income" in a payer's funds is then the next roll's, so a payment can leave a balance below 0 within the turn by at most that income, and the roll brings it back to 0 or above; the engine's wipe never has anything to erase. The ledger is written before the grants go out | `econ-session`: "a turn writes the ledger before any grant..." |
| 40 | The guard and positive income | The guard fires only below the line *and* with income at or below 0 (P4: a positive-income dip is wiped free). An AI's emergency loan goes through the same decision. A short AI with positive income still tries a standard loan first (DESIGN 6), though at `TurnBegin` its projected balance can't be below 0 with positive income, so that branch only matters if the engine's wipe ever stops | `econ-guard`: "the guard stays out of a dip with positive income..."; `econ-plan`: "AI borrowing: past the 4.2 limits..." |
| 41 | How the reload check reads income | At `TurnBegin` the snapshot already holds the roll's income, so `batchStatus` is read with no income term: a balance at the snapshot is a lost batch, at snapshot plus net a landed one, anything else (the player spent) is left alone | `econ-session`: "on load, a batch saved this turn whose grants never landed is re-sent..." |
| 42 | When a player's request runs | At the next `TurnBegin`, in the order made, as DESIGN 4.14 step 2 says; the Loans tab lists what's queued and lets the player take one back. The queue lives in the glue envelope so a save mid-turn keeps it | `econ-session`: "the glue envelope keeps requests..." |
| 43 | Stage anchors with no node in this age | The nodes come from this age's `ProgressionTreeNodeUnlocks`. With none, the anchor's own age decides: a building's `Age` row, else the 1.5.0 age of DESIGN 4.15's table held as a constant per stage. An earlier age's stage is open from the age's start, a current or later age's stays closed. A tradition's row names no age, which is why the constant exists | `econ-stage-rules`: "with nodes in this age the civ needs one; without..." |
| 44 | Depth weights in 1.0 | Every standing building weighs 1 and a damaged one 0; the previous-age fading of DESIGN 4.16 is 1.2's. Banking needs the Bank's own Gold yield read from the data, falling back to 8 when no Bank row exists | `econ-depth`: "depth = sum of Gold / 4..." |
| 45 | The AI strategy rows' option | Gated on Taxes with the cards, since they only steer the card pass (DESIGN 4.7 says so); `econ-ai-lists.sql` (AI option) holds no rows yet | `econ-data`: "the modinfo loads the effects behind the Taxes option..." |
| 46 | The top-bar pill | Drawn beside the mod's dock button, through the same `panel-sub-system-dock` decoration Demographics and Emigration use: no Tower mod has a watched top-bar host. Red while any of the player's loans is in default | `econ-bootstrap` `pillSource`; watched: owed |
| 47 | The relationship level read | `Diplomacy.getRelationshipEnum` against the `DiplomacyPlayerRelationships` enum, war first: hostile and unfriendly read `unfriendly`, friendly, helpful and alliance read `friendly`. A pair that hasn't met (`hasMet`) has no row, so it isn't a witness | `econ-session`: "every major is read with the same fields..." |
| 48 | Upkeep per civ | Unit upkeep is the `Treasury` getter per distinct unit type the civ fields; building upkeep is the city's per-building Gold maintenance over its constructibles (P2). P2 left the AI's building figure open against the engine's log; the same read is used for every civ until a run settles it | `econ-session`: "every major is read..."; owed 6.8 |
| 49 | The Fiscal swap | Deactivate the active tax card, wait for `TraditionChanged` (3 s at most), then Activate the new one, only when `canSwapCultureSlot` reads true (P17). With no tax card active, Activate alone; if the engine refuses it the tab says to free a slot | `econ-fiscal`: "a swap with a card active is Deactivate, then after TraditionChanged, Activate..." |
| 50 | One notification per turn | Composed at `TurnBegin` from the plan's notices, the human's refusals and the batch row, sent at the local `PlayerTurnActivated` (or at once if the turn is already active), one `NOTIFICATION_ECONOMICS_TURN` with the lines joined by `[N]` | `econ-notify`: "held at TurnBegin, sent once at the local turn..." |
| 51 | Where the card numbers live | `CARD_LEVELS` in `ui/econ-tax-cards.js` is the one place; `scripts/sync-tax-cards.mjs` writes the six `Amount` arguments, the comment above each card and the amounts in each description row (all 12 text files, only a number written right before "Gold" or "Happiness"; a trailing `%` from the old percentage cards is dropped). The script fallback's `TAX_LEVELS` in `econ-tax.js` stays separate, since it's off and has a Standard level | `econ-data`: "the card numbers live in CARD_LEVELS..." |
| 52 | The Fiscal forecast | DESIGN 4.7 asks for Gold, Happiness and the next celebration under each card. Since the cards became flat amounts in each settlement (2026-10-29, DESIGN 4.7), the change is the difference between the two cards' amounts times the civ's settlements; the settlements' summed `Yields.getYield` is shown as the base, and the turns counted as the game's policies button counts them (`nextGoldenAgeThreshold` less the lifetime Happiness, over net Happiness a turn, at least 1). Read for the local player only: it's screen text and never reaches the plan | `econ-tax-cards`: "each card against no card..."; "with a card slotted..." |
| 53 | A save from before its turn's batch | On load, a ledger whose last turn is behind the game's runs this turn's batch once (`load catch-up`); with the local turn already active the notification goes out at once. The plan's "already planned" skip keeps a later `TurnBegin` from repeating it. P15 puts the autosave about 4.7 s after the batch is sent, so this is for a save that beat the batch | `econ-boot`: "a save from before its turn's batch runs that batch once at load..." |
| 54 | The locale placeholders | `scripts/sync-locales.mjs` keeps a baseline of the English each row was synced from (`scripts/locale-baseline.json`); a row whose English changed gets the new English, so a translation of the old meaning never ships under a new one | by hand: change one English row, run the sync, read the eleven rows |
| 55 | The mod's file URLs | The screen's CSS and HTML and the dock icon are under `fs://game/tower-economics/` (the mod id), which is where the game serves a mod's files; the folder name is `economics` | owed S.1, S.5 |
| 56 | Where the bill's copies come from | The bill (DESIGN 4.10) is built from the importer's `Resources.getResources()` entries whose origin city (`Game.Resources.getOriginCity`) a major owns, grouped by that city, the read Demographics ships. Routes (`Trade.getCurrentTradeRoutes`) only say which of the importer's cities takes them, for its Trade buildings; with no route read, the importer's side counts none. So the bill doesn't wait on P7's per-route read, and the route-count fallback isn't needed | `econ-commerce-read`: "routes between majors..." |
| 57 | The game's own exporter payment | The game's text says the exporter gains Trade Income per copy (`TradeYields`: 3, 6, 9 by land, 6, 12, 18 by sea in Exploration; 4, 8, 12 and 8, 16, 24 in Modern), but `city.Yields.getTradeYields()` read 0 in every route city in the 1.1 probes (C9). The bill stays the design's importer-to-exporter transfer (DESIGN 12 item 6's default), at level 2: the native per-import charge works (C9) but is player-wide and can't net a pair, cap a payment or hand the Gold to the exporter. The Trade tab shows the game's Trade Income only when the read gives something | `_balance-commerce`: `routeProfitRows` |
| 58 | A payment the funds can't cover | A settlement is paid in full from the payer's own funds at step 6 or waived, like the over-cap part; nothing is carried | `econ-commerce`: "one netted bill per pair..." |
| 59 | The AI's tariff | It matches a High tariff held by a civ that imports from it, two turns after that tariff was set, and drops back once none does; a Low tariff isn't matched. The 5-turn change limit binds the AI as it binds the player, so the two never run different rules; if the limit blocks the match, it comes as soon as it's allowed | `econ-trade`: "the AI matches a High tariff..." |
| 60 | Where a development loan's Gold goes | To a world account, `progress`, and the progress lands with `addProgress` on the city's current build; only the Gold the progress uses leaves the investor (3 Gold a point), so "the rest is returned in that batch" is the rest never sent. The record's principal is the Gold used | `econ-commerce`: "a development loan on an AI city's current build..." |
| 61 | Investment records | Kept beside the loans in `ledger.investments` (ledger version 3), with their own id counter (`I1`, `I2`, ...), so the loan code's credit, service and outstanding sums are untouched. Misses, default, the lender block and the garnish follow the loan rules (DESIGN 4.12); the dividend itself doesn't step up on a miss, since its size is the contract. Dividends are paid after the payer's loans in step 8 | `econ-invest`: "a dividend paid in full or missed..." |
| 62 | General investment's growth | `growth = income now / income at investment`, clamped 0.5 to 2.0, the base counted from 10 Gold a turn so a civ invested in at 1 Gold doesn't read 20x growth; income at or below 0 now reads 0.5 | `econ-invest`: "growth = income now / income then..." |
| 63 | Relationship from a gift | `floor(G / (k * max(10 Gold, host income)))` with `k` 5, 7.5 and 2.5 turns, booked once on both sides. The cap of 10 points on one gift is ours, so a rich civ can't buy a whole relationship in one turn. The owner can lift it (`INVEST.maxRelationship`) | `econ-invest`: "relationship: +1 per 5, 7.5 and 2.5 turns..." |
| 64 | The AI investor | Income above 0, balance above 20 turns of income, solvent, at most once per 10 turns (the turn kept in the markets envelope, so a declined offer counts), Friendly hosts in id order that haven't repudiated a debt to it in 40 turns; general when the host's income stands above where it was ten turns ago, else a development loan on a city's current build, role buildings first; 5 turns of its own income. Aid: to a Friendly civ in default, once per age, 5 turns of income (Depression is 1.2) | `econ-commerce`: "the AI invests in a Friendly civ...", "AI aid..." |
| 65 | Offers to the human | An AI's investment in the human is an offer kept 3 turns; the player accepts or declines on the Trade tab, and an accepted offer runs the same checks again | `econ-commerce`: "to the player an AI investment is an offer..." |
| 66 | The 1.1 options and Loans Off | Loans Off no longer skips the batch: it stops the loan rules, the guard and loan requests, and the batch skips only with Loans, Markets and Foreign investment all off. Tariffs act only with Markets on | `econ-plan`: "every part Off: no write of any kind; Loans Off alone..." |
| 67 | The markets envelope | Its own `Configuration` key (`tower-economics-markets`), at most 32 KB: prices, 30 turns of history, tariffs, ten turns of each civ's income, the age each AI last gave aid, the turn each last invested. Past the cap the histories are halved first. Written with the ledger, before the grants | `econ-markets`: "econ-5..." |
| 68 | The AI's aid as Military Aid | With Foreign investment on, Military Aid's completion stage gets a second modifier charging the initiator the target's 2 Gold a turn (scaled by age), in the probe's shape (C1 compiled it). It's the one diplomatic action the AI was watched starting (C13). The section 6 aid rule (a Friendly civ in default) runs beside it, since Military Aid's AI doesn't look at defaults | `econ-data`: "Military Aid's initiator pays..." |
| 69 | How turns are counted across ages | `Game.turn` restarts at 1 in each age while the ledger carries over, so the glue keeps `{ age, base, last }` and gives the plan `base + Game.turn`; a new age moves the base to the last turn counted. A save from 0.3.0 with no count, whose ledger's last turn is ahead of the game's turn, starts the base there | `econ-turn-count`: "a new age moves the base...", "a save from before the count existed..."; "in game: the first batch of a new age runs..." |
| 70 | The cycle's units | `E` and `L` in basis points (10000 is 1.0), every weight an integer (war declared -200), so a reload replays the same cycle to the point | `econ-cycle`: "E reverts a tenth...", "E: k * s * the clamped sum..." |
| 71 | When a default or repudiation weighs | The turn after, from the ledger's last batch: the snapshot comes before the steps that make them, and the cycle shouldn't depend on their order | `econ-cycle`: "defaults weigh on both parties..." |
| 72 | Where wars, peace and routes come from | Wars and peace from the relations between majors against last turn's (M9: the declared-war event also names Independents); routes from the plan's own routes, which are read only with Markets on | `econ-macro`: "a war moves E...", "routes between civs are events..." |
| 73 | Who a raze weighs on | The civ holding the settlement it razes: the one that lost it took the capture's weight | `econ-macro-read`: "the cycle's engine events..." |
| 74 | "Population lost" in a disaster | The settlement has fewer people at the next batch than at the batch before (M6: the drop lands at the event or a turn later); a population that didn't read counts as not lost | `econ-macro-read`: "the cycle's engine events..." |
| 75 | The caps on ongoing wars and standing routes for one civ | The same -0.02 and +0.01 caps on each civ's own sum as on the world's | `econ-cycle`: "ongoing wars cap at -0.02..." |
| 76 | "From the Banking stage" for a Panic | Once any living civ has Banking (the world stage, 4.15); every human gets the notice | `econ-macro`: "Panic: from Banking..." |
| 77 | A Planned civ and the cycle | Outside it: no `L`, no cycle Gold, no erosion, a bond spread of 1.0, phase "outside" | `econ-macro`: "a Planned importer pays the class price..."; `econ-macro-state`: "readings..." |
| 78 | Cycle Off | The state rests at 1.0 every turn, with no events kept and no shock | `econ-macro`: "a boom pays cycle Gold...; the cycle Off moves nothing" |
| 79 | How cycle Gold moves | A boom's Gold is a world inflow counted in the payers' funds before their charges (4.14 step 3); a slump's charge is step 5, paid in full from the payer's funds or skipped, never carried | `econ-macro`: "a boom pays cycle Gold as a world inflow..." |
| 80 | A government that reads none, and the first system | None (the first turn of an age, M4) keeps the last system; a civ's first system isn't a change; a number blends from the turn after the change, so the turn of the change runs on the old numbers; a yes-or-no term switches at once | `econ-systems`: "next systems: ...", "a change blends each number..." |
| 81 | The -0.03 reform shock and k | Every `L` term, the shock and Corporatist's war boom included, is scaled by the option's `k`, so Off has no shock | `econ-macro`: "systems come from the government..." |
| 82 | The systems' tax lines in flat yields | DESIGN's percentage of each card's flat amount, rounded to a whole yield a settlement (DESIGN 4.17's table); Tribute's 15% cheaper celebration rounds to nothing on Heavy's -2 | `econ-data`: "the systems' tax lines..." |
| 83 | "No tax levels; the plan instead" for Planned | A Planned civ keeps the tax cards, the game's own policies its AI plays, and the plan runs beside them; "no tax levels" came from the script tax version | `econ-macro`: "a Planned importer pays the class price; the plan..." |
| 84 | A Religious lender's partnership | Every loan a Religious civ makes (emergency ones too) records the borrower's income; each turn's interest is the loan's rate times growth (income now over then, 0.5 to 2.0, counted from 10 Gold), the principal paid as scheduled | `econ-macro`: "a Religious lender's loan is a partnership..." |
| 85 | Whose rate a system changes | The borrower's share (`borrowPct`: Tribute 1.2 from civs, Merchant oligarchy 0.8) applies to its civ and bond loans; the lender's (`lendPct`, Merchant oligarchy 0.8) to what it lends; `bondPct` to the bond market only; temple treasuries take none | `econ-macro`: "system terms in the rates and credit..." |
| 86 | "Civ lenders only" and emergencies | No bond offers; after Public debt the guard's world lender is temple treasuries instead of the bond market (DESIGN 4.6 says such a civ still gets them) | `econ-lenders` via `econ-macro` |
| 87 | Citizen loans' place among lenders | Offered beside the civ lenders at 10-turn terms, cheapest first, within `citizen_cap` (settlements with a standing Commerce building); the 4.2 limits on top; so an AI's shortfall borrowing can take them too | `econ-macro`: "citizen loans: offered to a Civic market civ..." |
| 88 | Repudiating the citizens | Recorded as a repudiation at the 0.15 standing cost (`atWar`), so it also counts in `credit_cap`'s repudiation turns and the 10-turn term limit; no witnesses, no grudge, the citizens closed 30 turns, the meter -10 turns of its gain | `econ-macro`: "repudiating the citizens..." |
| 89 | Mercantile's investment and tariff lines | "Dividends +1 point" is 10 thousandths more on the records a Mercantile investor opens; "High tariff relationship cost ½" is the cost every 10 turns instead of 5 | `econ-macro`: "a Corporatist host takes development loans only; Mercantile..." |
| 90 | How Manorial's and Mercantile's bill terms combine | Both multiply what's owed after the tariff: a Manorial importer pays 0.8, a Mercantile exporter is owed 1.1 | `econ-macro`: "bills between systems..." |
| 91 | A Planned importer's fixed prices | The class price (DESIGN 4.9's `base_c`) of each copy, from the turn's market read; no scarcity, demand or `E` | `econ-macro`: "a Planned importer pays the class price..." |
| 92 | Where Civic market's Commerce share and Corporatist's Industry count apply | In the glue's depth and Factory-demand reads, with last batch's systems at this turn's blend (one turn behind a change) | `econ-macro-read`: "the roles a building had in its own age..." |
| 93 | Capitalism's world effects | Prices smooth at 0.5 once a Market or Mixed civ has the stage; equity growth applies on a Market or Mixed host past it; an AI investor of those systems past it also invests in Neutral hosts that are too | `econ-macro`: "the AI aids a Friendly civ in its own Depression; from Capitalism..." |
| 94 | Old buildings without stored state | Each weight from the building's age, the current age, the successor stage's turn, the age's first turn and the city's current-age buildings of the role; the roles a building type had in its own age are remembered in the glue envelope; a unique is a `Buildings.TraitType` row | `econ-legacy`; `econ-macro-read`: "an old Market fades from Public debt..." |
| 95 | Where the cycle and systems are saved | Their own envelope, `tower-economics-macro` (32 KB, econ-6), so the markets envelope stays as 1.1 left it; events go first past the cap, then E's history halves | `econ-macro-state`: "past 32 KB..." |
| 96 | The AI's aid "in its own Depression" | The host's own phase (`E + L` below 0.8), as the readings give it this turn | `econ-macro`: "the AI aids a Friendly civ in its own Depression..." |
| 97 | The phase notice | Only on a change, not a civ's first reading; its causes are the turn's three heaviest events the civ took part in, else the world's | `econ-macro`: "the engine's events and the crisis reach E..." |
| 98 | Engine events between batches | Kept in the glue envelope, at most 32, weighed once at the next batch | `econ-macro-read`: "in game: an event kept between batches..." |
| 99 | What the Fiscal tab's "now" shows | The civ's net Gold and Happiness a turn (`Stats.getNetYield`, the top bar's figure, P2), not the settlements' summed `Yields.getYield`, which read 0 Gold in the lab while the civ's net was positive (build check 5.2a, 2026-10-30). The card's change is still its flat amount times the settlements | `econ-fiscal`: "the forecast read takes the civ's net Gold and Happiness..." |
| 100 | "All off" and its log line | The batch skips only when Loans, Markets, Foreign investment, Inflation, Business cycle and Economic systems are all off: the cycle and the systems move Gold on their own. The lab's all-off game (build check C.2, 0.3.0) couldn't set the 1.2 options, which read their defaults (cycle Standard, systems On), so its batch ran as it should; the skip line itself went only to the debug log, so a released copy never showed it. It now goes to the log once a session | `econ-session`: "every option off, the 1.2 ones too..." |

## Findings: where DESIGN looked wrong, and what the revision did

A. **`credit_cap` is 0 exactly when the guard is needed.** Settled: DESIGN 4.2 and 4.6 now say emergency loans skip
both limits and have `emergency_cap` instead (choice 10).

B. **The guard leaves the amenity penalty uncovered.** Settled: DESIGN 4.6 puts the guard line at the amenity line
(0), read from GlobalParameters; the disband line is only quoted in the cap notice (choice 9).

C. **Garnish never clears a default when income is 0 or below.** Settled: DESIGN 4.5 adds the branch from the
balance (choice 8). Measured again in the balance run (DESIGN 10 note): defaults now clear while a civ holds Gold, and
an insolvent civ that holds none stays in default until its income returns, which is the designed behaviour.

D. **Missed payments are cheap to roll.** Settled: the missed interest joins `O` (choice 1).

E. **AI acceptance of a player's loan has no affordability test.** Settled: DESIGN 5 adds income > 0 and the 4.2
limits (choice 15).

F. **The guard can fire every turn.** Settled: `emergency_cap` bounds it to about 10 turns of deficit and then tells
the player once; the open-loan cap is only an envelope bound (choices 25, 33).

G. **A Market doesn't pay its own interest within a 10-turn term at the base rate.** New, from the balance run: a
Market bought for 360 Gold yields 30 to 50 Gold over 10 turns against 59 Gold of interest at 0.03 (DESIGN 10 note,
"Borrowing pays"). The same holds for a Bazaar at 0.02 and a Bank at 0.015. Borrowing still beats saving when the
building would otherwise wait 36 turns, so the check's reading decides; the constant to move is `base_rate`.

H. **AI repudiations are all against the bond market or temple treasuries.** From the balance run: with the section 6
rule, repudiations come only from insolvent civs at the cap; none against a civ lender, because AI-to-AI loans are
rare when the lender must hold 20 turns of income and the borrower must be short but solvent. Repudiation against a
civ shows up with wars in the loans' lifetime, which the 500-turn run had few of. Whether that's rare enough or too
rare is the owner's read (DESIGN 10, "Repudiation").

I. **The guard's income condition empties the AI's "short but solvent" branch at `TurnBegin`.** With positive income
the engine wipes a negative balance at the roll, so at `TurnBegin` a civ with positive income is at or above 0 and
its projected balance (payments never overdraw) stays there: the standard-loan branch of DESIGN 6 only fires in the
simulation, where balances are generated. It stays as written in case the engine's wipe is ever found not to hold.

J. **Previous-age buildings carry no tags in a later age's database.** From the 1.1 fixtures (`../tests/fixtures/
commerce-*.json`, read from the compiled 1.5.0 Exploration and Modern databases): in Exploration the Market has no
`GOLD` tag, and in Modern the Bazaar, Guildhall and Bank have none either. So Commerce and Banking (1.0 depth) lose
the previous age's buildings at the transition, while Trade still finds them through `ADVISORY_CLASS_TRADE`. That's
close to what DESIGN 4.16 (1.2) wants to do gradually, but it happens at once and by data, not by the mod. Owed: read
an Exploration civ's depth with Antiquity Markets standing; 4.16 should start from this.

K. **The trade-bill cap binds for nearly every payer.** From the 1.1 balance run (10 seeded 12-civ games, 40 routes,
Exploration incomes of 9 to 35 Gold): about 97% of the settlement rows paid the cap and waived the rest, the median
payment was 3% of the payer's income, and civs' mean net settlement ran from -4 to +5 Gold a turn. At these incomes
the bill is, in effect, "a tenth of income to the partners you buy more from". The route itself stays worth making
for the exporter (the engine's Trade Income plus the bill); whether the importer's cost is right is open question 6.
If the owner wants the bill to scale with what's traded rather than with income, `TRADE.billPct` or the cap is the
constant to move.

L. **`addProgress` lands bigger than it's sent.** From the 1.1 probes (C3): a 20-progress grant took Silla's Bazaar
from 0 to 76.5 progress 3 s later (12% to 30%), and it read 45.9 at the next step. DESIGN 4.12 expected the grant
"scaled up by the city's production bonuses", but nearly 4 times is more than a bonus, and the two reads disagree.
Until it's read again, a development loan may buy a host far more than `G / 3` production; the ratio row in the
balance run is the lower bound. Owed: one grant on a city with no production bonuses, its percent before and after.

M. **The AI's citizen rule as written can't pass the debt-service limit.** Five turns of income over 10 turns makes
the first slice alone half a turn of income, past 4.2's 35%. The rule now borrows the most whose first payment fits,
about three turns of income at the base rate (`econ-citizens` `servicePrincipalCents`); a player asking for five gets
the `service-cap` refusal. DESIGN 6's citizen row says so.

N. **War Levy shipped in 0.3.0 asking for eight wars.** The change to flat amounts wrote the card's +8 Gold and -4
Happiness into its war requirement's `Amount` (the first one after the modifier's id) and left +30 and -40 on the
yields, so a slotted War Levy cost 40 Happiness in every settlement and paid nothing. Fixed in `sync-tax-cards.mjs`
and the data; `econ-data` now reads the modifier's own Amount.

O. **A new age stopped the batch until its turn passed the old age's last.** `Game.turn` restarts at 1 while the ledger
carries over, so 0.3.0's "already planned" check read every turn of the second age as planned. Fixed by counting turns
across ages (choice 69); a 0.3.0 save made after an age change picks up from its ledger's last turn.

P. **The world leans to Boom.** From the 1.2 balance run (DESIGN 10): each standing route's +0.001 a turn and the
world-income term rise with ordinary growth, so `E` sat in Steady or Boom in every game and a peaceful game never
slumped. Without the two terms the same games slump on 7 to 20% of turns. The owner reads it against "a peaceful game
still slumps sometimes".

Q. **A Panic needs borrowing the AI doesn't do.** Leverage peaked at 5% of the Gold held in the balance games against
the 150% a Panic needs: the AI rules borrow only when short, and with positive income at `TurnBegin` an AI is never
short (finding I). As written a Panic comes only from a player who borrows heavily.

R. **The plan buys production cheaply.** At the development loan's 3 Gold a point the plan's production is worth 1.33
times the Gold it takes at the game's purchase price (4 a point), before production bonuses scale `addProgress` up
(finding L), and a Planned civ keeps its tax cards (choice 83).

S. **The AI clusters on a few governments, so on a few systems.** In the M-probe transition game every AI took Feudal
Monarchy or Theocracy in Exploration and Authoritarianism in Modern (Corporatist until an ideology); in Antiquity five
of six took Classical Republic. System diversity in play is narrower than DESIGN 4.17's table, and the mod doesn't
steer the pick (M2: only bias lists do).

T. **The government pick ignores government modifiers.** M2 moved no civ with +10 Gold, +5 Production and +5 Science
a settlement; a bias row moved four. DESIGN 4.17's "the AI weighs them when it picks a government" is out: the
modifiers change what a system pays, not who picks it. The rest of the 2026-10-30 macro results, as 0.4.0 reads them:
the government-only Republican Levy card was unlocked only for Classical Republic civs and never slotted (M11), so no
government-only card ships; -50% purchase efficiency raised Persia's prices by exactly half (M10), a native price rise
the owner can weigh, but nothing native follows bond debt, so inflation stays script; and on the Communism root only
the big arm (+10 Gold, +5 Production, +5 Science) changed a pick, the Autoplay seat taking Communism where it had taken
Fascism while Persia went the other way, so the tally held at one each and the call waits for seeds 9001 and 1234. No
1.2 rule leans on the AI choosing an ideology for the mod's sake. `../tests/econ-data.test.mjs` pins that the data
carries no bias rows, government-only cards or price modifiers.

U. **A 300 Gold loan at early income is refused by the limits as written, not by a sizing bug.** The lab's build
checks (1.1, 2.6, 2026-10-30): at 20 Gold of income the credit limit is 12 turns, 240 Gold, so 300 is over it; and 50
Gold at 9 Gold of income needs a first payment of 7 (2 of interest at the bond market's 4%, 5 of principal) against
35% of income, 3.15. The arithmetic is pinned in `../tests/econ-limits.test.mjs`. What it shows: the debt-service limit
binds long before `credit_cap`. A 10-turn loan's first payment is a tenth of the principal plus the rate, so the
service limit holds it to about 2.5 turns of income at the bond rate (4.8 turns over 30 turns), against `credit_cap`'s
12. Nothing is changed; whether the two limits should meet (a longer term, or `credit_cap` lowered toward what the
service limit allows) is the owner's call, with "Borrowing pays" and `base_rate`. The owed check 1.1's 300 Gold needs a
civ with about 120 Gold of income at 10 turns, or a smaller loan, as the lab's 50 Gold one was.

## Balance run and mutation

- The 1.0 balance rows ran 2026-10-29 in `../tests/econ-balance.test.mjs` (20 seeded 12-civ 500-turn games, On against
  Off); the numbers are in DESIGN 10's dated note and `../reports/balance-1.0.json`.
- Mutation (Stryker, `npm run mutation`, 2026-10-29, 842 mutants, house bar high 75 / low 60): overall 85.3;
  `econ-conservation.js` 98.6, `econ-stage-rules.js` 97.5, `econ-credit.js` 97.4, `econ-payments.js` 89.9,
  `econ-depth.js` 88.4, `econ-tax-cards.js` 88.2, `econ-plan.js` 75.3. The survivors in `econ-plan.js` are mostly
  event and notice field values and the order of equivalent branches; `../reports/mutation/mutation.json` lists each.
- The 1.1 balance rows ran 2026-10-29 in `../tests/econ-balance-commerce.test.mjs` (10 seeded 12-civ 200-turn
  Exploration games, Markets On against Off, plus the price, ratio and wide-tall tables from the compiled 1.5.0 rows);
  figures in `../reports/balance-1.1.json`, findings K and L above.
- Mutation on the 1.1 modules and the flat tax cards (2026-10-30, the same house bar): `econ-invest.js` 94.7,
  `econ-trade.js` 93.9, `econ-commerce.js` 92.4 (74.0 on the first run, before the edge tests in
  `../tests/econ-commerce-edges.test.mjs`), `econ-prices.js` 91.4, `econ-tax-cards.js` 91.3, `econ-view-commerce.js`
  86.2, `econ-markets.js` 83.9, `econ-invest-open.js` 82.5. The survivors are mostly event field strings and
  sort tie-breaks that no rule reads.

## Not done here

- Watching any of it in a game: `docs/verification-runs.md` lists each check under "Owed".
- P16 (whether the grudge ends in war) can't be modelled offline; the simulation counts repudiations and reads the
  repudiator's later rates only.
