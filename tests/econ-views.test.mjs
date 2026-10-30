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

test.after(() => removeFakeDom());
