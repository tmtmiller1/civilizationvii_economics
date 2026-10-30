// The 1.1 steps inside the turn batch (DESIGN 4.9, 4.10, 4.12, 4.14, 6): prices in the snapshot, one netted and
// capped settlement per pair from the payer's own funds, tariffs and their relationship cost, development loans,
// general investment and aid, dividends, misses and default, the lost-city write-off, the AI's offers to the player,
// and the AI rules. Every plan here passes the commit checks.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { makeInvestment } from "../ui/econ-invest.js";
import { OPEN_ALL, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const OTHER = 9;
const city = (id, over = {}) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 200, ...over });
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 300000, stages: OPEN_ALL, ...over });
const prices = { RESOURCE_IRON: 1000, RESOURCE_WINE: 600 };
const markets = (over = {}) => ({ ...emptyMarkets(), prices, ...over });
const route = (importer, exporter, resources) => ({ importer, exporter, resources });
const refusal = (plan, request) => plan.events.find((e) => e.kind === "refused" && e.request === request)?.reason;

/** A plan that must pass the commit checks. */
function plan(over) {
  const civs = over.civs;
  const out = planTurn(input({ markets: markets(), ...over }));
  assert.deepEqual(checkPlan({ plan: out, civs }), [], "commit checks");
  return out;
}

test("prices come from the market read in the snapshot and carry into the next turn's envelope", () => {
  const market = { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" }], copies: { RESOURCE_IRON: 1 },
    strategic: [], industry: 0 };
  const civs = [me(), ai(AI)];
  const first = plan({ civs, market, markets: emptyMarkets() });
  assert.equal(first.markets.prices.RESOURCE_IRON, 564, "400 * 1.41 on two civs and one copy");
  assert.equal(first.markets.lastTurn, 50);
  assert.deepEqual(first.markets.incomes, { [ME]: [10000], [AI]: [10000] });
  const off = plan({ civs, market, markets: emptyMarkets(), options: { markets: false } });
  assert.deepEqual(off.markets.prices, {}, "Markets Off: no prices");
  assert.deepEqual(plan({ civs, markets: emptyMarkets() }).markets.prices, {}, "no read, no prices");
});

test("one netted bill per pair, the side owing more pays, within 10% of its income, from its own funds", () => {
  const civs = [me(), ai(AI)];
  const routes = [route(ME, AI, ["RESOURCE_IRON", "RESOURCE_WINE"]), route(AI, ME, ["RESOURCE_WINE"])];
  const out = plan({ civs, routes });
  assert.deepEqual(out.transfers.map((t) => [t.loanId, t.from, t.to, t.cents, t.reason]),
    [[`B${ME}-${AI}`, ME, AI, 500, "trade"]], "800 owed against 300: 500 net");
  assert.deepEqual(out.trade, [{ payer: ME, payee: AI, owed: 500, cents: 500, waived: 0, paid: 500 }]);
  assert.deepEqual(out.notices.find((n) => n.kind === "trade"), { pid: ME, kind: "trade", paid: 500, received: 0,
    waived: 0 });
  const capped = plan({ civs: [me({ incomeCents: 3000 }), ai(AI)], routes });
  assert.deepEqual(capped.trade[0], { payer: ME, payee: AI, owed: 500, cents: 300, waived: 200, paid: 300 });
  const broke = plan({ civs: [me({ incomeCents: 0 }), ai(AI)], routes });
  assert.deepEqual(broke.transfers, [], "income at 0: nothing paid");
  const short = plan({ civs: [me({ balanceCents: -9800 }), ai(AI)], routes });
  assert.deepEqual([short.transfers.length, short.trade[0].waived, short.trade[0].paid], [0, 500, 0],
    "funds below the bill: waived, not carried");
});

test("bills need the Trade stage on both sides and the option on; routes with a dead or unknown civ settle nothing", () => {
  const routes = [route(ME, AI, ["RESOURCE_IRON"])];
  const closed = { ...OPEN_ALL, trade: null };
  assert.deepEqual(plan({ civs: [me(), ai(AI, { stages: closed })], routes }).transfers, []);
  assert.deepEqual(plan({ civs: [me(), ai(AI)], routes, options: { markets: false } }).transfers, []);
  assert.deepEqual(plan({ civs: [me(), ai(AI, { alive: false })], routes }).transfers, []);
  assert.deepEqual(plan({ civs: [me()], routes }).transfers, []);
  assert.equal(plan({ civs: [me(), ai(AI)], routes, options: { stages: false } }).transfers.length, 1,
    "Economic stages Off opens it");
});

test("the player's tariff: held back from the bill next turn, once per 5 turns, needs the stage and the options", () => {
  const civs = [me(), ai(AI)];
  const set = plan({ civs, requests: [{ kind: "tariff", pid: ME, level: "high" }] });
  assert.deepEqual(set.markets.tariffs, [{ pid: ME, level: "high", changedTurn: 50 }]);
  const routes = [route(ME, AI, ["RESOURCE_IRON"])];
  const next = plan({ civs, routes, turn: 51, markets: set.markets });
  assert.equal(next.transfers[0].cents, 375, "500 less 25%");
  const again = plan({ civs, turn: 52, markets: set.markets, requests: [{ kind: "tariff", pid: ME, level: "low" }] });
  assert.equal(refusal(again, "tariff"), "too-soon");
  const noStage = plan({ civs: [me({ stages: { ...OPEN_ALL, tariffs: null } })],
    requests: [{ kind: "tariff", pid: ME, level: "high" }] });
  assert.equal(refusal(noStage, "tariff"), "tariff-stage");
  const off = plan({ civs, options: { tariffs: false }, requests: [{ kind: "tariff", pid: ME, level: "high" }] });
  assert.equal(refusal(off, "tariff"), "tariffs-off");
  const bad = plan({ civs, requests: [{ kind: "tariff", pid: AI, level: "high" }, { kind: "tariff", pid: ME,
    level: "max" }] });
  assert.deepEqual(bad.events.filter((e) => e.kind === "refused").map((e) => e.reason), ["parties", "parties"]);
  const fullBill = plan({ civs, routes, turn: 51, markets: set.markets, options: { tariffs: false } });
  assert.equal(fullBill.transfers[0].cents, 500, "Tariffs Off holds every civ at None");
});

test("a High tariff costs the importer 1 relationship with each exporter every 5 turns, and the AI matches it", () => {
  const civs = [me(), ai(AI)];
  const routes = [route(ME, AI, ["RESOURCE_IRON"])];
  const tariffs = [{ pid: ME, level: "high", changedTurn: 45 }];
  const out = plan({ civs, routes, markets: markets({ tariffs }) });
  assert.deepEqual(out.relationships, [{ a: ME, b: AI, delta: -1 }]);
  assert.deepEqual(out.notices.find((n) => n.kind === "tariff-cost"), { pid: ME, kind: "tariff-cost", partners: 1 });
  assert.deepEqual(out.markets.tariffs.find((t) => t.pid === AI), { pid: AI, level: "high", changedTurn: 50 },
    "the AI it imports from matches");
  const dropped = plan({ civs, routes, turn: 60, markets: markets({ tariffs: [{ pid: ME, level: "none", changedTurn: 58 },
    { pid: AI, level: "high", changedTurn: 50 }] }) });
  assert.equal(dropped.markets.tariffs.find((t) => t.pid === AI).level, "none", "and drops back with it");
  const aiOff = plan({ civs, routes, markets: markets({ tariffs }), options: { ai: false } });
  assert.equal(aiOff.markets.tariffs.some((t) => t.pid === AI), false, "AI rules Off: it stays at None");
  const noTariffs = plan({ civs, routes, markets: markets({ tariffs }), options: { tariffs: false } });
  assert.deepEqual(noTariffs.relationships, []);
});

test("a development loan on an AI city's current build: progress, the Gold used, the record and the relationship", () => {
  const civs = [me(), ai(AI, { incomeCents: 2000, cities: [city("6:1", { neededProgress: 40, roleBuilding: true })] })];
  const out = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "project", cents: 30000,
    cityId: "6:1" }] });
  assert.deepEqual(out.transfers.map((t) => [t.loanId, t.from, t.to, t.cents, t.parts.refund]),
    [["I1", ME, "progress", 12000, 18000]], "40 points at 3 Gold: 120 Gold spent, the rest never leaves");
  assert.deepEqual(out.progress, [{ host: AI, cityId: "6:1", amount: 40, investmentId: "I1" }]);
  const record = out.ledger.investments[0];
  assert.deepEqual([record.kind, record.principal, record.mille, record.cityId, record.outstanding],
    ["project", 12000, 60, "6:1", 25 * 720], "6% on a role building");
  assert.deepEqual(out.relationships, [{ a: ME, b: AI, delta: 1 }], "120 Gold is 6 turns of a 20 Gold host");
  assert.equal(out.notices.find((n) => n.kind === "invested").loanId, "I1");
  const next = plan({ civs, turn: 51, ledger: out.ledger });
  assert.deepEqual(next.transfers.map((t) => [t.loanId, t.from, t.to, t.cents, t.reason]),
    [["I1", AI, ME, 720, "dividend"]]);
  assert.deepEqual(next.progress, []);
});

test("investment refusals: the build, the stage, war and Unfriendly, a block, funds, the option, the parties", () => {
  const base = { investor: ME, host: AI, form: "project", cents: 30000, cityId: "6:1" };
  const civs = [me(), ai(AI, { cities: [city("6:1"), city("6:2", { build: null })] })];
  const ask = (over, more = {}) => refusal(plan({ civs, ...more, requests: [{ kind: "invest", ...base, ...over }] }),
    "invest");
  assert.equal(ask({}), undefined);
  assert.equal(ask({ cityId: "6:2" }), "build", "a city with nothing queued");
  assert.equal(ask({ cityId: "6:9" }), "build");
  assert.equal(ask({}, { civs: [me(), ai(AI, { cities: [city("6:1", { neededProgress: 0 })] })] }), "build");
  assert.equal(ask({}, { civs: [me({ stages: { ...OPEN_ALL, guildPatronage: null } }), civs[1]] }), "invest-stage");
  assert.equal(ask({ form: "general" }, { civs: [me(), ai(AI, { stages: { ...OPEN_ALL, charteredCompanies: null } })] }),
    "invest-stage");
  assert.equal(ask({}, { relations: [{ a: ME, b: AI, level: "war" }] }), "relation");
  assert.equal(ask({}, { relations: [{ a: ME, b: AI, level: "unfriendly" }] }), "relation");
  assert.equal(ask({ asAid: true }, { relations: [{ a: ME, b: AI, level: "unfriendly" }] }), undefined,
    "aid only needs peace");
  const blocked = { ...emptyLedger(), blocks: [{ lender: ME, borrower: AI, reason: "default", agesLeft: 0, untilTurn: null }] };
  assert.equal(ask({}, { ledger: blocked }), "blocked");
  assert.equal(ask({ cents: 999999 }), "balance");
  assert.equal(ask({ cents: 0 }), "terms");
  assert.equal(ask({ form: "bond" }), "terms");
  assert.equal(ask({}, { options: { investment: false } }), "investment-off");
  assert.equal(ask({ host: ME }), "parties");
  assert.equal(ask({ investor: AI, host: ME }), "parties", "the model takes requests from the human only");
  assert.equal(ask({}, { options: { ai: false } }), "ai-off", "accepting is an AI rule");
});

test("general investment: a Gold pair, a dividend that moves with the host, refused by a host in default", () => {
  const civs = [me(), ai(AI, { incomeCents: 2000 })];
  const out = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "general", cents: 20000 }] });
  assert.deepEqual(out.transfers.map((t) => [t.from, t.to, t.cents]), [[ME, AI, 20000]]);
  assert.equal(out.ledger.investments[0].baseIncome, 2000);
  const grown = plan({ civs: [me(), ai(AI, { incomeCents: 4000 })], turn: 51, ledger: out.ledger });
  assert.equal(grown.transfers[0].cents, 1800, "income doubled: 9% of G");
  const inDefault = { ...emptyLedger(), loans: [{ id: "L1", kind: "loan", lender: "bond", borrower: AI, principal: 100,
    outstanding: 100, ratePpm: 20000, term: 10, paid: 0, missed: 3, state: "default", emergency: false,
    restructured: false, opened: 1, closedTurn: null, writtenOff: 0, source: "borrow" }], nextId: 2 };
  const declined = plan({ civs, ledger: inDefault, requests: [{ kind: "invest", investor: ME, host: AI, form: "general",
    cents: 20000 }] });
  assert.equal(refusal(declined, "invest"), "host-default");
});

test("aid: no record, no return, the relationship at +1 per 2.5 turns of the host's income", () => {
  const civs = [me(), ai(AI, { incomeCents: 2000, cities: [city("6:1")] })];
  const gold = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "general", cents: 10000,
    asAid: true }] });
  assert.deepEqual(gold.transfers.map((t) => [t.loanId, t.from, t.to, t.cents]), [[`A${ME}-${AI}`, ME, AI, 10000]]);
  assert.deepEqual(gold.ledger.investments, []);
  assert.deepEqual(gold.relationships, [{ a: ME, b: AI, delta: 2 }]);
  const build = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "project", cents: 3000,
    cityId: "6:1", asAid: true }] });
  assert.deepEqual(build.progress, [{ host: AI, cityId: "6:1", amount: 10, investmentId: `A${ME}-${AI}` }]);
  assert.deepEqual(build.ledger.investments, []);
  const twice = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "general", cents: 100,
    asAid: true }, { kind: "invest", investor: ME, host: AI, form: "general", cents: 100, asAid: true }] });
  assert.equal(refusal(twice, "invest"), "same-turn", "one gift per pair per turn");
});

test("a missed dividend costs standing and Influence; three in a row is default, a block, then the garnish", () => {
  const record = makeInvestment({ id: "I1", kind: "project", investor: ME, host: AI, principal: 30000, turn: 40,
    cityId: "6:1" });
  let ledger = { ...emptyLedger(), investments: [record], nextInvestId: 2 };
  const civs = [me(), ai(AI, { balanceCents: -9000, incomeCents: 1000, cities: [city("6:1")] })];
  const kinds = [];
  for (let turn = 50; turn < 53; turn += 1) {
    const out = plan({ civs, turn, ledger });
    kinds.push(out.events.map((e) => e.kind).filter((k) => k.startsWith("invest")).join(","));
    ledger = out.ledger;
  }
  assert.deepEqual(kinds, ["invest-miss", "invest-miss", "invest-miss,invest-default"]);
  assert.equal(ledger.investments[0].state, "default");
  assert.deepEqual(ledger.blocks.map((b) => [b.lender, b.borrower, b.reason]), [[ME, AI, "default"]]);
  assert.equal(ledger.misses.find((m) => m.pid === AI).n, 1);
  const garnish = plan({ civs: [me(), ai(AI, { cities: [city("6:1")] })], turn: 53, ledger });
  assert.deepEqual(garnish.transfers.map((t) => [t.from, t.to, t.cents, t.reason]), [[AI, ME, 3750, "garnish"]]);
});

test("the host losing the city writes a development loan off; a dead party closes any record", () => {
  const record = makeInvestment({ id: "I1", kind: "project", investor: ME, host: AI, principal: 30000, turn: 40,
    cityId: "6:1" });
  const ledger = { ...emptyLedger(), investments: [record], nextInvestId: 2 };
  const lost = plan({ civs: [me(), ai(AI, { cities: [city("6:2")] })], ledger });
  assert.equal(lost.ledger.investments[0].state, "closed");
  assert.equal(lost.ledger.investments[0].writtenOff, 37500);
  assert.deepEqual(lost.transfers, []);
  assert.equal(lost.notices.find((n) => n.kind === "invest-writeoff").cents, 37500);
  const unread = plan({ civs: [me(), ai(AI)], ledger });
  assert.equal(unread.ledger.investments[0].state, "active", "no city read: nothing written off");
  const dead = plan({ civs: [me(), ai(AI, { alive: false })], ledger });
  assert.equal(dead.ledger.investments[0].state, "closed");
});

test("repudiating an investor closes what the host holds from it, with the loan rules' reputation cost", () => {
  const record = makeInvestment({ id: "I1", kind: "general", investor: AI, host: ME, principal: 20000, turn: 40,
    baseIncome: 10000 });
  const ledger = { ...emptyLedger(), investments: [record], nextInvestId: 2 };
  const out = plan({ civs: [me(), ai(AI)], ledger, requests: [{ kind: "repudiate", borrower: ME, lender: AI }] });
  assert.equal(out.ledger.investments[0].state, "repudiated");
  assert.equal(out.events.find((e) => e.kind === "repudiation").cents, 22500);
  assert.equal(out.grievances[0].against, AI);
  assert.deepEqual(out.transfers, []);
});

test("the AI invests in a Friendly civ once per 10 turns: general when the host grows, else its current build", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const growing = { [OTHER]: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900] };
  const host = ai(OTHER, { incomeCents: 2000, balanceCents: 0, cities: [city("9:1")] });
  const general = plan({ civs: [ai(AI), host], relations, markets: markets({ incomes: growing }) });
  assert.deepEqual(general.events.filter((e) => e.kind === "invest").map((e) => [e.lender, e.borrower, e.form, e.cents]),
    [[AI, OTHER, "general", 50000]], "5 turns of the investor's income");
  const flat = plan({ civs: [ai(AI), host], relations });
  assert.deepEqual(flat.progress, [{ host: OTHER, cityId: "9:1", amount: 166, investmentId: "I1" }]);
  const again = plan({ civs: [ai(AI), host], relations, turn: 55, ledger: flat.ledger, markets: flat.markets });
  assert.equal(again.events.some((e) => e.kind === "invest"), false, "not within 10 turns");
  const poor = plan({ civs: [ai(AI, { balanceCents: 100000 }), host], relations });
  assert.equal(poor.events.some((e) => e.kind === "invest"), false, "balance at or below 20 turns of income");
  const neutral = plan({ civs: [ai(AI), host], relations: [] });
  assert.equal(neutral.events.some((e) => e.kind === "invest"), false, "Friendly hosts only");
  const repudiated = { ...emptyLedger(), repudiations: [{ pid: OTHER, lender: AI, turn: 30, cents: 1, atWar: false }] };
  assert.equal(plan({ civs: [ai(AI), host], relations, ledger: repudiated }).events.some((e) => e.kind === "invest"),
    false, "never in a civ that stiffed it lately");
});

test("an AI host in default turns down another AI's general investment, as it turns down the player's", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const growing = { [OTHER]: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900] };
  const host = ai(OTHER, { incomeCents: 2000, balanceCents: 0, cities: [city("9:1")] });
  const inDefault = { ...emptyLedger(), nextId: 2, loans: [{ id: "L1", kind: "loan", lender: "bond", borrower: OTHER,
    principal: 100, outstanding: 100, ratePpm: 20000, term: 10, paid: 0, missed: 3, state: "default",
    emergency: false, restructured: false, opened: 1, closedTurn: null, writtenOff: 0, source: "borrow" }] };
  const out = plan({ civs: [ai(AI), host], relations, ledger: inDefault, markets: markets({ incomes: growing }) });
  assert.equal(out.events.some((e) => e.kind === "invest" && e.form === "general" && e.aid !== 1), false);
});

test("to the player an AI investment is an offer: accepted it opens, declined or left it goes", () => {
  const relations = [{ a: AI, b: ME, level: "friendly" }];
  const civs = [me({ cities: [city("3:1")] }), ai(AI)];
  const offered = plan({ civs, relations });
  assert.equal(offered.ledger.offers.length, 1);
  const offer = offered.ledger.offers[0];
  assert.deepEqual([offer.investor, offer.host, offer.kind, offer.cityId], [AI, ME, "project", "3:1"]);
  assert.deepEqual(offered.transfers, [], "nothing moves until the player answers");
  assert.equal(offered.notices.find((n) => n.kind === "offer").offerId, offer.id);
  const accepted = plan({ civs, relations, turn: 51, ledger: offered.ledger, markets: offered.markets,
    requests: [{ kind: "accept-offer", offerId: offer.id }] });
  assert.deepEqual(accepted.transfers.map((t) => [t.from, t.to, t.cents]), [[AI, "progress", 49800]], "500 Gold offered, 166 points used");
  assert.equal(accepted.ledger.investments[0].host, ME);
  assert.deepEqual(accepted.ledger.offers, []);
  const declined = plan({ civs, relations, turn: 51, ledger: offered.ledger, markets: offered.markets,
    requests: [{ kind: "decline-offer", offerId: offer.id }] });
  assert.deepEqual([declined.ledger.offers.length, declined.transfers.length], [0, 0]);
  assert.equal(refusal(plan({ civs, relations, turn: 51, ledger: offered.ledger,
    requests: [{ kind: "accept-offer", offerId: "I99" }] }), "accept-offer"), "offer-gone");
  const expired = plan({ civs, relations, turn: 53, ledger: offered.ledger, markets: offered.markets });
  assert.equal(expired.ledger.offers.some((o) => o.id === offer.id), false, "gone after 3 turns");
});

test("AI aid: to a Friendly civ in default, once per age, 5 turns of its own income", () => {
  const inDefault = { ...emptyLedger(), nextId: 2, loans: [{ id: "L1", kind: "loan", lender: "bond", borrower: OTHER,
    principal: 100, outstanding: 100, ratePpm: 20000, term: 10, paid: 0, missed: 3, state: "default",
    emergency: false, restructured: false, opened: 1, closedTurn: null, writtenOff: 0, source: "borrow" }] };
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const civs = [ai(AI, { stages: {} }), ai(OTHER, { balanceCents: 10000, stages: {} })];
  const out = plan({ civs, relations, ledger: inDefault });
  const aid = out.transfers.find((t) => t.reason === "invest");
  assert.deepEqual([aid.from, aid.to, aid.cents], [AI, OTHER, 50000]);
  assert.equal(out.markets.aidAge[AI], "AGE_EXPLORATION");
  const again = plan({ civs, relations, ledger: out.ledger, markets: out.markets, turn: 70 });
  assert.equal(again.transfers.some((t) => t.reason === "invest"), false, "once per age");
  const later = plan({ civs, relations, ledger: out.ledger, markets: out.markets, turn: 70, age: "AGE_MODERN" });
  assert.equal(later.transfers.some((t) => t.reason === "invest"), true);
  const solvent = plan({ civs, relations });
  assert.equal(solvent.transfers.some((t) => t.reason === "invest"), false, "only to a civ in default");
  const offOption = plan({ civs, relations, ledger: inDefault, options: { investment: false } });
  assert.equal(offOption.transfers.some((t) => t.reason === "invest"), false);
});
