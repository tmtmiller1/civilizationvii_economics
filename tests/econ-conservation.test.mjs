import test from "node:test";
import assert from "node:assert/strict";

import { applyGrants, conservationGap, grantsFor, netGrants, sumOf, unbalancedPairs, worldNet, worldNetByAccount }
  from "../ui/econ-conservation.js";

const t = (from, to, cents, loanId = "L1") => ({ loanId, turn: 4, from, to, cents, reason: "payment" });

test("a civ-to-civ transfer is two grants that sum to zero", () => {
  const g = grantsFor([t(2, 6, 500)]);
  assert.deepEqual(g, [{ pid: 2, cents: -500, key: "L1:4" }, { pid: 6, cents: 500, key: "L1:4" }]);
  assert.equal(g[0].cents + g[1].cents, 0);
  assert.deepEqual(unbalancedPairs(g, [t(2, 6, 500)]), []);
});

test("a world-account transfer is a single grant; bond, temple and tax are the only non-zero-sum parties", () => {
  assert.deepEqual(grantsFor([t("bond", 2, 300)]), [{ pid: 2, cents: 300, key: "L1:4" }]);
  assert.deepEqual(grantsFor([t(2, "temple", 300)]), [{ pid: 2, cents: -300, key: "L1:4" }]);
  const tr = [t("bond", 2, 300), t(3, "bond", 100), t(3, 4, 999), t("temple", 5, 50), t(5, "tax", 20)];
  assert.deepEqual([...worldNetByAccount(tr)], [["bond", 200], ["temple", 50], ["tax", -20]]);
  assert.equal(worldNet(tr), 230);
});

test("an unbalanced civ pair is reported by its key", () => {
  const tr = [t(2, 6, 500)];
  assert.deepEqual(unbalancedPairs([{ pid: 2, cents: -500, key: "L1:4" }, { pid: 6, cents: 499, key: "L1:4" }], tr),
    ["L1:4"]);
});

test("net grants: one figure per civ, which is what the commit step sends", () => {
  const g = grantsFor([t(2, 6, 400, "L1"), t("bond", 2, 250, "L2"), t(6, "bond", 50, "L3")]);
  assert.deepEqual([...netGrants(g)], [[2, -150], [6, 350]]);
});

test("ledger-wide sum: the civ total moves only by income and world-account flows", () => {
  const before = new Map([[2, 1000], [6, 5000], [9, 0]]);
  const transfers = [t(2, 6, 400, "L1"), t("bond", 9, 250, "L2"), t(6, "temple", 50, "L3")];
  const withIncome = new Map([[2, 1100], [6, 5100], [9, 100]]);
  const after = applyGrants(withIncome, grantsFor(transfers));
  assert.equal(sumOf(after), 6000 + 300 + 250 - 50);
  assert.equal(conservationGap({ before, after, incomeTotal: 300, transfers }), 0);
  after.set(6, after.get(6) + 1);
  assert.equal(conservationGap({ before, after, incomeTotal: 300, transfers }), 1);
});
