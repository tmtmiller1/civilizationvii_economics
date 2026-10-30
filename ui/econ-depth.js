// econ-depth.js - Economics: financial depth from a civ's buildings (DESIGN 4.13), as plain data. The glue reads each
// building's tags, base Gold yield and state from GameInfo and the city; this module gives it a role and sums the
// civ's depth, which the model applies to credit_cap (depth_turns) and the rates (depth_factor). Commerce and Banking
// set depth (1.0); Trade moves the bills and Industry the Factory resources' demand (1.1); Warehouse cuts a negative
// L in the business cycle (1.2). From 1.2 an old building's roles weigh what econ-legacy.js gives them (DESIGN
// 4.16). Nothing here reads the engine.

export const DEPTH = { goldPerDepth: 4, factorPerDepthPct: 2, factorCapPct: 30, bankingCapPct: 40, bankingTurns: 2,
  maxTurns: 12, wonderPct: 5, wonderCapPct: 15, bankGoldFallback: 8 };
/** A Banking building carries none of these tags (so a Port with a Bank's Gold isn't a bank). */
export const BANKING_EXCLUDED_TAGS = ["WATER", "BRIDGE", "RAIL_CONNECTION"];
export const COMMERCE_TAG = "GOLD";
export const ECONOMIC_ADVISORY = "ADVISORY_CLASS_ECONOMIC";
export const TRADE_TAG = "TRADE";
export const TRADE_ADVISORY = "ADVISORY_CLASS_TRADE";
export const WAREHOUSE_TAG = "WAREHOUSE";
export const PRODUCTION_TAG = "PRODUCTION";

/**
 * @typedef {{ tags: string[], goldYield: number, isWonder: boolean, advisories: string[], age?: string | null,
 *   unique?: boolean }} BuildingData
 * @typedef {{ commerce: boolean, banking: boolean, economicWonder: boolean, trade: boolean, warehouse: boolean,
 *   industry: boolean }} BuildingRoles
 */

/**
 * The roles of one building type (DESIGN 4.13); a building can have several. `bankGold` is the Bank's base Gold
 * yield, read from the same data. Wonders take only the economic-wonder role.
 * @param {BuildingData} row
 * @param {number} bankGold
 * @returns {BuildingRoles}
 */
export function rolesOf(row, bankGold) {
  const tags = row.tags || [];
  const advisories = row.advisories || [];
  if (row.isWonder === true) {
    return { commerce: false, banking: false, economicWonder: advisories.includes(ECONOMIC_ADVISORY), trade: false,
      warehouse: false, industry: false };
  }
  const gold = Number.isFinite(row.goldYield) ? row.goldYield : 0;
  const commerce = tags.includes(COMMERCE_TAG);
  const banking = commerce && gold >= bankGold && !tags.some((tag) => BANKING_EXCLUDED_TAGS.includes(tag));
  return { commerce, banking, economicWonder: false,
    trade: tags.includes(TRADE_TAG) || advisories.includes(TRADE_ADVISORY), warehouse: tags.includes(WAREHOUSE_TAG),
    industry: tags.includes(PRODUCTION_TAG) && advisories.includes(ECONOMIC_ADVISORY) };
}

/**
 * Whether a development loan on this building pays the higher return (DESIGN 4.12): Commerce, Banking, Trade or
 * Industry.
 * @param {BuildingRoles} roles
 */
export function isRoleBuilding(roles) {
  return roles.commerce || roles.banking || roles.trade || roles.industry;
}

/**
 * One role's weight for a building: 0 when damaged, else its role weight from DESIGN 4.16 (1.0 unless it has aged).
 * @param {{ weight: number, weights?: Record<string, number> }} building
 * @param {string} role
 */
export function roleWeightOf(building, role) {
  const w = Math.max(0, Number(building.weight) || 0);
  const aged = building.weights?.[role];
  return Number.isFinite(aged) ? w * Math.max(0, /** @type {number} */ (aged)) : w;
}

/**
 * The counts the 1.1 and 1.2 rules read: Trade buildings (the bills), Industry buildings (Factory demand) and
 * Warehouse buildings (the cycle's cut), each weighted.
 * @param {{ roles: BuildingRoles, weight: number, weights?: Record<string, number> }[]} buildings
 */
export function countRoles(buildings) {
  let trade = 0;
  let industry = 0;
  let warehouse = 0;
  for (const building of buildings) {
    const w = Math.max(0, Number(building.weight) || 0);
    if (building.roles.trade) trade += roleWeightOf(building, "trade");
    if (building.roles.industry) industry += w;
    if (building.roles.warehouse) warehouse += w;
  }
  return { trade, industry, warehouse };
}

/**
 * depth = sum of w * Gold / 4 over Commerce buildings; depth_turns = min(12, 2 * sum of w over Banking buildings);
 * depth_factor = (1 - min(cap, 0.02 * depth)) * (1 - min(0.15, 0.05 * economic wonders)), as a percentage. `weight`
 * is 0 for a damaged building and 1 otherwise; `weights` carries an old building's fade per role (DESIGN 4.16).
 * `commercePct` is Civic market's 1.25 (4.17); `capPct` is 0.4 from the Banking stage, else 0.3 (4.15).
 * @param {{ roles: BuildingRoles, goldYield: number, weight: number, weights?: Record<string, number> }[]} buildings
 * @param {{ commercePct?: number, capPct?: number }} [q]
 */
export function computeDepth(buildings, { commercePct = 100, capPct = DEPTH.factorCapPct } = {}) {
  let depth = 0;
  let banking = 0;
  let wonders = 0;
  for (const building of buildings) {
    const w = Math.max(0, Number(building.weight) || 0);
    if (building.roles.commerce) {
      depth += (roleWeightOf(building, "commerce") * (Number(building.goldYield) || 0) * commercePct)
        / (DEPTH.goldPerDepth * 100);
    }
    if (building.roles.banking) banking += roleWeightOf(building, "banking");
    if (building.roles.economicWonder) wonders += w;
  }
  const depthTurns = Math.min(DEPTH.maxTurns, Math.floor(DEPTH.bankingTurns * banking));
  const depthCut = Math.min(capPct, DEPTH.factorPerDepthPct * depth);
  const wonderCut = Math.min(DEPTH.wonderCapPct, DEPTH.wonderPct * wonders);
  const depthFactorPct = Math.round((100 - depthCut) * (100 - wonderCut) / 100);
  return { depth, depthTurns, depthFactorPct, bankingCount: banking, wonderCount: wonders };
}
