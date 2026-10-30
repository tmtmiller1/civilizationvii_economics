// World prices (DESIGN 4.9; TEST-PLAN 12.1): class base prices, the scarcity clamp, the demand terms, smoothing, and a
// resource the table no longer lists dropping out.
import test from "node:test";
import assert from "node:assert/strict";
import { anyWar, basePriceCents, demandPct, nextPrices, priceOf, scarcityPct, smoothPrice, targetPriceCents }
  from "../ui/econ-prices.js";
import { emptyMarkets } from "../ui/econ-markets.js";

test("base price by class, an unknown class priced as Bonus", () => {
  assert.equal(basePriceCents("RESOURCECLASS_BONUS"), 200);
  assert.equal(basePriceCents("RESOURCECLASS_CITY"), 300);
  assert.equal(basePriceCents("RESOURCECLASS_EMPIRE"), 400);
  assert.equal(basePriceCents("RESOURCECLASS_TREASURE"), 500);
  assert.equal(basePriceCents("RESOURCECLASS_FACTORY"), 600);
  assert.equal(basePriceCents("RESOURCECLASS_MODDED"), 200);
  assert.equal(basePriceCents("toString"), 200, "an inherited name isn't a class");
});

test("scarcity = sqrt(civs / copies), clamped 0.5 to 3.0, with no copies counted as one", () => {
  assert.equal(scarcityPct(8, 8), 100);
  assert.equal(scarcityPct(8, 2), 200);
  assert.equal(scarcityPct(8, 32), 50);
  assert.equal(scarcityPct(8, 200), 50, "floor");
  assert.equal(scarcityPct(12, 1), 300, "ceiling: sqrt(12) is 3.46");
  assert.equal(scarcityPct(12, 0), 300, "no copies at all reads as one");
  assert.equal(scarcityPct(4, 9), 67);
  assert.equal(scarcityPct(-3, 4), 50, "a negative civ count reads as none");
});

test("demand: +0.25 for this age's strategic resources, +0.25 more at war, Industry up to +1.0 for Factory", () => {
  assert.equal(demandPct({ strategic: false, war: false, factory: false, industry: 0 }), 100);
  assert.equal(demandPct({ strategic: false, war: true, factory: false, industry: 0 }), 100, "war alone adds nothing");
  assert.equal(demandPct({ strategic: true, war: false, factory: false, industry: 0 }), 125);
  assert.equal(demandPct({ strategic: true, war: true, factory: false, industry: 0 }), 150);
  assert.equal(demandPct({ strategic: false, war: false, factory: true, industry: 10 }), 120);
  assert.equal(demandPct({ strategic: false, war: false, factory: true, industry: 80 }), 200, "at most +1.0");
  assert.equal(demandPct({ strategic: false, war: false, factory: false, industry: 80 }), 100, "Industry is Factory only");
  assert.equal(demandPct({ strategic: false, war: false, factory: true, industry: -4 }), 100);
  assert.equal(demandPct({ strategic: false, war: false, factory: true, industry: 2.9 }), 104, "whole buildings");
});

test("target = base * scarcity * demand, in cents", () => {
  const iron = { type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" };
  assert.equal(targetPriceCents(iron, { civs: 8, copies: 2, strategic: true, war: true, industry: 0 }), 1200);
  assert.equal(targetPriceCents(iron, { civs: 8, copies: 8, strategic: false, war: false, industry: 0 }), 400);
  const oil = { type: "RESOURCE_OIL", class: "RESOURCECLASS_FACTORY" };
  assert.equal(targetPriceCents(oil, { civs: 8, copies: 8, strategic: false, war: false, industry: 25 }), 900);
});

test("smoothing 0.8 / 0.2 toward the target; a new resource starts at its target", () => {
  assert.equal(smoothPrice(undefined, 500), 500);
  assert.equal(smoothPrice(1000, 500), 900);
  assert.equal(smoothPrice(1000, 500, 50), 750, "the Capitalism stage's 0.5");
  assert.equal(smoothPrice(1003, 1000), 1002);
});

test("next prices follow the table read: a removed resource drops out, history keeps 30 turns", () => {
  const market = { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" },
    { type: "RESOURCE_WINE", class: "RESOURCECLASS_CITY" }, null, { class: "RESOURCECLASS_CITY" }],
  copies: { RESOURCE_IRON: 2 }, strategic: ["RESOURCE_IRON"], industry: 0 };
  const previous = { ...emptyMarkets(), prices: { RESOURCE_IRON: 1000, RESOURCE_GONE: 300 },
    history: { RESOURCE_IRON: Array.from({ length: 30 }, (_, i) => i), RESOURCE_GONE: [300] } };
  const next = nextPrices({ market, previous, civs: 8, war: false });
  assert.deepEqual(Object.keys(next.prices).sort(), ["RESOURCE_IRON", "RESOURCE_WINE"]);
  assert.equal(next.prices.RESOURCE_IRON, 1000, "target 1000 (400 * 2.0 * 1.25), smoothing holds it");
  assert.equal(next.prices.RESOURCE_WINE, 849, "no copies: counted as one, scarcity sqrt(8), starts at the target");
  assert.equal(next.history.RESOURCE_IRON.length, 30);
  assert.equal(next.history.RESOURCE_IRON[29], 1000);
  assert.equal(next.history.RESOURCE_IRON[0], 1);
  assert.deepEqual(next.history.RESOURCE_WINE, [849]);
  assert.equal(next.history.RESOURCE_GONE, undefined);
  const atWar = nextPrices({ market, previous, civs: 8, war: true });
  assert.equal(atWar.prices.RESOURCE_IRON, 1040, "war lifts the strategic target to 1200");
  assert.deepEqual(nextPrices({ market: { resources: [] }, previous, civs: 8, war: false }).prices, {});
});

test("price of a copy for the bill; war read from the relations", () => {
  assert.equal(priceOf({ A: 250 }, "A"), 250);
  assert.equal(priceOf({ A: 250 }, "B"), 0);
  assert.equal(anyWar([{ a: 1, b: 2, level: "neutral" }]), false);
  assert.equal(anyWar([{ a: 1, b: 2, level: "neutral" }, { a: 2, b: 3, level: "war" }]), true);
  assert.equal(anyWar([]), false);
});
