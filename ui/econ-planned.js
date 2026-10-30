// econ-planned.js - Economics: the plan of a Planned civ (DESIGN 4.17), as plain data. Each turn 20% of positive
// Gold income goes into the builds of the civ's cities that have something queued, split by population, at the game's
// own purchase rate (GOLD_PURCHASE_MULTIPLIER Gold a point, read by the glue; 4 when it can't be read). A city's
// `progressScalePct` says how much of a sent point lands (the glue's figure, 100; NOTES finding L), and the points sent
// are divided by it. Empty queues are
// skipped, and a city takes no more than its build still needs; the Gold a city can't use stays with the civ. No
// data effect turns Gold into production, so this is level 2: addProgress, which lands on AI builds as well as the
// player's (DESIGN 10, P8 and M7). Nothing here reads the engine.

import { PLANNED } from "./econ-params.js";

/**
 * The plan's take: 20% of positive income, in cents.
 * @param {number} incomeCents
 */
export function planTakeCents(incomeCents) {
  return Math.floor((PLANNED.takePct * Math.max(0, incomeCents)) / 100);
}

/**
 * The Gold a sent point costs in one city: the purchase rate times the share of a point that lands there. A missing
 * or unreadable rate is 4 Gold, a missing or unreadable share 100%.
 * @param {number | null | undefined} goldPerPointCents
 * @param {number | null | undefined} [scalePct]
 */
export function pointPriceCents(goldPerPointCents, scalePct) {
  const rate = Number.isInteger(goldPerPointCents) && /** @type {number} */ (goldPerPointCents) > 0
    ? /** @type {number} */ (goldPerPointCents) : PLANNED.fallbackGoldPerPoint * 100;
  const scale = Number.isFinite(scalePct) && /** @type {number} */ (scalePct) > 0
    ? /** @type {number} */ (scalePct) : 100;
  return Math.max(1, Math.round((rate * scale) / 100));
}

/**
 * The take split by population over the cities with a build that still needs progress; each city's share becomes
 * whole points at its point price, capped at what its build needs. What the whole points leave over goes to the
 * biggest cities first, a point at a time where it still buys one, so a small take isn't lost to rounding. A city with
 * no population read counts 1.
 * @param {number} takeCents
 * @param {CityRead[]} cities
 * @param {number | null} [goldPerPointCents] the game's purchase rate in cents
 * @returns {{ cityId: string, progress: number, cents: number }[]}
 */
export function planSplit(takeCents, cities, goldPerPointCents = null) {
  const open = (cities || []).filter((city) => city && city.build && city.neededProgress > 0);
  const weight = (/** @type {CityRead} */ city) => Math.max(1, Math.floor(Number(city.population)) || 1);
  let total = 0;
  for (const city of open) total += weight(city);
  if (!(takeCents > 0) || total === 0) return [];
  const rows = open.map((city) => ({ city, perPoint: pointPriceCents(goldPerPointCents, city.progressScalePct),
    progress: 0 }));
  let left = takeCents;
  for (const row of rows) {
    const share = Math.floor((takeCents * weight(row.city)) / total);
    row.progress = Math.min(row.city.neededProgress, Math.floor(share / row.perPoint));
    left -= row.progress * row.perPoint;
  }
  const biggest = [...rows].sort((a, b) => weight(b.city) - weight(a.city));
  for (const row of biggest) {
    const more = Math.min(row.city.neededProgress - row.progress, Math.floor(left / row.perPoint));
    if (more <= 0) continue;
    row.progress += more;
    left -= more * row.perPoint;
  }
  return rows.filter((row) => row.progress > 0)
    .map((row) => ({ cityId: row.city.id, progress: row.progress, cents: row.progress * row.perPoint }));
}
