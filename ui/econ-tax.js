// econ-tax.js - Economics: the script fallback for taxes (DESIGN 4.7). Taxes ship as policy cards the game pays
// itself; this module only runs if probe P17 shows the cards can't work, and then for player and AI alike. It is off
// unless the plan is given `options.taxFallback: true`. Gold is a share of max(0, income); the celebration meter
// moves by the same share of max(0, happiness per turn), through grantYield (P6).

import { AI } from "./econ-params.js";

/** @type {Record<string, { goldPct: number, happinessPct: number, needsWar?: boolean }>} */
export const TAX_LEVELS = {
  light: { goldPct: -15, happinessPct: 20 },
  standard: { goldPct: 0, happinessPct: 0 },
  heavy: { goldPct: 15, happinessPct: -20 },
  warLevy: { goldPct: 30, happinessPct: -40, needsWar: true },
};
export const TAX_CHANGE_EVERY = 5;

/** @param {unknown} level */
export function isTaxLevel(level) {
  return typeof level === "string" && Object.hasOwn(TAX_LEVELS, level);
}

/**
 * War Levy outside a war with a major civ reads as Standard.
 * @param {unknown} level
 * @param {boolean} atWar
 */
export function effectiveTaxLevel(level, atWar) {
  if (!isTaxLevel(level)) return "standard";
  const name = /** @type {string} */ (level);
  return TAX_LEVELS[name].needsWar && !atWar ? "standard" : name;
}

/**
 * { goldCents, celebrationCents } for one turn; both are 0 at Standard and on a civ with nothing to tax.
 * @param {{ level: unknown, incomeCents: number, happinessCents?: number, atWar?: boolean }} q
 */
export function taxFlow({ level, incomeCents, happinessCents = 0, atWar = false }) {
  const tax = TAX_LEVELS[effectiveTaxLevel(level, atWar)];
  const base = Math.max(0, incomeCents);
  const meter = Math.max(0, happinessCents);
  return { goldCents: Math.trunc((base * tax.goldPct) / 100) || 0,
    celebrationCents: Math.trunc((meter * tax.happinessPct) / 100) || 0 };
}

/**
 * One change per 5 turns.
 * @param {number | undefined} lastChangeTurn
 * @param {number} turn
 */
export function canChangeTax(lastChangeTurn, turn) {
  return !Number.isInteger(lastChangeTurn) || turn - /** @type {number} */ (lastChangeTurn) >= TAX_CHANGE_EVERY;
}

/**
 * DESIGN 6, fallback only: Heavy if the balance is under 5 turns of |income| and falling, or the civ is insolvent
 * (War Levy at war); Light if income > 0 and the balance is over 30 turns of it; else Standard.
 * @param {{ balanceCents: number, incomeCents: number, falling?: boolean, insolvent?: boolean, atWar?: boolean }} q
 */
export function aiTaxLevel({ balanceCents, incomeCents, falling = false, insolvent = false, atWar = false }) {
  const short = balanceCents < 5 * Math.max(Math.abs(incomeCents), AI.minIncomeCents);
  if (insolvent || (short && falling)) return atWar ? "warLevy" : "heavy";
  if (incomeCents > 0 && balanceCents > 30 * incomeCents) return "light";
  return "standard";
}
