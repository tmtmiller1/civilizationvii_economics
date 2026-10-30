// econ-inflation.js - Economics: inflation (DESIGN 4.8), as plain data, off by default (section 8). Prices can't be
// raised by script, so inflation erodes Gold held above a generous reserve and makes new bond loans dearer. Only civs
// with the Public debt stage take part: they share the bond market, which ties their money together, and it's the
// only Gold source from outside the game; erosion is the matching sink. Loan balances aren't eroded, so the 4.4
// schedule stays whole. Nothing here reads the engine.

import { INFLATION_RULES as I } from "./econ-params.js";

/**
 * pi = min(0.005, 0.02 * B / max(M, 1000)) a turn, in parts per million; 0 with no bond debt. M sums the members'
 * balances, each floored at 0; B is what they owe the bond market.
 * @param {{ bondOutstandingCents: number, memberBalancesCents: number[] }} q
 */
export function piPpm({ bondOutstandingCents, memberBalancesCents }) {
  if (!(bondOutstandingCents > 0)) return 0;
  let money = 0;
  for (const cents of memberBalancesCents) money += Math.max(0, cents);
  const raw = Math.floor((I.factorPpm * bondOutstandingCents) / Math.max(I.minMoneyCents, money));
  return Math.min(I.capPpm, raw);
}

/**
 * reserve = 20 * max(income, 10) Gold, in cents.
 * @param {number} incomeCents
 */
export function reserveCents(incomeCents) {
  return I.reserveTurns * Math.max(I.minIncomeCents, incomeCents);
}

/**
 * erosion = floor(pi * max(0, balance - reserve)), times the system's share (Corporatist 2x, DESIGN 4.17).
 * @param {{ piPpm: number, balanceCents: number, incomeCents: number, erosionPct?: number }} q
 */
export function erosionCents({ piPpm: pi, balanceCents, incomeCents, erosionPct = 100 }) {
  const above = Math.max(0, balanceCents - reserveCents(incomeCents));
  return Math.floor((pi * above * Math.max(0, erosionPct)) / (1000000 * 100));
}

/**
 * The bond rate's inflation premium: 50 * pi, at most 25%, in percent.
 * @param {number} pi parts per million
 */
export function premiumPct(pi) {
  return Math.min(I.premiumCapPct, Math.floor((Math.max(0, pi) * I.premiumPerPpm) / 10000));
}

/**
 * Who owes the most of B, for the Treasury tab's one sentence ("mostly Persia's"): the largest member's share.
 * @param {{ pid: number, cents: number }[]} debts
 */
export function largestDebtor(debts) {
  let best = null;
  for (const row of debts) if (row.cents > 0 && (!best || row.cents > best.cents)) best = row;
  return best;
}
