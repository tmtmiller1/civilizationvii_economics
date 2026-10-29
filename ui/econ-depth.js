// econ-depth.js - Economics: financial depth from a civ's buildings (DESIGN 4.13), as plain data. The glue reads each
// building's tags, base Gold yield and state from GameInfo and the city; this module gives it a role and sums the
// civ's depth, which the model applies to credit_cap (depth_turns) and the rates (depth_factor). Only the Commerce
// and Banking roles ship in 1.0 (DESIGN 11); the other roles belong to 1.1 and 1.2. Nothing here reads the engine.

export const DEPTH = { goldPerDepth: 4, factorPerDepthPct: 2, factorCapPct: 30, bankingTurns: 2, maxTurns: 12,
  wonderPct: 5, wonderCapPct: 15, bankGoldFallback: 8 };
/** A Banking building carries none of these tags (so a Port with a Bank's Gold isn't a bank). */
export const BANKING_EXCLUDED_TAGS = ["WATER", "BRIDGE", "RAIL_CONNECTION"];
export const COMMERCE_TAG = "GOLD";
export const ECONOMIC_ADVISORY = "ADVISORY_CLASS_ECONOMIC";

/**
 * @typedef {{ tags: string[], goldYield: number, isWonder: boolean, advisories: string[] }} BuildingData
 * @typedef {{ commerce: boolean, banking: boolean, economicWonder: boolean }} BuildingRoles
 */

/**
 * The 1.0 roles of one building type. `bankGold` is the Bank's base Gold yield, read from the same data.
 * @param {BuildingData} row
 * @param {number} bankGold
 * @returns {BuildingRoles}
 */
export function rolesOf(row, bankGold) {
  const tags = row.tags || [];
  const gold = Number.isFinite(row.goldYield) ? row.goldYield : 0;
  const commerce = tags.includes(COMMERCE_TAG) && !row.isWonder;
  const banking = commerce && gold >= bankGold && !tags.some((tag) => BANKING_EXCLUDED_TAGS.includes(tag));
  const economicWonder = row.isWonder === true && (row.advisories || []).includes(ECONOMIC_ADVISORY);
  return { commerce, banking, economicWonder };
}

/**
 * depth = sum of w * Gold / 4 over Commerce buildings; depth_turns = min(12, 2 * sum of w over Banking buildings);
 * depth_factor = (1 - min(0.3, 0.02 * depth)) * (1 - min(0.15, 0.05 * economic wonders)), as a percentage.
 * `weight` is 0 for a damaged building and 1 otherwise (previous-age fading is 1.2's rule, DESIGN 4.16).
 * @param {{ roles: BuildingRoles, goldYield: number, weight: number }[]} buildings
 */
export function computeDepth(buildings) {
  let depth = 0;
  let banking = 0;
  let wonders = 0;
  for (const building of buildings) {
    const w = Math.max(0, Number(building.weight) || 0);
    if (building.roles.commerce) depth += (w * (Number(building.goldYield) || 0)) / DEPTH.goldPerDepth;
    if (building.roles.banking) banking += w;
    if (building.roles.economicWonder) wonders += w;
  }
  const depthTurns = Math.min(DEPTH.maxTurns, Math.floor(DEPTH.bankingTurns * banking));
  const depthCut = Math.min(DEPTH.factorCapPct, DEPTH.factorPerDepthPct * depth);
  const wonderCut = Math.min(DEPTH.wonderCapPct, DEPTH.wonderPct * wonders);
  const depthFactorPct = Math.round((100 - depthCut) * (100 - wonderCut) / 100);
  return { depth, depthTurns, depthFactorPct, bankingCount: banking, wonderCount: wonders };
}
