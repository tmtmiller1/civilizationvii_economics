// econ-commerce-read.js - Economics: the engine reads and the one write 1.1 adds (DESIGN 4.9, 4.10, 4.12, 4.13).
// Every civ is read by the same calls, human and AI alike (docs/glue-contract.md). An import is an entry of the
// importer's Resources.getResources() whose origin city (Game.Resources.getOriginCity of its plot) belongs to another
// major, the read Demographics ships; that is what the bill is made of, so it doesn't wait on P7's per-route read.
// The routes themselves only say which of the importer's cities takes the copies, for its Trade buildings. A city is
// held by its component id key ("owner:id") and found again each time; a city object is never kept (engine-closed).
// Nothing here decides anything.

import { safe } from "./econ-engine.js";
import { toCents } from "./econ-money.js";
import { countRoles, isRoleBuilding, rolesOf } from "./econ-depth.js";
import { logDebug, logLine } from "./econ-log.js";

/**
 * A city's key from its component id; null when it can't be read.
 * @param {any} id
 */
export function cityKey(id) {
  if (!id || typeof id !== "object") return null;
  return Number.isInteger(id.owner) && Number.isInteger(id.id) ? `${id.owner}:${id.id}` : null;
}

/** @param {any} entry the getResources() entry */
function resourceType(entry) {
  return safe(() => {
    const ref = entry.uniqueResource ? entry.uniqueResource.resource : entry.resource ?? entry.type;
    const row = GameInfo.Resources.lookup(ref);
    return row ? String(row.ResourceType) : null;
  }, /** @type {string | null} */ (null));
}

/**
 * Each of a civ's resources with the city it comes from: [{ type, origin, owner }].
 * @param {number} pid
 * @returns {{ type: string, origin: string, owner: number }[]}
 */
export function readHeldResources(pid) {
  /** @type {{ type: string, origin: string, owner: number }[]} */
  const out = [];
  for (const entry of safe(() => Players.get(pid).Resources.getResources(), []) || []) {
    const type = resourceType(entry);
    const originId = safe(() => Game.Resources.getOriginCity(entry.value), null);
    const origin = cityKey(originId);
    if (!type || !origin) continue;
    out.push({ type, origin, owner: originId.owner });
  }
  return out;
}

/**
 * For each foreign city a civ's routes reach, the civ's own city at the other end (importerKey by exporterKey).
 * @param {number} pid
 */
function routeEnds(pid) {
  /** @type {Map<string, string>} */
  const ends = new Map();
  for (const route of safe(() => Players.get(pid).Trade.getCurrentTradeRoutes(), []) || []) {
    const ids = [route?.targetCityId, route?.nearestCityId, route?.originCityId].filter(Boolean);
    const mine = ids.find((id) => id.owner === pid);
    for (const id of ids) {
      const key = cityKey(id);
      if (key && id.owner !== pid && mine) ends.set(key, /** @type {string} */ (cityKey(mine)));
    }
  }
  return ends;
}

/**
 * The routes between majors as the bill reads them: the importer's copies grouped by the city they come from.
 * @param {number[]} majors
 * @param {Map<string, number>} tradeByCity Trade buildings per city key
 * @returns {RouteRead[]}
 */
export function readRoutes(majors, tradeByCity) {
  const isMajor = new Set(majors);
  /** @type {RouteRead[]} */
  const out = [];
  for (const pid of majors) {
    const ends = routeEnds(pid);
    /** @type {Map<string, RouteRead>} */
    const byOrigin = new Map();
    for (const held of readHeldResources(pid)) {
      if (held.owner === pid || !isMajor.has(held.owner)) continue;
      const route = byOrigin.get(held.origin) || { importer: pid, exporter: held.owner, resources: [],
        exporterTradeBuildings: tradeByCity.get(held.origin) || 0,
        importerTradeBuildings: tradeByCity.get(ends.get(held.origin) || "") || 0 };
      route.resources.push(held.type);
      byOrigin.set(held.origin, route);
    }
    out.push(...byOrigin.values());
  }
  return out;
}

/**
 * What the price step reads (DESIGN 4.9): the resource rows with every mod applied, the source copies counted once
 * at the origin, this age's strategic resources, and the Industry buildings standing in the world.
 * @param {number[]} majors
 * @param {number} industry
 * @returns {MarketRead}
 */
export function readMarket(majors, industry) {
  /** @type {{ type: string, class: string }[]} */
  const resources = [];
  safe(() => {
    for (const row of GameInfo.Resources) {
      resources.push({ type: String(row.ResourceType), class: String(row.ResourceClassType) });
    }
    return true;
  }, false);
  /** @type {Record<string, number>} */
  const copies = {};
  for (const pid of majors) {
    for (const held of readHeldResources(pid)) if (held.owner === pid) copies[held.type] = (copies[held.type] || 0) + 1;
  }
  /** @type {Set<string>} */
  const strategic = new Set();
  safe(() => {
    for (const row of GameInfo.Units) {
      if (typeof row.StrategicResource === "string") strategic.add(row.StrategicResource);
    }
    return true;
  }, false);
  return { resources, copies, strategic: [...strategic].sort(), industry };
}

/**
 * The type name of a build hash from whichever table knows it.
 * @param {unknown} hash
 */
function buildType(hash) {
  for (const table of ["Constructibles", "Units", "Projects"]) {
    const row = safe(() => GameInfo[table].lookup(hash), null);
    if (row) return String(row.ConstructibleType || row.UnitType || row.ProjectType);
  }
  return null;
}

/**
 * Production a build still needs: from the progress made and the percent complete when both read, else from the
 * row's cost, scaled by the game speed. 0 when neither reads.
 * @param {any} queue
 * @param {unknown} hash
 * @param {string} type
 */
function neededProgress(queue, hash, type) {
  const progress = Number(safe(() => queue.currentBuildProgress, 0)) || 0;
  const percent = Number(safe(() => queue.getPercentComplete(hash), 0)) || 0;
  if (progress > 0 && percent > 0 && percent < 100) {
    return Math.max(0, Math.round((progress * 100) / percent - progress));
  }
  const cost = Number(safe(() => GameInfo.Constructibles.lookup(type)?.Cost, 0)) || 0;
  const speed = Number(safe(() => GameInfo.GameSpeeds.lookup(Configuration.getGame().gameSpeedType)?.CostMultiplier,
    100)) || 100;
  return Math.max(0, Math.round((cost * speed) / 100) - progress);
}

/**
 * One city's 1.1 read: its current build, what it still needs, whether that build has an economic role, and its
 * Trade buildings.
 * @param {any} city
 * @param {(type: string) => import("./econ-depth.js").BuildingRoles | null} rolesFor
 * @param {number} trade
 * @returns {CityRead | null}
 */
function readCity(city, rolesFor, trade) {
  const id = cityKey(safe(() => city.id, null));
  if (!id) return null;
  const queue = safe(() => city.BuildQueue, null);
  const hash = safe(() => queue.currentProductionTypeHash, null);
  const empty = safe(() => queue.isEmpty === true, false);
  const type = !queue || empty || hash === null ? null : buildType(hash);
  if (!type) {
    return { id, build: null, neededProgress: 0, roleBuilding: false, tradeBuildings: trade, purchaseCents: null,
      population: readPopulation(city) };
  }
  const roles = rolesFor(type);
  return { id, build: type, neededProgress: neededProgress(queue, hash, type),
    roleBuilding: roles ? isRoleBuilding(roles) : false, tradeBuildings: trade,
    purchaseCents: roles ? readPurchaseCents(city, type) : null, population: readPopulation(city) };
}

/**
 * A settlement's population, for the plan's split (DESIGN 4.17); 1 when it doesn't read.
 * @param {any} city
 */
function readPopulation(city) {
  const pop = safe(() => Number(city.population), NaN);
  return Number.isFinite(pop) && pop > 0 ? Math.floor(pop) : 1;
}

/**
 * The game's Gold price for a building at the head of the queue, or null when the read doesn't answer.
 * @param {any} city
 * @param {string} type
 */
function readPurchaseCents(city, type) {
  const gold = safe(() => Number(city.Gold.getBuildingPurchaseCost(YieldTypes.YIELD_GOLD, type)), NaN);
  return Number.isFinite(gold) ? toCents(gold) : null;
}

/**
 * A civ's settlements for 1.1, with the Trade buildings in each from the role reads.
 * @param {number} pid
 * @param {(type: string) => import("./econ-depth.js").BuildingRoles | null} rolesFor
 * @param {(city: any) => { roles: import("./econ-depth.js").BuildingRoles, weight: number }[]} buildingsOf
 * @returns {CityRead[]}
 */
export function readCities(pid, rolesFor, buildingsOf) {
  /** @type {CityRead[]} */
  const out = [];
  for (const city of safe(() => Players.get(pid).Cities.getCities(), []) || []) {
    const row = readCity(city, rolesFor, Math.round(countRoles(buildingsOf(city)).trade));
    if (row) out.push(row);
  }
  return out;
}

/**
 * The Trade Income a civ's settlements earn a turn (TradeYields, paid by the engine), in cents.
 * @param {number} pid
 */
export function readTradeIncomeCents(pid) {
  return toCents(safe(() => {
    let sum = 0;
    for (const city of Players.get(pid).Cities.getCities() || []) {
      const yields = city.Yields.getTradeYields();
      const gold = Array.isArray(yields) ? yields[YieldTypes.YIELD_GOLD] : null;
      sum += Number(gold && typeof gold === "object" ? gold.value : gold) || 0;
    }
    return sum;
  }, 0));
}

/**
 * Lands a development loan's progress on the city's current build (DESIGN 4.12). The city is found again by its key
 * and its build re-read in the same tick, since addProgress lands on whatever is current about 3 s later (P8).
 * @param {ProgressRow} row
 */
export function sendProgress(row) {
  const city = safe(() => (Players.get(row.host).Cities.getCities() || [])
    .find((/** @type {any} */ c) => cityKey(c.id) === row.cityId), null);
  if (!city || !(row.amount > 0)) { logLine(`progress for ${row.cityId}: city not found`); return false; }
  const empty = safe(() => city.BuildQueue.isEmpty === true, true);
  if (empty) { logLine(`progress for ${row.cityId}: nothing in the queue`); return false; }
  const ok = safe(() => { city.BuildQueue.addProgress(row.amount); return true; }, false);
  if (ok) logDebug(`progress ${row.amount} on ${row.cityId} (${row.investmentId})`);
  else logLine(`addProgress failed on ${row.cityId}`);
  return ok;
}

/**
 * The roles reader the city reads share, from the building data econ-engine.js caches.
 * @param {Map<string, import("./econ-depth.js").BuildingData>} data
 * @param {number} bankGold
 */
export function makeRolesFor(data, bankGold) {
  return (/** @type {string} */ type) => {
    const info = data.get(type);
    return info ? rolesOf(info, bankGold) : null;
  };
}

/**
 * The routes the game would let a civ make now, with what each would bring (the trade lens' own call); null when the
 * read doesn't answer, so the Trade tab can say it can't preview (P7).
 * @param {number} pid
 * @param {number[]} majors
 * @returns {{ owner: number, city: string, resources: string[] }[] | null}
 */
export function readPossibleRoutes(pid, majors) {
  const list = safe(() => Players.get(pid).Trade.projectPossibleTradeRoutes(), null);
  if (!Array.isArray(list)) return null;
  const isMajor = new Set(majors);
  /** @type {{ owner: number, city: string, resources: string[] }[]} */
  const out = [];
  for (const route of list) {
    const city = cityKey(route?.targetCityId);
    const owner = route?.targetCityId?.owner;
    if (!city || !isMajor.has(owner) || owner === pid) continue;
    const resources = (Array.isArray(route.importPayloads) ? route.importPayloads : []).map(resourceType)
      .filter((/** @type {string | null} */ type) => typeof type === "string");
    out.push({ owner, city, resources: /** @type {string[]} */ (resources) });
  }
  return out;
}

/**
 * A city's name key by its component id key, for the screens; the key itself when the city can't be found.
 * @param {string} key
 */
export function readCityName(key) {
  const owner = Number(String(key).split(":")[0]);
  const city = safe(() => (Players.get(owner).Cities.getCities() || [])
    .find((/** @type {any} */ c) => cityKey(c.id) === key), null);
  return safe(() => String(city.name), key);
}

/**
 * The name key of a type from whichever table holds it (a resource, a building, a unit, a project).
 * @param {string} type
 */
export function readTypeName(type) {
  for (const table of ["Resources", "Constructibles", "Units", "Projects"]) {
    const row = safe(() => GameInfo[table].lookup(type), null);
    if (row && row.Name) return String(row.Name);
  }
  return type;
}
