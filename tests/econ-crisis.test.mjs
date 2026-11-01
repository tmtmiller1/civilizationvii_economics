// Crises and responses (DESIGN 4.11b, 4.11c): the six conditions read from the state on any turn, each response's
// immediate change and legacy, the standing parts and their ends, the weights on the cycle, the events read from the
// state, the AI's choice by its system, the bank holiday, the rows across a save, the option off, the screen's view.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { viewContext } from "../ui/econ-view-model.js";
import { crisisView, crisisWeights } from "../ui/econ-crisis.js";
import { adjustPrices, responseRefusal } from "../ui/econ-crisis-respond.js";
import { crisisTerms, onHoliday } from "../ui/econ-crisis-rows.js";
import { responseById } from "../ui/econ-crisis-catalog.js";
import { BASE_RATE_PPM, INFLATION_RULES } from "../ui/econ-params.js";
import { OPEN, OPEN_ALL, OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const OTHER = 9;
const ON = { crises: true, cycle: "standard", systems: false, inflation: false, swings: "gentle" };
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_MACRO, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 100000, stages: OPEN_MACRO, ...over });
const macroWith = (cycle = {}, over = {}) => ({ ...emptyMacro(), ...over, cycle: { ...emptyMacro().cycle, ...cycle } });
/** The world in Depression at 0.75; every civ in the cycle reads it. */
const DEPRESSION = () => macroWith({ e: 7500 });
const plan = (over = {}) => planTurn(input({ ...over, options: { ...ON, ...(over.options || {}) } }));
const respond = (response, extra = {}) => ({ kind: "respond", pid: ME, response, ...extra });
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 10000, ratePpm: 10000,
  term: 10, turn: 1 }), ...over });
const ledgerWith = (loans, over = {}) => ({ ...emptyLedger(), loans, nextId: loans.length + 1, ...over });
const kinds = (out, kind) => out.events.filter((e) => e.kind === kind);
const transfer = (out, reason) => out.transfers.find((t) => t.reason === reason);
/** A view context with the plan's crisis hooks, for the pure reads. */
const ctxFor = (over = {}) => {
  const ctx = viewContext(input({ ...over, options: { ...ON, ...(over.options || {}) } }));
  ctx.crisis = { terms: (pid) => crisisTerms(ctx, pid), weights: (events) => crisisWeights(ctx, events),
    adjustPrices: (prices) => adjustPrices(ctx, prices), holiday: (pid) => onHoliday(ctx, pid) };
  return ctx;
};
const city = (id, over = {}) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3, ...over });

// --- (1) the conditions ------------------------------------------------------------------------------------------

test("a Depression starts a crisis with its event and notice, and ends it when the phase lifts", () => {
  const first = plan({ civs: [me()], macro: DEPRESSION() });
  assert.deepEqual(first.ledger.crises, [{ pid: ME, kind: "depression", since: 50 }]);
  const start = kinds(first, "crisis-start")[0];
  assert.deepEqual([start.pid, start.crisis, start.chronicle], [ME, "depression", 1]);
  assert.equal(first.notices.some((n) => n.kind === "crisis-start" && n.pid === ME && n.crisis === "depression"), true);
  const lifted = plan({ civs: [me()], turn: 53, ledger: first.ledger, macro: macroWith({ e: 10000 }) });
  assert.deepEqual(lifted.ledger.crises, []);
  const end = kinds(lifted, "crisis-end")[0];
  assert.deepEqual([end.pid, end.crisis, end.turns], [ME, "depression", 3]);
  assert.deepEqual(lifted.ledger.crisisTurns.filter((r) => r.id === "end:depression"), [{ pid: ME, id: "end:depression", turn: 53 }]);
});

test("one crisis of a kind in 30 turns: a Depression back within the spacing starts nothing, after it does", () => {
  const ended = ledgerWith([], { crisisTurns: [{ pid: ME, id: "end:depression", turn: 40 }] });
  const soon = plan({ civs: [me()], turn: 60, ledger: ended, macro: DEPRESSION() });
  assert.deepEqual(soon.ledger.crises, [], "20 turns on: not yet");
  const later = plan({ civs: [me()], turn: 70, ledger: ended, macro: DEPRESSION() });
  assert.deepEqual(later.ledger.crises.map((r) => r.kind), ["depression"], "30 turns on");
});

test("two crises at once at most: a civ in Depression with its dues over income three turns and a trade collapse holds two", () => {
  const counters = [{ pid: ME, dues: 2, hot: 0, routes: [5, 5, 5, 5, 5] }];
  const owed = loan("L1", { principal: 300000, outstanding: 300000, term: 3 });
  const out = plan({ civs: [me({ balanceCents: 0 })], ledger: ledgerWith([owed], { crisisCounters: counters }),
    macro: DEPRESSION(), routes: [] });
  assert.deepEqual(out.ledger.crises.map((r) => r.kind), ["depression", "debt"]);
  assert.equal(out.ledger.crisisCounters[0].dues, 3);
});

test("the age gates: a credit panic needs Banking or Modern, runaway inflation needs Public debt", () => {
  const panic = macroWith({ panicUntil: 60 });
  const early = plan({ civs: [me({ stages: OPEN_ALL })], ledger: ledgerWith([loan("L1")]), macro: panic });
  assert.deepEqual(early.ledger.crises, [], "a Panic without Banking in Exploration");
  const banking = plan({ civs: [me()], ledger: ledgerWith([loan("L1")]), macro: panic });
  assert.deepEqual(banking.ledger.crises.map((r) => r.kind), ["credit-panic"]);
  const modern = plan({ age: "AGE_MODERN", civs: [me({ stages: OPEN_ALL })], ledger: ledgerWith([loan("L1")]), macro: panic });
  assert.deepEqual(modern.ledger.crises.map((r) => r.kind), ["credit-panic"]);
  const noLoan = plan({ civs: [me()], macro: panic });
  assert.deepEqual(noLoan.ledger.crises, [], "a Panic with nothing owed");
  // Inflation at its cap five turns: a bond loan against empty treasuries puts the rate at the cap.
  const hot = [{ pid: ME, dues: 0, hot: 4, routes: [] }];
  const debt = ledgerWith([loan("L1", { principal: 100000, outstanding: 100000 })], { crisisCounters: hot });
  const capped = plan({ civs: [me({ balanceCents: 0 })], ledger: debt, options: { inflation: true } });
  assert.equal(capped.macro.inflation.piPpm, INFLATION_RULES.capPpm);
  assert.deepEqual(capped.ledger.crises.map((r) => r.kind), ["inflation"]);
  const noDebtStage = plan({ civs: [me({ balanceCents: 0, stages: { ...OPEN_MACRO, publicDebt: null } })], ledger: debt,
    options: { inflation: true } });
  assert.deepEqual(noDebtStage.ledger.crises, []);
});

test("a dead civ's crisis rows go", () => {
  const ledger = ledgerWith([], { crises: [{ pid: ME, kind: "depression", since: 40 }],
    responses: [{ pid: ME, id: "relief", crisis: "depression", since: 41, until: null }],
    legacies: [{ pid: ME, id: "debase", since: 41, until: null, nextAge: false }],
    crisisCounters: [{ pid: ME, dues: 1, hot: 0, routes: [] }] });
  const out = plan({ civs: [me({ alive: false }), ai(AI)], ledger, macro: DEPRESSION(), options: { ai: false } });
  assert.deepEqual(out.ledger.crises.filter((r) => r.pid === ME), []);
  assert.deepEqual(out.ledger.responses, []);
  assert.deepEqual(out.ledger.legacies, []);
  assert.deepEqual(out.ledger.crisisCounters.filter((r) => r.pid === ME), []);
});

// --- (2) the counters --------------------------------------------------------------------------------------------

test("the debt crisis: dues over income three turns running, or a default to a civilization", () => {
  const owed = loan("L1", { principal: 300000, outstanding: 300000, term: 3 });
  let ledger = ledgerWith([owed]);
  for (let turn = 50; turn < 52; turn += 1) {
    const out = plan({ civs: [me({ balanceCents: 0 })], turn, ledger });
    assert.deepEqual(out.ledger.crises, [], `turn ${turn}: ${out.ledger.crisisCounters[0].dues} turn(s) over`);
    ledger = out.ledger;
  }
  const third = plan({ civs: [me({ balanceCents: 0 })], turn: 52, ledger });
  assert.deepEqual(third.ledger.crises.map((r) => r.kind), ["debt"]);
  const defaulted = ledgerWith([loan("L2", { lender: AI, state: "default", missed: 3 })]);
  const out = plan({ civs: [me(), ai(AI)], ledger: defaulted });
  assert.deepEqual(out.ledger.crises.map((r) => r.kind), ["debt"], "a default to a civ, at once");
});

test("a trade collapse: a third of the routes gone within five turns, with Markets on", () => {
  const counters = [{ pid: ME, dues: 0, hot: 0, routes: [6, 6, 6, 6, 6] }];
  const routes = [{ importer: ME, exporter: AI, resources: ["RESOURCE_SILK"] }, { importer: AI, exporter: ME, resources: ["RESOURCE_SALT"] },
    { importer: ME, exporter: OTHER, resources: ["RESOURCE_SILK"] }];
  const out = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith([], { crisisCounters: counters }), routes,
    options: { markets: true } });
  assert.deepEqual(out.ledger.crises.map((r) => r.kind), ["trade-collapse"], "6 to 3 is half");
  assert.deepEqual(out.ledger.crisisCounters[0].routes, [6, 6, 6, 6, 6, 3]);
  const mild = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith([], { crisisCounters: counters }),
    routes: [...routes, { importer: OTHER, exporter: ME, resources: ["RESOURCE_SALT"] }, { importer: ME, exporter: AI, resources: ["RESOURCE_IRON"] }],
    options: { markets: true } });
  assert.deepEqual(mild.ledger.crises, [], "6 to 5 isn't a third");
});

test("a price shock: a class's index up or down 40% on ten turns ago, for a civ that trades it", () => {
  const market = { resources: [{ type: "RESOURCE_SILK", class: "RESOURCECLASS_BONUS" }, { type: "RESOURCE_IRON", class: "RESOURCECLASS_STRATEGIC" }],
    copies: { RESOURCE_SILK: 1, RESOURCE_IRON: 1 } };
  const markets = { ...emptyMarkets(), prices: { RESOURCE_SILK: 1000, RESOURCE_IRON: 1000 },
    history: { RESOURCE_SILK: [...Array(11).fill(1500), 1000], RESOURCE_IRON: Array(12).fill(1000) } };
  // Silk stood at 15 Gold ten turns ago; its target is far under that with one copy for three civs, so this turn's
  // price (0.8 smoothing from 10 Gold) is more than 40% under it.
  const routes = [{ importer: ME, exporter: AI, resources: ["RESOURCE_SILK"] }];
  const out = plan({ civs: [me(), ai(AI), ai(OTHER)], markets, market, routes, options: { markets: true } });
  const now = out.markets.prices.RESOURCE_SILK;
  assert.ok(now < 900, `silk fell to ${now}, past 40% under the 15 Gold of ten turns ago`);
  assert.deepEqual(out.ledger.crises.map((r) => [r.pid, r.kind]), [[ME, "price-shock"], [AI, "price-shock"]], "the importer and the exporter, not the bystander");
  const bystander = plan({ civs: [me(), ai(AI), ai(OTHER)], markets, market, routes: [], options: { markets: true } });
  assert.deepEqual(bystander.ledger.crises, [], "a civ that doesn't trade the class");
});

// --- (3) the responses -------------------------------------------------------------------------------------------

const antiquity = (over = {}) => plan({ age: "AGE_ANTIQUITY", macro: DEPRESSION(), ...over });

test("cancel the debts: the citizens' and temple loans written off, the citizens closed for the age, reputation -20", () => {
  const loans = [loan("L1", { lender: "citizens", outstanding: 4000 }), loan("L2", { lender: "temple", outstanding: 6000 }),
    loan("L3", { lender: "bond", outstanding: 5000 })];
  const out = antiquity({ civs: [me()], ledger: ledgerWith(loans), requests: [respond("cancel-debts")] });
  assert.deepEqual(out.ledger.loans.map((l) => [l.id, l.state, l.outstanding, l.writtenOff]),
    [["L1", "closed", 0, 4000], ["L2", "closed", 0, 6000], ["L3", "active", 4000, 0]], "the bond loan paid its slice as usual");
  assert.deepEqual(out.ledger.blocks, [{ lender: "citizens", borrower: ME, reason: "repudiation", agesLeft: 0, untilTurn: null }]);
  assert.equal(kinds(out, "credit-rep").find((e) => e.why === "response").points, -20);
  assert.equal(kinds(out, "debts-cancelled")[0].cents, 10000);
  const response = kinds(out, "response")[0];
  assert.deepEqual([response.pid, response.response, response.crisis, response.source], [ME, "cancel-debts", "depression", "request"]);
  assert.deepEqual(out.ledger.legacies, [{ pid: ME, id: "cancel-debts", since: 50, until: 70, nextAge: false }]);
});

test("cancel the debts: +4 Happiness a settlement for five turns after", () => {
  const out = antiquity({ civs: [me()], ledger: ledgerWith([loan("L1", { lender: "citizens" })]), requests: [respond("cancel-debts")] });
  assert.deepEqual(out.ledger.responses, [{ pid: ME, id: "cancel-debts", crisis: "depression", since: 50, until: 55 }]);
  const next = antiquity({ civs: [me({ cities: [city("3:1"), city("3:2")] })], turn: 51, ledger: out.ledger });
  assert.deepEqual(next.celebration.find((r) => r.reason === "cancel-debts"), { pid: ME, amount: 800, reason: "cancel-debts" });
});

test("debase the coin: three turns of income from the temple treasuries, prices up, dearer loans for the age", () => {
  const out = antiquity({ civs: [me()], requests: [respond("debase")] });
  assert.deepEqual([transfer(out, "debase").from, transfer(out, "debase").to, transfer(out, "debase").cents], ["temple", ME, 30000]);
  assert.deepEqual(out.ledger.responses.map((r) => [r.id, r.until]), [["debase", 55]]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.id, r.until]), [["debase", null]]);
  const ctx = ctxFor({ age: "AGE_ANTIQUITY", civs: [me()], ledger: out.ledger });
  assert.equal(crisisTerms(ctx, ME).ownRatePct, 125);
  assert.equal(crisisTerms(ctx, ME).pricePct, 2);
});

test("the temple lends: a 20-turn loan of three turns of income at the base rate, outside the cap; the temple dearer for everyone", () => {
  const out = antiquity({ civs: [me({ incomeCents: 4000 })], requests: [respond("temple-lends")] });
  const opened = out.ledger.loans.find((l) => l.source === "crisis");
  assert.deepEqual([opened.lender, opened.borrower, opened.principal, opened.term, opened.ratePpm],
    ["temple", ME, 12000, 20, BASE_RATE_PPM.AGE_ANTIQUITY]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.pid, r.id, r.until]), [[null, "temple-lends", null]]);
  assert.equal(crisisTerms(ctxFor({ civs: [me(), ai(AI)], ledger: out.ledger }), ME).templePct, 125);
});

test("the temple lends: the dearer temple is everyone's for the age", () => {
  const out = antiquity({ civs: [me({ incomeCents: 4000 }), ai(AI)], requests: [respond("temple-lends")], options: { ai: false } });
  assert.deepEqual(out.ledger.legacies.map((r) => r.pid), [null]);
  assert.equal(crisisTerms(ctxFor({ civs: [me(), ai(AI)], ledger: out.ledger }), AI).templePct, 125);
});

test("tribute: two turns of income from each weaker civ Unfriendly or worse with the levier, with 10 grievances each", () => {
  const civs = [me({ strength: 100, government: "GOVERNMENT_DESPOTISM" }), ai(AI, { strength: 50, incomeCents: 5000 }),
    ai(OTHER, { strength: 200, incomeCents: 5000 })];
  const relations = [{ a: ME, b: AI, level: "unfriendly" }, { a: ME, b: OTHER, level: "unfriendly" }];
  const out = antiquity({ civs, relations, requests: [respond("tribute")], options: { systems: true } });
  assert.deepEqual(out.events.filter((e) => e.kind === "refused"), []);
  const paid = transfer(out, "tribute");
  assert.deepEqual([paid.from, paid.to, paid.cents], [AI, ME, 10000], "the weaker one pays, the stronger doesn't");
  assert.deepEqual(out.grievances, [{ from: AI, against: ME, amount: 10 }]);
});

test("suspend payments: a three-turn holiday, the civ lenders closed for the age and resentful, the bond dearer 20 turns", () => {
  const loans = [loan("L1", { lender: AI }), loan("L2", { lender: OTHER })];
  const out = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith(loans), macro: DEPRESSION(), requests: [respond("suspend")],
    options: { ai: false } });
  assert.deepEqual(out.ledger.blocks.map((b) => [b.lender, b.borrower, b.agesLeft]), [[AI, ME, 0], [OTHER, ME, 0]]);
  assert.deepEqual(out.relationships, [{ a: AI, b: ME, delta: -3 }, { a: OTHER, b: ME, delta: -3 }]);
  assert.deepEqual(out.grievances, [{ from: AI, against: ME, amount: 10 }, { from: OTHER, against: ME, amount: 10 }]);
  assert.deepEqual(out.ledger.responses.map((r) => [r.id, r.until]), [["suspend", 53]]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.id, r.until]), [["suspend", 70]]);
  const ctx = ctxFor({ civs: [me()], ledger: out.ledger });
  assert.deepEqual([crisisTerms(ctx, ME).holiday, crisisTerms(ctx, ME).bondPct], [true, 150]);
});

test("recoinage: two turns of income to the inflation account, the civ's inflation legacies cleared, erosion capped for the age", () => {
  const hot = [{ pid: ME, dues: 0, hot: 4, routes: [] }];
  const legacies = [{ pid: ME, id: "bullion", since: 40, until: 60, nextAge: false }, { pid: ME, id: "gold-standard", since: 40, until: null, nextAge: false },
    { pid: AI, id: "bullion", since: 40, until: 60, nextAge: false }];
  const debt = ledgerWith([loan("L1", { principal: 100000, outstanding: 100000 })], { crisisCounters: hot, legacies });
  const out = plan({ civs: [me({ balanceCents: 40000, incomeCents: 10000 }), ai(AI)], ledger: debt,
    options: { inflation: true }, requests: [respond("recoinage")] });
  assert.deepEqual(out.ledger.crises.map((r) => r.kind), ["inflation"]);
  assert.deepEqual([transfer(out, "response").to, transfer(out, "response").cents], ["inflation", 20000]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.pid, r.id]), [[AI, "bullion"], [ME, "recoinage"]], "the other civ's bullion stays");
  assert.equal(crisisTerms(ctxFor({ civs: [me()], ledger: out.ledger }), ME).erosionCapPct, 50);
});

test("navigation acts: the High tariff as law for ten turns, the trade war counting the civ double for the age", () => {
  const counters = [{ pid: ME, dues: 0, hot: 0, routes: [6, 6, 6, 6, 6] }];
  const out = plan({ civs: [me(), ai(AI)], ledger: ledgerWith([], { crisisCounters: counters }), options: { markets: true, tariffs: true },
    routes: [{ importer: ME, exporter: AI, resources: ["RESOURCE_SILK"] }], requests: [respond("navigation-acts")] });
  assert.deepEqual(out.ledger.crises.map((r) => r.kind), ["trade-collapse"]);
  assert.deepEqual(out.markets.tariffs, [{ pid: ME, level: "high", changedTurn: 50 }]);
  const ctx = ctxFor({ civs: [me()], ledger: out.ledger });
  assert.deepEqual([crisisTerms(ctx, ME).navigationActs, crisisTerms(ctx, ME).tradeWarDouble], [true, true]);
  assert.deepEqual(out.ledger.responses.map((r) => r.until), [60]);
});

test("bullion fleets: three turns of income from the world's economy, prices up five turns, inflation of its own ten, pirates twenty", () => {
  const out = plan({ civs: [me()], macro: DEPRESSION(), requests: [respond("bullion")] });
  assert.deepEqual([transfer(out, "bullion").from, transfer(out, "bullion").cents], ["cycle", 30000]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.id, r.until]), [["bullion", 60], ["bullion-pirates", 70]]);
  const ctx = ctxFor({ civs: [me()], ledger: out.ledger });
  const terms = crisisTerms(ctx, ME);
  assert.deepEqual([terms.pricePct, terms.piExtraPpm, terms.collapseHalf], [3, 2500, true]);
});

test("deposit insurance: two turns of income to the fund; the spread floored, the Panic halved, the depth cut by a quarter; carried an age by a Market economy", () => {
  const out = plan({ age: "AGE_MODERN", civs: [me()], macro: DEPRESSION(), requests: [respond("deposit-insurance")] });
  assert.deepEqual([transfer(out, "response").to, transfer(out, "response").cents], ["bond", 20000]);
  assert.deepEqual(out.ledger.legacies.map((r) => [r.id, r.until, r.nextAge]), [["deposit-insurance", null, false]],
    "a Mixed civ (systems off) keeps it for the age only");
  const terms = crisisTerms(ctxFor({ age: "AGE_MODERN", civs: [me()], ledger: out.ledger }), ME);
  assert.deepEqual([terms.spreadFloor, terms.noFreeze, terms.panicPct, terms.capDepthPct], [true, true, 50, 75]);
  const poor = plan({ age: "AGE_MODERN", civs: [me({ balanceCents: 1000 })], macro: DEPRESSION(), requests: [respond("deposit-insurance")] });
  assert.equal(poor.events.find((e) => e.kind === "refused")?.reason, "funds");
});

test("off the gold standard: bond and temple debts cut a tenth, the civ lenders resentful, reputation -10, prices and inflation up", () => {
  const loans = [loan("L1", { lender: "bond", outstanding: 10000 }), loan("L2", { lender: "temple", outstanding: 5000 }),
    loan("L3", { lender: AI, outstanding: 8000 })];
  const out = plan({ age: "AGE_MODERN", civs: [me(), ai(AI)], ledger: ledgerWith(loans), macro: DEPRESSION(),
    requests: [respond("gold-standard")] });
  assert.deepEqual(out.ledger.loans.map((l) => [l.id, l.writtenOff]), [["L1", 1000], ["L2", 500], ["L3", 0]]);
  assert.equal(kinds(out, "debts-cut")[0].cents, 1500);
  assert.deepEqual(out.relationships, [{ a: AI, b: ME, delta: -3 }]);
  assert.deepEqual(out.grievances, [{ from: AI, against: ME, amount: 10 }]);
  assert.equal(kinds(out, "credit-rep").find((e) => e.why === "response").points, -10);
  const terms = crisisTerms(ctxFor({ age: "AGE_MODERN", civs: [me()], ledger: out.ledger }), ME);
  assert.deepEqual([terms.pricePct, terms.piExtraPpm], [3, 7500], "5000 while it runs plus 2500 for the age");
});

test("austerity: +3 reputation, the surplus above the reserve repays the dearest loan early, the civ's own index sinks", () => {
  const out = plan({ civs: [me()], ledger: ledgerWith([loan("L1", { ratePpm: 20000 }), loan("L2", { ratePpm: 10000 })]),
    macro: DEPRESSION(), requests: [respond("austerity")] });
  assert.equal(kinds(out, "credit-rep").find((e) => e.why === "response").points, 3);
  const next = plan({ civs: [me()], turn: 51, ledger: out.ledger, macro: DEPRESSION() });
  const early = kinds(next, "repay-early")[0];
  assert.deepEqual([early.pid, early.loanId], [ME, "L1"], "the dearest, with half the surplus");
  assert.equal(crisisTerms(ctxFor({ civs: [me()], ledger: out.ledger }), ME).austerity, true);
});

test("confidence: 20 Influence spent, once per five turns", () => {
  const out = plan({ civs: [me()], macro: DEPRESSION(), requests: [respond("confidence")] });
  assert.deepEqual(out.influence.filter((r) => r.reason === "confidence"), [{ pid: ME, amount: -20, reason: "confidence" }]);
  const again = plan({ civs: [me()], turn: 53, ledger: out.ledger, macro: DEPRESSION(), requests: [respond("confidence")] });
  assert.equal(again.events.find((e) => e.kind === "refused")?.reason, "once");
  const later = plan({ civs: [me()], turn: 55, ledger: out.ledger, macro: DEPRESSION(), requests: [respond("confidence")] });
  assert.equal(later.influence.some((r) => r.reason === "confidence"), true);
});

test("public works: the age's Gold a settlement into the civ's builds through the progress account, each turn it runs", () => {
  const cities = [city("3:1"), city("3:2", { population: 1 })];
  const out = antiquity({ civs: [me({ cities })], requests: [respond("public-works")] });
  const spent = transfer(out, "works");
  assert.deepEqual([spent.from, spent.to, spent.cents], [ME, "progress", 400], "2 Gold a settlement in Antiquity");
  assert.equal(out.progress.filter((r) => r.investmentId === `PW${ME}`).reduce((s, r) => s + r.amount, 0), 1, "1 point at 4 Gold");
  assert.deepEqual(out.ledger.responses.map((r) => [r.id, r.until]), [["public-works", null]], "until the crisis ends");
  const modern = plan({ age: "AGE_MODERN", civs: [me({ cities })], macro: DEPRESSION(), requests: [respond("public-works")] });
  assert.equal(transfer(modern, "works").cents, 1600, "8 Gold a settlement in Modern");
});

test("relief: a Gold a settlement a turn to the citizens for 4 Happiness a settlement", () => {
  const cities = [city("3:1"), city("3:2"), city("3:3")];
  const out = plan({ civs: [me({ cities })], macro: DEPRESSION(), requests: [respond("relief")] });
  assert.deepEqual([transfer(out, "relief").to, transfer(out, "relief").cents], ["citizens", 300]);
  assert.deepEqual(out.celebration.filter((r) => r.reason === "relief"), [{ pid: ME, amount: 1200, reason: "relief" }]);
  assert.deepEqual(out.ledger.responses.map((r) => [r.id, r.until]), [["relief", null]]);
});

test("price supports: a floor under the farm resources at 90% of ten turns ago while they run", () => {
  const market = { resources: [{ type: "RESOURCE_WHEAT", class: "RESOURCECLASS_BONUS" }, { type: "RESOURCE_SILK", class: "RESOURCECLASS_EMPIRE" }],
    copies: { RESOURCE_WHEAT: 1, RESOURCE_SILK: 1 } };
  const markets = { ...emptyMarkets(), prices: { RESOURCE_WHEAT: 1000, RESOURCE_SILK: 1000 },
    history: { RESOURCE_WHEAT: Array(12).fill(1000), RESOURCE_SILK: Array(12).fill(1000) } };
  const taken = plan({ age: "AGE_MODERN", civs: [me(), ai(AI), ai(OTHER)], markets, market, macro: DEPRESSION(),
    options: { markets: true, ai: false }, requests: [respond("price-supports")] });
  assert.ok(taken.markets.prices.RESOURCE_WHEAT < 900, "the turn it's taken the prices were already set");
  // The floor holds from the next turn's market step, at 90% of the price ten turns back.
  const out = plan({ age: "AGE_MODERN", civs: [me(), ai(AI), ai(OTHER)], turn: 51, ledger: taken.ledger, markets: taken.markets, market,
    macro: DEPRESSION(), options: { markets: true, ai: false } });
  assert.equal(out.markets.prices.RESOURCE_WHEAT, 900, "held at 90% of 10 Gold");
  assert.ok(out.markets.prices.RESOURCE_SILK < 700, `silk fell free to ${out.markets.prices.RESOURCE_SILK}`);
  assert.equal(transfer(out, "price-supports").cents, 5000, "half a turn of income to the market");
});

// --- (4) standing responses end ------------------------------------------------------------------------------------

test("a response runs its turns, or its crisis plus a few, then ends with an event; ending relief early leaves a mark", () => {
  const holiday = plan({ civs: [me()], ledger: ledgerWith([loan("L1")]), macro: DEPRESSION(), requests: [respond("bank-holiday")] });
  assert.deepEqual(holiday.ledger.responses.map((r) => [r.id, r.until]), [["bank-holiday", 53]]);
  const over = plan({ civs: [me()], turn: 53, ledger: holiday.ledger, macro: DEPRESSION() });
  assert.deepEqual(over.ledger.responses, []);
  assert.deepEqual(kinds(over, "response-ended").map((e) => [e.response, e.early]), [["bank-holiday", 0]]);
  // Relief runs until the crisis ends, plus two turns.
  const relief = plan({ civs: [me()], macro: DEPRESSION(), requests: [respond("relief")] });
  const lifted = plan({ civs: [me()], turn: 55, ledger: relief.ledger, macro: macroWith({ e: 10000 }) });
  assert.deepEqual(lifted.ledger.responses.map((r) => [r.id, r.until]), [["relief", 57]]);
  const gone = plan({ civs: [me()], turn: 57, ledger: lifted.ledger, macro: macroWith({ e: 10000 }) });
  assert.deepEqual(gone.ledger.responses, []);
  assert.deepEqual(gone.ledger.legacies.map((r) => [r.id, r.until]), [["relief", 60]], "the relief given is remembered ten turns");
  // Ending relief with the crisis still on: the mob remembers for ten turns.
  const cut = plan({ civs: [me({ cities: [city("3:1")] })], turn: 52, ledger: relief.ledger, macro: DEPRESSION(),
    requests: [respond("relief", { cancel: true })] });
  assert.deepEqual(kinds(cut, "response-ended").map((e) => [e.response, e.early]), [["relief", 1]]);
  assert.deepEqual(cut.ledger.legacies.map((r) => [r.id, r.until]), [["relief", 60], ["relief-ended", 62]]);
  const sour = plan({ civs: [me({ cities: [city("3:1")] })], turn: 53, ledger: cut.ledger, macro: DEPRESSION() });
  assert.deepEqual(sour.celebration.filter((r) => r.reason === "relief-ended"), [{ pid: ME, amount: -200, reason: "relief-ended" }]);
});

// --- (5) legacies --------------------------------------------------------------------------------------------------

test("legacies end on their turn, at the age change, or one age later when they carry", () => {
  const legacies = [{ pid: ME, id: "bullion", since: 40, until: 50, nextAge: false },
    { pid: ME, id: "debase", since: 40, until: null, nextAge: false },
    { pid: ME, id: "deposit-insurance", since: 40, until: null, nextAge: true }];
  const ledger = ledgerWith([], { legacies, age: "AGE_EXPLORATION" });
  const same = plan({ civs: [me()], ledger });
  assert.deepEqual(same.ledger.legacies.map((r) => r.id), ["debase", "deposit-insurance"], "bullion's turns are up");
  assert.equal(same.notices.some((n) => n.kind === "legacy-ended" && n.legacy === "bullion"), true);
  const changed = plan({ age: "AGE_MODERN", civs: [me()], turn: 51, ledger: same.ledger });
  assert.deepEqual(changed.ledger.legacies.map((r) => [r.id, r.nextAge]), [["deposit-insurance", false]], "the age's go, the one that carries stays once");
  const next = plan({ age: "AGE_ANTIQUITY", civs: [me()], turn: 52, ledger: changed.ledger });
  assert.deepEqual(next.ledger.legacies, []);
});

test("the terms the legacies set, read through crisisTerms, and plain terms with nothing on", () => {
  const legacies = [{ pid: ME, id: "lend-crown", since: 40, until: null, nextAge: false },
    { pid: null, id: "bank-failures", since: 40, until: null, nextAge: false },
    { pid: AI, id: "charter", since: 40, until: null, nextAge: false }];
  const responses = [{ pid: AI, id: "charter", crisis: "depression", since: 40, until: 60 },
    { pid: AI, id: "rearmament", crisis: "depression", since: 40, until: 50 }];
  const ctx = ctxFor({ civs: [me(), ai(AI)], ledger: ledgerWith([], { legacies, responses }) });
  assert.deepEqual([crisisTerms(ctx, ME).capTurns, crisisTerms(ctx, AI).capTurns], [2, 0], "the crown's +4 less the failures' -2; the company's +2 less 2");
  assert.deepEqual([crisisTerms(ctx, AI).billPct, crisisTerms(ctx, AI).armyFactor], [80, 1.5]);
  const off = ctxFor({ civs: [me()], ledger: ledgerWith([], { legacies }), options: { crises: false } });
  assert.equal(crisisTerms(off, ME).capTurns, 0, "crises off: the rows don't bite");
});

// --- (6) the weights -----------------------------------------------------------------------------------------------

test("public works lift the holder by 0.01 and the world by 0.0025 each under 0.95, capped at 0.01; austerity sinks its holder", () => {
  const responses = [1, 2, 3, 4, 5].map((pid) => ({ pid, id: "public-works", crisis: "depression", since: 40, until: null }));
  responses.push({ pid: 6, id: "austerity", crisis: "depression", since: 40, until: null });
  const civs = [1, 2, 3, 4, 5, 6].map((pid) => ai(pid));
  const ctx = ctxFor({ civs, ledger: ledgerWith([], { responses }), macro: macroWith({ e: 9000 }) });
  const rows = crisisWeights(ctx, []);
  assert.deepEqual(rows.filter((r) => r.kind === "public-works" && !r.world).map((r) => [r.a, r.w]), [[1, 100], [2, 100], [3, 100], [4, 100], [5, 100]]);
  assert.deepEqual(rows.filter((r) => r.kind === "public-works" && r.world).map((r) => r.w), [100], "5 x 25 capped at 100");
  assert.deepEqual(rows.filter((r) => r.kind === "austerity").map((r) => [r.a, r.w]), [[6, -100]]);
  const steady = ctxFor({ civs, ledger: ledgerWith([], { responses }), macro: macroWith({ e: 9800 }) });
  assert.equal(crisisWeights(steady, []).some((r) => r.kind === "public-works" && r.world), false, "nothing on the world above 0.95");
});

test("the once-lifts the turn after: a bank holiday or a suspension +0.02, cancelled debts +0.02, a fireside chat +0.01; a bank run -0.02", () => {
  const events = [{ turn: 49, kind: "response", pid: ME, response: "bank-holiday" }, { turn: 49, kind: "response", pid: AI, response: "confidence" },
    { turn: 49, kind: "response", pid: OTHER, response: "cancel-debts" }, { turn: 49, kind: "bank-run", pid: 7 },
    { turn: 48, kind: "response", pid: 8, response: "confidence" }];
  const ctx = ctxFor({ civs: [me(), ai(AI), ai(OTHER), ai(7), ai(8)], ledger: ledgerWith([], { events, lastTurn: 49 }) });
  assert.deepEqual(crisisWeights(ctx, []).map((r) => [r.kind, r.a, r.w]),
    [["bank-holiday", ME, 200], ["confidence", AI, 100], ["cancel-debts", OTHER, 200], ["bank-run", 7, -200]]);
});

test("the trade war: three civs holding High under 0.80 weigh -0.005 on the world; navigation acts count double", () => {
  const markets = { ...emptyMarkets(), tariffs: [{ pid: ME, level: "high", changedTurn: 40 }, { pid: AI, level: "high", changedTurn: 40 }] };
  const two = ctxFor({ civs: [me(), ai(AI), ai(OTHER)], markets, macro: DEPRESSION() });
  assert.equal(crisisWeights(two, []).some((r) => r.kind === "trade-war"), false);
  const legacies = [{ pid: AI, id: "navigation-acts", since: 40, until: null, nextAge: false }];
  const acts = ctxFor({ civs: [me(), ai(AI), ai(OTHER)], markets, ledger: ledgerWith([], { legacies }), macro: DEPRESSION() });
  assert.deepEqual(crisisWeights(acts, []).filter((r) => r.kind === "trade-war").map((r) => [r.world, r.w]), [[true, -50]]);
  const calm = ctxFor({ civs: [me(), ai(AI), ai(OTHER)], markets, ledger: ledgerWith([], { legacies }), macro: macroWith({ e: 9000 }) });
  assert.equal(crisisWeights(calm, []).some((r) => r.kind === "trade-war"), false, "a Slump isn't a Depression");
});

test("the Dust Bowl: a disaster on a civ in Depression weighs again; the Bonus Army after five turns with neither relief nor works", () => {
  const disaster = { kind: "disaster", a: ME, b: null, w: -50, world: true };
  const inIt = ctxFor({ civs: [me(), ai(AI)], macro: DEPRESSION(), ledger: ledgerWith([], { crises: [{ pid: ME, kind: "depression", since: 45 }] }) });
  const rows = crisisWeights(inIt, [disaster]);
  assert.deepEqual(rows.filter((r) => r.kind === "dust-bowl").map((r) => [r.a, r.w]), [[ME, -50]]);
  assert.deepEqual(rows.filter((r) => r.kind === "bonus-army").map((r) => [r.a, r.w]), [[ME, -100]]);
  const fed = ctxFor({ civs: [me(), ai(AI)], macro: DEPRESSION(), ledger: ledgerWith([], { crises: [{ pid: ME, kind: "depression", since: 45 }],
    responses: [{ pid: ME, id: "relief", crisis: "depression", since: 46, until: null }] }) });
  assert.equal(crisisWeights(fed, [disaster]).some((r) => r.kind === "bonus-army"), false);
  const fresh = ctxFor({ civs: [me(), ai(AI)], macro: DEPRESSION(), ledger: ledgerWith([], { crises: [{ pid: ME, kind: "depression", since: 46 }] }) });
  assert.equal(crisisWeights(fresh, []).some((r) => r.kind === "bonus-army"), false, "four turns in");
  const steady = ctxFor({ civs: [me(), ai(AI)], macro: macroWith({ e: 10000 }) });
  assert.equal(crisisWeights(steady, [disaster]).some((r) => r.kind === "dust-bowl"), false);
});

// --- (7) the events ------------------------------------------------------------------------------------------------

test("a bank run: a lender in Depression with two borrowers in default to it lends to nobody for five turns", () => {
  const loans = [loan("L1", { lender: ME, borrower: AI, state: "default", missed: 3 }), loan("L2", { lender: ME, borrower: OTHER, state: "default", missed: 3 })];
  const out = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith(loans), macro: DEPRESSION() });
  assert.deepEqual(out.ledger.responses.filter((r) => r.id === "bank-run"), [{ pid: ME, id: "bank-run", crisis: "depression", since: 50, until: 55 }]);
  assert.deepEqual(kinds(out, "bank-run").map((e) => [e.pid, e.borrowers]), [[ME, 2]]);
  assert.equal(crisisTerms(ctxFor({ civs: [me()], ledger: out.ledger }), ME).lendingClosed, true);
  const one = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith([loans[0]]), macro: DEPRESSION() });
  assert.deepEqual(kinds(one, "bank-run"), [], "one borrower isn't a run");
  const insured = ledgerWith(loans, { legacies: [{ pid: ME, id: "deposit-insurance", since: 40, until: null, nextAge: false }] });
  assert.deepEqual(kinds(plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: insured, macro: DEPRESSION() }), "bank-run"), []);
});

test("bank failures: defaults past a fifth of the world's loans in a world Depression close the bond market five turns and cost caps two turns for the age", () => {
  const loans = [loan("L1", { outstanding: 3000, state: "default", missed: 3 }), loan("L2", { borrower: AI, outstanding: 7000 })];
  const out = plan({ civs: [me(), ai(AI)], ledger: ledgerWith(loans), macro: DEPRESSION(), options: { ai: false } });
  assert.deepEqual(out.ledger.blocks.filter((b) => b.lender === "bond").map((b) => [b.borrower, b.untilTurn]), [[ME, 55], [AI, 55]]);
  assert.deepEqual(out.ledger.legacies, [{ pid: null, id: "bank-failures", since: 50, until: null, nextAge: false }]);
  assert.equal(kinds(out, "bank-failures").length, 1);
  assert.equal(crisisTerms(ctxFor({ civs: [me()], ledger: out.ledger }), AI).capTurns, -2, "the world's legacy, read by everyone");
  const sound = plan({ civs: [me(), ai(AI)], ledger: ledgerWith([loan("L1", { outstanding: 1000, state: "default", missed: 3 }), loans[1]]),
    macro: DEPRESSION(), options: { ai: false } });
  assert.deepEqual(kinds(sound, "bank-failures"), [], "a tenth in default");
});

test("a bubble: credit growing fast five turns in a Boom; its burst under 0.95 is a credit panic for the civs that owe", () => {
  const growth = [46, 47, 48, 49, 50].map((turn) => ({ turn, kind: "credit-growth", a: null, b: null, w: 150 }));
  const boom = macroWith({ e: 11000, events: growth });
  const out = plan({ civs: [me(), ai(AI)], ledger: ledgerWith([loan("L1")]), macro: boom });
  assert.deepEqual(out.ledger.bubble, { since: 50, burst: null });
  assert.equal(kinds(out, "bubble").length, 1);
  assert.equal(out.notices.filter((n) => n.kind === "bubble").length, 1, "the human seat hears of it (notices are the player's)");
  const burst = plan({ civs: [me(), ai(AI)], turn: 53, ledger: out.ledger, macro: macroWith({ e: 9000, events: growth }) });
  assert.deepEqual(burst.ledger.bubble, { since: 50, burst: 53 });
  assert.equal(kinds(burst, "bubble-burst").length, 1);
  assert.equal(burst.ledger.crises.some((r) => r.pid === ME && r.kind === "credit-panic"), true);
});

test("a bubble's burst is a credit panic for the civs that owe, not the ones that don't", () => {
  const growth = [46, 47, 48, 49, 50].map((turn) => ({ turn, kind: "credit-growth", a: null, b: null, w: 150 }));
  const out = plan({ civs: [me(), ai(AI)], ledger: ledgerWith([loan("L1")]), macro: macroWith({ e: 11000, events: growth }) });
  const burst = plan({ civs: [me(), ai(AI)], turn: 53, ledger: out.ledger, macro: macroWith({ e: 9000, events: growth }) });
  assert.deepEqual(burst.ledger.crises.map((r) => [r.pid, r.kind]), [[ME, "credit-panic"]]);
});

test("a bankruptcy cascade: two suspensions within five turns close the bond market to everyone uninsured for five turns", () => {
  const first = plan({ civs: [me(), ai(AI), ai(OTHER)], ledger: ledgerWith([loan("L1", { lender: AI })]), macro: DEPRESSION(), requests: [respond("suspend")] });
  assert.deepEqual(kinds(first, "cascade"), []);
  const second = plan({ civs: [me(), ai(AI), ai(OTHER, { human: true })], turn: 53, ledger: first.ledger, macro: DEPRESSION(),
    requests: [{ kind: "respond", pid: OTHER, response: "suspend" }] });
  assert.equal(kinds(second, "cascade").length, 1);
  assert.deepEqual(second.ledger.blocks.filter((b) => b.lender === "bond").map((b) => [b.borrower, b.untilTurn]), [[ME, 58], [AI, 58], [OTHER, 58]]);
  assert.equal(second.notices.filter((n) => n.kind === "cascade").length, 2, "both human seats");
});

// --- (8) the refusals ----------------------------------------------------------------------------------------------

test("why a response can't be taken: the age, no crisis, the stage, the system, once, the funds, no lender", () => {
  const crises = [{ pid: ME, kind: "depression", since: 45 }, { pid: ME, kind: "debt", since: 45 }];
  const ctx = ctxFor({ civs: [me({ balanceCents: 1000, stages: OPEN })], ledger: ledgerWith([], { crises }) });
  const civ = ctx.civ.get(ME);
  assert.equal(responseRefusal(ctx, civ, responseById("cancel-debts")), "age", "Antiquity's response in Exploration");
  assert.equal(responseRefusal(ctx, civ, responseById("recoinage")), "no-crisis", "an inflation crisis it isn't in");
  assert.equal(responseRefusal(ctx, civ, responseById("navigation-acts")), "stage", "no Tariffs stage");
  assert.equal(responseRefusal(ctx, civ, responseById("charter")), "stage", "no Chartered companies");
  assert.equal(responseRefusal(ctx, civ, responseById("lend-crown")), "no-lender");
  assert.equal(responseRefusal(ctx, civ, responseById("public-works")), null);
  const modern = ctxFor({ age: "AGE_MODERN", civs: [me({ balanceCents: 1000 })], ledger: ledgerWith([], { crises }) });
  assert.equal(responseRefusal(modern, modern.civ.get(ME), responseById("deposit-insurance")), "funds", "two turns of income it doesn't hold");
  const antiquityCtx = ctxFor({ age: "AGE_ANTIQUITY", civs: [me()], ledger: ledgerWith([], { crises }) });
  assert.equal(responseRefusal(antiquityCtx, antiquityCtx.civ.get(ME), responseById("tribute")), "system", "a Mixed civ can't levy");
  const taken = ledgerWith([], { crises, crisisTurns: [{ pid: ME, id: "take:bank-holiday", turn: 46 }] });
  const twice = ctxFor({ civs: [me()], ledger: taken });
  assert.equal(responseRefusal(twice, twice.civ.get(ME), responseById("bank-holiday")), "once");
  const off = ctxFor({ civs: [me()], ledger: ledgerWith([], { crises }), options: { crises: false } });
  assert.equal(responseRefusal(off, off.civ.get(ME), responseById("public-works")), "crises-off");
});

// --- (9) the AI ----------------------------------------------------------------------------------------------------

test("the AI takes one response per crisis and never the Hoover line unless it's a Mercantile civ raising tariffs", () => {
  const out = plan({ civs: [ai(AI), ai(OTHER)], macro: DEPRESSION() });
  assert.deepEqual(kinds(out, "response").map((e) => [e.pid, e.response, e.source]), [[AI, "relief", "ai"], [OTHER, "relief", "ai"]],
    "a Mixed civ's first pick: relief lists it third, public works fifth");
  const next = plan({ civs: [ai(AI), ai(OTHER)], turn: 51, ledger: out.ledger, macro: DEPRESSION() });
  assert.deepEqual(kinds(next, "response"), [], "one per crisis");
  assert.equal(out.events.some((e) => e.kind === "response" && ["austerity", "navigation-acts"].includes(String(e.response))), false);
});

test("an AI whose dues pass its income takes the bank holiday first; one at war in Modern rearms", () => {
  const owed = loan("L1", { borrower: AI, principal: 300000, outstanding: 300000, term: 3 });
  const out = plan({ civs: [ai(AI, { balanceCents: 0 })], ledger: ledgerWith([owed]), macro: DEPRESSION() });
  assert.deepEqual(kinds(out, "response").map((e) => e.response), ["bank-holiday"]);
  const war = plan({ age: "AGE_MODERN", civs: [ai(AI, { atWar: true })], macro: DEPRESSION() });
  assert.deepEqual(kinds(war, "response").map((e) => e.response), ["rearmament"]);
  // Insolvent (income at or below 0 for five turns), the holiday only hands the loan to the repudiation rule.
  const broke = plan({ civs: [ai(AI, { balanceCents: 0, incomeCents: -100 })],
    ledger: ledgerWith([owed], { lowIncome: [{ pid: AI, turns: 9 }] }), macro: DEPRESSION() });
  assert.equal(kinds(broke, "response").some((e) => e.response === "bank-holiday"), false, "no holiday while insolvent");
});

test("the AI picks by its economic system: Theocracy relief, Plutocracy a company, Despotism tribute", () => {
  const counters = [{ pid: AI, dues: 0, hot: 0, routes: [6, 6, 6, 6, 6] }];
  const civs = [ai(AI, { government: "GOVERNMENT_THEOCRACY" }), ai(OTHER, { government: "GOVERNMENT_PLUTOCRACY", stages: OPEN_MACRO })];
  const out = plan({ civs, macro: DEPRESSION(), options: { systems: true } });
  assert.deepEqual(kinds(out, "response").map((e) => [e.pid, e.response]), [[AI, "relief"], [OTHER, "public-works"]],
    "religious: relief; mercantile in a Depression: works, not the trap");
  const collapse = plan({ civs: [ai(OTHER, { government: "GOVERNMENT_PLUTOCRACY" })], ledger: ledgerWith([], { crisisCounters: [{ pid: OTHER, dues: 0, hot: 0, routes: [6, 6, 6, 6, 6] }] }),
    routes: [], options: { markets: true, tariffs: true, systems: true } });
  assert.deepEqual(kinds(collapse, "response").map((e) => e.response), ["navigation-acts"], "the Mercantile trap is its own");
  const levy = plan({ age: "AGE_ANTIQUITY", civs: [ai(AI, { government: "GOVERNMENT_DESPOTISM", strength: 100 }), ai(OTHER, { strength: 10 })],
    relations: [{ a: AI, b: OTHER, level: "unfriendly" }], macro: DEPRESSION(), options: { systems: true } });
  assert.equal(kinds(levy, "response").find((e) => e.pid === AI)?.response, "tribute");
  assert.equal(counters.length, 1);
});

// --- (10) the bank holiday -----------------------------------------------------------------------------------------

test("a bank holiday: the civ's payments and returns wait, with no miss, and so do the payments owed to it", () => {
  const loans = [loan("L1", { lender: AI }), loan("L2", { lender: ME, borrower: OTHER })];
  const investment = { id: "I1", kind: "general", investor: AI, host: ME, principal: 5000, mille: 50, term: 10, paid: 0, missed: 0,
    state: "active", opened: 40, closedTurn: null, writtenOff: 0, outstanding: 2500, cityId: null, baseIncome: 10000 };
  const ledger = ledgerWith(loans, { investments: [investment], responses: [{ pid: ME, id: "bank-holiday", crisis: "debt", since: 49, until: 52 }],
    crises: [{ pid: ME, kind: "depression", since: 49 }] });
  const out = plan({ civs: [me({ balanceCents: 0 }), ai(AI), ai(OTHER)], ledger, macro: DEPRESSION() });
  assert.deepEqual(out.transfers.filter((t) => ["payment", "dividend"].includes(t.reason)), [], "nothing paid either way");
  assert.deepEqual(kinds(out, "miss"), []);
  assert.deepEqual(out.ledger.loans.map((l) => [l.id, l.outstanding, l.missed]), [["L1", 10000, 0], ["L2", 10000, 0]]);
  const after = plan({ civs: [me({ balanceCents: 0 }), ai(AI), ai(OTHER)], turn: 52, ledger: out.ledger, macro: DEPRESSION() });
  assert.equal(after.transfers.some((t) => t.reason === "payment" && t.loanId === "L2"), true, "the holiday over, the Pirates pay again");
});

// --- (11) the save -------------------------------------------------------------------------------------------------

test("the crisis rows go through save and load whole; a save from before them loads with none", () => {
  const ledger = ledgerWith([], { crises: [{ pid: ME, kind: "debt", since: 40 }],
    responses: [{ pid: ME, id: "relief", crisis: "debt", since: 41, until: null }],
    legacies: [{ pid: null, id: "bank-failures", since: 42, until: null, nextAge: false }, { pid: ME, id: "deposit-insurance", since: 42, until: null, nextAge: true }],
    crisisTurns: [{ pid: ME, id: "take:relief", turn: 41, age: "AGE_EXPLORATION" }, { pid: ME, id: "end:depression", turn: 30 }],
    crisisCounters: [{ pid: ME, dues: 2, hot: 1, routes: [4, 4, 3] }], bubble: { since: 45, burst: null } });
  const back = load(save(ledger)).ledger;
  for (const key of ["crises", "responses", "legacies", "crisisTurns", "crisisCounters", "bubble"]) assert.deepEqual(back[key], ledger[key], key);
  const old = JSON.parse(save(ledgerWith([])));
  for (const key of ["crises", "responses", "legacies", "crisisTurns", "crisisCounters", "bubble"]) delete old.ledger[key];
  const loaded = load(JSON.stringify(old)).ledger;
  assert.deepEqual([loaded.crises, loaded.responses, loaded.legacies, loaded.crisisTurns, loaded.crisisCounters, loaded.bubble], [[], [], [], [], [], null]);
  const junk = save({ ...ledgerWith([]), crises: [{ pid: ME, kind: "famine", since: 1 }, { pid: "x", kind: "debt", since: 1 }],
    responses: [{ pid: ME, id: "Relief!", crisis: "debt", since: 1, until: null }], legacies: [{ pid: ME, id: "debase", since: "1" }] });
  const cleaned = load(junk).ledger;
  assert.deepEqual([cleaned.crises, cleaned.responses, cleaned.legacies], [[], [], []], "rows that aren't the catalog's go");
});

// --- (12) the option off ---------------------------------------------------------------------------------------------

test("with crises off nothing starts, no request is taken, and the rows a save holds stay quiet", () => {
  const ledger = ledgerWith([], { responses: [{ pid: ME, id: "public-works", crisis: "depression", since: 40, until: null }] });
  const out = plan({ civs: [me({ cities: [city("3:1")] })], ledger, macro: DEPRESSION(), options: { crises: false },
    requests: [respond("relief")] });
  assert.deepEqual(out.ledger.crises, []);
  assert.deepEqual(out.events.filter((e) => ["crisis-start", "response"].includes(e.kind)), []);
  assert.equal(out.events.find((e) => e.kind === "refused")?.reason, "crises-off");
  assert.equal(out.transfers.some((t) => t.reason === "works"), false);
});

// --- (13) the view -------------------------------------------------------------------------------------------------

test("crisisView: the open crises with their causes, what can be taken with its cost and refusal, what stands, what's left", () => {
  const events = [{ turn: 49, kind: "war-declared", a: ME, b: AI, w: -200 }, { turn: 49, kind: "default", a: AI, b: ME, w: -300 }, { turn: 49, kind: "peace", a: OTHER, b: AI, w: 100 }];
  const ledger = ledgerWith([], { crises: [{ pid: ME, kind: "depression", since: 48 }],
    responses: [{ pid: ME, id: "relief", crisis: "depression", since: 49, until: null }],
    legacies: [{ pid: ME, id: "bullion", since: 45, until: 55, nextAge: false }, { pid: null, id: "bank-failures", since: 45, until: null, nextAge: false }] });
  const ctx = ctxFor({ age: "AGE_MODERN", civs: [me(), ai(AI)], ledger, macro: macroWith({ e: 7500, events }) });
  const view = crisisView(ctx, ME);
  assert.equal(view.on, true);
  assert.deepEqual(view.crises, [{ kind: "depression", since: 48, turns: 2, causes: ["war-declared", "default"] }]);
  assert.deepEqual(view.responses.map((r) => r.id), ["public-works", "relief", "bank-holiday", "deposit-insurance", "gold-standard", "price-supports", "rearmament", "confidence", "austerity"]);
  const insurance = view.responses.find((r) => r.id === "deposit-insurance");
  assert.deepEqual([insurance.costCents, insurance.refusal, insurance.trap], [20000, null, false]);
  assert.deepEqual(view.responses.find((r) => r.id === "relief").refusal, "running");
  assert.deepEqual(view.responses.find((r) => r.id === "austerity").trap, true);
  assert.deepEqual(view.standing, [{ id: "relief", since: 49, left: null, crisis: "depression" }]);
  assert.deepEqual(view.legacies, [{ id: "bullion", since: 45, world: false, left: 5, nextAge: false }, { id: "bank-failures", since: 45, world: true, left: null, nextAge: false }]);
  assert.equal(view.age, "MO");
});
