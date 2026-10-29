// econ-view-borrow.js - Economics: the Borrow and Lend forms of the Loans tab (DESIGN 5). Borrow: pick the principal
// and term, see each lender's rate, the payment per turn and the total interest, and why a lender would refuse;
// the model's own offer and limit functions answer, so the form can't promise what the batch won't do. Lend: pick an
// AI, the principal, rate and term, see the AI's acceptance rule and its repudiation risk.

import { button, chips, el, goldStepper, note, row, section } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { borrowerRisk, loanOffers, termsOpen } from "./econ-view-model.js";
import { bondRatePpm } from "./econ-lenders.js";
import { standingPct } from "./econ-credit.js";
import { ratesPct } from "./econ-params.js";
import { reasonKey } from "./econ-notice-text.js";
import { emptyLedger } from "./econ-state.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

const MIN_PRINCIPAL = 1000;
const MAX_PRINCIPAL = 10000000;
/** Form state kept across re-renders. */
const form = { principal: 10000, term: 10, lendTo: /** @type {number | null} */ (null), lendPrincipal: 10000,
  lendRatePct: 100, lendTerm: 10 };
const RATE_CHOICES = [80, 100, 120];

/**
 * @param {PlanInput} input
 * @param {ReturnType<typeof import("./econ-view-model.js").loansView>} view
 * @param {ScreenApi} api
 */
export function renderBorrow(input, view, api) {
  const terms = termsOpen(input, api.me);
  if (!terms.includes(form.term)) form.term = terms[0] || 10;
  const block = section(api.loc("LOC_ECONOMICS_BORROW"), [
    row(api.loc("LOC_ECONOMICS_PRINCIPAL"), ""),
    goldStepper({ value: form.principal, min: MIN_PRINCIPAL, max: MAX_PRINCIPAL, format: formatGold,
      onChange: (cents) => { form.principal = cents; api.rerender(); } }),
    row(api.loc("LOC_ECONOMICS_TERM"), ""),
    chips(terms.map((term) => ({ id: String(term), label: api.loc("LOC_ECONOMICS_TURNS", term) })), String(form.term),
      (id) => { form.term = Number(id); api.rerender(); }),
  ]);
  const offers = loanOffers(input, api.me, form.principal, form.term);
  if (!offers.length) block.appendChild(note(api.loc("LOC_ECONOMICS_BORROW_NO_OFFERS")));
  for (const offer of offers) block.appendChild(offerRow(offer, api));
  if (view.creditRoomCents < form.principal) block.appendChild(note(api.loc("LOC_ECONOMICS_BORROW_OVER_ROOM")));
  return block;
}

/**
 * @param {ReturnType<typeof loanOffers>[number]} offer
 * @param {ScreenApi} api
 */
function offerRow(offer, api) {
  const line = el("div", "econ-card");
  line.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_OFFER_ROW", api.nameOf(offer.lender),
    formatRate(offer.ratePpm), formatGold(offer.paymentCents), formatGold(offer.interestCents))));
  line.appendChild(note(api.loc("LOC_ECONOMICS_OFFER_SERVICE", offer.servicePctAfter)));
  const actions = el("div", "econ-actions");
  if (offer.refusal) actions.appendChild(el("div", "econ-line econ-negative", api.loc(reasonKey(offer.refusal))));
  actions.appendChild(button(api.loc("LOC_ECONOMICS_BORROW"), () => {
    api.request({ kind: "borrow", borrower: api.me, lender: offer.lender, principal: form.principal, term: form.term });
    api.rerender();
  }, { disabled: !!offer.refusal }));
  line.appendChild(actions);
  return line;
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
export function renderLend(input, api) {
  const others = input.civs.filter((civ) => civ.alive && !civ.human && civ.id !== api.me);
  const block = section(api.loc("LOC_ECONOMICS_LEND"));
  if (!others.length) { block.appendChild(note(api.loc("LOC_ECONOMICS_LEND_NOBODY"))); return block; }
  if (form.lendTo === null || !others.some((civ) => civ.id === form.lendTo)) form.lendTo = others[0].id;
  const borrower = /** @type {number} */ (form.lendTo);
  const bond = bondRateFor(input, borrower);
  block.appendChild(chips(others.map((civ) => ({ id: String(civ.id), label: api.nameOf(civ.id) })), String(borrower),
    (id) => { form.lendTo = Number(id); api.rerender(); }));
  for (const child of lendTerms(input, borrower, bond, api)) block.appendChild(child);
  block.appendChild(riskNote(input, borrower, api));
  block.appendChild(button(api.loc("LOC_ECONOMICS_LEND"), () => {
    api.request({ kind: "lend", lender: api.me, borrower, principal: form.lendPrincipal,
      ratePpm: Math.round(bond * form.lendRatePct / 100), term: form.lendTerm });
    api.rerender();
  }));
  block.appendChild(note(api.loc("LOC_ECONOMICS_LEND_RULE")));
  return block;
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
    row(api.loc("LOC_ECONOMICS_PRINCIPAL"), ""),
    goldStepper({ value: form.lendPrincipal, min: MIN_PRINCIPAL, max: MAX_PRINCIPAL, format: formatGold,
      onChange: (cents) => { form.lendPrincipal = cents; api.rerender(); } }),
    row(api.loc("LOC_ECONOMICS_RATE"), api.loc("LOC_ECONOMICS_LEND_BOND_RATE", formatRate(bond))),
    chips(rates, String(form.lendRatePct), (id) => { form.lendRatePct = Number(id); api.rerender(); }),
    row(api.loc("LOC_ECONOMICS_TERM"), ""),
    chips(terms, String(form.lendTerm), (id) => { form.lendTerm = Number(id); api.rerender(); }),
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

/** Test hook. */
export function resetFormForTests() {
  Object.assign(form, { principal: 10000, term: 10, lendTo: null, lendPrincipal: 10000, lendRatePct: 100,
    lendTerm: 10 });
}
