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
  const api = makeApi({ stageTurns: () => ({ coinage: 0 }) });
  const host = document.createElement("div");
  renderTreasury(host, api);
  const text = textOf(host);
  for (const key of ["LOC_ECONOMICS_TREASURY_BALANCE", "LOC_ECONOMICS_TREASURY_PROJECTION", "LOC_ECONOMICS_TREASURY_FLOWS",
    "LOC_ECONOMICS_EVENT_OPEN|L1|30|Civ 6|Civ 2", "LOC_ECONOMICS_ROLE_BANKING"]) assert.ok(text.includes(key), key);
  assert.equal(byClass(host, "econ-chart-hit").length, 20, "a hover column per projected turn");
  assert.equal(byClass(host, "econ-meter").length, 1, "the debt-service scale");
  assert.equal(byClass(host, "econ-gauge").length, 0, "the cycle's dial only with the cycle on");
  assert.equal(text.includes("LOC_ECONOMICS_GUARD_STATE"), false, "the guard lives on the Loans tab once it's open");
});

test("before Coinage the Treasury tab leaves out financial depth and says what opens next", () => {
  const api = makeApi({ planInput: { age: "AGE_ANTIQUITY", civs: [civ(ME, { human: true, stages: { moneylending: null,
    publicDebt: null } }), civ(6)], ledger: emptyLedger() } });
  const host = document.createElement("div");
  renderTreasury(host, api);
  const text = textOf(host);
  assert.equal(text.includes("LOC_ECONOMICS_ROLE_BANKING"), false, "no depth before Coinage");
  assert.equal(text.includes("LOC_ECONOMICS_TREASURY_OLD"), false, "no old buildings in the first age");
  assert.ok(text.includes("LOC_ECONOMICS_GUARD_STATE"), "the guard switch is here until the Loans tab opens");
  assert.ok(text.includes("LOC_ECONOMICS_OPENS_NEXT|LOC_ECONOMICS_PART_TAB_TRADE|LOC_CIVIC_ECONOMICS_NAME"));
});

/** Renders the Loans tab again (the fake api's rerender draws nothing) and clicks the open confirmation's first button. */
function confirmOn(api) {
  const host = document.createElement("div");
  renderLoans(host, api);
  const card = byClass(host, "econ-confirm")[0];
  assert.ok(card, "a confirmation is open");
  byClass(card, "econ-button")[0].click();
  return { host, card };
}

test("the Loans tab lists the loans overdue first, queues repay, restructure and repudiation after a confirm, and switches the guard", () => {
  resetConfirmForTests();
  resetFormForTests();
  const api = makeApi();
  const host = document.createElement("div");
  renderLoans(host, api);
  const titles = byClass(host, "econ-card-title").map((n) => n.textContent);
  assert.equal(titles[0], "Civ 6", "the borrow form's offers come first");
  const subs = byClass(host, "econ-card-sub").map((n) => n.textContent).filter((t) => t.startsWith("LOC_ECONOMICS_LOAN_SUB"));
  assert.ok(subs[0].includes("|L2|"), "the overdue loan leads");
  const buttons = byClass(host, "econ-button");
  const by = (prefix) => buttons.filter((b) => b.textContent.startsWith(prefix));
  by("LOC_ECONOMICS_LOANS_REPAY_ALL")[0].click();
  assert.equal(api.requests.length, 0, "a repay opens its confirmation first");
  const repay = confirmOn(api);
  assert.ok(textOf(repay.card).includes("LOC_ECONOMICS_CHANGE_TREASURY | 200 | → | 170"), "the treasury now and after");
  assert.ok(textOf(repay.card).includes("LOC_ECONOMICS_LOAN_OWED | 30 | → | 0"), "the loan now and after");
  assert.deepEqual(api.requests.at(-1), { kind: "repay", loanId: "L2", cents: 3000 });
  by("LOC_ECONOMICS_LOANS_REPUDIATE_LENDER")[0].click();
  const again = confirmOn(api);
  assert.ok(textOf(again.card).includes("LOC_ECONOMICS_REPUDIATE_PREVIEW|60|Civ 6|"), "the preview shows before the confirm");
  assert.deepEqual(api.requests.at(-1), { kind: "repudiate", borrower: ME, lender: 6 });
  const restructure = by("LOC_ECONOMICS_LOANS_RESTRUCTURE").find((b) => !b.classList.contains("econ-button--disabled"));
  assert.ok(textOf(host).includes("LOC_ECONOMICS_RESTRUCTURE_WHY_ON_TIME"), "the loan on time says why it can't");
  restructure.click();
  const third = confirmOn(api);
  assert.ok(textOf(third.card).includes("LOC_ECONOMICS_RESTRUCTURE_PREVIEW"));
  assert.deepEqual(api.requests.at(-1), { kind: "restructure", loanId: "L2", pid: ME });
  by("LOC_ECONOMICS_GUARD_SWITCH_OFF")[0].click();
  assert.equal(api.state.guard, false);
  const borrow = by("LOC_ECONOMICS_BORROW").find((b) => !b.classList.contains("econ-button--disabled"));
  borrow.click();
  const borrowed = confirmOn(api);
  for (const piece of ["LOC_ECONOMICS_CHANGE_TREASURY", "LOC_ECONOMICS_CHANGE_DEBT | 60 | →",
    "LOC_ECONOMICS_CHANGE_PAYMENTS|10", "LOC_ECONOMICS_OFFER_SHARE"]) {
    assert.ok(textOf(borrowed.card).includes(piece), `${piece}: now and after, before the click`);
  }
  assert.ok(textOf(borrowed.host).length > 0);
  const sent = api.requests.at(-1);
  assert.deepEqual([sent.kind, sent.lender, sent.term], ["borrow", 6, 10], "the shortest term");
  assert.ok(sent.principal >= 1000, "filled in with the most the limits allow");
  by("LOC_ECONOMICS_LEND")[0].click();
  confirmOn(api);
  assert.equal(api.requests.at(-1).kind, "lend");
  assert.equal(api.requests.at(-1).borrower, 6);
  assert.ok(textOf(third.host).includes("LOC_ECONOMICS_LOANS_PENDING"));
});

test("the borrow form opens on the largest loan the limits allow", () => {
  resetConfirmForTests();
  resetFormForTests();
  const api = makeApi({ planInput: { civs: [civ(ME, { human: true, balanceCents: 20000, incomeCents: 1000 }),
    civ(6, { balanceCents: 1e6 })], ledger: emptyLedger() } });
  const host = document.createElement("div");
  renderLoans(host, api);
  assert.equal(textOf(host).includes("LOC_ECONOMICS_REASON_SERVICE_CAP"), false, "nobody refuses the amount it opens on");
  assert.ok(byClass(host, "econ-stepper-value")[0].textContent.includes("40"), "40 Gold: the most, in whole tens");
});

test("a borrow over a limit shows the most that lender would lend, and one click borrows that instead", () => {
  resetConfirmForTests();
  resetFormForTests(10000);
  const api = makeApi({ planInput: { civs: [civ(ME, { human: true, balanceCents: 20000, incomeCents: 1000 }),
    civ(6, { balanceCents: 1e6 })], ledger: emptyLedger() } });
  const host = document.createElement("div");
  renderLoans(host, api);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_REASON_SERVICE_CAP"), "100 Gold's first payment is over half of 10");
  assert.ok(textOf(host).includes("LOC_ECONOMICS_BORROW_MOST|Civ 6|10|45"), "45 Gold from civ 6 over 10 turns");
  const instead = byClass(host, "econ-button").filter((b) => b.textContent === "LOC_ECONOMICS_BORROW_THAT");
  assert.equal(instead.length, 2, "one for each lender over the limit");
  instead[0].click();
  confirmOn(api);
  assert.deepEqual(api.requests.at(-1), { kind: "borrow", borrower: ME, lender: 6, principal: 4500, term: 10 });
  resetFormForTests(10000);
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
  assert.ok(textOf(host).includes("LOC_ECONOMICS_OPENS_NEXT|LOC_ECONOMICS_PART_CIV_LOANS|LOC_CIVIC_ECONOMICS_NAME"));
  assert.equal(textOf(host).includes("LOC_ECONOMICS_BORROW"), false, "no borrow form before Moneylending");
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
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_FORECAST_GOLD | -10 | LOC_ECONOMICS_FISCAL_FORECAST_HAPPINESS | +12"),
    "Exploration's Light (+4) against Heavy on 2 settlements: -10 Gold, +12 Happiness");
  assert.ok(byClass(full, "econ-facts").some((n) => n.getAttribute("data-tooltip-content") === "LOC_ECONOMICS_FISCAL_EFFECT_ROW|-1|+4"),
    "Light's flat amounts in each settlement, Exploration's");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS|3"), "the celebration under Light");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS|7"), "the celebration now, under Heavy");
  assert.ok(text.includes("LOC_ECONOMICS_FISCAL_FORECAST_GOLD | -8 | LOC_ECONOMICS_FISCAL_FORECAST_HAPPINESS | +4"),
    "clearing Heavy");
  assert.equal(text.includes("LOC_ECONOMICS_FISCAL_EFFECT_AT_WAR"), false, "a locked card isn't drawn");
  assert.ok(text.includes("LOC_ECONOMICS_OPENS_NEXT|LOC_ECONOMICS_PART_CARD|LOC_ECONOMICS_CARD_WAR_LEVY_NAME"
    + "|LOC_TECH_CURRENCY_NAME"), "the locked card is the next part, with what opens it");
  api.state.cards[2].unlocked = true;
  const open = document.createElement("div");
  renderFiscal(open, api);
  const all = textOf(open);
  const effects = byClass(open, "econ-facts").map((n) => n.getAttribute("data-tooltip-content"));
  assert.ok(effects.includes("LOC_ECONOMICS_FISCAL_EFFECT_ROW|+2|-1"), "War Levy's peacetime part");
  assert.ok(all.includes("LOC_ECONOMICS_FISCAL_EFFECT_AT_WAR"), "and a line for war");
  assert.ok(effects.includes("LOC_ECONOMICS_FISCAL_EFFECT_ROW|+8|-4"), "War Levy's amounts at war, both parts");
  const slot = byClass(full, "econ-button").filter((b) => b.textContent === "LOC_ECONOMICS_FISCAL_SLOT");
  assert.equal(slot.length, 1, "only the unlocked card that isn't slotted");
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
  assert.ok(text.includes("name:RESOURCE_IRON | 200 | 2 | +40"), "price, two copies held, up 40 Gold");
  assert.ok(byClass(host, "econ-price-cell").some((n) => n.getAttribute("data-tooltip-content")
    === "LOC_ECONOMICS_MARKETS_ROW|2|+40|3"), "the change's tooltip says over how many turns");
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
  assert.ok(text.includes("LOC_ECONOMICS_TRADE_INCOME | 6"), "the game's own Trade Income");
  assert.ok(text.includes("LOC_ECONOMICS_TRADE_PAY | 2"), "500 owed against 300: pay 200");
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
  const asked = document.createElement("div");
  renderTrade(asked, api);
  const card = byClass(asked, "econ-confirm")[0];
  assert.ok(textOf(card).includes("LOC_ECONOMICS_INVEST_YOU_SEND"), "the confirmation says what goes out");
  byClass(card, "econ-button")[0].click();
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
  assert.equal(textOf(closed).includes("LOC_ECONOMICS_TARIFF_NOW"), false, "no tariff row before the Tariffs stage");
  assert.ok(textOf(closed).includes("LOC_ECONOMICS_OPENS_NEXT|LOC_ECONOMICS_PART_TARIFFS"), "it opens next");
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

test("a host in default: general investment shows why, and a button opens its development loan with the same Gold", () => {
  const inDefault = { ...emptyLedger(), nextId: 2, loans: [{ ...makeLoan({ id: "L1", lender: "bond", borrower: 6,
    principal: 100, ratePpm: 20000, term: 10, turn: 1 }), state: "default", missed: 3 }] };
  const api = commerceApi({ ledger: inDefault });
  const host = document.createElement("div");
  renderTrade(host, api);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_REASON_HOST_DEFAULT"));
  const instead = byClass(host, "econ-button").find((b) => b.textContent === "LOC_ECONOMICS_INVEST_PROJECT_INSTEAD");
  const before = api.requests.length;
  instead.click();
  assert.equal(api.requests.length, before, "opening the form sends nothing");
  const open = document.createElement("div");
  renderTrade(open, api);
  assert.ok(textOf(open).includes("LOC_ECONOMICS_INVEST_PROJECT_FOR|Civ 6|300"));
  const pick = byClass(open, "econ-button").find((b) => b.textContent.startsWith("LOC_ECONOMICS_INVEST_PROJECT|"));
  pick.click();
  const asked = document.createElement("div");
  renderTrade(asked, api);
  byClass(byClass(asked, "econ-confirm")[0], "econ-button")[0].click();
  assert.deepEqual(api.requests.at(-1), { kind: "invest", investor: ME, host: 6, form: "project", cents: 30000,
    cityId: "6:1", asAid: false });
  byClass(open, "econ-button").find((b) => b.textContent === "LOC_ECONOMICS_CLOSE").click();
  const closed = document.createElement("div");
  renderTrade(closed, api);
  assert.equal(textOf(closed).includes("LOC_ECONOMICS_INVEST_PROJECT_FOR|"), false);
});

test("the summary strip: treasury, income, what Economics moved, debt with this turn's payments, waiting requests", async () => {
  const { renderSummary, renderSubtitle } = await import("../ui/econ-view-summary.js");
  const api = makeApi();
  api.requests.push({ kind: "repay", loanId: "L1", cents: 100 });
  const host = document.createElement("div");
  renderSummary(host, api);
  const text = textOf(host);
  for (const piece of ["LOC_ECONOMICS_SUMMARY_TREASURY | 200", "LOC_ECONOMICS_SUMMARY_INCOME | +80",
    "LOC_ECONOMICS_SUMMARY_DEBT | 60", "LOC_ECONOMICS_SUMMARY_WAITING | 1"]) assert.ok(text.includes(piece), piece);
  assert.ok(byClass(host, "econ-positive").length >= 1, "income in the game's green");
  const sub = document.createElement("div");
  renderSubtitle(sub, makeApi({ planInput: { options: { systems: true, cycle: "standard" } } }));
  assert.ok(textOf(sub).includes("LOC_ECONOMICS_SUMMARY_SYSTEM|LOC_ECONOMICS_SYSTEM_MIXED"));
});

test("a gauge's needle turns from the low end to its reading; a line chart has a hover column per turn", async () => {
  const { gauge, lineChart, resetDomStateForTests } = await import("../ui/econ-dom.js");
  resetDomStateForTests();
  const low = gauge("a", 0, { title: "t", reading: "0%" });
  const high = gauge("b", 1.4, { title: "t", reading: "140%" });
  const needle = (node) => byClass(node, "econ-gauge-needle")[0];
  assert.equal(needle(low).getAttribute("data-degrees"), "-90");
  assert.equal(needle(high).getAttribute("data-degrees"), "90", "past the scale stops at its end");
  assert.equal(needle(low).style.transform, "rotate(-90deg)", "drawn without frames: at its reading at once");
  const again = gauge("b", 1, { title: "t", reading: "100%" });
  assert.equal(needle(again).style.transform, "rotate(90deg)", "a re-render draws it in place, without a new sweep");
  const turns = ["t0", "t1", "t2"];
  const chart = lineChart([{ values: [1, 3, 2], label: "A" }, { values: [NaN, 2, Infinity], label: "B" }],
    { format: String, reference: 0, turns });
  const hits = byClass(chart, "econ-chart-hit");
  assert.equal(hits.length, 3);
  assert.equal(hits[1].getAttribute("data-tooltip-content"), "t1: A 3, B 2");
  assert.equal(hits[0].getAttribute("data-tooltip-content"), "t0: A 1", "a figure that isn't finite is left out");
  assert.equal(byClass(chart, "econ-chart-readout")[0].textContent, "t2: A 2", "the last turn until one is pointed at");
  assert.equal(byClass(chart, "econ-legend-item").length, 2);
  const none = lineChart([{ values: [] }], { format: String, turns: [], emptyText: "nothing yet" });
  assert.equal(textOf(none), "nothing yet");
  const flat = lineChart([{ values: [5, 5] }], { format: String, turns: ["a", "b"] });
  assert.equal(byClass(flat, "econ-chart-axis")[0].children.map((n) => n.textContent).join(","), "6,4",
    "a flat series gets a band around it");
});

test("what Economics moved, by kind of flow, for the Treasury tab's breakdown", async () => {
  const { flowBreakdown } = await import("../ui/econ-notice-text.js");
  const rows = flowBreakdown([{ from: 6, to: ME, cents: 500, reason: "principal" }, { from: ME, to: 6, cents: 120,
    reason: "payment" }, { from: "cycle", to: ME, cents: 80, reason: "cycle" }, { from: 8, to: 6, cents: 999,
    reason: "trade" }, { from: ME, to: "x", cents: 5, reason: "mystery" }], ME);
  assert.deepEqual(rows, [{ key: "LOC_ECONOMICS_FLOW_LABEL_LOANS", cents: 380 },
    { key: "LOC_ECONOMICS_FLOW_LABEL_CYCLE", cents: 80 }, { key: "LOC_ECONOMICS_FLOW_LABEL_OTHER", cents: -5 }]);
});

test("the stepper moves its figure at once, stops at its ends, and a double press runs once", async () => {
  const { goldStepper, button } = await import("../ui/econ-dom.js");
  const seen = [];
  const node = goldStepper({ value: 2000, min: 1000, max: 12000, format: (c) => String(c / 100), onChange: (c) => seen.push(c) });
  const steps = byClass(node, "econ-step");
  steps[1].click();
  assert.equal(byClass(node, "econ-amount-value")[0].textContent, "10", "the shown amount follows the press");
  steps[1].click();
  assert.deepEqual(seen, [1000], "at the least, the minus step does nothing");
  assert.ok(steps[0].classList.contains("econ-step--off") && steps[1].classList.contains("econ-step--off"));
  let runs = 0;
  const b = button("Go", () => { runs += 1; });
  b.click();
  b.click();
  assert.equal(runs, 1, "a second press in the same moment is dropped");
});

test("a request says it was sent beside its control, and says so when the list is full", async () => {
  resetConfirmForTests();
  resetFormForTests(1000);
  const { send } = await import("../ui/econ-view-common.js");
  const { feedbackLine } = await import("../ui/econ-dom.js");
  const api = makeApi();
  send(api, { kind: "repay", loanId: "L1", cents: 100 }, "loan:L1");
  assert.equal(feedbackLine("top"), null, "the line belongs beside the loan, not the top of the tab");
  assert.ok(feedbackLine("loan:L1"), "and it stays through the redraws that follow");
  const host = document.createElement("div");
  renderLoans(host, api);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_SENT|LOC_ECONOMICS_REQUEST_REPAY"));
  const full = makeApi({ request: () => false });
  send(full, { kind: "repay", loanId: "L1", cents: 100 }, "x");
  const line = feedbackLine("x");
  assert.ok(line.textContent.startsWith("LOC_ECONOMICS_SENT_FAILED") && line.classList.contains("econ-feedback--failed"));
});

test("the Spoil Guard: a hidden civ is left off the Trade tab and the lending list, and the subtitle says how many", async () => {
  const { renderSubtitle } = await import("../ui/econ-view-summary.js");
  const shown = document.createElement("div");
  renderTrade(shown, commerceApi());
  assert.ok(textOf(shown).includes("LOC_ECONOMICS_INVEST_GENERAL"), "civ 6 is a target while it shows");
  const hidden = document.createElement("div");
  renderTrade(hidden, { ...commerceApi(), hidden: (pid) => pid === 6 });
  assert.equal(textOf(hidden).includes("LOC_ECONOMICS_INVEST_GENERAL"), false, "no target card for a hidden civ");
  const loans = document.createElement("div");
  renderLoans(loans, makeApi({ hidden: (pid) => pid === 8, stageTurns: () => ({ coinage: 0 }),
    planInput: { civs: [civ(ME, { human: true, stages: OPEN_ALL }), civ(6), civ(8)] } }));
  const chips = byClass(loans, "econ-chip").map((node) => node.textContent);
  assert.ok(chips.includes("Civ 6") && !chips.includes("Civ 8"), `lend chips: ${chips}`);
  const sub = document.createElement("div");
  renderSubtitle(sub, makeApi({ hidden: (pid) => pid === 8 }));
  assert.ok(textOf(sub).includes("LOC_ECONOMICS_SPOIL_PILL|1"));
  const none = document.createElement("div");
  renderSubtitle(none, makeApi());
  assert.equal(textOf(none).includes("LOC_ECONOMICS_SPOIL_PILL"), false, "no pill when nothing is hidden");
});
