// econ-planned.js - Economics: the plan of a Planned civ (DESIGN 4.17), as plain data. Each turn 20% of positive
// Gold income goes into the builds of the civ's cities that have something queued, split by population, at the
// development loan's ratio (3 Gold a point, 4.12). Empty queues are skipped, and a city takes no more than its build
// still needs; the Gold a city can't use stays with the civ. No data effect turns Gold into production, so this is
// level 2: addProgress, which P8 and M7 watched landing on AI builds. Nothing here reads the engine.

import { PLANNED } from "./econ-params.js";

/**
 * The plan's take: 20% of positive income, in cents.
 * @param {number} incomeCents
 */
export function planTakeCents(incomeCents) {
  return Math.floor((PLANNED.takePct * Math.max(0, incomeCents)) / 100);
}

/**
 * The take split by population over the cities with a build that still needs progress; each city's share becomes
 * whole points at 3 Gold a point, capped at what its build needs. A city with no population read counts 1.
 * @param {number} takeCents
 * @param {CityRead[]} cities
 * @returns {{ cityId: string, progress: number, cents: number }[]}
 */
export function planSplit(takeCents, cities) {
  const open = (cities || []).filter((city) => city && city.build && city.neededProgress > 0);
  const weight = (/** @type {CityRead} */ city) => Math.max(1, Math.floor(Number(city.population)) || 1);
  let total = 0;
  for (const city of open) total += weight(city);
  if (!(takeCents > 0) || total === 0) return [];
  const perPoint = PLANNED.goldPerProgress * 100;
  /** @type {{ cityId: string, progress: number, cents: number }[]} */
  const out = [];
  for (const city of open) {
    const share = Math.floor((takeCents * weight(city)) / total);
    const progress = Math.min(city.neededProgress, Math.floor(share / perPoint));
    if (progress > 0) out.push({ cityId: city.id, progress, cents: progress * perPoint });
  }
  return out;
}
