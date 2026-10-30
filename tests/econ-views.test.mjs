// The three tabs drawn against a fake DOM and a fake screen api: each renders, offers the actions DESIGN 5 names,
// and a click queues the request the model expects. Text is LOC keys joined with their arguments.
import test from "node:test";
import assert from "node:assert/strict";
import { byClass, installFakeDom, removeFakeDom, textOf } from "./_fake-dom.mjs";
import { civ, input } from "./_fixtures.mjs";
import { emptyLedger } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";

installFakeDom();
const { renderTreasury } = await import("../ui/econ-view-treasury.js");
const { renderLoans, resetConfirmForTests } = await import("../ui/econ-view-loans.js");
const { resetFormForTests } = await import("../ui/econ-view-borrow.js");
const { renderFiscal, verdictKey } = await import("../ui/econ-view-fiscal.js");
const { renderMarkets } = await import("../ui/econ-view-markets.js");
const { renderTrade } = await import("../ui/econ-view-trade.js");
const { emptyMarkets } = await import("../ui/econ-markets.js");
const { makeInvestment } = await import("../ui/econ-invest.js");
const { OPEN_ALL } = await import("./_fixtures.mjs");

const ME = 2;
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: 6, borrower: ME, principal: 3000, ratePpm: 30000,
  term: 10, turn: 40 }), ...over });

function makeApi(over = {}) {
  const requests = [];
  const state = { guard: true, swaps: [], cards: [] };
  const planInput = input({ civs: [civ(ME, { human: true, balanceCents: 20000, incomeCents: 8000 }), civ(6, { balanceCents: 1e6 }),
    civ(8, { incomeCents: 500 })], ledger: { ...emptyLedger(), loans: [loan("L1"), loan("L2", { missed: 1 })],
    events: [{ turn: 49, kind: "open", loanId: "L1", lender: 6, borrower: ME, cents: 3000 }], lastTurn: 49 },
  relations: [{ a: ME, b: 6, level: "neutral" }, { a: ME, b: 8, level: "unfriendly" }], ...over.planInput });
  delete over.planInput;
  return {
    me: ME, requests, state,
    input: () => planInput,
    loc: (key, ...args) => [key, ...args].join("|"),
    nameOf: (party) => (typeof party === "number" ? `Civ ${party}` : String(party)),
    request: (request) => { requests.push(request); return true; },
    dropRequest: (index) => { requests.splice(index, 1); return true; },
    pending: () => requests,
    setGuard: (on) => { state.guard = on; return on; },
    guardOn: () => state.guard,
    stageOpener: () => "LOC_CIVIC_ECONOMICS_NAME",
    depth: () => ({ buildings: [], depthTurns: 0, depthFactorPct: 100 }),
    cards: () => state.cards,
    fiscal: () => ({ goldCents: 2300, happinessCents: 800, netHappinessCents: 600, settlements: 2,
      celebrationLeftCents: 4000, celebrating: false, atWar: false }),
    swapTo: (type) => { state.swaps.push(type); return Promise.resolve("sent"); },
    canSwap: () => true,
    rerender: () => {},
    resourceName: (type) => `name:${type}`,
    buildName: (type) => `build:${type}`,
    cityName: (id) => `city:${id}`,
    possibleRoutes: () => [{ owner: 6, city: "6:3", resources: ["RESOURCE_IRON"] }, { owner: 8, city: "8:1", resources: [] }],
    turnLabel: (turn) => (turn > 40 ? turn - 40 : null),
    ...over,
  };
}

test("the Treasury tab shows the balance block, the projection, the flows and the buildings", () => {
  const api = makeApi();
  const host = document.createElement("div");
  renderTreasury(host, api);
  const text = textOf(host);
  for (const key of ["LOC_ECONOMICS_TREASURY_BALANCE", "LOC_ECONOMICS_TREASURY_PROJECTION", "LOC_ECONOMICS_TREASURY_FLOWS",
    "LOC_ECONOMICS_EVENT_OPEN|L1|30|Civ 6|Civ 2", "LOC_ECONOMICS_ROLE_BANKING"]) assert.ok(text.includes(key), key);
  assert.equal(byClass(host, "econ-bar-pair").length, 20);
});

test("the Loans tab lists the loans overdue first, queues repay, restructure and repudiation after a confirm, and switches the guard", () => {
  resetConfirmForTests();
  resetFormForTests();
  const api = makeApi();
  const host = document.createElement("div");
  renderLoans(host, api);
  const titles = byClass(host, "econ-card-title").map((n) => n.textContent);
  assert.ok(titles[0].startsWith("LOC_ECONOMICS_OFFER_ROW"), "offers come first");
  const loanTitles = titles.filter((t) => t.startsWith("LOC_ECONOMICS_LOAN_ROW"));
  assert.ok(loanTitles[0].includes("|L2|"), "the overdue loan leads");
  const buttons = byClass(host, "econ-button");
  const by = (prefix) => buttons.filter((b) => b.textContent.startsWith(prefix));
  by("LOC_ECONOMICS_LOANS_REPAY_ALL")[0].click();
  assert.deepEqual(api.requests.at(-1), { kind: "repay", loanId: "L2", cents: 3000 });
  by("LOC_ECONOMICS_LOANS_REPUDIATE_LENDER")[0].click();
  const again = document.createElement("div");
  renderLoans(again, api);
  assert.ok(textOf(again).includes("LOC_ECONOMICS_REPUDIATE_PREVIEW|60|Civ 6|"), "the preview shows before the confirm");
  byClass(again, "econ-button").find((b) => b.textContent === "LOC_ECONOMICS_CONFIRM").click();
  assert.deepEqual(api.requests.at(-1), { kind: "repudiate", borrower: ME, lender: 6 });
  const restructure = by("LOC_ECONOMICS_LOANS_RESTRUCTURE").find((b) => !b.classList.contains("econ-button--disabled"));
  restructure.click();
  const third = document.createElement("div");
  renderLoans(third, api);
  assert.ok(textOf(third).includes("LOC_ECONOMICS_RESTRUCTURE_PREVIEW"));
  byClass(third, "econ-button").find((b) => b.textContent === "LOC_ECONOMICS_CONFIRM").click();
  assert.deepEqual(api.requests.at(-1), { kind: "restructure", loanId: "L2", pid: ME });
  by("LOC_ECONOMICS_GUARD_SWITCH_OFF")[0].click();
  assert.equal(api.state.guard, false);
  const borrow = by("LOC_ECONOMICS_BORROW").find((b) => !b.classList.contains("econ-button--disabled"));
  borrow.click();
  assert.deepEqual(api.requests.at(-1), { kind: "borrow", borrower: ME, lender: 6, principal: 10000, term: 10 });
  const lend = by("LOC_ECONOMICS_LEND")[0];
  lend.click();
  assert.equal(api.requests.at(-1).kind, "lend");
  assert.equal(api.requests.at(-1).borrower, 6);
  assert.ok(textOf(third).includes("LOC_ECONOMICS_LOANS_PENDING"));
});

test("a borrow over a limit shows the most that lender would lend, and one click borrows that instead", () => {
  resetConfirmForTests();
  resetFormForTests();
  const api = makeApi({ planInput: { civs: [civ(ME, { human: true, balanceCents: 20000, incomeCents: 1000 }),
    civ(6, { balanceCents: 1e6 })], ledger: emptyLedger() } });
  const host = document.createElement("div");
  renderLoans(host, api);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_REASON_SERVICE_CAP"), "100 Gold's first payment is over half of 10");
  assert.ok(textOf(host).includes("LOC_ECONOMICS_BORROW_MOST|Civ 6|10|45"), "45 Gold from civ 6 over 10 turns");
  const instead = byClass(host, "econ-button").filter((b) => b.textContent === "LOC_ECONOMICS_BORROW_THAT");
  assert.equal(instead.length, 2, "one for each lender over the limit");
  instead[0].click();
  assert.deepEqual(api.requests.at(-1), { kind: "borrow", borrower: ME, lender: 6, principal: 4500, term: 10 });
  const spoken = makeApi({ planInput: { civs: [civ(ME, { human: true, balanceCents: 20000, incomeCents: 1000 }),
    civ(6, { balanceCents: 1e6 })], ledger: { ...emptyLedger(), loans: [makeLoan({ id: "L1", lender: 6, borrower: ME,
    principal: 4500, ratePpm: 10000, term: 10, turn: 40 })], nextId: 2 } } });
  const full = document.createElement("div");
  renderLoans(full, spoken);
  assert.ok(textOf(full).includes("LOC_ECONOMICS_BORROW_MOST_NONE|Civ 6|10"));
  assert.equal(byClass(full, "econ-button").some((b) => b.textContent === "LOC_ECONOMICS_BORROW_THAT"), false);
});

test("stages closed show the node that opens them; the Fiscal tab draws the cards and sends the swap", async () => {
  const closed = makeApi({ planInput: { civs: [civ(ME, { human: true, stages: { moneylending: null, publicDebt: null } })] } });
  const host = document.createElement("div");
  renderLoans(host, closed);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_LOANS_STAGE_CLOSED|LOC_ECONOMICS_PART_CIV_LOANS|LOC_CIVIC_ECONOMICS_NAME"));
  const api = makeApi();
  const empty = document.createElement("div");
  renderFiscal(empty, api);
  assert.ok(textOf(empty).includes("LOC_ECONOMICS_FISCAL_TAXES_OFF"));
  api.state.cards = [{ type: "TRADITION_ECONOMICS_LIGHT_EX", level: "LIGHT", hash: 1, index: 1, active: false, unlocked: true },
    { type: "TRADITION_ECONOMICS_HEAVY_EX", level: "HEAVY", hash: 2, index: 2, active: true, unlocked: true },
    { type: "TRADITION_ECONOMICS_WAR_LEVY_EX", level: "WAR_LEVY", hash: 3, index: 3, active: false, unlocked: false,
      opener: "LOC_TECH_CURRENCY_NAME" }];
  const full = document.createElement("div");
  renderFiscal(full, api);
  const text = textOf(full);
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_FORECAST_ROW|-12|+12"), "Light against Heavy on 2 settlements: -12 Gold, +12 Happiness");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_EFFECT_ROW|-2|+4"), "Light's flat amounts in each settlement");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS|3"), "the celebration under Light");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS|7"), "the celebration now, under Heavy");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_FORECAST_ROW|-8|+4"), "clearing Heavy");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_LEVY_PEACE"));
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_LOCKED_BY|LOC_TECH_CURRENCY_NAME"), "a locked card names what opens it");
  const slot = byClass(full, "econ-button").filter((b) => b.textContent === "LOC_ECONOMICS_FISCAL_SLOT");
  assert.equal(slot.length, 2);
  assert.ok(slot[1].classList.contains("econ-button--disabled"), "a locked card can't be slotted");
  slot[0].click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(api.state.swaps, ["TRADITION_ECONOMICS_LIGHT_EX"]);
  assert.equal(verdictKey("no-slot"), "LOC_ECONOMICS_FISCAL_VERDICT_NO_SLOT");
});


/** A 1.1 world: the player imports iron from 6 and wine goes back; 6 has a build to back. */
function commerceApi(over = {}) {
  // Prices 20 times a real copy's, so the bills read as round figures at the 2.5% share (DESIGN 4.10).
  const markets = { ...emptyMarkets(), prices: { RESOURCE_IRON: 20000, RESOURCE_WINE: 12000 },
    history: { RESOURCE_IRON: [16000, 18000, 20000], RESOURCE_WINE: [12000] } };
  const civs = [civ(ME, { human: true, balanceCents: 100000, incomeCents: 10000, stages: OPEN_ALL, tradeIncomeCents: 600 }),
    civ(6, { balanceCents: 1e6, incomeCents: 2000, stages: OPEN_ALL, cities: [{ id: "6:1", build: "BUILDING_LIBRARY",
      neededProgress: 40 }] })];
  const ledger = { ...emptyLedger(), offers: [{ id: "I5", investor: 6, host: ME, kind: "general", cents: 5000,
    cityId: null, turn: 49 }], investments: [makeInvestment({ id: "I2", kind: "general", investor: ME, host: 6,
    principal: 20000, turn: 40, baseIncome: 2000 })], nextInvestId: 6 };
  return makeApi({ planInput: { civs, markets, ledger, relations: [{ a: ME, b: 6, level: "neutral" }],
    routes: [{ importer: ME, exporter: 6, resources: ["RESOURCE_IRON"] }, { importer: 6, exporter: ME,
      resources: ["RESOURCE_WINE"] }], market: { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" }],
      copies: { RESOURCE_IRON: 2 }, strategic: [], industry: 0 }, ...over } });
}

test("the Markets tab lists prices dearest first, with holders, the change and the history bars", () => {
  const host = document.createElement("div");
  renderMarkets(host, commerceApi());
  const text = textOf(host);
  assert.ok(text.indexOf("name:RESOURCE_IRON") < text.indexOf("name:RESOURCE_WINE"), "dearest first");
  assert.ok(text.includes("LOC_ECONOMICS_MARKETS_ROW|2|+40|3"), "two copies held, up 40 Gold over three turns");
  assert.equal(byClass(host, "econ-spark").length, 1, "one history long enough to draw");
  const off = document.createElement("div");
  renderMarkets(off, commerceApi({ options: { markets: false } }));
  assert.ok(textOf(off).includes("LOC_ECONOMICS_MARKETS_OFF"));
  const none = document.createElement("div");
  renderMarkets(none, makeApi());
  assert.ok(textOf(none).includes("LOC_ECONOMICS_MARKETS_NONE"));
});

test("the Trade tab: this turn's bill per partner, offers to answer, investments to make, the route preview", () => {
  const api = commerceApi();
  const host = document.createElement("div");
  renderTrade(host, api);
  const text = textOf(host);
  assert.ok(text.includes("LOC_ECONOMICS_TRADE_INCOME | LOC_ECONOMICS_GOLD_AMOUNT|6"), "the game's own Trade Income");
  assert.ok(text.includes("LOC_ECONOMICS_TRADE_PAY | LOC_ECONOMICS_GOLD_AMOUNT|2"), "500 owed against 300: pay 200");
  assert.ok(text.includes("LOC_ECONOMICS_OFFER_GENERAL_ROW|Civ 6|50"));
  assert.ok(text.includes("LOC_ECONOMICS_INVEST_PROJECT|build:BUILDING_LIBRARY|city:6:1"));
  assert.ok(text.includes("LOC_ECONOMICS_INVEST_PROJECT_FORECAST|40|120|6|150|1"),
    "300 Gold offered, 40 points used: 120 Gold, 6 a turn back");
  assert.ok(text.includes("LOC_ECONOMICS_TRADE_PREVIEW_ROW|city:6:3|Civ 6|1"), "the empty route is left out");
  assert.ok(text.includes("LOC_ECONOMICS_HOLDING_OUT|I2|Civ 6|225|25"));
  const accept = byClass(host, "econ-button").find((b) => b.textContent === "LOC_ECONOMICS_OFFER_ACCEPT");
  accept.click();
  const project = byClass(host, "econ-button").find((b) => b.textContent.startsWith("LOC_ECONOMICS_INVEST_PROJECT"));
  project.click();
  assert.deepEqual(api.requests, [{ kind: "accept-offer", offerId: "I5" }, { kind: "invest", investor: ME, host: 6,
    form: "project", cents: 30000, cityId: "6:1", asAid: false }]);
  const war = document.createElement("div");
  renderTrade(war, commerceApi({ relations: [{ a: ME, b: 6, level: "war" }] }));
  assert.ok(textOf(war).includes("LOC_ECONOMICS_REASON_RELATION"), "a refused action says why");
  const unread = document.createElement("div");
  renderTrade(unread, { ...commerceApi(), possibleRoutes: () => null });
  assert.ok(textOf(unread).includes("LOC_ECONOMICS_TRADE_PREVIEW_UNREAD"));
  const off = document.createElement("div");
  renderTrade(off, commerceApi({ options: { markets: false, investment: false } }));
  assert.ok(textOf(off).includes("LOC_ECONOMICS_MARKETS_OFF") && textOf(off).includes("LOC_ECONOMICS_INVEST_OFF"));
});

test("the Fiscal tab's tariff row: the choice once the stage opens, the wait after a change, hidden when off", () => {
  const api = commerceApi();
  const host = document.createElement("div");
  renderFiscal(host, api);
  const chip = byClass(host, "econ-chip").find((c) => c.textContent === "LOC_ECONOMICS_TARIFF_HIGH");
  chip.click();
  assert.deepEqual(api.requests, [{ kind: "tariff", pid: ME, level: "high" }]);
  const waiting = document.createElement("div");
  const markets = { ...emptyMarkets(), tariffs: [{ pid: ME, level: "low", changedTurn: 48 }] };
  renderFiscal(waiting, commerceApi({ markets }));
  assert.ok(textOf(waiting).includes("LOC_ECONOMICS_TARIFF_NOW | LOC_ECONOMICS_TARIFF_LOW"));
  assert.ok(textOf(waiting).includes("LOC_ECONOMICS_TARIFF_WAIT"));
  const closed = document.createElement("div");
  renderFiscal(closed, makeApi());
  assert.ok(textOf(closed).includes("LOC_ECONOMICS_TARIFF_STAGE"), "no Tariffs stage yet");
  const off = document.createElement("div");
  renderFiscal(off, commerceApi({ options: { tariffs: false } }));
  assert.equal(textOf(off).includes("LOC_ECONOMICS_TARIFF"), false);
});

test.after(() => removeFakeDom());

test("the Fiscal tab says 'next turn' for one turn and 'one more turn' for the last of a system's blend", () => {
  const api = makeApi({ fiscal: () => ({ goldCents: 2300, happinessCents: 800, netHappinessCents: 600, settlements: 2,
    celebrationLeftCents: 500, celebrating: false, atWar: false }) });
  api.state.cards = [{ type: "TRADITION_ECONOMICS_LIGHT_EX", level: "LIGHT", hash: 1, index: 1, active: false,
    unlocked: true }];
  const host = document.createElement("div");
  renderFiscal(host, api);
  const text = textOf(host);
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURN|1"), text);
  assert.equal(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS|1"), false);
});
