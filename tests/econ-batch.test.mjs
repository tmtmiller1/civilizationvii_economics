import test from "node:test";
import assert from "node:assert/strict";

import { batchStatus, commitBatch, createBatch, funds, lenderBalance, netOf, projected, record }
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
  assert.deepEqual(batch, { id: "B7", turn: 1, civs: [{ pid: 2, snapshot: 1000, net: 400, influence: 0, celebration: 0 },
    { pid: 6, snapshot: 5000, net: -400, influence: 0, celebration: 0 }] });
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
