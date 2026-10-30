// The 1.2 reads against a fake engine (DESIGN 4.11, 4.16, 4.17): government and ideology for any civ, the crisis
// stage, old buildings weighted by their roles' fade with the roles of their own age remembered, and the cycle's
// engine events kept until the batch.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { captureEvent, disasterEvent, razeEvent, readCrisisStage, readEconomy, readGovernment, readIdeology,
  readPopulations, rememberRoles, resolveCycleEvents, roleLetters, sanitizePending, withPending, withRemembered }
  from "../ui/econ-macro-read.js";
import { buildInput, loadSession, noteCycleEvent, runTurn } from "../ui/econ-session.js";
import { resetBuildingDataForTests } from "../ui/econ-engine.js";
import { resetAnchorsForTests } from "../ui/econ-stage-read.js";

function fresh(spec = {}) {
  removeFakeEngine();
  resetBuildingDataForTests();
  resetAnchorsForTests();
  return installFakeEngine(spec);
}

test("government and ideology read for any civ; none before one is chosen; the ideology's root as the fallback", () => {
  fresh({ civs: [{ id: 0, government: "GOVERNMENT_DESPOTISM" }, { id: 3, ideology: "IDEOLOGY_COMMUNISM" },
    { id: 5, nodes: ["NODE_CIVIC_MO_BRANCH_COMMUNISM"] }, { id: 7 }] });
  assert.equal(readGovernment(0), "GOVERNMENT_DESPOTISM");
  assert.equal(readGovernment(7), null);
  assert.equal(readIdeology(3), "IDEOLOGY_COMMUNISM");
  assert.equal(readIdeology(5), "IDEOLOGY_COMMUNISM", "the completed branch root");
  assert.equal(readIdeology(7), null);
  assert.equal(readIdeology(99), null);
  assert.equal(readCrisisStage(), -1);
  removeFakeEngine();
});

test("an old Market fades from Public debt: its weight scales depth and becomes legacy", () => {
  fresh({ civs: [{ id: 0, buildings: [0] }] });
  const q = { turn: 130, ageStartTurn: 121, age: "AGE_EXPLORATION", stageTurns: { publicDebt: 125 }, memory: {},
    commercePct: 100, bankingOpen: false };
  const economy = readEconomy(0, q);
  const market = economy.buildings.find((b) => b.type === "BUILDING_MARKET");
  assert.equal(market.old, true);
  assert.deepEqual(market.weights, { commerce: 0.75, trade: 1, banking: 1 });
  assert.equal(economy.legacyBp, 2500);
  assert.equal(economy.cushionBp, 25);
  assert.equal(economy.depthFactorPct, 99);
  assert.equal(economy.commerceSettlements, 1);
  const full = readEconomy(0, { ...q, stageTurns: {} });
  assert.equal(full.buildings[0].weights.commerce, 1, "full until the stage");
  assert.deepEqual(full.buildings[0].fadingFrom, ["publicDebt"]);
  removeFakeEngine();
});

test("the roles a building had in its own age are remembered for the next one", () => {
  assert.equal(roleLetters({ commerce: true, trade: true, banking: false }), "ct");
  assert.deepEqual(withRemembered({ commerce: false, trade: true }, "ct"), { commerce: true, trade: true });
  const memory = rememberRoles({}, [{ type: "BUILDING_MARKET", age: "AGE_ANTIQUITY", roles: { commerce: true } },
    { type: "BUILDING_BANK", age: "AGE_EXPLORATION", roles: { commerce: true, banking: true } }], "AGE_ANTIQUITY");
  assert.deepEqual(memory, { BUILDING_MARKET: "c" });
  fresh({ civs: [{ id: 0, buildings: [1] }] });
  const economy = readEconomy(0, { turn: 30, ageStartTurn: 1, age: "AGE_EXPLORATION", stageTurns: {}, memory: {},
    commercePct: 125, bankingOpen: true });
  assert.equal(economy.buildings[0].old, false);
  assert.equal(economy.depthTurns, 2, "one Bank");
  removeFakeEngine();
});

test("the cycle's engine events: a capture by combat, a raze, a disaster on a major's land", () => {
  const world = fresh({ civs: [{ id: 0 }, { id: 3 }] });
  world.plots = { "4,5": { owner: 3, city: { owner: 3, id: 9 } }, "1,1": { owner: -1 } };
  world.cityBuildings = { "3:9": [] };
  assert.deepEqual(captureEvent({ fromPlayer: 3, transferType: 1 }), { kind: "capture", pid: 3 });
  assert.equal(captureEvent({ fromPlayer: 3, transferType: 2 }), null, "a gift isn't a capture");
  assert.equal(captureEvent({ fromPlayer: 44, transferType: 1 }), null, "not a major");
  assert.deepEqual(razeEvent({ cityID: { owner: 0, id: 2 } }), { kind: "raze", pid: 0 });
  assert.equal(razeEvent({}), null);
  const pops = new Map([["3:9", 6]]);
  assert.deepEqual(disasterEvent({ location: { x: 4, y: 5 } }, pops), { kind: "disaster", pid: 3, city: "3:9", pop: 6,
    food: false });
  assert.equal(disasterEvent({ location: { x: 1, y: 1 } }, pops), null, "nobody's land");
  assert.equal(disasterEvent({}, pops), null);
  const resolved = resolveCycleEvents([{ kind: "disaster", pid: 3, city: "3:9", pop: 6, food: true },
    { kind: "capture", pid: 3 }], new Map([["3:9", 5]]));
  assert.deepEqual(resolved, [{ kind: "disaster", pid: 3, populationLost: true, foodWarehouse: true },
    { kind: "capture", pid: 3 }]);
  assert.deepEqual(resolveCycleEvents([{ kind: "disaster", pid: 3, city: "3:9", pop: null }], new Map()),
    [{ kind: "disaster", pid: 3, populationLost: false, foodWarehouse: false }]);
  assert.equal(withPending(Array(32).fill({ kind: "raze", pid: 0 }), { kind: "capture", pid: 3 }).length, 32);
  assert.deepEqual(sanitizePending([{ kind: "raze", pid: 1 }, { kind: "flood", pid: 2 }, { kind: "capture" }]),
    [{ kind: "raze", pid: 1, city: null, pop: null, food: false }]);
  removeFakeEngine();
});

test("in game: an event kept between batches reaches the plan once, and the system comes from the government", () => {
  const world = fresh({ civs: [{ id: 0, balance: 50, income: 12, government: "GOVERNMENT_OLIGARCHY" },
    { id: 3, balance: 400, income: 9 }] });
  world.crisis = 0;
  const session = loadSession();
  assert.equal(noteCycleEvent(session, { kind: "capture", pid: 3 }), true);
  assert.equal(noteCycleEvent(session, null), false);
  assert.deepEqual(loadSession().glue.cycleEvents, [{ kind: "capture", pid: 3, city: null, pop: null, food: false }]);
  const input = buildInput(session);
  assert.deepEqual(input.cycleEvents, [{ kind: "capture", pid: 3 }]);
  assert.equal(input.crisisStage, 0);
  assert.equal(input.civs[0].government, "GOVERNMENT_OLIGARCHY");
  const plan = runTurn(session, "test");
  assert.equal(plan.macro.systems[0].system, "merchantOligarchy");
  assert.ok(plan.macro.cycle.events.some((e) => e.kind === "capture" && e.a === 3));
  assert.deepEqual(session.glue.cycleEvents, [], "weighed once");
  assert.ok(world.config["tower-economics-macro"].includes("merchantOligarchy"), "the macro envelope is written");
  assert.deepEqual([...readPopulations([0, 3])], []);
  removeFakeEngine();
});
