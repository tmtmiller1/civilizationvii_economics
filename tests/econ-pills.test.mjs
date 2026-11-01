// The top-bar pills (DESIGN 9): a debt pill only while something is owed (red in default), a phase pill while the
// cycle is on (amber in a Slump, red in a Depression or a Panic), an inflation pill only while the rate is above 0.
import test from "node:test";
import assert from "node:assert/strict";

import { pillsFor } from "../ui/econ-pills.js";

const fmt = { loc: (key, ...args) => [key.replace("LOC_ECONOMICS_", ""), ...args].join("|"),
  gold: (c) => String(c / 100), rate: (ppm) => `${ppm / 10000}%`,
  phaseKey: (phase) => `LOC_ECONOMICS_PHASE_${phase.toUpperCase()}` };
const base = { inDefault: false, owedCents: 0, phase: "steady", cycleOn: true, inflationOn: true, piPpm: 0 };

/** The text and tone alone, for the colour tests. @param {ReturnType<typeof pillsFor>} pills */
const looks = (pills) => pills.map(({ text, tone }) => ({ text, tone }));

test("no debt and no inflation: the phase pill alone, plain", () => {
  assert.deepEqual(looks(pillsFor(base, fmt)), [{ text: "PHASE_STEADY", tone: "plain" }]);
});

test("each pill opens the tab that explains it, landed on its section", () => {
  const all = pillsFor({ ...base, inDefault: true, owedCents: 5600, phase: "depression", piPpm: 12000 }, fmt);
  assert.deepEqual(all.map((p) => [p.tab, p.focus, p.tip]), [["loans", ".econ-card--trouble", "PILL_TIP_DEFAULT"],
    ["world", ".econ-world-now", "PILL_TIP_PHASE"], ["world", ".econ-world-inflation", "PILL_TIP_INFLATION"]]);
  const debt = pillsFor({ ...base, owedCents: 5600 }, fmt)[0];
  assert.deepEqual([debt.tab, debt.focus, debt.tip], ["loans", null, "PILL_TIP_DEBT"]);
  const crisis = pillsFor({ ...base, phase: "depression", inCrisis: true }, fmt)[0];
  assert.deepEqual([crisis.tab, crisis.focus, crisis.tip], ["world", ".econ-crisis", "PILL_TIP_CRISIS"]);
});

test("a debt pill while something is owed, red only in default; the phase coloured on its own", () => {
  assert.deepEqual(looks(pillsFor({ ...base, owedCents: 5600 }, fmt)), [{ text: "PILL|56", tone: "plain" },
    { text: "PHASE_STEADY", tone: "plain" }]);
  assert.deepEqual(looks(pillsFor({ ...base, inDefault: true, owedCents: 5600, phase: "slump" }, fmt)),
    [{ text: "PILL_DEFAULT", tone: "warning" }, { text: "PHASE_SLUMP", tone: "caution" }]);
  assert.deepEqual(pillsFor({ ...base, phase: "panic" }, fmt).map((p) => p.tone), ["warning"]);
  assert.deepEqual(pillsFor({ ...base, phase: "depression" }, fmt).map((p) => p.tone), ["warning"]);
  assert.deepEqual(pillsFor({ ...base, phase: "boom" }, fmt).map((p) => p.tone), ["plain"]);
});

test("the inflation pill only above 0, amber from 1% a turn; nothing with the cycle off and no debt", () => {
  assert.deepEqual(looks(pillsFor({ ...base, piPpm: 600 }, fmt)), [{ text: "PHASE_STEADY", tone: "plain" },
    { text: "PILL_INFLATION|0.06%", tone: "plain" }]);
  assert.deepEqual(looks(pillsFor({ ...base, piPpm: 12000 }, fmt))[1], { text: "PILL_INFLATION|1.2%", tone: "caution" });
  assert.deepEqual(pillsFor({ ...base, piPpm: 12000, inflationOn: false }, fmt).length, 1);
  assert.deepEqual(pillsFor({ ...base, cycleOn: false }, fmt), []);
  assert.deepEqual(looks(pillsFor({ ...base, cycleOn: false, phase: null, owedCents: 100 }, fmt)), [{ text: "PILL|1", tone: "plain" }]);
});
