import test from "node:test";
import assert from "node:assert/strict";

import { planTurn, projectBalances } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { OPEN, PARAMS } from "./_fixtures.mjs";
import { gen } from "./_prng.mjs";

// T6: a 12-civ game with 96 open loans (the cap of 8 per borrower); one turn plan plus the Treasury tab's 20-turn
// projection. DESIGN 10's turn-time row allows 50 ms for the plan; the projection is 20 plans more.
function bigInput() {
  const g = gen(12);
  const ids = [0, 2, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const civs = ids.map((id, i) => ({ id, alive: true, human: i === 0, balanceCents: g.int(-2000, 400000),
    incomeCents: g.int(-2000, 8000), upkeepCents: g.int(0, 1500), stages: OPEN, depthTurns: 2 }));
  const loans = Array.from({ length: 96 }, (_, i) => {
    const borrower = ids[i % 12];
    const lender = i % 3 === 0 ? "bond" : ids[(i + 1 + (i % 5)) % 12];
    return makeLoan({ id: `L${i + 1}`, lender, borrower, principal: g.int(1000, 50000), ratePpm: g.int(15000, 60000),
      term: g.pick([10, 20, 30]), turn: g.int(80, 99), source: "borrow" });
  });
  const relations = [];
  for (let i = 0; i < 12; i += 1) for (let j = i + 1; j < 12; j += 1) {
    relations.push({ a: ids[i], b: ids[j], level: g.pick(["friendly", "neutral", "unfriendly"]) });
  }
  return { turn: 100, age: "AGE_EXPLORATION", civs, relations, requests: [], params: PARAMS, options: {},
    ledger: { ...emptyLedger(), loans, nextId: 97, age: "AGE_EXPLORATION" } };
}

function median(times) {
  const s = [...times].sort((a, b) => a - b);
  return (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

test("perf: a 12-civ, 96-loan turn plan runs in under 5 ms; with the 20-turn projection under 50 ms (median)", (t) => {
  const inp = bigInput();
  for (let i = 0; i < 5; i += 1) { planTurn(inp); projectBalances(inp, 20); }
  const plans = [];
  const both = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = process.hrtime.bigint();
    planTurn(inp);
    const t1 = process.hrtime.bigint();
    projectBalances(inp, 20);
    const t2 = process.hrtime.bigint();
    plans.push(Number(t1 - t0) / 1e6);
    both.push(Number(t2 - t0) / 1e6);
  }
  t.diagnostic(`plan median ${median(plans).toFixed(3)} ms; plan plus projection median ${median(both).toFixed(3)} ms`);
  assert.ok(median(plans) < 5, `plan median ${median(plans).toFixed(3)} ms`);
  assert.ok(median(both) < 50, `plan plus projection median ${median(both).toFixed(3)} ms`);
});
