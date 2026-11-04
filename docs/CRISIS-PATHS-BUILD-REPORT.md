# Crisis paths: the slice, built and watched (2026-11-03, uncommitted)

The sixth draft's slice is in the working copy: twelve cards, three for each of four owners, on the engine the drafts
describe. Phase 0's probes ran first (`CRISIS-PATHS-PHASE0.md`); this is what the build and the lab games showed,
read against the third draft's five acceptance criteria. Nothing here is committed or released.

## What's built

| Part | Where | State |
| --- | --- | --- |
| The catalog: Liturgies, Land reform, The assembly speaks (Classical Republic); Merchant charter, Debt into shares, Lottery loan (Plutocracy); New Deal programmes, Bank regulation, Lend-lease (Democracy); Diversionary war, Self-sufficiency, Off-book bills (Fascism) | `ui/econ-policy-catalog.js` | built, every card taken at least once offline |
| Taking a card, the payer steps, the lifecycle (Active, Sustained, Earned, Compromised, Abandoned), the objectives, drift | `ui/econ-policy.js`, `ui/econ-policy-read.js` | built, tested, lab-watched for Liturgies and Merchant charter |
| Influence prices read from the game's own stock | `ui/econ-engine.js` (`readInfluence`) | built, the phase 0 gate passed |
| Affinity tags on the shared responses | `ui/econ-crisis-catalog.js`, `ui/econ-crisis-respond.js` | built, read on screen |
| The panel: own cards, the running card with its milestones and goal parts, the hardship line; the pill and header; the Fiscal tab's legacies and drift | `ui/econ-view-crisis.js`, `ui/econ-pills.js`, `ui/econ-view-summary.js` | built, read on screen |
| Partisans: a deep Depression counts toward risings | `tower_mods/partisans/ui/pt-economics.js` and its pass | built, both mods read the same figure in the lab |
| The Civilopedia page "Crises: own answers" | `text/en_us/EconomicsPedia.xml` | built, unread on screen |
| Tests | `tests/econ-policy.test.mjs` (20), `tests/econ-view-paths.test.mjs` (7), `tests/econ-policy-grid.test.mjs` (1) | 643 pass with lint and types clean |

## The lab games

| Run | Setup | What it covered |
| --- | --- | --- |
| `2026-11-03T03-29-52` | Antiquity, seed 4242, every other mod off, 70 turns | phase 0's probes |
| `2026-11-03T04-00-25` | Antiquity seed 4242, Economics and Partisans working copies, then the age change into Exploration | P1 (Liturgies, hardship, panel, Fiscal tab) and the Plutocracy cards |
| `2026-11-03T04-20-45` | Modern, seed 4242, Economics and Partisans working copies, three pushed Depressions | Democracy and Fascism cards, AI wars |

### Antiquity

- The seat took Liturgies through the request queue at turn 31. The batch charged 40 Influence, then 4 a turn and 25 Gold
  administration; the pill read "Debt 30 · Depression · Liturgies" and the header named it.
- It was Sustained at turn 37, the turn its crisis ended, and judged Earned: the Citizens' republic legacy went on the
  Fiscal tab, the path's price dropped 5% and the other paths rose 5%.
- Before the AI fix, four AIs took The assembly speaks at 0.70 and all four turned. The AI now projects where the
  index will be when the test comes; deep in a Depression it holds its Influence (offline test).
- Hardship read 5 to 6 at 0.70 and 6 at 0.50 for every civ, and Partisans read the same figure. No settlement was
  unhappy enough for it to count toward a rising, so the rising itself is unwatched.
- Captures: `working_screenshots/econ-paths-2026-11-03/` (crisis top, own cards, shared tags, Fiscal legacies).

### Exploration

- Goryeo, the one Plutocracy, took Merchant charter twice, at turns 18 and 24, each time in a new crisis. Both runs
  serviced the charter loan and funded a quarter turn of production, and both were Compromised: the routes didn't grow,
  and the crises lasted five and six turns against the ten-turn "routes held" part. With crises this short only a new
  route earns the Company state.
- The other AIs answered with the shared responses: Relief, Bank holiday, Tribute, Suspend payments, Public works.

### Modern

- Two AIs took Fascism around turn 40 and one took Communism; the seat was set to Democracy. No AI chose Democracy,
  so the Democracy cards were only offered to the seat.
- The Fascist AIs took Self-sufficiency in a price shock at turn 34 and Off-book bills in a credit panic at 37. Both
  ran their full length and ended at 54 and 48 without turning.
- In the Depression at turn 55 both Fascist AIs took Diversionary war while already at war through ordinary play, so
  the mod didn't declare a war. Both were judged Compromised at turn 60: the war was in force and the upkeep debt
  stayed bounded, but no settlement was taken and five turns of war fell short of ten.
- The other AIs answered with Rearmament, Bank holiday, Price supports, Deposit insurance, Gold standard and
  Confidence measures.
- The seat asked for New Deal programmes in two pushed Depressions (turns 94 and 108). Both times the batch refused it
  for Influence: the game held 17, then 39, against the 60 it costs. Autoplay spends the seat's Influence on its own.
  The same request replayed offline on the turn-107 input, with 162 Influence, is accepted. The panel greyed Take it
  with "you don't have the Influence."
- During the drive the batch reads the seat as an AI, so the seat answered one crisis with Deposit insurance on its
  own. A person's game reads the seat as human; this only happens under autoplay.
- Hardship rose to 6 at each push and fell as the civs' own index recovered, the same figure Partisans read.

## The second round (2026-11-03, after the owner's review)

### What changed

- **Hold parts follow the run.** Merchant charter's "routes kept" and the War economy's "at war with nothing lost" ask
  for the turns the Programme ran, up to ten, so a five-turn crisis can meet them.
- **Lottery loan's AI risk** is a thin treasury or ten turns of income already owed, since the card turns on a missed
  payment. It had been weighed by the index.
- **Debt into shares** is tested five turns after its crisis ends, against 0.85. On the turn a Depression ends the
  index has only just passed 0.80, so the old test at 0.90 burst the bubble nearly every time. The AI counts the
  company's claim against the write-off.
- **Debt into shares bug fixed.** A card taken while its crisis ran was stored with no end turn and never judged.
- **Lend-lease** needs a civilization you know at war, and you can stay at peace, as in 1941. It had asked the giver
  to be at war with the same enemy.
- **Diversionary war:** a Fascist state at least half again as strong as the weakest rival it would declare on
  weighs the war at one turn of income instead of four.
- **The Influence refusal names both figures:** "you need 60 Influence and have 17."
- **Wording pass from a cold read.** Fractions became percentages, "Compromised" and "Abandoned" became "Goal missed"
  and "Ended early", the states read "Running", "Minimum run done" and "Being judged", the index is explained where a
  Depression is, and Public support is explained on the panel. The other languages got the English until translated.
- **The balance grid** counts the cards the AI would take as well as its best pick. Each card is taken somewhere and
  declined somewhere, and none is the best pick everywhere.

### The games

| Run | Setup | What it covered |
| --- | --- | --- |
| `2026-11-03T10-56-09` | Antiquity seed 4242 into Exploration, Economics and Partisans working copies, every other mod off | Land reform, Lottery loan, Debt into shares, Merchant charter with the hold change |
| `2026-11-03T11-18-23` | Modern seed 4242, same mods | New Deal programmes, Bank regulation, Lend-lease, the new text on screen |

- **Land reform:** four Republic AIs took it in the first Depression, and it ran its ten turns and ended at turn 31.
- **Lottery loan:** Goryeo took it beside Merchant charter at turn 22 and repaid it by 27 without the rate doubling.
- **Debt into shares:** Goryeo, given a bond loan of 15 turns of income, took it at turn 62. Its crisis ended at 66,
  it was tested at 71 with the index well above 0.85, and it ended with the company's claim and no burst. The id of
  the loan the probe added collided with the charter's, so the write-off amount in that log isn't readable.
- **Merchant charter:** the routes-kept part was met under the new rule. Its goal was still missed, because Goryeo
  opened no route and didn't fund a quarter turn's production.
- **New Deal programmes:** the seat took it at turn 27 with Influence given by the probe. Works grants and Relief
  held, but 36 production fell short of half a turn's, so it missed its goal at turn 32.
- **Bank regulation:** taken at turn 50, minimum run done at 55, goal met at 57, with the regulated bank on the
  Fiscal tab.
- **Lend-lease:** taken at turn 66 while two other civilizations were at war. A 200-Gold gift to one of them raised the
  relationship by 2 and the bond market lent the seat 100 Gold.
- **The new wording** read on screen in the Modern game: the card lines, "Running", "Minimum run done" and "Not final
  yet".
- **No settlement went below 0 Happiness** in either game, so the Partisans rising is still unwatched.

## The third round (2026-11-03): Austerity and the last four watch items

### Austerity and risings

While Austerity runs, in any crisis and at any index, Partisans counts each of your settlements 3 Happiness lower
toward a rising, on top of the Depression's share of up to 6; Relief halves only the Depression's share. Partisans
takes up to 9 now, and its City Details line reads "Hard times". Before this, Austerity added 2, and only while the
index was under 0.80, so it did nothing in a debt crisis or a credit panic.

The points are small against Modern Happiness. The seat's settlements in run `2026-11-03T11-42-35` made +17 to +88
Happiness a turn, and a rising needs -10 or worse for about 20 turns. Hard times only tip a settlement that was
already near the line. If Austerity should push ordinary settlements toward rising, the points would have to scale
with the age or with the settlement's own Happiness. That's the owner's call; nothing is built for it.

### The games

Run `2026-11-03T11-42-35`, Modern seed 4242, Economics and Partisans working copies, sample
`mod_ideas_tested/economics/devtools/econ-paths-p8-sample.js`. One Depression for every civ from turn 46, held at 0.50
to turn 75. The probe gave Influence and Gold where autoplay had spent them, and placed tanks to make one Fascist
strong and to give another an attack.

- **A strong Fascist's war at peace.** Goryeo, given nine tanks (strength 32 against the Ottomans' 18), took Foreign
  adventure at peace on turn 52, and the mod declared its war on the Ottomans; the war was in force the next turn.
  Goryeo couldn't keep paying the card's Influence, and it ended early on turn 64.
- **A capture.** Hawaii took Diversionary war in its own war with Persia on turn 56. Given ten tanks around Persia's
  smallest city, it took the city on turn 68. The game reads Hawaii as owner and Persia as founder, and the mod reads
  the city outside Hawaii's settlements at commit. On turn 77 the card was judged with "war in time" and the
  strategic outcome met, and missed its goal on borrowed upkeep above 5 turns of income.
- **Lend-lease's doubling.** The same 300-Gold gift to the Ottomans, at war, bought +6 relationship and a 150-Gold bond
  loan with the card, and +3 with no loan after it ended.
- **Austerity at work.** It took half of every Gold grant the probe made to the seat for its loans, as the card says.

## Next (2026-11-03)

A Programme that can't pay its per-turn Influence will go into arrears for up to five turns at a doubling price
instead of ending at once, and Diversionary war's war may end with the card if a script can make peace. Both are
planned, with Partisans' hard-times scaling, in `tower_mods/partisans/docs/HARD-TIMES-PLAN-v2.md`, Part 2. Nothing is
built.

## The acceptance criteria

1. **Choice.** An offline grid of the AI's own utility (incomes, reserves, Influence, index depth, crisis kind, war,
   debt, and a world with an ally at war and a trade bill) now has each card as the best pick in some cells and none
   in every cell (`tests/econ-policy-grid.test.mjs`). The first grid found Land reform never worth taking: its support
   was valued at a flat half turn of income and its Gold paid out wasn't counted. It now weighs support by the
   Depression's depth and charges the Gold over the run; Land reform wins about a third of the Republic's cells.
2. **Causality.** The panel says what each card does now, what it costs, its goal and its three ends, and the turn
   notice names each step. The cycle dial's tooltip says what moved the index. A person hasn't read it cold yet.
3. **Persistence.** The ledger tests cover the rows across a save and a load, a junk row dropped, a turn settled once
   and a three-turn gap settled turn by turn, and the AI deciding the same after a reload. The age change carried the
   Citizens' republic legacy and the drift into Exploration in the lab. The save forced between the batch and the
   grants (owed item 1.4) is still owed.
4. **AI.** The AI refuses a Programme without the reserve, holds its Influence when a Gamble's test would fail, and
   took its government's Programme when it could (Goryeo twice, both Fascists once). The Fascists' choices followed
   the crisis kind: Self-sufficiency in a price shock, Off-book bills in a credit panic, Diversionary war in a
   Depression while at war.
5. **Comprehension.** Needs a person. The panel reads in plain sentences, and the labels were tightened after the
   first read ("Your answer, under way", "If met", "If missed", "If ended early").

## Findings for the owner (first round; the second round above answers them)

- Merchant charter's "routes held for ten turns" part can't be met in a crisis shorter than ten turns. Either shorten
  it to the Programme's own run or keep it as the long-crisis route; the lab's crises were pushed and short.
- Land reform's AI weighting changed (above). The card's rules are the same.
- Diversionary war's "ten turns of war" outcome has the same problem as Merchant charter's hold part when the crisis
  is short. Both Fascist AIs were Compromised on it.
- Unwatched in any lab game: the Democracy cards running, Lend-lease, Debt into shares, Lottery loan, Land reform,
  and a script-declared Diversionary war. They're on the watch list, section 24b. A person's game is the next
  step; autoplay spends the seat's Influence before the batch can charge it.
- The refusal could name the numbers ("you need 60 Influence and have 17"). It's a small text change, not made.
- The probe script's screen read sometimes finds no screen on the turn after it opens it; the panel was read on the
  other turns.
