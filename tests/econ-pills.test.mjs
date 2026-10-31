// The top-bar pills (DESIGN 9): a debt pill only while something is owed (red in default), a phase pill while the
// cycle is on (amber in a Slump, red in a Depression or a Panic), an inflation pill only while the rate is above 0.
import test from "node:test";
import assert from "node:assert/strict";

import { pillsFor } from "../ui/econ-pills.js";

const fmt = { loc: (key, ...args) => [key.replace("LOC_ECONOMICS_", ""), ...args].join("|"),
  gold: (c) => String(c / 100), rate: (ppm) => `${ppm / 10000}%`,
  phaseKey: (phase) => `LOC_ECONOMICS_PHASE_${phase.toUpperCase()}` };
const base = { inDefault: false, owedCents: 0, phase: "steady", cycleOn: true, inflationOn: true, piPpm: 0 };

test("no debt and no inflation: the phase pill alone, plain", () => {
  assert.deepEqual(pillsFor(base, fmt), [{ text: "PHASE_STEADY", tone: "plain" }]);
});

test("a debt pill while something is owed, red only in default; the phase coloured on its own", () => {
  assert.deepEqual(pillsFor({ ...base, owedCents: 5600 }, fmt), [{ text: "PILL|56", tone: "plain" },
    { text: "PHASE_STEADY", tone: "plain" }]);
  assert.deepEqual(pillsFor({ ...base, inDefault: true, owedCents: 5600, phase: "slump" }, fmt),
    [{ text: "PILL_DEFAULT", tone: "warning" }, { text: "PHASE_SLUMP", tone: "caution" }]);
  assert.deepEqual(pillsFor({ ...base, phase: "panic" }, fmt).map((p) => p.tone), ["warning"]);
  assert.deepEqual(pillsFor({ ...base, phase: "depression" }, fmt).map((p) => p.tone), ["warning"]);
  assert.deepEqual(pillsFor({ ...base, phase: "boom" }, fmt).map((p) => p.tone), ["plain"]);
});

test("the inflation pill only above 0, amber from 1% a turn; nothing with the cycle off and no debt", () => {
  assert.deepEqual(pillsFor({ ...base, piPpm: 600 }, fmt), [{ text: "PHASE_STEADY", tone: "plain" },
    { text: "PILL_INFLATION|0.06%", tone: "plain" }]);
  assert.deepEqual(pillsFor({ ...base, piPpm: 12000 }, fmt)[1], { text: "PILL_INFLATION|1.2%", tone: "caution" });
  assert.deepEqual(pillsFor({ ...base, piPpm: 12000, inflationOn: false }, fmt).length, 1);
  assert.deepEqual(pillsFor({ ...base, cycleOn: false }, fmt), []);
  assert.deepEqual(pillsFor({ ...base, cycleOn: false, phase: null, owedCents: 100 }, fmt), [{ text: "PILL|1", tone: "plain" }]);
});
