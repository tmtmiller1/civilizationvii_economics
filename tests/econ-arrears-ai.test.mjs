// The AI's side of Programmes in arrears (hard-times plan v2, Part 2, "The AI's choice"): keeping a card short of
// Influence against ending it, the goal counted only while it can still be met, a Fascist state's war, the risings
// alike for every government, and the Influence forecast a Programme now needs before the AI takes it.

import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { viewContext } from "../ui/econ-view-model.js";
import { arrearsCharge } from "../ui/econ-policy.js";
import { influenceForecast, keepOrEnd, keepValue, underPressure } from "../ui/econ-policy-read.js";
import { policyById } from "../ui/econ-policy-catalog.js";
import { OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const AI = 6;
const FOE = 9;
const ON = { crises: true, cycle: "standard", systems: false, inflation: false, swings: "gentle" };
const DEPRESSION = () => ({ ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7500 } });
const crises = [{ pid: AI, kind: "depression", since: 48 }];
const city = (id) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3, loc: `${id}`,
  orig: Number(id.split(":")[0]) });
const democrat = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
  ideology: "IDEOLOGY_DEMOCRACY", government: "GOVERNMENT_ELECTIVE_REPUBLIC", influence: 0, production: 40,
  cities: [city(`${id}:1`), city(`${id}:2`)], upkeepCents: 1500, strength: 10, ...over });
const fascist = (id, over = {}) => democrat(id, { ideology: "IDEOLOGY_FASCISM",
  government: "GOVERNMENT_AUTHORITARIANISM", ...over });

/** A context at turn 50 with the AI's own index set (0.90: a shallow Depression, so the card's relief is small). */
function ctxFor(civs, { relations = [], ledger = {}, index = 9000 } = {}) {
  const ctx = viewContext(input({ age: "AGE_MODERN", civs, relations, macro: DEPRESSION(), options: ON,
    ledger: { ...emptyLedger(), crises, ...ledger } }));
  ctx.readings = { ...(ctx.readings || {}), civ: new Map([[AI, { index, phase: "depression" }]]) };
  return ctx;
}

/** A running Programme row, short `run` turns in a row with as many points. */
const policyRow = (card, run, c, over = {}) => ({ rid: "1", card, pid: AI, crisis: "depression", crisisSince: 48,
  since: 46, until: null, state: "active", settled: 50, arrearsRun: run, arrearsPoints: run, paidRun: 0,
  c: { inc: 10000, prod: 40, routes: 0, share: 0, nextId: 1, str: 10, locs: [], added: 0, streak: 0, maxStreak: 0,
    cut: false, reliefEnded: false, breach: null, selfHarm: false, warTurns: 0, everWar: false, lost: false, ...c },
  ...over });

/** The charge arrears() hands the AI for a row short `unpaid` Influence. */
const chargeOf = (row, unpaid) => ({ cents: arrearsCharge(row, unpaid, 0, row.arrearsPoints), support: 1,
  nextCents: arrearsCharge(row, unpaid, 0, row.arrearsPoints + 1) });

test("an AI keeps New Deal short of Influence with two parts met, three turns left and the open part reachable", () => {
  const spec = policyById("new-deal");
  const ctx = ctxFor([democrat(AI)]);
  const me = ctx.civ.get(AI);
  // Grants landed and relief held; production at 12 of the 20 it needs, 3 a turn over four turns: 21 in three more.
  const row = policyRow("new-deal", 1, { added: 12 });
  ctx.ledger.policies = [row];
  assert.equal(keepOrEnd(ctx, me, spec, row, chargeOf(row, 6)), true);
});

test("an AI ends New Deal whose open part can't be met, with two parts met and three turns left all the same", () => {
  const spec = policyById("new-deal");
  const ctx = ctxFor([democrat(AI)]);
  const me = ctx.civ.get(AI);
  // Production and relief met, but the grants were cut: that part can't be undone.
  const row = policyRow("new-deal", 1, { added: 24, cut: true });
  ctx.ledger.policies = [row];
  assert.equal(keepOrEnd(ctx, me, spec, row, chargeOf(row, 6)), false);
});

test("in a game an AI's New Deal with its grants cut ends on its first turn short; with them landed it runs on", () => {
  const base = { ...emptyLedger(), crises, influenceLog: [] };
  const run = (c) => planTurn(input({ age: "AGE_MODERN", turn: 51, civs: [democrat(AI)], macro: DEPRESSION(),
    options: ON, ledger: { ...base, policies: [policyRow("new-deal", 0, c, { settled: 50, since: 46 })] } }));
  const cut = run({ added: 24, cut: true });
  const outcome = cut.events.find((e) => e.kind === "policy-outcome");
  assert.equal(outcome?.outcome, "abandoned");
  assert.equal(outcome?.detail, "arrears-ended");
  // 14 of the 20 production at 2.8 a turn over five turns: 22 in the three turns of grace.
  const landed = run({ added: 14 });
  assert.equal(landed.events.find((e) => e.kind === "policy-outcome"), undefined);
  assert.equal(landed.ledger.policies.find((x) => x.card === "new-deal")?.arrearsRun, 1);
});

/**
 * Diversionary war twelve turns in with eight at war (two more meet the hold), its income fallen from 100 Gold at
 * Commit to 20, at war or at peace with a rival it could still fight. Returns the first turn short it ends on.
 */
function endsOn(atWar, who = fascist) {
  const spec = policyById("foreign-adventure");
  const civs = [who(AI, { incomeCents: 2000, upkeepCents: 300, strength: 8, atWar }), democrat(FOE, { strength: 4 })];
  const relations = [{ a: AI, b: FOE, level: atWar ? "war" : "neutral" }];
  for (let run = 1; run <= 3; run += 1) {
    const ctx = ctxFor(civs, { relations });
    const row = policyRow("foreign-adventure", run, { everWar: true, warTurns: 8, str: 10 }, { since: 38, debt: 0 });
    ctx.ledger.policies = [row];
    if (!keepOrEnd(ctx, ctx.civ.get(AI), spec, row, chargeOf(row, 3))) return run;
  }
  return 4;
}

test("a Fascist state at war keeps Diversionary war a turn longer than the same figures at peace", () => {
  assert.equal(endsOn(false), 2);
  assert.equal(endsOn(true), 3);
});

test("only a Fascist state at war values its war production at half again; risings cost all governments alike", () => {
  const spec = policyById("foreign-adventure");
  const value = (atWar, who) => {
    const ctx = ctxFor([who(AI, { incomeCents: 2000, upkeepCents: 300, atWar })]);
    const row = policyRow("foreign-adventure", 1, { everWar: true, warTurns: 8 }, { since: 38 });
    ctx.ledger.policies = [row];
    return keepValue(ctx, ctx.civ.get(AI), spec, row, chargeOf(row, 3));
  };
  // Military production at war is four turns of income over the card's five: 1,600 cents a turn, 800 more for Fascism.
  assert.equal(value(true, fascist) - value(true, democrat), 800);
  assert.equal(value(false, fascist), value(false, democrat));
});

test("settlements under pressure: the arrears share with the minimum of one, more with each point", () => {
  const base = { depression: 0, depressionTurns: 0, strain: 0, n: 10 };
  assert.equal(underPressure({ ...base, arrearsPoints: 0 }), 0);
  assert.equal(underPressure({ ...base, arrearsPoints: 1 }), 1);
  assert.equal(underPressure({ ...base, arrearsPoints: 6 }), 3);
  assert.equal(underPressure({ ...base, n: 0, arrearsPoints: 3 }), 0);
  assert.equal(underPressure({ ...base, depression: 4, depressionTurns: 10, arrearsPoints: 0, n: 2 }), 1);
  assert.equal(underPressure({ ...base, depression: 4, depressionTurns: 9, arrearsPoints: 0, n: 2 }), 0);
});

test("the Influence forecast passes on growth of the per-turn price on three of the last five turns", () => {
  const ctx = (stocks) => ({ ledger: { ...emptyLedger(), influenceLog: [{ pid: AI, turn: 50, stocks }] } });
  assert.equal(influenceForecast(ctx([100, 106, 112, 118, 118, 118]), AI, 6), true);
  assert.equal(influenceForecast(ctx([100, 106, 112, 112, 112, 112]), AI, 6), false);
  assert.equal(influenceForecast(ctx([100, 100, 400, 400, 400, 400]), AI, 6), false, "a one-time gain");
  assert.equal(influenceForecast(ctx([100, 106, 112]), AI, 6), false, "two turns watched");
  assert.equal(influenceForecast({ ledger: emptyLedger() }, AI, 6), false);
});

test("an AI whose Influence grew on only one of five turns doesn't take a Programme; steady growth does", () => {
  const plan = (stocks) => planTurn(input({ age: "AGE_MODERN", civs: [democrat(AI, { influence: 520 })],
    macro: DEPRESSION(), options: ON, ledger: { ...emptyLedger(), crises,
      influenceLog: [{ pid: AI, turn: 49, stocks }] } }));
  const programmes = (out) => out.events.filter((e) => e.kind === "policy"
    && policyById(e.policy)?.tier === "programme");
  assert.equal(programmes(plan([500, 500, 500, 520, 520, 520])).length, 0);
  assert.equal(programmes(plan([400, 420, 440, 460, 480, 500])).length, 1);
});

test("the Influence log keeps six stocks a civ and survives a save; a junk row is dropped", () => {
  let ledger = { ...emptyLedger(), crises };
  for (let turn = 50; turn < 58; turn += 1) {
    ledger = planTurn(input({ age: "AGE_MODERN", turn, civs: [democrat(AI, { influence: turn })], macro: DEPRESSION(),
      options: ON, ledger })).ledger;
  }
  assert.deepEqual(ledger.influenceLog, [{ pid: AI, turn: 57, stocks: [52, 53, 54, 55, 56, 57] }]);
  assert.deepEqual(load(save(ledger)).ledger.influenceLog, ledger.influenceLog);
  const junk = load(save({ ...ledger, influenceLog: [{ pid: -1, turn: 1, stocks: [] }, { pid: AI, turn: 50,
    stocks: [1, "x", 2, 3, 4, 5, 6, 7] }] })).ledger.influenceLog;
  assert.deepEqual(junk, [{ pid: AI, turn: 50, stocks: [2, 3, 4, 5, 6, 7] }]);
});

test("ending Diversionary war mid-war counts the borrowed upkeep's dearer loan as a cost of ending", () => {
  const spec = policyById("foreign-adventure");
  const value = (debt) => {
    const ctx = ctxFor([fascist(AI, { incomeCents: 20000, upkeepCents: 300, atWar: true })]);
    const row = policyRow("foreign-adventure", 1, { everWar: true, warTurns: 8 }, { since: 38, debt });
    ctx.ledger.policies = [row];
    return keepValue(ctx, ctx.civ.get(AI), spec, row, chargeOf(row, 3));
  };
  // Within the 5 turns of income the goal allows, so only the loan's extra quarter of interest moves the value.
  assert.ok(value(50000) > value(0), "a debt to convert makes keeping worth more");
});
