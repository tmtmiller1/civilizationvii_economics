// econ-format.js - Economics: numbers as the screens and notices show them. Cents become Gold with one decimal only
// where the amount isn't whole, rates in parts per million become percentages. Nothing here reads the engine, so
// the same text shows on every screen and in every test.

import { PPM } from "./econ-money.js";

/**
 * "120" or "120.5"; with `signed`, "+120" or "-4.5"; 0 stays "0".
 * @param {number} cents
 * @param {{ signed?: boolean }} [options]
 */
export function formatGold(cents, { signed = false } = {}) {
  // Rounded to the tenth shown first, so a few cents read "0" rather than "-0.0".
  const value = Number.isFinite(cents) ? Math.round(cents / 10) / 10 : 0;
  const whole = Number.isInteger(value);
  const text = whole ? String(Math.abs(value)) : Math.abs(value).toFixed(1);
  if (value < 0) return `-${text}`;
  return signed && value > 0 ? `+${text}` : text;
}

/**
 * A rate per turn as a percentage with one decimal: 30000 ppm is "3.0%".
 * @param {number} ppm
 */
export function formatRate(ppm) {
  const pct = Number.isFinite(ppm) ? (ppm * 100) / PPM : 0;
  return `${pct.toFixed(1)}%`;
}

/**
 * A whole percentage with its sign: 15 is "+15%", -20 is "-20%", 0 is "0%".
 * @param {number} pct
 */
export function formatPct(pct) {
  const value = Number.isFinite(pct) ? Math.round(pct) : 0;
  return value > 0 ? `+${value}%` : `${value}%`;
}

/**
 * A factor such as 0.9 shown as "x0.90".
 * @param {number} pct
 */
export function formatFactor(pct) {
  const value = Number.isFinite(pct) ? pct / 100 : 1;
  return `x${value.toFixed(2)}`;
}
