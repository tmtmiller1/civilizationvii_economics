// econ-ai.js - Economics: the rules that stand in for AI decisions (DESIGN 5, 6). The AI cannot be asked, so it
// "agrees" by rule and the transfer the rule produces is real. Nothing here moves Gold; econ-plan.js does that.
// These rules exist because no native lever carries a loan: the game's AI has no diplomatic action for borrowing or
// lending (DESIGN section 1, "Native first"; P18 looks for one).

import { AI } from "./econ-params.js";

/**
 * The amount an AI is short of the guard line (the engine's amenity line, 0 on 1.5.0); 0 when it isn't.
 * @param {number} projectedCents
 * @param {number | null | undefined} [lineCents]
 */
export function aiShortfall(projectedCents, lineCents = 0) {
  const line = lineCents ?? 0;
  return projectedCents < line ? line - projectedCents : 0;
}

/**
 * An AI lends when its balance exceeds 20 * income; a civ with no positive income never lends.
 * @param {{ balanceCents: number, incomeCents: number }} q
 */
export function aiWillLend({ balanceCents, incomeCents }) {
  return incomeCents > 0 && balanceCents > AI.lendIncomeMultiple * incomeCents;
}

/**
 * DESIGN 5: an AI in shortfall accepts the player's offer when r <= 1.2 * its own bond rate, its income is positive
 * and the loan fits its credit and debt-service limits.
 * @param {{ offerRatePpm: number, bondRatePpm: number | null, shortfallCents: number, incomeCents?: number,
 *   fitsCredit?: boolean, fitsService?: boolean }} q
 */
export function aiAccepts({ offerRatePpm, bondRatePpm, shortfallCents, incomeCents = 1, fitsCredit = true,
  fitsService = true }) {
  if (!(shortfallCents > 0) || !Number.isInteger(bondRatePpm) || !(incomeCents > 0)) return false;
  if (!fitsCredit || !fitsService) return false;
  return offerRatePpm * 100 <= /** @type {number} */ (bondRatePpm) * AI.acceptRatePct;
}

/** The phases in which an AI reads its credit as cheap: its own spread at 1.0 or below (DESIGN 4.11). */
const CHEAP_PHASES = ["boom", "steady", "outside"];

/**
 * DESIGN 6 build loan: an AI with positive income, solvent and in no default, borrows for its own current build while
 * its credit is cheap (its own phase Boom or Steady, or outside the cycle), at most once per 10 turns.
 * @param {{ incomeCents: number, phase: string, insolvent: boolean, inDefault: boolean, hasBuild: boolean,
 *   lastTurn: number | undefined, turn: number }} q
 */
export function aiBuildBorrowWanted({ incomeCents, phase, insolvent, inDefault, hasBuild, lastTurn, turn }) {
  if (!(incomeCents >= AI.minIncomeCents) || insolvent || inDefault || !hasBuild) return false;
  if (!CHEAP_PHASES.includes(phase)) return false;
  return !Number.isInteger(lastTurn) || turn - /** @type {number} */ (lastTurn) >= AI.buildEveryTurns;
}

/**
 * AI-PLAN 4.3: the cheapest way through, in order. Pay when this turn and the next fit; refinance when short and a
 * loan is on offer; restructure when short with income above 0 and nothing on offer; otherwise miss (pay what there
 * is). `gapNow` and `gapAhead` are the look-ahead's gaps this turn and next; `refinanceOpen` whether a refinancing
 * loan would be offered for the gap; `restructurable` whether any active loan hasn't been restructured yet.
 * @param {{ gapNow: number, gapAhead: number, refinanceOpen: boolean, incomeCents: number, restructurable: boolean }} q
 * @returns {"pay" | "refinance" | "restructure" | "miss"}
 */
export function aiChoice({ gapNow, gapAhead, refinanceOpen, incomeCents, restructurable }) {
  if (gapNow <= 0 && gapAhead <= 0) return "pay";
  if (gapNow > 0 && refinanceOpen) return "refinance";
  if (incomeCents > 0 && restructurable) return "restructure";
  return "miss";
}

/**
 * AI-PLAN 4.3: the loan an AI restructures first is the one whose payment doesn't fit: the active, not yet
 * restructured loan with the biggest payment.
 * @param {Loan[]} loans the civ's active loans
 * @param {(loan: Loan) => number} paymentOf
 */
export function loanToRestructure(loans, paymentOf) {
  const open = loans.filter((loan) => loan.state === "active" && !loan.restructured);
  open.sort((a, b) => paymentOf(b) - paymentOf(a) || a.id.localeCompare(b.id));
  return open[0] || null;
}

/**
 * The Gold a debt must keep for a repudiation to be worth weighing (AI-PLAN 4.4): 4 turns of income, 10 Gold at the
 * least.
 * @param {number} incomeCents
 */
export function repudiationThreshold(incomeCents) {
  return AI.repudiateKeepTurns * Math.max(Math.abs(incomeCents), AI.minIncomeCents);
}

/**
 * AI-PLAN 4.4, the weighing: a debt is repudiated when the Gold kept is above 4 turns of income and the lender is at
 * war with the civ, or Unfriendly and weaker (both strengths read), or the civ is insolvent and the lender isn't
 * Friendly (a world account included: the bond market, the temple treasuries and the citizens have no friends).
 * `debts` is [{ lender, cents, level, lenderStrength }] for each lender the AI owes, `level` the relationship or
 * null for a world account. The largest such debt is the one repudiated; at most once per 20 turns.
 * @param {{ debts: { lender: Party, cents: number, level: RelationLevel | null, lenderStrength?: number | null }[],
 *   insolvent: boolean, incomeCents: number, strength?: number | null, lastRepudiationTurn?: number,
 *   turn: number }} q
 * @returns {Party | null}
 */
export function aiRepudiationTarget({ debts, insolvent, incomeCents, strength = null, lastRepudiationTurn, turn }) {
  if (Number.isInteger(lastRepudiationTurn)
    && turn - /** @type {number} */ (lastRepudiationTurn) < AI.repudiateEveryTurns) return null;
  const threshold = repudiationThreshold(incomeCents);
  const weaker = (/** @type {number | null | undefined} */ other) => typeof strength === "number"
    && typeof other === "number" && other < strength;
  /** @param {{ cents: number, level: RelationLevel | null, lenderStrength?: number | null }} debt */
  const worth = (debt) => {
    if (debt.cents <= threshold || debt.level === "friendly") return false;
    if (debt.level === "war") return true;
    if (debt.level === "unfriendly" && weaker(debt.lenderStrength)) return true;
    return insolvent;
  };
  const picked = [...debts].filter(worth).sort((a, b) => b.cents - a.cents)[0];
  return picked ? picked.lender : null;
}
