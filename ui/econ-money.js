// econ-money.js - Economics: money and rate arithmetic. Gold is held in integer cents and rates in integer parts per
// million, so every amount the ledger stores is exact; floats appear only where the engine's numbers come in or go out.

export const CENTS_PER_GOLD = 100;
export const PPM = 1_000_000;

/**
 * Gold as the engine reports it, to integer cents; anything unreadable is 0.
 * @param {unknown} gold
 * @returns {number}
 */
export function toCents(gold) {
  const value = Number(gold);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTS_PER_GOLD) || 0;
}

/** @param {number} cents */
export function toGold(cents) {
  return cents / CENTS_PER_GOLD;
}

/**
 * a / b rounded half up, for a >= 0 and b > 0 integers.
 * @param {number} a
 * @param {number} b
 */
export function divRound(a, b) {
  return Math.floor((2 * a + b) / (2 * b));
}

/**
 * @param {number} a
 * @param {number} b
 */
export function divCeil(a, b) {
  return Math.floor((a + b - 1) / b);
}

/** @param {number} fraction */
export function ppmOf(fraction) {
  return Math.round(fraction * PPM);
}

/**
 * cents * rate, rounded to the cent.
 * @param {number} cents
 * @param {number} ppm
 */
export function applyPpm(cents, ppm) {
  return divRound(cents * ppm, PPM);
}
