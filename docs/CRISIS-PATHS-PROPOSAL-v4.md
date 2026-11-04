# Crisis paths, fourth draft: the build spec (2026-11-02, nothing built)

Supersedes `CRISIS-PATHS-PROPOSAL-v3.md` where the two differ; everything the third draft says and this one
doesn't change stands as written there. The third draft's review approved the design through the vertical slice
and asked that the concept stop moving. This draft is the freeze: it settles the four mechanical questions the
engine can't be written without, lists the balance questions that wait for play, and sets the rule against
adding economic variables. The next revision after this one comes from gameplay results, not from another pass
over the text.

## 1. Objectives measure what the Programme did

A path is judged on the contribution its own Programme made, recorded by the engine at Commit and each batch,
never on a world statistic that could move for other reasons. The engine keeps a contribution record per
response instance: the production its grants added, the Gold its routes earned net of its operating charge, the
payments its loans made, the leverage it took off, the obligations it met.

| Path | Objective, measured on the contribution record | Scale |
| --- | --- | --- |
| Citizens' republic | the citizens' loan repaid on schedule; the citizens' ordinary cap restored at Resolving (no second call on them while the loan stood); every obligation met | none needed |
| Company state | net route income attributable to the Programme (the +25% on qualifying routes less the operating charge) over its run at or above 3 turns of the civ's income at Commit; every obligation met | scales with income at Commit |
| Public investment | production added by the Programme's grants over its run at or above 4 turns of the civ's total production at Commit; Relief never ended early; every obligation met | scales with production at Commit |
| Financial reform | debt service as a share of income at Resolving at or below two thirds of its share at Commit, or the civ's leverage out of the Panic band, without a default and without a repayment funded by a new loan | ratio, not an absolute |
| War economy | every mobilisation obligation met (the war declared in time, the upkeep loans serviced); a strategic outcome: a settlement held at Resolving, or a peace in which the other side ceded a settlement or paid Gold (the engine reads the peace deal's terms), set against the war's cost: the upkeep debt taken on at or below 5 turns of income at Commit | observable terms only; "peace on your terms" is defined as above, nothing subjective |

Earned: the objective met and the Programme sustained. Compromised: sustained, the objective missed; an
institution with its costs, not a partial win, and the card says so ("Compromised: the regulated bank that lost
the bond market"). Abandoned: as the third draft.

The index stays context: resolved under 0.80 caps at Compromised (to be tested, section 5), and a self-caused
prolongation fails the objective.

## 2. Identity, order and partial writes

Three identities, never one:

- `cardId`: the policy (`lottery_loan`).
- `responseId`: one activation in one crisis (`<civ>-<crisisSeq>-<responseSeq>`); a card taken again in a
  later crisis is a new instance with a new id; "refresh extends `until`" applies only to the same instance
  retaken while it runs.
- `transactionId`: one economic operation of that instance (`<responseId>-issuance`,
  `<responseId>-upkeep-t<turn>` for a recurring one). A transaction with a recorded id is never applied again; a
  save loaded from before the id was written applies it once, because the id isn't there.

Batch order, fixed and tested: read the engine; settle obligations (Influence, loan schedules, upkeep loans);
apply standing effects; run the crisis conditions and lifecycle transitions; apply new activations' first-turn
transactions; write the ledger; then the grants. So a commitment is paid before recovery is read, a Programme
can't complete on the turn its crisis closes before its obligation is settled, and an effect's last payment
lands before it expires.

Partial writes: a transaction is written to the ledger as `pending` with its id before the engine call, and
marked `applied` after; the next batch retries a `pending` row whose engine effect isn't observed (the balance
didn't move) and skips one whose effect is (the balance did), reading the engine rather than trusting the marker.
The lab's `resendLostBatch` already does this for grants, and the same pattern covers these.

## 3. The resolution moment

The crisis ending starts the close; the legacy is adjudicated only once the Programme's minimum run and every
obligation it holds have been settled. Turn 100 taken, 102 the crisis ends, 105 the minimum met and the objective
read: the legacy is read at 105, provisional until then, and the panel says "Provisional, settles in 3 turns".
One awarded institutional path per crisis: once a path reaches Earned or Compromised, no second path can be
committed in the same crisis; an Abandoned path frees the slot once. The objective's contribution window is
Commit to the adjudication turn.

## 4. Net, not gross

The benchmark, the panel and the objectives all read net economic value: the Programme's gain less its own
costs (operating charges, borrowed upkeep and its interest, Influence at the cell's price). Merchant marine on a
4-Gold route is a wash before Influence and the panel says so ("+1.0 from the bounty, -1.0 to run it"); on a
12-Gold route it pays. Foreign adventure's panel line shows the military production gained and the upkeep debt
taken on side by side, so a player can choose a loss-making war for strategic reasons and never be told it was
profitable. A path's objective never counts gross revenue.

## 5. Left for balance testing, with what to test

| Question | Test | Priority |
| --- | --- | --- |
| The 0.80 cap on a path's outcome | reforms completed in a severe crisis across the balance grid; drop the cap if it punishes sound reform | medium |
| Drift at 5% steps, 15% bound | over three ages in the balance runner | low |
| The AI's 80% income projection | against volatile incomes and standing debt; raise the margin if AIs abandon Programmes | medium |
| Off-book bills' 1.5x | it is the rate per turn, not the total; test that the schedule stays serviceable at the cap | medium |
| Bank regulation's net rate | the card states one net figure after the Programme surcharge is overridden | low |
| The Happiness floor and cap | they bound the sum of this mod's crisis effects only, never the game's own Happiness | medium |
| Two civs' trade modifiers | the exporter's route-income factor and the importer's bill factor apply independently, each within its own cap | medium |

## 6. No new variables

The levers are Gold, Influence, Happiness, build progress, loans, credit limits, bond rates, tariffs, route
income and bills, prices, relationships, grievances and the index. The slice is built on those and nothing else.
If a card can't say what it does in those terms (Bank regulation's systemic stability, say), the card's design
changes or the card waits; the mod doesn't grow a new system for it. The question the slice answers is whether
these levers produce choices a player can feel, and that is a play question, not a modelling one.

## 7. Approval state and what happens next

| Phase | State |
| --- | --- |
| 1, 2 | approved: visibility, milestone notices, history, affinity tags and prices |
| 3 | approved with this draft's contracts: identities, batch order, partial writes, the lifecycle's adjudication moment |
| 4 | approved with section 1's objectives |
| 5 to 8 | after the slice passes the third draft's five acceptance criteria |

Order of work: the four probes (the independent-power war read, captures from independents in the capture
events, the Influence stock read, the offline balance run), then phases 1 and 2 in one go, then the engine. The
architecture is frozen at this draft; changes after it come with a gameplay reading attached: which cards
players and AIs took, how the index answered, which cards dominated, and whether the institutions changed the
next crisis.
