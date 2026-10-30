// Economic systems (DESIGN 4.17; TEST-PLAN 12.1 econ-systems): the table, ideology ahead of government, Mixed for
// anything unlisted, each system's terms against Mixed, the 10-turn blend, a government that reads none.
import test from "node:test";
import assert from "node:assert/strict";
import { GOVERNMENT_SYSTEMS, MIXED_TERMS, SYSTEM_IDS, blendedTerms, isSystemId, nextSystems, systemFor, takesCapitalism,
  termsOf } from "../ui/econ-systems.js";

test("ideology decides ahead of the government; unlisted or missing runs Mixed", () => {
  assert.equal(systemFor({ government: "GOVERNMENT_DESPOTISM" }), "tribute");
  assert.equal(systemFor({ government: "GOVERNMENT_CLASSICAL_REPUBLIC" }), "civicMarket");
  assert.equal(systemFor({ government: "GOVERNMENT_AUTHORITARIANISM", ideology: "IDEOLOGY_DEMOCRACY" }), "market");
  assert.equal(systemFor({ government: "GOVERNMENT_ELECTIVE_REPUBLIC", ideology: "IDEOLOGY_COMMUNISM" }), "planned");
  assert.equal(systemFor({ government: "GOVERNMENT_ELECTIVE_REPUBLIC", ideology: "IDEOLOGY_FASCISM" }), "corporatist");
  assert.equal(systemFor({ government: "GOVERNMENT_REVOLUTIONARY_REPUBLIC" }), "mixed");
  assert.equal(systemFor({ government: "GOVERNMENT_REVOLUCION" }), "mixed");
  assert.equal(systemFor({ government: "GOVERNMENT_FROM_A_MOD" }), "mixed");
  assert.equal(systemFor({}), "mixed");
  assert.equal(systemFor({ ideology: "IDEOLOGY_UNKNOWN", government: "GOVERNMENT_THEOCRACY" }), "religious");
  for (const id of Object.values(GOVERNMENT_SYSTEMS)) assert.ok(isSystemId(id), id);
  assert.equal(isSystemId("feudal"), false);
});

test("each system changes only its own numbers from Mixed", () => {
  assert.deepEqual(termsOf("mixed"), { ...MIXED_TERMS });
  const diff = (id) => Object.keys(MIXED_TERMS).filter((key) => termsOf(id)[key] !== MIXED_TERMS[key]).sort();
  assert.deepEqual(diff("market"), ["bondPct", "lDecayPct", "panicL"]);
  assert.deepEqual(diff("tribute"), ["aidRelationPct", "borrowPct", "civLendersOnly"]);
  assert.deepEqual(diff("civicMarket"), ["citizens", "commercePct", "tradeBuildingPct"]);
  assert.deepEqual(diff("merchantOligarchy"), ["borrowPct", "creditTurns", "lMultPct", "lendPct", "panicL"]);
  assert.deepEqual(diff("manorial"), ["billPaidPct", "creditTurns", "lMultPct", "warehouseMultPct"]);
  assert.deepEqual(diff("mercantile"), ["bondPct", "dividendMille", "exportPct", "highTariffEveryTurns", "lMultPct"]);
  assert.deepEqual(diff("religious"), ["aidRelationPct", "partnership"]);
  assert.deepEqual(diff("corporatist"), ["bondPct", "creditPct", "devLoansOnly", "erosionPct", "industryPct", "warBoom"]);
  assert.deepEqual(diff("planned"), ["civLendersOnly", "devLoansOnly", "fixedPrices", "outOfCycle", "plan"]);
  assert.equal(termsOf("market").bondPct, 90);
  assert.equal(termsOf("corporatist").creditPct, 150);
  assert.equal(SYSTEM_IDS.length, 10);
});

test("a change blends each number evenly over 10 turns; a yes-or-no term switches at once", () => {
  const row = { system: "market", from: "corporatist", since: 100 };
  assert.equal(blendedTerms(row, 100).bondPct, 75);
  assert.equal(blendedTerms(row, 105).bondPct, 83);
  assert.equal(blendedTerms(row, 110).bondPct, 90);
  assert.equal(blendedTerms(row, 140).bondPct, 90);
  assert.equal(blendedTerms(row, 101).devLoansOnly, false, "the new system's rule from the turn of the change");
  assert.equal(blendedTerms(row, 102).creditPct, 140);
  assert.deepEqual(blendedTerms(undefined, 5), termsOf("mixed"));
  assert.deepEqual(blendedTerms({ system: "tribute", from: "tribute", since: 3 }, 4), termsOf("tribute"));
  assert.equal(blendedTerms(row, 90).bondPct, 75, "a turn before the change reads the old system");
});

test("next systems: the first is no change, a new one is, a government that reads none keeps the last", () => {
  const civs = [{ id: 1, alive: true, government: "GOVERNMENT_DESPOTISM" }, { id: 2, alive: true, government: null },
    { id: 3, alive: false, government: "GOVERNMENT_OLIGARCHY" }];
  const first = nextSystems({}, civs, 10, true);
  assert.deepEqual(first.systems, { 1: { system: "tribute", from: "tribute", since: 10 },
    2: { system: "mixed", from: "mixed", since: 10 } });
  assert.deepEqual(first.changes, []);
  const age = nextSystems(first.systems, [{ id: 1, alive: true, government: null, ideology: null }], 121, true);
  assert.deepEqual(age.systems[1], { system: "tribute", from: "tribute", since: 10 }, "no government yet this age");
  const picked = nextSystems(age.systems, [{ id: 1, alive: true, government: "GOVERNMENT_FEUDAL_MONARCHY" }], 124, true);
  assert.deepEqual(picked.systems[1], { system: "manorial", from: "tribute", since: 124 });
  assert.deepEqual(picked.changes, [{ pid: 1, from: "tribute", to: "manorial" }]);
  const off = nextSystems(picked.systems, [{ id: 1, alive: true, government: "GOVERNMENT_OLIGARCHY" }], 130, false);
  assert.equal(off.systems[1].system, "mixed");
  assert.deepEqual(off.changes, [], "Off runs everyone Mixed and announces nothing");
});

test("Capitalism's effects are for Market and Mixed civs only", () => {
  assert.equal(takesCapitalism("market"), true);
  assert.equal(takesCapitalism("mixed"), true);
  assert.equal(takesCapitalism(undefined), true, "a civ with no system yet runs Mixed");
  assert.equal(takesCapitalism("corporatist"), false);
});
