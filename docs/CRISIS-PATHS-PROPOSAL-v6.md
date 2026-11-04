# Crisis paths, sixth draft: the freeze (2026-11-02, nothing built)

Changes the fifth draft in the places listed here and nowhere else; the fifth draft stands as the build spec for
everything this one doesn't touch. Its review approved the engineering direction and rejected two substitutions
that kept the code but lost the decision: netting a tax card's Gold, and calling a celebration-meter movement
Happiness. It also asked that Influence and AI-declared wars wait on proof, that the persistence claims be
tested rather than inferred, and that two objectives be made achievable. This draft makes those changes and
freezes the design. The next revision comes from a working slice and what it does in play.

## 0. The rule for every substitution

When the game can't do what a card asks, the card is redesigned around another economic mechanism that makes the
same choice hard for the same reason. It never swaps the missing variable for whichever available number is
easiest to move. Every later card in the catalog passes this test before it's written, and the review of each
phase checks it.

## 1. The Programme's cost is its own, not a tax card's

Tax-card netting goes. A Programme doesn't touch the policy screen at all. Its opportunity cost is two things the
mod already owns:

- One structural Programme at a time (the existing one-path rule): taking New Deal programmes means not taking
  Bank regulation this crisis.
- An administrative charge: a Gold charge a turn set by the Programme itself, a share of the civ's income at
  Commit (5% for the slice's Programmes, 8% for Foreign adventure's mobilisation), paid into the cycle account
  like the other crisis costs, listed on the card as "Administration: 6 Gold a turn".

The bond-rate surcharge stays where a card names it. The tax card stays in its slot and does what it always did.

## 2. Public support, not Happiness

The celebration meter is its own lever with its own name: Public support. A card says "+4 Public support a
settlement" and its tooltip says "Fills your celebration meter as 4 Happiness a settlement would. Your
settlements' own Happiness doesn't change." The panel's legend says the same once. No crisis card says
"Happiness" for a meter movement.

What that means for the cards: Land reform buys support for the government (the next celebration sooner) while
angering the creditors; Liturgies' price is a fall in support while the citizens' capital is tied up; Requisition
and Indulgences spend support for Gold; New Deal programmes' legacy is lasting support, not happier cities. A card
whose whole point was to settle an unhappy settlement doesn't exist in this design, because the mod can't do it.

The shared responses already in the game use the same word from this draft on: Relief's "+4 Happiness a
settlement" becomes "+4 Public support a settlement". The other Tower mods that read the mod's celebration
grants keep reading them as before; only the words change.

## 3. Gates on unproven engine behaviour

- Influence. A card is priced in Influence only after the stock read is proven in the lab: the mod reads the
  civ's Influence and the figure matches the top bar before and after a charge. There is no fallback that tracks
  Influence from the mod's own grants; the game spends and grants Influence on its own, so such a figure would
  be wrong. Until the read is proven, the slice's cards carry the administrative charge and their other prices
  and no Influence price, and the panel shows no Influence line.
- AI-declared wars. The AI takes Foreign adventure and Off-book bills only when it is already at war through
  ordinary play. The mod never declares a war for this feature until a lab comparison shows a script-declared war
  behaves like an ordinary one beyond War Levy: war weariness, the AI's peace offers, the diplomacy screen, and the
  peace that ends it. The human may take Foreign adventure at peace, with the obligation to declare through the
  game's diplomacy screen within five turns, or already at war.

## 4. Two objectives made achievable

Merchant marine becomes Merchant charter, which describes what it now does: a charter loan turned into production
along the civ's routes. Its objective has three parts and the Company state is earned on any two, with the loan
serviced without a miss in every case:

- the route count at adjudication at least one above its count at Commit;
- production funded by the charter at least a quarter turn of the civ's production at Commit;
- the route count never below its Commit level for ten turns running.

The War economy's objective separates mobilisation from expansion. Every mobilisation obligation met (the war in
force by its deadline, the upkeep loans serviced, the upkeep debt at or below 5 turns of income at Commit), and
one strategic outcome from what the mod can read:

- a settlement taken (not founded) during the war and still held at adjudication; or
- the war ended with no settlement of the civ's lost and its combat strength at the war's end at or above its
  strength at Commit; or
- ten turns of war with no settlement lost.

Combat strength is the unit count the mod reads; it's a proxy for battlefield success and the card says nothing
stronger than "held your ground".

## 5. Persistence proven, not inferred

Phase 3 doesn't close until these pass:

- Interruption at each boundary, offline: the model's fake engine fails after the ledger write and before the
  grants, partway through the grants, and after the grants before the glue write; each reload is checked for the
  Gold every civ holds and the ledger's loans, obligations and legacies against the uninterrupted run. Every
  transaction kind in the slice is in the fixture: a loan issued, a write-off, a deferred schedule, a recurring
  upkeep loan, a missed obligation.
- Interruption in the lab: a save forced in the window after `TurnBegin` before the grants land (owed item 1.4),
  reloaded, with the same check.
- Gaps of several turns: an obligation whose `lastSettledTurn` is behind by more than one turn settles every
  missed turn in order, each once, and the test covers a three-turn gap.
- The envelope: open instances, active obligations and standing legacies are pinned and never trimmed. If the
  pinned state alone passes the 64 KB budget, the batch refuses new activations, logs an invariant line and
  keeps everything it holds; it never drops required state to fit.

## 6. What changes in the fifth draft's tables

| Fifth draft | Sixth draft |
| --- | --- |
| "the tax card's Gold netted out" in every Programme's price | "Administration: N Gold a turn" (5% of income at Commit, 8% for Foreign adventure) |
| "Happiness a settlement as celebration" | "Public support a settlement" |
| Influence prices on every card | Influence prices only after the stock read is proven |
| Merchant marine, route count +2 | Merchant charter, two of three objectives |
| War economy, a settlement taken and held | mobilisation met plus one of three outcomes |
| The AI declares Foreign adventure's war | the AI takes it only when already at war |
| Section 8's tax-slot rule | gone |
| The Influence probe's fallbacks | gone; the probe is a gate |

## 7. Approval and what's next

| Part | State |
| --- | --- |
| Crisis panel, history, milestones | approved |
| Response engine, typed effects, lifecycle, objectives, drift, civilization layer | approved, phase 3 closing on section 5's tests |
| Public support | approved |
| Administrative charge | approved |
| Influence prices | gated on the stock read |
| AI-declared wars | deferred until a script war is shown to behave like an ordinary one |

Order of work: phase 0's probes (the Influence stock and a charge against it, production, a war with an
independent power, a capture against a founding, the military build, and the script-war comparison), phases 1 and
2, then the engine with section 5's tests. The design is frozen here. The next review reads a working slice:
which cards were taken, how the index and the ledger answered, which cards dominated, and whether an institution
changed the next crisis.
