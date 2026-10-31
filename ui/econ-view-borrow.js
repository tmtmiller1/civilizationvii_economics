// econ-view-borrow.js - Economics: the Borrow and Lend forms of the Loans tab (DESIGN 5). Borrow opens filled in with
// the largest loan your limits allow over the shortest term; each lender's offer shows on its face the rate, the
// payment a turn, the interest in all, the share of income your payments would take and your income after it, and a
// lender that would refuse says why, with the most it would lend and one button to take that instead. The model's own
// offer and limit functions answer, so the form can't promise what the batch won't do. Lend: pick an AI, the
// principal, rate and term, and see what it would pay back and how close it is to the AI repudiation rule.

import { amount, button, changeRow, chips, confirmCard, el, empty, facts, feedbackLine, goldStepper, isConfirming,
  note, row, section, setConfirming, stat } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { borrowerRisk, loanOffers, termsOpen } from "./econ-view-model.js";
import { bondRatePpm } from "./econ-lenders.js";
import { standingPct } from "./econ-credit.js";
import { ratesPct } from "./econ-params.js";
import { reasonKey } from "./econ-notice-text.js";
import { emptyLedger } from "./econ-state.js";
import { firstPayment, totalInterest } from "./econ-loan.js";
import { send } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

const MIN_PRINCIPAL = 1000;
const MAX_PRINCIPAL = 10000000;
/** @typedef {{ principal: number, term: number, income: number, balance: number, debt: number, service: number }} Ask
 * the amount asked, and the treasury, debt and payments a turn now, for the confirmation */

/** Form state kept across re-renders; `principal` null until the player sets one, so it follows the limits. */
const form = { principal: /** @type {number | null} */ (null), term: /** @type {number | null} */ (null),
  lendTo: /** @type {number | null} */ (null), lendPrincipal: 10000, lendRatePct: 100, lendTerm: 10 };
const RATE_CHOICES = [80, 100, 120];

/** @param {ScreenApi} api @param {number} cents @param {number} [tone] */
const gold = (api, cents, tone = 0) => amount(formatGold(cents), { tone,
  tooltip: api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents)) });

/**
 * The largest loan the player's limits allow over `term`: the credit room, or less where every lender's payment limit
 * stops short of it (the most the best of them would lend).
 * @param {PlanInput} input
 * @param {number} me
 * @param {number} roomCents
 * @param {number} term
 */
export function largestLoan(input, me, roomCents, term) {
  /** Whether some lender would take this amount as it stands. @param {number} cents */
  const takes = (cents) => loanOffers(input, me, cents, term).some((offer) => !offer.refusal);
  let low = 0;
  let high = Math.max(1, Math.floor(roomCents / 1000));
  // In tens of Gold: the largest amount up to the credit room that some lender takes, by halving.
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (takes(mid * 1000)) low = mid;
    else high = mid - 1;
  }
  return Math.max(MIN_PRINCIPAL, low * 1000);
}

/**
 * @param {PlanInput} input
 * @param {ReturnType<typeof import("./econ-view-model.js").loansView>} view
 * @param {ScreenApi} api
 */
export function renderBorrow(input, view, api) {
  const terms = termsOpen(input, api.me);
  const term = form.term !== null && terms.includes(form.term) ? form.term : terms[0] || 10;
  const principal = form.principal ?? largestLoan(input, api.me, view.creditRoomCents, term);
  const block = section(api.loc("LOC_ECONOMICS_BORROW"), [], { subtitle: api.loc("LOC_ECONOMICS_BORROW_SUB") });
  block.appendChild(field(api.loc("LOC_ECONOMICS_PRINCIPAL"), goldStepper({ value: principal, min: MIN_PRINCIPAL,
    max: MAX_PRINCIPAL, format: formatGold, onChange: (cents) => { form.principal = cents; api.rerender(); } })));
  block.appendChild(field(api.loc("LOC_ECONOMICS_TERM"), chips(terms.map((t) => ({ id: String(t),
    label: api.loc("LOC_ECONOMICS_TURNS", t) })), String(term), (id) => { form.term = Number(id); api.rerender(); })));
  for (const node of offerCards(input, view, { principal, term }, api)) block.appendChild(node);
  return block;
}

/**
 * The line after a borrow, then each lender's offer for the amount and term, then the credit limit's note.
 * @param {PlanInput} input
 * @param {ReturnType<typeof import("./econ-view-model.js").loansView>} view
 * @param {{ principal: number, term: number }} asked
 * @param {ScreenApi} api
 */
function offerCards(input, view, { principal, term }, api) {
  const me = input.civs.find((civ) => civ.id === api.me);
  const now = { income: me?.incomeCents ?? 0, balance: me?.balanceCents ?? 0,
    debt: view.mine.reduce((sum, loan) => sum + loan.outstanding, 0), service: view.serviceCents };
  const offers = loanOffers(input, api.me, principal, term);
  const said = feedbackLine("borrow");
  /** @type {HTMLElement[]} */
  const out = said ? [said] : [];
  if (!offers.length) out.push(empty(api.loc("LOC_ECONOMICS_BORROW_NO_OFFERS")));
  for (const offer of offers) out.push(offerCard(offer, { principal, term, ...now }, api));
  if (view.creditRoomCents < principal) out.push(note(api.loc("LOC_ECONOMICS_BORROW_OVER_ROOM")));
  return out;
}

/**
 * A labelled control line.
 * @param {string} label
 * @param {HTMLElement} control
 */
function field(label, control) {
  const node = el("div", "econ-field");
  node.appendChild(el("div", "econ-field-label font-title uppercase", label));
  node.appendChild(control);
  return node;
}

/**
 * One lender's offer, its costs on its face.
 * @param {ReturnType<typeof loanOffers>[number]} offer
 * @param {Ask} ask
 * @param {ScreenApi} api
 */
function offerCard(offer, ask, api) {
  const card = el("div", `econ-card${offer.refusal ? " econ-card--muted" : ""}`);
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.nameOf(offer.lender)));
  head.appendChild(el("div", "econ-card-sub", api.loc("LOC_ECONOMICS_OFFER_RATE", formatRate(offer.ratePpm))));
  card.appendChild(head);
  const after = ask.income - offer.paymentCents;
  card.appendChild(facts([
    stat(api.loc("LOC_ECONOMICS_OFFER_PAYMENT"), gold(api, offer.paymentCents)),
    stat(api.loc("LOC_ECONOMICS_OFFER_INTEREST"), gold(api, offer.interestCents)),
    stat(api.loc("LOC_ECONOMICS_OFFER_SHARE"), `${offer.servicePctAfter}%`),
    stat(api.loc("LOC_ECONOMICS_OFFER_INCOME_AFTER"), gold(api, after, after < 0 ? -1 : 0)),
  ]));
  const id = `borrow:${offer.lender}`;
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc("LOC_ECONOMICS_BORROW"), () => { setConfirming(id); api.rerender(); },
    { disabled: !!offer.refusal, reason: offer.refusal ? api.loc(reasonKey(offer.refusal)) : null }));
  card.appendChild(actions);
  if (offer.mostCents !== null && offer.mostCents !== undefined) card.appendChild(mostRow(offer, ask.term, api));
  if (isConfirming(id)) {
    card.appendChild(borrowConfirm(offer, { ...ask, principal: ask.principal, payment: offer.paymentCents,
      interest: offer.interestCents }, api));
  }
  if (isConfirming(`${id}:most`) && offer.mostCents) {
    card.appendChild(borrowConfirm(offer, { ...ask, principal: offer.mostCents,
      payment: firstPayment(offer.mostCents, offer.ratePpm, ask.term),
      interest: totalInterest(offer.mostCents, offer.ratePpm, ask.term) }, api));
  }
  return card;
}

/**
 * Borrowing, confirmed: now against after for the treasury, the debt, the payments a turn and the share of income
 * they take, then the interest in all; all from the model's own payment and limit functions.
 * @param {ReturnType<typeof loanOffers>[number]} offer
 * @param {Ask & { payment: number, interest: number }} q
 * @param {ScreenApi} api
 */
function borrowConfirm(offer, q, api) {
  const share = (/** @type {number} */ cents) => `${q.income > 0 ? Math.round((100 * cents) / q.income) : 100}%`;
  return confirmCard({ title: api.loc("LOC_ECONOMICS_BORROW_FROM", api.nameOf(offer.lender)),
    lines: [changeRow(api.loc("LOC_ECONOMICS_CHANGE_TREASURY"), formatGold(q.balance), formatGold(q.balance + q.principal), 1),
      changeRow(api.loc("LOC_ECONOMICS_CHANGE_DEBT"), formatGold(q.debt), formatGold(q.debt + q.principal), -1),
      changeRow(api.loc("LOC_ECONOMICS_CHANGE_PAYMENTS", q.term), formatGold(q.service),
        formatGold(q.service + q.payment), -1),
      changeRow(api.loc("LOC_ECONOMICS_OFFER_SHARE"), share(q.service), share(q.service + q.payment)),
      row(api.loc("LOC_ECONOMICS_OFFER_INTEREST"), gold(api, q.interest)),
      note(api.loc("LOC_ECONOMICS_BORROW_NOTE"))],
    confirm: api.loc("LOC_ECONOMICS_BORROW"), cancel: api.loc("LOC_ECONOMICS_CANCEL"),
    onConfirm: () => {
      form.principal = q.principal;
      send(api, { kind: "borrow", borrower: api.me, lender: offer.lender, principal: q.principal, term: q.term },
        "borrow");
    }, rerender: api.rerender });
}

/**
 * Over a limit: the most this lender would lend over this term, and one click to borrow that instead.
 * @param {ReturnType<typeof loanOffers>[number]} offer
 * @param {number} term
 * @param {ScreenApi} api
 */
function mostRow(offer, term, api) {
  const most = /** @type {number} */ (offer.mostCents);
  const block = el("div", "econ-actions");
  if (most <= 0) {
    block.appendChild(note(api.loc("LOC_ECONOMICS_BORROW_MOST_NONE", api.nameOf(offer.lender), term)));
    return block;
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_BORROW_MOST", api.nameOf(offer.lender), term, formatGold(most))));
  block.appendChild(button(api.loc("LOC_ECONOMICS_BORROW_THAT"), () => {
    setConfirming(`borrow:${offer.lender}:most`);
    api.rerender();
  }));
  return block;
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
export function renderLend(input, api) {
  const others = input.civs.filter((civ) => civ.alive && !civ.human && civ.id !== api.me);
  const block = section(api.loc("LOC_ECONOMICS_LEND"), [], { subtitle: api.loc("LOC_ECONOMICS_LEND_SUB") });
  if (!others.length) { block.appendChild(empty(api.loc("LOC_ECONOMICS_LEND_NOBODY"))); return block; }
  if (form.lendTo === null || !others.some((civ) => civ.id === form.lendTo)) form.lendTo = others[0].id;
  const borrower = /** @type {number} */ (form.lendTo);
  const bond = bondRateFor(input, borrower);
  block.appendChild(field(api.loc("LOC_ECONOMICS_LEND_TO"), chips(others.map((civ) => ({ id: String(civ.id),
    label: api.nameOf(civ.id) })), String(borrower), (id) => { form.lendTo = Number(id); api.rerender(); })));
  for (const child of lendTerms(input, borrower, bond, api)) block.appendChild(child);
  for (const child of lendOutcome(input, borrower, Math.round(bond * form.lendRatePct / 100), api)) {
    block.appendChild(child);
  }
  return block;
}

/**
 * What the loan would pay back, the borrower's risk, the button, and the confirmation it opens.
 * @param {PlanInput} input
 * @param {number} borrower
 * @param {number} ratePpm
 * @param {ScreenApi} api
 */
function lendOutcome(input, borrower, ratePpm, api) {
  const payment = firstPayment(form.lendPrincipal, ratePpm, form.lendTerm);
  const interest = totalInterest(form.lendPrincipal, ratePpm, form.lendTerm);
  const balance = input.civs.find((civ) => civ.id === api.me)?.balanceCents ?? 0;
  const said = feedbackLine("lend");
  const out = [...(said ? [said] : []), facts([stat(api.loc("LOC_ECONOMICS_LEND_THEY_PAY"), gold(api, payment)),
    stat(api.loc("LOC_ECONOMICS_LEND_YOU_EARN"), gold(api, interest, 1))]), riskNote(input, borrower, api),
  button(api.loc("LOC_ECONOMICS_LEND"), () => { setConfirming("lend"); api.rerender(); })];
  if (isConfirming("lend")) {
    out.push(confirmCard({ title: api.loc("LOC_ECONOMICS_LEND_TO_CIV", api.nameOf(borrower)),
      lines: [changeRow(api.loc("LOC_ECONOMICS_CHANGE_TREASURY"), formatGold(balance),
        formatGold(balance - form.lendPrincipal), -1),
        row(api.loc("LOC_ECONOMICS_LEND_THEY_PAY_FOR", form.lendTerm), gold(api, payment)),
        row(api.loc("LOC_ECONOMICS_LEND_YOU_EARN"), gold(api, interest, 1)), note(api.loc("LOC_ECONOMICS_LEND_RULE"))],
      confirm: api.loc("LOC_ECONOMICS_LEND"), cancel: api.loc("LOC_ECONOMICS_CANCEL"),
      onConfirm: () => send(api, { kind: "lend", lender: api.me, borrower, principal: form.lendPrincipal, ratePpm,
        term: form.lendTerm }, "lend"), rerender: api.rerender }));
  }
  return out;
}

/**
 * The principal stepper, the rate chips around the borrower's bond rate and the term chips.
 * @param {PlanInput} input
 * @param {number} borrower
 * @param {number} bond
 * @param {ScreenApi} api
 */
function lendTerms(input, borrower, bond, api) {
  const rates = RATE_CHOICES.map((pct) => ({ id: String(pct), label: formatRate(Math.round(bond * pct / 100)) }));
  const terms = termsOpen(input, borrower).map((term) => ({ id: String(term), label: api.loc("LOC_ECONOMICS_TURNS", term) }));
  return [
    field(api.loc("LOC_ECONOMICS_PRINCIPAL"), goldStepper({ value: form.lendPrincipal, min: MIN_PRINCIPAL,
      max: MAX_PRINCIPAL, format: formatGold, onChange: (cents) => { form.lendPrincipal = cents; api.rerender(); } })),
    field(api.loc("LOC_ECONOMICS_RATE"), chips(rates, String(form.lendRatePct),
      (id) => { form.lendRatePct = Number(id); api.rerender(); })),
    note(api.loc("LOC_ECONOMICS_LEND_BOND_RATE", formatRate(bond))),
    field(api.loc("LOC_ECONOMICS_TERM"), chips(terms, String(form.lendTerm),
      (id) => { form.lendTerm = Number(id); api.rerender(); })),
  ];
}

/**
 * The borrower's own bond rate today, which bounds what it accepts (DESIGN 5).
 * @param {PlanInput} input
 * @param {number} borrower
 */
function bondRateFor(input, borrower) {
  const civ = input.civs.find((row) => row.id === borrower);
  const ledger = input.ledger || emptyLedger();
  return bondRatePpm({ age: input.age, standing: standingPct(ledger, borrower, input.turn),
    rates: ratesPct(input.options?.rates), depthFactorPct: civ?.depthFactorPct ?? 100 }) || 0;
}

/**
 * How close the borrower is to the AI repudiation rule (DESIGN 6), in words.
 * @param {PlanInput} input
 * @param {number} borrower
 * @param {ScreenApi} api
 */
function riskNote(input, borrower, api) {
  const risk = borrowerRisk(input, api.me, borrower);
  /** @type {string[]} */
  const parts = [];
  if (risk.atWar) parts.push(api.loc("LOC_ECONOMICS_RISK_WAR"));
  if (risk.insolvent) parts.push(api.loc("LOC_ECONOMICS_RISK_INSOLVENT", risk.lowIncomeTurns));
  else if (risk.incomeCents <= 0) parts.push(api.loc("LOC_ECONOMICS_RISK_NO_INCOME"));
  if (risk.inDefault) parts.push(api.loc("LOC_ECONOMICS_RISK_DEFAULT"));
  if (risk.level === "unfriendly") {
    parts.push(api.loc("LOC_ECONOMICS_RISK_UNFRIENDLY", formatGold(risk.thresholdCents)));
  }
  const text = parts.length ? parts.join(" ") : api.loc("LOC_ECONOMICS_RISK_LOW");
  const line = note(api.loc("LOC_ECONOMICS_LEND_RISK", text));
  if (parts.length) line.classList.add("econ-negative");
  return line;
}

/** Test hook: the form as it opens, or with the principal the player set. @param {number | null} [principal] */
export function resetFormForTests(principal = null) {
  Object.assign(form, { principal, term: null, lendTo: null, lendPrincipal: 10000, lendRatePct: 100, lendTerm: 10 });
}
