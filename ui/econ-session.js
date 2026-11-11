// econ-session.js - Economics: the game-side session. It holds the ledger, the markets envelope (prices, tariffs) and
// the glue's own envelope (stage turns, the civs ever seen, the player's pending requests, the guard switch), builds
// the plan input from the engine once per turn, runs the model and sends what comes back (DESIGN 4.14). The batch runs
// at TurnBegin: right after the roll every balance is fresh and nobody has spent yet (P3); a negative balance carries
// over as it is (lab W10, 2026-11-10). The ledger is written before the grants go out, so a save
// in the second before they land can be told from one after (P15; batchStatus on load).

import { planTurn } from "./econ-plan.js";
import { MOD_ID, emptyLedger, load, save } from "./econ-state.js";
import { batchStatus, celebrationPaidOf, grantOf } from "./econ-batch.js";
import { placeLines, readCharged, readHeldMarkers, readIncomePct, shutNow } from "./econ-standing-read.js";
import { priceChange } from "./econ-price-read.js";
import { ONE_SHOT, isActionKind, isMarkerKind } from "./econ-standing.js";
import { disbandUnits } from "./econ-disband.js";
import { appendNotice } from "./econ-notify.js";
import { purchasePointCents, relationshipBands } from "./econ-params.js";
import { checkPlan } from "./econ-invariants.js";
import { viewRules } from "./econ-view-model.js";
import { TAB_KEYS, newlyOpened, openParts } from "./econ-view-tabs.js";
import { modelStages } from "./econ-stage-rules.js";
import { readStageTurns } from "./econ-stage-read.js";
import { logDebug, logLine } from "./econ-log.js";
import { countTurn, emptyTurnCount, gameTurnOf, sanitizeTurnCount } from "./econ-turn-count.js";
import { MARKETS_KEY, loadMarkets, saveMarkets } from "./econ-markets.js";
import { countRoles } from "./econ-depth.js";
import { cityKey, makeGoldYieldOf, makeRolesFor, readCities, readMarket, readRoutes, readTradeIncomeCents,
  sendProgress }
  from "./econ-commerce-read.js";
import { MACRO_KEY, loadMacro, saveMacro } from "./econ-macro-state.js";
import { blendedTerms, termsOf } from "./econ-systems.js";
import { readCrisisStage, readEconomy, readGovernment, readIdeology, readPopulations, resolveCycleEvents,
  sanitizePending, withPending } from "./econ-macro-read.js";
import { aliveMajorIds, ageType, bankGoldYield, bookFavor, bookGrievance, bookRelationship, buildingData, declareWar,
  gameTurn, isAliveMajor, localId, player, readAtWar, readBalanceCents, readConfig, readEnvelope, readGlobalParameters,
  readHappinessCents, readIncomeCents, readInfluence, readProduction, readSettlements, readUpkeepUnits, readRelations,
  readRelationshipRows, readStrength, loc, readUpkeepCents, safe,
  scaleAiPreference, sendCelebration, sendGold, sendInfluence, writeEnvelope } from "./econ-engine.js";

export const GLUE_KEY = "tower-economics-glue";
export const GLUE_VERSION = 2;
const REQUEST_KINDS = ["borrow", "lend", "repay", "restructure", "repudiate", "bankrupt", "tax", "tariff", "invest",
  "accept-offer", "decline-offer", "respond", "policy"];
const MAX_REQUESTS = 16;

/**
 * `roles` remembers the roles each building type had in its own age (econ-macro-read.js); `cycleEvents` holds the
 * engine's events since the last batch; `landed` names the civs whose payment from the last batch was seen to land;
 * `lines` is the turn and age the standing lines were last set and what each civ's lines should read
 * (econ-standing.js), by pid and line in whole Gold.
 * @typedef {{ v: number, stages: Record<string, StageTurns>, seen: number[], requests: PlanRequest[],
 *   guardOn: boolean | null, turns: import("./econ-turn-count.js").TurnCount, roles: Record<string, string>,
 *   cycleEvents: import("./econ-macro-read.js").PendingCycleEvent[], told: string[] | null,
 *   fresh: string[], landed: { batch: string, pids: number[] } | null,
 *   lines: { turn: number, age: string, want: Record<string, Record<string, number>> } | null,
 *   prices?: Record<string, { stack: number, factorPpm: number }> }} GlueState
 * @typedef {{ ledger: Ledger, glue: GlueState, lastPlan: PlanOutput | null, params: EngineParams | null,
 *   markets: MarketsState, macro: import("./econ-macro-state.js").MacroState, pops: Map<string, number>,
 *   skipsLogged: Set<string> }} Session
 */

/** @returns {GlueState} */
export function emptyGlue() {
  return { v: GLUE_VERSION, stages: {}, seen: [], requests: [], guardOn: null, turns: emptyTurnCount(), roles: {},
    cycleEvents: [], told: null, fresh: [], landed: null, lines: null, prices: {} };
}

/** @param {unknown} raw */
function cleanLanded(raw) {
  const value = /** @type {Record<string, any> | null} */ (raw && typeof raw === "object" ? raw : null);
  if (!value || typeof value.batch !== "string" || value.batch.length > 16 || !Array.isArray(value.pids)) return null;
  return { batch: value.batch, pids: value.pids.filter((pid) => Number.isInteger(pid) && pid >= 0).slice(0, 64) };
}

/** @param {unknown} raw */
function cleanLines(raw) {
  const value = /** @type {Record<string, any> | null} */ (raw && typeof raw === "object" ? raw : null);
  if (!value || !Number.isInteger(value.turn) || typeof value.age !== "string" || value.age.length > 32) return null;
  return { turn: value.turn, age: value.age, want: cleanWant(value.want) };
}

/** @param {unknown} raw */
function cleanWant(raw) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [pid, row] of Object.entries(raw).slice(0, 64)) {
    if (/^\d+$/.test(pid) && row && typeof row === "object") out[pid] = cleanWantRow(row);
  }
  return out;
}

/** @param {Record<string, unknown>} row */
function cleanWantRow(row) {
  /** @type {Record<string, number>} */
  const lines = {};
  for (const [line, gold] of Object.entries(row)) {
    if ((isMarkerKind(line) || isActionKind(line)) && Number.isInteger(gold) && /** @type {number} */ (gold) > 0) {
      lines[line] = /** @type {number} */ (gold);
    }
  }
  return lines;
}

/** @param {unknown} raw @param {(id: string) => boolean} keep */
function cleanIds(raw, keep) {
  return Array.isArray(raw) ? [...new Set(raw.filter((id) => typeof id === "string" && keep(id)))].slice(0, 32) : [];
}

/** @param {unknown} raw */
function cleanRoles(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [type, letters] of Object.entries(raw)) {
    if (/^[A-Z0-9_]{1,64}$/.test(type) && typeof letters === "string" && /^[cbtwie]{1,6}$/.test(letters)) out[type] = letters;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, StageTurns>}
 */
function cleanStages(raw) {
  /** @type {Record<string, StageTurns>} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [pid, row] of Object.entries(raw)) {
    if (!/^\d+$/.test(pid) || !row || typeof row !== "object") continue;
    /** @type {Record<string, number | null>} */
    const clean = {};
    for (const [stage, turn] of Object.entries(row)) clean[stage] = Number.isInteger(turn) ? turn : null;
    out[pid] = clean;
  }
  return out;
}

/**
 * The glue envelope read back, with anything untrusted dropped.
 * @param {unknown} raw
 * @returns {GlueState}
 */
export function sanitizeGlue(raw) {
  const out = emptyGlue();
  if (!raw || typeof raw !== "object") return out;
  const value = /** @type {Record<string, any>} */ (raw);
  out.stages = cleanStages(value.stages);
  out.seen = Array.isArray(value.seen) ? value.seen.filter((id) => Number.isInteger(id) && id >= 0) : [];
  out.requests = Array.isArray(value.requests) ? value.requests.filter(isRequest).slice(0, MAX_REQUESTS) : [];
  out.guardOn = typeof value.guardOn === "boolean" ? value.guardOn : null;
  out.turns = sanitizeTurnCount(value.turns);
  out.roles = cleanRoles(value.roles);
  out.cycleEvents = sanitizePending(value.cycleEvents);
  // `told`: the screen's parts the player has been told about (null until the first look seeds it); `fresh`: the
  // tabs with a part the player hasn't opened yet, for the dock button's marker.
  out.told = Array.isArray(value.told) ? cleanIds(value.told, (id) => /^[a-z]+[:.][A-Za-z]+$/.test(id)) : null;
  out.fresh = cleanIds(value.fresh, (id) => /** @type {readonly string[]} */ (TAB_KEYS).includes(id));
  out.landed = cleanLanded(value.landed);
  out.lines = cleanLines(value.lines);
  out.prices = cleanPrices(value.prices);
  return out;
}

/** @param {unknown} raw */
function cleanPrices(raw) {
  /** @type {Record<string, { stack: number, factorPpm: number }>} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [pid, row] of Object.entries(/** @type {Record<string, any>} */ (raw)).slice(0, 64)) {
    if (/^\d+$/.test(pid) && isPriceRow(row)) out[pid] = { stack: row.stack, factorPpm: row.factorPpm };
  }
  return out;
}

/** @param {any} row */
function isPriceRow(row) {
  return !!row && Number.isInteger(row.stack) && row.stack >= 0 && row.stack <= 127
    && Number.isInteger(row.factorPpm) && row.factorPpm >= 500000 && row.factorPpm <= 4000000;
}

/** @param {unknown} request */
export function isRequest(request) {
  return !!request && typeof request === "object"
    && REQUEST_KINDS.includes(/** @type {{ kind: string }} */ (request).kind);
}

/** @param {unknown} raw */
function parseGlue(raw) {
  if (typeof raw !== "string" || !raw) return emptyGlue();
  try { return sanitizeGlue(JSON.parse(raw)); } catch (_error) { return emptyGlue(); }
}

/** The session as the save holds it. @returns {Session} */
export function loadSession() {
  const ledgerRead = load(readEnvelope(MOD_ID));
  if (!ledgerRead.ok) logLine(`ledger envelope refused (${ledgerRead.reason}); starting empty`);
  const marketsRead = loadMarkets(readEnvelope(MARKETS_KEY));
  if (!marketsRead.ok) logLine(`markets envelope refused (${marketsRead.reason}); starting empty`);
  const macroRead = loadMacro(readEnvelope(MACRO_KEY));
  if (!macroRead.ok) logLine(`macro envelope refused (${macroRead.reason}); starting empty`);
  return { ledger: ledgerRead.ledger, glue: parseGlue(readEnvelope(GLUE_KEY)), lastPlan: null, params: null,
    markets: marketsRead.markets, macro: macroRead.macro, pops: new Map(), skipsLogged: new Set() };
}

/** @param {Session} session */
export function writeMacro(session) {
  return writeEnvelope(MACRO_KEY, saveMacro(session.macro));
}

/** @param {Session} session */
export function writeMarkets(session) {
  return writeEnvelope(MARKETS_KEY, saveMarkets(session.markets));
}

/** @param {Session} session */
export function writeGlue(session) {
  return writeEnvelope(GLUE_KEY, JSON.stringify(session.glue));
}

/** @param {Session} session */
export function writeLedger(session) {
  return writeEnvelope(MOD_ID, save(session.ledger));
}

/**
 * The setup options as the model takes them (DESIGN 8); an unreadable key keeps its setup default.
 * @param {GlueState} glue
 * @returns {PlanOptions}
 */
export function readOptions(glue) {
  const on = (/** @type {string} */ key) => readConfig(key) !== `${key}_OFF`;
  const rates = String(readConfig("ECONOMICS_RATES") || "").replace("ECONOMICS_RATES_", "").toLowerCase();
  const markets = on("ECONOMICS_MARKETS");
  const cycle = String(readConfig("ECONOMICS_CYCLE") || "").replace("ECONOMICS_CYCLE_", "").toLowerCase();
  const swings = String(readConfig("ECONOMICS_SWINGS") || "").replace("ECONOMICS_SWINGS_", "").toLowerCase();
  return { loans: on("ECONOMICS_LOANS"), guard: glue.guardOn ?? on("ECONOMICS_GUARD"), ai: on("ECONOMICS_AI"),
    rates: ["low", "standard", "high"].includes(rates) ? rates : "standard", stages: on("ECONOMICS_STAGES"),
    taxFallback: false, markets, tariffs: markets && on("ECONOMICS_TARIFFS"), investment: on("ECONOMICS_INVESTMENT"),
    // Inflation ships Off (DESIGN 8), so only an explicit On turns it on.
    inflation: readConfig("ECONOMICS_INFLATION") === "ECONOMICS_INFLATION_ON",
    cycle: ["off", "mild", "standard", "strong"].includes(cycle) ? cycle : "standard",
    swings: ["gentle", "volatile", "extreme"].includes(swings) ? swings : "volatile", systems: on("ECONOMICS_SYSTEMS"),
    crises: on("ECONOMICS_CRISES") };
}

/**
 * @typedef {ReturnType<typeof readEconomy>} Economy
 */

/**
 * One civ's row for the plan, every field by the same read whoever the civ is (docs/glue-contract.md). With a
 * 1.1 part on, its settlements' builds and Trade buildings, and the Trade Income the engine pays it; from 1.2 its
 * government and ideology, and from its economy the depth, the weighted Warehouses, the legacy cushion and the
 * settlements with a Commerce building.
 * @param {number} pid
 * @param {number[]} majors
 * @param {StageTurns} stages
 * @param {{ cities?: CityRead[], economy?: Economy }} [extra]
 * @returns {Civ}
 */
export function readCiv(pid, majors, stages, extra = {}) {
  const p = player(pid);
  const human = !!(p && p.isHuman === true);
  if (!isAliveMajor(pid)) return { id: pid, alive: false, human, balanceCents: 0, incomeCents: 0, stages };
  /** @type {Civ} */
  const civ = { id: pid, alive: true, human, balanceCents: readBalanceCents(pid), incomeCents: readIncomeCents(pid),
    upkeepCents: readUpkeepCents(pid), stages, atWar: readAtWar(pid, majors), happinessCents: readHappinessCents(pid),
    government: readGovernment(pid), ideology: readIdeology(pid), strength: readStrength(pid),
    influence: readInfluence(pid), production: readProduction(pid), settlements: readSettlements(pid),
    units: readUpkeepUnits(pid),
    ...economyFields(extra.economy) };
  if (extra.cities) Object.assign(civ, { cities: extra.cities, tradeIncomeCents: readTradeIncomeCents(pid) });
  return civ;
}

/**
 * The fields a civ's row takes from its economy; a civ with none reads as having no buildings.
 * @param {Economy | undefined} economy
 */
function economyFields(economy) {
  if (!economy) return { depthTurns: 0, depthFactorPct: 100, warehouses: 0, cushionBp: 0, commerceSettlements: 0 };
  return { depthTurns: economy.depthTurns, depthFactorPct: economy.depthFactorPct, warehouses: economy.warehouses,
    cushionBp: economy.cushionBp, commerceSettlements: economy.commerceSettlements };
}

/**
 * A civ's system terms for the glue's own reads (the Civic market depth share, Corporatist industry): last batch's
 * systems, at this turn's blend.
 * @param {Session} session
 * @param {number} pid
 * @param {number} turn
 * @param {PlanOptions} options
 */
export function glueTerms(session, pid, turn, options) {
  return options.systems === false ? termsOf("mixed") : blendedTerms(session.macro.systems[String(pid)], turn);
}

/**
 * A civ's economy (econ-macro-read.js readEconomy) with what the session knows: its stage turns, the age's first
 * turn, the role memory, its system's Commerce share and whether Banking's depth cap applies.
 * @param {Session} session
 * @param {number} pid
 * @param {number} turn
 * @param {PlanOptions} options
 */
export function economyOf(session, pid, turn, options) {
  const stageTurns = /** @type {Record<string, number | null | undefined>} */ (session.glue.stages[String(pid)] || {});
  const banking = stageTurns.banking;
  return readEconomy(pid, { turn, ageStartTurn: session.glue.turns.base + 1, age: ageType(), stageTurns,
    memory: session.glue.roles, commercePct: glueTerms(session, pid, turn, options).commercePct,
    bankingOpen: options.stages === false || (Number.isInteger(banking) && /** @type {number} */ (banking) <= turn) });
}

/**
 * The 1.1 reads for every living major (DESIGN 4.9, 4.10, 4.12): each civ's cities, the routes between majors and
 * the market, from the economies' buildings. Corporatist Industry buildings count twice for demand (DESIGN 4.17).
 * @param {number[]} majors
 * @param {Map<number, Economy>} economies
 * @param {(pid: number) => number} industryPct
 */
export function readCommerce(majors, economies, industryPct) {
  const rolesFor = makeRolesFor(buildingData(), bankGoldYield());
  const goldYieldOf = makeGoldYieldOf(buildingData());
  /** @type {Map<string, number>} */
  const tradeByCity = new Map();
  let industry = 0;
  /** @type {Map<number, CityRead[]>} */
  const cities = new Map();
  for (const pid of majors) {
    const economy = economies.get(pid);
    industry += ((economy?.industry ?? 0) * industryPct(pid)) / 100;
    const buildingsOf = (/** @type {any} */ city) => {
      const key = cityKey(safe(() => city.id, null));
      const list = (key && economy?.byCity.get(key)) || [];
      if (key) tradeByCity.set(key, Math.round(countRoles(list).trade));
      return list;
    };
    cities.set(pid, readCities(pid, rolesFor, buildingsOf, goldYieldOf));
  }
  return { cities, routes: readRoutes(majors, tradeByCity), market: readMarket(majors, Math.round(industry)) };
}

/**
 * This turn on the count that keeps rising across the ages (econ-turn-count.js); the first read in a new age moves
 * the count's base. Every turn the plan, the ledger and the glue keep is on this count.
 * @param {Session} session
 */
export function turnNow(session) {
  const next = countTurn(session.glue.turns, ageType(), gameTurn(), session.ledger.lastTurn);
  session.glue.turns = next.count;
  return next.turn;
}

/**
 * The game's own turn for a counted one, or null for a turn of an earlier age (for the screens).
 * @param {Session} session
 * @param {number} turn
 */
export function displayTurn(session, turn) {
  return gameTurnOf(session.glue.turns, turn);
}

/**
 * The game's purchase rate and relationship bands from GlobalParameters, read once a session, with other mods' rows
 * applied.
 * @returns {EngineParams}
 */
function readParams() {
  const rows = readGlobalParameters();
  return { goldPerPointCents: purchasePointCents(rows),
    ...relationshipBands(rows, readRelationshipRows()) };
}

/**
 * How many turn rolls the standing lines stood through since they were set: none on an age change (what the
 * transition charged isn't known, so nothing is counted back), else the turns since, at least one.
 * @param {Session} session
 * @param {number} turn
 */
export function rollsSince(session, turn) {
  const lines = session.glue.lines;
  if (!lines) return 1;
  if (lines.age !== ageType()) return 0;
  return Math.max(1, turn - lines.turn);
}

/**
 * The plan input for this turn: every major ever seen, stages carried forward, the engine's lines read once.
 * Updates the glue's seen list and stage turns. Each civ's income leaves out its standing lines (econ-standing.js),
 * so the model reads the income it always has; the batch (`rolls` above 0) also counts back into the balance what
 * the lines took or paid at the roll, and the batch row takes it off the grant.
 * @param {Session} session
 * @param {{ rolls?: number, charged?: ReturnType<typeof readCharged> }} [standing]
 * @returns {PlanInput}
 */
export function buildInput(session, standing = {}) {
  const turn = turnNow(session);
  const majors = aliveMajorIds();
  const seen = [...new Set([...session.glue.seen, ...majors])].sort((a, b) => a - b);
  session.glue.seen = seen;
  session.glue.stages = readStageTurns(session.glue.stages, majors, turn);
  if (!session.params) session.params = readParams();
  const options = readOptions(session.glue);
  const economies = new Map(majors.map((pid) => [pid, economyOf(session, pid, turn, options)]));
  const commerce = options.markets || options.investment
    ? readCommerce(majors, economies, (pid) => glueTerms(session, pid, turn, options).industryPct) : null;
  const charged = chargedOf(standing, majors);
  const civs = seen.map((pid) => withCharged(readCiv(pid, majors, modelStages(session.glue.stages[String(pid)]),
    { cities: commerce?.cities.get(pid), economy: economies.get(pid) }), charged.get(pid)));
  return { turn, age: ageType(), ledger: session.ledger, civs, relations: readRelations(majors),
    requests: session.glue.requests, params: session.params, options, markets: session.markets,
    routes: options.markets && commerce ? commerce.routes : [],
    market: options.markets ? commerce?.market : undefined, macro: session.macro,
    cycleEvents: resolveCycleEvents(session.glue.cycleEvents, readPopulations(majors)),
    crisisStage: readCrisisStage(), priceFactors: session.glue.prices || {} };
}

/**
 * The batch's read of the standing lines, or a fresh one counting `rolls` rolls (none for the screens).
 * @param {{ rolls?: number, charged?: ReturnType<typeof readCharged> }} standing
 * @param {number[]} majors
 */
function chargedOf(standing, majors) {
  return standing.charged ?? readCharged(majors, standing.rolls ?? 0);
}

/**
 * A civ's row with its standing lines taken out of its income and, for the batch, their charge counted back.
 * @param {Civ} civ
 * @param {{ cents: number, perTurn: number } | undefined} charged
 * @returns {Civ}
 */
function withCharged(civ, charged) {
  if (!charged || civ.alive !== true || (!charged.cents && !charged.perTurn)) return civ;
  const out = { ...civ, incomeCents: civ.incomeCents - charged.perTurn };
  if (charged.cents) Object.assign(out, { balanceCents: civ.balanceCents - charged.cents, engineCents: charged.cents });
  // An AI's markers stood through its roll before this batch; the local seat's went up after its own roll, so their
  // charge is still to come out of the income it's about to be paid, and its funds leave it out (econ-batch.js).
  if (charged.cents && civ.id === localId()) out.rollPendingCents = charged.cents;
  return out;
}

/**
 * Sends one plan's grants and bookings: one net Gold, Influence and celebration grant per civ, then the grievance
 * and relationship rows (DESIGN 4.14 commit).
 * @param {PlanOutput} plan
 */
export function sendPlan(plan) {
  let sent = 0;
  // Gold and celebration go out as the batch rows' whole amounts (econ-batch.js wholeGold); the rest carries.
  for (const row of plan.batch?.civs || []) {
    if (sendGold(row.pid, grantOf(row))) sent += 1;
    if (sendCelebration(row.pid, celebrationPaidOf(row))) sent += 1;
  }
  for (const [pid, amount] of sumBy(plan.influence)) if (sendInfluence(pid, amount)) sent += 1;
  bookDiplomacy(plan);
  sendPreferences(plan.aiPreferences);
  return sent + sendProgressRows(plan.progress);
}

/**
 * The grievance, relationship and favor rows on the game's own ledgers (DESIGN 4.5, 4.12, AI-PLAN 4.4).
 * @param {PlanOutput} plan
 */
function bookDiplomacy(plan) {
  for (const row of plan.grievances) bookGrievance(row);
  for (const row of plan.relationships) bookRelationship(row);
  for (const row of plan.favors || []) bookFavor(row);
  // An AI that commits to Foreign adventure declares its war (a surprise war, as its own are: phase 0, 2026-11-02).
  for (const row of plan.wars || []) declareWar(row.a, row.b);
}

/**
 * AI-PLAN 4.2: every AI's preference factors, every turn, so one that isn't needed is set back to 1.
 * @param {AiPreferenceRow[] | undefined} rows
 */
function sendPreferences(rows) {
  let sent = 0;
  for (const row of rows || []) if (scaleAiPreference(row)) sent += 1;
  return sent;
}

/**
 * The development loans' progress (DESIGN 4.12), one addProgress per city.
 * @param {ProgressRow[]} rows
 */
function sendProgressRows(rows) {
  let sent = 0;
  for (const row of rows || []) if (sendProgress(row)) sent += 1;
  return sent;
}

/** @param {YieldRow[]} rows */
function sumBy(rows) {
  /** @type {Map<number, number>} */
  const out = new Map();
  for (const row of rows) out.set(row.pid, (out.get(row.pid) || 0) + row.amount);
  return out;
}

/**
 * Takes the plan's ledger and markets as the session's and writes all three envelopes, before any grant goes out.
 * @param {Session} session
 * @param {PlanOutput} plan
 */
function commitSession(session, plan) {
  session.ledger = plan.ledger;
  session.markets = plan.markets;
  session.macro = plan.macro;
  session.glue.requests = [];
  session.glue.cycleEvents = [];
  session.pops = readPopulations(aliveMajorIds());
  session.lastPlan = plan;
  writeLedger(session);
  writeMarkets(session);
  writeMacro(session);
  writeGlue(session);
}

/**
 * A skipped batch says why once a session at the normal level, so a game with every option off shows it in the log
 * without the debug switch (the lab's build check C.2), and only at debug after that.
 * @param {Session} session
 * @param {number} turn
 * @param {string} why
 * @param {string} reason
 */
function logSkip(session, turn, why, reason) {
  const line = `turn ${turn} (${why}): skipped, ${reason}`;
  if (session.skipsLogged.has(reason)) { logDebug(line); return; }
  session.skipsLogged.add(reason);
  logLine(line);
}

/**
 * The turn batch: snapshot, plan, write the ledger, send. Returns the plan, or null when nothing ran.
 * @param {Session} session
 * @param {string} why
 */
export function runTurn(session, why) {
  const started = Date.now();
  const turn = turnNow(session);
  const charged = readCharged(aliveMajorIds(), rollsSince(session, turn));
  const input = buildInput(session, { charged });
  const plan = planTurn(input);
  if (plan.skipped) {
    logSkip(session, input.turn, why, plan.skipped);
    if (plan.skipped === "all-off") clearLines(session, charged);
    writeGlue(session);
    return null;
  }
  // Set with the ledger, so a save before the markers land still counts one roll for the ones that stood. The
  // markers themselves go up on the local player's turn (placeLinesNow): a CREATE_ELEMENT sent at TurnBegin, before
  // that turn is active, is dropped (lab run 2026-11-04T18-23-11).
  session.glue.lines = { turn: input.turn, age: ageType(), want: wantOf(plan) };
  commitSession(session, plan);
  const sent = sendPlan(plan);
  const marketsText = saveMarkets(plan.markets);
  const violations = checkPlan({ plan, civs: input.civs, envelopeText: undefined, marketsText,
    macroText: saveMacro(plan.macro) });
  for (const violation of violations) logLine(`invariant ${violation.id} on turn ${input.turn}: ${violation.detail}`);
  logLine(`turn ${input.turn} (${why}): ${plan.transfers.length} transfer(s), ${sent} grant(s), `
    + `${plan.events.length} event(s), ${Date.now() - started} ms`);
  return plan;
}

/**
 * The plan's lines for the next roll, by pid and line.
 * @param {PlanOutput} plan
 */
function wantOf(plan) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  for (const row of plan.standing || []) (out[String(row.pid)] ||= {})[row.line] = row.gold;
  return out;
}

/**
 * Brings every living civ's markers to the lines the last batch wants, from a fresh read of what stands, a paying
 * line sized by the capital's Income percentage. Sent on the local player's turn; running it again changes nothing
 * once they've landed, except that a one-shot marker is wanted only once: it's taken out of the glue as it's sent, so
 * the next pass takes it down. Returns how many requests went out.
 * @param {Session} session
 */
export function placeLinesNow(session) {
  const want = session.glue.lines?.want || {};
  let sent = 0;
  let consumed = false;
  for (const pid of aliveMajorIds()) {
    const row = want[String(pid)] || {};
    const wanted = new Map(/** @type {[import("./econ-standing.js").StandingLine, number][]} */ (Object.entries(row)));
    const held = readHeldMarkers(pid);
    const measure = priceChange(session.glue, pid, wanted, held, () => writeGlue(session));
    sent += placeLines(pid, wanted, held, wanted.size || held.length ? readIncomePct(pid) : 0);
    if (measure) measure();
    disbandNow(pid, row);
    shutBuildings(pid, row, held);
    if (consumeOneShots(row)) consumed = true;
  }
  if (consumed) writeGlue(session);
  return sent;
}

/**
 * An overdrawn civ with its income below zero loses the units the plan says (DESIGN 4.18, econ-disband.js); the
 * player hears which of theirs went, added to the turn's notification.
 * @param {number} pid
 * @param {Record<string, number>} row
 */
function disbandNow(pid, row) {
  if (!row.DISBAND) return;
  const names = disbandUnits(pid, row.DISBAND);
  if (names.length && pid === localId()) {
    appendNotice(names.map((name) => loc("LOC_ECONOMICS_NOTICE_OVERDRAWN_DISBANDED", name)));
  }
}

/**
 * An overdrawn civ's settlements with their buildings shut down, as many as the ramp says, the costliest first
 * (DESIGN 4.18, econ-standing-read.js shutNow); the player hears which of theirs shut, added to the notification.
 * @param {number} pid
 * @param {Record<string, number>} row
 * @param {import("./econ-standing-read.js").HeldMarker[]} held
 */
function shutBuildings(pid, row, held) {
  const names = shutNow(pid, row.SHUT || 0, held);
  if (names.length && pid === localId()) {
    appendNotice(names.map((name) => loc("LOC_ECONOMICS_NOTICE_OVERDRAWN_SHUT", name)));
  }
}

/**
 * Takes the one-shot kinds out of a civ's wanted lines once they've been sent; true when there was one.
 * @param {Record<string, number>} row
 */
function consumeOneShots(row) {
  let consumed = false;
  for (const line of Object.keys(row)) {
    if (ONE_SHOT.has(line) || isActionKind(line)) { delete row[line]; consumed = true; }
  }
  return consumed;
}

/**
 * With every option off the batch doesn't run, so what the lines took or paid at the roll goes back as a grant and
 * the markers come down.
 * @param {Session} session
 * @param {ReturnType<typeof readCharged>} charged
 */
function clearLines(session, charged) {
  for (const [pid, read] of charged) {
    if (read.cents) sendGold(pid, -read.cents);
    if (read.held.length) placeLines(pid, new Map(), read.held);
  }
  session.glue.lines = null;
}

/**
 * On load: if the saved batch is this turn's, re-send the nets of the civs whose balance still reads the snapshot
 * (the save fell in the window between the ledger write and the grants landing, DESIGN 4.14, P15).
 * @param {Session} session
 */
export function resendLostBatch(session) {
  const batch = session.ledger.lastBatch;
  if (!batch || batch.turn !== turnNow(session)) return [];
  const balances = new Map(batch.civs.map((row) => [row.pid, readBalanceCents(row.pid)]));
  // A payment seen to land is never re-sent, even when the balance has since come back to the snapshot.
  const landed = session.glue.landed?.batch === batch.id ? session.glue.landed.pids : [];
  const lost = batchStatus(batch, balances).filter((row) => row.status === "lost" && !landed.includes(row.pid));
  for (const row of lost) {
    const saved = batch.civs.find((civ) => civ.pid === row.pid);
    sendGold(row.pid, row.cents);
    if (saved?.influence) sendInfluence(row.pid, saved.influence);
    if (saved) sendCelebration(row.pid, celebrationPaidOf(saved));
    logLine(`batch ${batch.id} re-sent for player ${row.pid}: ${row.cents} cents`);
  }
  return lost;
}

/**
 * A moment after the grants go out: notes which civs' payments have landed, so a save made after this can't have
 * them re-sent (a balance spent back to exactly its snapshot would otherwise read as lost). Returns how many it added.
 * @param {Session} session
 */
export function noteLanded(session) {
  const batch = session.ledger.lastBatch;
  if (!batch) return 0;
  const balances = new Map(batch.civs.map((row) => [row.pid, readBalanceCents(row.pid)]));
  const seen = session.glue.landed?.batch === batch.id ? session.glue.landed.pids : [];
  const added = batchStatus(batch, balances).filter((row) => row.status === "landed" && !seen.includes(row.pid)
    && grantOf(/** @type {BatchRow} */ (batch.civs.find((civ) => civ.pid === row.pid))) !== 0).map((row) => row.pid);
  if (!added.length && session.glue.landed?.batch === batch.id) return 0;
  session.glue.landed = { batch: batch.id, pids: [...seen, ...added] };
  writeGlue(session);
  return added.length;
}

/**
 * The local player's stage turns, coinage included (the model's civ record leaves it out), for the screen.
 * @param {Session} session
 * @param {number} pid
 */
export function stageTurnsOf(session, pid) {
  return { ...(session.glue.stages[String(pid)] || {}) };
}

/**
 * The screen's parts that opened for the player since it was last told (econ-view-tabs.js): the notification keys,
 * and the tabs marked unseen for the dock button. The first call in a game only notes what's open, so a game that
 * starts with every tab says nothing.
 * @param {Session} session
 * @param {PlanInput} input
 * @param {number} pid
 * @returns {string[]}
 */
export function noteOpened(session, input, pid) {
  const { facts, rules } = viewRules(input, pid, stageTurnsOf(session, pid));
  const now = openParts(rules, facts);
  if (session.glue.told === null) {
    session.glue.told = now;
    writeGlue(session);
    return [];
  }
  const opened = newlyOpened(session.glue.told, now, facts);
  if (opened.told.length === session.glue.told.length) return [];
  session.glue.told = opened.told;
  session.glue.fresh = [...new Set([...session.glue.fresh, ...opened.tabs])];
  writeGlue(session);
  return opened.keys;
}

/**
 * The player opened a tab: it's no longer marked unseen.
 * @param {Session} session
 * @param {string} tab
 */
export function markSeen(session, tab) {
  if (!session.glue.fresh.includes(tab)) return false;
  session.glue.fresh = session.glue.fresh.filter((key) => key !== tab);
  writeGlue(session);
  return true;
}

/**
 * Keeps one engine event the cycle weighs (a capture, a raze, a disaster) for the next batch, in the glue envelope so
 * a save before the batch keeps it (DESIGN 4.11).
 * @param {Session} session
 * @param {import("./econ-macro-read.js").PendingCycleEvent | null} row
 */
export function noteCycleEvent(session, row) {
  if (!row) return false;
  session.glue.cycleEvents = withPending(session.glue.cycleEvents, row);
  writeGlue(session);
  return true;
}

/**
 * Queues one of the local player's requests for the next batch (DESIGN 5); the model refuses what it can't do.
 * @param {Session} session
 * @param {PlanRequest} request
 */
export function queueRequest(session, request) {
  if (!isRequest(request) || session.glue.requests.length >= MAX_REQUESTS) return false;
  session.glue.requests.push(request);
  writeGlue(session);
  return true;
}

/**
 * Drops a queued request by its position.
 * @param {Session} session
 * @param {number} index
 */
export function dropRequest(session, index) {
  if (index < 0 || index >= session.glue.requests.length) return false;
  session.glue.requests.splice(index, 1);
  writeGlue(session);
  return true;
}

/**
 * The player's guard switch (DESIGN 4.6): true or false overrides the setup option, null follows it.
 * @param {Session} session
 * @param {boolean | null} on
 */
export function setGuard(session, on) {
  session.glue.guardOn = typeof on === "boolean" ? on : null;
  writeGlue(session);
  return readOptions(session.glue).guard;
}

/**
 * A fresh ledger for a test or a reset from the console; never called by the game itself.
 * @param {Session} session
 */
export function resetLedger(session) {
  session.ledger = emptyLedger();
  session.glue = emptyGlue();
  session.markets = loadMarkets(null).markets;
  session.macro = loadMacro(null).macro;
  writeLedger(session);
  writeMarkets(session);
  writeMacro(session);
  writeGlue(session);
}
