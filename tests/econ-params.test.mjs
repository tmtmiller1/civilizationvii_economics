import test from "node:test";
import assert from "node:assert/strict";

import { BASE_RATE_PPM, engineLines, isWorldAccount, ratesPct } from "../ui/econ-params.js";
import { ENGINE } from "./_fixtures.mjs";

test("engine lines: the 1.5.0 gameplay DB fixture gives the -10 disband line and the 0 amenity line", () => {
  assert.equal(ENGINE.disbandLineCents, -1000);
  assert.equal(ENGINE.amenityLineCents, 0);
});

test("engine lines: rows as an array read the same; a missing or unreadable line is null", () => {
  const rows = [{ Name: "GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE", Value: "-25" }, null, { Value: 3 }];
  assert.deepEqual(engineLines(rows), { disbandLineCents: -2500, amenityLineCents: null });
  assert.deepEqual(engineLines({ GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE: "x" }).disbandLineCents, null);
  assert.deepEqual(engineLines(null), { disbandLineCents: null, amenityLineCents: null });
});

test("base rates: 0.03 in Antiquity, 0.02 in Exploration, 0.015 in Modern (DESIGN 4.3)", () => {
  assert.deepEqual(BASE_RATE_PPM, { AGE_ANTIQUITY: 30000, AGE_EXPLORATION: 20000, AGE_MODERN: 15000 });
});

test("world accounts: bond, temple and tax are the only parties that are not a player id", () => {
  assert.equal(isWorldAccount("bond"), true);
  assert.equal(isWorldAccount("temple"), true);
  assert.equal(isWorldAccount("tax"), true);
  assert.equal(isWorldAccount(3), false);
  assert.equal(isWorldAccount("citizens"), false, "1.2's account is not in 1.0");
});

test("rates option: unknown falls back to standard", () => {
  assert.equal(ratesPct("low"), 75);
  assert.equal(ratesPct("high"), 125);
  assert.equal(ratesPct("nonsense"), 100);
});
