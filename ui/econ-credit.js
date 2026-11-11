// econ-credit.js - Economics: what a civ may still borrow, the debt-service limit and its credit reputation (DESIGN
// 4.2, AI-PLAN 4.4). The reputation is a number 0 to 100 per civ, kept in hundredths as of the turn it last changed
// and mending toward 100 with a 50-turn half-life from there; the standing every rate divides by is the reputation
// in whole points, floored at 10 so the divisor stays above zero.

import { CREDIT, REPUTATION, STANDING } from "./econ-params.js";
import { isOpen, paymentDue } from "./econ-loan.js";

/**
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function outstandingOf(ledger, pid) {
  let sum = 0;
  for (const loan of ledger.loans) if (loan.borrower === pid && isOpen(loan)) sum += loan.outstanding;
  return sum;
}

/**
 * The open emergency principal (DESIGN 4.6), measured as what's still outstanding on emergency loans.
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function emergencyOutstandingOf(ledger, pid) {
  let sum = 0;
  for (const loan of ledger.loans) {
    if (loan.borrower === pid && loan.emergency && isOpen(loan)) sum += loan.outstanding;
  }
  return sum;
}

/**
 * Repudiations by this civ in the last 40 turns that it hasn't made good with an amends loan (DESIGN 4.5).
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function recentRepudiations(ledger, pid, turn) {
  return ledger.repudiations.filter((row) => row.pid === pid && turn - row.turn < STANDING.repudiationWindowTurns
    && !Number.isInteger(row.madeGood));
}

/**
 * The turns of income the credit cap loses to a civ's reputation (AI-PLAN 4.4): 4 for every 30 points gone, so a
 * fresh repudiation costs 4 and a default 2, mending as the reputation does.
 * @param {number} repPoints the reputation in whole points
 */
export function repTurnsLost(repPoints) {
  const gone = Math.max(0, REPUTATION.full - repPoints);
  return Math.floor((CREDIT.perRepudiationTurns * gone) / REPUTATION.repudiation);
}

/**
 * max(0, (12 + depth_turns - lost turns) * income) - outstanding, never below 0. A system adds turns (Merchant
 * oligarchy +4, Manorial -4) or scales the whole limit (Corporatist 1.5x), DESIGN 4.17.
 * @param {{ incomeCents: number, outstandingCents: number, depthTurns?: number, lostTurns?: number,
 *   systemTurns?: number, systemPct?: number }} q
 */
export function creditCap({ incomeCents, outstandingCents, depthTurns = 0, lostTurns = 0, systemTurns = 0,
  systemPct = 100 }) {
  const depth = Math.max(0, Math.min(CREDIT.maxDepthTurns, Math.floor(depthTurns) || 0));
  const turns = CREDIT.baseTurns + depth + systemTurns - lostTurns;
  const limit = Math.floor((Math.max(0, turns * incomeCents) * Math.max(0, systemPct)) / 100);
  return Math.max(0, limit - outstandingCents);
}

/**
 * Next turn's scheduled interest plus amortisation over the civ's active loans.
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function serviceOf(ledger, pid) {
  let sum = 0;
  for (const loan of ledger.loans) if (loan.borrower === pid && loan.state === "active") sum += paymentDue(loan).total;
  return sum;
}

/** @param {number} incomeCents */
export function serviceCap(incomeCents) {
  return Math.floor((CREDIT.servicePct * Math.max(0, incomeCents)) / 100);
}

/**
 * DESIGN 4.2: with the new loan's first payment added, service stays within 35 percent of income.
 * @param {{ serviceCents: number, firstPaymentCents: number, incomeCents: number }} q
 */
export function fitsService({ serviceCents, firstPaymentCents, incomeCents }) {
  return serviceCents + firstPaymentCents <= serviceCap(incomeCents);
}

/**
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function activeDefaults(ledger, pid) {
  let count = 0;
  for (const loan of ledger.loans) if (loan.borrower === pid && loan.state === "default") count += 1;
  return count;
}

/**
 * Misses in the last 20 turns: rows { pid, turn, n } with turn - t < 20.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function recentMisses(ledger, pid, turn) {
  let count = 0;
  for (const row of ledger.misses) if (row.pid === pid && turn - row.turn < STANDING.windowTurns) count += row.n;
  return count;
}

/**
 * Records one miss against standing; a civ's misses in one turn share a row, which bounds the envelope.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function addMiss(ledger, pid, turn) {
  const row = ledger.misses.find((miss) => miss.pid === pid && miss.turn === turn);
  if (row) row.n += 1; else ledger.misses.push({ pid, turn, n: 1 });
}

/**
 * The standing an older save's rows stand for (DESIGN 4.2 before AI-PLAN 4.4), which seeds its reputation.
 * @param {{ defaults: number, misses: number, repudiations?: number, repudiationsAtWar?: number }} q
 */
export function standingFrom({ defaults, misses, repudiations = 0, repudiationsAtWar = 0 }) {
  const cost = STANDING.perDefault * defaults + STANDING.perMiss * misses + STANDING.perRepudiation * repudiations
    + STANDING.perRepudiationAtWar * repudiationsAtWar;
  return Math.max(STANDING.floor, STANDING.full - cost);
}

/** The reputation's unit: 100 points is 10000. */
const REP_UNIT = 100;

/**
 * A civ's credit reputation now, in hundredths of a point: what the row holds, mended toward 100 by half every 50
 * turns since the row's turn; 100 with no row.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function creditRepOf(ledger, pid, turn) {
  const row = (ledger.creditRep || []).find((x) => x.pid === pid);
  if (!row) return REPUTATION.full * REP_UNIT;
  const gone = REPUTATION.full * REP_UNIT - row.rep;
  const elapsed = Math.max(0, turn - row.turn);
  const left = gone * Math.pow(0.5, elapsed / REPUTATION.halfLifeTurns);
  return Math.max(0, REPUTATION.full * REP_UNIT - Math.round(left));
}

/**
 * Moves a civ's reputation by `points` (negative for a penalty), from what it has mended to now, never above 100 or
 * below 0; the row then counts from this turn. Returns the reputation after, in points.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 * @param {number} points
 */
export function changeCreditRep(ledger, pid, turn, points) {
  const now = creditRepOf(ledger, pid, turn);
  const rep = Math.max(0, Math.min(REPUTATION.full * REP_UNIT, now + Math.round(points * REP_UNIT)));
  const row = ledger.creditRep.find((x) => x.pid === pid);
  if (rep >= REPUTATION.full * REP_UNIT) ledger.creditRep = ledger.creditRep.filter((x) => x.pid !== pid);
  else if (row) Object.assign(row, { rep, turn });
  else ledger.creditRep.push({ pid, rep, turn });
  return rep / REP_UNIT;
}

/**
 * The reputation in whole points, which the rates and the Loans tab read; floored at 10 so a rate never divides by
 * zero (it was the standing of DESIGN 4.2 before AI-PLAN 4.4, in the same unit).
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function standingPct(ledger, pid, turn) {
  return Math.max(STANDING.floor, Math.round(creditRepOf(ledger, pid, turn) / REP_UNIT));
}
