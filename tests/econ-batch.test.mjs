import test from "node:test";
import assert from "node:assert/strict";

import { addCelebration, batchStatus, celebrationPaidOf, commitBatch, createBatch, funds, lenderBalance, netOf,
  paidGrants, projected, record, wholeGold }
  from "../ui/econ-batch.js";
import { civ } from "./_fixtures.mjs";

const civs = [civ(2, { balanceCents: 1000, incomeCents: 300 }), civ(6, { balanceCents: 5000, incomeCents: 100 }),
  civ(9, { alive: false, balanceCents: 70, incomeCents: 50 })];
const t = (from, to, cents) => ({ loanId: "L1", turn: 1, from, to, cents });

test("funds: snapshot + income + world inflows - own payments; Gold from another civ counts next turn", () => {
  const b = createBatch(civs);
  assert.equal(funds(b, 2), 1300);
  assert.equal(funds(b, 9), 70, "a dead civ earns nothing");
  record(b, t("bond", 2, 500));
  assert.equal(funds(b, 2), 1800);
  record(b, t(6, 2, 400));
  assert.equal(funds(b, 2), 1800, "civ Gold is not spendable this turn (DESIGN 4.14)");
  assert.equal(projected(b, 2), 2200);
  assert.equal(funds(b, 6), 5100 - 400);
  record(b, t(2, "temple", 100));
  assert.equal(funds(b, 2), 1700);
  assert.equal(netOf(b, 2), 800);
  assert.equal(netOf(b, 6), -400);
});

test("a lender's balance for the 2 * P test is its snapshot less what it has committed this turn", () => {
  const b = createBatch(civs);
  assert.equal(lenderBalance(b, 6), 5000);
  b.committed.set(6, 1200);
  assert.equal(lenderBalance(b, 6), 3800);
});

test("the commit row: one line per living civ with its snapshot and its net Gold", () => {
  const b = createBatch(civs);
  record(b, t(6, 2, 400));
  const batch = commitBatch(b, { id: "B7", turn: 1, civs });
  assert.deepEqual(batch, { id: "B7", turn: 1, civs: [{ pid: 2, snapshot: 1000, net: 400, influence: 0, celebration: 0,
    paid: 400, carry: 0, celebrationPaid: 0, celebrationCarry: 0 }, { pid: 6, snapshot: 5000, net: -400, influence: 0,
    celebration: 0, paid: -400, carry: 0, celebrationPaid: 0, celebrationCarry: 0 }] });
});

test("the game pays whole Gold, toward zero, as grantYield does: 10.37 is 10, -2.9 is -2, 0.6 is nothing", () => {
  assert.deepEqual([1037, -290, 60, -60, 0, 100, -100].map(wholeGold), [1000, -200, 0, 0, 0, 100, -100]);
  assert.equal(Object.is(wholeGold(-60), -0), false, "never -0");
});

test("a part of a Gold carries to the civ's next batch, so 0.4 Gold a turn pays 1 Gold every few turns", () => {
  /** @type {any} */
  let prior = null;
  const paid = [];
  for (let turn = 1; turn <= 5; turn += 1) {
    const b = createBatch(civs);
    record(b, { loanId: "CY", turn, from: 2, to: "cycle", cents: 40, reason: "cycle" });
    addCelebration(b, 6, 70);
    prior = commitBatch(b, { id: `B${turn}`, turn, civs, prior });
    paid.push([prior.civs[0].paid, prior.civs[0].carry, prior.civs[1].celebrationPaid]);
  }
  assert.deepEqual(paid, [[0, -40, 0], [0, -80, 100], [-100, -20, 100], [0, -60, 0], [-100, 0, 100]],
    "-0.4 a turn: -1 Gold on turns 3 and 5, the rest carried; 0.7 celebration lands as 1 on turns 2, 3 and 5");
});

test("on load, a batch row is judged by what it paid: a part of a Gold that never moved the balance isn't lost", () => {
  const batch = { id: "B19", turn: 19, civs: [{ pid: 1, snapshot: 18458, net: -35, paid: 0, carry: -35 },
    { pid: 2, snapshot: 11100, net: -129, paid: -100, carry: -29 }, { pid: 3, snapshot: 3500, net: -46 }] };
  const balances = new Map([[1, 18458], [2, 11100], [3, 3500]]);
  assert.deepEqual(batchStatus(batch, balances), [{ pid: 1, status: "landed", cents: 0 },
    { pid: 2, status: "lost", cents: -100 }, { pid: 3, status: "landed", cents: 0 }],
    "a row saved before 0.5.4 is read as the game paid it: -0.46 is nothing");
  assert.deepEqual(paidGrants(batch), [{ pid: 1, cents: 0 }, { pid: 2, cents: -100 }, { pid: 3, cents: 0 }]);
  assert.equal(celebrationPaidOf({ pid: 1, snapshot: 0, net: 0, influence: 0, celebration: 250 }), 200);
});

test("on load, a balance at snapshot + income + net landed; at snapshot + income it was lost and is re-sent", () => {
  const batch = { id: "B7", turn: 1, civs: [{ pid: 2, snapshot: 1000, net: 400 }, { pid: 6, snapshot: 5000, net: -400 },
    { pid: 7, snapshot: 10, net: 0 }] };
  const incomes = new Map([[2, 300], [6, 100], [7, 0]]);
  const balances = new Map([[2, 1700], [6, 5100], [7, 10]]);
  assert.deepEqual(batchStatus(batch, balances, incomes), [{ pid: 2, status: "landed", cents: 0 },
    { pid: 6, status: "lost", cents: -400 }, { pid: 7, status: "landed", cents: 0 }]);
  assert.equal(batchStatus(batch, new Map([[2, 1234]]), incomes)[0].status, "unknown");
  assert.deepEqual(batchStatus(null, balances), []);
});
