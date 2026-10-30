// The macro envelope (DESIGN 9): what it keeps, what it drops on load, the 32 KB cap, and the readings the turn takes
// from it (each civ's blended terms, E + L, phase, spread, pi).
import test from "node:test";
import assert from "node:assert/strict";
import { MACRO_KEY, MACRO_MAX_BYTES, cycleKPct, emptyMacro, loadMacro, macroReadings, saveMacro, sanitizeMacro }
  from "../ui/econ-macro-state.js";
import { utf8Bytes } from "../ui/econ-state.js";

const full = () => ({ lastTurn: 40, cycle: { e: 9400, l: { 3: -500, 5: 300 }, history: [10000, 9700, 9400],
  wars: ["3:5"], routes: ["3:7"], crisis: 1, credit: [1, 2], income: [3, 4], panicUntil: 44, lastPanic: 39,
  atWar: { 3: true }, events: [{ turn: 40, kind: "war-declared", a: 3, b: 5, w: -200 }], phases: { 3: "slump" } },
  systems: { 3: { system: "market", from: "mixed", since: 35 } }, inflation: { piPpm: 2000, bondCents: 5, moneyCents: 9,
  top: 3 } });

test("save and load round-trip, and save(load(x)) is a fixed point", () => {
  const text = saveMacro(full());
  const back = loadMacro(text);
  assert.equal(back.ok, true);
  assert.deepEqual(back.macro, sanitizeMacro(full()));
  assert.equal(saveMacro(back.macro), text);
});

test("load refuses what isn't ours without throwing, and drops bad rows", () => {
  assert.deepEqual(loadMacro(null), { ok: true, reason: "empty", macro: emptyMacro() });
  assert.equal(loadMacro("{nope").reason, "unparseable");
  assert.equal(loadMacro(JSON.stringify({ mod: "other", v: 1 })).reason, "foreign");
  assert.equal(loadMacro(JSON.stringify({ mod: MACRO_KEY, v: 9 })).reason, "newer");
  const dirty = sanitizeMacro({ lastTurn: "x", cycle: { e: 99999, l: { 3: 5000, x: 1, 4: 20 }, wars: ["3:5", "bad", "3:5"],
    events: [{ turn: 1, kind: "k", w: 1.5 }, { turn: 2, kind: "peace", a: 1, b: "z", w: 100 }], phases: { 3: "Bad!" } },
    systems: { 3: { system: "feudal", from: "mixed", since: 1 }, 4: { system: "market", from: "mixed", since: 2 } },
    inflation: { piPpm: -1, top: "3" } });
  assert.equal(dirty.lastTurn, null);
  assert.equal(dirty.cycle.e, 10000);
  assert.deepEqual(dirty.cycle.l, { 4: 20 });
  assert.deepEqual(dirty.cycle.wars, ["3:5"]);
  assert.deepEqual(dirty.cycle.events, [{ turn: 2, kind: "peace", a: 1, b: null, w: 100 }]);
  assert.deepEqual(dirty.cycle.phases, {});
  assert.deepEqual(Object.keys(dirty.systems), ["4"]);
  assert.deepEqual(dirty.inflation, { piPpm: 0, bondCents: 0, moneyCents: 0, top: null });
  assert.deepEqual(sanitizeMacro("junk"), emptyMacro());
});

test("past 32 KB the events go first, then the oldest half of the history", () => {
  const big = full();
  big.cycle.history = Array(30).fill(10000);
  big.cycle.events = Array.from({ length: 24 }, (_, i) => ({ turn: i, kind: "x".repeat(32), a: 1, b: 2, w: 1 }));
  big.cycle.l = Object.fromEntries(Array.from({ length: 999 }, (_, i) => [String(i), 1999]));
  big.cycle.phases = Object.fromEntries(Array.from({ length: 999 }, (_, i) => [String(i), "depression"]));
  big.systems = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [String(i), { system: "merchantOligarchy",
    from: "merchantOligarchy", since: 1000 }]));
  const text = saveMacro(big);
  assert.ok(utf8Bytes(text) <= MACRO_MAX_BYTES || loadMacro(text).macro.cycle.history.length === 1);
  assert.deepEqual(loadMacro(text).macro.cycle.events, []);
});

test("readings: blended terms, E + L with the cut, phase and spread; Off and Planned sit outside", () => {
  const macro = sanitizeMacro(full());
  const civs = [{ id: 3, warehouses: 10, cushionBp: 0 }, { id: 5 }, { id: 9 }];
  const on = macroReadings(macro, { civs, turn: 40, options: { cycle: "standard", inflation: true } });
  assert.equal(on.e, 9400);
  assert.equal(on.panic, true, "turn 40 is before 44");
  assert.deepEqual(on.civ.get(3), { index: 9050, lEff: -350, phase: "panic", spreadPct: 159 });
  assert.equal(on.civ.get(5).index, 9700);
  assert.equal(on.terms.get(3).bondPct, 95, "half way from Mixed (100) to Market (90)");
  assert.equal(on.piPpm, 2000);
  const later = macroReadings(macro, { civs, turn: 44, options: { cycle: "strong" } });
  assert.equal(later.panic, false);
  assert.equal(later.civ.get(3).phase, "slump");
  assert.equal(later.piPpm, 0, "Inflation off");
  const off = macroReadings(macro, { civs, turn: 40, options: { cycle: "off", systems: false } });
  assert.deepEqual([off.e, off.panic, off.civ.get(3).phase, off.civ.get(3).spreadPct, off.terms.get(3).bondPct],
    [10000, false, "steady", 100, 100]);
  macro.systems[9] = { system: "planned", from: "planned", since: 1 };
  assert.equal(macroReadings(macro, { civs, turn: 40, options: {} }).civ.get(9).phase, "outside");
  assert.equal(cycleKPct("mild"), 50);
  assert.equal(cycleKPct(undefined), 100);
  assert.equal(cycleKPct("nonsense"), 100);
});
