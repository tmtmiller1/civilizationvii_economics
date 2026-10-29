# Economics: model notes

Status: engine-free model built 2026-10-06 and brought up to the revised design on 2026-10-29, tested offline under
Node (`npm run verify`, 172 tests). No game launched, no probe run; every engine-facing number here is still behind
DESIGN section 10. This file records where DESIGN left a choice open, the choice the model makes, and the test that
pins it. Test names are quoted; files are under `../tests/`. The 2026-10-24 revision settled or replaced some of the
2026-10-06 choices; those rows say so, with the DESIGN section that now holds the rule.

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

## Balance run and mutation

- The 1.0 balance rows ran 2026-10-29 in `../tests/econ-balance.test.mjs` (20 seeded 12-civ 500-turn games, On against
  Off); the numbers are in DESIGN 10's dated note and `../reports/balance-1.0.json`.
- Mutation (Stryker, `npm run mutation`, 2026-10-29, 631 mutants, house bar high 75 / low 60): `econ-conservation.js`
  98.6 (70 of 71 killed), `econ-credit.js` 97.3 (109 of 112), `econ-payments.js` 90.9 (90 of 99), `econ-plan.js` 78.2
  (273 of 349). The survivors in `econ-plan.js` are mostly event and notice field values and the order of equivalent
  branches; `../reports/mutation/mutation.json` lists each.

## Not done here

- Engine glue: reading balances, income, relations, stages and buildings; `grantYield`, `changeNumGrievances` and
  `changeRelationshipLevel` calls behind `Players.get(pid)?.isAlive`; the screens and notifications.
- P16 (whether the grudge ends in war) can't be modelled offline; the simulation counts repudiations and reads the
  repudiator's later rates only.
