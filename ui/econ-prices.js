// econ-prices.js - Economics: a world price for each resource (DESIGN 4.9), as plain data. The glue reads the
// resource rows, the source copies at their origin, this age's strategic resources and the Industry count once a
// turn; this module turns them into a target price and smooths the price toward it. Resources come from the table
// the glue read, with every mod applied, so a removed resource drops out and a new one gets a price. Prices only feed
// the trade bills and the Markets tab: holding a resource pays nothing by itself (DESIGN 12 item 5). E is the business
// cycle's index (4.11, in basis points); from the Capitalism stage prices move faster toward their target (4.15).
// Nothing here reads the engine.

import { BASE_PRICE_CENTS, PRICES } from "./econ-params.js";

/**
 * The class's base price in cents; an unknown class is priced as the "other" row (2 Gold).
 * @param {string} resourceClass
 */
export function basePriceCents(resourceClass) {
  return Object.hasOwn(BASE_PRICE_CENTS, resourceClass) ? BASE_PRICE_CENTS[resourceClass] : PRICES.otherCents;
}

/**
 * scarcity = clamp(sqrt(civs / max(1, copies)), 0.5, 3.0), in percent.
 * @param {number} civs
 * @param {number} copies
 */
export function scarcityPct(civs, copies) {
  const ratio = Math.max(0, civs) / Math.max(1, copies);
  const pct = Math.round(Math.sqrt(ratio) * 100);
  return Math.max(PRICES.scarcityMinPct, Math.min(PRICES.scarcityMaxPct, pct));
}

/**
 * demand = 1.0, + 0.25 when this age's units use it, + 0.25 more while two civs are at war (for those same
 * resources), + 0.02 per Industry building for Factory resources (at most +1.0); in percent.
 * @param {{ strategic: boolean, war: boolean, factory: boolean, industry: number }} q
 */
export function demandPct({ strategic, war, factory, industry }) {
  let pct = 100;
  if (strategic) pct += PRICES.strategicPct + (war ? PRICES.warPct : 0);
  if (factory) pct += Math.min(PRICES.industryMaxPct, PRICES.industryPct * Math.max(0, Math.floor(industry) || 0));
  return pct;
}

/**
 * target = base * scarcity * demand * E, in cents; E in basis points (10000 is 1.0).
 * @param {{ type: string, class: string }} resource
 * @param {{ civs: number, copies: number, strategic: boolean, war: boolean, industry: number, eBp?: number }} q
 */
export function targetPriceCents(resource, { civs, copies, strategic, war, industry, eBp = 10000 }) {
  const factory = resource.class === "RESOURCECLASS_FACTORY";
  const demand = demandPct({ strategic, war, factory, industry });
  return Math.round((basePriceCents(resource.class) * scarcityPct(civs, copies) * demand * eBp) / 100000000);
}

/**
 * price = round(a * price + (1 - a) * target), a = 0.8; a resource with no price yet starts at its target.
 * @param {number | undefined} previous
 * @param {number} target
 * @param {number} [smoothingPct]
 */
export function smoothPrice(previous, target, smoothingPct = PRICES.smoothingPct) {
  if (!Number.isInteger(previous)) return target;
  return Math.round((smoothingPct * /** @type {number} */ (previous) + (100 - smoothingPct) * target) / 100);
}

/**
 * Whether any two of the civs are at war, from the relations rows.
 * @param {Relation[]} relations
 */
export function anyWar(relations) {
  return relations.some((row) => row.level === "war");
}

/**
 * The next prices and their history for every resource the market read lists; a resource the read no longer lists
 * drops out of both. `eBp` is the cycle's E; `capitalism` the Capitalism stage's faster smoothing (0.5).
 * @param {{ market: MarketRead, previous: MarketsState, civs: number, war: boolean, eBp?: number,
 *   capitalism?: boolean }} q
 * @returns {{ prices: Record<string, number>, history: Record<string, number[]> }}
 */
export function nextPrices({ market, previous, civs, war, eBp = 10000, capitalism = false }) {
  return pricesFrom({ market, previous, civs, war, eBp,
    smoothing: capitalism ? PRICES.capitalismSmoothingPct : PRICES.smoothingPct });
}

/**
 * @param {{ market: MarketRead, previous: MarketsState, civs: number, war: boolean, eBp: number,
 *   smoothing: number }} q
 */
function pricesFrom({ market, previous, civs, war, eBp, smoothing }) {
  const strategic = new Set(market.strategic || []);
  /** @type {Record<string, number>} */
  const prices = {};
  /** @type {Record<string, number[]>} */
  const history = {};
  for (const resource of market.resources || []) {
    if (!resource || typeof resource.type !== "string") continue;
    const target = targetPriceCents(resource, { civs, copies: market.copies?.[resource.type] || 0,
      strategic: strategic.has(resource.type), war, industry: market.industry || 0, eBp });
    const price = smoothPrice(previous.prices[resource.type], target, smoothing);
    prices[resource.type] = price;
    history[resource.type] = [...(previous.history[resource.type] || []), price].slice(-PRICES.historyTurns);
  }
  return { prices, history };
}

/**
 * The price of one copy for the bill; a resource with no price (not in this age's table) is worth nothing.
 * @param {Record<string, number>} prices
 * @param {string} type
 */
export function priceOf(prices, type) {
  return Number.isInteger(prices[type]) ? prices[type] : 0;
}
