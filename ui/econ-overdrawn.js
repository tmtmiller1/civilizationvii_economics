// econ-overdrawn.js - Economics: what a treasury below zero costs (DESIGN 4.18). The game's own handling is thin (it
// sets a negative balance back to 0 when income is positive, engine-closed.md), so the mod brings the cost. A civ is
// overdrawn when its balance at the batch is below 0, and how deep it is counts in quarters of its overdraft
// (econ-params.js overdraftOf). While it lasts, every settlement loses Happiness (GLOOM markers), purchases cost more
// (a premium added to the civ's price stack), the civ loses credit reputation each turn, and one unit a turn is
// disbanded until it's back above zero, the highest upkeep first (the glue picks it; owner 2026-11-10: whatever the
// income, so the upkeep keeps falling until the civ is out of debt).

import { OVERDRAFT, OVERDRAWN, heldCents, overdraftOf, overdrawnRamp, rowHeldCents } from "./econ-params.js";
import { notice, repChange } from "./econ-turn.js";

/**
 * How deep a civ is below zero and what that costs this turn; null at 0 or above.
 * @param {{ balanceCents: number, incomeCents: number, overdraftCents?: number }} civ
 * @param {number} [turns] turns below zero in a row, this one included; the harsher steps ramp up with it
 * @returns {OverdrawnRow | null}
 */
export function overdrawnState(civ, turns = 1) {
  const balance = heldCents(civ);
  if (balance >= 0) return null;
  const limitCents = overdraftOf({ ...civ, alive: true });
  const used = -balance;
  const past = used > limitCents;
  const quarters = limitCents > 0 ? Math.min(4, Math.floor((used * 4) / limitCents)) : 4;
  return {
    cents: used,
    limitCents,
    quarters,
    past,
    gloom: past ? OVERDRAWN.gloomPastLimit : OVERDRAWN.gloomBase + OVERDRAWN.gloomPerQuarter * quarters,
    premiumBp: past ? OVERDRAWN.pricePastLimitBp : OVERDRAWN.priceBaseBp + OVERDRAWN.pricePerQuarterBp * quarters,
    ...overdrawnRamp(turns),
    turns,
  };
}

/**
 * Was the civ below zero at the last batch? Read from that batch's row, so no state of its own is kept.
 * @param {Ledger} ledger
 * @param {number} pid
 */
function wasOverdrawn(ledger, pid) {
  const row = ledger.lastBatch?.civs?.find((x) => x.pid === pid);
  return !!row && rowHeldCents(row) < 0;
}

/**
 * Turns below zero in a row, this one included: the last batch's count plus one, or 1 when it wasn't below zero
 * then (a row from before the count read 1 more than its turns once).
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function turnsBelow(ledger, pid) {
  const row = ledger.lastBatch?.civs?.find((x) => x.pid === pid);
  if (!row || !(rowHeldCents(row) < 0)) return 1;
  return (Number.isInteger(row.below) ? /** @type {number} */ (row.below) : 1) + 1;
}

/**
 * Each living civ's overdrawn state this turn, by pid; empty while nobody is below zero. Outside a projection it also
 * takes the reputation and tells the human seat when it goes below zero, passes its overdraft, and comes back.
 * @param {TurnContext} ctx
 * @returns {Record<string, OverdrawnRow>}
 */
export function overdrawnRows(ctx) {
  /** @type {Record<string, OverdrawnRow>} */
  const out = {};
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const before = wasOverdrawn(ctx.ledger, civ.id);
    // A civ that declared bankruptcy this turn is back at 0 once the batch lands (econ-bankruptcy.js).
    const row = ctx.bankrupt?.has(civ.id) ? null : overdrawnState(civ, turnsBelow(ctx.ledger, civ.id));
    if (!ctx.projection) tell(ctx, civ.id, row, before);
    if (!row) continue;
    out[String(civ.id)] = row;
    ctx.batch.below?.set(civ.id, row.turns || 1);
    if (!ctx.projection) repChange(ctx, civ.id, -OVERDRAFT.repPerTurn, "overdrawn");
  }
  return out;
}

/**
 * The seat's notices: going below zero (or passing its overdraft) with what it costs now, and coming back.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {OverdrawnRow | null} row
 * @param {boolean} before
 */
function tell(ctx, pid, row, before) {
  if (!row) {
    if (before) notice(ctx, pid, { kind: "overdrawn-over" });
    return;
  }
  const turns = row.turns || 1;
  // The warnings before the harsher steps: the turn before units start going, and the turn before buildings shut.
  if (turns === OVERDRAWN.warnTurns) notice(ctx, pid, { kind: "overdrawn-units-soon" });
  if (turns === OVERDRAWN.shutFrom - 1) notice(ctx, pid, { kind: "overdrawn-buildings-soon", turns });
  if (before && (!row.past || wasPast(ctx, pid))) return;
  notice(ctx, pid, { kind: row.past ? "overdrawn-past" : "overdrawn", cents: row.cents, limit: row.limitCents,
    gloom: row.gloom, premiumBp: row.premiumBp, disband: row.disband, turnsLeft: Math.max(0,
      OVERDRAWN.warnTurns + 1 - turns) });
}

/**
 * Was the civ past its overdraft at the last batch, measured against its income now?
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function wasPast(ctx, pid) {
  const prior = ctx.ledger.lastBatch?.civs?.find((x) => x.pid === pid);
  if (!prior || rowHeldCents(prior) >= 0) return false;
  return -rowHeldCents(prior) > overdraftOf({ incomeCents: 0, ...ctx.civ.get(pid), alive: true });
}

/**
 * The price rise the overdraft adds to a civ's inflation level, in basis points: 0 for a civ that isn't overdrawn.
 * @param {PlanOutput} out
 * @param {number} pid
 */
export function premiumBpOf(out, pid) {
  return out.overdrawn?.[String(pid)]?.premiumBp || 0;
}
