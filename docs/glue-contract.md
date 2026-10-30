# The glue contract: what the engine side owes the loan model, per civ, every turn

Written 2026-10-29 from `ui/econ-plan.js`, `econ-turn.js`, `econ-requests.js`, `econ-stages.js`, `econ-state.js` and
DESIGN 3, 4.14 and 6, for prompt 4's engine glue. The model is plain data in, transfers out; it never reads the engine.
Whatever the glue leaves out, the model treats as zero or closed, and the civ it leaves out of is the one that then
plays a poorer game. That is how the AI emergency loan lost its upkeep term once (NOTES choice 35), so the first rule
is the one that matters:

**Every field below is read for every living major civ, human and AI alike, by the same call.** No field is read for
the local player only. The reads the design relies on (`Treasury.goldBalance`, `Stats.getNetYield(YIELD_GOLD)`, the
`Treasury` maintenance getters, `Culture.isNodeUnlocked`, `Techs.isNodeUnlocked`, `Diplomacy.getRelationshipLevel`,
`isAtWarWith`) are per-player objects and work for any player from the UI context; Demographics and Emigration ship
such reads. P2, P13 and P14 are the probes that pin the ones not yet watched.

## `planTurn(input)`, once per game turn at the P3 step

```
input = {
  turn, age,                       // Game.turn; the age type string
  ledger,                          // from load(raw).ledger, or the previous turn's output ledger
  civs: [civ, ...],                // every major civ that has ever been alive this game (dead ones with alive: false)
  relations: [{ a, b, level }],    // one row per pair that has met, either order; see levels below
  requests: [request, ...],        // the local player's asks since the last turn, in the order made
  params: { amenityLineCents, disbandLineCents },   // engineLines(GlobalParameters rows), read once
  options: { loans, guard, ai, rates, stages, taxFallback }  // from the setup parameters (DESIGN 8)
}
```

### `civ`

| Field | Type | Source (same call for every civ) | If missing |
| --- | --- | --- | --- |
| `id` | integer player id | `Players.getAlive()`, majors only | the civ isn't in the turn |
| `alive` | boolean | `player.isAlive` | treated as dead: open loans written off |
| `human` | boolean | `player.isHuman` | AI |
| `balanceCents` | integer cents | `Treasury.goldBalance` × 100, rounded | 0: the civ looks broke |
| `incomeCents` | integer cents | `Stats.getNetYield(YIELD_GOLD)` × 100 (P2 confirms the top-bar match) | 0: insolvency counter runs, no standard loans |
| `upkeepCents` | integer cents, ≥ 0 | units: `Treasury.getMaintenanceForAllUnitsOfType(type)` per type the civ fields; buildings: `city.Gold.getSpecificBuildingMaintenance(row.$index).value` over each city's constructibles (P2) | 0: the emergency loan is sized without the upkeep term, for this civ only |
| `stages` | `{ moneylending, publicDebt }`, each the turn the stage was reached or `null` | DESIGN 4.15 anchors through `ProgressionTreeNodeUnlocks`, `Culture.isNodeUnlocked` / `Techs.isNodeUnlocked` per civ (P13), the turn recorded in the glue's own envelope | both closed: no civ loans, no bond market |
| `depthTurns` | 0 to 12 | Commerce and Banking roles from the civ's buildings (DESIGN 4.13; `city.Constructibles.getIds()` per settlement) | 0: no Bank, no 20/30-turn terms |
| `depthFactorPct` | integer percent | same | 100 |
| `atWar` | boolean | `Diplomacy.isAtWarWith` any living major | false: War Levy reads as Standard in the fallback |
| `happinessCents` | integer cents | the celebration meter read (P6), fallback only | 0 |

Integer cents everywhere; the model never sees a float. Round once, at the read.

### `relations`

`level` is one of `war`, `unfriendly`, `neutral`, `friendly`, `helpful`, mapped by the glue from
`Diplomacy.getRelationshipLevel` and `isAtWarWith` (war wins). A pair with no row is `neutral`; a pair that hasn't met
should have no row. Both directions are one row.

### `requests` (the local player's only; the model refuses any other `pid`)

| kind | fields |
| --- | --- |
| `borrow` | `borrower`, `lender` (a civ id, `"bond"` or `"temple"`), `principal` (cents), `term` (10, 20, 30) |
| `lend` | `lender` (the human), `borrower` (an AI), `principal`, `ratePpm`, `term` |
| `repay` | `loanId`, `cents` |
| `restructure` | `loanId`, `pid` (the asker: the borrower, or the human lender answering a `restructure-ask`) |
| `repudiate` | `borrower` (the human), `lender` |
| `tax` | `pid`, `level` (`light`, `standard`, `heavy`, `warlevy`), fallback only |

Each refused request comes back as an event `{ kind: "refused", request, reason }`; the glue shows the reason.

## What comes back

```
{ ledger, transfers, influence, celebration, grievances, relationships, events, notices, batch, skipped }
```

- `transfers`: `{ loanId, turn, from, to, cents, reason, parts }`; the glue never sends these one by one.
- The grants to send are `grantsFor(transfers)` netted per civ (`econ-conservation.js`): one `Players.grantYield(pid,
  YIELD_GOLD, cents / 100)` per civ, plus one Influence and one celebration grant per civ from `influence` and
  `celebration`. World accounts (`bond`, `temple`, `tax`) never reach `grantYield`; invariant `alive-target` fails if a
  string id gets that far.
- `grievances`: `{ from, against, amount }` → `Players.get(from).Diplomacy.changeNumGrievances(against,
  amount * 1000)`.
- `relationships`: `{ a, b, delta }` → `changeRelationshipLevel`.
- `notices`: for the human only; compose at `TurnBegin`, send at the local `PlayerTurnActivated` (engine-closed).
- `batch`: `{ id, turn, civs: [{ pid, snapshot, net, influence, celebration }] }`, already in `ledger.lastBatch`.
  On load, `batchStatus` (econ-batch.js) tells a landed batch from a lost one from each civ's balance against its
  snapshot plus net; a lost batch's nets are re-sent (DESIGN 4.14; P15 decides whether the window exists).
- `skipped`: `"loans-off"` or `"already-planned"` (the same turn twice: a reload after the write); send nothing.

## The 1.1 fields (Commerce)

Read only with Markets and trade bills or Foreign investment on, for every major by the same calls
(`ui/econ-commerce-read.js`).

| Field | Shape | Source | If missing |
| --- | --- | --- | --- |
| `civ.cities` | `[{ id, build, neededProgress, roleBuilding, tradeBuildings, purchaseCents }]` | each settlement's component id as `"owner:id"`, `BuildQueue.currentProductionTypeHash` named through `GameInfo`, what's left from `currentBuildProgress` and `getPercentComplete` (else the row's `Cost` times the speed), the build's roles, the Trade-role buildings standing, `Gold.getBuildingPurchaseCost` | no city read: no development loan on that civ, and nothing written off for a lost city |
| `civ.tradeIncomeCents` | cents | `city.Yields.getTradeYields()` Gold summed, the engine's own exporter payment as the game's text describes it; it read 0 in every route city in the 1.1 probes (C9) | the Trade tab leaves the row out |
| `input.routes` | `[{ importer, exporter, resources, importerTradeBuildings, exporterTradeBuildings }]` | the importer's `Resources.getResources()` with `Game.Resources.getOriginCity` per entry, grouped by the foreign major city they come from; the importer's city at the other end from `Trade.getCurrentTradeRoutes()` | no bills |
| `input.market` | `{ resources, copies, strategic, industry }` | `GameInfo.Resources` (class), each major's own copies counted at the origin, `GameInfo.Units.StrategicResource`, the Industry buildings world-wide | no prices: bills are 0 |
| `input.markets` | the markets envelope | `Configuration` key `tower-economics-markets` | an empty market |

What comes back adds `markets` (write it with the ledger, before the grants), `trade` (the settlement rows, for the
screens) and `progress`: `{ host, cityId, amount, investmentId }`, landed with `city.BuildQueue.addProgress(amount)`
on the city found again by its key, after re-reading that its queue isn't empty. The progress account (`progress`) is
a world account like `bond`: it never reaches `grantYield`.

The requests the player can add: `tariff` (`pid`, `level` none, low or high), `invest` (`investor`, `host`, `form`
project or general, `cents`, `cityId` for a development loan, `asAid`), `accept-offer` and `decline-offer`
(`offerId`).

## Persistence

`save(ledger)` returns the envelope string (≤ 64 KB, events then settled loans dropped first, never an open loan);
`load(raw)` returns `{ ok, reason, ledger }` and an empty ledger on anything it can't trust. Write it with
`Configuration.editGame().setValue` under the mod's key before the grants are sent, as 4.14 orders it.

## Rules that look like glue work but aren't

- Don't pre-filter civs by anything but `isMajor` and ever-alive; the model decides who borrows, lends and is refused.
- Don't compute "short" or "insolvent" in the glue; pass income, and the model's counters do it the same way for all.
- Don't read the treasury again after sending grants in the same tick (stale for ~3 s; engine-closed). The batch's
  snapshot carries the arithmetic.
- Don't give the local player a field the AIs don't get. If a read is only possible for the local player, say so in
  the glue and in DESIGN 3, and the model has to be changed for everyone, not fed unevenly.
