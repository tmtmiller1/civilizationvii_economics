// econ-inflation.js - Economics: inflation (DESIGN 4.8), as plain data, off by default (section 8). Bond debt beside
// the Gold the bond market's members hold sets a rate each turn; each member's prices climb by its share of that rate,
// and the glue stands the price level in its capital as purchase-price markers (econ-standing.js PRICE), so the game's
// own purchase prices rise for the player and the AI alike. Only civs with the Public debt stage take part: they share
// the bond market, which ties their money together. Loan balances stay whole, so the 4.4 schedule does too. Nothing
// here reads the engine.

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

/** The price level stops at +127%, the sum of the price ladder's rungs (econ-standing.js OTHER_MARKERS.PRICE). */
export const LEVEL_CAP_PPM = 1270000;

/**
 * Next turn's price level, in ppm above the age's prices: it compounds by the civ's share of the rate (Corporatist
 * twice, Planned not at all, DESIGN 4.17; a recoinage halves it, 4.11c), and stops at LEVEL_CAP_PPM.
 * @param {{ levelPpm: number, piPpm: number, pricePct?: number }} q
 */
export function nextLevelPpm({ levelPpm, piPpm: pi, pricePct = 100 }) {
  const level = Math.max(0, levelPpm || 0);
  const rate = Math.floor((Math.max(0, pi) * Math.max(0, pricePct)) / 100);
  return Math.min(LEVEL_CAP_PPM, level + Math.floor(((1000000 + level) * rate) / 1000000));
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
