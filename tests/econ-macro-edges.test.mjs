// The 1.2 batch steps at their edges: "civ lenders only" and emergencies, the citizens' block and room, the plan's
// row merged with a development loan's, erosion outside Public debt, cycle Gold for a civ outside the cycle, the
// world stage, the sizing of the AI's citizen loan, and what each 1.2 event and notice carries.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { viewContext } from "../ui/econ-view-model.js";
import { citizensFor, offerQuery } from "../ui/econ-turn.js";
import { emergencyOffersFor, offersFor } from "../ui/econ-lenders.js";
import { cycleGoldFor, isInDepression, planTakeFor, worldStage } from "../ui/econ-macro.js";
import { servicePrincipalCents } from "../ui/econ-citizens.js";
import { OPEN_ALL, OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const ON = { cycle: "standard", systems: true };
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 300000, stages: OPEN_ALL, ...over });
const macroWith = (cycle = {}, over = {}) => ({ ...emptyMacro(), ...over, cycle: { ...emptyMacro().cycle, ...cycle } });
const ctxOf = (over = {}) => viewContext(input({ ...over, options: { ...ON, ...(over.options || {}) } }));

function plan(over) {
  const out = planTurn(input({ markets: emptyMarkets(), ...over, options: { ...ON, ...(over.options || {}) } }));
  assert.deepEqual(checkPlan({ plan: out, civs: over.civs }), [], "commit checks");
  return out;
}

test("civ lenders only: no bond offer, and after Public debt the emergency lender is temple treasuries", () => {
  const tribute = { [ME]: { system: "tribute", from: "tribute", since: 0 } };
  const ctx = ctxOf({ civs: [me()], macro: macroWith({}, { systems: tribute }) });
  assert.equal(offersFor(offerQuery(ctx, ME, { principal: 1000 })).length, 0);
  assert.deepEqual(emergencyOffersFor(offerQuery(ctx, ME, { principal: 1000 })).map((o) => [o.lender, o.ratePpm]),
    [["temple", 20000]]);
  const mixed = ctxOf({ civs: [me()] });
  assert.deepEqual(emergencyOffersFor(offerQuery(mixed, ME, { principal: 1000 })).map((o) => o.lender), ["bond"]);
  const panic = ctxOf({ civs: [me()], macro: macroWith({ panicUntil: 55 }) });
  assert.deepEqual(emergencyOffersFor(offerQuery(panic, ME, { principal: 1000,
    lenders: [{ id: AI, balanceCents: 1e7, stages: OPEN_ALL }] })).map((o) => o.lender), ["bond"],
  "in a Panic civ lenders stop offering, emergency loans too");
});

test("the citizens: none with Loans off or another system; their room shrinks by what's owed; a block closes them", () => {
  const cr = { [ME]: { system: "civicMarket", from: "civicMarket", since: 0 } };
  const civs = [me({ commerceSettlements: 2 })];
  const owed = { ...emptyLedger(), loans: [makeLoan({ id: "L1", lender: "citizens", borrower: ME, principal: 30000,
    ratePpm: 15000, term: 10, turn: 40 })], nextId: 2 };
  const ctx = ctxOf({ civs, ledger: owed, macro: macroWith({}, { systems: cr }) });
  assert.deepEqual(citizensFor(ctx, ME), { ratePpm: 7500, roomCents: 70000 });
  assert.equal(citizensFor(ctxOf({ civs, macro: macroWith({}, { systems: cr }), options: { loans: false } }), ME), null);
  assert.equal(citizensFor(ctxOf({ civs }), ME), null);
  assert.equal(citizensFor(ctx, 77), null);
  const blocked = { ...emptyLedger(), blocks: [{ lender: "citizens", borrower: ME, reason: "repudiation", agesLeft: null,
    untilTurn: 80 }] };
  const bctx = ctxOf({ civs, ledger: blocked, macro: macroWith({}, { systems: cr }) });
  assert.equal(offersFor(offerQuery(bctx, ME, { principal: 1000 })).some((o) => o.lender === "citizens"), false);
  assert.equal(offersFor(offerQuery(ctx, ME, { principal: 1000, term: 20 })).some((o) => o.lender === "citizens"),
    false, "10-turn terms only");
});

test("the plan's progress joins a development loan's row for the same city, one addProgress a city", () => {
  const cities = [{ id: "6:1", build: "B", neededProgress: 400, population: 4 }];
  const relations = [{ a: ME, b: AI, level: "neutral" }];
  const out = plan({ civs: [me(), ai(AI, { ideology: "IDEOLOGY_COMMUNISM", cities })], relations,
    requests: [{ kind: "invest", investor: ME, host: AI, form: "project", cents: 3000, cityId: "6:1" }] });
  assert.equal(out.progress.length, 1);
  assert.equal(out.progress[0].amount, 10 + 5, "10 points of loan and 5 of the plan's 2000 at the purchase rate");
  assert.ok(out.transfers.some((t) => t.reason === "plan" && t.cents === 2000));
  assert.ok(out.notices.length === 0 || out.notices.every((n) => n.kind !== "plan"), "the plan's notice is the AI's");
  const mine = plan({ civs: [me({ ideology: "IDEOLOGY_COMMUNISM", cities: [{ id: "3:1", build: "B", neededProgress: 2 }] })] });
  assert.deepEqual(mine.notices.filter((n) => n.kind === "plan").map((n) => [n.cents, n.cities]), [[800, 1]],
    "capped by what the build needs");
  const empty = plan({ civs: [me({ ideology: "IDEOLOGY_COMMUNISM", cities: [] })] });
  assert.equal(empty.transfers.some((t) => t.reason === "plan"), false);
});

test("erosion only for Public debt members, never for a Planned civ, and only from what the funds hold", () => {
  const ledger = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 500000, ratePpm: 40000, term: 30, turn: 49 })] };
  const early = { ...OPEN_ALL, publicDebt: null };
  const out = plan({ civs: [me({ stages: early, balanceCents: 900000 }), ai(AI, { balanceCents: 900000 })], ledger,
    options: { inflation: true } });
  assert.deepEqual(out.transfers.filter((t) => t.reason === "erosion").map((t) => t.from), [AI]);
  const planned = plan({ civs: [ai(AI, { balanceCents: 900000, ideology: "IDEOLOGY_COMMUNISM" })], ledger,
    options: { inflation: true } });
  assert.equal(planned.transfers.some((t) => t.reason === "erosion"), false);
  assert.equal(planned.macro.inflation.top, AI);
});

test("cycle Gold: nothing outside the cycle or with it off; the world stage and Depression as the AI rules read them", () => {
  const civs = [me({ stages: OPEN_MACRO }), ai(AI)];
  const planned = { [ME]: { system: "planned", from: "planned", since: 0 } };
  const boom = ctxOf({ civs, macro: macroWith({ e: 12000 }, { systems: planned }) });
  assert.equal(cycleGoldFor(boom, civs[0]), 0);
  assert.equal(cycleGoldFor(boom, civs[1]), 400);
  assert.equal(cycleGoldFor(ctxOf({ civs, macro: macroWith({ e: 12000 }), options: { cycle: "off" } }), civs[1]), 0);
  assert.equal(cycleGoldFor(boom, civ(77)), 0, "a civ the readings don't hold");
  assert.deepEqual(worldStage(boom), { publicDebt: true, banking: true, capitalism: true });
  assert.deepEqual(worldStage(ctxOf({ civs: [ai(AI)] })), { publicDebt: true, banking: false, capitalism: false });
  const slump = ctxOf({ civs, macro: macroWith({ e: 7900 }) });
  assert.equal(isInDepression(slump, AI), true);
  assert.equal(isInDepression(ctxOf({ civs, macro: macroWith({ e: 8000 }) }), AI), false);
  assert.equal(planTakeFor(boom, ME), 2000);
  assert.equal(planTakeFor(boom, AI), 0);
});

test("the AI's citizen loan fits the debt-service limit; a principal under a Gold of room is none", () => {
  assert.equal(servicePrincipalCents({ roomCents: 3500, ratePpm: 15000, term: 10 }), 30334);
  assert.equal(servicePrincipalCents({ roomCents: 0, ratePpm: 15000, term: 10 }), 0);
  assert.equal(servicePrincipalCents({ roomCents: 3500, ratePpm: 15000, term: 0 }), 0);
  assert.equal(servicePrincipalCents({ roomCents: 50, ratePpm: 15000, term: 10 }), 334);
  assert.equal(servicePrincipalCents({ roomCents: 10, ratePpm: 0, term: 10 }), 0);
  const owing = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 40000, ratePpm: 40000, term: 10, turn: 40 })] };
  const out = plan({ civs: [ai(AI, { government: "GOVERNMENT_CLASSICAL_REPUBLIC", balanceCents: 5000,
    commerceSettlements: 1 })], ledger: owing });
  assert.equal(out.ledger.loans.some((l) => l.lender === "citizens"), false, "payments already near the limit");
  const off = plan({ civs: [ai(AI, { government: "GOVERNMENT_CLASSICAL_REPUBLIC", balanceCents: 5000,
    commerceSettlements: 1 })], options: { loans: false } });
  assert.deepEqual(off.ledger.loans, []);
});

test("what the 1.2 events and notices carry", () => {
  const civs = [me({ government: "GOVERNMENT_DESPOTISM" })];
  const first = plan({ civs, macro: macroWith({ e: 12000 }) });
  const changed = plan({ civs: [me({ government: "GOVERNMENT_OLIGARCHY", stages: OPEN_MACRO, balanceCents: 0 })],
    turn: 51, ledger: { ...first.ledger, nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: ME,
      principal: 500000, ratePpm: 40000, term: 30, turn: 40 })] }, macro: first.macro });
  assert.deepEqual(changed.events.filter((e) => e.kind === "system")
    .map((e) => [e.turn, e.pid, e.from, e.to]), [[51, ME, "tribute", "merchantOligarchy"]]);
  assert.deepEqual(changed.notices.filter((n) => n.kind === "system").map((n) => [n.pid, n.from, n.to]),
    [[ME, "tribute", "merchantOligarchy"]]);
  const panic = changed.events.find((e) => e.kind === "panic");
  assert.deepEqual([panic.turn, panic.until, panic.chronicle], [51, 56, 1]);
  assert.deepEqual(changed.notices.find((n) => n.kind === "panic"), { pid: ME, kind: "panic", until: 56 });
  assert.equal(changed.macro.cycle.l[ME], -300,
    "the reform shock; Merchant oligarchy's Panic hit blends in with its other numbers from the next turn");
  assert.equal(changed.macro.lastTurn, 51);
});
