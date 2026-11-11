// econ-payments.js - Economics: settling one loan for one turn (DESIGN 4.4, 4.5). A payment the borrower's funds for
// the turn can't cover in full is paid as far as they go, and the rest of it joins what the borrower owes; the turn
// still counts as a miss (AI-PLAN 4.1, the owner's call of 2026-10-31). With nothing to pay it's the plain miss: the
// interest alone is capitalised.

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
 * The part of a requested early repayment that's applied: whole Gold, within what's left and the room.
 * @param {number} extra
 * @param {number} left
 * @param {number} room
 */
function earlyRepayment(extra, left, room) {
  return clamp(Math.floor(extra) || 0, 0, Math.min(left, room));
}

/**
 * An active loan's turn. `funds` is what the borrower can pay it with after its earlier charges, overdraft included
 * (DESIGN 4.14, 4.18); `extra` is an early repayment requested this turn, applied only if the regular payment is made
 * and the extra fits in `cash`, the Gold actually in hand (an early repayment is never made on the overdraft);
 * `growthMille` scales a partnership's interest (DESIGN 4.17).
 * @param {Loan} loan
 * @param {number} funds
 * @param {{ capPpm?: number, extra?: number, growthMille?: number, cash?: number }} [q]
 */
export function settleActive(loan, funds, { capPpm = Infinity, extra = 0, growthMille = 1000, cash } = {}) {
  const { interest, amortisation, total } = paymentDue(loan, growthMille);
  if (funds - total < 0) {
    // Short: what there is goes to the lender, interest first; the rest of the payment joins O. The slice moves to
    // the next turn, so the next payment is the same number on a slightly bigger loan.
    const paid = clamp(Math.floor(funds) || 0, 0, total);
    const short = total - paid;
    const missed = loan.missed + 1;
    /** @type {LoanState} */
    const state = missed >= MISS.defaultAt ? "default" : "active";
    /** @type {Loan} */
    const next = { ...loan, missed, ratePpm: missRate(loan.ratePpm, capPpm),
      outstanding: loan.outstanding + interest - paid, state };
    return { loan: next, cents: paid, missed: true, defaulted: state === "default", closed: false,
      interest: Math.min(paid, interest), amortisation: Math.max(0, paid - interest), extra: 0, capitalised: short,
      due: total };
  }
  const left = loan.outstanding - amortisation;
  const applied = earlyRepayment(extra, left, Math.min(funds, cash ?? funds) - total);
  const outstanding = left - applied;
  const closed = outstanding === 0;
  /** @type {Loan} */
  const next = { ...loan, outstanding, paid: loan.paid + 1, missed: 0, state: closed ? "closed" : "active" };
  return { loan: next, cents: total + applied, missed: false, defaulted: false, closed, interest, amortisation,
    extra: applied, capitalised: 0, due: total };
}

/**
 * DESIGN 4.5. Income above 0: min(max(ceil(O * 0.1), 1 Gold), floor(0.5 * income), cash). Income at or below 0:
 * min(max(ceil(O * 0.05), 1 Gold), floor(0.1 * balance), cash). `cash` is what the borrower can pay with this turn,
 * its overdraft included (DESIGN 4.18), floored at 0. The 1 Gold floor keeps the tail of a default from running for
 * dozens of turns (AI-PLAN section 2).
 * @param {Loan} loan
 * @param {{ incomeCents: number, balanceCents?: number, cashCents: number }} q
 */
export function garnishDue(loan, { incomeCents, balanceCents = 0, cashCents }) {
  if (loan.outstanding <= 0) return 0;
  const cash = Math.max(0, cashCents);
  if (incomeCents > 0) {
    const ofOutstanding = Math.max(GARNISH.minCents, divCeil(loan.outstanding * GARNISH.outstandingPct, 100));
    const ofIncome = Math.floor((incomeCents * GARNISH.incomePct) / 100);
    return Math.max(0, Math.min(loan.outstanding, ofOutstanding, ofIncome, cash));
  }
  const ofOutstanding = Math.max(GARNISH.minCents, divCeil(loan.outstanding * GARNISH.lowOutstandingPct, 100));
  const ofBalance = Math.floor((Math.max(0, balanceCents) * GARNISH.lowBalancePct) / 100);
  return Math.max(0, Math.min(loan.outstanding, ofOutstanding, ofBalance, cash));
}

/**
 * A defaulted loan's turn: the garnish is taken from what's there, overdraft included; no interest runs in default.
 * An early repayment fits in `inHandCents` (Gold in hand) when given. Once under a Gold is left the loan closes,
 * and that remainder is forgiven (`forgiven`).
 * @param {Loan} loan
 * @param {{ incomeCents: number, balanceCents?: number, cashCents: number, inHandCents?: number }} q
 * @param {number} [extra]
 */
export function settleDefault(loan, q, extra = 0) {
  const garnish = garnishDue(loan, q);
  const left = loan.outstanding - garnish;
  const room = Math.min(q.cashCents, q.inHandCents ?? q.cashCents) - garnish;
  const applied = clamp(Math.floor(extra) || 0, 0, Math.max(0, Math.min(left, room)));
  const remaining = left - applied;
  const forgiven = remaining > 0 && remaining < GARNISH.closeUnderCents ? remaining : 0;
  const outstanding = remaining - forgiven;
  const closed = outstanding === 0;
  /** @type {Loan} */
  const next = { ...loan, outstanding, state: closed ? "closed" : "default" };
  return { loan: next, cents: garnish + applied, garnish, extra: applied, closed, forgiven };
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
