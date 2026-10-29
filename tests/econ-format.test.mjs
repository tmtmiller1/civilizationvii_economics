import test from "node:test";
import assert from "node:assert/strict";
import { formatFactor, formatGold, formatPct, formatRate } from "../ui/econ-format.js";

test("Gold shows whole amounts without decimals and others with one; signed adds a plus", () => {
  assert.equal(formatGold(12000), "120");
  assert.equal(formatGold(12050), "120.5");
  assert.equal(formatGold(-450), "-4.5");
  assert.equal(formatGold(0, { signed: true }), "0");
  assert.equal(formatGold(1200, { signed: true }), "+12");
  assert.equal(formatGold(-1200, { signed: true }), "-12");
  assert.equal(formatGold(NaN), "0");
});

test("rates, percentages and factors", () => {
  assert.equal(formatRate(30000), "3.0%");
  assert.equal(formatRate(26250), "2.6%");
  assert.equal(formatPct(15), "+15%");
  assert.equal(formatPct(-20), "-20%");
  assert.equal(formatPct(0), "0%");
  assert.equal(formatFactor(90), "x0.90");
  assert.equal(formatFactor(NaN), "x1.00");
});
