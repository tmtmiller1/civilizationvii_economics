// econ-disband.js - Economics: disbanding a unit of an overdrawn civ whose income is below zero (DESIGN 4.18). The
// plan says how many (the DISBAND row of the civ's standing lines); this picks them, the highest upkeep first
// (GameInfo.Units Maintenance, units with none never go), the strongest first on a tie (Unit_Stats Combat, then
// RangedCombat), and removes each with the engine's DESTROY_ELEMENT request sent as the local player, the route
// Tower Bench uses.

import { loc, localId, safe } from "./econ-engine.js";
import { logLine } from "./econ-log.js";

/**
 * @typedef {{ cid: { owner: number, id: number }, type: string, name: string, upkeep: number, strength: number }}
 *   UnitPick
 */

/**
 * A unit row's upkeep and strength from the game's tables.
 * @param {string} type
 */
function costOf(type) {
  const row = safe(() => GameInfo.Units.lookup(type), null);
  const upkeep = Number(row?.Maintenance) || 0;
  return { upkeep, strength: strengthOf(type), name: row?.Name ? loc(row.Name) : type };
}

/** A unit type's best strength, melee or ranged, 0 when it has none. @param {string} type */
function strengthOf(type) {
  /** @type {any} */
  let stats = null;
  for (const s of safe(() => GameInfo.Unit_Stats, []) || []) if (s?.UnitType === type) { stats = s; break; }
  return Math.max(Number(stats?.Combat) || 0, Number(stats?.RangedCombat) || 0);
}

/**
 * A civ's units that cost upkeep, the order they'd go in.
 * @param {number} pid
 * @returns {UnitPick[]}
 */
export function disbandOrder(pid) {
  /** @type {UnitPick[]} */
  const out = [];
  for (const id of safe(() => Players.get(pid).Units.getUnitIds(), []) || []) {
    const unit = safe(() => Units.get(id), null);
    const type = unit ? safe(() => GameInfo.Units.lookup(unit.type)?.UnitType, null) : null;
    if (!type) continue;
    const cost = costOf(type);
    if (cost.upkeep <= 0) continue;
    out.push({ cid: { owner: safe(() => id.owner, pid), id: safe(() => id.id, -1) }, type, ...cost });
  }
  return sortPicks(out);
}

/**
 * Highest upkeep first, then the strongest, then the lowest id so the pick is the same every time.
 * @param {UnitPick[]} picks
 */
export function sortPicks(picks) {
  return picks.sort((a, b) => b.upkeep - a.upkeep || b.strength - a.strength || a.cid.id - b.cid.id);
}

/**
 * Disbands `count` of the civ's units; returns the names of the ones the request went out for.
 * @param {number} pid
 * @param {number} count
 */
export function disbandUnits(pid, count) {
  const me = localId();
  if (me < 0 || !(count > 0)) return [];
  /** @type {string[]} */
  const names = [];
  for (const pick of disbandOrder(pid).slice(0, count)) {
    const ok = safe(() => {
      Game.PlayerOperations.sendRequest(me, "DESTROY_ELEMENT", { Kind: "UNIT", Owner: pick.cid.owner,
        LocalID: pick.cid.id });
      return true;
    }, false);
    logLine(`overdrawn: disband ${pick.type} of ${pid} (upkeep ${pick.upkeep}) ${ok ? "sent" : "failed"}`);
    if (ok) names.push(pick.name);
  }
  return names;
}
