import test from "node:test";
import assert from "node:assert/strict";

import { emergencyCap, guardDecision, isInsolvent } from "../ui/econ-guard.js";
import { ENGINE } from "./_fixtures.mjs";

const at = (over = {}) => guardDecision({ enabled: true, projectedCents: -1500, upkeepCents: 700,
  lineCents: ENGINE.amenityLineCents, firedTurn: undefined, turn: 9, openEmergencyCents: 0, incomeCents: 1000,
  ...over });

test("the guard fires below the amenity line (0) and borrows back to it plus one turn of upkeep", () => {
  assert.deepEqual(at(), { fire: true, principal: 1500 + 700, reason: "below-line" });
  assert.equal(at({ projectedCents: -1 }).fire, true, "between 0 and the disband line is covered (finding B)");
  assert.equal(at({ projectedCents: 0 }).reason, "above-line");
});

test("the guard is off when disabled, with no line, or after firing this turn", () => {
  assert.equal(at({ enabled: false }).reason, "off");
  assert.equal(at({ lineCents: null }).reason, "no-line");
  assert.equal(at({ firedTurn: 9 }).reason, "already-fired");
  assert.equal(at({ firedTurn: 8 }).fire, true);
});

test("emergency_cap = max(100 Gold, 10 * |income|); the guard stops where the next loan would pass it", () => {
  assert.equal(emergencyCap(0), 10000);
  assert.equal(emergencyCap(500), 10000);
  assert.equal(emergencyCap(-3000), 30000);
  assert.equal(emergencyCap(3000), 30000);
  assert.equal(at({ openEmergencyCents: 7800 }).fire, true, "7800 + 2200 = the cap");
  assert.deepEqual(at({ openEmergencyCents: 7801 }), { fire: false, principal: 2200, reason: "at-cap" });
  assert.equal(at({ openEmergencyCents: 20000, incomeCents: -2300 }).fire, true, "the cap grows with |income|");
});

test("insolvent after 5 turns running at or below 0 income", () => {
  assert.equal(isInsolvent(4), false);
  assert.equal(isInsolvent(5), true);
});

test("a negative upkeep reading adds nothing", () => {
  assert.equal(at({ upkeepCents: -50 }).principal, 1500);
});
