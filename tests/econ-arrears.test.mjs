// Programmes in arrears and hard times for Partisans (hard-times plan v2, Parts 1 and 2): the charge and its
// premium, the run and the points, the end, the counts across a save, and `hardTimes`' strain and Depression age.

import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const ON = { crises: true, cycle: "standard", systems: false, inflation: false, swings: "gentle" };
const DEPRESSION = () => ({ ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7500 } });
const city = (id) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3, loc: `${id}`,
  orig: Number(id.split(":")[0]) });
const democrat = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
  ideology: "IDEOLOGY_DEMOCRACY", government: "GOVERNMENT_ELECTIVE_REPUBLIC", influence: 500, production: 40,
  cities: [city(`${ME}:1`), city(`${ME}:2`)], upkeepCents: 1500, strength: 10, ...over });
const plan = (over = {}) => planTurn(input({ age: "AGE_MODERN", macro: DEPRESSION(), ...over, options: ON }));
const crises = [{ pid: ME, kind: "depression", since: 48 }];

/** Takes New Deal programmes at turn 50, then plays each turn with `influence[i]` Influence in hand. */
function newDeal(influence, over = {}) {
  let out = plan({ civs: [democrat(over)], requests: [{ kind: "policy", pid: ME, policy: "new-deal" }],
    ledger: { ...emptyLedger(), crises } });
  const outs = [];
  influence.forEach((inf, i) => {
    out = plan({ civs: [democrat({ ...over, influence: inf })], turn: 51 + i, ledger: { ...out.ledger, crises } });
    outs.push(out);
  });
  return outs;
}
const arrearsCents = (out) => out.transfers.filter((t) => t.reason === "arrears").reduce((a, t) => a + t.cents, 0);
const row = (out) => out.ledger.policies.find((x) => x.card === "new-deal");
const ended = (out) => out.events.find((e) => e.kind === "policy-outcome")?.outcome;

test("New Deal's three turns short on 100 Gold of income cost 30, 45 and 68 Gold, and the card keeps running", () => {
  const outs = newDeal([0, 0, 0]);
  assert.deepEqual(outs.map(arrearsCents), [3000, 4500, 6750]);
  assert.equal(row(outs[2]).arrearsRun, 3);
  assert.equal(row(outs[2]).arrearsPoints, 3);
  const line = outs[0].transfers.find((t) => t.reason === "arrears");
  assert.equal(line.label, "LOC_ECONOMICS_LEDGER_ARREARS");
  assert.deepEqual(line.labelArgs, ["LOC_ECONOMICS_POLICY_NEW_DEAL_NAME"]);
  assert.ok(outs[0].notices.some((n) => n.kind === "policy-arrears" && n.turnsLeft === 2));
  assert.ok(outs[2].notices.some((n) => n.kind === "policy-arrears" && n.turnsLeft === 0));
  assert.ok(!outs[1].notices.some((n) => n.kind === "policy-arrears"));
});

test("a turn short costs 1 Public support a settlement, 2 when the treasury can't cover the Gold", () => {
  const paid = newDeal([0]);
  assert.deepEqual(paid[0].celebration.filter((c) => c.reason === "arrears").map((c) => c.amount), [-200]);
  const broke = newDeal([0], { balanceCents: -100000 });
  assert.deepEqual(broke[0].celebration.filter((c) => c.reason === "arrears").map((c) => c.amount), [-400]);
  assert.equal(arrearsCents(broke[0]), 0);
});

test("a fourth turn short in a row ends the Programme with its early mark", () => {
  const outs = newDeal([0, 0, 0, 0]);
  assert.equal(ended(outs[2]), undefined);
  assert.equal(ended(outs[3]), "abandoned");
  assert.equal(row(outs[3]), undefined);
  assert.ok(outs[3].ledger.legacies.some((l) => l.id === "path-newdeal-abandoned"));
});

test("short, short, paid, short, short, paid, short, short ends it at 6 points", () => {
  const outs = newDeal([0, 0, 500, 0, 0, 500, 0, 0]);
  assert.equal(row(outs[6]).arrearsPoints, 5);
  assert.equal(ended(outs[7]), "abandoned");
});

test("three paid turns in a row clear a point; a paid turn clears the run", () => {
  const outs = newDeal([0, 0, 500, 500, 500]);
  assert.equal(row(outs[2]).arrearsRun, 0);
  assert.equal(row(outs[3]).arrearsPoints, 2);
  assert.equal(row(outs[4]).arrearsPoints, 1);
  assert.equal(arrearsCents(outs[4]), 0);
});

test("a save reloads both counts, and a turn settled twice charges once", () => {
  const outs = newDeal([0, 0]);
  const back = load(save(outs[1].ledger)).ledger;
  const again = back.policies.find((x) => x.card === "new-deal");
  assert.equal(again.arrearsRun, 2);
  assert.equal(again.arrearsPoints, 2);
  const twice = plan({ civs: [democrat({ influence: 0 })], turn: 52, ledger: { ...back, crises } });
  assert.equal(arrearsCents(twice), 0);
  assert.equal(twice.ledger.policies.find((x) => x.card === "new-deal").arrearsPoints, 2);
  const next = plan({ civs: [democrat({ influence: 0 })], turn: 53, ledger: { ...back, crises } });
  assert.equal(arrearsCents(next), 6750);
});

test("hard times: strain rises 1 a turn under Austerity and falls 2 after, never below 0, across a save", () => {
  const responses = [{ pid: ME, id: "austerity", crisis: "depression", since: 48, until: null }];
  let ledger = { ...emptyLedger(), crises, responses };
  const strain = [];
  for (let turn = 50; turn < 56; turn += 1) {
    const out = plan({ civs: [democrat()], turn, ledger });
    strain.push(out.hardTimes[String(ME)].austerityStrain);
    assert.equal(out.hardTimes[String(ME)].austerityRunning, true);
    ledger = load(save(out.ledger)).ledger;
  }
  assert.deepEqual(strain, [1, 2, 3, 4, 5, 6]);
  ledger = { ...ledger, responses: [] };
  const after = [];
  for (let turn = 56; turn < 60; turn += 1) {
    const out = plan({ civs: [democrat()], turn, ledger });
    after.push(out.hardTimes[String(ME)]?.austerityStrain ?? 0);
    ledger = out.ledger;
  }
  assert.deepEqual(after, [4, 2, 0, 0]);
});

test("hard times: the Depression's points and age, the arrears points, and nothing with crises off", () => {
  const deep = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 5000 } };
  let ledger = { ...emptyLedger(), crises };
  let out;
  for (let turn = 50; turn < 53; turn += 1) {
    out = plan({ civs: [democrat()], turn, ledger, macro: deep });
    ledger = out.ledger;
  }
  const ht = out.hardTimes[String(ME)];
  assert.equal(ht.depressionTurns, 3);
  assert.ok(ht.depression > 0, `points ${ht.depression}`);
  assert.equal(ht.austerityStrain, 0);
  assert.equal(ht.arrearsPoints, 0);
  const short = newDeal([0, 0]);
  assert.equal(short[1].hardTimes[String(ME)].arrearsPoints, 2);
  assert.equal(plan({ civs: [democrat()], options: { ...ON, crises: false } }).hardTimes?.[String(ME)], undefined);
});

test("the last turn of grace has its own notice, naming the end", async () => {
  const { describeNotice } = await import("../ui/econ-notice-text.js");
  const outs = newDeal([0, 0, 0]);
  const first = outs[0].notices.find((n) => n.kind === "policy-arrears");
  const last = outs[2].notices.find((n) => n.kind === "policy-arrears");
  const ctx = { nameOf: () => "", me: ME };
  assert.equal(describeNotice(first, ctx)?.key, "LOC_ECONOMICS_NOTICE_POLICY_ARREARS_INFLUENCE");
  assert.equal(describeNotice(last, ctx)?.key, "LOC_ECONOMICS_NOTICE_POLICY_ARREARS_INFLUENCE_LAST");
});

test("a crisis's end ends only the responses taken against it: Austerity in a Depression outlasts a price shock", () => {
  const two = [...crises, { pid: ME, kind: "price-shock", since: 49 }];
  const responses = [{ pid: ME, id: "austerity", crisis: "depression", since: 49, until: null }];
  const out = plan({ civs: [democrat()], ledger: { ...emptyLedger(), crises: two, responses } });
  assert.ok(!out.ledger.crises.some((c) => c.kind === "price-shock"), "the price shock ended");
  assert.ok(out.ledger.crises.some((c) => c.kind === "depression"), "the Depression is still open");
  assert.equal(out.ledger.responses.find((r) => r.id === "austerity")?.until, null);
});

test("Austerity asked for in a debt crisis is bound to it, not to a credit panic that opened the same turn", async () => {
  const { viewContext } = await import("../ui/econ-view-model.js");
  const { takeResponse } = await import("../ui/econ-crisis-respond.js");
  const { responseById } = await import("../ui/econ-crisis-catalog.js");
  const open = [{ pid: ME, kind: "credit-panic", since: 50 }, { pid: ME, kind: "debt", since: 40 }];
  const ctx = viewContext(input({ age: "AGE_MODERN", civs: [democrat()], options: ON,
    ledger: { ...emptyLedger(), crises: open } }));
  ctx.out = { transfers: [], influence: [], celebration: [], events: [], notices: [], grievances: [],
    relationships: [] };
  takeResponse(ctx, ctx.civ.get(ME), responseById("austerity"), "request");
  assert.equal(ctx.ledger.responses.find((r) => r.id === "austerity")?.crisis, "debt");
});

test("a short Programme turn books each of its transfers under its own key (no debt-3)", async () => {
  const { debt3 } = await import("../ui/econ-invariants.js");
  const outs = newDeal([0, 0]);
  for (const out of outs) assert.deepEqual(debt3(out.transfers), []);
  assert.ok(outs[0].transfers.some((t) => t.reason === "arrears"));
  assert.ok(outs[0].transfers.some((t) => t.reason === "administration"));
});

test("Diversionary war at war books administration, borrowed upkeep and production under separate keys", async () => {
  const { debt3 } = await import("../ui/econ-invariants.js");
  const fascist = (over = {}) => democrat({ ideology: "IDEOLOGY_FASCISM", atWar: true, ...over });
  const foe = civ(9, { incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO, atWar: true, strength: 4 });
  const relations = [{ a: ME, b: 9, level: "war" }];
  let out = plan({ civs: [fascist(), foe], relations,
    requests: [{ kind: "policy", pid: ME, policy: "foreign-adventure" }], ledger: { ...emptyLedger(), crises } });
  assert.ok(out.ledger.policies.some((x) => x.card === "foreign-adventure"), JSON.stringify(out.events
    .filter((e) => e.kind === "refused")));
  out = plan({ civs: [fascist(), foe], relations, turn: 51, ledger: { ...out.ledger, crises } });
  const reasons = out.transfers.map((t) => t.reason);
  assert.ok(reasons.includes("administration") && reasons.includes("mobilisation"), reasons.join(","));
  assert.deepEqual(debt3(out.transfers), []);
});
