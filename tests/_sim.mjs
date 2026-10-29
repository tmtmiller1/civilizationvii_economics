// _sim.mjs - a minimal turn loop for the Economics tests: plan, then move each civ's balance by its own income and the
// plan's grants, as the engine would. Income is exogenous; dead civs earn nothing. With `roundTrip` the ledger goes
// through save and load between turns, as it would across a reload.

import { planTurn } from "../ui/econ-plan.js";
import { applyGrants, grantsFor } from "../ui/econ-conservation.js";
import { load, save } from "../ui/econ-state.js";

export function step(state, over = {}) {
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
  roundTrip = false }) {
  const balances = new Map(civs.map((c) => [c.id, c.balanceCents]));
  return { civs, age, turn, params, options, relations, ledger, balances, roundTrip };
}
