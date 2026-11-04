// The crisis panel's paths (econ-view-crisis.js on econ-policy.js policyView): the government's own cards with their
// tier, price and goal; the running Programme with its state, milestones, goal parts and End it; the affinity tags on
// the shared cards; the hardship line with Partisans; the pill and the header naming what the player is doing.
import test from "node:test";
import assert from "node:assert/strict";
import { byClass, installFakeDom, textOf } from "./_fake-dom.mjs";
import { OPEN_MACRO, civ, input } from "./_fixtures.mjs";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { pillsFor } from "../ui/econ-pills.js";

installFakeDom();
const { crisisSection } = await import("../ui/econ-view-crisis.js");
const { renderSubtitle } = await import("../ui/econ-view-summary.js");

const ME = 3;
const ON = { crises: true, cycle: "standard", systems: true, inflation: false, swings: "gentle" };
const democrat = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
  ideology: "IDEOLOGY_DEMOCRACY", influence: 500, production: 40, cities: [], ...over });
const DEPRESSION = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7500 } };

function makeApi(planInput, extra = {}) {
  return {
    me: ME, input: () => planInput, loc: (key, ...args) => [key, ...args].join("|"),
    nameOf: (party) => `Civ ${party}`, request: () => true, dropRequest: () => true, pending: () => [],
    setGuard: () => true, guardOn: () => true, stageOpener: () => null, cards: () => [], swapTo: () => Promise.resolve("sent"),
    canSwap: () => true, rerender: () => {}, resourceName: (t) => t, buildName: (t) => t, cityName: (id) => id,
    possibleRoutes: () => null, turnLabel: (turn) => turn, ...extra,
  };
}

const withCrisis = (over = {}) => input({ age: "AGE_MODERN", turn: 50, options: ON, macro: DEPRESSION,
  civs: [democrat()], ledger: { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }] }, ...over });

test("the government's own cards: tier, history, price in Influence and Gold, a Programme's goal and its three ends", () => {
  const block = crisisSection(makeApi(withCrisis()));
  const text = textOf(block);
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_OWN"));
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_OWNER_IDEOLOGY_DEMOCRACY"), "names who can take them");
  const cards = byClass(block, "econ-policy");
  assert.equal(cards.length, 3, "New Deal programmes, Bank regulation, Lend-lease");
  const newDeal = textOf(cards[0]);
  for (const key of ["POLICY_NEW_DEAL_NAME", "PATHS_TIER_PROGRAMME", "POLICY_NEW_DEAL_HISTORY", "PATHS_PRICE_INFLUENCE|60",
    "PATHS_PRICE_UPKEEP|6|5", "PATHS_PRICE_RATE", "POLICY_NEW_DEAL_GOAL", "POLICY_NEW_DEAL_EARNED",
    "POLICY_NEW_DEAL_COMPROMISED", "POLICY_NEW_DEAL_ABANDONED"]) {
    assert.ok(newDeal.includes(`LOC_ECONOMICS_${key}`), key);
  }
  assert.ok(textOf(cards[2]).includes("LOC_ECONOMICS_REASON_NEEDS_FRIENDATWAR"), "Lend-lease says why it can't");
});

test("a running Programme: its state, three milestones, goal parts, the minimum left, End it", () => {
  const ledger = { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }],
    policies: [{ rid: "3-48-1", card: "new-deal", pid: ME, crisis: "depression", crisisSince: 48, since: 49, until: null,
      state: "active", settled: 50, c: { prod: 40, added: 6, cut: false, reliefEnded: false, locs: [] } }] };
  const block = crisisSection(makeApi(withCrisis({ ledger })));
  const card = byClass(block, "econ-policy-running")[0];
  const text = textOf(card);
  for (const key of ["PATHS_STATE_ACTIVE", "PATHS_PIP_COMMIT", "PATHS_PIP_SUSTAIN", "PATHS_PIP_OBJECTIVE",
    "PATH_PUBLIC_INVESTMENT_NAME", "PATHS_MIN_LEFT|4", "PATHS_PART_DONE|LOC_ECONOMICS_PART_GRANTS_LANDED",
    "PATHS_PART_OPEN|LOC_ECONOMICS_PART_PRODUCTION", "PATHS_ADDED|6", "PATHS_PROVISIONAL", "CRISIS_END_BUTTON"]) {
    assert.ok(text.includes(`LOC_ECONOMICS_${key}`), key);
  }
  assert.ok(textOf(block).includes("LOC_ECONOMICS_REASON_RUNNING") || !textOf(block).includes("POLICY_NEW_DEAL_HISTORY"),
    "the running card isn't offered again");
});

test("a Programme in arrears: the running card's lines, the End-it charge and the pill", () => {
  const ledger = { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }],
    policies: [{ rid: "3-48-1", card: "new-deal", pid: ME, crisis: "depression", crisisSince: 48, since: 49, until: null,
      state: "active", settled: 50, arrearsRun: 2, arrearsPoints: 3, paidRun: 0,
      c: { locs: [], lastArrearsCents: 1250, lastArrearsSupport: 1, nextArrearsCents: 1900 } }] };
  const block = crisisSection(makeApi(withCrisis({ ledger })));
  const text = textOf(byClass(block, "econ-policy-running")[0]);
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_ARREARS_NOW|2|3|12.5|1|19|3|6") || text.includes("LOC_ECONOMICS_PATHS_ARREARS_NOW|2|3"), text);
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_ARREARS_INFLUENCE|"), "what to gain to pay again");
  const clean = { ...ledger, policies: [{ ...ledger.policies[0], arrearsRun: 0, arrearsPoints: 0 }] };
  assert.equal(textOf(crisisSection(makeApi(withCrisis({ ledger: clean })))).includes("ARREARS"), false);
  const fmt = { loc: (k) => k, gold: (c) => String(c), rate: (p) => String(p), phaseKey: (p) => `PHASE_${p}` };
  const pills = pillsFor({ inDefault: false, owedCents: 0, phase: "depression", cycleOn: true, inflationOn: false,
    piPpm: 0, inCrisis: true, running: ["LOC_ECONOMICS_POLICY_NEW_DEAL_NAME"], arrears: true }, fmt);
  assert.equal(pills[0].text, "PHASE_depression · LOC_ECONOMICS_POLICY_NEW_DEAL_NAME · LOC_ECONOMICS_PILL_ARREARS");
});

test("a Programme still settling after its crisis ended keeps the section and reads Resolving", () => {
  const ledger = { ...emptyLedger(), crises: [],
    policies: [{ rid: "3-48-1", card: "bank-regulation", pid: ME, crisis: "depression", crisisSince: 48, since: 44,
      until: null, state: "sustained", settled: 50, c: { share: 0, nextId: 1, locs: [] } }] };
  const block = crisisSection(makeApi(withCrisis({ ledger, macro: emptyMacro() })));
  assert.ok(block, "the section stays while a Programme settles");
  assert.ok(textOf(block).includes("LOC_ECONOMICS_PATHS_STATE_RESOLVING"));
  assert.equal(byClass(block, "econ-policy").length, 0, "no new cards outside a crisis");
});

test("the shared cards carry their affinity tag for the player's system", () => {
  const planInput = withCrisis({ macro: { ...DEPRESSION, systems: { [String(ME)]: { system: "market", from: "mixed", since: 1 } } } });
  const text = textOf(crisisSection(makeApi(planInput)));
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_TAG_OPPOSITION"), "a market resists the bank holiday");
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_TAG_ADVANTAGE"), "and is built for public works");
});

test("the hard-times lines show with Partisans running and hard times to report, not otherwise", () => {
  const ht = { depression: 4, depressionTurns: 6, austerityStrain: 7, austerityRunning: true, arrearsPoints: 0 };
  const on = textOf(crisisSection(makeApi(withCrisis(), { partisans: () => true, hardTimes: () => ht })));
  assert.ok(on.includes("LOC_ECONOMICS_PATHS_HARD_TIMES"));
  assert.ok(on.includes("LOC_ECONOMICS_PATHS_HARD_TIMES_STRAIN|7"));
  const off = textOf(crisisSection(makeApi(withCrisis(), { partisans: () => false, hardTimes: () => ht })));
  assert.equal(off.includes("PATHS_HARD_TIMES"), false);
  const calm = { ...ht, depression: 0, austerityStrain: 0 };
  const none = textOf(crisisSection(makeApi(withCrisis(), { partisans: () => true, hardTimes: () => calm })));
  assert.equal(none.includes("PATHS_HARD_TIMES"), false);
});

test("the pill and the header name what the player is doing about the crisis", () => {
  const fmt = { loc: (k) => k, gold: (c) => String(c), rate: (p) => String(p), phaseKey: (p) => `PHASE_${p}` };
  const pills = pillsFor({ inDefault: false, owedCents: 0, phase: "depression", cycleOn: true, inflationOn: false,
    piPpm: 0, inCrisis: true, running: ["LOC_ECONOMICS_POLICY_NEW_DEAL_NAME"] }, fmt);
  assert.equal(pills[0].text, "PHASE_depression · LOC_ECONOMICS_POLICY_NEW_DEAL_NAME");
  const calm = pillsFor({ inDefault: false, owedCents: 0, phase: "steady", cycleOn: true, inflationOn: false,
    piPpm: 0, inCrisis: false, running: [] }, fmt);
  assert.equal(calm[0].text, "PHASE_steady");
  const ledger = { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }],
    policies: [{ rid: "3-48-1", card: "new-deal", pid: ME, crisis: "depression", crisisSince: 48, since: 49, until: null,
      state: "active", settled: 50, c: { locs: [] } }] };
  const host = document.createElement("div");
  renderSubtitle(host, makeApi(withCrisis({ ledger })));
  assert.ok(textOf(host).includes("LOC_ECONOMICS_POLICY_NEW_DEAL_NAME"));
});

test("the Fiscal tab: the paths' legacies by name and how the player's crises have shaped it", async () => {
  const { legaciesSection } = await import("../ui/econ-view-crisis.js");
  const ledger = { ...emptyLedger(), legacies: [{ pid: ME, id: "path-citizens-earned", since: 37, until: null, nextAge: false }],
    affinity: [{ pid: ME, steps: { "citizens-republic": -1, "company-state": 1 } }] };
  const text = textOf(legaciesSection(makeApi(input({ age: "AGE_ANTIQUITY", options: ON, civs: [democrat()], ledger }))));
  assert.ok(text.includes("LOC_ECONOMICS_LEGACY_PATH_CITIZENS_EARNED_NAME"));
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_SHAPED"));
  assert.ok(text.includes("LOC_ECONOMICS_PATH_CITIZENS_REPUBLIC_NAME") && text.includes("-5%"));
  assert.ok(text.includes("LOC_ECONOMICS_PATHS_SHAPED_OTHERS") && text.includes("+5%"), "the paths not built share a line");
});
