// econ-macro-read.js - Economics: the engine reads 1.2 adds (DESIGN 4.11, 4.16, 4.17), for every major civ by the
// same calls (docs/glue-contract.md). Each civ's government (Culture.getGovernmentType) and ideology
// (Culture.getChosenIdeology, which agreed with the completed branch roots for every civ in the M5 probe, with the
// roots as the fallback); the age crisis stage (P12); each civ's buildings with their age, weighted by econ-legacy.js;
// and the cycle's engine events between batches: a capture (CityTransfered), a raze (CityRazingStarted) and a
// disaster on a civ's land (RandomEventOccurred), each kept in the glue envelope until the next batch. A previous
// age's buildings carry no tags in the next age's database (NOTES finding J), so the roles each building had in its
// own age are remembered as the glue sees them. Nothing here decides anything.

import { ageIndex, ageIndexOf, bankGoldYield, buildingData, readCityBuildings, safe } from "./econ-engine.js";
import { cityKey } from "./econ-commerce-read.js";
import { COMMERCE_TAG, DEPTH, ECONOMIC_ADVISORY, computeDepth, countRoles, roleWeightOf, rolesOf }
  from "./econ-depth.js";
import { FADING_ROLES, LEGACY, SUCCESSOR_STAGES, buildingWeights, cushionBp, isOld, legacyOf }
  from "./econ-legacy.js";

const INFRASTRUCTURE_ADVISORY = "ADVISORY_CLASS_INFRASTRUCTURE";
const ROLE_LETTERS = { commerce: "c", banking: "b", trade: "t", warehouse: "w", industry: "i", economicWonder: "e" };
const MAX_PENDING = 32;

/**
 * @typedef {import("./econ-engine.js").CityBuilding} CityBuilding
 * @typedef {{ kind: "capture" | "raze" | "disaster", pid: number, city?: string | null, pop?: number | null,
 *   food?: boolean }} PendingCycleEvent
 * @typedef {CityBuilding & { city: string, ageIndex: number | null, old: boolean, ages: number, legacyBp: number,
 *   replaced: string[], fadingFrom: string[] }} EconomyBuilding
 */

/**
 * The government type a civ runs, or null before it has one (the first turns of an age).
 * @param {number} pid
 */
export function readGovernment(pid) {
  const hash = safe(() => Players.get(pid).Culture.getGovernmentType(), null);
  if (hash === null || hash === -1) return null;
  return safe(() => String(GameInfo.Governments.lookup(hash).GovernmentType), /** @type {string | null} */ (null));
}

/**
 * The ideology type a civ has chosen, or null: getChosenIdeology first, then the completed root of each ideology tree.
 * @param {number} pid
 */
export function readIdeology(pid) {
  const culture = safe(() => Players.get(pid).Culture, null);
  if (!culture) return null;
  const hash = safe(() => culture.getChosenIdeology(), null);
  const chosen = hash === null || hash === -1 ? null
    : safe(() => String(GameInfo.Ideologies.lookup(hash).IdeologyType), /** @type {string | null} */ (null));
  if (chosen) return chosen;
  for (const row of safe(() => GameInfo.Ideologies, /** @type {any[]} */ ([])) || []) {
    if (safe(() => culture.isNodeUnlocked(row.FirstTreeNode) === true, false)) return String(row.IdeologyType);
  }
  return null;
}

/** The age crisis stage (P12): -1 before one starts, 0 to 2 while it runs, 3 when it's over. */
export function readCrisisStage() {
  const stage = safe(() => Number(Game.CrisisManager.getCurrentCrisisStage(0)), -1);
  return Number.isInteger(stage) ? stage : -1;
}

/**
 * The role letters a building has, for the glue envelope's memory.
 * @param {Record<string, boolean>} roles
 */
export function roleLetters(roles) {
  let out = "";
  for (const [role, letter] of Object.entries(ROLE_LETTERS)) if (roles[role]) out += letter;
  return out;
}

/**
 * A building's roles with the ones it had in its own age added back.
 * @param {Record<string, boolean>} roles
 * @param {string | undefined} remembered
 * @returns {import("./econ-depth.js").BuildingRoles}
 */
export function withRemembered(roles, remembered) {
  /** @type {Record<string, boolean>} */
  const out = { ...roles };
  for (const [role, letter] of Object.entries(ROLE_LETTERS)) if (remembered?.includes(letter)) out[role] = true;
  return /** @type {import("./econ-depth.js").BuildingRoles} */ (out);
}

/**
 * The Commerce (and Banking) a building from an earlier age had, when nothing remembers it: a game started in a later
 * age (C.30, the owner's call 2026-11-04). The current age's data drops an old building's tags, so one with a base Gold
 * yield that the game files as economic, and not as infrastructure, counts as Commerce, and Banking follows from its
 * Gold as it would have. Against the game's data (2026-11-04) that's Antiquity's Market, Lighthouse and Mortuary
 * Temple and Exploration's Bank, Bazaar and Guildhall, and neither bridge. A building that still has tags, or one
 * the memory holds, keeps what it reads.
 * @param {import("./econ-depth.js").BuildingRoles} roles
 * @param {import("./econ-depth.js").BuildingData | undefined} data
 * @returns {import("./econ-depth.js").BuildingRoles}
 */
export function withInferredCommerce(roles, data) {
  if (!data || data.tags.length || roles.commerce || !(data.goldYield > 0)) return roles;
  const advisories = data.advisories || [];
  if (!advisories.includes(ECONOMIC_ADVISORY) || advisories.includes(INFRASTRUCTURE_ADVISORY)) return roles;
  const inferred = rolesOf({ ...data, tags: [COMMERCE_TAG] }, bankGoldYield());
  return { ...roles, commerce: true, banking: roles.banking || inferred.banking };
}

/**
 * Remembers the roles of the buildings that belong to this age, read with this age's data and every mod applied.
 * @param {Record<string, string>} memory
 * @param {CityBuilding[]} buildings
 * @param {string} age
 */
export function rememberRoles(memory, buildings, age) {
  for (const building of buildings) {
    if (building.age !== age) continue;
    const letters = roleLetters(/** @type {Record<string, boolean>} */ (/** @type {unknown} */ (building.roles)));
    if (letters) memory[building.type] = letters;
  }
  return memory;
}

/**
 * @typedef {{ turn: number, ageStartTurn: number, age: string, stageTurns: Record<string, number | null | undefined>,
 *   memory: Record<string, string>, commercePct: number, bankingOpen: boolean }} EconomyQuery
 */

/**
 * The fading roles a city has current-age buildings for, standing ones only.
 * @param {(CityBuilding & { ageIndex: number | null })[]} list
 * @param {number} currentAgeIndex
 */
function currentRoles(list, currentAgeIndex) {
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const building of list) {
    if (building.ageIndex !== currentAgeIndex || !(building.weight > 0)) continue;
    for (const role of FADING_ROLES) {
      if (building.roles[/** @type {"commerce" | "trade" | "banking"} */ (role)]) out[role] = true;
    }
  }
  return out;
}

/**
 * A building's roles: the ones it had in its own age when they're remembered, else the Commerce inferred for a
 * building from an earlier age.
 * @param {CityBuilding} building
 * @param {string | undefined} remembered
 * @param {Map<string, import("./econ-depth.js").BuildingData>} data
 * @param {number} currentAgeIndex
 */
function rolesFor(building, remembered, data, currentAgeIndex) {
  const roles = withRemembered(/** @type {any} */ (building.roles), remembered);
  const index = building.age ? ageIndexOf(building.age) : null;
  if (remembered !== undefined || index === null || index >= currentAgeIndex) return roles;
  return withInferredCommerce(roles, data.get(building.type));
}

/**
 * One city's buildings with their remembered roles, ages and, for old ones, their weights and legacy.
 * @param {any} city
 * @param {EconomyQuery} q
 * @param {number} currentAgeIndex
 * @returns {EconomyBuilding[]}
 */
function cityEconomy(city, q, currentAgeIndex) {
  const key = cityKey(safe(() => city.id, null)) || "";
  const data = buildingData();
  const list = readCityBuildings(city).map((building) => ({ ...building,
    roles: rolesFor(building, q.memory[building.type], data, currentAgeIndex),
    ageIndex: building.age ? ageIndexOf(building.age) : null }));
  const here = currentRoles(list, currentAgeIndex);
  const civ = { currentAgeIndex, stageTurns: q.stageTurns, ageStartTurn: q.ageStartTurn, turn: q.turn };
  return list.map((building) => {
    const legacyRow = { ageIndex: building.ageIndex, ageless: building.ageless, wonder: building.wonder,
      unique: building.unique, roles: building.roles, cityHasCurrent: here };
    const old = isOld(legacyRow, currentAgeIndex);
    if (!old) return { ...building, city: key, old, ages: 0, legacyBp: 0, replaced: [], fadingFrom: [] };
    const weights = buildingWeights(legacyRow, civ);
    return { ...building, city: key, old, ages: currentAgeIndex - /** @type {number} */ (building.ageIndex),
      weights: toShares(weights), legacyBp: legacyOf(legacyRow, weights),
      replaced: FADING_ROLES.filter((role) => here[role] && legacyRow.roles[/** @type {"trade"} */ (role)]),
      fadingFrom: fadingStages(building.ageIndex, legacyRow.roles, q.stageTurns) };
  });
}

/**
 * Basis points to shares of 1.0, as the depth arithmetic weighs.
 * @param {Record<string, number>} weights
 */
function toShares(weights) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [role, bp] of Object.entries(weights)) out[role] = bp / LEGACY.full;
  return out;
}

/**
 * The successor stages a one-age-old building's roles wait on (for the Treasury tab's "fades when you reach").
 * @param {number | null} buildingAgeIndex
 * @param {Record<string, boolean>} roles
 * @param {Record<string, number | null | undefined>} stageTurns
 */
function fadingStages(buildingAgeIndex, roles, stageTurns) {
  const table = buildingAgeIndex === null ? null : SUCCESSOR_STAGES[buildingAgeIndex];
  if (!table) return [];
  /** @type {string[]} */
  const out = [];
  for (const role of FADING_ROLES) {
    const stage = roles[role] ? table[role] : null;
    if (stage && !out.includes(stage) && !Number.isInteger(stageTurns[stage])) out.push(stage);
  }
  return out;
}

/**
 * A civ's economy from its buildings (DESIGN 4.13, 4.16): depth with the old buildings' weights, the Civic market
 * share and Banking's cap, the weighted Warehouse and Industry counts, the legacy cushion, the settlements with a
 * Commerce building, and the buildings themselves for the Treasury tab and the Trade-building counts per city.
 * @param {number} pid
 * @param {EconomyQuery} q
 */
export function readEconomy(pid, q) {
  const currentAgeIndex = ageIndex() ?? 0;
  /** @type {EconomyBuilding[]} */
  const buildings = [];
  /** @type {Map<string, EconomyBuilding[]>} */
  const byCity = new Map();
  for (const city of safe(() => Players.get(pid).Cities.getCities(), []) || []) {
    const list = cityEconomy(city, q, currentAgeIndex);
    if (list.length && list[0].city) byCity.set(list[0].city, list);
    buildings.push(...list);
    rememberRoles(q.memory, list, q.age);
  }
  const depth = computeDepth(buildings, { commercePct: q.commercePct,
    capPct: q.bankingOpen ? DEPTH.bankingCapPct : DEPTH.factorCapPct });
  const counts = countRoles(buildings);
  let legacyBp = 0;
  for (const building of buildings) legacyBp += building.legacyBp;
  let commerceSettlements = 0;
  for (const list of byCity.values()) {
    if (list.some((building) => building.roles.commerce && roleWeightOf(building, "commerce") > 0)) commerceSettlements += 1;
  }
  return { buildings, byCity, depthTurns: depth.depthTurns, depthFactorPct: depth.depthFactorPct,
    warehouses: counts.warehouse, industry: counts.industry, legacyBp, cushionBp: cushionBp(legacyBp),
    commerceSettlements };
}

/**
 * The owner of a plot as a major civ id, or null.
 * @param {number} x
 * @param {number} y
 */
function plotOwner(x, y) {
  const owner = safe(() => GameplayMap.getOwner(x, y), -1);
  return Number.isInteger(owner) && owner >= 0 && safe(() => Players.get(owner).isMajor === true, false) ? owner : null;
}

/**
 * Whether a city has a building tagged FOOD_WAREHOUSE (DESIGN 4.11 halves a disaster there).
 * @param {any} city
 */
function hasFoodWarehouse(city) {
  const data = buildingData();
  for (const id of safe(() => city.Constructibles.getIds(), []) || []) {
    const type = safe(() => GameInfo.Constructibles.lookup(Constructibles.getByComponentID(id).type)?.ConstructibleType,
      null);
    if (type && data.get(type)?.tags.includes("FOOD_WAREHOUSE")) return true;
  }
  return false;
}

/**
 * The cycle's record of a capture: the civ that lost the settlement, when the transfer was by combat.
 * @param {any} data CityTransfered's payload
 * @returns {PendingCycleEvent | null}
 */
export function captureEvent(data) {
  const loser = safe(() => Number(data.fromPlayer), -1);
  const type = safe(() => data.transferType, null);
  const names = safe(() => CityTransferTypes, /** @type {Record<string, unknown>} */ ({}));
  const name = Object.keys(names).find((key) => names[key] === type) || String(type);
  if (!/COMBAT|CONQUE|CAPTURE/i.test(name) || !Number.isInteger(loser) || loser < 0) return null;
  return safe(() => Players.get(loser).isMajor === true, false) ? { kind: "capture", pid: loser } : null;
}

/**
 * The cycle's record of a raze, on the civ that holds the settlement it razes.
 * @param {any} data CityRazingStarted's payload
 * @returns {PendingCycleEvent | null}
 */
export function razeEvent(data) {
  const owner = safe(() => Number((data.cityID || data.city).owner), -1);
  if (!Number.isInteger(owner) || owner < 0 || !safe(() => Players.get(owner).isMajor === true, false)) return null;
  return { kind: "raze", pid: owner };
}

/**
 * The cycle's record of a disaster on a major's land: its settlement (the plot's owning city), the population that
 * settlement had at the last batch, and whether it has a food warehouse.
 * @param {any} data RandomEventOccurred's payload
 * @param {Map<string, number>} pops each city's population at the last batch
 * @returns {PendingCycleEvent | null}
 */
export function disasterEvent(data, pops) {
  const x = safe(() => Number(data.location.x), NaN);
  const y = safe(() => Number(data.location.y), NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const pid = plotOwner(x, y);
  if (pid === null) return null;
  const id = safe(() => GameplayMap.getOwningCityFromXY(x, y), null);
  const city = id ? safe(() => Cities.get(id), null) : null;
  const key = cityKey(id);
  return { kind: "disaster", pid, city: key, pop: key ? pops.get(key) ?? null : null,
    food: city ? hasFoodWarehouse(city) : false };
}

/**
 * Adds one engine event to the glue envelope's pending list, the oldest dropped past 32.
 * @param {PendingCycleEvent[]} pending
 * @param {PendingCycleEvent | null} row
 */
export function withPending(pending, row) {
  return row ? [...pending, row].slice(-MAX_PENDING) : pending;
}

/**
 * Every major city's population now, keyed by city.
 * @param {number[]} majors
 */
export function readPopulations(majors) {
  /** @type {Map<string, number>} */
  const out = new Map();
  for (const pid of majors) {
    for (const city of safe(() => Players.get(pid).Cities.getCities(), []) || []) {
      const key = cityKey(safe(() => city.id, null));
      const pop = safe(() => Number(city.population), NaN);
      if (key && Number.isFinite(pop)) out.set(key, pop);
    }
  }
  return out;
}

/**
 * The pending events as the plan takes them: a disaster lost population when its settlement has fewer people now
 * than at the batch before it.
 * @param {PendingCycleEvent[]} pending
 * @param {Map<string, number>} popsNow
 * @returns {CycleInputEvent[]}
 */
export function resolveCycleEvents(pending, popsNow) {
  return pending.map((row) => {
    if (row.kind !== "disaster") return { kind: row.kind, pid: row.pid };
    const now = row.city ? popsNow.get(row.city) : undefined;
    const lost = Number.isFinite(row.pop) && Number.isFinite(now) && /** @type {number} */ (now)
      < /** @type {number} */ (row.pop);
    return { kind: "disaster", pid: row.pid, populationLost: lost, foodWarehouse: row.food === true };
  });
}

/**
 * The pending list read back from the save, with anything untrusted dropped.
 * @param {unknown} raw
 * @returns {PendingCycleEvent[]}
 */
export function sanitizePending(raw) {
  /** @type {PendingCycleEvent[]} */
  const out = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || !["capture", "raze", "disaster"].includes(row.kind) || !Number.isInteger(row.pid)) continue;
    out.push({ kind: row.kind, pid: row.pid, city: typeof row.city === "string" ? row.city : null,
      pop: Number.isFinite(row.pop) ? row.pop : null, food: row.food === true });
  }
  return out.slice(-MAX_PENDING);
}
