// econ-systems.js - Economics: each civ's economic system and the numbers it changes (DESIGN 4.17), as plain data.
// The glue reads each civ's government and ideology; this module names the system, keeps when it last changed, and
// gives the system's terms, each number blending evenly over 10 turns after a change. The government table is the
// mod's own rule, since the data has nothing to classify by: a government it doesn't list (DLC, modded, future) runs
// Mixed, and one the game lacks never appears. The system's tax-line changes are level 1 data (government modifiers
// on the tax cards, data/econ-systems.sql), so the AI gets them as natively as the player; everything here is the
// mod's own numbers (level 3), applied by the same code to every civ. Nothing here reads the engine.

import { SYSTEM_BLEND_TURNS } from "./econ-params.js";

/** @typedef {"mixed" | "market" | "tribute" | "civicMarket" | "merchantOligarchy" | "manorial" | "mercantile"
 *   | "religious" | "corporatist" | "planned"} SystemId */

/** @type {SystemId[]} */
export const SYSTEM_IDS = ["mixed", "market", "tribute", "civicMarket", "merchantOligarchy", "manorial", "mercantile",
  "religious", "corporatist", "planned"];

/** DESIGN 4.17's "From (1.5.0)" column. @type {Record<string, SystemId>} */
export const GOVERNMENT_SYSTEMS = { GOVERNMENT_DESPOTISM: "tribute", GOVERNMENT_CLASSICAL_REPUBLIC: "civicMarket",
  GOVERNMENT_OLIGARCHY: "merchantOligarchy", GOVERNMENT_FEUDAL_MONARCHY: "manorial", GOVERNMENT_PLUTOCRACY: "mercantile",
  GOVERNMENT_THEOCRACY: "religious", GOVERNMENT_ELECTIVE_REPUBLIC: "market", GOVERNMENT_CONSTITUTIONAL_MONARCHY: "market",
  GOVERNMENT_AUTHORITARIANISM: "corporatist", GOVERNMENT_BUREAUCRATIC_MONARCHY: "corporatist",
  GOVERNMENT_REVOLUTIONARY_AUTHORITARIANISM: "corporatist" };

/** In Modern an ideology decides ahead of the government. @type {Record<string, SystemId>} */
export const IDEOLOGY_SYSTEMS = { IDEOLOGY_DEMOCRACY: "market", IDEOLOGY_FASCISM: "corporatist",
  IDEOLOGY_COMMUNISM: "planned" };

/**
 * @typedef {{ bondPct: number, borrowPct: number, lendPct: number, creditTurns: number, creditPct: number,
 *   tradeBuildingPct: number, commercePct: number, billPaidPct: number, exportPct: number, dividendMille: number,
 *   aidRelationPct: number, pricePct: number, industryPct: number, lDecayPct: number, lMultPct: number,
 *   warehouseMultPct: number, panicL: number, highTariffEveryTurns: number, civLendersOnly: boolean,
 *   citizens: boolean, partnership: boolean, devLoansOnly: boolean, fixedPrices: boolean, outOfCycle: boolean,
 *   plan: boolean, warBoom: boolean }} SystemTerms
 */

/**
 * Mixed's terms: sections 4.1 to 4.16 as written. Percentages are of the rule's own number; `creditTurns` adds to
 * credit_cap's turns; `dividendMille` adds to the return a civ's investments earn; `lDecayPct` is how much of `L`
 * stays each turn; `highTariffEveryTurns` how often a High tariff costs relationship.
 */
/** @type {Readonly<SystemTerms>} */
export const MIXED_TERMS = Object.freeze({ bondPct: 100, borrowPct: 100, lendPct: 100, creditTurns: 0,
  creditPct: 100, tradeBuildingPct: 10, commercePct: 100, billPaidPct: 100, exportPct: 100, dividendMille: 0,
  aidRelationPct: 100, pricePct: 100, industryPct: 100, lDecayPct: 80, lMultPct: 100, warehouseMultPct: 100,
  panicL: 0, highTariffEveryTurns: 5, civLendersOnly: false, citizens: false, partnership: false,
  devLoansOnly: false, fixedPrices: false, outOfCycle: false, plan: false, warBoom: false });

/** Each system's changes from Mixed (DESIGN 4.17's second table). @type {Record<SystemId, Partial<SystemTerms>>} */
export const SYSTEM_CHANGES = {
  mixed: {},
  market: { bondPct: 90, lDecayPct: 70, panicL: -500 },
  tribute: { civLendersOnly: true, borrowPct: 120, aidRelationPct: 200 },
  civicMarket: { citizens: true, tradeBuildingPct: 12, commercePct: 125 },
  merchantOligarchy: { borrowPct: 80, lendPct: 80, creditTurns: 4, lMultPct: 125, panicL: -500 },
  manorial: { creditTurns: -4, billPaidPct: 80, lMultPct: 75, warehouseMultPct: 200 },
  mercantile: { bondPct: 80, exportPct: 110, highTariffEveryTurns: 10, dividendMille: 10, lMultPct: 125 },
  religious: { partnership: true, aidRelationPct: 200 },
  corporatist: { creditPct: 150, bondPct: 75, pricePct: 200, industryPct: 200, devLoansOnly: true, warBoom: true },
  planned: { civLendersOnly: true, fixedPrices: true, devLoansOnly: true, outOfCycle: true, plan: true },
};

/** @param {unknown} id */
export function isSystemId(id) {
  return SYSTEM_IDS.includes(/** @type {SystemId} */ (id));
}

/**
 * The system a government and ideology give: the ideology first (Modern), then the government; anything unlisted
 * runs Mixed.
 * @param {{ government?: string | null, ideology?: string | null }} q
 * @returns {SystemId}
 */
export function systemFor({ government, ideology }) {
  if (ideology && Object.hasOwn(IDEOLOGY_SYSTEMS, ideology)) return IDEOLOGY_SYSTEMS[ideology];
  if (government && Object.hasOwn(GOVERNMENT_SYSTEMS, government)) return GOVERNMENT_SYSTEMS[government];
  return "mixed";
}

/**
 * A system's full terms, unblended.
 * @param {SystemId} id
 * @returns {SystemTerms}
 */
export function termsOf(id) {
  return /** @type {SystemTerms} */ ({ ...MIXED_TERMS, ...(SYSTEM_CHANGES[id] || {}) });
}

/**
 * @typedef {{ system: SystemId, from: SystemId, since: number }} SystemRow
 */

/**
 * The terms a civ runs on this turn: each number moves evenly from the old system's to the new one's over 10 turns;
 * a yes-or-no term switches on the turn of the change.
 * @param {SystemRow | undefined} row
 * @param {number} turn
 * @returns {SystemTerms}
 */
export function blendedTerms(row, turn) {
  if (!row) return termsOf("mixed");
  const to = termsOf(row.system);
  const done = Math.max(0, Math.min(SYSTEM_BLEND_TURNS, turn - row.since));
  if (row.from === row.system || done >= SYSTEM_BLEND_TURNS) return to;
  const from = termsOf(row.from);
  /** @type {Record<string, number | boolean>} */
  const out = { ...to };
  for (const [key, value] of Object.entries(to)) {
    if (typeof value !== "number") continue;
    const start = /** @type {number} */ (from[/** @type {keyof SystemTerms} */ (key)]);
    out[key] = Math.round(start + ((value - start) * done) / SYSTEM_BLEND_TURNS);
  }
  return /** @type {SystemTerms} */ (out);
}

/**
 * Each living civ's system after this turn's reads, and the civs whose system changed (for the -0.03 shock and the
 * notice). A civ whose government reads none (the first turns of an age, before it picks) keeps its last system; the
 * first system a civ gets isn't a change. With the option Off every civ runs Mixed and nothing changes.
 * @param {Record<string, SystemRow>} previous keyed by player id
 * @param {{ id: number, alive: boolean, government?: string | null, ideology?: string | null }[]} civs
 * @param {number} turn
 * @param {boolean} on
 * @returns {{ systems: Record<string, SystemRow>, changes: { pid: number, from: SystemId, to: SystemId }[] }}
 */
export function nextSystems(previous, civs, turn, on) {
  /** @type {Record<string, SystemRow>} */
  const systems = {};
  /** @type {{ pid: number, from: SystemId, to: SystemId }[]} */
  const changes = [];
  for (const civ of civs) {
    if (civ.alive !== true) continue;
    const key = String(civ.id);
    const before = previous?.[key];
    const now = systemNow(civ, before, on);
    if (!before) { systems[key] = { system: now, from: now, since: turn }; continue; }
    if (before.system === now) { systems[key] = { ...before }; continue; }
    systems[key] = { system: now, from: before.system, since: turn };
    if (on) changes.push({ pid: civ.id, from: before.system, to: now });
  }
  return { systems, changes };
}

/**
 * The system a civ runs now: Mixed with the option Off; its last one while its government reads none.
 * @param {{ government?: string | null, ideology?: string | null }} civ
 * @param {SystemRow | undefined} before
 * @param {boolean} on
 * @returns {SystemId}
 */
function systemNow(civ, before, on) {
  if (!on) return "mixed";
  if (!civ.government && !civ.ideology && before) return before.system;
  return systemFor(civ);
}

/**
 * Whether a system takes the Capitalism stage's effects (DESIGN 4.15): Market and Mixed only.
 * @param {SystemId | undefined} id
 */
export function takesCapitalism(id) {
  return id === "market" || id === "mixed" || id === undefined;
}
