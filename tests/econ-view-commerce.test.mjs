// The Markets and Trade tabs' numbers (DESIGN 4.9, 4.10, 4.12, 9): the price list, each partner's bill as the batch
// would settle it, the route preview, each gift's forecast, the targets with their refusals, and the holdings.
import test from "node:test";
import assert from "node:assert/strict";
import { investForecast, investTargets, investmentsView, marketView, routePreview, tradeView }
  from "../ui/econ-view-commerce.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { emptyLedger } from "../ui/econ-state.js";
import { makeInvestment } from "../ui/econ-invest.js";
import { OPEN_ALL, civ, input } from "./_fixtures.mjs";

const ME = 2;
// Prices 20 times a real copy's, so the bills read as round figures at the 2.5% share (DESIGN 4.10).
const prices = { RESOURCE_IRON: 20000, RESOURCE_WINE: 12000, RESOURCE_SALT: 4000 };
const world = (over = {}) => input({ civs: [civ(ME, { human: true, incomeCents: 3000, balanceCents: 100000,
  stages: OPEN_ALL, tradeIncomeCents: 900 }), civ(6, { incomeCents: 2000, balanceCents: 0, stages: OPEN_ALL,
  cities: [{ id: "6:1", build: "BUILDING_BANK", neededProgress: 50, roleBuilding: true },
    { id: "6:2", build: null, neededProgress: 0 }] }), civ(8, { incomeCents: 1000, stages: OPEN_ALL }),
  civ(9, { alive: false })],
markets: { ...emptyMarkets(), prices, history: { RESOURCE_IRON: [18000, 19000, 20000], RESOURCE_SALT: [4000] } },
routes: [{ importer: ME, exporter: 6, resources: ["RESOURCE_IRON", "RESOURCE_WINE"] },
  { importer: 6, exporter: ME, resources: ["RESOURCE_SALT"] }, { importer: 8, exporter: ME, resources: ["RESOURCE_IRON"] }],
market: { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" }], copies: { RESOURCE_IRON: 3 } },
relations: [{ a: ME, b: 6, level: "neutral" }, { a: ME, b: 8, level: "war" }], ...over });

test("the price list: dearest first, holders from the market read, the change over the history", () => {
  const rows = marketView(world());
  assert.deepEqual(rows.map((r) => [r.type, r.priceCents, r.holders, r.changeCents, r.class]), [
    ["RESOURCE_IRON", 20000, 3, 2000, "RESOURCECLASS_EMPIRE"], ["RESOURCE_WINE", 12000, 0, 0, null],
    ["RESOURCE_SALT", 4000, 0, 0, null]]);
  assert.deepEqual(marketView(input({})), []);
  const tie = marketView(input({ markets: { ...emptyMarkets(), prices: { B: 5, A: 5 } } }));
  assert.deepEqual(tie.map((r) => r.type), ["A", "B"]);
});

test("each partner's bill as the batch settles it: owed both ways, netted, capped, waived", () => {
  const view = tradeView(world(), ME);
  assert.deepEqual(view.rows, [
    { partner: 6, theyOweCents: 100, youOweCents: 800, payCents: 300, receiveCents: 0, waivedCents: 400 },
    { partner: 8, theyOweCents: 500, youOweCents: 0, payCents: 0, receiveCents: 100, waivedCents: 0 },
  ], "700 net to 6, capped at 300 (10% of 30 Gold); 8 pays its cap of 100 to you");
  assert.deepEqual([view.capCents, view.tradeIncomeCents, view.tariff, view.tariffsOn, view.stageOpen, view.on],
    [300, 900, "none", true, true, true]);
  const tariffed = tradeView(world({ markets: { ...emptyMarkets(), prices, tariffs: [{ pid: ME, level: "high",
    changedTurn: 1 }] } }), ME);
  assert.equal(tariffed.rows[0].youOweCents, 600);
  assert.equal(tariffed.tariff, "high");
  const off = tradeView(world({ options: { markets: false, tariffs: false } }), ME);
  assert.deepEqual([off.on, off.tariffsOn, off.rows[0].youOweCents], [false, false, 800]);
  const closed = tradeView(world({ civs: [civ(ME, { human: true, stages: {} })] }), ME);
  assert.deepEqual([closed.stageOpen, closed.rows, closed.tradeIncomeCents], [false, [], 0]);
});

test("a tribute paid shows on the Trade tab: the payer's bill to the levier at double (X.13, run 2026-11-04T14-35-06)", () => {
  // 6 levied tribute on ME; ME's 800 bill to 6 counts double, the batch's own term, where the tab used to show 800.
  const ledger = { ...emptyLedger(), legacies: [{ pid: 6, id: "tribute", since: 1, until: 99, nextAge: false,
    civs: [ME] }] };
  const view = tradeView(world({ ledger, turn: 5, options: { crises: true } }), ME);
  assert.equal(view.rows.find((r) => r.partner === 6).youOweCents, 1600);
  assert.equal(view.rows.find((r) => r.partner === 8).theyOweCents, 500, "the other partner's bill is unchanged");
});

test("the route preview prices what a new route would bring", () => {
  assert.deepEqual(routePreview([{ owner: 6, city: "6:3", resources: ["RESOURCE_IRON", "RESOURCE_SALT"] },
    { owner: 8, city: "8:1", resources: [] }], prices).map((r) => [r.city, r.billCents]), [["6:3", 600], ["8:1", 0]]);
});

test("a gift's forecast: the progress and Gold used, the return a turn and in all, the relationship", () => {
  const city = { id: "6:1", build: "BUILDING_BANK", neededProgress: 50, roleBuilding: true };
  assert.deepEqual(investForecast({ form: "project", cents: 30000, asAid: false, hostIncomeCents: 2000, city }),
    { spentCents: 15000, progress: 50, perTurnCents: 900, totalCents: 22500, relationship: 7, minimumCents: 2000 });
  assert.deepEqual(investForecast({ form: "general", cents: 30000, asAid: false, hostIncomeCents: 2000 }),
    { spentCents: 30000, progress: 0, perTurnCents: 1350, totalCents: 33750, relationship: 10, minimumCents: 3000 });
  assert.deepEqual(investForecast({ form: "general", cents: 30000, asAid: true, hostIncomeCents: 2000 }),
    { spentCents: 30000, progress: 0, perTurnCents: 0, totalCents: 0, relationship: 20, minimumCents: 1000 });
  assert.deepEqual(investForecast({ form: "general", cents: 30000, asAid: true, hostIncomeCents: 15000 }),
    { spentCents: 30000, progress: 0, perTurnCents: 0, totalCents: 0, relationship: 4, minimumCents: 7500 });
  assert.equal(investForecast({ form: "project", cents: 30000, asAid: false, hostIncomeCents: 2000 }).spentCents, 30000,
    "no city read: the whole amount");
});

test("the targets: every other living civ, refusals by kind, and only cities with a build that needs work", () => {
  const targets = investTargets(world(), ME, 30000);
  assert.deepEqual(targets.map((t) => [t.pid, t.level, t.general, t.aid, t.cities.map((c) => [c.city.id, c.refusal])]),
    [[6, "neutral", null, null, [["6:1", null]]], [8, "war", "relation", "relation", []]]);
  const broke = investTargets(world(), ME, 999999);
  assert.equal(broke[0].general, "balance");
  assert.equal(broke[0].cities[0].aidRefusal, "balance");
});

test("holdings: the open records the player holds or hosts, and the offers waiting for it", () => {
  const ledger = { ...emptyLedger(), investments: [
    makeInvestment({ id: "I1", kind: "general", investor: ME, host: 6, principal: 20000, turn: 3, baseIncome: 1 }),
    makeInvestment({ id: "I2", kind: "project", investor: 6, host: ME, principal: 10000, turn: 3, cityId: "2:1" }),
    { ...makeInvestment({ id: "I3", kind: "general", investor: ME, host: 6, principal: 100, turn: 3 }), state: "closed" },
    makeInvestment({ id: "I4", kind: "general", investor: 6, host: 8, principal: 100, turn: 3 })],
  offers: [{ id: "I5", investor: 6, host: ME, kind: "general", cents: 100, cityId: null, turn: 4 },
    { id: "I6", investor: 6, host: 8, kind: "general", cents: 100, cityId: null, turn: 4 }] };
  const view = investmentsView(input({ ledger }), ME);
  assert.deepEqual(view.open.map((r) => r.id), ["I1", "I2"]);
  assert.deepEqual(view.offers.map((o) => o.id), ["I5"]);
  assert.deepEqual([view.investedCents, view.owedCents], [22500, 12500]);
  assert.deepEqual(investmentsView(input({}), ME), { open: [], offers: [], investedCents: 0, owedCents: 0 });
});
