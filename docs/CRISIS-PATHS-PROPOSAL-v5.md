# Crisis paths, fifth draft: the spec checked against the game (2026-11-02, nothing built)

Supersedes the fourth draft and folds the third and fourth into one build spec. The fourth draft froze the
design; this draft checks every lever it uses against what Civilization VII lets a UI-script mod read and change,
using the mod's own code and the lab runs of 2026-10-29 to 2026-11-02 as the record. Most of the design stands.
Six things don't survive the check as written, and the fixes keep each card's idea while moving it onto a lever
the mod actually holds.

## 1. The verdict

The engine, the lifecycle, the identities and the panel are all buildable: they run on the mod's own ledger, its
own batch and its own screen, and the batch already does the hard part (one write to the save, then the grants,
with a lost batch re-sent on load). The cards are where the game pushes back:

- Happiness. The mod can't give a settlement Happiness at runtime; it moves the celebration meter, which is how
  Relief and the citizens' interest already work. Every "Happiness a settlement" in the cards is a meter movement
  priced in Happiness, and the card says "as celebration". The game's own settlement Happiness, unrest and the
  yield breakdown don't change.
- The tax slot. The mod can swap the local player's card only when the game allows a swap, and can't touch an
  AI's slots at all. A Programme can't hold the slot. It nets the slotted tax card's Gold out instead: the batch
  charges back what the card pays, for every civ, from the card amounts the Fiscal tab already forecasts.
- Route income. The game's own route Gold isn't readable (`getTradeYields` read 0 in every route city) and can't
  be changed from script. The mod's trade bills are real but small: 0.1 to 0.8 Gold a partner a turn in the Modern
  run. A +25% on that is nothing. The trade cards move onto route count, the bills' cap and credit, which are big
  enough to matter.
- Peace terms. Nothing in the mod or the lab reads what a peace deal contained. "Peace on your terms" can't be
  judged. Settlement ownership can be, from the city lists the batch already reads.
- War for the human. `forceDeclareWar` works for an AI and doesn't take for the human seat (watched 2026-10-31
  and 2026-11-02), and a script-declared war doesn't count as formal for the game's own requirements (War Levy
  stayed at +2). The human meets a war obligation through the game's diplomacy screen; the mod only reads it.
- The Panic is world-level. One index, one world leverage figure; there is no Panic "from your own leverage".
  Bank regulation acts on what a Panic does to you.

Three reads need a probe before the cards that use them are built (section 6): the Influence stock, a war with an
independent power, and a capture told apart from a founding.

## 2. The levers, checked

| Lever | How the mod moves or reads it | State |
| --- | --- | --- |
| Gold | `grantYield` in the batch, whole Gold, carried cents | watched, all runs |
| Influence, charged | `grantYield` on `YIELD_DIPLOMACY` (misses cost 5) | watched |
| Influence, the stock | no read in the mod yet | probe |
| Celebration meter | the batch's celebration grants, positive and negative (Relief, relief-ended) | watched |
| Settlement Happiness | data modifiers only, switched by setup, not at runtime | not available |
| Build progress | `addProgress` on a city's current build | watched |
| The current build's kind | `BuildQueue.currentProductionTypeHash` against `GameInfo.Units` or `Constructibles` | readable, the mod reads builds today |
| Total production | `Stats.getNetYield(YIELD_PRODUCTION)` or the cities' sum | probe (a read) |
| Loans, rates, credit limits, write-offs | the mod's ledger | watched |
| The index, causes, Panic | the mod's cycle, world-level | watched |
| Prices by class, tariffs, trade bills | the mod's markets; bills are small | watched |
| Route count | `readRoutes` over the engine's routes | watched (the seat's routes 1 to 2 in run B) |
| The game's route Gold | `getTradeYields` reads 0 | not available |
| Relationships, grievances | `changeRelationshipLevel`, `changeNumGrievances` | watched |
| War state between majors | `isAtWarWith`, filtered by `hasMet` | watched |
| An AI declaring war on a major | `forceDeclareWar` | watched |
| The human declaring war | the game's own diplomacy screen only | by the player |
| War with an independent power | `isAtWarWith` on an independent's id; `forceDeclareWar` on one | probe |
| Settlements changing hands | the batch's city lists by plot, not by id | probe (a capture against a founding) |
| Peace deal contents | no read known | not available |
| Upkeep | `readUpkeepCents` | watched |
| Military strength | `readStrength` (combat units) | watched |
| A civ's tax card | `isTraditionActive` for any civ; the local player's swap only | watched |
| Government, ideology | `getGovernmentType`, `readIdeology` | watched (no ideology was picked in 48 Modern turns) |
| Religion | not read yet | later, for 7b's Indulgences |
| The save envelope | the ledger capped at 64 KB, trimmed oldest first | watched |

## 3. The engine

As the fourth draft wrote it, with three changes the game forces.

Identities stand: `cardId`, `responseId` (`<civ>-<crisisSeq>-<responseSeq>`), `transactionId`. Batch order stands:
read; settle obligations; standing effects; crisis conditions and lifecycle; new activations' first transactions;
write the ledger; the grants.

- Atomicity rides the batch. The fourth draft's per-transaction `pending` row and its balance check go: several
  transfers land on one civ in one batch, so a balance can't say which one landed. Every transaction of a turn is
  written into the ledger with the batch, before the grants, under the batch's sequence number; a save between
  the write and the grants is the case `resendLostBatch` already handles on load (watched 2026-10-30 and
  2026-11-02, "0 re-sent", "load catch-up from turn 120"). One mechanism, already proven.
- Recurring obligations keep a `lastSettledTurn`, not one id per turn. Foreign adventure's upkeep loan would
  otherwise write a row a turn into a 64 KB ledger. One field per obligation, idempotent the same way: a turn at or
  below `lastSettledTurn` is never settled again.
- The ledger budget. Open instances keep their contribution record (a few numbers each); an adjudicated instance
  shrinks to one summary row (card, outcome, turn) and its legacy row. The trimming order already in
  `econ-state.js` drops the oldest summaries first, never an open instance or a standing legacy.

Typed effects stand as the third draft's table, with one correction: the Happiness bounds apply to this mod's
crisis effects on the celebration meter, a floor of -6 and a ceiling of +6 Happiness-equivalent a settlement, and
never touch the game's Happiness.

The lifecycle, the resolution moment and "one awarded path per crisis" stand as the fourth draft wrote them.

## 4. Objectives on readable measures

| Path | Objective | What the mod reads |
| --- | --- | --- |
| Citizens' republic | the citizens' loan repaid on schedule; no other call on the citizens while it stood; every obligation met | the ledger |
| Company state | the civ's route count at adjudication at least two above its count at Commit; the charter loan serviced without a miss | `readRoutes`, the ledger |
| Public investment | every scheduled grant landed (none cut for want of Gold); production added by the Programme at least half a turn of the civ's production at Commit; Relief never ended early | the contribution record; the production read |
| Financial reform | debt service as a share of income at adjudication at or below two thirds of its share at Commit; no default; no repayment funded by a new loan | the ledger |
| War economy | the war the commitment asked for in force by its deadline; every upkeep loan serviced; at adjudication a settlement the civ didn't hold at Commit, taken (not founded) during the war, still held; the upkeep debt at or below 5 turns of income at Commit | `isAtWarWith`; the city lists by plot; the ledger |

Public investment's target was four turns of production in the fourth draft. At the watched rates (Public works
8 Gold a settlement a turn in Modern, 3 to 4 Gold a point) a six-settlement civ adds 12 to 16 points a turn, so
four turns of a Modern civ's production would take 25 to 60 turns, longer than any crisis the lab has seen. Half a
turn takes four to six turns. The balance runner sets the final figure.

Compromised and Abandoned stand as the fourth draft. The index's two roles stand (under 0.80 caps at Compromised,
to be tested; a self-caused prolongation fails the objective).

## 5. The slice on levers the mod holds

| Card | Path | Now | Price | Leaves |
| --- | --- | --- | --- | --- |
| Liturgies (Programme) | Citizens' republic | citizens lend 3 turns of income at 0% over 10 turns | 40 Influence, 4 a turn; the tax card's Gold netted out; while the loan stands -1 Happiness a settlement as celebration and the citizens' ordinary cap halved | earned: the citizens' cap +50% for the age; compromised: their rate +0.25 for 20 turns; abandoned: citizens closed 20 turns |
| Land reform (Measure) | | +4 Happiness a settlement as celebration for 10 turns | 10 Influence; -2 Gold a settlement a turn for 10 turns; the citizens' cap halved 20 turns | once per age |
| The assembly speaks (Gamble) | | Confidence doubled: +0.02 on your own index | 20 Influence | turns under 0.90 five turns on: -4 Happiness a settlement as celebration for 5 turns |
| Merchant marine (Programme) | Company state | a charter loan of 4 turns of income from the bond market at its rate; each turn while it runs, 2 production a route into the build of your city at that route's end | 50 Influence, 5 a turn; the tax card's Gold netted out; +0.5 on the bond rate | earned: the company's credit, the credit limit +2 turns of income and the bond rate -0.25 for the age while you run as many routes as at adjudication; compromised: the loan's rate +0.5 for what's left; abandoned: the loan due over 5 turns |
| Debt into shares (Gamble) | | a fifth of bond debt written off | 20 Influence; the company's claim: 3% of income to the bond market each turn for the age, and no tariff above Low while it stands | turns (index under 0.90 when it ends): the bond market at 1.5x the rate for the age |
| Lottery loan (Gamble) | | a bond loan of 4 turns of income at half the rate over 5 turns | 20 Influence | turns (a miss on it): the rate doubles for what's left |
| New Deal programmes (Programme) | Public investment | Public works and Relief together at half their Gold | 60 Influence, 6 a turn; the tax card's Gold netted out; +0.5 on the bond rate; they run three turns past the crisis | earned: +1 Happiness a settlement as celebration for the age and into the next, against a standing 1 Gold a settlement a turn; compromised: the charge without the Happiness for 10 turns; abandoned: the bond-rate rise stays 20 turns and the biggest fed build's city pays 1 Gold a turn into it for 10 turns |
| Bank regulation (Programme) | Financial reform | your credit limit -2 turns of income; the bond rate -0.5 net (the Programme's +0.5 is overridden, the card states the net) | 40 Influence, 4 a turn | earned: for the age, a Panic's rate rise and lender refusal halved for you; compromised: the credit limit cut without the protection for 20 turns |
| Lend-lease (Measure) | | aid to a civ at war with your enemy buys double goodwill; the bond market pays half of it | 10 Influence; the half you pay; the bond rate +0.5 for 20 turns; -5 relationship with that enemy | once per crisis |
| Foreign adventure (Programme) | War economy | a war against a major (or an independent power, if the probe passes) in force within 5 turns; while at war, 2 production a settlement a turn into each city building a military unit, and your upkeep paid by a bond loan that grows each turn | 30 Influence, 3 a turn; the tax card's Gold netted out; 10 grievances with every civilization you've met; while mobilised the trade-war weight counts you double and each trading partner -1 relationship every 5 turns | turns (no war by the deadline): -2 Happiness a settlement as celebration and bills +25% until one comes; earned: "Mobilised", the build bonus kept at peace against the same borrowed upkeep; compromised: the bond market at 1.25x for 20 turns; abandoned: the upkeep loan due over 10 turns |
| Self-sufficiency (Measure) | | High tariffs at no relationship cost and import bills halved for 20 turns | 10 Influence; each trading partner -1 relationship every 5 turns; the trade-war weight counts you double | your Trade buildings count a quarter less for the age |
| Off-book bills (Gamble) | | a bond loan of 4 turns of income, no payment for 10 turns | 20 Influence | a settlement taken in the window pays off what its own Gold yield would in 10 turns, no more; the rest due at 1.5x the bond rate per turn; inflation +0.5% a turn for the age either way |

The human takes Foreign adventure and then declares the war themselves through the game; the card's panel line
counts down the five turns. An AI that takes it declares the war with `forceDeclareWar` on a major it has met. A
script-declared war doesn't count as formal for the game's own requirements, so War Levy's at-war line doesn't
fire for an AI that went to war this way; the mod's own reads count it.

Eligibility, by what each card needs to act on: Merchant marine needs at least one route; Debt into shares and
Lottery loan need the bond market open to the civ; New Deal programmes need a build to feed; Lend-lease needs a met
civ at war with your enemy; Self-sufficiency needs a route to close; Foreign adventure needs a met major (or a
reachable independent) the civ can be at war with.

## 6. The probes, with the fallback for each

All in one lab game, scripted, every other mod off.

| Probe | The call to try | If it fails |
| --- | --- | --- |
| Influence stock | `Players.get(p).DiplomacyTreasury.diplomacyBalance` and the like, against the top bar's figure, before and after a charge | prices are charged only up to a stock the mod tracks itself from its own grants; or Influence prices become Gold prices |
| Influence below 0 | a charge larger than the stock: does the stock go negative or clamp | eligibility refuses any card whose price passes the stock |
| Production | `Stats.getNetYield(YIELD_PRODUCTION)` against the cities' sum | the cities' sum |
| War with an independent | `isAtWarWith(independentId)` while units fight one; `forceDeclareWar` on one by an AI | Foreign adventure asks for a war with a major only |
| A capture against a founding | a city moved by capture keeps its plot and changes owner in the batch's lists; a new city appears at a new plot with `originalOwner` equal to its owner | the War economy's objective drops the capture and asks for the war won by holding: the enemy's strength below half of the civ's at adjudication |
| The military build | a unit's hash resolves in `GameInfo.Units` with a military class | the bonus goes to every build in a city at war's front (all cities) at half the rate |

And the offline balance run: the model's runner with the slice's twelve cards on the grid of states, before any
UI. If a Programme doesn't shorten a Depression at the watched rates, its numbers change, not the rule.

## 7. What the lab can and can't test

The Autoplay seat can take a response through the request queue (watched, X.5) but can't slot or swap a card,
can't declare a war, and rarely reaches the later stages on its own. So the slice's lab games test: the AIs taking
every card on their own utility; the seat taking the Programmes by queue; the ledger, lifecycle, objectives and
legacies; reloads and the age change. The owner tests by hand: Foreign adventure on the human side (declaring the
war), the panel's read for a first-time player (acceptance criterion 5), and the policy screen with a card
netted out.

## 8. Rules settled

The fourth draft's rules stand, with these changes:

| Question | Rule |
| --- | --- |
| Happiness | celebration-meter movement priced in Happiness, stated as such; the game's settlement Happiness is untouched |
| The tax slot | not held; the slotted tax card's Gold is netted out by the batch while a Programme runs, for any civ |
| Trade cards | act on route count, bills, the bills' cap, credit and the bond market; never on the game's route Gold |
| A war obligation | met by the human through the game; by an AI through `forceDeclareWar`; read by `isAtWarWith` |
| A war's outcome | settlement ownership by plot, read from the batch; peace terms aren't read |
| The Panic | world-level; a card changes what a Panic does to one civ, never whether one starts |
| Atomicity | the batch's own write-then-grant with the lost-batch re-send; no per-transaction balance checks |
| Recurring obligations | one `lastSettledTurn` each |
| Ledger budget | open instances in full, adjudicated ones as one summary row, inside the 64 KB envelope |

## 9. Phases

| Phase | Work | State |
| --- | --- | --- |
| 0 | the six probes and the offline balance run | first |
| 1, 2 | the pill, header, milestone notices, history; the panel's response card; affinity tags and prices | approved |
| 3 | the engine as section 3 | approved with this draft's changes |
| 4 | the slice as section 5, on section 4's objectives | approved after phase 0 |
| 5 to 8 | balance grid and AI valuation, lab games, the rest of the catalog, the civilization layer and drift | after the slice passes the five acceptance criteria |

The rest of the catalog (the third draft's 7b) gets the same check when its phase comes: every card that names
"route income" moves onto route count or bills, every "Happiness" is celebration, every slot hold is a netted card.
Indulgences waits on a religion read.

## 10. What the owner decides

- Happiness as celebration movement, stated on the cards: acceptable, or should those cards change.
- The tax card's Gold netted out in place of holding the slot.
- Merchant marine on route count and the company's credit in place of route income.
- The War economy's objective on settlements taken and held, in place of peace terms.
- Foreign adventure against majors only, if the independent-power probe fails.
- The figures carried from the earlier drafts: Influence prices, the five-turn minimum, the drift cap.
