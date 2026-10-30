import test from "node:test";
import assert from "node:assert/strict";

import { aliveTargets, checkPlan, debt1, debt2, debt3, debt4, debt5, debt6, debt7, econ3 } from "../ui/econ-invariants.js";
import { grantsFor } from "../ui/econ-conservation.js";
import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { civ, input } from "./_fixtures.mjs";

const tr = (loanId, from, to, cents, turn = 3) => ({ loanId, turn, from, to, cents, reason: "payment" });

test("a real plan passes every invariant", () => {
  const civs = [civ(1, { human: true, balanceCents: 100 }), civ(4, { balanceCents: -5000, incomeCents: -1000 }),
    civ(8, { balanceCents: 1e6 })];
  const requests = [{ kind: "borrow", borrower: 1, lender: 8, principal: 1000, term: 10 }];
  const plan = planTurn(input({ civs, requests }));
  assert.ok(plan.transfers.length >= 2);
  assert.deepEqual(checkPlan({ plan, civs, envelopeText: "{}" }), []);
});

test("debt-1 fails when a civ pair does not sum to zero", () => {
  const t = [tr("L1", 2, 6, 500)];
  assert.deepEqual(debt1(grantsFor(t), t), []);
  const bad = [{ pid: 2, cents: -500, key: "L1:3" }, { pid: 6, cents: 501, key: "L1:3" }];
  assert.equal(debt1(bad, t)[0].id, "debt-1");
});

test("debt-2 fails on negative outstanding and on an active loan at three misses", () => {
  const ok = { ...emptyLedger(), loans: [{ id: "L1", outstanding: 0, state: "active", missed: 2 }] };
  assert.deepEqual(debt2(ok), []);
  assert.equal(debt2({ ...ok, loans: [{ id: "L1", outstanding: -1, state: "closed", missed: 0 }] }).length, 1);
  assert.equal(debt2({ ...ok, loans: [{ id: "L1", outstanding: 5, state: "active", missed: 3 }] }).length, 1);
  assert.deepEqual(debt2({ ...ok, loans: [{ id: "L1", outstanding: 5, state: "default", missed: 3 }] }), []);
});

test("debt-3 fails on a second transfer for one (loan, turn), in a plan or against what was already sent", () => {
  assert.deepEqual(debt3([tr("L1", 2, 6, 5), tr("L1", 2, 6, 5, 4)]), []);
  assert.equal(debt3([tr("L1", 2, 6, 5), tr("L1", 2, 6, 7)]).length, 1);
  assert.equal(debt3([tr("L1", 2, 6, 5)], new Set(["L1:3"])).length, 1);
});

test("debt-4 fails when the guard fires twice for one civ in one turn", () => {
  assert.deepEqual(debt4([{ kind: "guard", pid: 1, turn: 3 }, { kind: "guard", pid: 1, turn: 4 },
    { kind: "guard", pid: 2, turn: 3 }, { kind: "miss", pid: 1, turn: 3 }]), []);
  assert.equal(debt4([{ kind: "guard", pid: 1, turn: 3 }, { kind: "guard", pid: 1, turn: 3 }]).length, 1);
});

test("debt-5 fails past 64 KB", () => {
  assert.deepEqual(debt5("x".repeat(65536)), []);
  assert.equal(debt5("x".repeat(65537)).length, 1);
});

test("debt-6 fails when a payer goes past its snapshot + income + world inflows", () => {
  const civs = [civ(2, { balanceCents: 100, incomeCents: 50 }), civ(6)];
  assert.deepEqual(debt6([tr("L1", 2, 6, 150)], civs), []);
  assert.equal(debt6([tr("L1", 2, 6, 151)], civs).length, 1);
  assert.deepEqual(debt6([tr("L1", "bond", 2, 100), tr("L2", 2, 6, 250)], civs), [], "bond principal counts");
  assert.equal(debt6([tr("L1", 6, 2, 100), tr("L2", 2, 6, 250)], civs).length, 1, "civ inflows don't");
});

test("debt-7 fails when the civ grants don't net to the world accounts' flow", () => {
  const t = [tr("L1", "bond", 2, 300), tr("L2", 2, 6, 100), tr("L3", 6, "temple", 40)];
  assert.deepEqual(debt7(grantsFor(t), t), []);
  assert.equal(debt7([{ pid: 2, cents: 1, key: "x" }], t).length, 1);
});

test("alive-target fails on a grant to a dead or unknown player, or to a world account", () => {
  const civs = [civ(1), civ(2, { alive: false })];
  assert.deepEqual(aliveTargets([{ pid: 1, cents: 1, key: "k" }], civs), []);
  assert.equal(aliveTargets([{ pid: 2, cents: 1, key: "k" }], civs).length, 1);
  assert.equal(aliveTargets([{ pid: 3, cents: 1, key: "k" }], civs).length, 1);
  assert.equal(aliveTargets([{ pid: "bond", cents: 1, key: "k" }], civs).length, 1);
  assert.equal(aliveTargets([{ pid: "temple", cents: 1, key: "k" }], civs).length, 1);
});

test("econ-3: one progress grant per city per turn", () => {
  assert.deepEqual(econ3([{ host: 1, cityId: "1:1", amount: 5, investmentId: "I1" },
    { host: 1, cityId: "1:2", amount: 5, investmentId: "I2" }]), []);
  assert.deepEqual(econ3([{ host: 1, cityId: "1:1", amount: 5, investmentId: "I1" },
    { host: 1, cityId: "1:1", amount: 5, investmentId: "A2-1" }]), [{ id: "econ-3", detail: "1:1" }]);
  assert.deepEqual(econ3(undefined), []);
});
