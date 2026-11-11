// _sim.mjs - a minimal turn loop for the Economics tests: plan, then move each civ's balance by its own income and the
// plan's grants, as the engine would. Income is exogenous; dead civs earn nothing. With `roundTrip` the ledger goes
// through save and load between turns, as it would across a reload. With `roll` the turn plays out as the game
// runs it (lab run 2026-11-10T00-35-36): the batch first, then each civ's roll adds its income less the standing lines
// the batch set, with no floor (lab W10, 2026-11-10: a treasury goes below 0 and stays there); the next batch counts
// the lines' charge back into the balance it reads (econ-session.js withCharged). The human seat's markers go up a
// moment after its own roll, so a seat's lines are charged at its next roll, after the next batch, which reads them as
// still to come (rollPendingCents). Each turn reports the seat's book shift: what its book balance counts back less
// what its treasury has been charged.

import { planTurn } from "../ui/econ-plan.js";
import { applyGrants, grantsFor } from "../ui/econ-conservation.js";
import { load, save } from "../ui/econ-state.js";
import { STANDING_LINES } from "../ui/econ-standing.js";

/** The signed Gold a plan's Gold lines move a treasury by at the roll, in cents, by pid (face value). */
function lineCents(plan) {
  /** @type {Map<number, number>} */
  const out = new Map();
  for (const row of plan.standing || []) {
    const sign = STANDING_LINES[row.line];
    if (sign) out.set(row.pid, (out.get(row.pid) || 0) + sign * row.gold * 100);
  }
  return out;
}

export function step(state, over = {}) {
  if (state.roll) return rollStep(state, over);
  const civs = state.civs.map((c) => ({ ...c, balanceCents: state.balances.get(c.id) }));
  const plan = planTurn({ turn: state.turn, age: state.age, civs, relations: state.relations || [],
    requests: over.requests || [], params: state.params, options: state.options || {}, ledger: state.ledger });
  const withIncome = new Map([...state.balances].map(([id, b]) => {
    const c = civs.find((x) => x.id === id);
    return [id, b + (c.alive === true ? c.incomeCents : 0)];
  }));
  const balances = applyGrants(withIncome, grantsFor(plan.transfers));
  const ledger = state.roundTrip ? load(save(plan.ledger)).ledger : plan.ledger;
  return { plan, civs, next: { ...state, turn: state.turn + 1, balances, ledger } };
}

export function world({ civs, age = "AGE_EXPLORATION", turn = 10, params, options, relations, ledger,
  roundTrip = false, roll = false }) {
  const balances = new Map(civs.map((c) => [c.id, c.balanceCents]));
  return { civs, age, turn, params, options, relations, ledger, balances, roundTrip, roll, engine: new Map() };
}

/** One turn in the game's own order, with the standing lines charged at the roll. */
function rollStep(state, over) {
  const civs = state.civs.map((c) => {
    const eng = state.engine.get(c.id) || 0;
    return { ...c, balanceCents: state.balances.get(c.id), ...(eng ? { engineCents: eng } : {}),
      ...(eng && c.human === true ? { rollPendingCents: eng } : {}) };
  });
  const plan = planTurn({ turn: state.turn, age: state.age, civs, relations: state.relations || [],
    requests: over.requests || [], params: state.params, options: state.options || {}, ledger: state.ledger });
  /** @type {Map<number, number>} */
  const paid = new Map();
  for (const g of grantsFor(plan.transfers)) paid.set(g.pid, (paid.get(g.pid) || 0) + g.cents);
  const lines = lineCents(plan);
  const balances = new Map();
  const engine = new Map();
  const shifts = new Map();
  for (const c of civs) {
    const income = c.alive === true ? c.incomeCents : 0;
    // After the batch the treasury is the balance the batch read plus what it paid (econ-batch.js grantOf).
    const afterBatch = c.balanceCents + (paid.get(c.id) || 0);
    const fresh = c.alive === true ? (lines.get(c.id) || 0) : 0;
    // An AI's roll charges the lines this batch set; the seat's charges the ones set last turn (`pending`), and the
    // batch read the seat's balance with them counted back though they hadn't rolled yet.
    const pending = c.human === true ? (state.engine.get(c.id) || 0) : 0;
    const line = c.human === true ? pending : fresh;
    const treasury = afterBatch + income + line;
    // The book balance counts back what stands at the batch: for an AI what just rolled, for the seat what will, so
    // the seat's book moves by what it counted back less what it now counts back (`shift`) beside its real Gold.
    shifts.set(c.id, c.human === true ? pending - fresh : 0);
    balances.set(c.id, treasury - fresh);
    if (fresh) engine.set(c.id, fresh);
  }
  const ledger = state.roundTrip ? load(save(plan.ledger)).ledger : plan.ledger;
  return { plan, civs, shifts, next: { ...state, turn: state.turn + 1, balances, engine, ledger } };
}
