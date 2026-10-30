// The 1.1 batch steps at their edges (DESIGN 4.10, 4.12, 6): what each event and notice carries, the boundaries of the
// AI rules (exactly 20 turns of income, exactly 10 turns apart, 40 turns after a repudiation), the order dividends are
// paid in, a dead civ's routes, and which city an AI backs.
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
const prices = { RESOURCE_IRON: 1000, RESOURCE_WINE: 600 };
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 300000, stages: OPEN_ALL, ...over });
const city = (id, over = {}) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 200, ...over });
const plan = (over) => {
  const out = planTurn(input({ markets: { ...emptyMarkets(), prices }, ...over }));
  assert.deepEqual(checkPlan({ plan: out, civs: over.civs }), []);
  return out;
};
const record = (over = {}) => makeInvestment({ id: "I1", kind: "project", investor: ME, host: AI, principal: 30000,
  turn: 40, cityId: "6:1", ...over });

test("prices count the living civs only; a dead civ's routes settle nothing", () => {
  const market = { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" }], copies: { RESOURCE_IRON: 1 },
    strategic: [], industry: 0 };
  const two = plan({ civs: [me(), ai(AI)], market, markets: emptyMarkets() }).markets.prices.RESOURCE_IRON;
  const withDead = plan({ civs: [me(), ai(AI), ai(OTHER, { alive: false })], market, markets: emptyMarkets() });
  assert.equal(withDead.markets.prices.RESOURCE_IRON, two, "the dead civ doesn't raise scarcity");
  const routes = [{ importer: OTHER, exporter: ME, resources: ["RESOURCE_IRON"] }];
  assert.deepEqual(plan({ civs: [me(), ai(OTHER, { alive: false })], routes }).trade, []);
});

test("a settlement's transfer carries what was owed and waived; exactly the funds pays, a cent short waives", () => {
  const routes = [{ importer: ME, exporter: AI, resources: ["RESOURCE_IRON"] }];
  const capped = plan({ civs: [me({ incomeCents: 3000 }), ai(AI)], routes });
  assert.deepEqual(capped.transfers[0].parts, { owed: 500, waived: 200 });
  const exact = plan({ civs: [me({ balanceCents: -9500 }), ai(AI)], routes });
  assert.equal(exact.transfers.length, 1, "funds of exactly the bill pay it");
  const short = plan({ civs: [me({ balanceCents: -9501 }), ai(AI)], routes });
  assert.equal(short.transfers.length, 0);
  const notice = short.notices.find((n) => n.kind === "trade");
  assert.equal(notice, undefined, "nothing paid or received: no trade line");
  const received = plan({ civs: [me(), ai(AI)], routes: [{ importer: AI, exporter: ME, resources: ["RESOURCE_IRON"] }] });
  assert.deepEqual(received.notices.find((n) => n.kind === "trade"), { pid: ME, kind: "trade", paid: 0, received: 500,
    waived: 0 });
  const aiOnly = plan({ civs: [me(), ai(AI), ai(OTHER)], routes: [{ importer: AI, exporter: OTHER,
    resources: ["RESOURCE_IRON"] }] });
  assert.equal(aiOnly.notices.some((n) => n.kind === "trade"), false, "the AI pair's bill isn't the human's notice");
  const waivedLine = plan({ civs: [me({ incomeCents: 3000 }), ai(AI)], routes }).notices.find((n) => n.kind === "trade");
  assert.deepEqual([waivedLine.paid, waivedLine.waived], [300, 200]);
});

test("the High tariff's notice counts each partner; the AI's tariff event names it and the level", () => {
  const routes = [{ importer: ME, exporter: AI, resources: ["RESOURCE_IRON"] },
    { importer: ME, exporter: OTHER, resources: ["RESOURCE_WINE"] }];
  const tariffs = [{ pid: ME, level: "high", changedTurn: 45 }];
  const out = plan({ civs: [me(), ai(AI), ai(OTHER)], routes, markets: { ...emptyMarkets(), prices, tariffs } });
  assert.equal(out.notices.find((n) => n.kind === "tariff-cost").partners, 2);
  assert.deepEqual(out.events.filter((e) => e.kind === "tariff").map((e) => [e.pid, e.level]), [[AI, "high"], [OTHER, "high"]]);
  const noStage = plan({ civs: [me(), ai(AI, { stages: { ...OPEN_ALL, tariffs: null } })], routes,
    markets: { ...emptyMarkets(), prices, tariffs } });
  assert.equal(noStage.events.some((e) => e.kind === "tariff"), false, "an AI past no Tariffs stage stays put");
  const notImporter = plan({ civs: [me(), ai(AI)], routes: [{ importer: AI, exporter: ME, resources: ["RESOURCE_IRON"] }],
    markets: { ...emptyMarkets(), prices, tariffs } });
  assert.equal(notImporter.events.some((e) => e.kind === "tariff"), false, "only the AIs the tariff falls on answer");
  const unpriced = plan({ civs: [me(), ai(AI)], routes: [{ importer: ME, exporter: AI, resources: ["RESOURCE_GONE"] }],
    markets: { ...emptyMarkets(), prices, tariffs } });
  assert.equal(unpriced.events.some((e) => e.kind === "tariff"), false, "a route that bills nothing isn't tariffed");
  const recent = [{ pid: ME, level: "high", changedTurn: 45 }, { pid: AI, level: "none", changedTurn: 48 }];
  const blocked = plan({ civs: [me(), ai(AI)], routes, markets: { ...emptyMarkets(), prices, tariffs: recent } });
  assert.equal(blocked.events.some((e) => e.kind === "tariff"), false, "the AI's 5-turn limit holds too");
});

test("dividends are paid oldest first, then each record's events and notices say what happened", () => {
  const ledger = { ...emptyLedger(), nextInvestId: 4, investments: [record({ id: "I2", turn: 45 }),
    record({ id: "I1", turn: 45 }), record({ id: "I3", turn: 30 }), record({ id: "I9", turn: 50 }),
    record({ id: "I8", host: OTHER })] };
  const out = plan({ civs: [me(), ai(AI, { balanceCents: -7000, incomeCents: 10000 }), ai(OTHER)], ledger });
  assert.deepEqual(out.transfers.filter((t) => t.from === AI).map((t) => t.loanId), ["I3", "I1"],
    "3000 Gold of funds pays two 1500 dividends: the oldest, then the lower id; I9 opened this turn");
  const miss = out.events.find((e) => e.kind === "invest-miss");
  assert.deepEqual([miss.loanId, miss.borrower, miss.missed], ["I2", AI, 1]);
  assert.deepEqual(out.influence.find((row) => row.loanId === "I2"), { pid: AI, amount: -5, loanId: "I2", reason: "miss" });
  const closing = { ...emptyLedger(), investments: [{ ...record(), paid: 24, outstanding: 1500 }] };
  const closed = plan({ civs: [me(), ai(AI)], ledger: closing });
  assert.deepEqual(closed.events.find((e) => e.kind === "invest-closed"), { turn: 50, kind: "invest-closed", loanId: "I1" });
  assert.equal(closed.ledger.investments[0].closedTurn, 50);
  const open = plan({ civs: [me(), ai(AI)], ledger: { ...emptyLedger(), investments: [record()] } });
  assert.equal(open.events.some((e) => e.kind === "invest-closed"), false);
  assert.equal(open.ledger.investments[0].closedTurn, null);
});

test("the default notices name the record and the borrower; the garnish closes the record with an event", () => {
  const two = { ...record(), missed: 2 };
  const out = plan({ civs: [me(), ai(AI, { balanceCents: -20000, incomeCents: 1000 })],
    ledger: { ...emptyLedger(), investments: [two] } });
  assert.deepEqual(out.notices.find((n) => n.kind === "invest-defaulted-on"),
    { pid: ME, kind: "invest-defaulted-on", loanId: "I1", borrower: AI });
  assert.deepEqual(out.events.find((e) => e.kind === "invest-default"),
    { turn: 50, kind: "invest-default", loanId: "I1", lender: ME, borrower: AI });
  assert.equal(out.ledger.blocks[0].reason, "default");
  const last = { ...record(), state: "default", outstanding: 1 };
  const done = plan({ civs: [me(), ai(AI)], ledger: { ...emptyLedger(), investments: [last] } });
  assert.deepEqual(done.events.find((e) => e.kind === "invest-closed"), { turn: 50, kind: "invest-closed", loanId: "I1" });
  assert.deepEqual([done.ledger.investments[0].state, done.ledger.investments[0].closedTurn], ["closed", 50]);
  const going = { ...record(), state: "default", outstanding: 10000 };
  const still = plan({ civs: [me(), ai(AI)], ledger: { ...emptyLedger(), investments: [going] } });
  assert.deepEqual([still.ledger.investments[0].state, still.ledger.investments[0].closedTurn], ["default", null]);
  assert.equal(still.events.some((e) => e.kind === "invest-closed"), false);
  const humanHost = { ...record({ investor: AI, host: ME, cityId: "3:1" }), missed: 0 };
  const mine = plan({ civs: [me({ balanceCents: -20000, incomeCents: 1000, cities: [city("3:1")] }), ai(AI)],
    ledger: { ...emptyLedger(), investments: [humanHost] } });
  assert.deepEqual(mine.notices.find((n) => n.kind === "invest-miss"), { pid: ME, kind: "invest-miss", loanId: "I1",
    missed: 1 });
});

test("a write-off's event carries what was lost and why; closed records are left alone", () => {
  const ledger = { ...emptyLedger(), investments: [record(), { ...record({ id: "I2" }), state: "closed" }] };
  const lost = plan({ civs: [me(), ai(AI, { cities: [] })], ledger });
  assert.deepEqual(lost.events.filter((e) => e.kind === "invest-writeoff"),
    [{ turn: 50, kind: "invest-writeoff", loanId: "I1", cents: 37500, gone: 0 }]);
  const dead = plan({ civs: [me(), ai(AI, { alive: false })], ledger });
  assert.equal(dead.events.find((e) => e.kind === "invest-writeoff").gone, 1);
});

test("the AI's spare Gold: income above 0 and a balance above exactly 20 turns of it", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const host = ai(OTHER, { balanceCents: 0, cities: [city("9:1")] });
  const invests = (over) => plan({ civs: [ai(AI, over), host], relations }).events.some((e) => e.kind === "invest");
  assert.equal(invests({ balanceCents: 200001 }), true, "a balance over 20 turns of income");
  assert.equal(invests({ balanceCents: 200000 }), false, "exactly 20 turns of income isn't above it");
  assert.equal(invests({ incomeCents: 0, balanceCents: 1e7 }), false);
});

test("once per 10 turns exactly; 40 turns after a repudiation the host is welcome again", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const host = ai(OTHER, { balanceCents: 0, cities: [city("9:1")] });
  const at = (turn, investTurn) => plan({ civs: [ai(AI), host], relations, turn,
    markets: { ...emptyMarkets(), prices, investTurn: { [AI]: investTurn } } }).events.some((e) => e.kind === "invest");
  assert.equal(at(59, 50), false);
  assert.equal(at(60, 50), true);
  const rep = (turn) => ({ ...emptyLedger(), repudiations: [{ pid: OTHER, lender: AI, turn, cents: 1, atWar: false }] });
  const after = (turn) => plan({ civs: [ai(AI), host], relations, ledger: rep(turn) }).events.some((e) => e.kind === "invest");
  assert.equal(after(11), false, "39 turns on");
  assert.equal(after(10), true, "40 turns on");
  const other = { ...emptyLedger(), repudiations: [{ pid: OTHER, lender: ME, turn: 49, cents: 1, atWar: false },
    { pid: ME, lender: AI, turn: 49, cents: 1, atWar: false }] };
  assert.equal(plan({ civs: [ai(AI), host], relations, ledger: other }).events.some((e) => e.kind === "invest"), true,
    "only a repudiation of this investor by this host counts");
});

test("the AI backs a role building first, skips cities with nothing to build, and needs the stage on both sides", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const cities = [city("9:1", { neededProgress: 0 }), city("9:2", { build: null, neededProgress: 50 }), city("9:3"),
    city("9:4", { roleBuilding: true })];
  const out = plan({ civs: [ai(AI), ai(OTHER, { balanceCents: 0, cities })], relations });
  assert.equal(out.progress[0].cityId, "9:4");
  const noRole = plan({ civs: [ai(AI), ai(OTHER, { balanceCents: 0, cities: cities.slice(0, 3) })], relations });
  assert.equal(noRole.progress[0].cityId, "9:3");
  const none = plan({ civs: [ai(AI), ai(OTHER, { balanceCents: 0, cities: cities.slice(0, 2) })], relations });
  assert.deepEqual(none.progress, []);
  const closed = { ...OPEN_ALL, guildPatronage: null };
  const hostClosed = plan({ civs: [ai(AI), ai(OTHER, { balanceCents: 0, stages: closed, cities })], relations });
  assert.deepEqual(hostClosed.progress, [], "the host needs Guild patronage too");
  const growing = { [OTHER]: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] };
  const noCharter = plan({ civs: [ai(AI, { stages: { ...OPEN_ALL, charteredCompanies: null } }),
    ai(OTHER, { balanceCents: 0, cities })], relations, markets: { ...emptyMarkets(), prices, incomes: growing } });
  assert.equal(noCharter.events.find((e) => e.kind === "invest").form, "project", "no Charters: the build instead");
  assert.equal(noCharter.events.find((e) => e.kind === "invest").source, "ai");
  const self = plan({ civs: [ai(AI, { cities })], relations: [{ a: AI, b: AI, level: "friendly" }] });
  assert.deepEqual(self.progress, [], "never in itself");
  const deadHost = plan({ civs: [ai(AI), ai(OTHER, { alive: false, cities })], relations });
  assert.deepEqual(deadHost.progress, []);
});

test("an offer's id comes from the shared counter, and its event names both sides", () => {
  const relations = [{ a: AI, b: ME, level: "friendly" }];
  const out = plan({ civs: [me({ cities: [city("3:1")] }), ai(AI)], relations,
    ledger: { ...emptyLedger(), nextInvestId: 7 } });
  assert.equal(out.ledger.offers[0].id, "I7");
  assert.equal(out.ledger.nextInvestId, 8);
  assert.deepEqual(out.events.find((e) => e.kind === "offer"), { turn: 50, kind: "offer", loanId: "I7", lender: AI,
    borrower: ME, cents: 50000, form: "project" });
  assert.equal(out.markets.investTurn[AI], 50);
});

test("AI aid: never when insolvent or with no income, sized by funds, the source named", () => {
  const inDefault = { ...emptyLedger(), nextId: 2, loans: [{ id: "L1", kind: "loan", lender: "bond", borrower: OTHER,
    principal: 100, outstanding: 100, ratePpm: 20000, term: 10, paid: 0, missed: 3, state: "default",
    emergency: false, restructured: false, opened: 1, closedTurn: null, writtenOff: 0, source: "borrow" }] };
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const aid = (over, ledger = inDefault) => plan({ civs: [ai(AI, { stages: {}, ...over }), ai(OTHER, { stages: {} })],
    relations, ledger }).events.find((e) => e.kind === "invest" && e.aid === 1);
  assert.equal(aid({ incomeCents: 0 }), undefined);
  assert.equal(aid({ incomeCents: -100 }), undefined);
  assert.equal(aid({ balanceCents: 2000, incomeCents: 1000 }).cents, 3000, "what it holds this turn, under 5 turns");
  assert.equal(aid({}).source, "ai");
  assert.equal(aid({ balanceCents: -5000, incomeCents: 1000 }), undefined, "nothing to give");
});
