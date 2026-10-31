import test from "node:test";
import assert from "node:assert/strict";

import { BASE_RATE_PPM, STAKE, engineLines, isWorldAccount, purchasePointCents, ratesPct, relationshipBands }
  from "../ui/econ-params.js";
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

test("base rates: 0.015 in Antiquity, 0.01 in Exploration, 0.0075 in Modern (DESIGN 4.3)", () => {
  assert.deepEqual(BASE_RATE_PPM, { AGE_ANTIQUITY: 15000, AGE_EXPLORATION: 10000, AGE_MODERN: 7500 });
});

test("world accounts: the named accounts are the only parties that are not a player id", () => {
  for (const id of ["bond", "temple", "tax", "progress", "citizens", "inflation", "cycle", "plan"]) {
    assert.equal(isWorldAccount(id), true, id);
  }
  assert.equal(isWorldAccount(3), false);
  assert.equal(isWorldAccount("treasury"), false);
});

test("rates option: unknown falls back to standard", () => {
  assert.equal(ratesPct("low"), 75);
  assert.equal(ratesPct("high"), 125);
  assert.equal(ratesPct("nonsense"), 100);
});

test("the purchase rate: GOLD_PURCHASE_MULTIPLIER in cents from either row shape; anything else is null", () => {
  assert.equal(purchasePointCents([{ Name: "X", Value: 1 }, { Name: "GOLD_PURCHASE_MULTIPLIER", Value: 4 }]), 400);
  assert.equal(purchasePointCents({ GOLD_PURCHASE_MULTIPLIER: "2.5" }), 250, "another mod's value wins");
  assert.equal(purchasePointCents({ GOLD_PURCHASE_MULTIPLIER: 0 }), null);
  assert.equal(purchasePointCents({ GOLD_PURCHASE_MULTIPLIER: "x" }), null);
  assert.equal(purchasePointCents({ GOLD_PURCHASE_MULTIPLIER: null }), null);
  assert.equal(purchasePointCents([{ Name: "GOLD_PURCHASE_MULTIPLIER" }]), null);
  assert.equal(purchasePointCents([null]), null);
  assert.equal(purchasePointCents(null), null);
  assert.equal(purchasePointCents({}), null);
});

test("relationship bands: the game's band edges times its scale; a missing row or scale leaves STAKE's number", () => {
  const rows = { DIPLOMACY_RELATIONSHIP_CHARACTERISTIC_SCALE: "30" };
  const bands = [{ DiplomacyPlayerRelationshipType: "PLAYER_RELATIONSHIP_HOSTILE", MinRelationship: -30, MaxRelationship: -2 },
    { DiplomacyPlayerRelationshipType: "PLAYER_RELATIONSHIP_FRIENDLY", MinRelationship: 1, MaxRelationship: 2 }];
  assert.deepEqual(relationshipBands(rows, bands), { friendlyLevel: 30, hostileLevel: -60 });
  assert.deepEqual(relationshipBands([{ Name: "DIPLOMACY_RELATIONSHIP_CHARACTERISTIC_SCALE", Value: 25 }], bands),
    { friendlyLevel: 25, hostileLevel: -50 }, "another mod's scale is read as it stands");
  assert.deepEqual(relationshipBands(rows, [bands[1]]), { friendlyLevel: 30, hostileLevel: STAKE.hostileLevel });
  assert.deepEqual(relationshipBands({}, bands), { friendlyLevel: STAKE.friendlyLevel, hostileLevel: STAKE.hostileLevel });
  assert.deepEqual(relationshipBands(null, null), { friendlyLevel: 30, hostileLevel: -60 }, "the fallbacks are the 1.5.0 bands");
});
