// econ-price-read.js - Economics: what a civ's price markers really do (DESIGN 4.8). The same stack raises different
// civs' prices by different amounts (each civ's own purchase modifiers combine with it), so when a civ's stack changes
// the glue reads one of its purchase prices before and again once the new markers stand, and keeps the ratio as the
// civ's price factor; the plan scales the next stack from it and the Treasury tab shows it.

import { priceProbe, probeCents } from "./econ-standing-read.js";
import { rungsFor, rungsOf } from "./econ-standing.js";
import { logDebug } from "./econ-log.js";

/** @typedef {import("./econ-standing-read.js").HeldMarker} HeldMarker */

/** How long after its markers are sent a civ's purchase price is read again: they land within a second. */
const PRICE_SETTLE_MS = 1500;

/**
 * When a civ's price stack changes, a purchase price read now and again once the new markers stand gives what the
 * change really did, kept in the glue as the civ's price factor (`prices`): the plan scales the next stack from it and
 * the Treasury tab shows it (econ-standing.js priceStackFor). Returns the step that reads the price after, or null.
 * @param {{ prices?: Record<string, { stack: number, factorPpm: number }> }} glue
 * @param {number} pid
 * @param {Map<import("./econ-standing.js").StandingLine, number>} wanted
 * @param {HeldMarker[]} held
 * @param {() => void} save writes the glue
 */
export function priceChange(glue, pid, wanted, held, save) {
  const prices = (glue.prices ||= {});
  const key = String(pid);
  const from = held.filter((m) => m.line === "PRICE").reduce((sum, m) => sum + m.rung, 0);
  const to = rungsOf(wanted.get("PRICE") || 0, rungsFor("PRICE")).reduce((sum, n) => sum + n, 0);
  if (from === to) return null;
  if (to === 0) {
    prices[key] = { stack: 0, factorPpm: 1000000 };
    return save;
  }
  const known = knownFactor(prices[key], from);
  const probe = known === null ? null : priceProbe(pid);
  if (!probe || known === null) return null;
  return () => setTimeout(() => {
    const after = probeCents(pid, probe.type);
    if (after === null) return;
    prices[key] = { stack: to, factorPpm: Math.round((known * after) / probe.cents) };
    logDebug(`prices for ${pid}: stack ${from} -> ${to}, ${probe.type} ${probe.cents} -> ${after}`);
    save();
  }, PRICE_SETTLE_MS);
}

/**
 * The factor the civ's current stack was measured at, 1,000,000 when no stack stands, or null when it's not known.
 * @param {{ stack: number, factorPpm: number } | undefined} row
 * @param {number} stack
 */
function knownFactor(row, stack) {
  if (row && row.stack === stack) return row.factorPpm;
  return stack === 0 ? 1000000 : null;
}

