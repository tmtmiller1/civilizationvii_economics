// The tax cards' numbers and the Fiscal tab's forecast (DESIGN 4.7): flat amounts in each settlement, War Levy pays
// only at war, the active card's amounts come out before another's go in, and the turns to the next celebration
// count as the game's own tooltip counts them.
import test from "node:test";
import assert from "node:assert/strict";
import { CARD_LEVELS, appliedAmounts, cardForecast, levelOf, turnsToCelebration } from "../ui/econ-tax-cards.js";

const read = (over = {}) => ({ goldCents: 2000, happinessCents: 1000, netHappinessCents: 800, settlements: 2,
  celebrationLeftCents: 4000, celebrating: false, atWar: false, ...over });

test("the cards' numbers: Light -2/+4, Heavy +4/-2, War Levy +8/-4 in each settlement, at war only", () => {
  assert.deepEqual(Object.entries(CARD_LEVELS).map(([k, v]) => [k, v.gold, v.happiness, v.needsWar]),
    [["LIGHT", -2, 4, false], ["HEAVY", 4, -2, false], ["WAR_LEVY", 8, -4, true]]);
  assert.deepEqual(appliedAmounts("WAR_LEVY", false), { gold: 0, happiness: 0 });
  assert.deepEqual(appliedAmounts("WAR_LEVY", true), { gold: 8, happiness: -4 });
  assert.deepEqual(appliedAmounts("HEAVY", false), { gold: 4, happiness: -2 });
  assert.deepEqual(appliedAmounts(null, true), { gold: 0, happiness: 0 });
  assert.deepEqual(appliedAmounts("NOPE", true), { gold: 0, happiness: 0 });
  assert.equal(levelOf("TRADITION_ECONOMICS_HEAVY_AQ"), "HEAVY");
  assert.equal(levelOf("TRADITION_ECONOMICS_WAR_LEVY_MO"), "WAR_LEVY");
  assert.equal(levelOf("TRADITION_ECONOMICS_NOPE_AQ"), null);
  assert.equal(levelOf("TRADITION_OTHER_HEAVY_AQ"), null);
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

test("each card against no card on two settlements: Gold and Happiness a turn, and the celebration it moves", () => {
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration, f.paysNow];
  assert.deepEqual(shape(cardForecast("LIGHT", null, read())), [-400, 800, 3, true]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read())), [800, -400, 10, true]);
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read())), [0, 0, 5, false], "War Levy in peace pays nothing");
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read({ atWar: true }))), [1600, -800, null, true],
    "the levy takes all the net Happiness, so the meter stops");
  assert.deepEqual(shape(cardForecast(null, null, read())), [0, 0, 5, true]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: 5 }))), [2000, -1000, null, true],
    "the amounts grow with the settlements");
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: Number.NaN }))), [0, 0, 5, true]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: -3 }))), [0, 0, 5, true]);
});

test("with a card slotted, its amounts come out first; a running celebration has no next one to count", () => {
  const heavy = read({ netHappinessCents: 600, settlements: 3 });
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration];
  assert.deepEqual(shape(cardForecast("LIGHT", "HEAVY", heavy)), [-1800, 1800, 2]);
  assert.deepEqual(shape(cardForecast(null, "HEAVY", heavy)), [-1200, 600, 4]);
  assert.deepEqual(shape(cardForecast("HEAVY", "HEAVY", heavy)), [0, 0, 7]);
  assert.deepEqual(shape(cardForecast("HEAVY", "WAR_LEVY", read({ atWar: true }))), [-800, 400, 4]);
  assert.equal(cardForecast("LIGHT", null, read({ celebrating: true })).turnsToCelebration, null);
  assert.equal(cardForecast("HEAVY", null, read({ netHappinessCents: 300 })).turnsToCelebration, null,
    "Heavy taking more than the net leaves the meter empty");
});
