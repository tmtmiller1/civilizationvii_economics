// The tax cards' numbers and the Fiscal tab's forecast (DESIGN 4.7): flat amounts in each settlement, War Levy pays a
// small part in peace and the rest at war, the active card's amounts come out before another's go in, and the turns
// to the next celebration count as the game's own tooltip counts them.
import test from "node:test";
import assert from "node:assert/strict";
import { CARD_LEVELS, appliedAmounts, atWarAmounts, cardForecast, levelOf, turnsToCelebration }
  from "../ui/econ-tax-cards.js";

const read = (over = {}) => ({ goldCents: 2000, happinessCents: 1000, netHappinessCents: 800, settlements: 2,
  celebrationLeftCents: 4000, celebrating: false, atWar: false, ...over });

test("the cards' numbers: Light -1/+6, Heavy +4/-2, War Levy +2/-1 in peace and +8/-4 at war, in each settlement", () => {
  assert.deepEqual(Object.entries(CARD_LEVELS).map(([k, v]) => [k, v.gold, v.happiness, v.atWar]),
    [["LIGHT", -1, 6, null], ["HEAVY", 4, -2, null], ["WAR_LEVY", 2, -1, { gold: 6, happiness: -3 }]]);
  assert.deepEqual(appliedAmounts("WAR_LEVY", false), { gold: 2, happiness: -1 });
  assert.deepEqual(appliedAmounts("WAR_LEVY", true), { gold: 8, happiness: -4 });
  assert.deepEqual(atWarAmounts("WAR_LEVY"), { gold: 8, happiness: -4 });
  assert.deepEqual(atWarAmounts("LIGHT"), { gold: -1, happiness: 6 }, "Light and Heavy don't change at war");
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
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration];
  assert.deepEqual(shape(cardForecast("LIGHT", null, read())), [-200, 1200, 2]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read())), [800, -400, 10]);
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read())), [400, -200, 7], "War Levy in peace: its small part");
  assert.deepEqual(shape(cardForecast("WAR_LEVY", null, read({ atWar: true }))), [1600, -800, null],
    "the levy takes all the net Happiness, so the meter stops");
  assert.deepEqual(shape(cardForecast(null, null, read())), [0, 0, 5]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: 5 }))), [2000, -1000, null],
    "the amounts grow with the settlements");
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: Number.NaN }))), [0, 0, 5]);
  assert.deepEqual(shape(cardForecast("HEAVY", null, read({ settlements: -3 }))), [0, 0, 5]);
});

test("with a card slotted, its amounts come out first; a running celebration has no next one to count", () => {
  const heavy = read({ netHappinessCents: 600, settlements: 3 });
  const shape = (f) => [f.goldDeltaCents, f.happinessDeltaCents, f.turnsToCelebration];
  assert.deepEqual(shape(cardForecast("LIGHT", "HEAVY", heavy)), [-1500, 2400, 2]);
  assert.deepEqual(shape(cardForecast("WAR_LEVY", "HEAVY", heavy)), [-600, 300, 5], "War Levy in peace against Heavy");
  assert.deepEqual(shape(cardForecast("LIGHT", "WAR_LEVY", read({ atWar: true }))), [-1800, 2000, 2],
    "Light at war against a slotted War Levy: the levy's at-war part comes out too");
  assert.deepEqual(shape(cardForecast(null, "HEAVY", heavy)), [-1200, 600, 4]);
  assert.deepEqual(shape(cardForecast("HEAVY", "HEAVY", heavy)), [0, 0, 7]);
  assert.deepEqual(shape(cardForecast("HEAVY", "WAR_LEVY", read({ atWar: true }))), [-800, 400, 4]);
  assert.equal(cardForecast("LIGHT", null, read({ celebrating: true })).turnsToCelebration, null);
  assert.equal(cardForecast("HEAVY", null, read({ netHappinessCents: 300 })).turnsToCelebration, null,
    "Heavy taking more than the net leaves the meter empty");
});
