# A more robust AI: findings and plan (2026-10-31)

Status: approved for building in the stage order of 4.6 (owner, 2026-10-31); nothing built yet. Written after the
AI rules watch run (`verification-runs.md`, third run) and the owner's nine questions on it. Sections 1 to 3 are
facts, read from the game's data and watched in a lab game; 4 is the plan, with each change tied to the question it
answers. The owner's decisions are marked "Decided".

## 1. What the engine lets a mod read and do (watched 2026-10-31, Modern seed 4242, turns 1 and 13)

Read from a mod's script, for any player, AI or human, confirmed in a running game:

| What | Call | Seen |
| --- | --- | --- |
| An AI's agendas, by name and text | `Game.Diplomacy.getAgendaNames(pid)`, `getAgendaDescriptions(pid)` | Xerxes "Lord of Fire": likes leaders at war with others; Machiavelli "The Spider"; Alexander: likes the fewest conquered settlements; plus every leader's Ideologies agenda |
| Why a relationship is what it is | `Players.get(a).Diplomacy.getPlayerRelationshipHistory(b)` → `[{eventType, amount, triggeredBy}]`, names via `getFavorGrievanceEventTypeName` | an AI-to-AI pair at turn 13: shared government +10, leader agenda -10, trade route favor +10, agenda +2 |
| Relationship level, enum, alliance, war | `getRelationshipLevel(b)` (a number, -30 to 30), `getRelationshipEnum`, `hasAllied`, `isAtWarWith` | |
| Grievances and favors between two civs | `getNumGrievances(b)`, `getNumFavors(b)`; written with `changeNumGrievances`, `changeNumFavors`, `changeRelationshipLevel` | the mod already books grievances on repudiation; favors are the unused positive side |
| Trade between two civs | `Players.get(a).Trade.countPlayerTradeRoutesTo(b)`, `getPotentialRelationshipGainFromTradeRouteWith(b)` | 1 route Xerxes to Alexander at turn 13 |
| Distance | capitals via `Cities.getCapital().location`, `GameplayMap.getPlotDistance` | 12 to 36 plots between capitals |
| Military | `Stats.getMilitaryStrength()`, `getNumCombatUnits()`, `getNumLandUnits()`, `getNumNavalUnits()` | |
| Joint events (wars, alliances) | `Game.Diplomacy.getJointEvents(a, b, true)` | |
| AI production hook | `Players.AI.get(pid)`: `requestConstructible`, `requestUnit`, `clearRequest`, `scaleAiPreference(system, item, factor)` | `scaleAiPreference` takes three arguments and returns null; what it changes is unverified (section 4.6) |

Not there: anything that reads the AI's own strategy, budget, threat view or planned purchases.

What the engine's data says about AI Gold (compiled DB, every mod loaded):

- There's no table, parameter or pseudo-yield for a Gold reserve, a purchase budget or the treasury balance. `AiBudgets`
  is seven spending categories weighted per leader through `AiBudgetBiases`; `PseudoYields` has nothing for held Gold.
- Strategy conditions can read income per turn (`YieldIncome`) but never the balance or anything a mod writes. The mod
  already uses this: `STRATEGY_ECONOMICS_SHORT_OF_GOLD` (income under 10) and `STRATEGY_ECONOMICS_FLUSH` (over 40) in
  `data/econ-tax-cards.sql`, each steering a `YieldBiases` list.
- The one "save Gold" switch is `Strategies.SaveGoldForVictory`, used only by the Modern economic victory strategy.
- The engine values relationships in its own units: `PSEUDOYIELD_DIPLOMATIC_RELATIONSHIP 0.5` a point,
  `PSEUDOYIELD_DIPLOMATIC_ALLIANCE 150`. Relationship fades toward Neutral by 1 a turn when Friendly, 2 when Helpful,
  after a 5-turn delay (`DIPLOMACY_RELATIONSHIP_FADE_*`).
- Relationship events and their sizes are in `DiplomacyFavorsGrievancesEventsData`: a trade route +10, shared
  government +10, borders touching -10, declaring war -30, breaking an alliance -30, a close land claim -20.
- `EFFECT_PLAYER_ADD_YIELD_DEBT` is a one-off deduction used by narrative events ("loot the treasure": +Gold,
  -Happiness). Repeating it turn after turn is what `grantYield` already does from script. Neither changes what the AI
  reads: its purchases are gated by the balance, its strategies by income per turn.

The negative-balance wipe (probe P4): the roll adds income, then sets any balance still below 0 to 0 while income is
positive. It's the engine's bankruptcy rule and can't be switched off. The mod runs after the roll, so the balance it
sees is already positive; "short" has to be read from the mod's own books (section 4.3).

## 2. What the Ottomans' default did (watch run, turns 5 to 40)

- Turn 4: the probe emptied their treasury with income at -25 a turn. Turn 5: an emergency loan L6 of 97.65 Gold
  from Goryeo over 10 turns at 0.67% a turn.
- Payments of about 10 Gold a turn: paid at turn 6, missed at 7, 8 and 9 (`m` 1, 2, 3; the rate stepped up 1.25 times
  each miss, the kept interest was added to the debt, -5 Influence each). Turn 9: default.
- From turn 10 the garnish ran: 10% of the outstanding each turn, within half the Ottomans' income and the cash they
  had. 90.15 Gold outstanding at turn 9, 46 at 17, 12 at 30, 4.61 at 40, still open. The 10% rule tails off and the
  last few Gold take dozens of turns.
- Goryeo was blocked as a lender to the Ottomans for the age.
- Turn 10: Goryeo, the lender just defaulted on, sent the Ottomans 715 Gold of aid (the aid rule: a Friendly civ in
  default). The Ottomans' balance went 44 to 760; the garnish took 3 to 8 Gold a turn of it. Nothing nets aid against
  a debt the host owes the giver.

Two defects fall out: the garnish needs a floor (the greater of 10% and 1 Gold, and close under 1 Gold), and aid to a
civ that's in default to the giver should clear that debt first. Decided: both are fixes in stage A.

Decided, the order of penalties: walking away from a debt costs more reputation than failing to pay it. Default is
what happens to a civ; repudiation is what a civ does. In 4.4's numbers a repudiation costs 30 `creditRep`, books
grievances and a relationship hit with the lender, and blocks the lender for two ages; a default costs 20, blocks the
lender for one age and books neither grievances nor a relationship hit; a miss costs 5. The garnish stays with
default only (the lender still gets paid, slowly); repudiation writes the debt off.

## 3. Where the current AI rules are thin

- Borrowing when short with positive income can't happen (service limit, and the wipe; 4.3).
- Restructuring is a timer (`m = 2`), not a decision; 1 restructure against 235 defaults in the balance run.
- No early repayment for the AI.
- Repudiation of a civ by the AI has never fired outside unit tests (balance run: 77 repudiations, all of the bond
  market by insolvent civs).
- Investment and aid run on timers (once per 10 turns, once an age) and relationship level only.
- The native AI's spending can't see the mod's debts, so every rule is hedged with "only when flush".

## 4. The plan

Ordered so each stage stands on the one before. Each stage: unit tests, then one lab watch run against the items it
adds to `WATCH_LIST.md`.

### 4.1 Books first: distress read from the ledger, not the balance sign (questions 3, 2)

Add a per-civ distress reading before any payment runs: `dues` (every payment, dividend and settlement due this turn)
against `funds`. Short means `dues > funds`, whatever the sign of income. It replaces `projected < 0` as the trigger
for the AI's shortfall rule and for the human's guard.

A short civ with positive income gets a refinancing loan for the gap, 10 turns, judged by the credit cap alone (12
turns of income less what's outstanding, 4.2). The debt-service limit stays for every voluntary loan; a loan whose
purpose is to meet payments already inside the service figure is tested on total debt instead. The player's lend
offer is accepted on the same test, so lending to a short AI becomes possible. Over the credit cap, or insolvent: the
emergency loan as now.

Decided (2026-10-31, the owner): a loan's payment stays one number each turn. When a borrower can't cover it, it
pays what it has, and the shortfall joins the loan's principal at the penalty rate, the way a missed payment's
interest is capitalised today; next turn's payment is the same number as before, on a slightly bigger loan. A short
turn still counts as a miss (`m`, the rate step, Influence, standing), so restructuring, default at `m >= 3` and the
garnish keep working as they are. There's no arrears field and no carried line: the Loans tab keeps one line per
loan, and a short turn's notice reads "Paid 80 of 100. 20 added to the loan." with the restructure and refinance
choices under it. The same for the human and the AI. An earlier draft carried the shortfall as arrears collected
first the next turn; the owner found that too complicated for the player, and NOTES choice 3 now records the partial
payment instead.

### 4.2 Escrow: the native AI can't spend what's set aside (question 6)

Each turn, after payments, the mod holds back the next turn's dues (and, for a civ in distress, two turns') from the
borrower's treasury into an escrow account in the ledger; the payment is made from escrow. The AI's purchase decisions
read the balance, so the committed Gold is out of its reach; the human sees an "in escrow" line on the Treasury tab
and the same hold. Conservation (4.14) gets an escrow account; invariants check it nets to zero over a loan's life.

Built 2026-10-31 (stage B, NOTES choices 123 to 125): the account is `escrow`, the hold runs after the payments
within what the civ has left, distress lasts the turn and the next (so the two-turn hold bites the turn after, when
the income is in), debt-8 checks the books, and the Treasury tab shows the line.

This is the one lever that's certain. The second is now watched (4.7): `Players.AI.get(pid).scaleAiPreference(system,
item, factor)` changes what an AI builds and earns, in the direction of the arguments. Decided use, for an AI whose
debt service is above a tenth of its income, called each turn while that holds:

- `YieldBiases` `YIELD_GOLD` scaled up with the service share (1 + 10 × service / income, at most 5), so the AI's own
  city planning leans to Gold while it's paying debts, the way a player builds Gold when the payments bite;
- `AiBudgetBiases` `AI_BUDGET_STANDING_ARMY` and `AI_BUDGET_EXPANSION` scaled down to 1 / that factor while the AI is
  in distress (4.1), never below 0.25, and back to 1 the turn it clears. The factor is reset to 1 explicitly each turn
  it isn't needed, since the scale is assumed to persist.

The human's side of "knowing": the Treasury tab's escrow line, the distress notice (4.3) and the reserve reading.

A data strategy keyed on `YieldIncome` can't see the ledger; the two the mod has stay as they are.

A per-civ negative Gold yield equal to debt service (a tradition or hidden building) would put debt into the AI's
income reading, but the owner has ruled out standing hidden effects; listed for completeness, not proposed.

### 4.3 Restructuring and repayment as decisions (questions 2, 4)

For every borrower each turn, the distress read gives the next three turns' dues against projected funds. The AI then
picks the cheapest way through, in this order: pay; repay early when flush; a refinancing loan when short and the
rate is under its own bond rate; restructure the loan whose payment doesn't fit (`m` 0 to 2, once per loan) when
income is positive and no refinancing is offered; otherwise miss. The human gets the same read as a notice ("next
turn's payments of X won't fit; restructure, borrow, or let it miss") with the three choices on the Loans tab, and
restructuring opens at `m = 0` for both sides at the same standing cost as today.

Built 2026-10-31 (stage C, NOTES choices 126 to 128): the look-ahead, the ordered choice, restructuring from `m = 0`
for both sides, the AI's early repayment through `extras`, the human's notices (`short-ahead`, and `short` with the
reason when the guard is off or refused) and the reserve reading on the Loans tab.

Early repayment, the same mechanism the player uses (`extras` on the turn's payment): an AI with no distress and a
balance above its reserve (10 turns of income, or the next three turns of dues plus upkeep, whichever is more) puts
half the surplus into its dearest loan, never into one it's about to repudiate. Mirrors the player's "repay early,
any amount, no penalty". Decided: the same for both sides. The player still chooses the amount and the turn; the
Loans tab shows the same reserve reading ("you hold X above your reserve") so the player has the AI's own yardstick.

### 4.4 Credit reputation: a lender grudge and a world memory that can be repaired (question 5)

Today a repudiation books 10 to 40 grievances on the lender (the native AI acts on these), -3 relationship with each
witness, standing -0.3 for 40 turns, and blocks the lender this age and the next. Change:

- Lender: grievances as now, plus a direct relationship hit with the lender sized like the grudge (-10 to -30), so the
  lender's own stance moves at once, not only through grievances.
- World: a `creditRep` per civ in the ledger, 0 to 100, in place of the fixed 40-turn window. Repudiation -30 (-15 at
  war), default -20, miss -5, each with a 50-turn half-life; repaid in full +5, ten payments on time +2, a loan made or
  aid given +3, capped at 100. Rates and the credit cap read it where they read standing today. The native side: a
  loan repaid in full books `changeNumFavors` on the lender, so the engine's relationship remembers good conduct too.
Built 2026-10-31 (stage D, NOTES choices 129 to 132): the reputation rows with the half-life, the costs and the
climb-backs, the lender's own hit, favors on a loan repaid in full, the weighing with a strength read, and the
0.5.4 save's standing carried over as its opening reputation.

- The AI's repudiation becomes a weighing: what it keeps (outstanding to that lender, in turns of income) against what
  it pays (the grievance, war risk read from `getMilitaryStrength` of lender against borrower and whether the lender
  is a neighbour, and the credit it loses). It repudiates when the kept Gold is above 4 turns of income and the lender
  is at war with it, or Hostile and weaker, or it's insolvent and the lender isn't Friendly. Once per 20 turns, never
  a Friendly lender, as now. Citizens: the AI may repudiate them under the insolvent branch, the same as the player.

### 4.5 Stakes: investment, aid and lending from what the AI wants (questions 7, 8)

A `stake` score of one AI in another, from the native signals in section 1, read once a turn:

```
stake = relationship level / 3                     -10 to 10
      + 3 per trade route between them, at most 9
      + 6 if allied, + 4 if they share an enemy at war
      + 3 if capitals are within 20 plots (a neighbour worth keeping stable)
      + agenda rows toward the host in the relationship history / 2 (the AI's own likes, as the engine scores them)
      + 3 if the host's income is growing (a return worth having)
      - 6 if the host is Hostile or at war with the AI's ally
      - creditRep shortfall / 10 (a bad debtor)
```

- Invest when the AI can spare (balance above its reserve) and the best stake is 8 or more; size 3 to 8 turns of
  income with the stake; one open investment per host, no world timer. Form as now (general when the host grows,
  development loan otherwise). To the human, still an offer.
- Aid when a host with stake 10 or more is in default or Depression, or at war with the AI's enemy and short; sized to
  what buys it back to Friendly (the engine's +10 a trade route is the yardstick; the mod's aid gives up to +10
  relationship), within 5 turns of income, at most once per 15 turns per host. Aid to a host in default to the giver
  clears that debt first.
- Lend to a short civ when it isn't blocked, its `creditRep` is 50 or more, and the stake is 0 or more; cheaper by
  stake (Friendly already pays 0.8 of the base rate, 4.3).

Built 2026-10-31 (stage E, NOTES choices 133 to 135): the stake read per pair, investment and aid on it, the lending
gate, the timers gone (an offer to the player isn't repeated for 10 turns, and aid keeps its 15 turns per host).

Decided 2026-10-31 (the Friendly and Hostile edges): the game's own bands, not working numbers. The compiled DB's
`DiplomacyPlayerRelationships` rows give Hostile -30 to -2, Unfriendly -2 to -1, Neutral -1 to 1, Friendly 1 to 2 and
Helpful 2 to 30, in units of `DIPLOMACY_RELATIONSHIP_CHARACTERISTIC_SCALE` (30), so Neutral runs -30 to 30, Friendly
30 to 60 and Hostile sits under -60. The ninth run's readings fit (Neutral up to 30, Friendly from 31). The session
reads both edges once (`relationshipBands`), the aid buys the points past the Friendly line, and the stake's Hostile
test uses the band's top. The Hostile edge is unwatched: the lab's lowest reading was -15.

The agenda text itself isn't parsed: the engine already turns each agenda into relationship-history rows with a
`LEADER_AGENDA` type, and those carry the AI's like or dislike of each civ as a number.

Decided: investment and aid are built together in one stage (E), on one `stake` read, and the aid rule's "once an
age" goes.

### 4.6 Order of work and what each stage watches

| Stage | Builds | Watch |
| --- | --- | --- |
| A | 4.1 distress read, refinancing on the credit cap, lend acceptance; garnish floor; aid nets the giver's debt | a short positive-income AI takes a refinancing loan; the player's lend is accepted; a default closes |
| B | 4.2 escrow | an indebted AI's balance shows the hold; payments made from escrow; conservation holds |
| C | 4.3 decisions: restructure at `m = 0`, early repayment, the human's notice | an AI restructures before a miss; an AI repays a loan early; the notice shows |
| D | 4.4 credit reputation, lender relationship hit, favors, AI repudiation weighing | an AI repudiates an enemy's loan; `creditRep` falls and climbs back |
| E | 4.5 stakes | investment and aid follow trade partners and allies, not the clock |
| F | `scaleAiPreference` A/B lab test | Gold yield and purchases of a scaled AI against a control |

Stages A to E are approved (2026-10-31). The reserve size, stake weights and `creditRep` costs above are the working
numbers; the balance run (DESIGN section 10) re-checks them after stage E. Stage F's test ran on 2026-10-31 (4.7), so
F becomes a build: the scaling in 4.2, inside stage B with escrow.

### 4.7 The `scaleAiPreference` test (watched 2026-10-31)

Two 30-turn drives of the same seeded game (Modern, seed 4242, `--setup fast --quick`, the usual mod set), sampled
every turn. Treated run: each turn, AI 1 `("AiBudgetBiases", "AI_BUDGET_STANDING_ARMY", 50)`, AI 2 `("YieldBiases",
"YIELD_GOLD", 50)`, AI 3 `("PseudoYieldBiases", "PSEUDOYIELD_STANDING_ARMY_UNIT", 50)`; AIs 4 and 5 untouched.
Control run: no calls. Every call returned null, including one with a made-up system name, so the return value says
nothing.

| AI | Treatment | Combat units t30, treated / control | Gold income t30 | Balance t30 |
| --- | --- | --- | --- | --- |
| 1 | army budget x50 | 23 / 21 | 210 / 263 | 415 / 392 |
| 2 | Gold yield bias x50 | 18 / 18 | 204 / 105 | 2372 / 556 |
| 3 | standing-army pseudo-yield x50 | 20 / 18 | 138 / 146 | 178 / 1408 |
| 4 | none | 17 / 17 | 183 / 183 | 886 / 698 |
| 5 | none | 17 / 17 | 143 / 148 | 422 / 549 |

The two untreated AIs stayed in step across the runs (identical readings at turns 3 to 5, the same unit counts and
income at turn 30). The two army treatments ended with more units and the Gold treatment with double the income and
four times the treasury; AI 1 was already 879 Gold apart at turn 2 and queued a Frigate and Cuirassiers where the
control built a Museum, a Port and a Wonder. One replicate, so the size of the effect is unmeasured; the direction is
consistent across the three treatments and absent from the controls. Readings: `~/.tower-bench/runs/2026-10-31T14-04-19`
(treated) and `2026-10-31T14-09-18` (control); the sample scripts and both drive logs are under
`mod_ideas_tested/economics/devtools/` (`econ-ai-pref-ab-sample.js`, `econ-ai-pref-ab-control.js`,
`probe-runs/2026-10-31-ai-pref-ab/`), with the API probes (`econ-api-probe.js`, `econ-api-probe2.js`) that confirmed
section 1.
