// econ-credit.js - Economics: what a civ may still borrow, the debt-service limit and its standing (DESIGN 4.2).
// Standing is held in hundredths so a rate divides by an integer; the floor of 10 keeps that divisor above zero.

import { CREDIT, STANDING } from "./econ-params.js";
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
 * Repudiations by this civ in the last 40 turns.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function recentRepudiations(ledger, pid, turn) {
  return ledger.repudiations.filter((row) => row.pid === pid && turn - row.turn < STANDING.repudiationWindowTurns);
}

/**
 * max(0, (12 + depth_turns - 4 * repudiations) * income) - outstanding, never below 0. A system adds turns
 * (Merchant oligarchy +4, Manorial -4) or scales the whole limit (Corporatist 1.5x), DESIGN 4.17.
 * @param {{ incomeCents: number, outstandingCents: number, depthTurns?: number, repudiations?: number,
 *   systemTurns?: number, systemPct?: number }} q
 */
export function creditCap({ incomeCents, outstandingCents, depthTurns = 0, repudiations = 0, systemTurns = 0,
  systemPct = 100 }) {
  const depth = Math.max(0, Math.min(CREDIT.maxDepthTurns, Math.floor(depthTurns) || 0));
  const turns = CREDIT.baseTurns + depth + systemTurns - CREDIT.perRepudiationTurns * repudiations;
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
 * @param {{ defaults: number, misses: number, repudiations?: number, repudiationsAtWar?: number }} q
 */
export function standingFrom({ defaults, misses, repudiations = 0, repudiationsAtWar = 0 }) {
  const cost = STANDING.perDefault * defaults + STANDING.perMiss * misses + STANDING.perRepudiation * repudiations
    + STANDING.perRepudiationAtWar * repudiationsAtWar;
  return Math.max(STANDING.floor, STANDING.full - cost);
}

/**
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} turn
 */
export function standingPct(ledger, pid, turn) {
  const repudiations = recentRepudiations(ledger, pid, turn);
  return standingFrom({ defaults: activeDefaults(ledger, pid), misses: recentMisses(ledger, pid, turn),
    repudiations: repudiations.filter((row) => !row.atWar).length,
    repudiationsAtWar: repudiations.filter((row) => row.atWar).length });
}
