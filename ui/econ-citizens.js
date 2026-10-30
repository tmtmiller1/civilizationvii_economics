// econ-citizens.js - Economics: citizen loans for a Civic market civ (DESIGN 4.17), as plain data. Classical
// Republic's own bonuses are about happy cities, so its finance runs through the citizens and the celebration meter:
// the civ can borrow from its own citizens from the start of the game, the principal comes from outside the
// treasuries (the world account `citizens`), and the interest, spent at home, comes back as celebration. No native
// lever carries a loan (P18), so these are level 2 and the AI takes them by the rule below. The three hooks at the
// end book the celebration the payments, misses and a repudiation move. Nothing here reads the engine.

import { BASE_RATE_PPM, CITIZEN, CITIZENS, RATE_CAP_MULTIPLE } from "./econ-params.js";
import { divRound } from "./econ-money.js";
import { addCelebration } from "./econ-batch.js";

/**
 * citizen_cap = 5 turns of max(10, income) per settlement with a Commerce building, less what the civ already owes
 * its citizens; credit_cap still applies on top (DESIGN 4.2).
 * @param {{ incomeCents: number, commerceSettlements: number, owedCents: number }} q
 */
export function citizenCapCents({ incomeCents, commerceSettlements, owedCents }) {
  const towns = Math.max(0, Math.floor(commerceSettlements) || 0);
  const cap = CITIZEN.capTurns * Math.max(CITIZEN.minIncomeCents, incomeCents) * towns;
  return Math.max(0, cap - Math.max(0, owedCents));
}

/**
 * rate = 0.75 * base_rate / standing * depth_factor, with the Rates option, stopped at r_cap.
 * @param {{ age: string, standing: number, rates?: number, depthFactorPct?: number }} q
 */
export function citizenRatePpm({ age, standing, rates = 100, depthFactorPct = 100 }) {
  const base = BASE_RATE_PPM[age];
  if (!base) return null;
  const rate = divRound(base * CITIZEN.ratePct * rates * depthFactorPct, 100 * standing * 100);
  return Math.min(rate, divRound(base * RATE_CAP_MULTIPLE * rates, 100));
}

/**
 * The celebration the interest buys, granted the turn it's paid: 6 times the interest, as Light Taxation buys it, in
 * the meter's cents.
 * @param {number} interestCents
 */
export function interestCelebrationCents(interestCents) {
  return CITIZEN.celebrationMultiple * Math.max(0, interestCents);
}

/**
 * A missed payment to the citizens costs celebration instead of Influence: 5 turns of the meter's gain.
 * @param {number} happinessCents the civ's net Happiness a turn
 */
export function missCelebrationCents(happinessCents) {
  return -CITIZEN.missTurns * Math.max(0, happinessCents) || 0;
}

/**
 * Repudiating the citizens costs the meter 10 turns of its gain (no foreign lender holds a grudge).
 * @param {number} happinessCents
 */
export function repudiationCelebrationCents(happinessCents) {
  return -CITIZEN.repudiationTurns * Math.max(0, happinessCents) || 0;
}

/**
 * The AI's rule (DESIGN 6): a Civic market AI with positive income, solvent, owing its citizens nothing and holding
 * under 10 turns of income takes up to 5 turns of income from them, so it plays the system the player can. Returns
 * the principal, 0 when it doesn't borrow.
 * @param {{ incomeCents: number, balanceCents: number, insolvent: boolean, owesCitizens: boolean,
 *   roomCents: number }} q
 */
export function aiCitizenPrincipal({ incomeCents, balanceCents, insolvent, owesCitizens, roomCents }) {
  if (!(incomeCents > 0) || insolvent || owesCitizens) return 0;
  if (balanceCents >= CITIZEN.aiBalanceTurns * incomeCents) return 0;
  return Math.max(0, Math.min(roomCents, CITIZEN.aiSizeTurns * incomeCents));
}

/**
 * The largest principal whose first payment fits in `roomCents` of debt-service room (DESIGN 4.2), at `ratePpm` over
 * `term` turns: the slice P / T plus the interest P * r. One Gold under, for the rounding of the slice.
 * @param {{ roomCents: number, ratePpm: number, term: number }} q
 */
export function servicePrincipalCents({ roomCents, ratePpm, term }) {
  if (!(roomCents > 0) || !(term > 0)) return 0;
  const perMillion = Math.ceil(1000000 / term) + Math.max(0, ratePpm);
  return Math.max(0, Math.floor((roomCents * 1000000) / perMillion) - 100);
}

/**
 * Citizens' interest comes back as celebration, 6 times over, the turn it's paid (DESIGN 4.17).
 * @param {TurnContext} ctx
 * @param {Loan} loan
 * @param {number} interestCents
 */
export function citizenInterest(ctx, loan, interestCents) {
  if (loan.lender !== CITIZENS || interestCents <= 0) return;
  const cents = interestCelebrationCents(interestCents);
  addCelebration(ctx.batch, loan.borrower, cents);
  ctx.out.celebration.push({ pid: loan.borrower, amount: cents, loanId: loan.id, reason: "citizens" });
}

/**
 * A miss on a citizen loan costs celebration instead of Influence: 5 turns of the meter's gain. Returns whether it
 * was a citizen loan.
 * @param {TurnContext} ctx
 * @param {Loan} loan
 */
export function citizenMiss(ctx, loan) {
  if (loan.lender !== CITIZENS) return false;
  const cents = missCelebrationCents(ctx.civ.get(loan.borrower)?.happinessCents ?? 0);
  if (cents < 0) {
    addCelebration(ctx.batch, loan.borrower, cents);
    ctx.out.celebration.push({ pid: loan.borrower, amount: cents, loanId: loan.id, reason: "citizens-miss" });
  }
  return true;
}

/**
 * Repudiating the citizens costs the meter 10 turns of its gain (DESIGN 4.17).
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function citizenRepudiation(ctx, pid) {
  const cents = repudiationCelebrationCents(ctx.civ.get(pid)?.happinessCents ?? 0);
  if (cents >= 0) return;
  addCelebration(ctx.batch, pid, cents);
  ctx.out.celebration.push({ pid, amount: cents, reason: "citizens-repudiated" });
}

