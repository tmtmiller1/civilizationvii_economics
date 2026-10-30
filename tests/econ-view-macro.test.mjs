// The 1.2 screens against a fake DOM and a fake screen api (DESIGN 9): the World tab's index, phase, events, history,
// inflation, debt and legacy; the Fiscal tab's system section with its blend and the plan; the Treasury tab's reserve,
// erosion and old buildings. Text is LOC keys joined with their arguments.
import test from "node:test";
import assert from "node:assert/strict";
import { byClass, installFakeDom, textOf } from "./_fake-dom.mjs";
import { OPEN_ALL, OPEN_MACRO, civ, input } from "./_fixtures.mjs";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { inflationLines, systemView, worldView } from "../ui/econ-view-macro.js";

installFakeDom();
const { renderWorld, formatIndex, formatWeight } = await import("../ui/econ-view-world.js");
const { renderFiscal } = await import("../ui/econ-view-fiscal.js");
const { renderTreasury } = await import("../ui/econ-view-treasury.js");

const ME = 2;
const macro = (cycle = {}, over = {}) => ({ ...emptyMacro(), ...over, cycle: { ...emptyMacro().cycle, ...cycle } });

function makeApi(planInput, depth = {}) {
  return {
    me: ME, input: () => planInput, loc: (key, ...args) => [key, ...args].join("|"),
    nameOf: (party) => (typeof party === "number" ? `Civ ${party}` : String(party)),
    request: () => true, dropRequest: () => true, pending: () => [], setGuard: () => true, guardOn: () => true,
    stageOpener: (stage) => (stage === "publicDebt" ? "LOC_CIVIC_ECONOMICS_NAME" : null),
    depth: () => ({ buildings: [], depthTurns: 0, depthFactorPct: 100, legacyBp: 0, cushionBp: 0, ...depth }),
    cards: () => [], fiscal: () => ({ goldCents: 0, happinessCents: 0, netHappinessCents: 0, settlements: 1,
      celebrationLeftCents: 100, celebrating: false, atWar: false }), swapTo: () => Promise.resolve("sent"),
    canSwap: () => true, rerender: () => {}, resourceName: (t) => t, buildName: (t) => `build:${t}`,
    cityName: (id) => `city:${id}`, possibleRoutes: () => null, turnLabel: (turn) => (turn > 40 ? turn - 40 : null),
  };
}

test("the index and a weight as the World tab shows them", () => {
  assert.equal(formatIndex(9800), "0.98");
  assert.equal(formatIndex(10000), "1.00");
  assert.equal(formatWeight(-200), "-0.020");
  assert.equal(formatWeight(50), "+0.005");
  assert.equal(formatWeight(0), "0.000");
});

test("the World tab: index, phases, events newest first, history, inflation's cause, debt and legacy", () => {
  const ledger = { ...emptyLedger(), loans: [makeLoan({ id: "L1", lender: "bond", borrower: 6, principal: 400000,
    ratePpm: 40000, term: 30, turn: 40 })] };
  const planInput = input({ civs: [civ(ME, { human: true, stages: OPEN_MACRO }), civ(6, { balanceCents: 100000 })], ledger,
    options: { cycle: "standard", inflation: true },
    macro: macro({ e: 9300, l: { [ME]: -400 }, history: [10000, 9600, 9300], panicUntil: 53,
      events: [{ turn: 48, kind: "war-declared", a: ME, b: 6, w: -200 }, { turn: 49, kind: "crisis-start", a: null,
        b: null, w: -200 }] }, { inflation: { piPpm: 2000, bondCents: 400000, moneyCents: 100000, top: 6 } }) });
  const view = worldView(planInput, ME);
  assert.deepEqual([view.e, view.worldPhase, view.mine.phase, view.panic], [9300, "panic", "panic", true]);
  assert.deepEqual(view.events.map((e) => e.kind), ["crisis-start", "war-declared"]);
  assert.equal(view.inflation.ratioPct, 400);
  assert.equal(view.debt.leverPct, 266, "400000 owed against 150000 held");
  assert.equal(view.banking, true);
  const host = document.createElement("div");
  renderWorld(host, makeApi(planInput, { legacyBp: 25000, cushionBp: 250 }));
  const text = textOf(host);
  for (const piece of ["LOC_ECONOMICS_WORLD_INDEX", "0.93", "LOC_ECONOMICS_PHASE_PANIC", "LOC_ECONOMICS_WORLD_PANIC|13",
    "9: LOC_ECONOMICS_WORLD_EVENT_ROW|LOC_ECONOMICS_CYCLE_EVENT_CRISIS_START|", "(Civ 2, Civ 6)", "-0.020",
    "LOC_ECONOMICS_WORLD_HISTORY|3", "LOC_ECONOMICS_WORLD_INFLATION_CAUSE|4.0|Civ 6", "0.2%", "2.66", "2.50", "2.5%"]) {
    assert.ok(text.includes(piece), piece);
  }
  assert.equal(byClass(host, "econ-spark-bar").length, 3);
});

test("the World tab with the cycle and inflation off says so", () => {
  const planInput = input({ civs: [civ(ME, { human: true })] });
  const host = document.createElement("div");
  renderWorld(host, makeApi(planInput));
  const text = textOf(host);
  assert.ok(text.includes("LOC_ECONOMICS_WORLD_CYCLE_OFF"));
  assert.ok(text.includes("LOC_ECONOMICS_WORLD_INFLATION_OFF"));
  assert.equal(text.includes("LOC_ECONOMICS_WORLD_EVENTS"), false);
  const quiet = input({ civs: [civ(ME, { human: true })], options: { cycle: "mild", inflation: true } });
  const again = document.createElement("div");
  renderWorld(again, makeApi(quiet));
  assert.ok(textOf(again).includes("LOC_ECONOMICS_WORLD_EVENTS_NONE"));
  assert.ok(textOf(again).includes("LOC_ECONOMICS_WORLD_INFLATION_NONE"));
});

test("the Fiscal tab's system: its name, where it comes from, the blend after a change, the plan", () => {
  const blending = input({ turn: 54, civs: [civ(ME, { human: true, government: "GOVERNMENT_OLIGARCHY" })],
    options: { systems: true }, macro: macro({}, { systems: { [ME]: { system: "merchantOligarchy", from: "tribute",
      since: 50 } } }) });
  assert.deepEqual(systemView(blending, ME), { on: true, system: "merchantOligarchy", source: "government",
    from: "tribute", blendLeft: 6, planTakeCents: 0 });
  const host = document.createElement("div");
  renderFiscal(host, makeApi(blending));
  const text = textOf(host);
  for (const key of ["LOC_ECONOMICS_SYSTEM_MERCHANT_OLIGARCHY", "LOC_ECONOMICS_FISCAL_SYSTEM_FROM_GOVERNMENT",
    "LOC_ECONOMICS_SYSTEM_MERCHANT_OLIGARCHY_LINE", "LOC_ECONOMICS_FISCAL_SYSTEM_BLEND|LOC_ECONOMICS_SYSTEM_TRIBUTE|6"]) {
    assert.ok(text.includes(key), key);
  }
  const planned = input({ civs: [civ(ME, { human: true, ideology: "IDEOLOGY_COMMUNISM", incomeCents: 5000 })],
    options: { systems: true } });
  assert.deepEqual(systemView(planned, ME), { on: true, system: "planned", source: "ideology", from: null, blendLeft: 0,
    planTakeCents: 1000 });
  const planHost = document.createElement("div");
  renderFiscal(planHost, makeApi(planned));
  assert.ok(textOf(planHost).includes("LOC_ECONOMICS_FISCAL_PLAN"));
  const off = input({ civs: [civ(ME, { human: true, government: "GOVERNMENT_OLIGARCHY" })] });
  assert.equal(systemView(off, ME).system, "mixed");
  const offHost = document.createElement("div");
  renderFiscal(offHost, makeApi(off));
  assert.ok(textOf(offHost).includes("LOC_ECONOMICS_FISCAL_SYSTEMS_OFF"));
  assert.equal(systemView(input({ civs: [], options: { systems: true } }), ME).source, "none");
});

test("the Treasury tab's reserve and erosion for a Public debt member, and its old buildings with their triggers", () => {
  const planInput = input({ civs: [civ(ME, { human: true, balanceCents: 300000, incomeCents: 5000, stages: OPEN_ALL })],
    options: { inflation: true }, macro: macro({}, { inflation: { piPpm: 5000, bondCents: 1, moneyCents: 1, top: null } }) });
  assert.deepEqual(inflationLines(planInput, ME), { on: true, member: true, reserveCents: 100000, erosionCents: 1000 });
  assert.equal(inflationLines(input({ civs: [civ(ME)] }), ME).on, false);
  const market = (over) => ({ type: "BUILDING_MARKET", city: "2:1", old: true, ages: 1, ageIndex: 0,
    roles: { commerce: true, trade: true }, weights: { commerce: 1, trade: 1, banking: 1 }, replaced: [],
    fadingFrom: ["publicDebt"], weight: 1, ...over });
  const buildings = [market({}), market({ weights: { commerce: 0.75, trade: 1, banking: 1 }, fadingFrom: [] }),
    market({ weights: { commerce: 0.5, trade: 0.5, banking: 1 }, fadingFrom: [] }),
    market({ replaced: ["trade"], weights: { commerce: 1, trade: 0.5, banking: 1 } }), { type: "BUILDING_BANK", old: false,
      roles: { commerce: true } }];
  const host = document.createElement("div");
  renderTreasury(host, makeApi(planInput, { buildings }));
  const text = textOf(host);
  for (const key of ["LOC_ECONOMICS_TREASURY_RESERVE", "LOC_ECONOMICS_TREASURY_EROSION",
    "LOC_ECONOMICS_TREASURY_OLD_ROW|build:BUILDING_MARKET, city:2:1|1.00",
    "LOC_ECONOMICS_TREASURY_OLD_WAITING|LOC_CIVIC_ECONOMICS_NAME", "LOC_ECONOMICS_TREASURY_OLD_ROW|build:BUILDING_MARKET, city:2:1|0.88",
    "LOC_ECONOMICS_TREASURY_OLD_FADING", "LOC_ECONOMICS_TREASURY_OLD_FLOOR", "LOC_ECONOMICS_TREASURY_OLD_REPLACED"]) {
    assert.ok(text.includes(key), key);
  }
  const none = document.createElement("div");
  renderTreasury(none, makeApi(input({ civs: [civ(ME, { human: true })] })));
  assert.ok(textOf(none).includes("LOC_ECONOMICS_TREASURY_OLD_NONE"));
  assert.equal(textOf(none).includes("LOC_ECONOMICS_TREASURY_RESERVE"), false);
});
