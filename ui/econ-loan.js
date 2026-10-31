// econ-loan.js - Economics: one loan record and its per-turn arithmetic (DESIGN 4.1, 4.4). Amortisation follows a
// cumulative schedule (the k-th slice is floor(P*k/T) - floor(P*(k-1)/T)), so the slices sum to P exactly; interest
// capitalised on a miss sits above that schedule and is cleared by the last payment, which takes the whole remainder.

import { applyPpm } from "./econ-money.js";
import { RESTRUCTURE } from "./econ-params.js";

/** @type {LoanState[]} */
export const LOAN_STATES = ["active", "default", "closed", "repudiated"];
// DESIGN 4.1: `project` and `general` are 1.1's investment records; 1.0 only writes `loan`.
/** @type {LoanKind[]} */
export const LOAN_KINDS = ["loan", "project", "general"];
// Who opened the record: a player's borrow or lend request, the guard, or an AI rule.
/** @type {LoanSource[]} */
export const LOAN_SOURCES = ["borrow", "lend", "guard", "ai-shortfall", "ai-citizens", "ai-build", "refinance"];

/** @param {number} seq */
export function loanId(seq) {
  return `L${seq}`;
}

/** @param {unknown} id */
export function loanSeq(id) {
  const match = /^L([1-9]\d*)$/.exec(String(id));
  return match ? Number(match[1]) : 0;
}

/**
 * @param {{ id: string, lender: Party, borrower: number, principal: number, ratePpm: number, term: number,
 *   turn: number, source?: LoanSource, emergency?: boolean, kind?: LoanKind }} spec
 * @returns {Loan}
 */
export function makeLoan({ id, lender, borrower, principal, ratePpm, term, turn, source = "borrow", emergency = false,
  kind = "loan" }) {
  return {
    id, kind, lender, borrower, principal, outstanding: principal, ratePpm, term,
    paid: 0, missed: 0, state: "active", emergency: emergency === true, restructured: false,
    opened: turn, closedTurn: null, writtenOff: 0, source,
  };
}

/**
 * Interest for the turn; a partnership's (DESIGN 4.17) moves with the borrower's income, `growthMille` thousandths.
 * @param {Loan} loan
 * @param {number} [growthMille]
 */
export function interestDue(loan, growthMille = 1000) {
  const interest = applyPpm(loan.outstanding, loan.ratePpm);
  return growthMille === 1000 ? interest : Math.floor((interest * Math.max(0, growthMille)) / 1000);
}

/**
 * @param {number} principal
 * @param {number} term
 * @param {number} k
 */
export function scheduledSlice(principal, term, k) {
  return Math.floor((principal * k) / term) - Math.floor((principal * (k - 1)) / term);
}

/**
 * The next amortisation slice; at or past term the whole remainder is due, so a loan can never outlive its term.
 * @param {Loan} loan
 */
export function amortisationDue(loan) {
  const k = loan.paid + 1;
  if (k >= loan.term) return loan.outstanding;
  return Math.min(loan.outstanding, scheduledSlice(loan.principal, loan.term, k));
}

/**
 * @param {Loan} loan
 * @param {number} [growthMille]
 */
export function paymentDue(loan, growthMille = 1000) {
  const interest = interestDue(loan, growthMille);
  const amortisation = amortisationDue(loan);
  return { interest, amortisation, total: interest + amortisation };
}

/**
 * The first payment a new loan would charge, for the debt-service test (DESIGN 4.2).
 * @param {number} principal
 * @param {number} ratePpm
 * @param {number} term
 */
export function firstPayment(principal, ratePpm, term) {
  return applyPpm(principal, ratePpm) + scheduledSlice(principal, term, 1);
}

/** @param {Loan} loan */
export function isOpen(loan) {
  return loan.state === "active" || loan.state === "default";
}

/** @param {Loan} loan */
export function isOverdue(loan) {
  return loan.state === "active" && loan.missed >= 1;
}

/**
 * DESIGN 4.4: what's left of O spread over 10 more turns, the rate kept, m back to 0, once per loan.
 * @param {Loan} loan
 * @returns {Loan}
 */
export function restructure(loan) {
  return { ...loan, principal: loan.outstanding, term: RESTRUCTURE.turns, paid: 0, missed: 0, restructured: true };
}

/**
 * Early repayment of any amount, without penalty; returns the loan and the cents actually applied.
 * @param {Loan} loan
 * @param {number} cents
 * @returns {{ loan: Loan, applied: number }}
 */
export function repay(loan, cents) {
  const applied = Math.max(0, Math.min(Math.floor(cents) || 0, loan.outstanding));
  const outstanding = loan.outstanding - applied;
  return { loan: { ...loan, outstanding, state: outstanding === 0 ? "closed" : loan.state }, applied };
}

/**
 * @param {number} principal
 * @param {number} ratePpm
 * @param {number} term
 */
export function totalInterest(principal, ratePpm, term) {
  let outstanding = principal;
  let sum = 0;
  for (let k = 1; k <= term; k += 1) {
    sum += applyPpm(outstanding, ratePpm);
    outstanding -= k >= term ? outstanding : scheduledSlice(principal, term, k);
  }
  return sum;
}
