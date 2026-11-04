// The standing Gold lines (econ-standing.js): each civ's lines for the next roll from the ledger after the turn, in
// whole Gold per loan and per bill so a lender's line matches its borrowers'; a borrower's charges stop at 90% of its
// income; the batch row takes what the lines moved at the roll off the grant, and a reload still tells a landed grant
// from a lost one.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { batchStatus, grantOf, paidOf } from "../ui/econ-batch.js";
import { chargeCents, markerType, parseMarkerType, rungsOf } from "../ui/econ-standing.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });
const ledgerWith = (loans) => ({ ...emptyLedger(), loans, nextId: loans.length + 1 });
const lines = (plan) => (plan.standing || []).map((row) => [row.pid, row.line, row.gold]);

test("rungs add up to the amount, largest first, and stop at 1,023", () => {
  assert.deepEqual(rungsOf(23), [16, 4, 2, 1]);
  assert.deepEqual(rungsOf(0), []);
  assert.deepEqual(rungsOf(-5), []);
  assert.deepEqual(rungsOf(2000), [512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
  assert.equal(markerType("DEBT", 16), "BUILDING_ECON_LINE_DEBT_16");
  assert.deepEqual(parseMarkerType("BUILDING_ECON_LINE_BILLIN_512"), { line: "BILLIN", rung: 512 });
  assert.equal(parseMarkerType("BUILDING_ECON_LINE_DEBT_3"), null, "only the ladder's rungs");
  assert.equal(parseMarkerType("BUILDING_PALACE"), null);
  assert.equal(chargeCents([{ line: "DEBT", rung: 16 }, { line: "DEBT", rung: 4 }, { line: "LOAN", rung: 2 }]), -1800);
});

test("next turn's loan payment becomes a Debt service line; a civ lender gets the same Gold as Loan repayments", () => {
  const civLoan = loan("L1", { lender: AI });
  const plan = planTurn(input({ ledger: ledgerWith([civLoan]),
    civs: [civ(ME, { incomeCents: 10000 }), civ(AI, { incomeCents: 10000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 20], [AI, "LOAN", 20]], "2070 due next turn: 20 whole Gold each side");
});

test("a bond's borrower gets a Debt service line and nobody gets the repayment line", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [civ(ME, { incomeCents: 10000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 20]]);
});

test("a borrower's lines stop at 90% of its income, oldest loan first", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1"), loan("L2", { opened: 2 })]),
    civs: [civ(ME, { human: true, incomeCents: 3000, balanceCents: 100000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 27]], "two payments of 20, room for 27");
  const broke = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { human: true, incomeCents: -500, balanceCents: 100000 })] }));
  assert.deepEqual(lines(broke), [], "no room under an income below 0");
});

test("the batch row carries what the lines moved at the roll, and the grant takes it off", () => {
  // The roll took 20 Gold; the glue counted it back into the balance, so the plan pays as if it hadn't.
  const plain = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [civ(ME, { incomeCents: 10000 })] }));
  const charged = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { incomeCents: 10000, engineCents: -2000 })] }));
  const row = charged.batch.civs[0];
  assert.equal(row.engine, -2000);
  assert.equal(paidOf(row), paidOf(plain.batch.civs[0]), "the plan's payment doesn't change");
  assert.equal(grantOf(row), paidOf(row) + 2000, "the 20 the roll took comes off what the grant takes");
  assert.equal(plain.batch.civs[0].engine, undefined, "no lines, no field");
  assert.deepEqual(checkPlan({ plan: charged, civs: [civ(ME, { incomeCents: 10000 })] }), []);
  const kept = load(save(charged.ledger));
  assert.equal(kept.ledger.lastBatch.civs[0].engine, -2000, "the save keeps it");
});

test("on reload a grant that landed and one that was lost are told apart with the lines' charge", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { incomeCents: 10000, engineCents: -2000 })] }));
  const row = plan.batch.civs[0];
  const raw = row.snapshot + row.engine;
  const landed = batchStatus(plan.batch, new Map([[ME, raw + grantOf(row)]]))[0];
  assert.equal(landed.status, "landed");
  const lost = batchStatus(plan.batch, new Map([[ME, raw]]))[0];
  assert.deepEqual([lost.status, lost.cents], ["lost", grantOf(row)], "re-sent as the grant, not the payment");
});

test("this turn's trade bill stands as next turn's Trade bills lines", () => {
  const plan = planTurn(input({ ledger: emptyLedger(), civs: [civ(ME, { incomeCents: 10000 }), civ(AI)] }));
  const trade = plan.transfers.find((t) => t.reason === "trade");
  if (!trade) { assert.deepEqual(lines(plan), []); return; }
  const gold = Math.floor(trade.cents / 100);
  assert.deepEqual(lines(plan).filter(([, line]) => line.startsWith("BILL")),
    gold ? [[trade.from, "BILL", gold], [trade.to, "BILLIN", gold]].sort((a, b) => a[0] - b[0]) : []);
});
