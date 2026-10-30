// econ-payments.js - Economics: settling one loan for one turn (DESIGN 4.4, 4.5). A payment is all or nothing: if the
// whole of interest plus amortisation does not fit in the borrower's funds for the turn, it is a miss, and the
// interest the borrower kept is added to what it owes.

import { GARNISH, MISS } from "./econ-params.js";
import { divCeil, divRound } from "./econ-money.js";
import { paymentDue } from "./econ-loan.js";

/**
 * r * 1.25, stopped at r_cap (DESIGN 4.3); with no cap given the step runs free.
 * @param {number} ratePpm
 * @param {number} [capPpm]
 */
export function missRate(ratePpm, capPpm = Infinity) {
  return Math.min(divRound(ratePpm * MISS.rateNum, MISS.rateDen), capPpm);
}

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * An active loan's turn. `funds` is the borrower's funds for the turn after its earlier charges (DESIGN 4.14);
 * `extra` is an early repayment requested this turn, applied only if the regular payment is made and the extra fits;
 * `growthMille` scales a partnership's interest (DESIGN 4.17).
 * @param {Loan} loan
 * @param {number} funds
 * @param {{ capPpm?: number, extra?: number, growthMille?: number }} [q]
 */
export function settleActive(loan, funds, { capPpm = Infinity, extra = 0, growthMille = 1000 } = {}) {
  const { interest, amortisation, total } = paymentDue(loan, growthMille);
  if (funds - total < 0) {
    const missed = loan.missed + 1;
    /** @type {LoanState} */
    const state = missed >= MISS.defaultAt ? "default" : "active";
    /** @type {Loan} */
    const next = { ...loan, missed, ratePpm: missRate(loan.ratePpm, capPpm), outstanding: loan.outstanding + interest,
      state };
    return { loan: next, cents: 0, missed: true, defaulted: state === "default", closed: false, interest: 0,
      amortisation: 0, extra: 0, capitalised: interest };
  }
  const left = loan.outstanding - amortisation;
  const applied = clamp(Math.floor(extra) || 0, 0, Math.min(left, funds - total));
  const outstanding = left - applied;
  const closed = outstanding === 0;
  /** @type {Loan} */
  const next = { ...loan, outstanding, paid: loan.paid + 1, missed: 0, state: closed ? "closed" : "active" };
  return { loan: next, cents: total + applied, missed: false, defaulted: false, closed, interest, amortisation,
    extra: applied, capitalised: 0 };
}

/**
 * DESIGN 4.5. Income above 0: min(ceil(O * 0.1), floor(0.5 * income), cash). Income at or below 0:
 * min(ceil(O * 0.05), floor(0.1 * balance), cash). `cash` is what the borrower has left this turn, floored at 0.
 * @param {Loan} loan
 * @param {{ incomeCents: number, balanceCents?: number, cashCents: number }} q
 */
export function garnishDue(loan, { incomeCents, balanceCents = 0, cashCents }) {
  if (loan.outstanding <= 0) return 0;
  const cash = Math.max(0, cashCents);
  if (incomeCents > 0) {
    const ofOutstanding = divCeil(loan.outstanding * GARNISH.outstandingPct, 100);
    const ofIncome = Math.floor((incomeCents * GARNISH.incomePct) / 100);
    return Math.max(0, Math.min(loan.outstanding, ofOutstanding, ofIncome, cash));
  }
  const ofOutstanding = divCeil(loan.outstanding * GARNISH.lowOutstandingPct, 100);
  const ofBalance = Math.floor((Math.max(0, balanceCents) * GARNISH.lowBalancePct) / 100);
  return Math.max(0, Math.min(loan.outstanding, ofOutstanding, ofBalance, cash));
}

/**
 * A defaulted loan's turn: the garnish is taken from what's there; no interest runs in default.
 * @param {Loan} loan
 * @param {{ incomeCents: number, balanceCents?: number, cashCents: number }} q
 * @param {number} [extra]
 */
export function settleDefault(loan, q, extra = 0) {
  const garnish = garnishDue(loan, q);
  const left = loan.outstanding - garnish;
  const applied = clamp(Math.floor(extra) || 0, 0, Math.max(0, Math.min(left, q.cashCents - garnish)));
  const outstanding = left - applied;
  const closed = outstanding === 0;
  /** @type {Loan} */
  const next = { ...loan, outstanding, state: closed ? "closed" : "default" };
  return { loan: next, cents: garnish + applied, garnish, extra: applied, closed };
}

/**
 * Add a block row unless one for the pair is already there.
 * @param {Block[]} blocks
 * @param {Block} block
 */
export function withBlock(blocks, block) {
  if (blocks.some((row) => row.lender === block.lender && row.borrower === block.borrower)) return blocks;
  return [...blocks, block];
}
