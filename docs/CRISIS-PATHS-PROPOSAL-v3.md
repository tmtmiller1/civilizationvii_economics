# Crisis paths, third draft (2026-11-02, nothing built)

Supersedes `CRISIS-PATHS-PROPOSAL-v2.md`. The second draft got the shape right: economic conditions lead to a
political response, the response has consequences, the consequences change the institutions, and the institutions
change the next choice. Its review passed the direction and the first two phases and asked for seven fixes before
the engine is written: judge a path by what it set out to do rather than by a 0.95 gate; type the effects so
they compose, cap and never fire twice; close the windfalls in five of the slice's cards; balance by situation
rather than by tier bands; cap and let the player reverse institutional drift; give a Programme a proper
lifecycle; make the AI forecast conservatively and decide the same way after a reload. This draft makes those
changes and keeps everything else.

## 1. What stays

- The crisis is a political decision, not a Gold payment. Each government and ideology has instruments the
  others don't.
- Relief now against consequences later, and the two pull against each other.
- The choice is visible everywhere: pill, header, turn notice, crisis panel, history.
- History as ingredients, not a script. Names are plain words for what a card does; a dictatorship's slogans and
  programme names stay out; programmes a democracy is remembered well for keep theirs; the Civilopedia separates
  the history from the abstraction and says what the game leaves out.
- Governments and ideologies are asymmetric, not fated (the table in the second draft's section 6 stands).
  Fascism is structurally dependent on isolation and expansion; nothing says "poorer by the late game".
- A declarative engine, a four-path vertical slice first, the rest of the catalog later, civilizations as a
  trait layer, institutional drift as the long game.

## 2. What the player sees

The crisis panel on the World tab, top to bottom:

1. The crisis: kind, age, the turn it began, its causes, the index with next turn's forecast if nothing changes.
2. Your response, if one runs: name, tier word, one line of what it does now, one line of what it costs each turn,
   its commitments, its lifecycle state in a word (Active, Sustained, Resolving), and End it with the cost of
   ending stated in the confirmation.
3. Your path, if one is open: name, three pips (Commit, Sustain, Objective), the objective in one sentence with
   its progress ("Bond debt down 11 of the 20 percent the reform asks"), what the institution would be, what a
   compromised or abandoned path leaves instead, and "Provisional" while the outcome still depends on turns to
   come.
4. What you can do: government-exclusive cards first under "Theocracy only", then the shared cards; each with
   tier, Now, Price, It leaves, and where they apply the tags "Institutional advantage" or "Political opposition"
   with a one-sentence tooltip.

Outside the panel: the phase pill reads "Depression · New Deal programmes"; the header reads "Market economy ·
Depression · New Deal programmes"; the turn notice carries one short line only on a milestone turn (taken,
sustained, objective met or missed, ended, legacy earned, compromised or lost), and nothing on the turns between;
the Treasury history keeps the full account turn by turn.

## 3. The response engine

A card is data read by one engine. The second draft's schema stands with two additions: effects are typed, and
every effect that moves money or writes a loan is a transaction with an id.

```
{ id, name, tier, owners, eligibility: { kinds, ages, stage?, needs?, conditions? },
  activation: { influence, gold?, once }, 
  effects: [ { type, lever, amount, scope, until, id } ... ],
  commitments: [ { kind, amount?, until } ... ],          // default commitments by tier, each overridable
  path?: { id, objective: { measure, target } },
  turns?: { when, value, effects } }
```

### 3a. Typed effects and how they compose

| Type | Rule | Examples |
| --- | --- | --- |
| additive | sum, within a floor and a ceiling set per lever | Happiness a settlement (floor -6, cap +6), flat Gold a settlement |
| multiplicative | factors multiply, the product capped per lever (route income 0.5 to 1.5, bills 0.5 to 1.5, build progress 1.0 to 1.5) | route income, bills, production from a take |
| exclusive | one holder per slot; a second claimant is refused at eligibility, not stacked | the tax slot, a civ's tariff stance |
| override | one named effect wins by precedence, the others pause and resume after | a price freeze over ordinary price moves; a bank holiday over payments |
| transaction | applied once under its id, recorded in the ledger, never replayed; a reload finds the id and skips | a loan issued, a write-off, a Gold transfer between civs |
| obligation | tracked and enforced by the batch each turn; a breach is an event | Influence a turn, a loan schedule, "war within 5 turns" |
| conditional | active only while its condition reads true each batch | wartime production while at war; the Grain campaign's floor while prices are above it |

Rules written once: precedence among overrides by a number in the row; a lever's floor and ceiling in one table;
a refreshed card (the same id taken again) extends its `until`, never doubles; expiry per effect (turns, the
crisis, the age, into the next age, the game); commitments and path state live in the ledger, carry across the
age change with the legacies, and survive a reload because transactions are idempotent by id and obligations are
re-read from the ledger, not from closures.

### 3b. The Programme lifecycle

```
Active -> Sustained -> Resolving -> Earned | Compromised
   \-> Abandoned (End it, or an obligation breached)
```

- Active: taken; the Commit pip lights; the default commitments (Influence a turn, the tax slot, +0.5 on the bond
  rate) start unless the row overrides one, and the row says so on the card.
- Sustained: five turns run with every obligation met; the Sustain pip lights.
- Resolving: the crisis has ended, or the Programme's own run has; the objective is measured; the outcome is
  provisional and the panel says so until both have ended.
- Earned: sustained and the objective met. Compromised: sustained, the objective partly met or missed. Abandoned:
  ended early or an obligation breached; the engine stops the effects and writes the abandoned legacy.
- Nothing already built is taken back. An abandoned public-investment path leaves the fed builds where they are
  and charges the unfinished works instead: the bond-rate rise stays 20 turns and the settlement with the
  biggest fed build pays 1 Gold a turn into it for 10 turns.

## 4. Paths: the objective is the path's own, the index is context

The 0.95 gate goes. A path is judged on what it set out to do, measured on the levers it touched, and the index
only colours the result:

| Path | Objective (measured at Resolving) | Earned | Compromised |
| --- | --- | --- | --- |
| Citizens' republic | the citizens' loan repaid on schedule and the meter at or above where it stood at Commit | both | one of the two |
| Company state | route income at Resolving above its level at Commit by 15% and no bill waived for a shortfall during the run | both | one of the two |
| Public investment | every build the Programme fed finished or still building, and Relief never ended early | both | one of the two |
| Financial reform | bond debt owed down 20% from Commit and no default on your loans during the run | both | one of the two |
| War economy | the war the commitment asked for declared in time, and at Resolving either a settlement held or peace on your terms; no obligation breached | both | one of the two |

The index enters twice: a path resolved with the civ's own index under 0.80 is capped at Compromised whatever
its objective (an institution founded in the ruins), and a path that provably caused its own prolongation (the
causes list naming the civ's austerity or tariffs under 0.80) fails the objective. A civ can earn an institution
in a crisis it didn't end, and can end a crisis without earning one; both are historical.

### 4a. Institutional drift, bounded and reversible

Each earned legacy moves two affinities, each capped: the Influence price of the paths the civ keeps earning
falls one step (5%), to a floor of -15%; the price of paths it never takes rises one step, to a ceiling of +15%.
Any earned path of another kind moves the neglected one back a step, so the drift reverses through play. Two
things are tracked apart: familiarity (the price steps above) and dependence (a legacy's own standing cost, such
as the creditors' claim a Company state carries), so a merchant republic can be fluent in finance without being
owned by it, or the reverse. The Fiscal tab's "How your crises have shaped you" names both.

## 5. Balance: situational, not banded

The tier bands go. Every card is scored on the 20-turn ledger across a grid of states: Gold reserves low and
high, Influence low and high, a shallow and a deep crisis, a short and a long one, trade exposed and sheltered.
The objective is that no card is best in every cell and each tier owns some cells: Measures in short shallow
crises and low Influence, Programmes in deep long ones with Influence to spend, Gambles where the player can
meet the condition and can't afford the Programme. Gambles offer the greater upside and downside, with an
expectation that depends on the cell and on whether the condition can be met, not a higher expectation by rule.
The ledger prices Gold, Influence, Happiness, production, trade income and loan costs by the cell they're in (a
Gold in a liquidity crisis is worth more than one in a boom), and the same valuation feeds the AI (section 7).

## 6. The slice, with the five windfalls closed

Four paths, unchanged in choice, the risky cards reworked.

| Card | Change | Now reads |
| --- | --- | --- |
| Liturgies | citizen capital isn't free | citizens lend 3 turns of income at 0% over 10 turns; while the loan stands your citizens' consumption shows as -1 Happiness a settlement and their ordinary loan cap is halved; the Programme's obligations are its payments |
| Merchant marine | needs trade and costs to run | +25% on route income from routes that existed at Commit (new ones join after 5 turns), an operating charge of 1 Gold a route a turn, bills unchanged; the legacy's +10% applies to the same qualifying routes, multiplicative within the route-income cap |
| Debt into shares | debt for a claim, not a discount | a fifth of bond debt written off (a transaction), and the company holds a claim: 10% of route income to the bond market for the age, and no tariff above Low while the claim stands |
| Bank regulation | no immunity | leverage capped: your bond rate -0.5 for its run, credit limit -2 turns; a Panic from your own leverage is half as likely to start and half as deep (its leverage threshold +0.4 and its rate rise halved) for the age if earned; its default commitments apply (the slot and +0.5 are overridden by its own rate effect, stated on the card) |
| Off-book bills | conquest pays a bounded part | a bond loan of 4 turns of income with no payment for 10 turns; a settlement taken in the window pays off what its own income would in 10 turns, no more; the rest comes due at 1.5x; inflation +0.5% a turn for the age either way |
| Foreign adventure | upkeep borrowed, not erased | commit to a war within 5 turns; while at war your military builds gain 2 points a settlement a turn and your upkeep is paid by a bond loan that grows each turn (a transaction a turn, one id per turn) at the bond rate; civilian route income -25% while mobilised; the objective is a settlement held or peace on your terms; the Mobilised legacy keeps the build bonus at peace only against the same borrowed upkeep, so standing still deepens the debt |

The rest of the slice (Land reform, The assembly speaks, Lottery loan, New Deal programmes, Lend-lease,
Self-sufficiency) stands as the second draft wrote it, with the default commitments stated on each Programme's
card and eligibility tightened: New Deal programmes need a build to feed and a settlement short of Happiness;
Lend-lease needs a met civ at war with your enemy; Self-sufficiency needs routes to close.

## 7. The AI

The AI scores each open card with the same ledger the balance uses, so the terms share one scale: every term is
Gold-equivalent in the civ's current cell. Affinity is a weight on the recovery and strategic terms by government
and ideology, separate from competence. Three rules on top: a minimum utility below which the AI takes nothing; a
reserve, so a Programme is taken only if the civ's Influence and Gold, projected on 80% of its current income
over the Programme's minimum run, cover its obligations with a margin; and a per-civ jitter seeded from the game
seed and the civ id, so a reload reproduces the pick. An AI with a war already running, an empty treasury or a
threatened capital scores Foreign adventure below the threshold and leaves it; a Fascist AI at peace with Influence
and a weak neighbour scores it high. No ideology is an AI handicap.

## 8. Rules settled

| Question | Rule |
| --- | --- |
| Paths per owner | the slice builds one or two per owner; the content target is two or three; the panel never implies more than exist |
| Default Programme commitments | Influence a turn, the tax slot, +0.5 on the bond rate; a row overrides any of them and the card says which |
| Outcome timing | provisional at Resolving until both the crisis and the Programme's run have ended |
| Retroactive losses | none; abandonment charges the unfinished works and keeps the rate rise |
| Notices | one line on milestone turns only; the history carries the rest |
| Eligibility | kind, age, stage, `needs` (something to act on) and `conditions` (the crisis's causes or the civ's state the card answers) |
| Stacking | by effect type (3a); never by "same lever adds" alone |
| Transactions on reload | by id, never replayed |
| Fascism's war cards | obligations with a turning line, scored like any other, never automatic |
| Civilization content | a trait layer (price steps, a renamed card, one number) over the government and ideology cards |

## 9. Acceptance criteria for the slice

1. Choice: across the balance grid, each of the slice's cards is the best pick in some cells and none in all.
2. Causality: a tester reading the panel can say which lever a response moved and why the index followed.
3. Persistence: obligations, path state, provisional outcomes and legacies survive a reload, a government change
   and the age change, with automated tests on the ledger for each, before any card beyond the slice is written.
4. AI: an AI declines an unaffordable or counterproductive card and still shows its government's preference over
   a season of crises.
5. Comprehension: the five things on a card (now, price, obligations, objective, what it leaves) are understood
   from the panel alone by someone who hasn't read the Civilopedia.

## 10. Risk and phases

| Component | Risk | Why |
| --- | --- | --- |
| Visibility and history | low | existing UI and ledger rows |
| Affinity pricing | low to medium | precedence and one cost calculation |
| Response engine | high | typed composition, transactions, expiry, persistence |
| Lifecycle and milestones | medium | a clear state machine with edge cases |
| Civilization layer | low to medium | data layering once the engine stands |
| AI valuation | medium to high | one scale across systems, reserves, seeded jitter |
| Institutional drift | medium | simple to code, hard to balance |
| War-dependent Programmes | high | the independent-war read, capture validation, event reliability |

| Phase | Work | Gate |
| --- | --- | --- |
| 1 | pill, header, milestone notices, history; the panel's response card and lifecycle word | approved |
| 2 | affinity tags and prices on the shared cards | approved |
| 3 | the engine: typed effects, transactions by id, obligations, lifecycle, persistence; its tests | after this draft's contracts are agreed |
| 4 | the slice's four paths with objectives and legacies; the panel's path pips | after 3 |
| 5 | the balance grid and the AI valuation on the slice | after 4 |
| 6 | a lab game per age on the slice; the acceptance criteria | after 5 |
| 7 | the rest of the catalog, in forks, only once the schema, effect contracts and test fixtures are frozen | after 6 |
| 8 | the civilization layer, drift, the Civilopedia pages | after 7 |

The probes before phase 3 stand from the second draft: the independent-power war read, captures from
independents in the capture events, the Influence stock read, and an offline balance run showing a Programme
shortens a Depression at all. Estimates are planning figures: two to three days for phases 1 and 2, a week each
for 3 and 4, a week for 5 and 6 together, two weeks for 7, a week for 8.

## 11. What the owner decides

- This draft's contracts (3a, 3b, 4) as the engine's spec.
- The slice's four paths and the reworked cards in section 6.
- The drift cap (15%) and step (5%).
- The Influence figures and the five-turn minimum.
- Constitutional Monarchy sharing the Elective Republic's paths.
