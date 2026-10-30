// econ-ai.js - Economics: the rules that stand in for AI decisions (DESIGN 5, 6). The AI cannot be asked, so it
// "agrees" by rule and the transfer the rule produces is real. Nothing here moves Gold; econ-plan.js does that.
// These rules exist because no native lever carries a loan: the game's AI has no diplomatic action for borrowing or
// lending (DESIGN section 1, "Native first"; P18 looks for one).

import { AI, BOND, TEMPLE } from "./econ-params.js";

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
 * DESIGN 6: an overdue loan with income > 0 is restructured at m = 2, once.
 * @param {{ loan: Loan, incomeCents: number }} q
 */
export function aiRestructures({ loan, incomeCents }) {
  return loan.state === "active" && !loan.restructured && loan.missed >= AI.restructureAt && incomeCents > 0;
}

/**
 * Debt above which an Unfriendly lender is worth stiffing: 10 * max(|income|, 10 Gold).
 * @param {number} incomeCents
 */
export function repudiationThreshold(incomeCents) {
  return AI.repudiateDebtMultiple * Math.max(Math.abs(incomeCents), AI.minIncomeCents);
}

/**
 * DESIGN 6. `debts` is [{ lender, cents, level }] for each lender the AI owes, `level` the relationship or null for a
 * world account. Returns the lender to repudiate, or null.
 * At most once per 20 turns; never a Friendly lender; an enemy at war first, then, when insolvent or in default, an
 * Unfriendly lender owed more than the threshold, then the bond market when insolvent and at the emergency cap.
 * @param {{ debts: { lender: Party, cents: number, level: RelationLevel | null }[], insolvent: boolean,
 *   inDefault: boolean, incomeCents: number, atCap: boolean, lastRepudiationTurn?: number, turn: number }} q
 * @returns {Party | null}
 */
export function aiRepudiationTarget({ debts, insolvent, inDefault, incomeCents, atCap, lastRepudiationTurn, turn }) {
  if (Number.isInteger(lastRepudiationTurn)
    && turn - /** @type {number} */ (lastRepudiationTurn) < AI.repudiateEveryTurns) return null;
  const byDebt = [...debts].sort((a, b) => b.cents - a.cents);
  const war = byDebt.find((debt) => debt.level === "war");
  if (war) return war.lender;
  if (insolvent || inDefault) {
    const threshold = repudiationThreshold(incomeCents);
    const hostile = byDebt.find((debt) => debt.level === "unfriendly" && debt.cents > threshold);
    if (hostile) return hostile.lender;
  }
  if (insolvent && atCap) {
    const world = byDebt.find((debt) => debt.lender === BOND || debt.lender === TEMPLE);
    if (world) return world.lender;
  }
  return null;
}
