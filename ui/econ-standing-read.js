// econ-standing-read.js - Economics: the standing lines in the game (econ-standing.js). It reads the line markers
// each civ holds in any of its settlements, places the ones the plan wants in its capital's City Center (GLOOM in the
// City Center of every settlement it holds, DESIGN 4.18) and removes the rest, through the engine's own
// CREATE_ELEMENT and DESTROY_ELEMENT requests sent as the local player (the route the engine accepts, as Partisans'
// muster does). Requests land a moment later, so a read straight after a send can still show the old markers; the
// next batch's read is the one that counts.

import { EVERY_SETTLEMENT, ONE_SHOT, PICKED_SETTLEMENTS, chargeCents, isMarkerKind, markerType, parseMarkerType,
  rungsFor, rungsOf,
  standAmount } from "./econ-standing.js";
import { localId, safe } from "./econ-engine.js";
import { logDebug, logLine } from "./econ-log.js";

/** @typedef {import("./econ-standing.js").StandingLine} StandingLine */
/**
 * `incomePct` is the Income percentage of the city the marker stands in, which scales a paying line there; `city`
 * is that city's local id.
 * @typedef {{ cid: { owner: number, id: number }, line: StandingLine, rung: number, capital: boolean,
 *   incomePct: number, city?: number }} HeldMarker
 */

/**
 * Every line marker a civ holds, wherever it stands. A marker in a settlement that changed hands is the new owner's:
 * the game charged it to them.
 * @param {number} pid
 * @returns {HeldMarker[]}
 */
export function readHeldMarkers(pid) {
  /** @type {HeldMarker[]} */
  const out = [];
  const p = safe(() => Players.get(pid), null);
  if (!p) return out;
  const capitalId = safe(() => p.Cities.getCapital().id.id, null);
  for (const city of safe(() => p.Cities.getCities(), []) || []) {
    const capital = capitalId !== null && safe(() => city.id.id, -1) === capitalId;
    out.push(...markersIn(city, pid, capital));
  }
  return out;
}

/**
 * @param {any} city
 * @param {number} pid
 * @param {boolean} capital
 * @returns {HeldMarker[]}
 */
function markersIn(city, pid, capital) {
  /** @type {HeldMarker[]} */
  const out = [];
  /** @type {number | null} */
  let pct = null;
  for (const id of safe(() => city.Constructibles.getIds(), []) || []) {
    const instance = safe(() => Constructibles.getByComponentID(id), null);
    const row = instance ? safe(() => GameInfo.Constructibles.lookup(instance.type), null) : null;
    const parsed = row ? parseMarkerType(row.ConstructibleType) : null;
    if (!parsed) continue;
    if (pct === null) pct = cityIncomePct(city);
    out.push({ cid: { owner: safe(() => id.owner, pid), id: safe(() => id.id, -1) }, ...parsed, capital,
      incomePct: pct, city: safe(() => city.id.id, -1) });
  }
  return out;
}

/**
 * The capital's Income percentage for Gold: the percent part of the Income node in the city's own Gold breakdown
 * (`city.Yields.getYields()`), which scales every positive Gold line in it. 0 when there's no capital or no read.
 * @param {number} pid
 */
export function readIncomePct(pid) {
  return cityIncomePct(safe(() => Players.get(pid).Cities.getCapital(), null));
}

/**
 * A city's Income percentage for Gold, 0 when there's no city or no read. A captured capital's markers stand in a
 * town of the capturer until the next batch takes them down, and pay at that town's percentage.
 * @param {any} city
 */
function cityIncomePct(city) {
  return safe(() => {
    if (!city) return 0;
    // getYields() is in the Yields table's order; YieldTypes.YIELD_GOLD is a hash, not that index (lab 2026-11-09).
    const all = city.Yields.getYields();
    const gold = all[safe(() => GameInfo.Yields.lookup("YIELD_GOLD").$index, 2)];
    const income = (gold?.base?.steps || []).find((/** @type {any} */ step) => step?.base && step?.modifier
      && Number(step.base.value) > 0);
    const pct = Number(income?.modifier?.value);
    return Number.isFinite(pct) ? pct : 0;
  }, 0);
}

/**
 * What each civ's markers moved its treasury by at the rolls since they were set, in cents (negative for a civ that
 * was charged), each paying line at what its own city's Income percentage let land. `rolls` is how many rolls they
 * stood through: 1 normally, 0 on an age change (the markers' charge at the transition isn't known, so nothing is
 * counted), more when batches were missed.
 * @param {number[]} majors
 * @param {number} rolls
 */
export function readCharged(majors, rolls) {
  /** @type {Map<number, { held: HeldMarker[], cents: number, perTurn: number }>} */
  const out = new Map();
  for (const pid of majors) {
    const held = readHeldMarkers(pid);
    let perTurn = 0;
    for (const m of held) perTurn += chargeCents([m], m.incomePct);
    out.set(pid, { held, cents: perTurn * rolls, perTurn });
  }
  return out;
}

/** @param {string} kind @param {Record<string, unknown>} args */
function request(kind, args) {
  const me = localId();
  if (me < 0) return false;
  const ok = safe(() => { Game.PlayerOperations.sendRequest(me, kind, args); return true; }, false);
  if (!ok) logLine(`${kind} failed: ${JSON.stringify(args)}`);
  return ok;
}

/**
 * Brings one civ's markers to what the plan wants: the rungs of each line in the capital, the rungs of a kind that
 * stands in every settlement (GLOOM) in each of its settlements, nothing anywhere else. A paying Gold line stands at
 * face / (1 + the capital's Income percentage). A one-shot marker always comes down and, when wanted, goes up anew,
 * since it acts only as it lands. A civ with no capital holds none. Returns how many requests went out.
 * @param {number} pid
 * @param {Map<StandingLine, number>} wanted whole Gold per Gold line, the kind's own unit otherwise
 * @param {HeldMarker[]} held
 * @param {number} [incomePct]
 */
export function placeLines(pid, wanted, held, incomePct = 0) {
  const at = capitalAt(pid);
  const split = splitWanted(wanted);
  const want = at ? wantedTypes(split.capital, incomePct) : new Set();
  const every = at ? wantedTypes(split.every, 0) : new Set();
  const towns = every.size ? settlementsOf(pid) : [];
  /** @type {Set<string>} */
  const kept = new Set();
  let sent = removeUnwanted(held, { want, every, towns: new Set(towns.map((t) => t.id)) }, kept);
  if (at) sent += createAt(pid, at, [...want].filter((type) => !kept.has(type)));
  for (const town of towns) sent += createAt(pid, town, [...every].filter((type) => !kept.has(`${town.id}:${type}`)));
  if (sent) logDebug(`standing lines for ${pid}: ${[...want, ...every].join(" ") || "none"} (${sent} request(s))`);
  return sent;
}

/**
 * Puts up marker types on one plot; returns how many requests went out.
 * @param {number} pid
 * @param {{ x: number, y: number }} at
 * @param {string[]} types
 */
function createAt(pid, at, types) {
  let sent = 0;
  for (const type of types) {
    if (request("CREATE_ELEMENT", { Kind: "CONSTRUCTIBLE", Type: type, Location: { x: at.x, y: at.y }, Owner: pid })) {
      sent += 1;
    }
  }
  return sent;
}

/**
 * The wanted lines split into the ones that stand in the capital and the ones that stand in every settlement.
 * @param {Map<StandingLine, number>} wanted
 */
function splitWanted(wanted) {
  /** @type {Map<StandingLine, number>} */
  const capital = new Map();
  /** @type {Map<StandingLine, number>} */
  const every = new Map();
  for (const [line, amount] of wanted) {
    if (PICKED_SETTLEMENTS.has(line)) continue;
    (EVERY_SETTLEMENT.has(line) ? every : capital).set(line, amount);
  }
  return { capital, every };
}

/**
 * Every settlement the civ holds, by local id and plot.
 * @param {number} pid
 * @returns {{ id: number, x: number, y: number }[]}
 */
export function settlementsOf(pid) {
  /** @type {{ id: number, x: number, y: number }[]} */
  const out = [];
  for (const city of safe(() => Players.get(pid).Cities.getCities(), []) || []) {
    const id = safe(() => city.id.id, null);
    const at = safe(() => city.location, null);
    if (typeof id === "number" && at && typeof at.x === "number") out.push({ id, x: at.x, y: at.y });
  }
  return out;
}

/**
 * The capital's plot, or null when the civ has none.
 * @param {number} pid
 * @returns {{ x: number, y: number } | null}
 */
function capitalAt(pid) {
  const at = safe(() => Players.get(pid).Cities.getCapital().location, null);
  return at && typeof at.x === "number" ? at : null;
}

/**
 * Takes down every held marker the plan doesn't want where it stands, and a second copy of one it does; notes the
 * ones kept in `kept` (a capital type by itself, a settlement type as "city:type"). Returns how many requests went
 * out.
 * @param {HeldMarker[]} held
 * @param {{ want: Set<string>, every: Set<string>, towns: Set<number> }} plan
 * @param {Set<string>} kept
 */
function removeUnwanted(held, plan, kept) {
  let sent = 0;
  for (const m of held.filter((x) => !PICKED_SETTLEMENTS.has(x.line))) {
    const type = markerType(m.line, m.rung);
    const key = EVERY_SETTLEMENT.has(m.line) ? `${m.city}:${type}` : type;
    const wanted = EVERY_SETTLEMENT.has(m.line) ? plan.every.has(type) && plan.towns.has(Number(m.city))
      : m.capital && plan.want.has(type);
    if (wanted && !kept.has(key) && !ONE_SHOT.has(m.line)) kept.add(key);
    else if (request("DESTROY_ELEMENT", { Kind: "CONSTRUCTIBLE", Owner: m.cid.owner, LocalID: m.cid.id })) sent += 1;
  }
  return sent;
}

/**
 * The marker types for each line's rungs.
 * @param {Map<StandingLine, number>} wanted
 * @param {number} incomePct
 */
function wantedTypes(wanted, incomePct) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const [line, amount] of wanted) {
    if (!isMarkerKind(line)) continue;
    for (const rung of rungsOf(standAmount(line, amount || 0, incomePct), rungsFor(line))) {
      out.add(markerType(line, rung));
    }
  }
  return out;
}

/**
 * A purchase price to measure a civ's price stack by: the dearest building its capital can buy now, the larger the
 * price the smaller the game's rounding to steps of 4 Gold. Null when there's none.
 * @param {number} pid
 * @returns {{ type: string, cents: number } | null}
 */
export function priceProbe(pid) {
  const city = safe(() => Players.get(pid).Cities.getCapital(), null);
  if (!city) return null;
  /** @type {{ type: string, cents: number } | null} */
  let best = null;
  for (const row of safe(() => GameInfo.Buildings, []) || []) {
    const type = probeType(row);
    const cents = type ? cityCents(city, type) : null;
    if (type && cents !== null && (!best || cents > best.cents)) best = { type, cents };
  }
  return best;
}

/** A building row a probe can use: purchasable, and not one of Economics' markers. @param {any} row */
function probeType(row) {
  if (!row || row.Purchasable === false || row.Purchasable === 0) return null;
  const type = String(row.ConstructibleType);
  return type.startsWith("BUILDING_ECON_") ? null : type;
}

/** @param {any} city @param {string} type */
function cityCents(city, type) {
  const gold = safe(() => Number(city.Gold.getBuildingPurchaseCost(safe(() => YieldTypes.YIELD_GOLD, -1), type)), NaN);
  return Number.isFinite(gold) && gold > 0 ? Math.round(gold * 100) : null;
}

/**
 * The same building's purchase price now, in cents, or null.
 * @param {number} pid
 * @param {string} type
 */
export function probeCents(pid, type) {
  return cityCents(safe(() => Players.get(pid).Cities.getCapital(), null), type);
}

/**
 * A settlement's building upkeep in Gold a turn, the game's own per-building read, Economics' markers left out.
 * @param {any} city
 */
function buildingUpkeep(city) {
  let sum = 0;
  for (const id of safe(() => city.Constructibles.getIds(), []) || []) {
    const row = safe(() => GameInfo.Constructibles.lookup(Constructibles.getByComponentID(id).type), null);
    if (!row || row.ConstructibleClass !== "BUILDING" || parseMarkerType(row.ConstructibleType)) continue;
    const m = safe(() => city.Gold.getSpecificBuildingMaintenance(row.$index), null);
    sum += Number(m && typeof m === "object" ? m.value : m) || 0;
  }
  return sum;
}

/**
 * The settlements to shut down: the ones already shut first (so a shut settlement stays shut while the count holds),
 * then the highest building upkeep; settlements with no building upkeep are never picked.
 * @param {{ id: number, upkeep: number, shut: boolean }[]} towns
 * @param {number} count
 */
export function pickShut(towns, count) {
  return towns.filter((t) => t.upkeep > 0 || t.shut)
    .sort((a, b) => Number(b.shut) - Number(a.shut) || b.upkeep - a.upkeep || a.id - b.id)
    .slice(0, Math.max(0, count)).map((t) => t.id);
}

/**
 * Shuts the buildings of `count` of the civ's settlements and opens the rest (DESIGN 4.18); returns the names of the
 * settlements newly shut, for the turn's notification.
 * @param {number} pid
 * @param {number} count
 * @param {HeldMarker[]} held
 */
export function shutNow(pid, count, held) {
  const shutAt = new Map(held.filter((m) => m.line === "SHUT").map((m) => [Number(m.city), m]));
  const towns = townsFor(pid, count, shutAt);
  const wanted = new Set(pickShut(towns, count));
  for (const [id, m] of shutAt) {
    if (!wanted.has(id)) request("DESTROY_ELEMENT", { Kind: "CONSTRUCTIBLE", Owner: m.cid.owner, LocalID: m.cid.id });
  }
  const names = towns.filter((t) => wanted.has(t.id) && !t.shut).map((t) => shutOne(pid, t)).filter(Boolean);
  if (names.length || shutAt.size !== wanted.size) logDebug(`shut for ${pid}: ${wanted.size} settlement(s)`);
  return /** @type {string[]} */ (names);
}

/**
 * A civ's settlements with their building upkeep (read only when something is to be shut) and whether they're shut.
 * @param {number} pid
 * @param {number} count
 * @param {Map<number, HeldMarker>} shutAt
 * @returns {{ city: any, id: number, upkeep: number, shut: boolean }[]}
 */
function townsFor(pid, count, shutAt) {
  /** @type {any[]} */
  const cities = safe(() => Players.get(pid).Cities.getCities(), []) || [];
  return cities.map((city) => ({ city, id: Number(safe(() => city.id.id, -1)) }))
    .filter((t) => t.id >= 0)
    .map((t) => ({ ...t, upkeep: count > 0 ? buildingUpkeep(t.city) : 0, shut: shutAt.has(t.id) }));
}

/**
 * Puts the SHUT marker up in one settlement; its name when the request went out, else null.
 * @param {number} pid
 * @param {{ city: any, id: number }} town
 */
function shutOne(pid, town) {
  const at = safe(() => town.city.location, null);
  if (!at || !request("CREATE_ELEMENT", { Kind: "CONSTRUCTIBLE", Type: markerType("SHUT", 1),
    Location: { x: at.x, y: at.y }, Owner: pid })) return null;
  return safe(() => String(Locale.compose(town.city.name)), `#${town.id}`);
}
