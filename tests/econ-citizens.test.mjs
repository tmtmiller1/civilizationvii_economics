// Citizen loans and the plan (DESIGN 4.17; TEST-PLAN 12.1 econ-systems): the cap per market town, the rate, the
// celebration the interest buys, a miss and a repudiation at home, the AI's rule; the plan's take and split.
import test from "node:test";
import { CITIZEN } from "../ui/econ-params.js";
import { cardAmounts } from "../ui/econ-tax-cards.js";
import assert from "node:assert/strict";
import { aiCitizenPrincipal, citizenCapCents, citizenRatePpm, interestCelebrationCents, missCelebrationCents,
  repudiationCelebrationCents } from "../ui/econ-citizens.js";
import { planSplit, planTakeCents, pointPriceCents } from "../ui/econ-planned.js";

test("citizen_cap: 5 turns of max(10, income) per settlement with a Commerce building, less what's owed", () => {
  assert.equal(citizenCapCents({ incomeCents: 2000, commerceSettlements: 2, owedCents: 0 }), 20000);
  assert.equal(citizenCapCents({ incomeCents: 500, commerceSettlements: 2, owedCents: 0 }), 10000, "income at least 10");
  assert.equal(citizenCapCents({ incomeCents: 2000, commerceSettlements: 2, owedCents: 15000 }), 5000);
  assert.equal(citizenCapCents({ incomeCents: 2000, commerceSettlements: 2, owedCents: 50000 }), 0);
  assert.equal(citizenCapCents({ incomeCents: 2000, commerceSettlements: 0, owedCents: 0 }), 0, "no market towns");
  assert.equal(citizenCapCents({ incomeCents: 2000, commerceSettlements: -1.5, owedCents: -5 }), 0);
});

test("the rate is 0.75 of the base rate over standing, by depth and the Rates option, stopped at r_cap", () => {
  assert.equal(citizenRatePpm({ age: "AGE_ANTIQUITY", standing: 100 }), 11250);
  assert.equal(citizenRatePpm({ age: "AGE_ANTIQUITY", standing: 50 }), 22500);
  assert.equal(citizenRatePpm({ age: "AGE_ANTIQUITY", standing: 100, depthFactorPct: 80, rates: 125 }), 11250);
  assert.equal(citizenRatePpm({ age: "AGE_ANTIQUITY", standing: 10 }), 60000, "r_cap");
  assert.equal(citizenRatePpm({ age: "AGE_NONE", standing: 100 }), null);
});

test("interest buys 6 times its size in celebration, as Light does; a miss costs 5 turns of the meter, a repudiation 10", () => {
  assert.equal(interestCelebrationCents(450), 2700);
  // Citizen loans are Civic market's, and Civic market is Classical Republic's, an Antiquity government: the price
  // is Antiquity Light's.
  const light = cardAmounts("LIGHT", "AQ");
  assert.equal(CITIZEN.celebrationMultiple, light.happiness / -light.gold,
    "the same celebration per Gold as Antiquity's Light Taxation");
  assert.equal(interestCelebrationCents(-3), 0);
  assert.equal(missCelebrationCents(600), -3000);
  assert.equal(missCelebrationCents(-600), 0, "nothing to lose from a falling meter");
  assert.equal(repudiationCelebrationCents(600), -6000);
});

test("the AI's citizen rule: positive income, solvent, owing them nothing, under 10 turns of income held", () => {
  const base = { incomeCents: 1000, balanceCents: 5000, insolvent: false, owesCitizens: false, roomCents: 20000 };
  assert.equal(aiCitizenPrincipal(base), 5000);
  assert.equal(aiCitizenPrincipal({ ...base, roomCents: 3000 }), 3000);
  assert.equal(aiCitizenPrincipal({ ...base, incomeCents: 0 }), 0);
  assert.equal(aiCitizenPrincipal({ ...base, insolvent: true }), 0);
  assert.equal(aiCitizenPrincipal({ ...base, owesCitizens: true }), 0);
  assert.equal(aiCitizenPrincipal({ ...base, balanceCents: 10000 }), 0, "10 turns held is enough");
  assert.equal(aiCitizenPrincipal({ ...base, balanceCents: 9999 }), 5000);
  assert.equal(aiCitizenPrincipal({ ...base, roomCents: -1 }), 0);
});

test("the plan takes 20% of positive income and splits it by population over cities with a queue", () => {
  assert.equal(planTakeCents(10000), 2000);
  assert.equal(planTakeCents(-500), 0);
  const cities = [{ id: "1:1", build: "B", neededProgress: 100, population: 3 },
    { id: "1:2", build: "U", neededProgress: 2, population: 1 }, { id: "1:3", build: null, neededProgress: 0, population: 9 },
    { id: "1:4", build: "C", neededProgress: 50 }];
  assert.deepEqual(planSplit(6000, cities, 400), [{ cityId: "1:1", progress: 10, cents: 4000 },
    { cityId: "1:2", progress: 2, cents: 800 }, { cityId: "1:4", progress: 3, cents: 1200 }],
    "4 Gold a point, an empty queue skipped, a build's need caps it, no population read counts 1, and the 4 Gold left"
    + " over buys the biggest city a point");
  assert.deepEqual(planSplit(6000, cities, 300).map((row) => row.progress), [14, 2, 4], "another mod's rate wins");
  assert.deepEqual(planSplit(1000, [{ id: "1:1", build: "B", neededProgress: 9, population: 6 },
    { id: "1:2", build: "B", neededProgress: 9, population: 3 }], 400), [{ cityId: "1:1", progress: 2, cents: 800 }],
    "a share too small for a point goes to the biggest city instead of being lost");
  assert.deepEqual(planSplit(2000, [{ id: "1:1", build: "B", neededProgress: 1, population: 6 },
    { id: "1:2", build: "B", neededProgress: 9, population: 3 }], 400).map((row) => row.progress), [1, 4],
    "a full build passes what's left to the next");
  assert.deepEqual(planSplit(6000, cities), planSplit(6000, cities, 400), "no rate read: 4 Gold a point");
  assert.deepEqual(planSplit(0, cities, 400), []);
  assert.deepEqual(planSplit(6000, [], 400), []);
  assert.deepEqual(planSplit(300, [{ id: "1:1", build: "B", neededProgress: 9, population: 1 }], 400), [],
    "less than a point");
});

test("a city where sent points land bigger is sent fewer: the price divides the points by the city's share", () => {
  const cities = [{ id: "1:1", build: "B", neededProgress: 100, population: 1, progressScalePct: 200 },
    { id: "1:2", build: "B", neededProgress: 100, population: 1 }];
  assert.deepEqual(planSplit(8000, cities, 400), [{ cityId: "1:1", progress: 5, cents: 4000 },
    { cityId: "1:2", progress: 10, cents: 4000 }]);
  assert.equal(pointPriceCents(400, 150), 600);
  assert.equal(pointPriceCents(null, undefined), 400);
  assert.equal(pointPriceCents(0, -5), 400, "a rate or a share that isn't positive reads as the fallback");
  assert.equal(pointPriceCents(1, 1), 1, "never below a cent");
  assert.equal(pointPriceCents(400, 100, 347), 347, "the build's own purchase price wins over the multiplier");
  assert.equal(pointPriceCents(400, 100, null), 400, "an unread own price falls back to the multiplier");
  assert.deepEqual(planSplit(1000, [{ id: "a", build: "U", neededProgress: 50, population: 1, pointCents: 284 }], 400),
    [{ cityId: "a", progress: 3, cents: 852 }], "a military build at 2.84 a point");
});
