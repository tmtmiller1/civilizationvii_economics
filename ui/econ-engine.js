// econ-engine.js - Economics: every read of the engine and every write to it, behind one guard each. The GameFace
// API can be absent or throw, so a read that fails gives its fallback and the turn carries on; a write that fails is
// logged. Every field is read for every living major civ by the same call, human and AI alike (docs/glue-contract.md):
// nothing here looks at the local player specially. Nothing here decides anything; the model does.

import { toCents } from "./econ-money.js";
import { logDebug, logLine } from "./econ-log.js";
import { DEPTH, computeDepth, rolesOf } from "./econ-depth.js";

/**
 * @template T
 * @param {() => T} fn
 * @param {T} fallback
 * @returns {T}
 */
export function safe(fn, fallback) {
  try {
    const value = fn();
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
}

/** The local player's id, or -1 outside a game (an observer seat counts). */
export function localId() {
  const id = safe(() => GameContext.localPlayerID, -1);
  return typeof id === "number" && id >= 0 ? id : safe(() => GameContext.localObserverID, -1);
}

export function gameTurn() {
  return safe(() => (typeof Game.turn === "number" ? Game.turn : 0), 0);
}

/** The age as its type string, "AGE_ANTIQUITY" and so on; Game.age itself is a hash (engine-closed). */
export function ageType() {
  return safe(() => String(GameInfo.Ages.lookup(Game.age)?.AgeType), "");
}

/** The age's chronology index, 0 for Antiquity; null when the Ages table can't be read. */
export function ageIndex() {
  return safe(() => {
    const index = Number(GameInfo.Ages.lookup(Game.age)?.ChronologyIndex);
    return Number.isInteger(index) ? index : null;
  }, /** @type {number | null} */ (null));
}

/** The chronology index of a named age, or null. @param {string} type */
export function ageIndexOf(type) {
  return safe(() => {
    const index = Number(GameInfo.Ages.lookup(type)?.ChronologyIndex);
    return Number.isInteger(index) ? index : null;
  }, /** @type {number | null} */ (null));
}

/** Single-player writes only (DESIGN 9): hotseat and network games count as multiplayer. */
export function isMultiplayer() {
  const game = safe(() => Configuration.getGame(), /** @type {any} */ (null));
  return !!game && (game.isAnyMultiplayer === true || game.isNetworkMultiplayer === true);
}

/** @param {number} pid */
export function player(pid) {
  if (!Number.isInteger(pid) || pid < 0) return null;
  return safe(() => Players.get(pid), null) || null;
}

/** @param {number} pid */
export function isAliveMajor(pid) {
  const p = player(pid);
  return !!(p && p.isAlive === true && p.isMajor === true);
}

/** The living major civs' ids, in id order. */
export function aliveMajorIds() {
  const ids = safe(() => Players.getAliveMajorIds(), /** @type {number[] | null} */ (null))
    || safe(() => Players.getAliveIds().filter((/** @type {number} */ id) => isAliveMajor(id)), []);
  return [...ids].filter((id) => Number.isInteger(id)).sort((a, b) => a - b);
}

/** @param {number} pid */
export function civName(pid) {
  return safe(() => String(Locale.compose(Players.get(pid).civilizationName)), `#${pid}`);
}

/** @param {number} pid */
export function readBalanceCents(pid) {
  return toCents(safe(() => Players.get(pid).Treasury.goldBalance, 0));
}

/** @param {number} pid */
export function readIncomeCents(pid) {
  return toCents(safe(() => Players.get(pid).Stats.getNetYield(YieldTypes.YIELD_GOLD), 0));
}

/** The celebration meter's per-turn happiness, for the tax fallback's forecast only. @param {number} pid */
export function readHappinessCents(pid) {
  return toCents(safe(() => Players.get(pid).Stats.getNetYield(YieldTypes.YIELD_HAPPINESS), 0));
}

/**
 * Unit upkeep: the Treasury getter per unit type the civ fields (P2).
 * @param {number} pid
 */
function readUnitUpkeep(pid) {
  return safe(() => {
    const p = Players.get(pid);
    const types = new Set();
    for (const id of p.Units.getUnitIds() || []) {
      const unit = Units.get(id);
      if (unit && unit.type !== undefined) types.add(unit.type);
    }
    let sum = 0;
    for (const type of types) sum += Number(p.Treasury.getMaintenanceForAllUnitsOfType(type)) || 0;
    return sum;
  }, 0);
}

/**
 * Building upkeep: the city's per-building Gold maintenance over its constructibles (P2). The getter takes the
 * Constructibles row's `$index`, not the instance's type hash, and answers with a `{ value, base, modifier }`
 * breakdown.
 * @param {number} pid
 */
function readBuildingUpkeep(pid) {
  return safe(() => {
    let sum = 0;
    for (const city of Players.get(pid).Cities.getCities() || []) {
      for (const id of city.Constructibles.getIds() || []) {
        const instance = Constructibles.getByComponentID(id);
        const row = instance ? GameInfo.Constructibles.lookup(instance.type) : null;
        if (!row) continue;
        const value = city.Gold.getSpecificBuildingMaintenance(row.$index);
        sum += Number(value && typeof value === "object" ? value.value : value) || 0;
      }
    }
    return sum;
  }, 0);
}

/** Building plus unit upkeep in cents, never negative. @param {number} pid */
export function readUpkeepCents(pid) {
  return Math.max(0, toCents(readUnitUpkeep(pid) + readBuildingUpkeep(pid)));
}

/**
 * Whether the civ is at war with any living major (minors read as at war with everyone, so they're left out).
 * @param {number} pid
 * @param {number[]} majors
 */
export function readAtWar(pid, majors) {
  const diplomacy = safe(() => Players.get(pid).Diplomacy, null);
  if (!diplomacy) return false;
  return majors.some((other) => other !== pid && safe(() => diplomacy.isAtWarWith(other) === true, false));
}

/**
 * @typedef {{ tags: string[], goldYield: number, isWonder: boolean, advisories: string[], age: string | null,
 *   unique: boolean }} BuildingData
 */

/** @type {Map<string, BuildingData> | null} */
let buildingDataCache = null;

/**
 * A constructible's row before its tags, yields and advisories are added.
 * @param {{ ConstructibleType: string, ConstructibleClass?: string, Age?: string }} row
 * @returns {BuildingData}
 */
function buildingRow(row) {
  const age = typeof row.Age === "string" && row.Age ? row.Age : null;
  return { tags: [], goldYield: 0, isWonder: row.ConstructibleClass === "WONDER", advisories: [], age, unique: false };
}

/**
 * Every constructible's tags, base Gold yield, class and advisories from GameInfo, read once and cached. Other mods'
 * changes are in GameInfo, so a modded or DLC building takes part by its own data.
 */
export function buildingData() {
  if (buildingDataCache) return buildingDataCache;
  /** @type {Map<string, BuildingData>} */
  const map = new Map();
  safe(() => {
    for (const row of GameInfo.Constructibles) map.set(row.ConstructibleType, buildingRow(row));
    for (const row of GameInfo.TypeTags) map.get(row.Type)?.tags.push(row.Tag);
    for (const row of GameInfo.Constructible_YieldChanges) {
      if (row.YieldType === "YIELD_GOLD") {
        const data = map.get(row.ConstructibleType);
        if (data) data.goldYield = Number(row.YieldChange) || 0;
      }
    }
    for (const row of GameInfo.Constructible_Advisories) {
      map.get(row.ConstructibleType)?.advisories.push(row.AdvisoryClassType);
    }
    return true;
  }, false);
  // A civ's own unique building names its trait; uniques don't age (DESIGN 4.16). A separate pass, so a game without
  // the Buildings table still gets the rest.
  safe(() => {
    for (const row of GameInfo.Buildings) {
      const data = map.get(row.ConstructibleType);
      if (data && typeof row.TraitType === "string" && row.TraitType) data.unique = true;
    }
    return true;
  }, false);
  buildingDataCache = map;
  return map;
}

/** Test hook: forget the cached building data. */
export function resetBuildingDataForTests() {
  buildingDataCache = null;
}

/** The Bank's base Gold yield from the data, or the 1.5.0 value when no Bank row exists. */
export function bankGoldYield() {
  const bank = buildingData().get("BUILDING_BANK");
  return bank && bank.goldYield > 0 ? bank.goldYield : DEPTH.bankGoldFallback;
}

/**
 * The civ's standing buildings with their roles (DESIGN 4.13); a damaged building weighs 0 (P9).
 * @param {number} pid
 * @returns {{ type: string, roles: import("./econ-depth.js").BuildingRoles, goldYield: number, weight: number }[]}
 */
export function readBuildings(pid) {
  return safe(() => {
    /** @type {CityBuilding[]} */
    const out = [];
    for (const city of Players.get(pid).Cities.getCities() || []) out.push(...readCityBuildings(city));
    return out;
  }, /** @type {CityBuilding[]} */ ([]));
}

/**
 * @typedef {{ type: string, roles: import("./econ-depth.js").BuildingRoles, goldYield: number, weight: number,
 *   age: string | null, ageless: boolean, unique: boolean, wonder: boolean, weights?: Record<string, number> }}
 *   CityBuilding
 */

/**
 * One city's standing buildings with their roles; a damaged building weighs 0 (P9).
 * @param {any} city
 * @returns {CityBuilding[]}
 */
export function readCityBuildings(city) {
  const data = buildingData();
  const bankGold = bankGoldYield();
  /** @type {CityBuilding[]} */
  const out = [];
  for (const id of safe(() => city.Constructibles.getIds(), []) || []) {
    const instance = safe(() => Constructibles.getByComponentID(id), null);
    const row = instance ? safe(() => GameInfo.Constructibles.lookup(instance.type), null) : null;
    const info = row ? data.get(row.ConstructibleType) : undefined;
    if (!row || !info || instance.complete === false) continue;
    out.push({ type: row.ConstructibleType, roles: rolesOf(info, bankGold), goldYield: info.goldYield,
      weight: instance.damaged === true ? 0 : 1, age: info.age ?? null, ageless: info.tags.includes("AGELESS"),
      unique: info.unique === true, wonder: info.isWonder });
  }
  return out;
}

/** depth_turns and depth_factor for a civ (DESIGN 4.13). @param {number} pid */
export function readDepth(pid) {
  return computeDepth(readBuildings(pid));
}

/**
 * The relationship level between two majors as the model names it: war wins, then the game's own enum.
 * @param {number} a
 * @param {number} b
 * @returns {RelationLevel}
 */
export function readRelation(a, b) {
  const diplomacy = safe(() => Players.get(a).Diplomacy, null);
  if (!diplomacy) return "neutral";
  if (safe(() => diplomacy.isAtWarWith(b) === true, false)) return "war";
  const value = safe(() => diplomacy.getRelationshipEnum(b), /** @type {unknown} */ (null));
  const names = safe(() => DiplomacyPlayerRelationships, /** @type {Record<string, unknown>} */ ({}));
  if (value === names.PLAYER_RELATIONSHIP_HOSTILE || value === names.PLAYER_RELATIONSHIP_UNFRIENDLY) return "unfriendly";
  if (value === names.PLAYER_RELATIONSHIP_FRIENDLY || value === names.PLAYER_RELATIONSHIP_HELPFUL
    || value === names.PLAYER_RELATIONSHIP_ALLIANCE) return "friendly";
  return "neutral";
}

/**
 * @param {number} a
 * @param {number} b
 */
export function haveMet(a, b) {
  return safe(() => Players.get(a).Diplomacy.hasMet(b) === true, true);
}

/**
 * One row per pair of living majors that have met (docs/glue-contract.md).
 * @param {number[]} majors
 * @returns {Relation[]}
 */
export function readRelations(majors) {
  /** @type {Relation[]} */
  const out = [];
  for (let i = 0; i < majors.length; i += 1) {
    for (let j = i + 1; j < majors.length; j += 1) {
      const [a, b] = [majors[i], majors[j]];
      // An unmet pair has a row of its own, so the model can tell it from a met pair it reads as neutral.
      out.push(haveMet(a, b) ? { a, b, level: readRelation(a, b) } : { a, b, level: "unmet" });
    }
  }
  return out;
}

/** The GlobalParameters rows as { Name: Value }, for engineLines. */
export function readGlobalParameters() {
  return safe(() => {
    /** @type {Record<string, string>} */
    const rows = {};
    for (const row of GameInfo.GlobalParameters) rows[row.Name] = row.Value;
    return rows;
  }, /** @type {Record<string, string>} */ ({}));
}

/** @param {string} key */
export function readConfig(key) {
  return safe(() => Configuration.getGame().getValue(key), /** @type {unknown} */ (null));
}

/** @param {string} key */
export function readEnvelope(key) {
  const value = readConfig(key);
  return typeof value === "string" ? value : null;
}

/**
 * @param {string} key
 * @param {string} text
 */
export function writeEnvelope(key, text) {
  const ok = safe(() => { Configuration.editGame()?.setValue(key, text); return true; }, false);
  if (!ok) logLine(`could not write ${key} to the game configuration`);
  return ok;
}

/**
 * One grant, sent only to a living player; a world account never gets this far (invariant alive-target).
 * @param {number} pid
 * @param {number} yieldType
 * @param {number} amount
 */
export function sendGrant(pid, yieldType, amount) {
  if (!isAliveMajor(pid) || !Number.isFinite(amount) || amount === 0) return false;
  const ok = safe(() => { Players.grantYield(pid, yieldType, amount); return true; }, false);
  if (!ok) logLine(`grantYield failed for player ${pid}: ${amount} of yield ${yieldType}`);
  else logDebug(`grant ${amount} of yield ${yieldType} to ${pid}`);
  return ok;
}

/** @param {number} pid @param {number} cents */
export function sendGold(pid, cents) {
  return sendGrant(pid, safe(() => YieldTypes.YIELD_GOLD, -1), cents / 100);
}

/** @param {number} pid @param {number} amount */
export function sendInfluence(pid, amount) {
  return sendGrant(pid, safe(() => YieldTypes.YIELD_DIPLOMACY, -1), amount);
}

/** @param {number} pid @param {number} cents */
export function sendCelebration(pid, cents) {
  return sendGrant(pid, safe(() => YieldTypes.YIELD_HAPPINESS, -1), cents / 100);
}

/**
 * Books "from wronged against" on the game's own grievance ledger (DESIGN 4.5), which the AI acts on.
 * @param {GrievanceRow} row
 */
export function bookGrievance(row) {
  if (!isAliveMajor(row.from) || typeof row.against !== "number" || !isAliveMajor(row.against)) return false;
  const against = row.against;
  const ok = safe(() => {
    Players.get(row.from).Diplomacy.changeNumGrievances(against, row.amount * 1000);
    return true;
  }, false);
  if (!ok) logLine(`changeNumGrievances failed: ${row.from} against ${row.against}`);
  return ok;
}

/**
 * Moves both sides' relationship by `delta` (changeRelationshipLevel moves both, engine-closed).
 * @param {RelationshipRow} row
 */
export function bookRelationship(row) {
  if (!isAliveMajor(row.a) || !isAliveMajor(row.b)) return false;
  const ok = safe(() => {
    Players.get(row.a).Diplomacy.changeRelationshipLevel(row.b, row.delta);
    return true;
  }, false);
  if (!ok) logLine(`changeRelationshipLevel failed: ${row.a} with ${row.b}`);
  return ok;
}

/**
 * @param {string} event
 * @param {(...args: any[]) => void} handler
 */
export function listen(event, handler) {
  return safe(() => { engine.on(event, handler); return true; }, false);
}

/**
 * @param {string} event
 * @param {(...args: any[]) => void} handler
 */
export function unlisten(event, handler) {
  return safe(() => { engine.off(event, handler); return true; }, false);
}

/**
 * The game's text for a key, with the key itself as the fallback.
 * @param {string} key
 * @param {...(string | number)} args
 */
export function loc(key, ...args) {
  const text = safe(() => Locale.compose(key, ...args), "");
  return typeof text === "string" && text.length ? text : key;
}
