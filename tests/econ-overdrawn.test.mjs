// A treasury below zero (DESIGN 4.18): the game itself does nothing to it (lab W10), so Economics does. Depth counts in
// quarters of the overdraft; every settlement loses Happiness (GLOOM markers), purchases cost more (a premium on the
// price stack), the credit rating drops each turn, and one unit a turn is disbanded until it is back above zero,
// the highest upkeep first. Nothing at 0 or above.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { overdrawnState } from "../ui/econ-overdrawn.js";
import { OVERDRAFT, OVERDRAWN, overdraftLimitCents, overdrawnRamp } from "../ui/econ-params.js";
import { markerType, parseMarkerType, priceStackFor, standingRows } from "../ui/econ-standing.js";
import { creditRepOf } from "../ui/econ-credit.js";
import { sortPicks } from "../ui/econ-disband.js";
import { pickShut, placeLines } from "../ui/econ-standing-read.js";
import { describeNotice } from "../ui/econ-notice-text.js";
import { civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;

// The test civ (_fixtures.mjs) has no overdraft unless it says so; these use the real limit (overdraftCents unset).

test("nothing at 0 or above", () => {
  assert.equal(overdrawnState({ balanceCents: 0, incomeCents: -5000 }), null);
  assert.equal(overdrawnState({ balanceCents: 100, incomeCents: -5000 }), null);
});

test("depth counts in quarters of the overdraft: Happiness and the premium grow with it, then jump past it", () => {
  // Income 50 Gold a turn: an overdraft of 500 Gold, quarters of 125.
  assert.equal(overdraftLimitCents(5000), 50000);
  assert.equal(overdraftLimitCents(-5000), 50000, "the size of income either way");
  assert.equal(overdraftLimitCents(100), OVERDRAFT.minCents, "at least 100 Gold");
  const at = (gold) => overdrawnState({ balanceCents: -gold * 100, incomeCents: 5000 });
  assert.deepEqual([at(1).quarters, at(1).gloom, at(1).premiumBp, at(1).past], [0, 2, 500, false]);
  assert.deepEqual([at(125).quarters, at(125).gloom, at(125).premiumBp], [1, 4, 1000]);
  assert.deepEqual([at(375).quarters, at(375).gloom, at(375).premiumBp], [3, 8, 2000]);
  assert.deepEqual([at(500).quarters, at(500).gloom, at(500).premiumBp, at(500).past], [4, 10, 2500, false]);
  assert.deepEqual([at(501).gloom, at(501).premiumBp, at(501).past], [OVERDRAWN.gloomPastLimit,
    OVERDRAWN.pricePastLimitBp, true]);
  assert.deepEqual([at(200).cents, at(200).limitCents], [20000, 50000]);
  const none = overdrawnState({ balanceCents: -100, incomeCents: 5000, overdraftCents: 0 });
  assert.deepEqual([none.past, none.gloom], [true, OVERDRAWN.gloomPastLimit], "no overdraft: any debt is past it");
});

test("the ramp: two turns of warning, a unit every other turn, then every turn, then buildings (owner 2026-11-10)", () => {
  const at = (turns) => { const r = overdrawnState({ balanceCents: -100, incomeCents: 5000 }, turns);
    return [r.disband, r.shut]; };
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(at), [[0, 0], [0, 0], [1, 0], [0, 0], [1, 0], [0, 0],
    [1, 0], [1, 1], [1, 1], [1, 2], [1, 2], [1, 3]]);
  assert.deepEqual(overdrawnRamp(0), { disband: 0, shut: 0 });
  assert.equal(overdrawnState({ balanceCents: -100, incomeCents: -1 }, 3).disband, 1, "whatever the income");
});

test("a settlement to shut: those already shut stay first, then the highest building upkeep; none without upkeep", () => {
  const t = (id, upkeep, shut = false) => ({ id, upkeep, shut });
  assert.deepEqual(pickShut([t(1, 4), t(2, 12), t(3, 9)], 2), [2, 3]);
  assert.deepEqual(pickShut([t(1, 4, true), t(2, 12), t(3, 9)], 2), [1, 2], "a shut settlement stays shut");
  assert.deepEqual(pickShut([t(1, 0), t(2, 3)], 2), [2], "a settlement with no upkeep isn't shut");
  assert.deepEqual(pickShut([t(1, 4, true)], 0), [], "back above zero: everything opens");
});

test("gloom markers have their own ladder, stand in every settlement, and reach the gloom past the limit", () => {
  assert.equal(markerType("GLOOM", 4), "BUILDING_ECON_GLOOM_4");
  assert.deepEqual(parseMarkerType("BUILDING_ECON_GLOOM_8"), { line: "GLOOM", rung: 8 });
  assert.equal(parseMarkerType("BUILDING_ECON_GLOOM_16"), null);
  assert.ok([1, 2, 4, 8].reduce((a, b) => a + b, 0) >= OVERDRAWN.gloomPastLimit);
});

test("the plan: an overdrawn civ's gloom, price premium and disband rows; reputation each turn; nothing for others", () => {
  const plan = planTurn(input({ civs: [civ(ME, { human: true, balanceCents: -20000, incomeCents: -1000, overdraftCents: undefined }),
    civ(AI, { balanceCents: 50000, incomeCents: 5000 })] }));
  const limit = overdraftLimitCents(-1000);
  assert.equal(limit, OVERDRAFT.minCents);
  const row = plan.overdrawn[String(ME)];
  assert.ok(row, JSON.stringify(plan.overdrawn));
  assert.equal(plan.overdrawn[String(AI)], undefined);
  const mine = Object.fromEntries((plan.standing || []).filter((r) => r.pid === ME).map((r) => [r.line, r.gold]));
  assert.equal(mine.GLOOM, row.gloom);
  assert.equal(mine.DISBAND, undefined, "the first turn below zero is a warning");
  assert.equal(row.turns, 1);
  assert.equal(mine.PRICE, priceStackFor(row.premiumBp, undefined), "Inflation off: the premium alone");
  assert.ok(!(plan.standing || []).some((r) => r.pid === AI && ["GLOOM", "DISBAND", "PRICE"].includes(r.line)));
  const rep = plan.events.filter((e) => e.kind === "credit-rep" && e.why === "overdrawn");
  assert.deepEqual(rep.map((e) => [e.pid, e.points]), [[ME, -OVERDRAFT.repPerTurn]]);
  assert.equal(Math.round(creditRepOf(plan.ledger, ME, 50) / 100), 100 - OVERDRAFT.repPerTurn);
});

test("the number of settlements to shut passes 1 as the ramp goes on (lab W15)", () => {
  // W15: the Ottomans 11 turns below zero, the plan said 2 settlements and the line stopped at 1, SHUT's one rung.
  const rows = standingRows({ ledger: emptyLedger(), out: { transfers: [], notes: [], overdrawn: { [String(ME)]:
    overdrawnState({ balanceCents: -100, incomeCents: 5000 }, 12) } }, crisis: null, macro: null },
  [civ(ME, { incomeCents: 5000 })]);
  assert.equal(overdrawnRamp(12).shut, 3);
  assert.equal(rows.find((r) => r.line === "SHUT").gold, 3);
});

test("the premium adds to an inflation level in one stack", () => {
  const rows = standingRows({ ledger: emptyLedger(), out: { transfers: [], notes: [], overdrawn: { [String(ME)]:
    overdrawnState({ balanceCents: -100, incomeCents: 5000 }) } }, crisis: null,
  macro: { inflation: { levels: { [String(ME)]: 100000 } } } }, [civ(ME, { incomeCents: 5000 })]);
  const price = rows.find((r) => r.line === "PRICE");
  assert.equal(price.gold, priceStackFor(1000 + 500, undefined), "10% inflation + 5% overdraft");
});

test("the seat is told on going below zero, on passing its overdraft, and on coming back; not every turn", () => {
  const ledgerAt = (snapshot, below) => ({ ...emptyLedger(), lastBatch: { id: "B1", turn: 49,
    civs: [{ pid: ME, snapshot, net: 0, influence: 0, celebration: 0, below }] } });
  const kinds = (snapshot, balanceCents, below = 1) => planTurn(input({ ledger: ledgerAt(snapshot, below),
    civs: [civ(ME, { human: true, balanceCents, incomeCents: 5000, overdraftCents: undefined })] })).notices
    .filter((n) => String(n.kind).startsWith("overdrawn")).map((n) => n.kind);
  assert.deepEqual(kinds(1000, -1000), ["overdrawn"]);
  assert.deepEqual(kinds(-1000, -2000), ["overdrawn-units-soon"], "the second turn warns of the units");
  assert.deepEqual(kinds(-1000, -2000, 2), [], "still inside: no new notice");
  assert.deepEqual(kinds(-1000, -60000, 2), ["overdrawn-past"]);
  assert.deepEqual(kinds(-60000, -70000, 2), [], "still past");
  assert.deepEqual(kinds(-1000, -2000, OVERDRAWN.shutFrom - 2), ["overdrawn-buildings-soon"], "the turn before");
  assert.deepEqual(kinds(-1000, 500), ["overdrawn-over"]);
  assert.deepEqual(kinds(1000, 500), []);
});

test("the notices read in plain words, with the disbanding sentence while units go", () => {
  const ctx = { ledger: emptyLedger(), nameOf: String };
  const n = { pid: ME, kind: "overdrawn", cents: 12000, limit: 50000, gloom: 2, premiumBp: 500, disband: 0 };
  assert.deepEqual(describeNotice({ ...n, turnsLeft: 2 }, ctx), { key: "LOC_ECONOMICS_NOTICE_OVERDRAWN",
    args: ["120", "500", 2, 5, 2] });
  assert.deepEqual(describeNotice({ pid: ME, kind: "overdrawn-buildings-soon", turns: 7 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_OVERDRAWN_BUILDINGS_SOON", args: [7] });
  assert.equal(describeNotice({ ...n, disband: 1 }, ctx).key, "LOC_ECONOMICS_NOTICE_OVERDRAWN_DISBAND");
  assert.equal(describeNotice({ ...n, kind: "overdrawn-past" }, ctx).key, "LOC_ECONOMICS_NOTICE_OVERDRAWN_PAST");
  assert.equal(describeNotice({ pid: ME, kind: "overdrawn-over" }, ctx).key, "LOC_ECONOMICS_NOTICE_OVERDRAWN_OVER");
});

test("disbanding goes highest upkeep first, the strongest on a tie", () => {
  const pick = (id, upkeep, strength) => ({ cid: { owner: ME, id }, type: `U${id}`, name: `U${id}`, upkeep, strength });
  assert.deepEqual(sortPicks([pick(1, 5, 30), pick(2, 15, 50), pick(3, 15, 65), pick(4, 18, 35)]).map((p) => p.cid.id),
    [4, 3, 2, 1]);
});

test("the glue stands gloom in every settlement and the other markers in the capital only", () => {
  const sent = [];
  const cities = [{ id: { id: 10 }, location: { x: 1, y: 1 } }, { id: { id: 11 }, location: { x: 5, y: 5 } }]
    .map((c) => ({ ...c, Constructibles: { getIds: () => [] } }));
  const saved = { Players: globalThis.Players, GameContext: globalThis.GameContext, Game: globalThis.Game };
  globalThis.GameContext = { localPlayerID: ME };
  globalThis.Game = { PlayerOperations: { sendRequest: (_me, kind, args) => sent.push([kind, args]) } };
  globalThis.Players = { get: () => ({ Cities: { getCapital: () => cities[0], getCities: () => cities } }) };
  try {
    placeLines(ME, new Map([["GLOOM", 6], ["PRICE", 5], ["DISBAND", 1]]), []);
    const at = (type) => sent.filter(([k, a]) => k === "CREATE_ELEMENT" && a.Type === type).map(([, a]) => a.Location.x);
    assert.deepEqual(at("BUILDING_ECON_GLOOM_4"), [1, 5]);
    assert.deepEqual(at("BUILDING_ECON_GLOOM_2"), [1, 5]);
    assert.deepEqual(at("BUILDING_ECON_PRICE_4"), [1]);
    assert.equal(sent.length, 6, "two gloom rungs in two settlements, two price rungs; DISBAND isn't a marker");
    sent.length = 0;
    // Back above zero: the held gloom comes down, wherever it stands.
    const held = [{ cid: { owner: ME, id: 90 }, line: "GLOOM", rung: 4, capital: false, incomePct: 0, city: 11 },
      { cid: { owner: ME, id: 91 }, line: "GLOOM", rung: 4, capital: true, incomePct: 0, city: 10 }];
    placeLines(ME, new Map(), held);
    assert.deepEqual(sent.map(([k, a]) => [k, a.LocalID]), [["DESTROY_ELEMENT", 90], ["DESTROY_ELEMENT", 91]]);
    sent.length = 0;
    // Still wanted: what stands stays, and only the missing settlement gets its rung.
    placeLines(ME, new Map([["GLOOM", 4]]), [held[0]]);
    assert.deepEqual(sent.map(([k, a]) => [k, a.Type, a.Location.x]), [["CREATE_ELEMENT", "BUILDING_ECON_GLOOM_4", 1]]);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test("below zero is judged on the treasury held, not the snapshot that counts the lines back (lab W14)", () => {
  const ai = { balanceCents: 3000, incomeCents: 11000, engineCents: -16000 };
  assert.equal(overdrawnState(ai).cents, 13000, "-130 held: the Ottomans' case");
  assert.equal(overdrawnState({ ...ai, engineCents: -2000 }), null, "+10 held: not overdrawn");
});
