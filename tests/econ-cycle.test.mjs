// The business cycle's arithmetic (DESIGN 4.11; TEST-PLAN 12.1 econ-cycle): mean reversion, the events and their
// caps, the clamps, k and s, the phases, Panic, the spread and cycle Gold. E and L are in basis points.
import test from "node:test";
import assert from "node:assert/strict";
import { civSum, crisisEvents, cycleGoldCents, effectiveL, emptyCycle, engineEvents, ledgerEvents, leverPct, nextE, nextL,
  pairKey, panicStarts, phaseOf, routeEvents, spreadPct, stageScalePct, trendEvents, warEvents, worldSum }
  from "../ui/econ-cycle.js";

test("E reverts a tenth of the way to 1.0 a turn and doesn't move on a turn with no events", () => {
  assert.equal(nextE(10000, 0, 100, 100), 10000);
  assert.equal(nextE(9000, 0, 100, 100), 9100);
  assert.equal(nextE(12000, 0, 100, 100), 11800);
  assert.equal(nextE(9000, 0, 0, 100), 9100, "k only scales the events");
});

test("E: k * s * the clamped sum, then 0.7 to 1.3", () => {
  assert.equal(nextE(10000, -200, 100, 100), 9800);
  assert.equal(nextE(10000, -200, 150, 100), 9700, "Strong");
  assert.equal(nextE(10000, -200, 50, 100), 9900, "Mild");
  assert.equal(nextE(10000, -200, 100, 25), 9950, "before Public debt the world barely moves");
  assert.equal(nextE(10000, -200, 100, 60), 9880);
  assert.equal(nextE(7100, -1000, 150, 100), 7000, "never below 0.7");
  assert.equal(nextE(12900, 1000, 150, 100), 13000, "never above 1.3");
  assert.equal(worldSum([{ kind: "x", a: null, b: null, w: -5000, world: true }]), -1000, "the turn's sum is +-0.1");
  assert.equal(worldSum([{ kind: "x", a: null, b: null, w: 5000, world: true }]), 1000);
});

test("L decays at 0.8 (0.7 for Market), takes k * mult * its own events, and stays within +-0.2", () => {
  assert.equal(nextL(1000, 0, { kPct: 100, decayPct: 80, multPct: 100 }), 800);
  assert.equal(nextL(1000, 0, { kPct: 100, decayPct: 70, multPct: 100 }), 700);
  assert.equal(nextL(0, -200, { kPct: 100, decayPct: 80, multPct: 125 }), -250, "Merchant oligarchy swings harder");
  assert.equal(nextL(0, -200, { kPct: 100, decayPct: 80, multPct: 75 }), -150, "Manorial is sheltered");
  assert.equal(nextL(-1900, -1000, { kPct: 150, decayPct: 100, multPct: 100 }), -2000);
  assert.equal(nextL(1900, 1000, { kPct: 150, decayPct: 100, multPct: 100 }), 2000);
});

test("wars: declared once, ongoing each turn after, peace when one ends; each pair once whatever its order", () => {
  assert.equal(pairKey(5, 2), "2:5");
  assert.equal(pairKey(2, 5), "2:5");
  assert.deepEqual(warEvents([], ["2:5"]).map((e) => [e.kind, e.a, e.b, e.w]), [["war-declared", 2, 5, -200]]);
  assert.deepEqual(warEvents(["2:5"], ["2:5"]).map((e) => [e.kind, e.w]), [["war-ongoing", -40]]);
  assert.deepEqual(warEvents(["2:5"], []).map((e) => [e.kind, e.a, e.b, e.w]), [["peace", 2, 5, 100]]);
});

test("ongoing wars cap at -0.02 a turn and standing routes at +0.01, world-wide and for each civ", () => {
  const wars = warEvents(["1:2", "1:3", "1:4", "1:5", "1:6", "1:7"], ["1:2", "1:3", "1:4", "1:5", "1:6", "1:7"]);
  assert.equal(worldSum(wars), -200);
  assert.equal(civSum(wars, 1), -200, "civ 1 is in all six");
  assert.equal(civSum(wars, 2), -40);
  const keys = Array.from({ length: 15 }, (_, i) => pairKey(1, i + 2));
  const routes = routeEvents(keys, keys);
  assert.equal(worldSum(routes), 100);
  assert.equal(civSum(routes, 1), 100);
  assert.equal(civSum(routes, 3), 10);
  assert.equal(civSum(routes, 99), 0, "a civ in none of them");
});

test("routes: new +0.005 for both ends, ended -0.005", () => {
  const events = routeEvents(["1:2"], ["1:3"]);
  assert.deepEqual(events.map((e) => [e.kind, e.a, e.b, e.w]), [["route-new", 1, 3, 50], ["route-ended", 1, 2, -50]]);
  assert.equal(civSum(events, 1), 0);
  assert.equal(civSum(events, 3), 50);
});

test("the engine's events: capture -0.01, raze -0.02, disaster -0.005 or -0.01 with population lost, half with a food warehouse", () => {
  const rows = engineEvents([{ kind: "capture", pid: 4 }, { kind: "raze", pid: 4 }, { kind: "disaster", pid: 6 },
    { kind: "disaster", pid: 6, populationLost: true }, { kind: "disaster", pid: 6, populationLost: true, foodWarehouse: true },
    { kind: "disaster", pid: 6, foodWarehouse: true }, { kind: "flood", pid: 6 }, { kind: "raze" }]);
  assert.deepEqual(rows.map((e) => [e.kind, e.a, e.w]), [["capture", 4, -100], ["raze", 4, -200], ["disaster", 6, -50],
    ["disaster", 6, -100], ["disaster", 6, -50], ["disaster", 6, -25]]);
  assert.deepEqual(engineEvents(undefined), []);
});

test("the crisis: -0.02 the turn a stage starts, -0.005 a turn while one runs, nothing once it's over", () => {
  assert.deepEqual(crisisEvents(-1, 0).map((e) => [e.kind, e.w]), [["crisis-start", -200]]);
  assert.deepEqual(crisisEvents(0, 1).map((e) => [e.kind, e.w]), [["crisis", -50]]);
  assert.deepEqual(crisisEvents(2, 2).map((e) => e.w), [-50]);
  assert.deepEqual(crisisEvents(2, 3), []);
  assert.deepEqual(crisisEvents(-1, -1), []);
  assert.deepEqual(crisisEvents(3, 0).map((e) => e.kind), ["crisis-start"]);
});

test("defaults weigh on both parties, a repudiation on the lender only; world accounts take no part", () => {
  const rows = ledgerEvents([{ turn: 9, kind: "default", borrower: 3, lender: 5 },
    { turn: 9, kind: "repudiation", borrower: 3, lender: 5 }, { turn: 9, kind: "repudiation", borrower: 3, lender: "bond" },
    { turn: 9, kind: "miss", borrower: 3 }]);
  assert.deepEqual(rows.map((e) => [e.kind, e.a, e.b, e.w]), [["default", 3, 5, -300], ["repudiation", 5, null, -300],
    ["repudiation", null, null, -300]]);
  assert.equal(civSum(rows, 3), -300, "the repudiator's own numbers aren't touched");
  assert.equal(civSum(rows, 5), -600);
  assert.deepEqual(ledgerEvents(undefined), []);
});

test("world income against 10 turns ago: +-0.005 per 5%, at most +-0.01; credit up more than 10%: +0.005", () => {
  const flat = Array(11).fill(1000);
  assert.deepEqual(trendEvents(flat, flat), []);
  const up = [1000, ...Array(9).fill(1000), 1070];
  assert.deepEqual(trendEvents(up, flat).map((e) => [e.kind, e.w]), [["income-up", 50]]);
  assert.deepEqual(trendEvents([1000, ...Array(9).fill(0), 1300], flat).map((e) => e.w), [100], "capped");
  assert.deepEqual(trendEvents([1000, ...Array(9).fill(0), 880], flat).map((e) => [e.kind, e.w]), [["income-down", -100]]);
  assert.deepEqual(trendEvents([1000, ...Array(9).fill(0), 960], flat), [], "under 5% weighs nothing");
  assert.deepEqual(trendEvents(Array(10).fill(1000), [1, 2]), [], "a short series weighs nothing");
  assert.deepEqual(trendEvents(flat, [1000, ...Array(9).fill(0), 1101]).map((e) => [e.kind, e.w]), [["credit-growth", 50]]);
  assert.deepEqual(trendEvents(flat, [1000, ...Array(9).fill(0), 1100]), [], "exactly 10% isn't more than 10%");
  assert.deepEqual(trendEvents(flat, [0, ...Array(9).fill(0), 50]), [], "no credit 10 turns ago");
  assert.deepEqual(trendEvents([0, ...Array(9).fill(0), 50], flat), [], "no income 10 turns ago");
});

test("phases: Depression below 0.8, Slump to 0.95, Steady to 1.05, Boom above", () => {
  assert.equal(phaseOf(7999), "depression");
  assert.equal(phaseOf(8000), "slump");
  assert.equal(phaseOf(9499), "slump");
  assert.equal(phaseOf(9500), "steady");
  assert.equal(phaseOf(10500), "steady");
  assert.equal(phaseOf(10501), "boom");
});

test("the stage scale: 0.25, then 0.6 from Public debt, 1.0 from Capitalism", () => {
  assert.equal(stageScalePct({ publicDebt: false, capitalism: false }), 25);
  assert.equal(stageScalePct({ publicDebt: true, capitalism: false }), 60);
  assert.equal(stageScalePct({ publicDebt: true, capitalism: true }), 100);
  assert.equal(stageScalePct({ publicDebt: false, capitalism: true }), 100);
});

test("a negative L is cut by warehouses (3% each, 30% at most) and the cushion (10% at most), 35% together", () => {
  assert.equal(effectiveL(1000, { warehouses: 10, multPct: 100, cushionBp: 1000 }), 1000, "a positive L isn't cut");
  assert.equal(effectiveL(-1000, { warehouses: 0, multPct: 100, cushionBp: 0 }), -1000);
  assert.equal(effectiveL(-1000, { warehouses: 2, multPct: 100, cushionBp: 0 }), -940);
  assert.equal(effectiveL(-1000, { warehouses: 2, multPct: 200, cushionBp: 0 }), -880, "Manorial counts them twice");
  assert.equal(effectiveL(-1000, { warehouses: 20, multPct: 100, cushionBp: 0 }), -700);
  assert.equal(effectiveL(-1000, { warehouses: 0, multPct: 100, cushionBp: 5000 }), -900);
  assert.equal(effectiveL(-1000, { warehouses: 20, multPct: 100, cushionBp: 1000 }), -650);
  assert.equal(effectiveL(-1000, { warehouses: -3, multPct: 100, cushionBp: -40 }), -1000);
});

test("the spread is 2 - (E + L), +0.5 in a Panic; cycle Gold follows E + L - 1 on positive income", () => {
  assert.equal(spreadPct(10000, false), 100);
  assert.equal(spreadPct(8000, false), 120);
  assert.equal(spreadPct(12000, false), 80);
  assert.equal(spreadPct(10000, true), 150);
  assert.equal(cycleGoldCents(11000, 10000), 200, "a boom pays 0.1 * 0.2 of income");
  assert.equal(cycleGoldCents(9000, 10000), -200, "a slump charges the same");
  assert.equal(cycleGoldCents(10000, 10000), 0);
  assert.equal(cycleGoldCents(9000, -500), 0, "nothing on negative income");
});

test("Panic: from the Banking stage, leverage above 1.5, E above 1.05, none in the last 20 turns", () => {
  const base = { allowed: true, leverPct: 151, e: 10501, lastPanic: null, turn: 80 };
  assert.equal(panicStarts(base), true);
  assert.equal(panicStarts({ ...base, allowed: false }), false);
  assert.equal(panicStarts({ ...base, leverPct: 150 }), false);
  assert.equal(panicStarts({ ...base, e: 10500 }), false);
  assert.equal(panicStarts({ ...base, lastPanic: 61 }), false);
  assert.equal(panicStarts({ ...base, lastPanic: 60 }), true);
  assert.equal(leverPct(300000, [100000, 100000, -500000]), 150, "balances floor at 0");
  assert.equal(leverPct(150000, [0]), 150, "the Gold held counts as at least 1000");
  assert.equal(leverPct(-5, [100000]), 0);
});

test("an empty cycle starts at 1.0 with nothing recorded", () => {
  const cycle = emptyCycle();
  assert.equal(cycle.e, 10000);
  assert.deepEqual([cycle.l, cycle.wars, cycle.routes, cycle.events, cycle.crisis], [{}, [], [], [], -1]);
});
