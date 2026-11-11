// econ-guard.js - Economics: the auto-loan guard and the emergency cap (DESIGN 4.6). The guard line is 0 Gold, where
// the overdraft's interest and penalties start (DESIGN 4.18); the game's own GOLD_NEGATIVE_BALANCE_* lines do nothing
// on 1.5.0 (lab W10, 2026-11-10). The guard has work only while income is at or below 0: a dip with positive income
// is left for that income to lift.

import { EMERGENCY } from "./econ-params.js";

/**
 * max(100 Gold, 10 * |income|) of open emergency principal per civ.
 * @param {number} incomeCents
 */
export function emergencyCap(incomeCents) {
  return Math.max(EMERGENCY.minCapCents, EMERGENCY.incomeMultiple * Math.abs(incomeCents));
}

/**
 * Insolvent after 5 turns running with income at or below 0.
 * @param {number} lowIncomeTurns
 */
export function isInsolvent(lowIncomeTurns) {
  return lowIncomeTurns >= EMERGENCY.insolventTurns;
}

/**
 * projected: the balance after this turn's resolved flows. Borrows back to the line plus one turn of upkeep, unless
 * that would pass the cap, and only while income is at or below 0 (P4).
 * @param {{ enabled: boolean, projectedCents: number, upkeepCents?: number, lineCents: number | null | undefined,
 *   firedTurn?: number, turn: number, openEmergencyCents?: number, incomeCents?: number }} q
 * @returns {{ fire: boolean, principal: number, reason: string }}
 */
export function guardDecision({ enabled, projectedCents, upkeepCents = 0, lineCents, firedTurn, turn,
  openEmergencyCents = 0, incomeCents = 0 }) {
  if (!enabled) return { fire: false, principal: 0, reason: "off" };
  if (!Number.isInteger(lineCents)) return { fire: false, principal: 0, reason: "no-line" };
  const line = /** @type {number} */ (lineCents);
  if (firedTurn === turn) return { fire: false, principal: 0, reason: "already-fired" };
  if (projectedCents >= line) return { fire: false, principal: 0, reason: "above-line" };
  if (incomeCents > 0) return { fire: false, principal: 0, reason: "income-positive" };
  const principal = line - projectedCents + Math.max(0, upkeepCents);
  if (openEmergencyCents + principal > emergencyCap(incomeCents)) return { fire: false, principal, reason: "at-cap" };
  return { fire: true, principal, reason: "below-line" };
}
