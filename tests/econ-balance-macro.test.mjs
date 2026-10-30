import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { MACRO_TURNS, citizenLoanRow, makeMacroGame, planRow, runMacroGame, systemDiversityRows }
  from "./_balance-macro.mjs";

// The 1.2 rows of DESIGN 10's balance ladder. The hard rows (Depression never held 30 turns, at most two Panics a
// game, inflation never 20 turns at its cap, the macro envelope under 32 KB, the turn under 50 ms) are asserted; the
// play rows (cycle shape, system diversity, citizen loans against Light tax, the plan against Mixed) are measured and
// written to reports/balance-1.2.json for the owner to read against their starting targets.
const GAMES = 6;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
};

/** The longest run of turns a predicate holds over a series. */
function longestRun(series, holds) {
  let best = 0;
  let run = 0;
  for (const x of series) { run = holds(x) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

/** Share of turns in each world phase, from E. */
function phaseShares(e) {
  const out = { depression: 0, slump: 0, steady: 0, boom: 0 };
  for (const x of e) {
    const phase = x < 8000 ? "depression" : x < 9500 ? "slump" : x > 10500 ? "boom" : "steady";
    out[phase] += 1;
  }
  for (const key of Object.keys(out)) out[key] = Math.round((out[key] * 1000) / e.length) / 1000;
  return out;
}

/** Turns any civ spent in its own Slump or worse, and the longest civ Depression. */
function civPhaseFacts(phases) {
  let slumpTurns = 0;
  const runs = new Map();
  let longestDepression = 0;
  for (const turn of phases) {
    for (const [pid, phase] of Object.entries(turn)) {
      if (phase === "slump" || phase === "depression") slumpTurns += 1;
      const run = phase === "depression" ? (runs.get(pid) || 0) + 1 : 0;
      runs.set(pid, run);
      longestDepression = Math.max(longestDepression, run);
    }
  }
  return { slumpCivTurns: slumpTurns, longestCivDepression: longestDepression };
}

test(`balance ladder 1.2: ${GAMES} seeded 12-civ ${MACRO_TURNS}-turn games, a peaceful one, and the system rows`, () => {
  const report = { games: GAMES, turns: MACRO_TURNS, civs: 12, cycle: [], inflation: [], gold: [], peaceful: null,
    systems: systemDiversityRows(), citizens: citizenLoanRow(), plan: planRow() };
  const times = [];
  let maxBytes = 0;
  for (let i = 0; i < GAMES; i += 1) {
    const facts = runMacroGame(makeMacroGame(4200 + i));
    const civFacts = civPhaseFacts(facts.phases);
    assert.ok(longestRun(facts.e, (x) => x < 8000) < 30, "the world never holds a Depression 30 turns");
    assert.ok(civFacts.longestCivDepression < 30, `a civ's Depression held ${civFacts.longestCivDepression} turns`);
    assert.ok(facts.panics <= 2, `${facts.panics} Panics`);
    assert.ok(longestRun(facts.pi, (x) => x >= 5000) < 20, "inflation never sits at its cap 20 turns");
    times.push(...facts.planMs);
    maxBytes = Math.max(maxBytes, facts.maxMacroBytes);
    report.cycle.push({ game: i, worldPhases: phaseShares(facts.e), minE: Math.min(...facts.e), maxE: Math.max(...facts.e),
      panics: facts.panics, maxLeverPct: Math.max(...facts.lever), bondLoans: facts.bondLoans, ...civFacts });
    const pi = facts.pi.filter((x) => x > 0);
    report.inflation.push({ game: i, turnsWithInflation: pi.length, medianPiPpm: median(pi), worstPiPpm: Math.max(0, ...pi) });
    const gold = [...facts.gold.values()];
    report.gold.push({ game: i, cycleGoldPerCivTurn: Math.round(gold.reduce((s, r) => s + r.cycle, 0) / 12 / MACRO_TURNS)
      / 100, erosionGold: -gold.reduce((s, r) => s + r.erosion, 0) / 100,
    planGold: -gold.reduce((s, r) => s + r.plan, 0) / 100 });
  }
  const peaceful = runMacroGame(makeMacroGame(4300, { peaceful: true }));
  report.peaceful = { worldPhases: phaseShares(peaceful.e), minE: Math.min(...peaceful.e),
    ...civPhaseFacts(peaceful.phases) };
  assert.ok(median(times) < 50, `median ${median(times)} ms`);
  assert.ok(maxBytes <= 32768, `${maxBytes} bytes`);
  report.planMs = { median: median(times), max: Math.max(...times) };
  report.maxMacroBytes = maxBytes;
  mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../reports/balance-1.2.json", import.meta.url), `${JSON.stringify(report, null, 1)}\n`);
});
