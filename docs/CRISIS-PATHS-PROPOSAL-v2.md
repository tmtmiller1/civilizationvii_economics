# Crisis paths, second draft (2026-11-02, nothing built)

Supersedes `CRISIS-PATHS-PROPOSAL.md`. The first draft answered the owner's asks one at a time: show the chosen
responses, give each government and ideology its own cards, make every card a hard choice, make the tiers climb,
make the ideologies unequal, make Fascism want a war, keep the names decent. A review of that draft found the
right fault: it knew how each civilization's story ends. Three ideologies with fixed trajectories, legacies handed
out for playing two cards, tiers defined by a flat index bonus, 39 cards that mostly push the same number under
different names, an AI scripted to self-harm. This draft keeps the four things worth keeping and rebuilds the rest
so that outcomes come from conditions, choices and consequences.

## 1. What stays

- The crisis is a political decision, not a Gold payment. Each government and ideology has instruments the
  others don't, so a Theocracy and a Plutocracy in the same Depression have different ways out.
- Relief now against consequences later. A response does something within five turns and leaves something that
  lasts, and the two pull against each other.
- The choice is visible everywhere: the pill, the header, the turn notice, the crisis panel. A running response
  is a commitment the player can see, not a modifier in a tooltip.
- History as ingredients, not a script. The cards are recognisable (indulgences, tax farming, public bonds, debt
  repudiation) and work as general instruments; the Civilopedia tells the history in its own voice and says where
  the game abstracts it.

## 2. What the player sees

The crisis panel on the World tab, top to bottom:

1. The crisis: its kind, the age, the turn it began, what started it (the causes list the mod already draws), and
   the index with the mod's own forecast of where it goes next turn if nothing changes.
2. Your response, if one runs: its name, its tier as a word (Measure, Programme, Gamble), one line of what it does
   now, one line of what it costs each turn, and the commitments it holds (Influence a turn, the tax slot, a loan
   schedule). End it sits beside it, with what ending early costs stated in the confirmation.
3. Your path, if a Programme or a committed sequence has started one: the path's name, its milestones as three
   pips with the current one lit (Commit, Sustain, Recover), one line on what the legacy would be and one on what a
   failed or abandoned path leaves instead.
4. What you can do: the cards, grouped. Government-exclusive cards first under a line naming the government
   ("Theocracy only"), then the shared cards. Each card shows its tier, Now, Price, It leaves, and one of two tags
   where they apply: "Institutional advantage" (your government's own instrument, or a shared card it does well)
   or "Political opposition" (a shared card your government takes at a higher Influence price). The tag's tooltip
   says why in a sentence.

Outside the panel: the phase pill reads "Depression · New Deal programmes" while a response runs and the screen's
header line reads "Market economy · Depression · New Deal programmes"; the turn notice says "New Deal programmes,
turn 3: 48 Gold into your builds, 6 Influence" each turn it runs; the Treasury history keeps the full record
(taken, milestone reached, ended, legacy earned or lost).

Wording: "Institutional advantage", "Political opposition", "Government-exclusive". The first draft's "Your way"
and "Against your grain" go.

## 3. The response engine

A card is data, not a script. One declarative row per response, read by one engine that already has every lever:

```
{ id, name, tier, owners: ["GOVERNMENT_THEOCRACY"] | ["IDEOLOGY_DEMOCRACY"] | null (shared),
  eligibility: { kinds: [...], ages: [...], stage?, needs?: ["taxSlot", "bondLoans", "routes", "metCivs", ...] },
  activation: { influence, gold?, once: "crisis" | "age" | "game" },
  effects: [ { lever, amount, scope, turns | "crisis" | "age" } ... ],
  commitments: [ { kind: "influencePerTurn" | "taxSlot" | "bondRate" | "loanSchedule" | "warWithin", ... } ],
  path?: { id, milestone: "commit" | "sustain" | "recover" },
  turns?: { when: "indexUnder" | "noWarBy" | "noCaptureBy", value, effects: [...] } }
```

The levers are the ones the mod drives today and the 2026-11-02 runs watched: Gold grants, the celebration meter
(Happiness), the loan ledger (schedules, rates, write-offs, who's closed to whom), trade bills and route income,
tariffs, prices by class, build progress, relationships and grievances, Influence, legacies, and the index for
confidence effects only. `needs` keeps a card off the menu when it would do nothing: no bond loans, no Bank
regulation; no routes, no Guild cartel; no met civilizations, no Royal gifts.

Rules the engine owns, written once:

- Stacking: effects on the same lever add; a second copy of the same card refreshes its turns rather than
  doubling. Precedence: a card's own turning line overrides its legacy.
- Expiry: by turns, by the crisis's end, by the age's end, or by the game's end, per effect, never per ideology.
- A crisis that ends mid-Programme: the Programme runs on to its minimum (five turns) and then ends; its Recover
  milestone is judged at the crisis's end, not the Programme's.
- A government or ideology change: a running card keeps running; the path's identity is locked at Commit, so
  the new government's cards join the menu but the open path stays the old one until it completes or fails.
- Reload and age change: commitments and path state live in the ledger like responses and legacies do today, and
  the age-change pass carries them the way it carries legacies with `nextAge`.
- The AI evaluates the whole cost of a Programme (Influence over its run, the slot, the rate) before taking it.

Custom code stays for the handful that need it: a war declared by an AI, a repudiation, a transfer between civs.

## 4. Tiers by role, balanced on one benchmark

The flat +0.01 / +0.03 / +0.05 goes. A tier says what kind of thing a card is; its numbers come from its mechanism.

| Tier | Role | Advantage | Limit |
| --- | --- | --- | --- |
| Measure | relief now | cheap in Influence (10), targeted, quick | small and temporary; its price lands on the people or the treasury within five turns |
| Programme | structural | sustained recovery through the systems that make the index move, and the only way onto a path | 40 to 60 Influence, 4 to 6 a turn, the tax slot, +0.5 on the bond rate, a five-turn minimum; ended early it leaves the compromised legacy |
| Gamble | emergency | big payoff with little preparation (20 Influence) | conditional: a turning line tied to the index, a war or a capture, and a bad legacy when it turns |

Every card is scored on a 20-turn ledger before it ships: Gold in and out, Influence, Happiness as celebration
points, production from build progress, trade income moved, loan costs moved, and for a Gamble the turning
probability from the balance runs. Measures land near a fixed value, Programmes above it when they complete and
below it when abandoned, Gambles above it in expectation but with the widest spread. A card that scores above its
tier's band gets its price raised, not its story changed.

The index moves because the systems it reads moved: public works and relief are already cycle events, income
growth is already a cause, credit growth already weighs. Direct index effects stay only for confidence policies
(Confidence, The assembly speaks) and are small.

## 5. Paths, milestones and legacies

A legacy is earned by a path, not a card count. Each government and ideology has two or three paths; a path has
three milestones:

- Commit: a Programme of the path taken (the path locks to this government).
- Sustain: the Programme has run its minimum and its commitments were met every turn (Influence paid, the slot
  held, the payments made).
- Recover: at the crisis's end the index is at or above 0.95 and the path's own condition holds (the banking path
  wants no default on your loans during the crisis; the public-investment path wants the builds it fed finished
  or still building; the expansion path wants the war it needed won or at peace on your terms).

The outcome is one of three legacies, each a row on the Fiscal tab with its own duration:

- Earned: the institution. Different paths give different institutions, so two Democracies can come out of the
  same Depression with a regulated banking system (lower bond rate, lower credit limit) or a welfare state
  (Happiness and a standing Gold charge a settlement).
- Compromised: the Programme ran but Recover failed. The institution with a flaw: the regulated bank that also
  lost the bond market for a time, the welfare state nobody can pay for (the charge without the Happiness for
  10 turns).
- Failed: the Programme was ended early. Debt and unfinished works: the Programme's bond-rate rise stays 20 turns,
  the fed builds lose their last ten turns of progress, the Influence is gone.

Second-order rules: one open path at a time; a Measure or a Gamble of the same government counts toward Sustain
only as "kept faith" (it doesn't speed a path, it can't replace the Programme); a short crisis that ends before
Sustain gives Compromised, never Earned, so a player can't ride a two-turn blip into an institution; a crisis
deliberately prolonged (the index held under 0.80 by the player's own austerity or tariffs) is read by the
causes list and the Recover condition fails on it.

### 5a. Institutional drift

Paths leave more than a line. Each earned legacy also moves two affinities for the rest of the game: the
Influence price of the paths the civ keeps choosing falls a step, and the price of the paths it never takes rises
a step. A Republic that answers every crisis with executive finance ends up with cheap Programmes of that kind and
dear ones of the others; a Monarchy that leans on merchant creditors finds mercantile instruments cheap and its
own crown measures dear. The drift shows on the Fiscal tab as "How your crises have shaped you" with the two
affinities named. The game's own government isn't changed; the mod's affinities and legacies carry the story,
and a civilization's trait layer (section 7) starts the drift from somewhere.

## 6. Governments and ideologies: asymmetric, not fated

Each government or ideology gets a comparative advantage, a structural vulnerability and a circumstance in which
it shines. Nothing in the rules makes one win or lose; the levers do, under the conditions the game produces.

| Owner | Advantage | Vulnerability | Shines when |
| --- | --- | --- | --- |
| Despotism | extraction from its own settlements, the capital's works | Happiness, a court that costs more each time | few settlements, a capital worth building |
| Classical Republic | its citizens as lenders, Confidence that works | the great families (credit caps), the assembly turning | a rich citizenry and a short crisis |
| Oligarchy | the tax farmers' Gold, cartel prices | tax income sold off, partners' ill will | many routes, Gold-rich partners |
| Feudal Monarchy | labour instead of coin, warehouses that cushion | War Levy and army finance, slow Gold | many settlements, a long slump |
| Theocracy | the temples' credit, Gold from the faithful | other faiths' relationships, the temples closed by a Jubilee | one religion dominant among its neighbours |
| Plutocracy | the bond market, route income, debt into equity | bond-market memory, service limits | deep credit, many routes |
| Revolutionary Authoritarianism | requisition, price control | inflation, monarchies' enmity | a short war-time crisis |
| Authoritarianism | bond conversion, labour battalions, wage discipline | lenders' memory, consumption | a producer economy with foreign lenders |
| Bureaucratic Monarchy | monopoly prices, granaries | world prices, routes | a resource class it dominates |
| Elective Republic, Constitutional Monarchy | public bonds, reconstruction lending | retaliation, defaults it carries | a people with Gold and partners in trouble |
| Democracy | credible finance, sustained domestic demand | coordination cost (Influence), fiscal burden carried forward | mature credit and no war |
| Communism | directed investment, mobilisation | allocation: shortages in what the plan starves, rigid once begun | the plan's inputs on hand and builds that matter |
| Fascism | forced mobilisation, emergency extraction, wartime production | trade isolation, financial instability, dependence on expansion | conquest that keeps paying for itself |

The owner's direction that Fascism should be worse holds as a structural fact, not a verdict: its instruments
depend on isolation and expansion, so a Fascist civ that keeps conquering and keeps its routes short does well,
and one that stops expanding finds its war economy charging it (upkeep without conquest, a bond market that
remembers, routes that don't come back). That is the historical shape without a rule that says "poorer by the
late game". A Communist civ's shortages are modelled as price rises for it in the classes its plan starves and a
Happiness charge, not as a flat Happiness debt; a Democracy's fiscal burden is a standing charge its next crisis
has to carry, not a guaranteed good ending.

## 7. The catalog: a vertical slice first, the rest designed

Phase 4 builds four paths in full, one per age plus the ideological contrast, and the rest of the catalog ships
as names with mechanisms once the slice has been watched. Card counts vary by owner; the three-each rule goes.

### 7a. The slice

Classical Republic (Antiquity), path "The citizens' republic"

| Card | Tier | Mechanism | Price | Leaves |
| --- | --- | --- | --- | --- |
| Liturgies | Programme | citizens' loan of 3 turns of income at 0% over 10 turns; the meter's interest gain pauses | 40 Influence, 4 a turn, the tax slot | earned: "The liturgy": citizens' loan cap +50% for the age; compromised: cap unchanged, their rate +0.25 for 20 turns; failed: citizens closed 20 turns |
| Land reform | Measure | +4 Happiness a settlement 10 turns; -2 Gold a settlement a turn 10 turns; citizens' cap halves 20 turns | 10 Influence | once per age |
| The assembly speaks | Gamble | Confidence doubled (+0.02) | 20 Influence | turns under 0.90 at five turns: -4 Happiness a settlement 5 turns |

Plutocracy (Exploration), path "The company state"

| Card | Tier | Mechanism | Price | Leaves |
| --- | --- | --- | --- | --- |
| Merchant marine | Programme | route income +25% for its run; bills to partners -10% | 50 Influence, 5 a turn, the slot, bond +0.5 | earned: route income +10% for the age; compromised: the +10% and bills +10% for the age; failed: routes lose 10 turns of income |
| Debt into shares | Gamble | a fifth of bond debt written off; bills +10% 20 turns | 20 Influence | turns: the bond market at 1.5x for the age; otherwise 1.25x for 20 turns |
| Lottery loan | Gamble | bond loan of 4 turns of income at half rate over 5 turns | 20 Influence | turns: the rate doubles for what's left |

Democracy (Modern), two paths, "Financial reform" and "Public investment"

| Card | Tier | Mechanism | Price | Leaves |
| --- | --- | --- | --- | --- |
| New Deal programmes | Programme (Public investment) | Public works and Relief at half Gold; the index's public-works cause as today | 60 Influence, 6 a turn, the slot, bond +0.5 | earned: "Recovery institutions": +1 Happiness a settlement for the age and a standing charge of 1 Gold a settlement a turn into the next; compromised: the charge without the Happiness 10 turns; failed: bond +0.5 for 20 turns, fed builds lose 10 turns |
| Bank regulation | Programme (Financial reform) | your leverage capped: bond rate -0.5 for its run, credit limit -2 turns, your AIs' build loans refused | 40 Influence, 4 a turn | earned: "The regulated bank": rate -0.5 and limit -2 for the age, no Panic from your leverage; compromised: the limit without the rate; failed: nothing, the Influence gone |
| Lend-lease | Measure | aid to civs at war with your enemies buys double goodwill, the bond market pays half | 10 Influence | bond +0.5 for 20 turns; -5 relationship with their enemies |

Fascism (Modern), path "The war economy"

| Card | Tier | Mechanism | Price | Leaves |
| --- | --- | --- | --- | --- |
| Foreign adventure | Programme | commit to a war on an independent power or a civilization within 5 turns; while at war your builds gain 2 points a settlement a turn and your upkeep's Gold is charged to the bond market; Public works as a cause while the war runs | 30 Influence, 3 a turn, the slot | turns (no war in 5 turns): bills +25% and -2 Happiness a settlement until one comes; earned (peace on your terms with a settlement taken): the works; compromised (peace without one): the bond market at 1.25x for 20 turns; failed: the charge stays 20 turns. Legacy "Mobilised": the Programme's build bonus continues at peace only against the same Gold charge, so standing still costs |
| Self-sufficiency | Measure | High tariffs at no relationship cost, import bills halved 20 turns; route income halved 20 turns | 10 Influence | trade buildings count a quarter less for the age |
| Off-book bills | Gamble | bond loan of 4 turns of income, no payment 10 turns | 20 Influence | turns (no capture in 10 turns): payments at 1.5x, inflation +0.5% a turn for the age; otherwise paid by the capture |

### 7b. The rest, designed for the later phases

Named with their mechanism in a line; numbers and tiers set on the benchmark when their phase comes. Despotism:
The king's granaries (extraction, Happiness), Conscript labour (capital's works from everyone's Happiness), Royal
gifts (Gold out, relationships in, a court that costs more each time). Oligarchy: Tax farming (Gold now, tax Gold
sold off), Guild cartel (export prices up, importers' ill will), Bread and circuses (Relief paid by credit room).
Feudal Monarchy: Corvee (works without Gold, Happiness), Scutage (Gold now, War Levy silenced), The lord's table
(cushion and Happiness for Gold). Theocracy: Indulgences (Gold now, other faiths' relationships), The tithe (Gold
a settlement for Happiness), Jubilee (temple and citizens' debts gone, temples closed). Revolutionary
Authoritarianism: Requisition (Gold and prices), The Maximum (your own bills and route income frozen at ten turns
ago, the difference paid by or to the treasury: a subsidy in a price rise, a penalty in a fall), Confiscation
(Gold, monarchies' grievances). Authoritarianism: Forced conversion (bond schedule rewritten, lenders' memory),
Work battalions (works at half Gold, Happiness), Wage discipline (bills -10% and route income +10% for producers,
-3 Happiness: margins against consumption, no index touch). Bureaucratic Monarchy: Crown monopoly (one class's
bills halved, its world price up), Ever-normal granary (Relief cheaper, routes slower), Sale of offices (Gold now,
dearer tax cards). Elective Republic: Public bonds (citizens' bonds at 0.5% over 30), Emergency tariff (High
tariffs; -1 relationship with each partner at once, the Hoover line's weight, and their tariffs 10 turns longer),
Reconstruction finance (lending to civs in Depression, defaults carried). Communism: Five-Year Plan (take
doubled into builds at 3 Gold a point; the classes the plan starves rise in price for you: shortages; rigid once
begun), Collective farms (Gold from the countryside, Happiness, and farm-class prices up for you), Repudiate the
old regime (repudiation at half cost, the bond market closed for the age).

### 7c. The civilization layer

No separate card sets per civilization. A civilization's trait row moves one or two affinities (a path's
Influence price a step cheaper) and, for a few with a story to tell, renames a card or changes one number: Rome's
Bread and circuses at no credit cost, Persia's Royal gifts from tribute at no Happiness cost, Great Britain's
Bank regulation keeping the bond market open, Han's Crown monopoly across two classes. The layer is a table, so
the DLC rule holds: rows select through the civilization table and a missing civilization drops its row.

## 8. The AI

The AI scores each open card and takes the best, or none:

```
U = recovery + strategic + affinity - resources - risk - future
```

Recovery is the card's 20-turn benchmark value against the civ's actual problem (a debt crisis weighs loan relief,
a trade collapse weighs route income); strategic is what the civ is doing anyway (a war on, builds it wants);
affinity is the government's or ideology's own weight on the card's kind (militarist weight on wartime
production, democratic weight on credibility, planned weight on mobilisation), with a small per-civ jitter so
two Democracies don't move in step; resources is the Influence, Gold and slot against what the civ holds; risk
is the turning probability for a Gamble and the chance a Programme can't be sustained; future is the legacy's
cost carried. An AI with a war already running, an exhausted treasury or a threatened capital scores Foreign
adventure below zero and doesn't take it. Ideological preference and strategic competence are separate terms,
so no ideology is an AI handicap.

## 9. History and naming

- A card's name is plain words for what it does. A dictatorship's slogans and programme names stay out of the
  names and history lines; programmes a democracy is remembered well for keep theirs (the New Deal, Lend-lease,
  Glass-Steagall).
- The history line names the era and the idea, not a regime. The weaker associations of the first draft go:
  Joseph's storehouses becomes "the royal granaries of the river kingdoms", the Gracchi stay as inspiration with
  the line "land to the landless, against the great families", Lend-lease is framed as wartime aid a democracy
  in a slump could still afford, the New Deal's entry says it was contested and partial.
- Coercion is modelled by its mechanism (labour mobilised, Gold appropriated, farms consolidated) and its costs
  (Happiness, relationships, shortages), and the Civilopedia page for each card separates the history from the
  abstraction in two paragraphs, the second saying plainly what the game leaves out.

## 10. Rules settled

| Question | Rule |
| --- | --- |
| How many cards per owner | as many as its paths need; two to four |
| What earns a legacy | a path's milestones, not a card count |
| How long a legacy lasts | per legacy (turns, the age, into the next age, the game), set in its row |
| The universal +5% slump rebate | gone; legacies are specific |
| A Programme when the crisis ends first | runs to its five-turn minimum; Recover judged at the crisis's end |
| Two Programmes in one crisis | one path open at a time; a second Programme waits for the first to end |
| Government change mid-path | the path stays with the government that committed it |
| A card with nothing to act on | kept off the menu by `needs` |
| The Maximum | your own bills and route income held at ten turns ago; the treasury pays or keeps the difference |
| Fascism's war cards | commitments with a turning line, scored by the AI like any other, never automatic |
| Civilization-specific content | a trait layer over the government and ideology cards |

## 11. Probes before the build

- Reads, in one lab game: a war with an independent power through `Diplomacy.isAtWarWith` (the glue counts
  majors only today); a settlement captured from an independent showing in the capture events the cycle reads; a
  civ's Influence stock and a charge against it (the mod already grants and charges Influence, so this is the
  stock read only).
- The index model: the public-works cause already moves the index; the slice's Programmes rely on that and on
  income growth, so a balance run (the model's offline runner) with the slice's cards shows whether a Programme
  shortens a Depression at all before any UI exists. If it doesn't, the Programme's numbers change, not the rule.

## 12. Phases and cost

| Phase | Work | When |
| --- | --- | --- |
| 1 | The pill, header, notice and history carry the running response; the panel's response card | first, two days |
| 2 | Affinity tags and prices on the shared cards (Institutional advantage, Political opposition) | with 1, one day |
| 3 | The response engine: schema, levers, commitments, stacking, expiry, reload and age rules; tests | a week |
| 4 | The slice: the four paths of 7a with their milestones and legacies; the panel's path pips | a week |
| 5 | The AI utility model and the balance runs on the slice | three days |
| 6 | A lab game per age on the slice; fixes | three days |
| 7 | The rest of the catalog (7b) on the engine, by age | two weeks, in forks |
| 8 | The civilization layer, institutional drift, the Civilopedia pages | a week |

The first draft's four to five days was the cost of phases 1 and 2. The full system is the better part of two
months of sessions, which is why the slice comes first: it finds the engine's faults with four paths before 35
more cards are written on it.

## 13. What the owner decides

- The slice: Classical Republic, Plutocracy, Democracy and Fascism as the four, or another set.
- Fascism's shape: structurally dependent on expansion (this draft) rather than worse by rule (the first draft).
- The Influence figures (10, 20, 40 to 60 and 3 to 6 a turn) and the five-turn Programme minimum.
- Institutional drift: in the plan (phase 8) or left out.
- Constitutional Monarchy: shares the Elective Republic's paths or gets its own.
