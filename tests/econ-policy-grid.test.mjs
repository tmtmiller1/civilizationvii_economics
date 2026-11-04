// The balance grid for the crisis paths (v3 section 9, criterion 1): across incomes, reserves, Influence, index
// depths, crisis kinds, war, debt and a world with an ally at war and a trade bill, each government's own cards are
// worth taking to the AI in some cells and declined in others, and none of them is the best pick in every cell.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { viewContext } from "../ui/econ-view-model.js";
import { cardsFor, policyRefusal, utilityOf } from "../ui/econ-policy.js";
import { POLICIES } from "../ui/econ-policy-catalog.js";
import { OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const ON = { crises: true, cycle: "standard", systems: false, inflation: false, swings: "gentle" };
const city = (id) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3, loc: id, orig: ME });
// Influence that grew 20 a turn for five turns, so the per-turn prices pass the AI's forecast.
const GROWING = [{ pid: ME, turn: 49, stocks: [100, 120, 140, 160, 180, 200] }];
const sets = [
  ["AGE_ANTIQUITY", { government: "GOVERNMENT_CLASSICAL_REPUBLIC" }],
  ["AGE_EXPLORATION", { government: "GOVERNMENT_PLUTOCRACY" }],
  ["AGE_MODERN", { ideology: "IDEOLOGY_DEMOCRACY", government: "GOVERNMENT_ELECTIVE_REPUBLIC" }],
  ["AGE_MODERN", { ideology: "IDEOLOGY_FASCISM", government: "GOVERNMENT_AUTHORITARIANISM" }],
];

function grid() {
  const tally = {};
  const taken = {};

for (const [age, who] of sets) for (const income of [3000, 10000, 30000]) for (const bal of [2, 10, 40])
  for (const inf of [40, 150, 600]) for (const e of [6500, 7500, 8500]) for (const kind of ["depression", "debt"])
    for (const atWar of [false, true]) for (const debt of [0, 1]) for (const world of [0, 1]) {
      const c = civ(ME, { incomeCents: income, balanceCents: bal * income, stages: OPEN_MACRO, influence: inf,
        production: 40, cities: [city("3:1"), city("3:2")], upkeepCents: 1500, strength: 10, atWar, ...who });
      const loans = debt ? [{ id: "L1", lender: "bond", borrower: ME, outstanding: 15 * income, principal: 15 * income,
        ratePpm: 15000, term: 20, missed: 0, state: "active", source: "bond", since: 40 }] : [];
      const foe = civ(9, { incomeCents: income, balanceCents: income * 10, stages: OPEN_MACRO, strength: 4, cities: [], ...who, ideology: "IDEOLOGY_COMMUNISM" });
      const ally = civ(7, { incomeCents: income, balanceCents: income * 10, stages: OPEN_MACRO, strength: 8, cities: [], ...who });
      const rel = world ? [{ a: ME, b: 9, level: "war" }, { a: 7, b: 9, level: "war" }, { a: ME, b: 7, level: "friendly" }] : [{ a: ME, b: 9, level: "neutral" }];
      const ctx = viewContext(input({ age, turn: 50, civs: [c, foe, ally], options: ON, routes: [{ importer: ME, exporter: 9, resources: [] }], relations: rel,
        macro: { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e } },
        ledger: { ...emptyLedger(), loans, crises: [{ pid: ME, kind, since: 48 }], influenceLog: GROWING } }));
      ctx.readings = { ...(ctx.readings || {}), civ: new Map([[ME, { index: e, phase: "depression" }]]) };
      const me = ctx.civ.get(ME);
      if (world) ctx.trade = [...(ctx.trade || []), { payer: ME, payee: 9, cents: income / 5 }];
      let best = "none", bu = 0;
      for (const spec of cardsFor(ctx, me)) {
        if (policyRefusal(ctx, me, spec)) continue;
        const u = utilityOf(ctx, me, spec);
        if (u > 0) taken[spec.id] = (taken[spec.id] || 0) + 1;
        if (u > bu) { bu = u; best = spec.id; }
      }
      (tally[best] ||= 0); tally[best] += 1;
      tally.cells = (tally.cells || 0) + 1;
    }
  return { tally, taken };
}

test("each card is taken somewhere in the grid and declined somewhere, and no card is the best pick everywhere", () => {
  const { tally, taken } = grid();
  if (process.env.GRID_PRINT) console.log(JSON.stringify({ tally, taken }));
  const perGovernment = tally.cells / 4;
  for (const spec of POLICIES) {
    // The AI takes its best card each turn, so over a crisis it takes every card worth more than nothing.
    assert.ok((taken[spec.id] || 0) > 0, `${spec.id} is never worth taking`);
    assert.ok(taken[spec.id] < perGovernment, `${spec.id} is taken in every cell`);
    assert.ok((tally[spec.id] || 0) < perGovernment, `${spec.id} is the best pick in every cell of its government`);
  }
});
