# Economics: design

Status 2026-10-30. 1.0 Finance (loans, the guard, taxes, the 1.0 stages), 1.1 Commerce (prices, trade bills,
tariffs, investment, the other roles and stages) and 1.2 Macro (inflation, the business cycle, old buildings, economic
systems, the Banking and Capitalism stages) are built and gated offline, versions 0.2.0, 0.3.0 and 0.4.0
([NOTES.md](NOTES.md)); none of it has been watched in a game. The 1.0, 1.1 and 1.2 probes ran 2026-10-29 and 10-30
(section 10 and `mod_ideas_tested/economics/devtools/probe-runs/`). Engine claims are watched (`engine-closed.md`) or
unverified and listed in section 10. Corpus: none of 1249 reference mods
add debt, inflation or markets.

- Name: Economics, in game and in the folder name (`economics`).
- Section numbers are fixed: `ui/` and `NOTES.md` cite 1, 4.1 to 4.6, 5, 8 and 10.
- Units: Gold in integer cents, rates in integer parts per million (`econ-money.js`).
- Constants are starting points for the Node simulation, not tuned values.
- "Civ" means a major civ. City-states and independents never borrow, pay taxes, carry bills or take investment.
- `income` is net Gold per turn as the game reports it (4.2). A section number in brackets points to where a term is
  defined.

## 1. What the player gets

| Part | Summary | Defined in |
| --- | --- | --- |
| Loans | Borrow against income from other civs (from Moneylending, Antiquity) or a bond market (from Public debt, Exploration), within an income-based limit. A missed payment raises the rate, adds the interest to the debt and costs Influence; an overdue loan can be restructured once; three misses in a row is default: garnish, lender blocked for the age, chronicle entry. A civ can also repudiate a debt outright: it keeps the Gold, and pays in reputation, a grudge that can lead to war, and dearer, scarcer credit | 4.1 to 4.6 |
| Lending | The player lends to an AI that can pay it back and collects interest | 5 |
| Guard | Optional emergency loans before the engine's negative-balance penalties, up to a cap; past the cap the game's penalties apply | 4.6 |
| Taxes | Policy cards: Light Taxation, Heavy Taxation, War Levy. Gold against happiness, in a policy slot. No card plays like the base game | 4.7 |
| Inflation | Off by default. Bond debt erodes Gold held above a generous reserve and raises bond rates | 4.8 |
| Markets | A world price per resource, set by source copies and demand | 4.9 |
| Trade bills, tariffs | Each pair of civs settles the net value of the resources they import from each other, capped by income; optional tariffs | 4.10 |
| Business cycle | A world index moved by game events and by the world's own income, trade and lending: Boom, Steady, Slump, Depression, Panic | 4.11 |
| Foreign investment | Development loan (a city's current build), general (the treasury), or either as aid | 4.12 |
| Economic buildings | The game's buildings act by the role their data gives them | 4.13 |
| Stages | Each part opens with the tech or civic that historically brought it in | 4.15 |
| Old buildings | Previous-age buildings fade gradually and leave a slump cushion | 4.16 |
| Economic systems | Government and ideology pick the system: tribute, manorial, planned, and others | 4.17 |
| Economics screen | Treasury, Loans, Fiscal, Markets, Trade and World tabs | 9 |

Purchase prices and building costs can't be written at runtime and stay as the game sets them (4.8 works around it).

### Goals

This is a strategy layer on Civ VII, not a historical simulation. History supplies the names and the shape of each
part; the numbers are set for play. A part belongs in the mod when it meets these four:

- It gives the player a choice with a visible trade-off. A number that moves where the player can't see why, or
  can't respond, doesn't belong.
- It grows with the civ. Antiquity has taxes, tribute and loans between neighbours; bonds, markets, cycles and
  systems arrive later, so the early game stays simple without being empty.
- It keeps the base game's strategies worth playing. Trading, building and expanding gain depth and stay profitable.
  The mod's charges on an AI, which can't see them, stay small enough that an AI only gets into trouble for a reason
  the player can name: a war, a default, a disaster, a bad run of income.
- Its losses are explained and recoverable. The Economics screen names the cause of each Gold change the mod makes and
  at least one way to respond.

Play the design aims for, used to judge whether a part earns its place:

- Borrow early to buy a Market or a Granary, and pay it back from what it brings in. Borrowing should sometimes be
  the better move, not only the way out of a hole.
- Choose between a lean treasury that expands fast and a reserve that rides out a war.
- Get rich exporting a resource your neighbours lack, and decide whether a tariff war with them is worth it.
- See a Slump coming in the World tab and respond: pay down debt, switch tax level, lend to a neighbour in trouble.

### Native first

The game's AI can't see a rule that lives only in the mod's scripts. It does see its own yields, policy cards,
government, buildings, techs and civics, grievances and relationships, and it plays those the way it plays the base
game. So each part uses the most native lever that can carry it, and the AI takes part in the mod as a player rather
than through rules the mod runs on its behalf.

1. Game data the AI chooses and values itself: policy cards, government modifiers, unlocks on techs and civics,
   buildings' own yields, AI weighting lists. These also show on the game's own yield breakdown.
2. Game state the mod moves by script: Gold, Influence and the celebration meter (`grantYield`), build progress
   (`addProgress`), grievances and relationships. The AI sees and reacts to the result, its balance or its
   grievances, but not the rule behind it.
3. The mod's own state: the ledger, standing, prices, the cycle index. Only the mod's rules act on it, so each needs
   an AI rule in section 6.

A part moves up a level as soon as a probe shows a lever that can carry it. Level 1 data follows the any-DLC and
other-mods rules: SQL that selects through parent tables, gated by a setup parameter (section 9).

| Part | Level | Lever |
| --- | --- | --- |
| Taxes | 1 | policy cards in the game's own policy slots (4.7) |
| Stages | 1 | the game's techs and civics; the mod's cards unlock on them (4.15) |
| Economic buildings | 1 | the game's buildings and their yields; roles read from data (4.13) |
| Economic systems | 1 for the tax lines, 3 for rates, credit and the cycle | the tax lines as government modifiers gated on the slotted tax card, which the game applies to every civ alike; the AI picks its government by its bias lists and doesn't weigh them (M2), and its card pass prices a card at its own face value (P17), so they change what a card pays, not which card or government an AI picks (4.17) |
| Repudiation | 2 | grievances booked on the repudiator, which the AI acts on (4.5) |
| Loans, guard, garnish, payments | 2 | `grantYield`; borrowing choices are section 6 rules until P18 finds a diplomatic action that can carry a loan |
| Aid, investment | 1 for the AI's aid, 2 for the rest | the AI's aid rides on Military Aid, which the AI starts, with its initiator now paying the target's 2 Gold a turn; the player's aid, development loans and investment are `grantYield` and `addProgress` (the 1.1 probes: the rewritten sanctions weren't scored by the AI at all) |
| Trade bills | 2 | `grantYield`, because netting per pair and the 10% cap need a script; the native per-import charge works but is player-wide. The engine's own exporter payment (`TradeYields`) read 0 in the 1.1 probes, so nothing here leans on it |
| Inflation, cycle, prices | 3, felt through 2 | the mod's own state, paid out through `grantYield` |

## 2. Precedents

| Source | Took | Where |
| --- | --- | --- |
| Civ II, III; Civ VII base | Negative treasury disbands units (Civ VII: `GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE` -10); the mod offers a loan first | 4.6 |
| Civ IV, Alpha Centauri | Tax slider; here the trade-off is celebrations, since science and culture can't be taken by script | 4.7 |
| Civ V | Luxury trading for Gold | 4.10 |
| Europa Universalis | Loans, standing, bankruptcy, loan-driven inflation | 4.1 to 4.8 |
| Victoria | Markets, tariffs, foreign investment, business cycle, scaled to 4X turn counts | 4.9 to 4.12 |

## 3. What the engine allows

| Need | Verb and behaviour | Evidence |
| --- | --- | --- |
| Gold, any player | `Players.grantYield(pid, YieldTypes.YIELD_GOLD, n)`, both signs, lands about 3 s later, works on AI | watched 2026-09-18, 09-25 |
| Influence | `grantYield(pid, YIELD_DIPLOMACY, n)`, both signs, can go negative | watched 2026-09-18 |
| Celebration meter | `grantYield(pid, YIELD_HAPPINESS, n)`, both signs; moves only `Stats.getLifetimeYield`, settlement happiness unchanged | watched 2026-09-11 |
| City production, any owner | `city.BuildQueue.addProgress(n)`, both signs, about 3 s, scaled by city production bonuses, needs a queued item | watched 2026-09-18 |
| Science, Culture | `grantYield` + only | watched 2026-09-18 |
| Food | no script write | watched 2026-09-18 |
| Balance | `Players.get(pid).Treasury.goldBalance`; stale within a turn after a deduction, so carry the turn's own arithmetic | watched 2026-09-13, 10-23 |
| Income, upkeep | `Stats.getNetYield(YIELD_GOLD)` (Demographics ships it); two `Treasury` maintenance getters | top-bar match and getter shapes: P2 |
| Relationship | read `Diplomacy.getRelationshipLevel`; `changeRelationshipLevel(b, n)` moves both sides; a script-made early meeting doesn't move | watched 2026-10-14, 10-16 |
| Trade routes, imports | `player.Trade.getCurrentTradeRoutes()`, `Game.Trade.getCityRoutes(id)`, `player.Resources.getResources()`, `Game.Resources.getOriginCity` | own context watched 2026-10-11; AI from UI context: P7 |
| Route lifetime | ends only by war or the exporter losing the resource; destroying the trade ship leaves it | watched 2026-10-11 |
| Yield breakdown line | none for script grants | engine-closed |
| AI actions | an operation sent for another player is accepted and ignored; so each AI action here is a mod rule executed with `grantYield` | watched 2026-10-23 |
| Runtime modifiers | none; modifier rows ship as data, gated only by a setup parameter | engine-closed |
| `Treasury.changeGoldBalance` | no-op, never use | watched 2026-09-25 |
| Negative-balance lines | amenity loss at 0, disband at -10 (`GlobalParameters`) | `../tests/fixtures/global-parameters-1.5.0.json` |
| Notifications | compose at `TurnBegin`, send at the local player's `PlayerTurnActivated`, one per turn | watched 2026-10-12 |
| Persistence | `Configuration.editGame().setValue` envelope | watched (CD, Emigration) |
| Multiplayer | single-player writes only | engine-closed |
| Grievances | `Players.get(a).Diplomacy.changeNumGrievances(b, n * 1000)` books "a wronged b" and moves both sides' relationship; the AI then treats a's cities as enemy targets and turns its diplomatic actions hostile; no war declared in 15 turns in the one pair of runs; shows to the player as a bare number | watched 2026-10-14, 10-15 |
| Policy cards | a mod's cards in the game's own policy slots are chosen like any card; a slot type of the mod's own is filled by the engine and can't be changed; a card must never grant the slot it sits in (crashed the AI turn) | watched 2026-10-17 (Emigration) |
| AI weighting lists | `AiLists`, `AiFavoredItems` are read at game creation only | watched 2026-09-21 |

## 4. The model

Gold flows. Civ-to-civ flows sum to zero; world flows are the only sources and sinks.

| Part | Section | Civ to civ | World source or sink | Changes others' numbers |
| --- | --- | --- | --- | --- |
| Loans | 4.1 to 4.6 | civ loans | bond market | |
| Taxes | 4.7 | | tax raised or remitted | |
| Inflation | 4.8 | | erosion | |
| Markets | 4.9 | | | prices |
| Trade bills | 4.10 | importer to exporter | | |
| Business cycle | 4.11 | | cycle Gold | rates, prices |
| Investment | 4.12 | dividends | | |
| Economic buildings | 4.13 | | | rates, caps, bills, demand |
| Stages | 4.15 | | | which parts a civ has |
| Old buildings | 4.16 | | | weights on 4.13; cushion on `L` |
| Systems | 4.17 | | | per-civ multipliers; the plan moves Gold into Production |

### 4.1 A loan

`{ kind, lender, borrower, principal P, rate r per turn, term T turns, outstanding O, missed m, state, emergency,
restructured }`.
`kind` is one of `loan`, `project`, `general` (4.12). `state` is one of `active`, `default`, `closed`, `repudiated`
(4.5). `m` counts
misses in a row (4.4); a loan with `m >= 1` shows as overdue. `emergency` marks a guard or AI shortfall loan (4.6).
`restructured` is set once the loan has been restructured (4.4).

### 4.2 Credit

```
income       = net Gold per turn as reported, re-read each turn
service      = next turn's scheduled interest plus amortisation over the civ's open loans
credit_cap   = max(0, (12 + depth_turns - 4 * repudiations) * income) - total outstanding
               depth_turns: 4.13, 0 to 12; repudiations: in the last 40 turns (4.5)
service_cap  = 0.5 * max(0, income)
standing     = 1.0 - 0.2 per active default anywhere - 0.1 per miss in the last 20 turns
               - 0.3 per repudiation in the last 40 turns, half for debt to an enemy at war (floor 0.1)
```

- A standard loan needs `P <= credit_cap` and, with the new loan's first payment added, `service <= service_cap`.
  The second test stops a civ whose income is already spoken for from borrowing more on paper headroom. Banking
  buildings raise both limits (4.13).
- Emergency loans (4.6) skip both tests and have their own cap instead. Both tests read 0 for a civ with no positive
  income, which is the civ that needs an emergency loan (NOTES finding A).
- The two limits meet: a loan's first payment is its rate plus `1 / T` of `P`, so at half of income a 20-turn loan
  at Antiquity's civ rate reaches about 7.7 turns of income and a 30-turn one at Exploration's about 11.5, where
  `credit_cap`'s 12 turns takes over as the stock limit. A 10-turn loan stays held by the service limit, at about 4
  turns of income from the bond market. Before 2026-10-30 the service limit was 35% and every term needed Public debt,
  so it held loans far below `credit_cap` (NOTES finding U).
- A refused borrow names the most that lender would lend over that term (the largest whole Gold that passes both
  tests, and from a civ lender at most half what it holds), and the Loans tab offers it with one click (section 5).
  The AI's borrowing runs through the same tests and the same sizing (section 6).

### 4.3 Lenders and rates

A civ `L` offers a loan if its balance, less the principal it has already committed this turn, is at least `2 * P`,
it isn't at war with the borrower, the borrower has no default against it, and the borrower hasn't repudiated a debt
to it this age or last (4.5). Civ lenders stop offering during a Panic (4.11).

```
r_L             = base_rate / standing * relation_factor * depth_factor
base_rate       = 0.015 before Exploration, 0.01 Exploration, 0.0075 Modern (per turn)
relation_factor = 0.8 friendly, 1.0 neutral, 1.3 unfriendly (Diplomacy.getRelationshipLevel)
depth_factor    = 4.13, about 0.5 to 1.0
r_bond          = 2 * base_rate / standing * depth_factor * cycle_spread * (1 + 50 * pi)
                  cycle_spread: 4.11; pi: 4.8; no balance test
r_cap           = 4 * base_rate; rates stop there, including after miss steps
```

- Opening (4.15): civ loans with 10- and 20-turn terms from Moneylending; the bond market and 30-turn terms from
  Public debt. A civ lender needs a Banking building (4.13) for 30-turn terms.
- The bond market stands for lenders outside the game.
- At 0.015 a turn, a 10-turn loan repaid in equal slices costs about 8.25% of `P` in interest; at `r_cap` it's about
  33%. The base rates are the owner's decision of 2026-10-30: half the first ones, the level at which a Market, a
  Bazaar and a Bank each pay their own interest within a 10-turn term from their Gold yield (section 10, "Borrowing
  pays", strict reading).

### 4.4 Term and payments

Each turn an active loan charges one payment, all or nothing (NOTES choice 3):

```
interest      = O * r
amortisation  = the next slice of P / T (NOTES choice 5)
payment       = interest + amortisation, from the borrower to the lender in the same batch (4.14)
```

- Paid: `O -= amortisation`, `m = 0`.
- Missed, when the borrower's funds for the turn (4.14) can't cover the payment: the borrower keeps the Gold and the
  lender waits. The interest is added to `O`, the slice moves to the next turn so the loan runs one turn longer,
  `m += 1`, `r = min(r * 1.25, r_cap)`, `-5 Influence`, and the miss counts toward standing for 20 turns.
- `m` counts misses in a row. Separate misses with paid turns between them cost rate, interest and standing, but they
  don't add up to a default.
- At `m >= 3` the loan enters default (4.5).
- Restructuring: an overdue loan (`m` 1 or 2) can be restructured once. What's left of `O` is spread over 10 more
  turns from now, the rate stays where the misses put it, `m` goes to 0, and standing takes one more miss. It's a
  new schedule, with no Gold changing hands. The bond market and AI lenders accept by rule; a player lender is
  asked. It's for a civ that's short for a while, not one losing Gold every turn: a civ with income at or below 0
  can't restructure.

### 4.5 Default and repudiation

Two ways out of a debt. Default happens to a civ that can't pay: the lender collects what it can, and the civ's
reputation takes a moderate hit. Repudiation is a choice: the civ declares the debt void, keeps its Gold and stops
paying for good, and takes the cost in reputation instead: lenders shun it, and the civ it stiffed holds a grudge
that can end in war. Historically, states have done this many times; here it's an open option with a known price.

Default:

- Garnish each turn until `O = 0`, taken only from what the borrower has:

  ```
  cash     = max(0, the borrower's funds after this turn's other charges)       4.14
  garnish  = min(ceil(O * 0.1), floor(0.5 * income), cash)       income > 0
  garnish  = min(ceil(O * 0.05), floor(0.1 * balance), cash)     income at or below 0 (NOTES finding C)
  ```

  What isn't collected stays in `O`. A defaulted loan accrues no interest (NOTES choice 7). Without the second line a
  negative-income AI never clears a default (offline: 633 of 633 shortfall loans stayed in default).
- Blocks new loans from that lender for the rest of the age.
- Cycle event (4.11) and a chronicle entry.
- Land and units are never touched: capture and transfer stay with the engine.

Repudiation:

- A borrower can repudiate at any time what it owes one lender, or what it owes the bond market. It covers all its
  loans with that lender at once, active, overdue or in default, and investment records it hosts for that investor
  (4.12). For a defaulted loan it ends the garnish.
- Gold: the borrower keeps what it borrowed and stops paying, now and later. The outstanding is written off, and the
  lender takes the loss. The record closes as `repudiated`.
- Reputation:

  ```
  loss_turns     = written-off Gold / max(10, the lender's income)
  lender grudge  = clamp(5 * loss_turns, 10, 40) grievances, booked on the repudiator:
                   Players.get(repudiator).Diplomacy.changeNumGrievances(lender, grudge * 1000)
  witnesses      = -3 relationship with each other major civ the repudiator has met
  standing       = -0.3 for 40 turns (4.2)
  ```

  The grudge is sized by how much the loss hurt the lender, in turns of its own income, so it holds its meaning as
  incomes grow across the ages: losing 2 turns of income or less gives the minimum of 10, losing 8 or more gives 40.
  The other two terms aren't in Gold and don't need scaling.

  A civ repudiating what it owes an enemy it's at war with pays half the witnesses' and the standing cost: the world
  expects debts to an enemy to go unpaid. Repudiating the bond market has no lender to hold a grudge, so the
  witnesses' cost is doubled.
- Harder to borrow afterwards:
  - That lender won't lend to or invest in the repudiator for the rest of this age and the whole of the next. After
    a bond-market repudiation the bond market is closed to it for 30 turns, which also turns off its guard (4.6).
  - Every other lender charges more through standing (`r / standing`, 4.3), and `credit_cap` loses 4 turns of income
    per repudiation in the last 40 turns (4.2).
  - While a repudiation counts, terms are 10 turns at most, and AI civs don't invest in it (section 6).
- Conflict comes indirectly, through the game's own grievances. The mod can't make an AI declare war (an operation
  sent for another player is ignored, section 3), but grievances are what the AI already acts on: in a watched pair of
  runs, 75 script grievances turned an AI's diplomatic actions hostile and made the other civ's cities its enemy
  targets within a turn (section 3). They didn't start a war in 15 turns there, so how often a grudge ends in war is
  read in longer games (P16). A script grievance shows in the relationship panel as a bare number, so a human lender
  gets a notification naming the repudiation and the amount, and the chronicle records it on both sides.
- Cycle: a repudiation is a cycle event (4.11). The lender takes part, since it lost the capital; the repudiator's own
  numbers aren't touched.
- Before a player confirms, the Loans tab shows the Gold kept, the relationship each civ would lose, the new standing,
  and which lenders would close and for how long.

### 4.6 Auto-loan guard and emergency loans

When the projected end-of-turn balance, after the resolve step of 4.14, is below the guard line, the guard takes an
emergency loan for the shortfall plus one turn of upkeep, over 10 turns, and tells the player. AI civs get the same
rule (section 6). The guard works from the start of the game; who lends depends on the civ's stage (4.15):

| Stage | Emergency lender |
| --- | --- |
| before Moneylending | temple treasuries |
| Moneylending | the cheapest civ that passes 4.3, else temple treasuries |
| Public debt on | the cheapest of civ lenders and the bond market; temple treasuries close |

Temple treasuries stand for the temples and palace stores ancient states borrowed from in a crisis. They're an
outside lender like the bond market (world account `temple`), lend only emergency loans, at the bond-market rate
without the cycle and inflation terms (`2 * base_rate / standing * depth_factor`), and aren't counted in inflation's
`B` (4.8). Repudiating them works like repudiating the bond market (4.5). A system with "civ lenders only" (4.17)
still gets emergency loans from them.

```
guard line     = amenity line (0), so it covers both penalties (NOTES finding B)
emergency_cap  = max(100, 10 * |income|)        open emergency principal per civ
```

- An emergency loan is breathing room, not a way to fund a deficit forever. When the next one would pass
  `emergency_cap`, the guard stops, and the player is told once that the game's own penalties now apply (amenities at
  0, disbanding at -10), with the deficit and its biggest causes. Paying emergency loans down frees the allowance.
- A civ whose income has been at or below 0 for 5 turns running is insolvent. The guard's notice says so and names
  the costs behind it, so the player can tell a bad turn from a deficit that needs a fix.
- Setup default On. The player can switch it off or on again on the Loans tab at any time.
- Runs after the resolve step (4.14), so it sees every other charge.

### 4.7 Taxes

Taxes are policy cards in the game's own policy slots. The player and the AI pick them the way they pick any card,
the AI weighs them by their modifiers, and their Gold shows on the game's yield breakdown. No card is the base game's
tax level.

A slot type of the mod's own would keep taxes out of the policy menu, but the game fills such a slot once and never
lets anyone change it, player or AI (section 3), so taxes use the game's own slots, with two additions:

- A tax slot. Each age's root civic grants one extra policy slot (`EFFECT_PLAYER_GRANT_TRADITION_SLOTS` on a
  modifier the civic unlocks, never on a card), so taxing doesn't crowd out a card a civ already holds. The game can't
  reserve the slot for tax cards; a civ that would rather hold another card there can.
- One door for each side, into the same game step:

  | | Player | AI |
  | --- | --- | --- |
  | Where the choice is made | the Fiscal tab on the Economics screen, with the policy menu still working | the AI's own policy pass, the same one that picks its other cards |
  | How the card changes | the tab sends the game's own policy-change operation for the local player | the game changes it itself |
  | When | only when the game would allow a swap (`canSwapCultureSlot`), so the player gets no change the AI doesn't | when the game allows it |
  | What steers it | the tab's forecast: Gold and Happiness under each card, and the turns to the next celebration | the card's own modifiers, and the strategy rows below |

  A script can't change an AI's cards for it: an operation sent for another player is accepted and ignored
  (section 3). So the AI side has no mod rule, only native steering:
  - War Levy pays a small part in peace and the rest only at war with a major civ. The AI's card pass ignores the
    war requirement and slots it in peace too (P17, the 0.4.0 watch), so the peacetime part gives those turns a return.
  - Two AI strategy rows, in the shape Emigration ships (`emigration-ai-strategy.sql`), gated on the Taxes setup
    parameter: "short of Gold" switches on through the game's `YieldIncome` condition on `YIELD_GOLD` below a
    threshold and raises the AI's Gold priority; "flush" switches on above a higher one and raises Happiness instead.
    A raised Gold priority should make Heavy Taxation look better to the AI's card pass, and a raised Happiness
    priority Light Taxation. Each bias is 300 (the note under the card table). Strategy rows are read at game
    creation, so they only reach new games.
  - Whether the AI's card pass reads strategy priorities and modifier requirements at all is part of P17. If it
    doesn't, the cards still work for the AI; it just picks them on their face value.

| Card | Unlocked by | Effect in each settlement | Partisans hardship |
| --- | --- | --- | --- |
| Light Taxation | each age's root civic | Gold -1, Happiness +6 | 0 |
| Heavy Taxation | each age's root civic | Gold +4, Happiness -2 | +1 |
| War Levy | the node that unlocks the Coinage anchor (4.15), and each later age's root civic | Gold +2, Happiness -1; while at war with a major civ, Gold +8, Happiness -4 | +2 |

Flat amounts, 2026-10-29: the cards were Gold -15% and Happiness +20% (Light), the mirror (Heavy) and +30% / -40% (War
Levy). They follow the P17 arms now (section 10, and "Arms run" in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-29-p17-analysis.md`): the AI's card pass rates a card by its
yields at face value, ignores the requirement on a modifier, and prefers flat per-settlement amounts; with arm 3's flat
cards Heavy took every slot Light had held, and the strategy rows at +50 changed nothing while a Gold bias of 2000
reached the card pass. So each card adds a flat amount in each settlement in the shape of the base game's Priesthood
(`EFFECT_CITY_ADJUST_YIELD` with `Amount` on `COLLECTION_PLAYER_CITIES`), and both strategy biases are 300. Taxes stop
being a share of income: a wide civ gets more from Heavy than a rich one with fewer settlements. The numbers live in
`ui/econ-tax-cards.js` (`CARD_LEVELS`) and `scripts/sync-tax-cards.mjs` writes them into the modifiers and the card
text.

Light arms, 2026-10-30. The 0.4.0 watch had no AI take Light in 119 turns, four of five take Heavy at their second
slot, and all five hold War Levy, at peace for nothing on 139 civ-turns. The owner asked for a Light the AI takes in
some situations but not all. Five lab games (Antiquity 4242, 110 turns, every other mod off; results in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-light-arms.md`) ran all three cards head to head, Heavy at
+4 / -2 and War Levy in its new two-part shape in each:

| Arm | Light Taxation | AIs taking Light | Heavy | War Levy |
| --- | --- | --- | --- | --- |
| 6 | Gold -15%, Happiness +4 | none | 2 (t26, t29) | 5 |
| 7 | Gold -1, Happiness +4 | 1 (Dai Viet t96) | 2 | 5 |
| 8 | Gold -2, Happiness +4, Production +1 | 1 (Dai Viet t96) | 2 | 5 |
| 9 | Gold -2, Happiness +4, Flush at income 15 or low Happiness | none | 3 | 5 |
| 10 | Gold -1, Happiness +6 | 3 (Hawaii t69, Persia t92, Dai Viet t107) | 2 | 5 |

Arm 10 ships. Every Light pick came from a grown civ (four or five settlements, 45 to 66 Gold a turn) whose Happiness
had run low (3 to 14 a turn) or whose settlements had gone unhappy, mostly at war; small early civs still take Heavy at
their second slot. The planner weighs Happiness by need, so the bigger Happiness face reached civs +4 didn't. A
percentage Gold cost read large on a rich civ's card (-15% of 51 Gold) and lost; a Production line and an earlier Flush
strategy changed nothing. War Levy's peacetime part shows in the city breakdown as a "War Levy" line of +2 Gold and
-1 Happiness, and the AIs hold it in peace about as often as before. Watched in the arm games; the built mod hasn't
been run (`docs/verification-runs.md`, "Owed: Light and War Levy (arms)").

- One card of each per age, as Emigration's stance cards do, unlocked through `ProgressionTreeNodeUnlocks` rows that
  SQL writes by selecting the node through the progression tree tables, so a mod that changes a tree moves the card
  with it.
- The modifiers copy the shape of a base-game card that adds a flat yield to each settlement (Priesthood), as the
  note under the table says. Lower Happiness means a later celebration, and it can also make a settlement unhappy,
  which is the game's own cost of taxing hard. The balance checks (section 10) watch both.
- A card never grants a slot, its own or another (section 3).
- Partisans reads which card is active through `Culture.isTraditionActive`, after checking the type exists in this
  age's `Traditions` table (that call reads true for a type the age doesn't have).
- The turn batch (4.14) carries no tax line: the game pays the card's yields itself.
- The soak (section 10) logs each AI's tax card every turn beside its balance, income and war state, to show whether
  it taxes harder when short, levies at war and eases off when flush.
- If P17 shows the AI never slots the cards, or they can't be made to work, taxes fall back to the script version for
  everyone, player and AI alike: the same four levels as a Fiscal tab choice, Gold as a share of `max(0, income)` and
  the celebration meter moved by `grantYield` (P6), one change per 5 turns, with the section 6 AI rule. The two sides
  never run different tax systems.

### 4.8 Inflation

Off by default (section 8). Prices can't be raised, so inflation erodes Gold held above a reserve and makes new bond
loans dearer.

Only civs with the Public debt stage (4.15) take part. They share the bond market, which is what ties their money
together; a civ outside it keeps its Gold whole and pays no inflation premium.

```
M        = sum of member balances, each floored at 0
B        = total outstanding on bond-market loans
pi       = min(0.005, 0.02 * B / max(M, 1000)) per turn          0 with no bond debt
reserve  = 20 * max(income, 10)
erosion  = floor(pi * max(0, balance - reserve)) per member per turn
bond     = r_bond rises by 50 * pi, at most 25% (4.3)
```

- The bond market is the only Gold source from outside the game; erosion is the matching sink. Loan balances aren't
  eroded, so the 4.4 schedule stays whole.
- The player can respond by spending above the reserve, paying down bond debt (which lowers `B`), lending or
  investing abroad, or borrowing from civs, whose rates carry no inflation premium.
- The Treasury tab shows the reserve line, the turn's erosion and the cause in one sentence ("bond debt is 1.4 times
  the Gold the bond market's members hold, mostly Persia's").

Built 2026-10-30 (version 0.4.0, offline only). Members are the living civs past Public debt; `B` is what they owe the
bond market, `M` the Gold they hold. Erosion goes to the world account `inflation` at step 3 of each member's pass,
paid from its funds, and the premium enters the bond rate with the system's share and the cycle spread. A Corporatist
civ erodes at twice the rate and a Planned one not at all (4.17). The game caps the Gold a civ carries into a new
age: the lab's 2026-10-30 run found 6,000 into Exploration and 9,000 into Modern, set by the game's age-transition
script (`capGold`, the transition setting's "keep more", which Play Now always uses) and not by
`DefaultGoldOnTransition`'s 3,000. Nothing here predicts the cap: the first batch of an age takes the balance the
engine reports, and records what the change took (NOTES choice 110) as a ledger event and a notice, "the age change
kept 6,000 of your 11,432 Gold", measured from the start of the last turn. M10 found a negative purchase efficiency raises the
game's prices by exactly its share: a native price rise is possible wherever the engine's own state can gate it (a
government, age progress, the crisis), but none of those follows bond debt, so 4.8 stays script. In the 1.2 balance
run, with a human borrowing four turns of income from the bond market every 15 turns, `pi` stayed between 0.01 and
0.1 percent a turn (section 10).

### 4.9 Markets

Resource types and classes come from `GameInfo.Resources` at load, with other mods applied, so DLC and modded
resources get prices and removed ones drop out.

```
base_c     = by ResourceClassType: Bonus 2, City 3, Empire 4, Treasure 5, Factory 6; other 2
copies_r   = source copies: resources on land a living civ owns, counted once at the origin
             (Game.Resources.getOriginCity), so an imported copy isn't counted again at the importer
scarcity_r = clamp(sqrt(n_civs / max(1, copies_r)), 0.5, 3.0)
demand_r   = 1.0
             + 0.25 potential demand if any unit in this age's Units table has StrategicResource = r
             + 0.25 more while any two civs are at war, for those same resources
             + for Factory class: 0.02 per Industry building standing in the world, at most +1.0 (4.13)
target_r   = base_c * scarcity_r * demand_r * E                    E: 4.11
price_r    = round(a * price_r + (1 - a) * target_r)              a = 0.8; 0.5 with Capitalism (4.15)
```

- `demand_r` reads the `Units` table, so Strategic Resources That Matter and similar mods feed it. The `Units` term
  is potential demand (someone could build those units this age), and the war term is what turns it into demand.
- Prices only feed trade bills, the Markets tab and Demographics. Holding a resource pays nothing by itself
  (open question 5).
- One world price for now. A later version could add a local adjustment by what each civ can reach through its own
  routes, so an isolated civ sees its own scarcity; it's out of 1.1.

### 4.10 Trade bills

Each pair of civs settles the net value of what they import from each other, every turn their routes stand. The
base game already pays for routes in its own way, so the bill is kept small and capped: trade should stay worth
making, and a deficit should matter without turning a route into a loss.

```
bill_r    = 0.025 * sum of price_r over the copies one route imports
            * (1 + min(0.3, 0.1 * Trade buildings in the exporting city))
            * (1 - min(0.3, 0.1 * Trade buildings in the importing city))     Trade buildings: 4.13
tariff_A  = None 0, Low 0.10, High 0.25 (importer's); 0 with the Tariffs option Off
owed_AB   = sum of bill_r over A's routes importing from B, * (1 - tariff_A)
net_AB    = owed_AB - owed_BA                                  the side with the positive figure pays it
paid      = min(net, 0.10 * max(0, payer's income))            0 when the payer's income is at or below 0
```

- Importer = the route's owner (merchant's civ); `targetCityId` is the importing city. War ends the route natively.
- A civ paying several partners scales each payment down evenly to keep its total within the 10% cap. The part of a
  bill over the cap is waived, not carried, so a route can't pile up a debt the AI doesn't know about.
- The Trade tab shows the bill for each partner and the cap, and, where P7 lets the UI read a foreign city's
  resources, what a new route to that city would add before the merchant goes.
- Tariffs: each civ starts at None (full bill). The player changes it on the Fiscal tab, at most once per 5 turns.
  Option Off: setting hidden, AI stays at None. Opens with the Tariffs stage (4.15). The AI sets its own and answers
  the player's by the rule in section 6, under the same 5-turn limit.
- What a tariff does here: the importer holds back that share of what it owes and keeps it, so the exporter earns
  less from selling to it. It's a trade-war lever rather than a tax on the importer's own people, and the Fiscal tab
  says so in those words.
- A High tariff costs the importer 1 relationship with each exporter it bills, every 5 turns. The mod tells the player
  why, because a script change shows in the diplomacy breakdown as a bare number.

Built 2026-10-29 (version 0.3.0, offline only), with the 1.1 probe results of the same night folded in
(`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-commerce-results.md`, Exploration seed 9001). The bill is
made from the importer's resources whose origin city a major owns (`Resources.getResources` with
`Game.Resources.getOriginCity`), grouped by that city; C8 settled P7 (an AI's per-route imports read from the UI context
and add up to its imports) and C14 that copies count once at the origin, so the read is sound for AI pairs too. C9:
`city.Yields.getTradeYields()` read 0 Gold in every route city over 120 turns, so the engine's exporter payment the
game's text describes is unconfirmed, and the bill is the importer-to-exporter transfer DESIGN 12 item 6 defaults to;
the Trade tab shows the game's Trade Income only when that read gives something. C9 also found the native per-import
charge works (exactly 1 Gold an import) and that a 1 Gold levy didn't reduce AI routes, so the AI doesn't seem to weigh
it; it stays out. Embargo (C11) is untested, so tariffs stay a script rule. C2: `projectPossibleTradeRoutes` answers for
the player and for AI ids, which the Trade tab's "Routes you could make" uses. A payment the payer's funds can't cover
is waived like the over-cap part. The AI matches a High tariff two turns after it's set and is bound by the same 5-turn
limit as the player. In the first 1.1 balance run the cap paid out on nearly every settlement row at Exploration
incomes (NOTES finding K), so the bill behaved like "a tenth of income to the partners you buy more from", and a tariff
shaved a bill that was capped anyway. Changed 2026-10-30 (offline only): the bill is 2.5% of the copies' prices a turn,
a twentieth of the first figure, so it follows what's traded and the cap is a safety net: it binds on 17% of rows in
the same run, and a payer's median payment is 1.4% of its income. The AI now sets tariffs too (section 6).

### 4.11 Business cycle

No randomness: game events and the world's own income, trade and lending move it, and it drifts back to Steady
between them. Peace lets the economy grow but doesn't push it up by itself; a boom comes from income growing faster
than usual, new trade and easy credit, and too much credit is what sets up a Panic. Nothing that holds still pushes
the index: a route that stands, or income that grows at its usual pace, weighs nothing. A long boom wears itself out
(overheating below), so a growing world still turns over. A peaceful game can still slump, from defaults,
shrinking trade, falling income, disasters or a crisis. The World tab lists the events behind the current phase. The
ledger keeps the event list, so a reload replays the same cycle.

```
E_next  = E + 0.1 * (1 - E) + k * s * clamp(sum of this turn's event weights, -0.1, +0.1)
          clamped to [0.7, 1.3]; E starts at 1.0
L_next  = 0.8 * L + k * (weights of events the civ took part in), clamped to [-0.2, 0.2]
          a negative L is cut by the Warehouse share (4.13) plus the legacy cushion (4.16), together at most 35%
growth  = world income now against 10 turns ago, in percent
trend   = an average of growth that moves 4% of the way to each turn's reading (about 50 turns); the first reading sets it
boom_n  = turns in a row the world has spent in Boom; any other phase sets it back to 0
k       = Business cycle option: Off 0, Mild 0.5, Standard 1.0, Strong 1.5
s       = world stage scale (4.15): 0.25, 0.6, 1.0; world index only
lev     = (all outstanding loans) / max(world income, 10)      in turns; world income: the civs' positive income
```

"Took part" means both sides of a war, the civ that lost the settlement, or the civ whose land was hit. `L` decays at
0.8 a turn by default; 4.17 changes that for some systems.

Phases, read from `E` for the world and from `E + L` for one civ. The ranges don't overlap, and a Panic overrides
them while it lasts:

| Phase | Range | Notes |
| --- | --- | --- |
| Depression | below 0.8 | |
| Slump | 0.8 to below 0.95 | |
| Steady | 0.95 to 1.05 | |
| Boom | above 1.05 | |
| Panic | a state, 5 turns | from the Banking stage (4.15). Starts when `lev > 1.7` turns and `E > 1.05`, with no Panic in the last 60 turns: `E -= 0.2` once, its own notification and chronicle entry. While it lasts the phase reads Panic, civ lenders stop offering (4.3), `cycle_spread` rises by 0.5, and Market and Merchant oligarchy civs take -0.05 on `L` once (4.17). After 5 turns the phase goes back to the range `E` is in, usually a Slump |

| Event | Weight | Source (probe) |
| --- | --- | --- |
| War declared between civs | -0.02 once | `Game.Diplomacy.getPlayerEvents` (P10) |
| Each ongoing war between civs | -0.004/turn, total at most -0.02 | same |
| Settlement captured | -0.01 | `CityTransfered` with a capture `transferType` (watched 2026-09-25) |
| Settlement razed | -0.02 | `CityRazingStarted` (P11) |
| Flood, eruption or storm on a settlement's land | -0.005; -0.01 if population lost; half in a city with a `FOOD_WAREHOUSE` building | `RandomEventOccurred` `location` (P11); population loss from the city's population before and after |
| Age crisis stage starts | -0.02 once, then -0.005/turn while it lasts | `Game.CrisisManager.getCurrentCrisisStage(0)` (P12) |
| Settlement outbreak | -0.01 | Epidemics via a Commons topic |
| Loan enters default | -0.03 | ledger |
| Debt repudiated | -0.03; the lender takes part, the repudiator doesn't | ledger |
| Peace between civs | +0.01 once | war state vs last turn |
| New trade route between civs | +0.005 | routes vs last turn (P7) |
| Route between civs ends | -0.005 | same |
| World income: `growth` against `trend` | ±0.005 per 5 points above or below the trend, at most ±0.01/turn | ledger history of `income` |
| Overheating: the world in Boom | -0.002 per turn of `boom_n`, at most -0.03/turn | `E` |
| Credit growth: all outstanding loans up more than 10% on 10 turns ago | +0.015/turn | ledger; this is the boom a Panic follows |

Effects:

```
prices        target_r uses E (4.9)
cycle_spread  = 2 - (E + L), + 0.5 during a Panic                    bond rate, per civ (4.3)
cycle Gold    = round((E + L - 1) * 0.2 * max(0, income)) per civ per turn, + in a boom, - in a slump
```

The turn notification names the events behind a phase change ("Slump: the war between Rome and Persia, a flood at
Thebes").

Built 2026-10-30 (version 0.4.0, offline only), with the M9 and M6 readings folded in. `E` and `L` are held in basis
points (10000 is 1.0) in the macro envelope. Wars and peace are read from the relations between majors against last
turn's (M9: declared wars between majors match the polled war state a turn later, and the declared-war event also
names Independents); routes from the plan's own routes; captures by combat (`CityTransfered`), razes
(`CityRazingStarted`) and disasters on a major's land (`RandomEventOccurred`, population lost when the settlement has
fewer people at the next batch than at the one before; M6 and the 1.1 logs found it does in a share of events) are kept
by the glue until the batch; the crisis stage is polled. Defaults and repudiations weigh the turn after they happen,
from the ledger's last batch, so the cycle doesn't depend on the order of the steps that make them. A raze weighs on
the civ holding the settlement it razes, since the one that lost it took the capture's weight. The cap on ongoing
wars applies world-wide and to each civ's own sum. The world stage for Panic is the furthest any living civ has
reached. A Planned civ has no `L`, no cycle Gold and a spread of 1.0. Cycle Off rests the state at 1.0.

Changed 2026-10-30 (offline only): the first 1.2 balance run found the world in Steady or Boom in every game, a
peaceful one included, because each standing route added +0.001 a turn and income growth against 10 turns ago is
positive in nearly every growing game, which held `E` near 1.1. Standing routes now weigh nothing, income counts only
against its own trend, and overheating pulls a long boom down. The trend and `boom_n` are kept in the macro envelope.
Overheating is the world's only: a civ's `L` already decays by a fifth a turn, so a civ's own boom fades without it,
and the World tab lists it every fifth turn of a boom rather than every turn.

Changed 2026-10-30 (offline only), finding Q: no Panic fired in the first 1.2 run, because the AI borrowed only when
short, which it never is at `TurnBegin` (NOTES finding I), and leverage was measured against the Gold held, which AIs
hoard. The AI now takes build loans while its credit is cheap (section 6), leverage is outstanding debt in turns of
the world's income, and the Panic line is 1.7 turns with 60 turns between Panics. Credit growth weighs +0.015 a turn,
three times the first figure, so a borrowing wave lifts the world into Boom: at +0.005 the same games never boomed.
The World tab shows leverage in turns against the line. Section 10 has the shape.

### 4.12 Foreign investment

| | Development loan | General | Aid (either kind) |
| --- | --- | --- | --- |
| Backs | the current build of one city, a building or wonder | the host's economy | as chosen |
| Gold goes to | `G / 3` progress on that build | the host's treasury, `G` (`grantYield` pair) | as chosen |
| Return, 25 turns | fixed: `ceil(G * 0.05)` (125%); 6% (150%) on a Commerce, Banking, Trade or Industry building (4.13) | moves with the host: `ceil(G * 0.045 * growth)`, `growth = clamp(income now / income at investment, 0.5, 2.0)` (about 112% if flat) | none |
| Relationship, once, both sides | +1 per 5 turns of the host's income | +1 per 7.5 turns | +1 per 2.5 turns |
| Record | `kind: "project"` | `kind: "general"` | logged transfer, no record, no misses |
| Needs | not at war, Neutral or better, Guild patronage stage | same, Chartered companies stage | not at war |
| Host loses the city | schedule closed, rest written off | unaffected | n/a |

Relationship gains are counted in turns of the host's income (`max(10, income)`), so a gift means as much to a Modern
host as to an Antiquity one.

A development loan is a loan tied to a build, with a fixed return, and the screens call it that. General investment is
the one whose return depends on how the host does. The record kind stays `project` so the code and tests keep their
names.

Development loans target only the build a city has at its head right now. A script can't set an AI's queue or list
what an AI city can build (`canStart(BUILD)` reads no for every item in AI cities), so naming a build the city hasn't
started would leave the Gold waiting on a choice the AI can't see.

- The progress lands in the same batch as the investor's deduction (4.14), capped at what the build needs; the rest
  is returned in that batch, so the ledger and the grants agree.
- The build is re-read in the same tick as the grant, since `addProgress` lands on whatever is current 3 s later
  (P8). If P8 shows the progress landing on a different item, the return still runs, since the host got the value.
- `G / 3` is a starting ratio. The balance checks (section 10) compare it with the game's own Gold purchase price for
  the same build, by age and game speed. `addProgress` lands times the city's own production multiplier for the item
  (NOTES finding L, 2026-10-30): as sent in the human's cities, under the difficulty handicap in an AI's, as the
  city's own production does, so `G / 3` stays.
- When the building stands, the city's Economics entry and the chronicle name the investor.
- Holding Gold for a build the city hasn't started yet (an escrow) is left out of 1.1 and can come back if P8 and
  play show it's wanted.

Other rules:

- Development loan and general records use the loan rules for misses, default and lender block.
- A host in default turns general investment down, the player's and an AI's alike, and nothing is sent in its place:
  the investor chooses again. For the player, the Trade tab shows the refusal before it's asked, with a "Set up a
  development loan instead" button that opens that host's builds with the same Gold, and a request refused in the
  batch says in the turn notification that a development loan is still open. The AI's check skips that host this
  time, and its next check picks by its own rule (section 6). Decided 2026-10-30 at the owner's word: no automatic
  fallback.
- A host can repudiate them like a loan (4.5): the investor's remaining return is written off, which is how a
  seizure of foreign holdings plays here, with the same reputation cost.
- Keep the city component id and re-resolve each turn, never the city object (engine-closed: a stale city object
  crashed the game, 2026-10-23).

Built 2026-10-29 (version 0.3.0, offline only), with the 1.1 probe results folded in. C3 settled P8: `addProgress` on an
AI city's current build lands within 3 s and the AI keeps the build for the next 3 turns, as a control city does, so a
development loan backs the build at the head of the queue as written. A development loan's Gold goes to a world account,
`progress`, and only the Gold its progress uses leaves the investor (3 Gold a point), so "the rest is returned" is the
rest never sent. The records sit in `ledger.investments` (ledger version 3) beside the loans, with the loan rules for
misses, default, the lender block and garnish; the dividend doesn't step up on a miss. General investment's growth
counts its base from 10 Gold a turn. One gift's relationship gain is capped at 10 points (ours, NOTES choice 63). The
AI's investment and aid are 5 turns of its own income; an AI's investment in the player is an offer kept 3 turns. C13:
of the four diplomacy levers the AI only starts Military Aid (7 times in 120 turns), so with Foreign investment on its
initiator now pays the 2 Gold a turn its target gets (scaled by age) and the AI's own aid moves Gold instead of making
it; whether that charge lands is owed, since the records couldn't separate 2 Gold from the turn's other moves. The
rewritten Hinder Finances and Hinder Food Production weren't scored at all, and Send Gold wasn't either. For the player,
Development Aid moved 12 a turn each way and Send Gold moved its `Amount2` at once (C12), and a deal sent as `ACCEPTED`
moved Gold both ways with no answer needed (C6); `CostInGold` isn't charged, and no deal item carries a turn count (C7).
Those are native player doors for aid the owner can choose later; 1.1 keeps the Trade tab's own aid so the player and
the AI's rule run through the same checks. In the balance run a fully backed build costs its host 1.125 times the game's
purchase price on a role building and 0.94 times on another, before production bonuses scale the progress up
(`reports/balance-1.1.json`); C3's purchase read gives the price for what's left of a build, not the whole build.

### 4.13 Economic buildings and financial depth

Roles are read at load from the compiled DB with other mods applied (`TypeTags`, `Constructible_Advisories`,
`Constructible_YieldChanges`), so uniques, DLC and modded buildings take part. The "1.5.0" column is for reference
only; the mod holds no type list. A building can have several roles. Each count is weighted by `w` (4.16): 1.0 for a
current-age or `AGELESS` building. Only standing buildings count; a damaged one
(`Constructibles.getByComponentID(id).damaged`) counts 0 (P9).

| Role | Data rule | 1.5.0 | Effect |
| --- | --- | --- | --- |
| Commerce | tag `GOLD` | Market, Lighthouse, Bazaar, Guildhall, Bank, Port, Rail Station, Stock Exchange; uniques (Dockyard, Casa de Contratación, Anjuvannam, Ginko, Money Shop, Royal Exchange) | depth += base Gold yield / 4 (Market 0.75, Bank 2, Stock Exchange 3) |
| Banking | tag `GOLD`, base Gold yield >= the Bank's, none of `WATER`, `BRIDGE`, `RAIL_CONNECTION` (our rule, so unique banks count) | Bank, Stock Exchange, Ginko, Money Shop, Royal Exchange | `depth_turns` += 2; a civ lender needs one for 30-turn terms |
| Trade | tag `TRADE` or `ADVISORY_CLASS_TRADE` | Market, Lighthouse, Bazaar, Guildhall, Wharf, Bank, Department Store, Modern Bridge; uniques (Casa de Contratación, Manufactory, Royal Exchange) | bill ±10% per building in the exporting or importing city (4.10) |
| Warehouse | tag `WAREHOUSE` | Granary, Fishing Quay, Saw Pit, Brickyard, Stonecutter, Harbor, Gristmill, Sawmill, Grocer, Ironworks | negative `L` -3% each, at most 30% (4.11); `FOOD_WAREHOUSE` halves disasters in its city |
| Industry | tag `PRODUCTION` and `ADVISORY_CLASS_ECONOMIC` | Factory, Rail Station; uniques (Manufactory, Steel Mill, Railyard) | Factory-class `demand_r` +0.02 each, world-wide, at most +1.0 (4.9) |
| Economic wonder | wonder with `ADVISORY_CLASS_ECONOMIC` | Colossus, Great Lighthouse, Pyramids, Machu Picchu, Havana Harbor, Tomb of Askia, others | owner's rates -5% each, at most 15% |

```
depth         = sum over Commerce buildings of w * base Gold yield / 4
depth_factor  = (1 - min(cap, 0.02 * depth)) * (1 - min(0.15, 0.05 * economic wonders))
cap           = 0.3; 0.4 from the Banking stage (4.15)
depth_turns   = min(12, 2 * sum of w over Banking buildings)
```

- Development loans on role buildings pay 6% (4.12), and AI investors pick them first.
- The Treasury tab lists the civ's buildings by role with each one's contribution; a city entry shows its own.
- A wide empire reaches the caps sooner (`depth_turns` at 6 Banking buildings, `depth_factor` at depth 15, 20 from
  the Banking stage). The credit limit itself is in turns of income, so it already scales with the empire. Whether
  tall and wide civs end up too far apart is a balance check (section 10) before any per-city scaling goes in.

From the 1.5.0 compiled databases (2026-10-29, `../tests/fixtures/commerce-*.json`): a previous age's buildings carry no
tags in the next age's database (the Market has no `GOLD` tag in Exploration; the Bazaar, Guildhall and Bank none in
Modern), so they drop out of Commerce and Banking at the transition while Trade still finds them by
`ADVISORY_CLASS_TRADE` (NOTES finding J). 4.16 should start from this.

### 4.14 Order of a turn

Runs once per game turn, at the step P3 settles, as one batch. The outcome doesn't depend on which civ
has the lower player id, and a turn is never applied twice.

1. Snapshot. Read each civ's balance, income, routes, government and newly completed anchor nodes once. Update
   stages, systems, `E`, prices and `pi` from the snapshot. Later steps use the snapshot rather than the engine's
   balance, which is stale after a deduction.
2. Propose. Each rule writes transactions `{ id, turn, kind, from, to, amount, priority }`. `from` and `to` are a
   civ or a world account: `bond`, `temple`, `citizens`, `tax`, `inflation`, `cycle`, `plan`. A civ-to-civ
   transaction is one record, so its debit and credit are the same number by construction.
3. Resolve, each payer on its own. A payer's funds are its snapshot balance plus its income plus what it gets from
   world accounts this turn (bond principal, positive tax and cycle Gold). Gold coming in from other civs this turn
   counts from the next turn, which is what keeps one civ's result from depending on another's. The payer's outgoing
   transactions are taken in this order, each paid in full or missed (garnish takes what's there, 4.5):
   1. write-offs (party eliminated, city lost): no Gold, records close
   2. repudiations, player and AI (4.5, section 6): the records close before any payment on them, then player
      requests: borrow, repay, lend, invest, tax level, tariff
   3. inflation erosion
   4. taxes, or the plan for a Planned civ (4.17)
   5. negative cycle Gold
   6. trade settlement (4.10)
   7. garnish on defaulted loans
   8. scheduled loan and dividend payments, oldest first
   Then, on each civ's projected end balance with all resolved flows in and out:
   9. guard
   10. AI shortfall borrowing. Competing borrowers go largest shortfall first, ties by player id, and each lender's
       committed principal counts against its `2 * P` test (4.3).
   A missed transaction leaves both sides as they were, so a lender is only credited for payments it gets.
4. Commit. Net each civ's flows into one Gold, one Influence and one celebration grant, sent with the plan's
   `addProgress` calls: one 3 s lag per civ. Before sending, write the ledger with the turn, a batch id, each civ's
   snapshot balance and its net Gold. Checks on commit: each civ-to-civ transaction has a matching debit and credit;
   the sum of civ grants equals the net of the world accounts, each kept as its own line; no payer goes past its
   funds except by a guard or shortfall loan.
5. Compose the notification at `TurnBegin`; send it at the local `PlayerTurnActivated`.

On load, if the ledger's last batch is for the current turn, the batch isn't planned again (NOTES choice 22). The
saved snapshot balance and net Gold tell whether its grants landed before the save: a balance at snapshot plus net
means they did, a balance still at snapshot means they didn't and the grants are re-sent. P15 checks whether a save
can fall in that 3 s window at all.

### 4.15 Economic stages

Each part opens per civ, AI included, when the civ completes the node that unlocks the anchor. Until then the part is
closed to it, and the Economics screen greys it out and names the tech or civic that opens it.

| Stage | Anchor (unlocked type) | 1.5.0 node | Opens |
| --- | --- | --- | --- |
| Tribute | game start | — | Taxes Light, Standard, Heavy; aid; local cycle effects; the guard, with temple treasuries (4.6); citizen loans for Civic market civs (4.17) |
| Trade | `UNIT_MERCHANT` | Code of Laws (Antiquity civic) | trade bills; Markets tab |
| Coinage | `BUILDING_MARKET` | Currency (Antiquity tech) | War Levy; financial depth |
| Moneylending | `TRADITION_COMMODITIES` | Commerce (Antiquity civic) | civ loans, 10- and 20-turn terms, `base_rate` 0.015; AI lending rules |
| Guild patronage | `BUILDING_GUILDHALL` | Guilds (Exploration tech) | development loans |
| Public debt | `TRADITION_MARITIME_LAW` | Economics (Exploration civic) | bond market, which replaces temple treasuries; inflation, 30-turn terms, player lending |
| Chartered companies | `TRADITION_CHARTERS` | Colonialism (Exploration civic) | general investment |
| Tariffs | `TRADITION_TARIFFS` | Imperialism (Exploration civic) | tariff levels (option permitting) |
| Banking | `BUILDING_BANK` | Urban Planning (Exploration tech) | Panics possible; depth cap 0.4 |
| Capitalism | `TRADITION_LAISSEZ_FAIRE` | Capitalism (Modern civic) | equity: general `growth` clamp 0.25 to 3.0; price smoothing 0.5; AI civs invest in each other. Market and Mixed systems only (4.17) |

- The anchor node is found at load through `ProgressionTreeNodeUnlocks` (via `GameInfo`, mods applied). A mod that
  moves the unlock moves the stage. Civ-unique trees count.
- A civ has a stage once `Techs.isNodeUnlocked(type)` or `Culture.isNodeUnlocked(type)` is true for the node type (P13).
  The turn is recorded, so the stage survives the age's trees going away.
- Each age opens all stages of the ages before it, so every civ starts Modern with all stages up to Banking.
- If no node in an age unlocks an anchor, that stage opens at the start of the next age. A Modern stage with no anchor
  opens at the start of Modern.
- World stage = the furthest stage any living civ has reached. It sets `s` for the cycle (4.11): 0.25 before Public
  debt, 0.6 from Public debt, 1.0 from Capitalism.
- New loans and investments need both parties to have the stage. Running ones continue.

Built 2026-10-30 (version 0.4.0, offline only) for Banking and Capitalism. Banking raises `depth_factor`'s cap to 0.4
for the civ and opens Panics once any living civ has it. Capitalism's effects go to Market and Mixed civs: general
investment's growth clamp widens to 0.25 to 3.0 on such a host, prices smooth at 0.5 once such a civ has the stage,
and an AI investor of either system past it also invests in Neutral hosts that are too. M4 found every old-age node
reads false after the change, so the recorded turn carries each stage, and the glue counts one rising turn across the
ages (`Game.turn` restarts at 1 in each age).

### 4.16 Old buildings across the ages

The game treats a previous-age building as antiquated and lets it be built over. In the mod it fades instead of
switching off, and what it loses becomes a slump cushion.

- Old = `GameInfo.Constructibles.Age` earlier than the current age and no `AGELESS` tag (mods applied). Warehouses,
  uniques and wonders don't age. A mod that removes `AGELESS` makes the building age (Warehouse Overbuilding does).
- `w` is kept per role and scales that role's 4.13 effect. A Market's Commerce and Trade weights fade on separate
  triggers.

```
current-age or AGELESS   w = 1.0
one age old              w = 1.0 until the fade starts, then -0.05/turn to 0.5
two ages old             w = min(w, 0.5) at the transition, then -0.05/turn to 0.25
```

The fade starts at the first of:

- The civ reaches the successor stage for that role (table below). Slow researchers keep full value longer.
- The same city gets a current-age building with that role. The old one drops to its floor at once.

| Role | Antiquity building in Exploration: successor stage | Exploration building in Modern: successor stage |
| --- | --- | --- |
| Commerce | Public debt | Capitalism |
| Trade | Guild patronage | Capitalism |
| Banking | (none in Antiquity) | Capitalism |
| Industry | (none before Modern) | (none before Modern) |
| Warehouse, economic wonder | never fades | never fades |

1.5.0 reference:

| Building | Roles | In Exploration | In Modern |
| --- | --- | --- | --- |
| Market, Lighthouse | Commerce, Trade | full until Guilds (Trade) / Economics (Commerce), or the city builds a Bazaar, Guildhall or Bank; floor 0.5 | at most 0.5, fading to 0.25 |
| Bazaar, Guildhall, Wharf | Commerce and/or Trade | current | full until Capitalism, or the city builds a Port, Department Store, Rail Station or Stock Exchange; floor 0.5 |
| Bank | Commerce, Banking, Trade | current | full until Capitalism, or the city builds a Stock Exchange; floor 0.5 (still 1 turn of credit) |
| Warehouses, uniques, economic wonders | various | full | full |

```
legacy   = sum over old economic buildings of (1 - w), w averaged over the building's roles
cushion  = min(0.10, 0.01 * legacy)        cut on a negative L; with the Warehouse cut at most 35% (4.11)
```

- The cushion stands for the trade ties and merchant houses an old market built up over an age: worth less as a
  modern business, still there to lean on in a downturn. It also gives building over an old building a cost to weigh
  against the new building's yield.
- Legacy lasts while the building stands. Building over it removes it, which is the game's existing trade-off.
- A development loan made last age keeps paying, since the schedule belongs to the record.
- The Treasury tab shows each old building's age, weight and trigger ("Market, Antiquity: 1.0, fades when you reach
  Guilds"; "Bank, Exploration: 0.65, fading, Stock Exchange built here"). The turn notification reports supersessions.
  The World tab shows legacy and the cushion.

Built 2026-10-30 (version 0.4.0, offline only), with M4 folded in: old buildings keep their base Gold and upkeep across
both changes (61 and 211 kept, none lost), so the engine doesn't fade them and this section's fade is the mod's own.
Nothing is stored per building: each weight is worked out every turn from the building's age, the current age, the
turn its role's successor stage opened, the age's first turn and whether its city has a current-age building of the
role. A previous age's buildings carry no tags in the next age's database (NOTES finding J), so the glue remembers the
roles each building type had in its own age. A unique is a building with a `Buildings.TraitType` (the base uniques also
carry `AGELESS`). The cushion adds to the Warehouse cut on a negative `L` (4.11), together at most 35%.

### 4.17 Economic systems

Each civ runs one system, which changes its numbers in the other parts. The player picks it through government or
ideology; the Fiscal tab names the system and its changes.

- In Modern with an ideology: the ideology decides. It's read from the completed branch-root node that unlocks
  `TRADITION_SUFFRAGE` (Democracy), `TRADITION_DIRIGISME` (Fascism) or `TRADITION_PROLETARIAT` (Communism), found as
  in 4.15.
- Otherwise the government decides: `Culture.getGovernmentType()` (P14 for AI). `Culture.getChosenIdeology()` may
  replace the branch-root read above once P14 reads it back.
- Effects on yields (Tribute's extra Gold from Heavy Taxation, for one) ship as `GovernmentModifiers`
  rows on the base governments, written by SQL that selects through `Governments`, so they apply natively. The AI
  doesn't weigh them when it picks a government (M2); its `GovernmentBiases` lists decide that, and the mod gives each
  civ one (below). Rates, credit and cycle multipliers are the mod's own numbers and stay in the script. Whether a
  modifier can require a card to be active is part of P17.
- Each civ leans toward one government in its own age: a `GovernmentBiases` item at 75 on the civ's trait, chosen so
  each age's civs spread evenly across its governments, with every DLC and with the base game alone.
  `docs/government-biases.md` holds the table and a reason for each civ, and `data/econ-government-biases.sql` writes
  it with the Economic systems option on.
- The government table is our own rule, since the data has nothing to classify by. Governments it doesn't list (DLC,
  modded, future) run Mixed; governments the game lacks are skipped.
- A civ whose government is unreadable runs Mixed.
- Linking a government or ideology to a system is a gameplay choice for flavour and contrast, not a claim about how
  those states ran their economies.

Each system has one thing it's about, which the player should feel in play; the numbers in the second table support
it. A system whose numbers don't add up to its line here is a design gap (open question 9).

| System | What it's about | What carries it |
| --- | --- | --- |
| Mixed | a bit of everything | sections 4.1 to 4.16 as written |
| Market | private capital and price signals: the best credit, the most exposed to a Panic | cheaper bonds, faster recovery, a Panic hit |
| Tribute | take wealth to pay for expansion | Heavy tax yields more and costs less celebration; aid buys more goodwill |
| Civic market | citizens fund the state, and the city is the market | citizen loans, whose interest comes back as celebration; Light tax celebrates more and Heavy costs more; market towns count more |
| Merchant oligarchy | finance runs the state | cheaper credit both ways, a bigger credit limit, bigger booms and slumps, a Panic hit |
| Manorial | local stability over money | sheltered from world swings, warehouses count double, less credit |
| Mercantile | the state gets rich exporting | export bonus on bills, cheaper tariff wars, cheaper bonds |
| Religious | interest is forbidden | lends as partnerships; aid buys more goodwill |
| Corporatist | capital goes to industry and war | War Levy in peace, war booms its own economy, cheap credit, industry demand |
| Planned | the treasury becomes production | the plan turns Gold into build progress; fixed prices; out of the world cycle |

Each row lists only the changes from Mixed. Mixed is sections 4.1 to 4.16 as written.

| System | From (1.5.0) | Taxes | Loans | Trade, markets | Investment | Cycle |
| --- | --- | --- | --- | --- | --- | --- |
| Mixed | unlisted governments; Revolutionary Republic, Revolución | | | | | |
| Market (liberal capitalism) | Democracy; pre-ideology Elective Republic, Constitutional Monarchy | | bond rate 0.9× | | | `L` decays at 0.7, not 0.8; -0.05 on `L` once in a Panic |
| Tribute (palace economy) | Despotism | Heavy +20% Gold, celebration cost -15% | civ lenders only, at 1.2× the rate | | aid gives 2× relationship | |
| Civic market | Classical Republic | Light celebration gain +30%; Heavy celebration cost +25% | citizen loans (below) | Trade buildings 12% each, not 10; Commerce buildings count 1.25× for depth (4.13) | | |
| Merchant oligarchy | Oligarchy | | lends and borrows at 0.8× the rate; `credit_cap` +4 turns | | | `L` 1.25×; -0.05 on `L` once in a Panic |
| Manorial | Feudal Monarchy | taxes in kind: Gold ½, celebration cost ½ | `credit_cap` -4 turns | bills it pays -20% | | `L` 0.75×; Warehouse cut 2× |
| Mercantile | Plutocracy | | bond rate 0.8× | exports +10% on bills; High tariff relationship cost ½ | dividends +1 point | `L` 1.25× |
| Religious (usury law) | Theocracy | | lends without interest, as a partnership: principal plus income-growth share, paid like a general investment | | aid gives 2× relationship | |
| Corporatist | Fascism; pre-ideology Authoritarianism, Bureaucratic Monarchy, Revolutionary Authoritarianism | War Levy in peace | `credit_cap` 1.5×, bond rate 0.75×; erosion on its balance 2× | Industry buildings count 2× for demand | receives development loans only | at war own `L` +0.01/turn; -0.03 once at peace |
| Planned | Communism | no tax levels; the plan instead | civ lenders only | buys and sells at `price_r = base_c` (no scarcity, no `E`) | receives development loans only | `E` reaches only its trade; no cycle Gold, Panic or erosion |

- Citizen loans (Civic market). Classical Republic is an Antiquity government, and its own bonuses are about happy
  cities, so its finance runs through the citizens and the celebration meter, with the parts Antiquity has. A
  Civic market civ can borrow from its own citizens from the start of the game, before any other lender exists.
  Rome built the fleet that won the First Punic War on loans like these from its wealthy citizens.

  ```
  citizen_cap   = 5 turns of max(10, income) per settlement with a Commerce building, within credit_cap (4.2)
  rate          = 0.75 * base_rate / standing * depth_factor
  terms         = 10 turns; the debt-service limit applies (4.2)
  celebration   = 6 * the interest paid this turn, granted to the meter the same turn (Light Taxation's 6
                  Happiness for each Gold it costs, so both buy celebration at the same price)
  ```

  - The lender is the world account `citizens`: the principal comes from outside the civs' treasuries, and the
    interest leaves them. The citizens spend the interest at home, so it comes back as celebration.
  - The trade-off: borrowing at home is cheap and builds toward the next celebration, but every loan is Gold the
    treasury owes later, and the limit only grows with market towns.
  - Misses follow 4.4, but cost celebration instead of Influence (5 turns of `max(0, happiness/turn)`) and add 1
    Partisans hardship.
  - Repudiating the citizens has no foreign lender to hold a grudge, and the witnesses don't care. The cost is at
    home: the meter loses 10 turns of happiness/turn, Partisans hardship +2 for 20 turns, citizen loans close for 30
    turns, and standing takes -0.15 for 40 turns, since lenders abroad notice.
  - At the age transition the government changes; running citizen loans keep their terms, and no new ones open.
  - Whether celebration bought through interest beats what the same Gold buys through Light tax is a balance check
    (section 10). It shouldn't be a cheaper way to celebrate than Light tax.
- The plan: each turn, take 20% of positive Gold income and spend it as `addProgress` across the civ's cities with a
  queued item, split by population, at the game's own purchase price: `GOLD_PURCHASE_MULTIPLIER` Gold a point, read
  from GlobalParameters at runtime with other mods' rows applied, 4 when the read fails. Game speed scales a build's
  cost and its purchase price alike, and the glue reads the points a build needs at the game's speed, so the price
  per point is the multiplier alone. What whole points leave over buys points in the biggest cities first. Empty
  queues are skipped. The Fiscal tab shows the take and where it went. P8 covers AI cities. `addProgress` lands as
  the amount sent times the city's own production multiplier for that kind of item (NOTES finding L): 1.0 in the
  human's cities, the difficulty handicap in an AI's (0.6 on units and 0.8 on buildings at Settler). A grant then
  behaves like the city's own production, handicap included, so the price stays the purchase rate: each city
  carries a `progressScalePct` from the glue that the points sent are divided by, kept at 100 (the lead's decision of
  2026-10-30). The plan's production is worth the Gold it takes at the game's own price, and the balance checks
  (section 10) measure it against a Mixed civ.
- Between systems: bills use the importer's prices. Loans use the lender's terms, so only a Religious lender makes
  partnerships.
- Changing system (a new government at an age transition, or taking an ideology): each number blends evenly over 10
  turns, with a one-off -0.03 on the civ's `L`. Running loans and investments keep their terms.
- The Capitalism stage's effects apply only to Market and Mixed civs. Other systems keep the civic and its game
  effects.

Built 2026-10-30 (version 0.4.0, offline only), with the M-probes folded in. M2: the AI's government pick didn't move
for +10 Gold, +5 Production and +5 Science a settlement on Oligarchy, and moved for a `GovernmentBiases` row; so the
modifiers carry what a system pays, and only bias rows steer the pick. The owner decided on 2026-10-30 to give each civ
its own: 50 civs, one row each at 75, spread Antiquity Classical Republic 6, Despotism 5, Oligarchy 6; Exploration
Feudal Monarchy, Plutocracy and Theocracy 6 each; Modern Authoritarianism 4, Bureaucratic Monarchy 5, Elective Republic
5 and Mexico's Revolución (`docs/government-biases.md`; NOTES, "Government biases and the description"). Not yet watched
in a game. M11: a government-only card is gated correctly but wasn't slotted. The tax lines ship as flat per-settlement
modifiers gated on the slotted card, in each settlement (`data/econ-systems-gameeffects.xml`):

| System | Light Taxation | Heavy Taxation | War Levy (at war) |
| --- | --- | --- | --- |
| Tribute (Despotism) | | +1 Gold | +2 Gold, +1 Happiness |
| Civic market (Classical Republic) | +2 Happiness | -1 Happiness | -1 Happiness |
| Manorial (Feudal Monarchy) | +1 Gold | -2 Gold, +1 Happiness | -4 Gold, +2 Happiness |
| Corporatist (Revolutionary Authoritarianism, Authoritarianism, Bureaucratic Monarchy, Fascism) | | | in peace, +6 Gold and -3 Happiness on top of the card's +2 and -1 |

Each is DESIGN's percentage of the card's flat amount, rounded to a whole yield (Tribute's 15% cheaper celebration
rounds to nothing on Heavy's -2). Since the Light arms (2026-10-30): Civic market's 30% of Light's +6 is +2; Manorial's
half of Light's -1 Gold rounds up to the whole 1, so Light costs a Manorial civ no Gold; War Levy's peacetime +2 and -1
get no system line (Tribute's 20% and Civic market's 25% round to nothing; Manorial's half was left out to keep the rows
few, a choice in NOTES); Corporatist's peace rows give the rest of the wartime +8 and -4. The Modern governments' rows
stand aside once a civ has an ideology, and Fascism's come from its branch root. A government that reads none (the first
turn of an age, M4) keeps the civ's last system. A Planned civ keeps the tax cards, since they're the game's own
policies and its AI plays them, and the plan runs beside them. A Religious lender's loan is a partnership: its interest
each turn is the lender's rate times the borrower's income against its income when the loan opened (0.5 to 2.0). Citizen
loans: the cap counts settlements with a standing Commerce building; their AI rule is in section 6; a repudiation of the
citizens closes them for 30 turns and counts as a repudiation at the 0.15 standing cost. Partisans hardship and the
Commons topics wait for Mod Commons. In the 1.2 balance run Corporatist came out ahead of Mixed on Gold, credit and
swing and level on production, and the plan's production was worth 1.33 times the Gold it took at the game's purchase
price; priced at that rate since (choice 104), it's worth the Gold it takes (section 10).

## 5. What the player can do

- Borrow: pick lender, principal (up to `credit_cap` and the debt-service limit, 4.2), term 10, 20 or 30 (4.3). See
  the per-turn payment, total interest and how much of income the loans take first. Past a limit, the offer says the
  most that lender would lend over that term, with a "Borrow that instead" button, and a request refused in the
  batch says the same in the turn notification.
- Repay early: any amount, no penalty.
- Restructure an overdue loan once (4.4). See the new schedule first.
- Repudiate what you owe one lender or the bond market (4.5). See the Gold kept and the reputation and credit cost
  first.
- Switch the guard off or on (4.6) on the Loans tab.
- Lend: offer `P`, `r`, `T` to an AI in shortfall. It accepts if `r <= 1.2 * its bond rate`, its income is positive
  and the loan fits its debt-service limit (4.2), so the player isn't lending to a civ that can't pay. The player
  bears the AI's default or repudiation under the same rules. Each borrower shows its repudiation risk: the AI
  rule's conditions (section 6) and how close it is to them.
- Fiscal tab: tax level and tariff. Defaults are Standard and None; each changes at most once per 5 turns.
- Invest from the Trade tab: a civ for general, or a city for a development loan on its current build; "as aid"
  means no return. See the progress or Gold, the return and the relationship gain first.
- Accept or decline AI offers to invest in the player's civ or builds.
- Read: the Economics screen, a dock button, and a top-bar pill (phase, inflation, outstanding; red in default).

## 6. The AI

Where a part is native (taxes, stages, buildings, government, grievances; see "Native first" in section 1), the AI
plays it itself and there's no rule here. The rules below cover what only the mod can see. They run on each AI's own
numbers. The AI's native spending doesn't know about them, so they follow three principles:

- Don't take on what it can't pay. Standard borrowing, lending and investing need positive income and the 4.2
  limits.
- Don't let the mod's own charges sink it. Trade settlements are capped by income and stop at income 0 (4.10);
  emergency loans have a cap (4.6). The rules apply the same way to the player.
- Tell a short civ from an insolvent one. Short: positive income, a balance about to dip; it borrows normally and
  can restructure. Insolvent: income at or below 0 for 5 turns running (4.6); it gets emergency loans up to the cap,
  never lends or invests, and runs Heavy tax.

| Part | Rule |
| --- | --- |
| Borrowing | short: a standard bond or AI loan for the shortfall, 10 turns, within the 4.2 limits; insolvent, or past the limits: an emergency loan within `emergency_cap` (4.6); past the cap: none |
| Build loan | income of 10 Gold or more, solvent, in no default, its own phase Boom or Steady (or outside the cycle), a city with a build at the head of its queue, at most once per 10 turns: the cheapest bond or AI loan over 10 turns for up to 5 turns of its income, no more than the build still needs at the game's purchase rate (4.17) and no more than the most the 4.2 limits allow (the sizing a player's refusal names). The principal goes from the lender straight to the build as `addProgress`, through the progress account a development loan uses, role buildings first. No native lever carries a loan (P18), so this is the AI's door to borrowing to build, which the player has through the Gold it spends. Cheap credit in a boom means more of it, which is what builds the leverage a Panic needs (4.11) |
| Restructuring | an overdue loan with income > 0 is restructured at `m = 2` |
| Repudiation | at most once per 20 turns, never against a Friendly lender. Repudiates what it owes a civ it's at war with; or, when insolvent or in default, what it owes a lender it's Unfriendly or worse with, if that debt is above `10 * max(|income|, 10)`; or the bond market, when insolvent and at `emergency_cap` |
| After a repudiation | doesn't lend to, invest in or aid the repudiator while the repudiation counts against its standing (4.5) |
| Lending | income > 0 and balance > `20 * income`: lends to a short civ at the 4.3 rate, cheapest first; never to an insolvent one |
| Taxes | native: the AI slots the tax cards in its own policy pass, steered by War Levy's requirement and the two strategy rows (4.7). Only in the script fallback: Heavy if balance < `5 * max(|income|, 10)` and falling, or insolvent (War Levy at war); Light if income > 0 and balance > `30 * income`; else Standard |
| Tariffs | option On only. Sets Low when it pays a partner more than it's paid and isn't Friendly with it; High against a partner it's Unfriendly or worse with, accepting High's relationship cost; a Mercantile AI, whose High costs half as much, goes to High where another would go to Low. A tariff falls on everything a civ imports, so only partners that sell it a third or more of its imports count. Answers a tariff on its exports in kind (Low with Low, High with High) 2 turns after it's set, when that importer buys a third or more of its exports; takes the higher of its own level and its answer; eases at once when the other side does and drops back when no reason holds; bound by the 5-turn limit |
| Investment | income > 0 and balance > `20 * income`, at most once per 10 turns, Friendly host only, `5 * its own income`: general if the host's income is growing, else a development loan on a city's current build; to the player it's an offer |
| Aid | income > 0; to a Friendly civ in default or in its own Depression, at most once per age, up to `5 * its own income` |
| Accepting | player loans at `r <= 1.2 * bond rate` with income > 0 and within its 4.2 limits; development loans on any current build; general unless in default; aid always |
| Citizen loans | a Civic market AI with income > 0, solvent, owing its citizens nothing and holding under 10 turns of income borrows up to 5 turns of income from them, as much as the debt-service limit lets through. No native lever carries a loan (P18), so this is the AI's door to a system the player can use |
| Investing from Capitalism | a Market or Mixed AI investor past Capitalism also invests in Neutral hosts that are Market or Mixed and past it (4.15) |

A setup option turns all AI rules off. The balance checks (section 10) measure how often an AI defaults, chains
emergency loans or loses units to the game's penalties because of the mod's charges, against a game without the mod.

Where the AI and the player are treated differently, and why:

- Choices the player makes freely run on limits for the AI: investment once per 10 turns into Friendly hosts, aid
  once per age, lending only above 20 turns of income. The AI's native spending doesn't see the mod's flows, so these
  limits keep it from giving away Gold it needs (the first principle above). What a deal does once made, and whether
  a host accepts it, is the same for both sides.
- Tariffs: the player sets a tariff when it likes; the AI by the rule above. Until 2026-10-30 the AI only answered a
  High tariff, so a player's Low tariff was free; now both sides pay for a tariff in the same coin. The AI weighs only
  partners worth a third of its trade, because one level falls on all its imports and, without that, a single
  Unfriendly partner spread High to nearly every pair in the balance run (section 10).
- The guard is the player's, with a switch on the Loans tab; an AI gets the same emergency loan by rule (4.6), with
  the AI option as its switch.
- A system's tax line pays every civ alike, but the AI's card pass can't see it (P17); the player sees it on the
  Fiscal tab and the yield breakdown. Most lines point the way the card's face value already does (Heavy under
  Tribute), so the AI rarely loses by it; Civic market's richer Light is the exception, and a Light-steering strategy
  row for Classical Republic AIs is the owner's call.
- The player can choose a government for its system; the AI chooses by its bias lists without knowing the mod (M2).
  Each civ gets one bias of its own (4.17, `docs/government-biases.md`), so an AI's system follows the civ it's
  playing: the same civ leans the same way every game, and the civs in an age spread across its systems.
- Borrowing to build: the player borrows when it likes and spends the Gold as it chooses, buying at the game's
  price; the AI borrows by the build-loan rule above, sized and limited the same way, and the loan's Gold lands on
  its current build at the same price. The AI's door is narrower (once per 10 turns, only while its own credit is
  cheap, 10-turn terms) because its native spending can't see what it owes; the player's is the Loans tab.
- Citizen loans: the player borrows when it likes, the AI by the rule above. The AI never repudiates its citizens
  (among the world accounts its repudiation rule reaches the bond market and temple treasuries only), while the
  player can.
- Cycle Gold, erosion, the plan, partnerships, old-building weights and every system number run through one code
  path for every civ.

## 7. Integration with the other Tower mods

| Mod | Coupling |
| --- | --- |
| Demographics | per civ: debt, interest paid and received, tax take, trade balance, defaults; world: `E`, inflation, debt, price index |
| Emigration | default or world Depression adds push; Boom adds pull |
| Partisans | default, Heavy, War Levy and Depression add hardship |
| Epidemics | outbreak is a cycle event (4.11) |
| Strategic Resources That Matter | its `Units` rows raise `demand_r` (4.9) |
| Canals, Dams, National Parks, Forests, Prospecting, Climate | their Gold costs are unchanged |
| Mod Commons | dock button and the topics above, when Commons ships |

## 8. Setup options

| Option | Values | Default | Release |
| --- | --- | --- | --- |
| Loans | Off, On | On | 1.0 |
| Auto-loan guard | Off, On; the player can also switch it on the Loans tab (4.6) | On | 1.0 |
| AI borrowing and lending | Off, On | On | 1.0 |
| Rates | Low 0.75×, Standard 1.0×, High 1.25× every rate (NOTES choice 19) | Standard | 1.0 |
| Taxes | Off, On | On | 1.0 |
| Economic stages | Off (each part opens at its age's start), On (4.15) | On | 1.0, covering the stages of the parts shipped |
| Markets and trade bills | Off, On | On | 1.1 |
| Tariffs | Off, On (needs Markets and trade bills) | On | 1.1 |
| Foreign investment | Off, On | On | 1.1 |
| Inflation | Off, On | Off | 1.2 |
| Business cycle | Off, Mild, Standard, Strong (`k`, 4.11) | Standard | 1.2 |
| Economic systems | Off (every civ Mixed), On (4.17) | On | 1.2 |

An option shows up in the release that ships its part. All Off: the Economics screen shows balances only and the mod
leaves the game alone.

## 9. Screens, data, integration

- Economics screen: `Controls.define` at load (post-startup defines never initialise on 1.5.0), `ContextManager.push`.
  Dock button via Mod Commons if shipped, else its own decorator.
- Each tab opens on what's due, what's coming and what the player can do about it; history sits below.
- Tabs:
  - Treasury: balance, income, next turn's charges, a 20-turn projection with and without the current loans, the
    mod's flows by line with the cause of each, the inflation reserve (4.8), buildings by role.
  - Loans: what the player can borrow today from each lender and what it would cost per turn, the debt-service share
    of income, open loans with overdue ones first and the restructure action, the guard switch and its remaining
    allowance, investments.
  - Fiscal: system and what it changes, tax level, tariff and what it does (4.10), tax take or the plan.
  - Markets: prices, holders, 30-turn history.
  - Trade: settlement by partner and the cap, the bill a new route would add where P7 allows, investment targets.
  - World: `E`, phase and its events, inflation and its cause, world debt, legacy.
- Top-bar pill: phase, inflation, outstanding; red in default.
- Turn notification: one per turn, listing the mod's changes to the player's Gold, Influence and celebration meter.
- State: ledger envelope (records, standing history, event log, the last batch for 4.14; at most 64 KB) and markets
  envelope (prices, `E` history, tax and tariff levels, systems; at most 32 KB). Closed records older than 20 turns
  fold into per-partner totals, and the event log keeps the last 100, so a long game stays inside the caps; the
  balance checks (section 10) test a 500-turn game with 12 civs against them.
- Data: text, setup parameters, and the level 1 gameplay rows "Native first" calls for (tax cards and their unlocks,
  government modifiers, AI weighting lists). Each gameplay row is written by SQL that selects through its parent
  table, so a missing DLC or a changed tree skips the row instead of stopping game creation, and each group is gated
  by its setup parameter (`ConfigurationValueMatches`). AI weighting lists are read at game creation only. All types
  the scripts use are read from `GameInfo` at runtime.

## 10. Probe and balance ladders

### Probe ladder (disproof gate)

Run P1 first and stop to report. Then the open parts of P2 to P4 (loans), then the rest as their parts come up.
Status (2026-10-24 sweep): "watched" means a recorded probe run; "ships" means a released Tower mod reads it in
play, which is good evidence of the read but not of exact numbers or timing.

| ID | Question | Status and evidence | Still open, cheapest disproof | If wrong |
| --- | --- | --- | --- | --- |
| P1 | Do `-n` on the player and `+n` on an AI in one tick both land, with the balance sum unchanged? | settled: watched twice (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`); Exploration seed 9001). -100 on the player and +100 on Pirate Republic landed with `TreasuryChanged`, the pair's sum unchanged to the cent (1159.87 before and after), and both held across the next roll | — | — |
| P2 | Does `Stats.getNetYield(YIELD_GOLD)` match the top bar; what do the `Treasury` maintenance getters return? | settled (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`); Antiquity seed 4242): over two rolls the balance moved by exactly `getNetYield(Gold)` (5.00 each turn); a +100 `grantYield` didn't move `getNetYield` the next turn. The two getters are `getMaintenanceForAllUnitsOfType(type)` and `getMaintenancePercentForAllUnitsOfType(type)`, per unit type, answering for AIs as for the player. Building upkeep reads per building from `city.Gold.getSpecificBuildingMaintenance(row.$index).value` (a breakdown object with `base` and `modifier`) | for AI civs the per-building read gave 2 to 6 Gold while the engine's `Player_Treasury.csv` charged 0; the human matched (4 and 4). Cheapest test: an AI's balance delta against `getNetYield` the turn it finishes a Library | 4.2 `income` stands; the 4.6 upkeep term needs one per-civ figure that agrees with what the engine charges, AI included |
| P3 | Does a deduction show in the next turn's read; is the in-turn read stale? | settled (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`)): a -50 sent at the local `PlayerTurnDeactivated` read 230 in the same tick (stale), 185 at +5 s (landed, with the roll's +5 income on top) and 185 next turn, nothing lost or counted twice. The batch can run at `PlayerTurnDeactivated` | — | — |
| P4 | Does the engine take amenities at 0 and disband at -10 on a same-turn mod dip? | watched (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`)): no. With income positive, a balance of -20 became 0 at the roll (-3 became 2: the roll adds income first, then wipes whatever is still negative); city Happiness, the celebration meter and units were untouched; `NOTIFICATION_BANKRUPT_END` followed. The game's own text puts the penalty on a balance below 0 while income is negative: units disband highest upkeep first until the balance is restored | the negative-income branch: income below 0 and the balance below 0, watch which unit goes and when | see the note under the table |
| P5 | Relationship readable per pair? | settled: `getRelationshipLevel` 23 then -7 between two AIs (watched 2026-10-16) | — | — |
| P6 | Does `-n` on the meter delay the next celebration, player and AI? | only the meter move is watched (2026-09-11) | push one civ down by its threshold, watch | the taxes fallback becomes Gold-only, and Civic market's citizen loans (4.17, 1.2) need another reward |
| P7 | Can the UI context read an AI's resources and routes? | settled (2026-10-29 night and 2026-10-30, 1.5.0, lab, probes-only registry (official content plus `econ-probe-11` or `econ-probe-12`); Exploration seed 9001, 1.1 C8): at turn 40 every AI with routes read its routes and per-route imports (Silla 2 routes and 9 imports, Japan 1 and 1, the Pirate Republic 2 and 9, France 2 and 9), the `carried` resources adding up to each civ's imports; `projectPossibleTradeRoutes()` answers for AI ids too | — | — |
| P8 | Read an AI city's current build; does `addProgress` land on it; does the AI keep it? | settled (2026-10-29 night and 2026-10-30, 1.5.0, lab, probes-only registry (official content plus `econ-probe-11` or `econ-probe-12`)): Exploration 9001 (C3), 20 progress on Silla's Bazaar landed within 3 s (12% to 30%) and the build stayed the Bazaar for 3 turns beside a control city that did the same, in two games; Antiquity 4242 (M7), 60 progress on each AI's one city finished or advanced the build it had chosen in all five, none switched | a control comparison when AIs hold two cities | — |
| P9 | List an AI's buildings; tell damaged from working? | settled: `city.Constructibles.getIds()` per settlement and `Constructibles.getByComponentID(id).damaged` / `.complete` ship (Demographics); a raid sets `damaged` (watched 2026-10-01) | — | — |
| P10 | Is a war between two AIs seen in the turn it starts? | settled: `Game.Diplomacy.getPlayerEvents(pid)` with `getDiplomaticEventData` builds Demographics' War Timeline for each civ (ships); polling `Diplomacy.isAtWarWith` agreed with the engine over 25 turns (watched, CD), majors only since every Independent reads as at war | — | — |
| P11 | Natural disasters with a location; raze told from capture? | settled: a natural `RandomEventOccurred` reached the UI context with `eventType`, `severity`, `mitigationLevel`, `location` (watched 2026-09-19, emigration test 161; Demographics ships disasters per civ from it); `CityRazingStarted` marks a raze (ships, Demographics; `raze-started` seen again 2026-10-30). Population loss (2026-10-29 night and 2026-10-30, 1.5.0, lab, probes-only registry (official content plus `econ-probe-11` or `econ-probe-12`)): with floods and eruptions at 300 an age (M6, Antiquity 4242) the nearest settlement lost population in 4 of 21 events, stayed in 10, grew in 6; at the base frequency `Game_Gossip.csv` logs "Pop Lost" 1 to 4 in 9 of 17 and 9 of 23 events (Exploration 9001) | — | — |
| P12 | Is a running crisis stage readable? | settled: `Game.CrisisManager.getCurrentCrisisStage(0)`, -1 before, 0 to 2 active, 3 ended (ships, Demographics' crisis charts). The engine-closed -1 reading was a save with no crisis started | — | — |
| P13 | Can the UI context read an AI's completed nodes? | settled: civics (2026-09-15) and techs (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`)): `Techs.isNodeUnlocked('NODE_TECH_AQ_CURRENCY')` read false for every AI at turn 28 and true at turn 85, matching each AI's `Techs.getResearched()` list | — | — |
| P14 | Can the UI context read an AI's government, and does it change at the transition? | settled (2026-10-29 night and 2026-10-30, 1.5.0, lab, probes-only registry (official content plus `econ-probe-11` or `econ-probe-12`); Antiquity 4242 through two age changes into Modern, M3 to M5): `getGovernmentType()` read every AI in every age; it reads none on an age's first turn and the new pick on the second (Exploration three Feudal Monarchy and three Theocracy; Modern all Authoritarianism). `getChosenIdeology()` agreed with the completed branch root for every civ at Modern turn 90 | — | — |
| P15 | Can a save land in the 3 s between the ledger write and the grants landing (4.14)? | watched (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`)): one autosave a turn, requested as the next turn starts; a batch landed 0.96 s after it was sent, the next save request came 4.7 s after the send; from the end of the local turn to the next save request was 3.1 s in a quick lab game. The window exists, with about 2 s to spare | — | 4.14's reload check (snapshot balance plus net) is needed as written |
| P16 | Do repudiation's grievances (10 to 40) make war between the two civs likelier over a long game? | partly settled: 75 script grievances turned an AI hostile and made the other's cities its targets within a turn, no war in 15 turns, one pair of seeded runs (watched 2026-10-15) | no cheap test: the same seeds with and without a repudiation, 50 or more turns, several runs, count wars and attack operations | the conflict link is hostility and targeting without war; say so in the Civilopedia |
| P17 | Can tax cards work as native policy cards, for the player through the Fiscal tab and for the AI through its own policy pass? | watched (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe` or one arm); Antiquity seed 4242). It compiles; the tax slot appears at Chiefdom and policy slots grow to 4. Player door: `CHANGE_TRADITION` Activate is refused with every slot full though `canSwapCultureSlot` reads true; Deactivate then Activate swaps within the turn (city Gold 1.95 to 4.05, Happiness 32 to 20), and a swap back that turn is refused. AI door: the AI slots the cards in its own pass, mostly on the turn a slot opens. As written, Light at fresh slots (Goryeo t26, Hawaii t29, Dai Viet t33), Heavy once (Dai Viet t35, its third slot), War Levy twice in 80 turns, once at peace. Six 80-turn arms (`mod_ideas_tested/economics/devtools/probe-runs/2026-10-29-p17-analysis.md`, "Arms run"): with no Happiness cost Heavy gains a few picks but still loses fresh slots to Light; flat amounts (Heavy +4 Gold -2 Happiness a settlement, Light the mirror) put Heavy in every slot Light had and Light is never taken; Light behind the war requirement is taken at peace as before, and War Levy without it is picked as before, so the card pass scores a gated modifier as if it applies; a Short of Gold Gold bias of 2000 all but removes Light and brings Heavy and War Levy to four AIs. Steering pair (rows in and out, Greece held at 5 Gold): the same picks on the same turns, so the rows at +50 change nothing visible | the steering pair (same seed with and without `econ-probe-ai.sql`) was stopped when a game nobody in this run started came up; the yield tooltip naming the card needs a hover | the AI picks the cards on face value, and Light alone; see the note under the table |
| P18 | Is there a native diplomatic action that can carry Gold between two civs, and will the AI use one a mod adds? | watched (2026-10-29, 1.5.0, lab, Probes-only registry (official content plus `econ-probe`)). The base game has `DIPLOMACY_ACTION_SEND_GOLD` ("Send Gold to an ally", its amount chosen as `Amount2` on the target screen); no AI used it in 85 turns. The probe's aid action is scored by the AI every turn from turn 10 (`AI_DiplomaticActions.csv`, 266 rows) and never started: the treasury log has no ±100 pair between AIs. Sent by the player through the target screen's own arguments, it opens a diplomatic event with `targetPlayer` -1 and no response, and no Gold moves | whether the engine takes a negative `InitialPlayerAccept` grant from the proposer stays open; Send Gold between allies is the next native lead | loans, aid and investment stay level 2 (`grantYield`) with section 6 rules, as the fallback says |

Probe run, 2026-10-29 (prompt 1; results in the rows above, logs in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-29-game2-aq4242/`). Two design changes it points at, left to the
owner:

- **The guard line (4.6).** On 1.5.0 a negative balance costs nothing while income is positive: the roll wipes it to 0.
  The penalty needs income below 0 too. So the guard only has work when income is at or below 0, and an emergency loan
  taken on a positive-income dip is Gold the engine would have given for free. Proposed: fire the guard on projected
  balance below 0 *and* income at or below 0; keep `emergency_cap`.
- **Conservation (4.14).** The same wipe erases any mod charge that leaves a balance below 0 after income, after the
  other side was credited. The model's "no payer past its funds" (debt-6) is what prevents it; it now has an engine
  reason and stays a hard invariant.
- **Tax cards (4.7).** The AI takes Light Taxation and nothing else. Heavy and War Levy as written look worse to its
  card pass than whatever it holds. Either the cards' numbers change (a Heavy that costs less Happiness), or War Levy's
  value to the AI comes from somewhere the card pass reads; the steering pair is the next test.

Probe runs, 2026-10-29 night and 2026-10-30 (1.1 Commerce and 1.2 Macro, results in
`mod_ideas_tested/economics/devtools/probe-runs/2026-10-30-commerce-results.md` and `2026-10-30-macro-results.md`; P7,
P8, P11 and P14 above). What they change, left to the owner:

- **Trade bills (4.10).** The import levy is a working native per-import charge: -1 Gold an import, to the Gold, on the
  turn the import arrives. The engine's exporter payment didn't show: `getTradeYields` read 0 on every route city, both
  ends, over 120 turns, so DESIGN 12 item 6's input is still open. One levy and no-levy pair showed no fewer AI routes
  under the levy.
- **Aid and deals (4.12).** The AI starts Military Aid (7 times in 120 turns) but never scored the rewritten Hinder
  Finances or Hinder Food Production in Exploration. For the player, Development Aid moves 12 Gold a turn each way
  (the row's 6, scaled by age) and needs Neutral; `CostInGold` isn't charged; Send Gold moves its `Amount2` in the
  same tick. The AI's deal evaluator answers `INSPECT` and `PROPOSED` and takes a Gold gift or a swap in its favour,
  and a deal sent as `ACCEPTED` moves Gold either way with no answer and no relationship change. No deal item carries a
  turn count, so schedules stay in the ledger.
- **Government and ideology picks (4.17).** +10 Gold, +5 Production and +5 Science a settlement under Oligarchy
  didn't move any Antiquity pick; a `GovernmentBiases` row at 50 moved four of six civs to Oligarchy. The AI picks from its
  lists, not from government modifiers. In Modern the same arm on Elective Republic didn't move anyone. On the Communism
  root it did reach the ideology pick: in three seeds the first civ to choose took Communism, but the count of
  Communism civs stayed at one, the others spreading over the rest; +4 Gold alone didn't move a pick. A government-only card
  (Republican Levy, +4 Gold -2 Happiness) unlocked only for Classical Republic civs, and they left it unslotted for 60 turns.
- **Prices (4.8).** -50% purchase efficiency under Despotism raised every price by exactly half from the turn of the
  pick, so a native price rise works where the engine's own state can gate it.
- **Old buildings (4.16).** Both age changes kept every building with its base Gold and upkeep unchanged; cities
  reverted to towns (2, then 7). The fade is the mod's own. Gold carried to the cent; nobody passed 3,000.
- **Celebrations (P6).** A negative grant on an AI's meter delays its next celebration (Persia pushed from 204 to 9 at
  turn 31 hadn't celebrated by 41; the control celebrated at 33). Citizen-loan interest as celebration works.
- **Cycle reads (4.11).** `war-declared` matches the polled war starts one turn earlier, pair for pair; peace, city
  transfers with their type, a raze and crisis stages 0 to 2 all showed in each age.

Probe preparation, 2026-10-29 (no game; the game was in use): the probe mod for P17 and P18, recipes for P2, P3,
P4, P6, P13, P15, P17 and P18, and the run order are under `devtools/` (`RUN-SHEET.md`). The mod's data applied clean
to a 1.5.0 Exploration database copy with every foreign key holding (`devtools/fk-precheck.py`); the Antiquity rows
meet the engine at the first lab start. P18's database half is in its row above; the rest of the ladder is unchanged.

### Balance ladder

The probes say whether the engine allows a part; these say whether it plays well. They run in the Node simulation
(`../tests/_sim.mjs` and TEST-PLAN 12.1), on small and large maps, each age, two game speeds, and 4 and 12 civs, and each
one is compared with the same seeds and the mod's options all Off. A release ships when its own checks pass.

| Check | What's measured | Starting target | Release |
| --- | --- | --- | --- |
| AI solvency | AI defaults, emergency loans and game-penalty turns (amenities lost, units disbanded) the mod's charges cause, against the Off run | an AI with positive income in the Off run defaults in under 1 game in 10 | 1.0 |
| Debt persistence | emergency loans taken back to back; time spent at `emergency_cap` | no civ chains emergency loans past the cap; an insolvent civ reaches the game's penalties within about 10 turns of the cap, as designed | 1.0 |
| Borrowing pays | a 10-turn loan at the base rate spent on a Market, Granary or a unit, against the Gold and yield it brings back | at least one ordinary use pays back within the term in each age | 1.0 |
| Lending pays | the player's return on loans to AIs, net of defaults and repudiations | positive on average at the base rate | 1.0 |
| Repudiation | how often AIs repudiate, against whom, and what follows: relationship, later rates, wars within 20 turns | rare outside wars and insolvency; a repudiator borrows at clearly worse terms for the 40 turns; a lender stiffed by a weaker neighbour goes to war with it more often than in runs without repudiation (P16) | 1.0 |
| Save integrity | the ledger and balances after a save and reload in each step of 4.14 | identical ledgers, no transfer sent twice or lost | 1.0 |
| Envelope growth | ledger and markets envelope sizes in a 500-turn, 12-civ game | under 64 KB and 32 KB | 1.0, 1.1 |
| Turn time | time to plan one turn | under 50 ms at 12 civs, 60 settlements, 40 routes | each |
| Trade profit | net Gold of making a route, settlement included, against the Off run | an ordinary route stays worth making for both sides | 1.1 |
| Development loan ratio | `G / 3` progress against the game's own Gold purchase price for the same build, by age and speed | development loans cost about what buying would, not far less | 1.1 |
| Wide and tall | depth, credit and rates for a 4-city and a 12-city civ with the same buildings per city | the wide civ's edge is about its extra income, not much more | 1.1 |
| Cycle shape | share of turns in each phase; Panics per game; a peaceful game's turns in Slump | a peaceful game still slumps sometimes; Depression never holds 30 turns; Panic at most twice per game | 1.2 |
| Inflation | median and worst `pi`; eroded Gold against bond principal | inflation never sits at its cap for 20 turns | 1.2 |
| System diversity | each system's income, credit, production and cycle swing under the same start | each system shows its line in 4.17; none comes out ahead of Mixed on all four | 1.2 |
| Citizen loans | celebrations a Civic market civ gets from citizen-loan interest against what the same Gold gives up under Light tax; how much Civic market civs borrow | about the same celebration per Gold as Light tax; Civic market borrows more than other Antiquity civs and still clears its loans | 1.2 |
| The plan | a Planned civ's production against a Mixed civ's with the same Gold income | the plan's extra production is worth less than the Gold it took plus the tax levels it gave up | 1.2 |
| Mod compatibility | a removed resource, a moved civic, an added unique building, a deleted `AGELESS` tag (test tables) | parts fall back cleanly and the checks above still pass | each |

Balance run, 2026-10-29, rerun the same day after the AI's emergency loan was made the guard's own loan (NOTES choice
35) (the 1.0 rows, in the Node simulation; `../tests/econ-balance.test.mjs`, 20 seeded 12-civ
500-turn games with three ages, each run On and with Loans Off from the same seed; the game's own spending modelled as
each civ keeping about five turns of income; full figures in `../reports/balance-1.0.json`). No game was
launched; these are the model's numbers against the starting targets, and where a target is missed the constant to
move is named and left to the owner.

| Check | Measured | Against the target |
| --- | --- | --- |
| AI solvency | 175 AIs with positive income in the Off run across the 20 games: 0 defaults, 0 emergency loans, 0 turns below 0. The 45 AIs the generator gave deficit spells: 235 defaults, 249 emergency loans, 2230 turns below 0 On against 2848 Off (the cap limits the relief to about ten turns of deficit) | Met: 0 games in 20 |
| Debt persistence | 0 turns in 120,000 civ-turns with emergency principal over `emergency_cap`; 45 civs reached the cap; the game's penalties start the turn the guard stops, since nothing funds the deficit from then | Met |
| Borrowing pays | Read from the compiled 1.5.0 database (the Market row and its adjacencies, see below): a Market costs 360 Gold and yields 3 to 5 Gold a turn, so 30 to 50 Gold over a 10-turn term against 59.4 Gold of interest at 0.03; a Bazaar 800 Gold, 60 to 80 against 88 at 0.02; a Bank 1,520 Gold, 80 to 100 against 125 at 0.015; a Granary pays no Gold. Against saving instead at 10 Gold a turn, the Market comes 36 turns sooner and nets +49 to +121 Gold, the Bazaar and Bank more | Missed in every age on the strict reading (the building's own yield within the term covers the interest); met in every age on the earlier-than-saving reading. Constant: `base_rate` 0.03 / 0.02 / 0.015 to 0.015 / 0.01 / 0.0075 makes a Market (29.7 against 30 to 50), a Bazaar (44 against 60 to 80) and a Bank (63 against 80 to 100) pay on the strict reading; or keep the rates and write the earlier-than-saving reading into the check |
| Lending pays | The human lends to every short AI with positive income at `r_L` (neutral, the base rate) over 10 turns: 18 of 20 games lent, 13,784 Gold in all; return +9.7% median, +8.8% mean, 17 of 18 positive; the one negative game is loans still open at turn 500. Nothing was written off to the human in any game, because AIs with positive income never defaulted or repudiated | Met |
| Repudiation | 77 repudiations in 20 games (median 4 a game), all by insolvent AIs at the cap and all against the bond market or temple treasuries; none against a civ or the human; 235 defaults, 1 restructure (restructuring needs income above 0, which the deficit civs lacked). After one, the model charges standing 0.7 (a bond rate of 0.04 becomes 0.057), takes 4 turns of income off `credit_cap` and offers 10-turn terms only, for 40 turns (pinned by test). Wars within 20 turns: not modelled (P16) | Partly met: rare outside insolvency, and the terms afterwards are clearly worse; the war-debt and hostile-lender branches didn't fire in the simulation (NOTES finding H), so "against whom" is only unit-tested. The lever, if AI-to-civ repudiations should show, is the AI lending threshold (`20 * income`) or more wars during a loan's life |
| Save integrity | Identical ledgers and balances with a save and load between every turn (3 seeds over 200 turns in the property test; all 20 balance games); a turn re-planned from its saved ledger is a no-op; after the grants every batch row reads landed, before them every moved row reads lost, and re-sending the lost nets gives the same balances | Met offline; P15 decides whether the 3 s window exists in the engine |
| Envelope growth | Ledger at most 18,314 bytes over 500 turns with 12 civs; the worst case the caps allow (6 open loans per civ, 32 settled, 100 events, a batch) fits in 64 KB. The markets envelope is 1.1 | Met |
| Turn time | 12 civs: median 0.017 ms, worst 0.73 ms over 10,000 turns; a 96-open-loan turn under 5 ms in the perf test. Settlements and routes don't enter the 1.0 plan | Met |

"The Gold and yield a Market brings back" was modelled from `gameplay-copy.sqlite` (1.5.0 compiled gameplay
database): `Constructible_YieldChanges` gives `BUILDING_MARKET` +3 Gold; `Constructible_Adjacencies` attaches
`CoastGold`, `RiverGold` and `WonderGold`, each +1 Gold per adjacent coast tile, navigable river tile or wonder
(`Adjacency_YieldChanges`), so 3 to 5 Gold a turn; its maintenance is 2 Happiness and no Gold; `Constructibles.Cost`
is 90 and `GlobalParameters.GOLD_PURCHASE_MULTIPLIER` is 4, so 360 Gold at Standard speed (`GameSpeeds` 100). The
Bazaar (200, +6 Gold) and Bank (380, +8 Gold) rows were read the same way. The purchase formula itself hasn't been
read back from a city's purchase panel, and `COST_PROGRESSION_PREVIOUS_BUILDINGS_CITY` is ignored (the first building
in the city); a probe can read `BuildQueue`'s purchase cost to confirm.

Balance run, 2026-10-30 (the 1.2 rows, in the Node simulation; `../tests/econ-balance-macro.test.mjs`, six seeded
12-civ 300-turn games across the three ages with each age's governments and Modern ideologies, ten wars, 40 routes that
open and close, disasters, captures and each age's crisis, a peaceful game, and controlled runs for the system rows;
figures in `../reports/balance-1.2.json`). No game was launched.

| Check | Measured | Against the target |
| --- | --- | --- |
| Cycle shape | World phase Steady on 55 to 71% of turns and Boom on the rest in every game; `E` never below 0.95 (lowest 0.952), highest 1.15; the peaceful game Boom on 63% of turns; civ Slumps on 0 to 2 civ-turns a game; no Depression; no Panic (leverage peaked at 5%, against the 150% a Panic needs) | Missed: a peaceful game never slumps, and the world leans to Boom. Two terms rise with ordinary growth: each standing route's +0.001 a turn (the world's +0.01 cap is reached with ten routes) and world income against 10 turns ago (incomes grow every turn). Without them the same games slump on 7 to 20% of turns with no Boom, and the peaceful game holds Steady with 24 civ-turns of Slump. Constants: `CYCLE_WEIGHTS.routeStanding`, `incomePer5Pct`, or measuring income against its own trend. A Panic needs borrowing the AI rules don't do |
| Inflation | `pi` on 60 to 150 turns a game, median 0.01 to 0.04%, worst 0.1% a turn; 30 to 75 Gold eroded a game | Met: never at its cap |
| System diversity | Ten civs, one per system, the same world for 100 Exploration turns: Corporatist +7.7 Gold of cycle Gold against Mixed's +4.2, credit 630 against 420, swing (sd of `E + L`) 0.028 against 0.036, production level; Merchant oligarchy credit 540, swing 0.037; Manorial credit 300, swing 0.034; Planned 300 Gold into 100 points of production, outside the cycle; the rest within a few Gold of Mixed | Missed for Corporatist (ahead on three of four, level on the fourth): its war boom paid while the others took the war's hit, and its 1.5x credit is the biggest single number. Constants: `SYSTEM_CHANGES.corporatist.creditPct`, `CYCLE_WEIGHTS.corporatistWar` |
| Citizen loans | A Classical Republic AI holding 5 turns of income: 563 Gold borrowed in 100 Antiquity turns, 61 Gold of interest, 122 celebration, no default; the other Antiquity AI borrowed nothing | Met at 0.4.0's Light (2 a Gold); missed since the Light arms (2026-10-30): Light's +6 Happiness for -1 Gold is 6 a Gold, three times the citizens' 2. The owner's call whether the citizens' return should rise to match |
| The plan | A Planned civ at 50 Gold a turn: 450 Gold into 150 points in 50 turns, worth 600 Gold at the game's purchase price (4 Gold a point) before production bonuses scale `addProgress` up (NOTES finding L) | Missed: worth 1.33 times the Gold it took, and a Planned civ gives up no tax level here. Constant: `PLANNED.goldPerProgress` (3, the development loan's ratio) to 4 or more |
| Envelope growth | The macro envelope at most 3.2 KB | Met |
| Turn time | 12 civs, 60 settlements, 40 routes, every part on: median 0.16 ms, worst 2 ms | Met |

Balance run, 2026-10-30, after the model fixes (NOTES findings P to U and W to Y; the same harnesses and seeds as the runs above,
so each row reads against its earlier figure; `../reports/balance-1.0.json` to `balance-1.2.json` hold the new
figures). No game was launched.

| Check | Before | After | Against the target |
| --- | --- | --- | --- |
| Cycle shape (1.2 run, cycle fix alone) | Steady 55 to 70% of turns and Boom the rest in every game, no Slump; the peaceful game Boom on 63%; no Depression, no Panic | Slump 14 to 24% of turns and Steady the rest in every game, no Boom; `E` 0.87 to 1.03; the peaceful game Steady throughout (lowest 0.96), with 17 civ-turns of Slump; no Depression, no Panic | Half met: the lean is gone and wars, crises and below-trend income now slump the world, but nothing lifts it into Boom without credit (NOTES finding W); the credit boom comes with the AI's borrowing below |
| Cycle shape (1.2 run, with the AI's build loans) | as above | Steady 83 to 92% of turns, Slump 6 to 15% and Boom 1 to 5% in every game; `E` 0.85 to 1.08; the peaceful game Steady 87%, Boom 9%, Slump 4% (after its Panic) with 84 civ-turns of Slump; no Depression | Met: both Slump and Boom in all six games, Steady most common, and the peaceful game slumps |
| Panics a game (1.2 run) | 0 in every game; leverage at most 5% of the Gold held | 1 or 2 in every game, 1 in the peaceful one; leverage up to 3.9 to 4.7 turns of world income; 262 to 277 AI build loans a game, no default | Met: at most twice, and from booms with borrowing |
| The plan (1.2 run) | 450 Gold into 150 points in 50 turns at 3 Gold a point, worth 600 Gold at the purchase price: 1.33 times the Gold | 400 Gold into 100 points at the game's 4 Gold a point (read from the GlobalParameters fixture), worth 400 Gold: 1.0 times the Gold, with each sent point landing as one | Met on the Gold: the plan buys at the price a player pays, and the lab found a grant lands as the city's own production would (finding L), so `progressScalePct` stays at 100. It still keeps its tax cards |
| Trade profit and the cap (1.1 run) | the cap bound on 98% of settlement rows; median payment 3% of the payer's income; civs' mean net -3.6 to +4.6 Gold a turn | the bill at 2.5% of prices: the cap binds on 17% of rows; median payment 1.4% of income; mean net -2.1 to +2.2; a copy at base price bills 0.05 to 0.25 Gold a turn against the 3 Gold the engine pays the exporter | Met: the bill follows what's traded, and the route stays worth making for both sides |
| Tariffs (1.1 run, AI rules on) | the AI only answered High; no AI-set tariff | civ-turns at None 20%, Low 40%, High 39%; trading pairs with High on both sides on 21% of turns; 117 changes in 10 games; the AIs' net settlement +0.013 Gold a turn on average against the same games without AI tariffs (median +0.03; 60 AIs gained, 49 lost) | Met: no spiral to High everywhere, and on average the AI's tariffs raise its own net, if only by a little |
| Citizen loans (1.2 run) | 563 Gold borrowed, 61 of interest, 122 celebration: 2 a Gold of interest, matching Light at -2 Gold and +4 Happiness | 891 Gold borrowed (the service limit is now half of income), 48 of interest at the halved rate, 290 celebration: 6 a Gold of interest against Light's new 6 (-1 Gold, +6 Happiness); no default; the other Antiquity AI borrowed nothing | Met: the factor is 6, the same price as Light |
| Borrowing pays (1.0 table) | interest at 0.03 / 0.02 / 0.015: Market 59.4 Gold against 30 to 50 of yield, Bazaar 88 against 60 to 80, Bank 125 against 80 to 100 | at 0.015 / 0.01 / 0.0075: Market 29.7 against 30 to 50, Bazaar 44 against 60 to 80, Bank 62.7 against 80 to 100; the Granary pays no Gold | Met on the strict reading in every age, the Market by a hair at its lowest yield |
| AI solvency (1.0 run, with the new rates and limits) | 175 AIs with positive income in the Off run: 0 defaults, 0 emergency loans | the same 175: 0 defaults, 0 emergency loans; penalty turns On 491 against 2,848 Off (509 before) | Met: 0 games in 20 |
| AI solvency (1.0 run, with build loans and three cities a civ) | as above | the same 175: 0 defaults, 0 emergency loans, about 290 build loans a game; penalty turns On 1,938 against 2,848 Off. 1,854 of them come from the harness now carrying the markets envelope (NOTES finding X), 84 from the build loans | Met: 0 games in 20 |
| Inflation (1.2 run) | median 0.01 to 0.04%, worst 0.1% a turn; 30 to 75 Gold eroded a game | median 0.02 to 0.06%, worst 0.36%; 63 to 155 Gold eroded (NOTES finding Y) | Met: never at its cap |
| System diversity (1.2 run) | Corporatist +7.7 Gold of cycle Gold against Mixed's +4.2 | Corporatist -10.5 against Mixed's -14.0: the controlled world's routes no longer lift it, so every system's cycle Gold is a charge; credit and swing as before | Unchanged in shape: Corporatist still ahead on three of four |
| Lending pays (1.0 run) | +9.4% median return, 8 of 9 lending games positive | +4.8% median, 8 of 9 positive: the player's neutral rate is half what it was | Met |
| Development loan ratio (1.1 run) | 1.125 times the purchase price on a role building, 0.94 on another | unchanged: it was measured against the purchase rate already, and a development loan's return carries the rest | Met, so `G / 3` stays: the lab found grants aren't scaled up beyond the city's own production (finding L) |

## 11. Versions

Three releases. Each one ships when its probes and its balance checks (section 10) pass, and the next starts from
what play showed. Stages (4.15) and building roles (4.13) ship with the parts that use them.

| Release | Parts | Screens |
| --- | --- | --- |
| 1.0 Finance | loans, restructuring, default, repudiation and the guard with temple treasuries (4.1 to 4.6); player lending (5); tax cards (4.7, or its script fallback); the AI rules for these (6); the Moneylending, Coinage and Public debt stages; Commerce and Banking roles, which set depth for credit and rates | Treasury, Loans, Fiscal; top-bar pill; turn notification |
| 1.1 Commerce | markets (4.9); trade settlement and tariffs (4.10); development loans, general investment and aid (4.12); the other roles in 4.13; the Trade, Guild patronage, Chartered companies and Tariffs stages | Markets, Trade |
| 1.2 Macro | inflation (4.8); business cycle (4.11); old buildings (4.16); economic systems (4.17); the Banking and Capitalism stages | World |

1.0, 1.1 and 1.2 are built and gated offline (versions 0.2.0 and 0.3.0, 2026-10-29, and 0.4.0, 2026-10-30); every
in-game check is owed
(`verification-runs.md`). The list below is what 1.0 changed in the 2026-10-06 loan model, kept for the record:

- Misses: `m` counts misses in a row and a paid turn resets it; missed interest is added to `O` (replaces NOTES choice
  1, and answers finding D); rates stop at `r_cap`.
- Restructuring (4.4) and repudiation (4.5), with their AI rules (6); the `repudiated` state; the repudiation terms
  in standing and `credit_cap` (4.2) and the lender block across two ages (4.3).
- The debt-service limit beside `credit_cap` (4.2), for standard loans and for AI acceptance of a player's loan
  (answers finding E).
- Emergency loans: the `emergency` flag, `emergency_cap` and the insolvent test (4.6); AI shortfall loans become
  emergency loans past the 4.2 limits. The open-loan cap of 8 stays as the envelope bound (NOTES choice 25, finding
  F).
- Guard line at 0 (finding B) and the garnish bound by cash with the income-at-or-below-0 branch (finding C).
- The turn as one batch with an order-free resolve step and a saved snapshot per batch (4.14), replacing the
  in-order carried arithmetic of NOTES choice 3.
- The stage gate in place of Antiquity dormancy (TEST-PLAN 12.6).
- Taxes leave the model when the cards work (P17); the fallback's arithmetic stays as a module that's off by default.
- Repudiation's grudge comes out as grievance rows `{ from, against, amount }` for the glue to book.

## 12. Open questions for the user

Decided 2026-10-24: the name is Economics, folder included; the guard works from the start of the game (temple
treasuries before the bond market, 4.6); tariffs keep their name; the repudiation grudge scales with the lender's
income (4.5); relationship gains from investment scale with the host's income (4.12); Civic market gets citizen loans
(4.17). `emergency_cap` and the debt-service limit are tuning numbers for the balance ladder (section 10). Decided
2026-10-30: `base_rate` halved to 0.015 / 0.01 / 0.0075, the debt-service limit at half of income, 20-turn terms from
Moneylending (4.2, 4.3).

1. Default has no native engine effect available. Is the garnish plus Influence enough? Default: yes.
2. Civ loans now open in Antiquity (Moneylending) and the bond market at Economics, replacing "loans dormant in
   Antiquity". Default: as in 4.15.
3. NOTES findings B and C (guard at 0; garnish from balance at income 0 or below) are now written into 4.5 and 4.6.
   Reverse either if you'd rather not.
4. Inflation now defaults Off and ships in 1.2. Should it ever default On, once it's been played?
5. Should holding a scarce resource pay Gold by itself? Default: no, to avoid adding raw income.
6. Trade bills (4.10): the importer pays the exporter, so a route costs the importer Gold each turn. The alternative
   is for the game to pay the exporter some of it, new Gold the way the bond market makes it, so the importer pays
   less and trade is cheaper for everyone. Default: no, keep the importer paying, unless the trade-profit check finds
   routes stop being worth making.
7. Stage anchors: Public debt on Economics (early Exploration) rather than the Bank (late)? Capitalism on the civic
   rather than the Stock Exchange (late Modern)? Default: the civics.
8. Count civ-unique economic improvements (Caravanserai, Souq, Entrepot, Trading Factory) as Trade buildings? The
   advisory class also catches non-trade ones (Stepwell, Great Wall), so they're out until there's a cleaner test.
9. Is the government-to-system table right (4.17)? Revolutionary Republic and Revolución run Mixed for now. Market's
   rules are new in this revision; Civic market's citizen loans are new and need your read.
10. Repudiation (4.5): are the sizes right? The grudge of 10 to 40 grievances, -3 with each witness, -0.3 standing
    and -4 turns of credit for 40 turns, and the lender closed for this age and the next. Should it also cost
    Influence, like a missed payment? Default: no, the cost stays in reputation and credit.
11. Taxes as policy cards (4.7): each age's root civic grants a tax slot, but the game can't keep other cards out of
    it, and Heavy Taxation's lower Happiness can make a settlement unhappy, not only delay a celebration. Both are the
    game's own rules, which is why the AI understands them. Default: cards, with the script version for everyone as
    the fallback if P17 fails.
