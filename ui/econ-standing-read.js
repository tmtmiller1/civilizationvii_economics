// econ-standing-read.js - Economics: the standing lines in the game (econ-standing.js). It reads the line markers
// each civ holds in any of its settlements, places the ones the plan wants in its capital's City Center and removes
// the rest, through the engine's own CREATE_ELEMENT and DESTROY_ELEMENT requests sent as the local player (the route
// the engine accepts, as Partisans' muster does). Requests land a moment later, so a read straight after a send can
// still show the old markers; the next batch's read is the one that counts.

import { STANDING_LINES, chargeCents, markerType, parseMarkerType, rungsOf } from "./econ-standing.js";
import { localId, safe } from "./econ-engine.js";
import { logDebug, logLine } from "./econ-log.js";

/** @typedef {import("./econ-standing.js").StandingLine} StandingLine */
/** @typedef {{ cid: { owner: number, id: number }, line: StandingLine, rung: number, capital: boolean }} HeldMarker */

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
  for (const id of safe(() => city.Constructibles.getIds(), []) || []) {
    const instance = safe(() => Constructibles.getByComponentID(id), null);
    const row = instance ? safe(() => GameInfo.Constructibles.lookup(instance.type), null) : null;
    const parsed = row ? parseMarkerType(row.ConstructibleType) : null;
    if (parsed) out.push({ cid: { owner: safe(() => id.owner, pid), id: safe(() => id.id, -1) }, ...parsed, capital });
  }
  return out;
}

/**
 * What each civ's markers moved its treasury by at the rolls since they were set, in cents (negative for a civ that
 * was charged). `rolls` is how many rolls they stood through: 1 normally, 0 on an age change (the markers' charge
 * at the transition isn't known, so nothing is counted), more when batches were missed.
 * @param {number[]} majors
 * @param {number} rolls
 */
export function readCharged(majors, rolls) {
  /** @type {Map<number, { held: HeldMarker[], cents: number, perTurn: number }>} */
  const out = new Map();
  for (const pid of majors) {
    const held = readHeldMarkers(pid);
    const perTurn = chargeCents(held);
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
 * Brings one civ's markers to what the plan wants: the rungs of each line in the capital, nothing anywhere else.
 * A civ with no capital holds none. Returns how many requests went out.
 * @param {number} pid
 * @param {Map<StandingLine, number>} wanted whole Gold per line
 * @param {HeldMarker[]} held
 */
export function placeLines(pid, wanted, held) {
  /** @type {{ x: number, y: number } | null} */
  const at = safe(() => Players.get(pid).Cities.getCapital().location, null);
  const want = at && typeof at.x === "number" ? wantedTypes(wanted) : new Set();
  /** @type {Set<string>} */
  const kept = new Set();
  let sent = removeUnwanted(held, want, kept);
  for (const type of want) {
    const args = { Kind: "CONSTRUCTIBLE", Type: type, Location: { x: at?.x, y: at?.y }, Owner: pid };
    if (!kept.has(type) && request("CREATE_ELEMENT", args)) sent += 1;
  }
  if (sent) logDebug(`standing lines for ${pid}: ${[...want].join(" ") || "none"} (${sent} request(s))`);
  return sent;
}

/**
 * Takes down every held marker the plan doesn't want in the capital, and a second copy of one it does; notes the
 * ones kept in `kept`. Returns how many requests went out.
 * @param {HeldMarker[]} held
 * @param {Set<string>} want
 * @param {Set<string>} kept
 */
function removeUnwanted(held, want, kept) {
  let sent = 0;
  for (const m of held) {
    const type = markerType(m.line, m.rung);
    if (m.capital && want.has(type) && !kept.has(type)) kept.add(type);
    else if (request("DESTROY_ELEMENT", { Kind: "CONSTRUCTIBLE", Owner: m.cid.owner, LocalID: m.cid.id })) sent += 1;
  }
  return sent;
}

/**
 * The marker types for each line's rungs.
 * @param {Map<StandingLine, number>} wanted
 */
function wantedTypes(wanted) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const line of /** @type {StandingLine[]} */ (Object.keys(STANDING_LINES))) {
    for (const rung of rungsOf(wanted.get(line) || 0)) out.add(markerType(line, rung));
  }
  return out;
}
