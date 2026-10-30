// Old buildings (DESIGN 4.16; TEST-PLAN 12.1 econ-legacy): which buildings age, each role's fade and floor, the same
// city's current-age building, legacy and the cushion. Weights in basis points.
import test from "node:test";
import assert from "node:assert/strict";
import { buildingWeights, cushionBp, isOld, legacyOf, roleWeight } from "../ui/econ-legacy.js";

const market = (over = {}) => ({ ageIndex: 0, ageless: false, wonder: false, unique: false,
  roles: { commerce: true, trade: true, banking: false }, cityHasCurrent: {}, ...over });
const civ = (over = {}) => ({ currentAgeIndex: 1, stageTurns: {}, ageStartTurn: 121, turn: 130, ...over });

test("a building ages when its age is earlier and it isn't AGELESS, a wonder or a unique", () => {
  assert.equal(isOld(market(), 1), true);
  assert.equal(isOld(market(), 0), false, "a current-age building");
  assert.equal(isOld(market({ ageless: true }), 1), false, "warehouses carry AGELESS");
  assert.equal(isOld(market({ wonder: true }), 2), false);
  assert.equal(isOld(market({ unique: true }), 2), false);
  assert.equal(isOld(market({ ageIndex: null }), 2), false, "a building with no age never ages");
});

test("one age old: 1.0 until the role's successor stage, then -0.05 a turn to 0.5", () => {
  const w = (stageTurns, turn) => buildingWeights(market(), civ({ stageTurns, turn }));
  assert.deepEqual(w({}, 130), { commerce: 10000, trade: 10000, banking: 10000 });
  assert.deepEqual(w({ guildPatronage: 125 }, 130), { commerce: 10000, trade: 7500, banking: 10000 }, "Guilds: Trade fades");
  assert.deepEqual(w({ guildPatronage: 125, publicDebt: 129 }, 130), { commerce: 9500, trade: 7500, banking: 10000 });
  assert.equal(w({ guildPatronage: 100 }, 200).trade, 5000, "the floor");
  assert.equal(w({ guildPatronage: 50 }, 125).trade, 8000, "a stage reached last age fades from this age's start");
  assert.equal(w({ guildPatronage: 140 }, 130).trade, 10000, "a turn ahead of now reads not reached");
});

test("the same city's current-age building of the role drops it to the floor at once", () => {
  const weights = buildingWeights(market({ cityHasCurrent: { trade: true } }), civ());
  assert.deepEqual(weights, { commerce: 10000, trade: 5000, banking: 10000 });
  const two = buildingWeights(market({ cityHasCurrent: { commerce: true } }), civ({ currentAgeIndex: 2, turn: 220,
    ageStartTurn: 220 }));
  assert.equal(two.commerce, 2500);
});

test("two ages old: 0.5 at the age's start, then -0.05 a turn to 0.25", () => {
  const w = (turn) => buildingWeights(market(), civ({ currentAgeIndex: 2, ageStartTurn: 241, turn })).commerce;
  assert.equal(w(241), 5000);
  assert.equal(w(243), 4000);
  assert.equal(w(300), 2500);
  assert.equal(w(230), 5000, "before the age's start reads the start");
});

test("an Exploration building in Modern fades from Capitalism, every role; Antiquity has no Banking successor", () => {
  const bank = market({ ageIndex: 1, roles: { commerce: true, trade: true, banking: true } });
  const modern = civ({ currentAgeIndex: 2, ageStartTurn: 241, turn: 250 });
  assert.deepEqual(buildingWeights(bank, modern), { commerce: 10000, trade: 10000, banking: 10000 });
  assert.deepEqual(buildingWeights(bank, { ...modern, stageTurns: { capitalism: 246 } }),
    { commerce: 8000, trade: 8000, banking: 8000 });
  assert.equal(roleWeight({ ages: 1, role: "banking", buildingAgeIndex: 0, cityHasCurrent: false },
    civ({ stageTurns: { publicDebt: 121 } })), 10000);
  assert.equal(roleWeight({ ages: 0, role: "commerce", buildingAgeIndex: 1, cityHasCurrent: true }, civ()), 10000);
});

test("legacy is 1 - w averaged over the roles the building has; the cushion is 1% a point, 10% at most", () => {
  const b = market();
  assert.equal(legacyOf(b, { commerce: 10000, trade: 5000, banking: 10000 }), 2500);
  assert.equal(legacyOf(market({ roles: { commerce: false, trade: false, banking: false } }), { commerce: 0, trade: 0,
    banking: 0 }), 0, "a building with no fading role adds nothing");
  assert.equal(cushionBp(25000), 250);
  assert.equal(cushionBp(500000), 1000);
  assert.equal(cushionBp(-5), 0);
  assert.deepEqual(buildingWeights(market({ roles: { commerce: false, trade: false, banking: false } }), civ()),
    { commerce: 10000, trade: 10000, banking: 10000 });
});
