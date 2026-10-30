// econ-legacy.js - Economics: old buildings across the ages (DESIGN 4.16), as plain data. The game treats a
// previous-age building as antiquated and lets it be built over; in the mod it fades instead, role by role, and what
// it loses becomes a slump cushion (4.11). No requirement in the game's data tests one building's own age, so the fade
// is the mod's own rule (level 3). Each weight is worked out fresh every turn from the building's age, the current
// age, the turn the role's successor stage opened, the age's first turn and whether the same city has a current-age
// building of the role, so nothing is stored per building. Weights are in basis points (10000 is 1.0). Nothing here
// reads the engine.

import { CYCLE_RULES } from "./econ-params.js";

export const LEGACY = { full: 10000, oneAgeFloor: 5000, twoAgeFloor: 2500, fadePerTurn: 500 };

/** The roles that fade; Industry, Warehouse and economic wonders never do. */
export const FADING_ROLES = ["commerce", "trade", "banking"];

// The successor stage for each fading role, by the age the building belongs to (DESIGN 4.16's table): an Antiquity
// building in Exploration fades from Public debt (Commerce) and Guild patronage (Trade); an Exploration building in
// Modern from Capitalism. Antiquity has no Banking building.
/** @type {Record<number, Record<string, string | null>>} */
export const SUCCESSOR_STAGES = {
  0: { commerce: "publicDebt", trade: "guildPatronage", banking: null },
  1: { commerce: "capitalism", trade: "capitalism", banking: "capitalism" },
};

/**
 * @typedef {{ ageIndex: number | null, ageless: boolean, wonder: boolean, unique: boolean,
 *   roles: { commerce: boolean, trade: boolean, banking: boolean }, cityHasCurrent: Record<string, boolean> }}
 *   LegacyBuilding
 * @typedef {{ currentAgeIndex: number, stageTurns: Record<string, number | null | undefined>, ageStartTurn: number,
 *   turn: number }} LegacyCiv
 */

/**
 * Whether a building ages: an earlier age than this one, and none of AGELESS, a wonder or a unique (DESIGN 4.16).
 * A mod that removes AGELESS makes the building age.
 * @param {LegacyBuilding} building
 * @param {number} currentAgeIndex
 */
export function isOld(building, currentAgeIndex) {
  if (building.ageless || building.wonder || building.unique) return false;
  return Number.isInteger(building.ageIndex) && /** @type {number} */ (building.ageIndex) < currentAgeIndex;
}

/**
 * One fading role's weight. One age old: 1.0 until the role's successor stage, then -0.05 a turn to 0.5. Two ages
 * old: 0.5 at the age's start, -0.05 a turn to 0.25. A current-age building of the role in the same city drops it to
 * its floor at once.
 * @param {{ ages: number, role: string, buildingAgeIndex: number, cityHasCurrent: boolean }} building
 * @param {LegacyCiv} civ
 */
export function roleWeight({ ages, role, buildingAgeIndex, cityHasCurrent }, civ) {
  if (ages <= 0) return LEGACY.full;
  if (ages >= 2) {
    if (cityHasCurrent) return LEGACY.twoAgeFloor;
    const fade = LEGACY.fadePerTurn * Math.max(0, civ.turn - civ.ageStartTurn);
    return Math.max(LEGACY.twoAgeFloor, LEGACY.oneAgeFloor - fade);
  }
  if (cityHasCurrent) return LEGACY.oneAgeFloor;
  const stage = SUCCESSOR_STAGES[buildingAgeIndex]?.[role] ?? null;
  const reached = stage ? civ.stageTurns[stage] : null;
  if (!Number.isInteger(reached) || /** @type {number} */ (reached) > civ.turn) return LEGACY.full;
  const since = Math.max(/** @type {number} */ (reached), civ.ageStartTurn);
  return Math.max(LEGACY.oneAgeFloor, LEGACY.full - LEGACY.fadePerTurn * (civ.turn - since));
}

/**
 * The weight of each fading role a building has; a role it doesn't have, and every role of a building that doesn't
 * age, weighs 1.0.
 * @param {LegacyBuilding} building
 * @param {LegacyCiv} civ
 * @returns {Record<string, number>}
 */
export function buildingWeights(building, civ) {
  /** @type {Record<string, number>} */
  const out = { commerce: LEGACY.full, trade: LEGACY.full, banking: LEGACY.full };
  if (!isOld(building, civ.currentAgeIndex)) return out;
  const ages = civ.currentAgeIndex - /** @type {number} */ (building.ageIndex);
  for (const role of FADING_ROLES) {
    if (!building.roles[/** @type {"commerce" | "trade" | "banking"} */ (role)]) continue;
    out[role] = roleWeight({ ages, role, buildingAgeIndex: /** @type {number} */ (building.ageIndex),
      cityHasCurrent: building.cityHasCurrent?.[role] === true }, civ);
  }
  return out;
}

/**
 * What one old building adds to legacy: 1 - w, with w averaged over the fading roles it has, in basis points.
 * @param {LegacyBuilding} building
 * @param {Record<string, number>} weights
 */
export function legacyOf(building, weights) {
  const roles = FADING_ROLES.filter((role) => building.roles[/** @type {"commerce" | "trade" | "banking"} */ (role)]);
  if (!roles.length) return 0;
  let sum = 0;
  for (const role of roles) sum += weights[role];
  return LEGACY.full - Math.round(sum / roles.length);
}

/**
 * cushion = min(0.10, 0.01 * legacy), in basis points; legacy is in basis points of a building.
 * @param {number} legacyBp
 */
export function cushionBp(legacyBp) {
  return Math.min(CYCLE_RULES.cushionMaxBp, Math.floor(Math.max(0, legacyBp) / 100));
}
