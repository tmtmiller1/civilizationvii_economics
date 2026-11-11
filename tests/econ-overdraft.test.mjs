// The overdraft (DESIGN 4.18): dues are paid into it down to max(100 Gold, 10 turns of |income|) and miss past it;
// spending of choice (lending, aid, investing) still needs Gold in hand; a balance below 0 at the batch pays interest
// at twice the bond rate to the bond market, and the interest stands as an Economy costs line.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { createBatch, funds, payable } from "../ui/econ-batch.js";
import { overdraftInterest } from "../ui/econ-overdraft.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });
const ledgerWith = (loans) => ({ ...emptyLedger(), loans, nextId: loans.length + 1 });
// A civ with the game's own overdraft, as the glue reads it (the fixtures' civs have none).
const real = (id, over = {}) => civ(id, { overdraftCents: undefined, ...over });

test("payable is funds plus the overdraft: 100 Gold or 10 turns of income, whichever is more; a dead civ has none", () => {
  const batch = createBatch([real(ME, { balanceCents: -500, incomeCents: 2500 }), real(AI, { incomeCents: -300 }),
    real(9, { alive: false }), civ(4, { balanceCents: 0, incomeCents: 0 })]);
  assert.equal(funds(batch, ME), 2000);
  assert.equal(payable(batch, ME), 2000 + 25000);
  assert.equal(payable(batch, AI) - funds(batch, AI), 10000, "10 turns of 3 is under the 100 Gold floor");
  assert.equal(payable(batch, 9) - funds(batch, 9), 0);
  assert.equal(payable(batch, 4) - funds(batch, 4), 0, "a rule set this civ's overdraft to 0");
});

test("a loan payment goes through on the overdraft and takes the treasury below 0; past it, a miss", () => {
  const civs = [real(ME, { human: true, balanceCents: 0, incomeCents: 1000 })];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs, options: { guard: false } }));
  assert.deepEqual(plan.transfers.map((t) => [t.reason, t.cents]), [["payment", 2100]]);
  assert.equal(plan.ledger.loans[0].missed, 0);
  assert.equal(plan.batch.civs[0].snapshot + plan.batch.civs[0].paid + 1000, -1100, "11 Gold below 0 after the roll");
  assert.deepEqual(checkPlan({ plan, civs }), []);
  const deep = [real(ME, { human: true, balanceCents: -10500, incomeCents: 1000 })];
  const past = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: deep, options: { guard: false } }));
  assert.equal(past.ledger.loans[0].missed, 1, "105 below with 10 in and 100 of overdraft: the payment misses");
  assert.deepEqual(checkPlan({ plan: past, civs: deep }), []);
});

test("an early repayment needs Gold in hand: the overdraft pays the payment, never the extra", () => {
  const civs = [real(ME, { human: true, balanceCents: 0, incomeCents: 3000 })];
  const repay = { kind: "repay", loanId: "L1", cents: 5000 };
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs, requests: [repay], options: { guard: false } }));
  const pay = plan.transfers.find((t) => t.reason === "payment");
  assert.deepEqual([pay.cents, pay.parts.extra], [2100 + 900, 900], "30 in hand: 21 due, 9 extra");
});

test("lending is spending of choice: an overdrawn civ can't lend on its overdraft", () => {
  const civs = [real(ME, { human: true, balanceCents: -2000, incomeCents: 1000 }), real(AI)];
  const plan = planTurn(input({ civs, requests: [{ kind: "lend", lender: ME, borrower: AI, principal: 500,
    ratePpm: 20000, term: 10 }] }));
  assert.equal(plan.ledger.loans.length, 0);
  assert.ok(plan.events.some((e) => e.kind === "refused"), JSON.stringify(plan.events.map((e) => e.kind)));
});

test("a balance below 0 pays interest at twice the bond rate, to the bond market, once a turn", () => {
  assert.equal(overdraftInterest(-5000, 20000), 200, "50 Gold at 2% twice over");
  assert.equal(overdraftInterest(-1, 20000), 1, "rounded up");
  assert.equal(overdraftInterest(0, 20000), 0);
  assert.equal(overdraftInterest(500, 20000), 0);
  const civs = [real(ME, { human: true, balanceCents: -5000, incomeCents: 1000 })];
  const plan = planTurn(input({ civs, options: { guard: false } }));
  const od = plan.transfers.filter((t) => t.reason === "overdraft");
  assert.equal(od.length, 1);
  assert.deepEqual([od[0].from, od[0].to, od[0].loanId], [ME, "bond", `OD${ME}`]);
  assert.equal(od[0].cents, overdraftInterest(-5000, od[0].parts.ratePpm / 2));
  assert.equal(plan.events.filter((e) => e.kind === "overdraft").length, 1);
  assert.deepEqual((plan.standing || []).filter((r) => r.pid === ME && r.line === "WORLD").map((r) => r.gold),
    [Math.floor(od[0].cents / 100)], "it comes round every turn: an Economy costs line");
  assert.deepEqual(checkPlan({ plan, civs }), []);
  const none = planTurn(input({ civs: [civ(ME, { human: true, balanceCents: -5000, incomeCents: 1000 })],
    options: { guard: false } }));
  assert.equal(none.transfers.some((t) => t.reason === "overdraft"), false, "no overdraft, no interest");
});

test("the interest is a due: it can take the treasury deeper, and past the limit it's still added to the debt", () => {
  const civs = [real(ME, { human: true, balanceCents: -5000, incomeCents: -1000 })];
  const plan = planTurn(input({ civs, options: { guard: false } }));
  const od = plan.transfers.find((t) => t.reason === "overdraft");
  assert.equal(od.cents, 200, "60 below after its income, 100 of overdraft: the 2 of interest go on it");
  const past = [real(ME, { human: true, balanceCents: -20000, incomeCents: -1000 })];
  const deeper = planTurn(input({ civs: past, options: { guard: false } })).transfers.find((t) => t.reason === "overdraft");
  assert.equal(deeper.cents, 800, "200 below a 100 Gold limit: the 8 of interest go on the debt all the same");
  assert.equal(deeper.parts.past, 1);
});

test("a civ still below zero keeps the largest overdraft it had; back above zero the limit follows its income", () => {
  // Lab W11: 480 Gold at -48 a turn shrank to 100 at +12, and the seat climbing out read as past its overdraft.
  const first = planTurn(input({ civs: [real(ME, { human: true, balanceCents: -6000, incomeCents: -4800 })],
    options: { guard: false } }));
  assert.equal(first.ledger.lastBatch.civs[0].overdraft, 48000);
  const climbing = planTurn(input({ turn: 51, ledger: first.ledger, options: { guard: false },
    civs: [real(ME, { human: true, balanceCents: -16400, incomeCents: 1200 })] }));
  assert.equal(climbing.ledger.lastBatch.civs[0].overdraft, 48000, "held while below zero");
  assert.equal(climbing.overdrawn[String(ME)].past, false);
  const out = planTurn(input({ turn: 52, ledger: climbing.ledger, options: { guard: false },
    civs: [real(ME, { human: true, balanceCents: 500, incomeCents: 1200 })] }));
  assert.equal(out.ledger.lastBatch.civs[0].overdraft, 12000, "back above zero: 10 turns of 12");
});
