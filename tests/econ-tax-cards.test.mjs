// The tax cards' numbers and the Fiscal tab's forecast (DESIGN 4.7): War Levy pays only at war, the active card's
// share is taken out before another is put in, and the turns to the next celebration count as the game's own tooltip
// counts them.
import test from "node:test";
import assert from "node:assert/strict";
import { CARD_LEVELS, appliedPct, cardForecast, levelOf, rescale, turnsToCelebration } from "../ui/econ-tax-cards.js";

const read = (over = {}) => ({ goldCents: 2000, happinessCents: 1000, netHappinessCents: 800, celebrationLeftCents: 4000,
  celebrating: false, atWar: false, ...over });

test("the design's numbers: Light -15/+20, Heavy +15/-20, War Levy +30/-40 at war only", () => {
  assert.deepEqual(Object.entries(CARD_LEVELS).map(([k, v]) => [k, v.goldPct, v.happinessPct, v.needsWar]),
    [["LIGHT", -15, 20, false], ["HEAVY", 15, -20, false], ["WAR_LEVY", 30, -40, true]]);
  assert.deepEqual(appliedPct("WAR_LEVY", false), { goldPct: 0, happinessPct: 0 });
  assert.deepEqual(appliedPct("WAR_LEVY", true), { goldPct: 30, happinessPct: -40 });
  assert.deepEqual(appliedPct(null, true), { goldPct: 0, happinessPct: 0 });
  assert.deepEqual(appliedPct("NOPE", true), { goldPct: 0, happinessPct: 0 });
  assert.equal(levelOf("TRADITION_ECONOMICS_HEAVY_AQ"), "HEAVY");
});

test("rescale takes one percentage out and puts another in", () => {
  assert.equal(rescale(2300, 15, -15), 1700);
  assert.equal(rescale(1000, 0, 20), 1200);
  assert.equal(rescale(1000, 0, 0), 1000);
  assert.equal(rescale(500, -100, 20), 0, "nothing left to scale back");
  assert.equal(rescale(-300, 0, 15), -345);
});

test("turns to the next celebration: at least 1, none while the meter isn't filling", () => {
  assert.equal(turnsToCelebration(null, 10), null);
  assert.equal(turnsToCelebration(Number.NaN, 10), null);
  assert.equal(turnsToCelebration(0, 0), 1);
  assert.equal(turnsToCelebration(-50, 10), 1);
  assert.equal(turnsToCelebration(100, 0), null);
  assert.equal(turnsToCelebration(100, -5), null);
  assert.equal(turnsToCelebration(100, 30), 4);
  assert.equal(turnsToCelebration(30, 30), 1);
  assert.equal(turnsToCelebration(1, 1000), 1);
});

test("each card against no card: Gold and Happiness a turn, and the celebration it brings closer or pushes back", () => {
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration, f.paysNow];
  assert.deepEqual(shape(cardForecast("LIGHT", null, read())), [-300, 200, 4, true]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read())), [300, -200, 7, true]);
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read())), [0, 0, 5, false], "War Levy in peace pays nothing");
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read({ atWar: true }))), [600, -400, 10, true]);
  assert.deepEqual(shape(cardForecast(null, null, read())), [0, 0, 5, true]);
});

test("with a card slotted, its share comes out first; a running celebration has no next one to count", () => {
  const heavy = read({ goldCents: 2300, happinessCents: 800, netHappinessCents: 600 });
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration];
  assert.deepEqual(shape(cardForecast("LIGHT", "HEAVY", heavy)), [-600, 400, 4]);
  assert.deepEqual(shape(cardForecast(null, "HEAVY", heavy)), [-300, 200, 5]);
  assert.deepEqual(shape(cardForecast("HEAVY", "HEAVY", heavy)), [0, 0, 7]);
  assert.equal(cardForecast("LIGHT", null, read({ celebrating: true })).turnsToCelebration, null);
  assert.equal(cardForecast("HEAVY", null, read({ netHappinessCents: 100 })).turnsToCelebration, null,
    "Heavy taking more than the net leaves the meter empty");
});
