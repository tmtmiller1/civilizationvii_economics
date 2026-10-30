// econ-session.js - Economics: the game-side session. It holds the ledger, the markets envelope (prices, tariffs) and
// the glue's own envelope (stage turns, the civs ever seen, the player's pending requests, the guard switch), builds
// the plan input from the engine once per turn, runs the model and sends what comes back (DESIGN 4.14). The batch runs
// at TurnBegin: right after the roll every balance is fresh and nobody has spent yet, and a negative balance with
// positive income has just been wiped by the engine (P3, P4). The ledger is written before the grants go out, so a save
// in the second before they land can be told from one after (P15; batchStatus on load).

import { planTurn } from "./econ-plan.js";
import { MOD_ID, emptyLedger, load, save } from "./econ-state.js";
import { batchStatus } from "./econ-batch.js";
import { grantsFor, netGrants } from "./econ-conservation.js";
import { engineLines } from "./econ-params.js";
import { checkPlan } from "./econ-invariants.js";
import { modelStages } from "./econ-stage-rules.js";
import { readStageTurns } from "./econ-stage-read.js";
import { logDebug, logLine } from "./econ-log.js";
import { countTurn, emptyTurnCount, gameTurnOf, sanitizeTurnCount } from "./econ-turn-count.js";
import { MARKETS_KEY, loadMarkets, saveMarkets } from "./econ-markets.js";
import { countRoles } from "./econ-depth.js";
import { cityKey, makeRolesFor, readCities, readMarket, readRoutes, readTradeIncomeCents, sendProgress }
  from "./econ-commerce-read.js";
import { aliveMajorIds, ageType, bankGoldYield, bookGrievance, bookRelationship, buildingData, gameTurn, isAliveMajor,
  player, readAtWar, readBalanceCents, readCityBuildings, readConfig, readDepth, readEnvelope, readGlobalParameters,
  readHappinessCents, readIncomeCents, readRelations, readUpkeepCents, safe, sendCelebration, sendGold, sendInfluence,
  writeEnvelope } from "./econ-engine.js";

export const GLUE_KEY = "tower-economics-glue";
export const GLUE_VERSION = 2;
const REQUEST_KINDS = ["borrow", "lend", "repay", "restructure", "repudiate", "tax", "tariff", "invest",
  "accept-offer", "decline-offer"];
const MAX_REQUESTS = 16;

/**
 * @typedef {{ v: number, stages: Record<string, StageTurns>, seen: number[], requests: PlanRequest[],
 *   guardOn: boolean | null, turns: import("./econ-turn-count.js").TurnCount }} GlueState
 * @typedef {{ ledger: Ledger, glue: GlueState, lastPlan: PlanOutput | null, params: EngineParams | null,
 *   markets: MarketsState }} Session
 */

/** @returns {GlueState} */
export function emptyGlue() {
  return { v: GLUE_VERSION, stages: {}, seen: [], requests: [], guardOn: null, turns: emptyTurnCount() };
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
  return out;
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
  return { ledger: ledgerRead.ledger, glue: parseGlue(readEnvelope(GLUE_KEY)), lastPlan: null, params: null,
    markets: marketsRead.markets };
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
  return { loans: on("ECONOMICS_LOANS"), guard: glue.guardOn ?? on("ECONOMICS_GUARD"), ai: on("ECONOMICS_AI"),
    rates: ["low", "standard", "high"].includes(rates) ? rates : "standard", stages: on("ECONOMICS_STAGES"),
    taxFallback: false, markets, tariffs: markets && on("ECONOMICS_TARIFFS"), investment: on("ECONOMICS_INVESTMENT"),
    // Inflation ships Off (DESIGN 8), so only an explicit On turns it on.
    inflation: readConfig("ECONOMICS_INFLATION") === "ECONOMICS_INFLATION_ON",
    cycle: ["off", "mild", "standard", "strong"].includes(cycle) ? cycle : "standard", systems: on("ECONOMICS_SYSTEMS") };
}

/**
 * One civ's row for the plan, every field by the same read whoever the civ is (docs/glue-contract.md). With a
 * 1.1 part on, its settlements' builds and Trade buildings, and the Trade Income the engine pays it.
 * @param {number} pid
 * @param {number[]} majors
 * @param {StageTurns} stages
 * @param {{ cities?: CityRead[] }} [commerce]
 * @returns {Civ}
 */
export function readCiv(pid, majors, stages, commerce = {}) {
  const p = player(pid);
  const human = !!(p && p.isHuman === true);
  if (!isAliveMajor(pid)) return { id: pid, alive: false, human, balanceCents: 0, incomeCents: 0, stages };
  const depth = readDepth(pid);
  /** @type {Civ} */
  const civ = { id: pid, alive: true, human, balanceCents: readBalanceCents(pid), incomeCents: readIncomeCents(pid),
    upkeepCents: readUpkeepCents(pid), stages, depthTurns: depth.depthTurns, depthFactorPct: depth.depthFactorPct,
    atWar: readAtWar(pid, majors), happinessCents: readHappinessCents(pid) };
  if (commerce.cities) Object.assign(civ, { cities: commerce.cities, tradeIncomeCents: readTradeIncomeCents(pid) });
  return civ;
}

/**
 * The 1.1 reads for every living major (DESIGN 4.9, 4.10, 4.12): each civ's cities, the routes between majors and
 * the market, from one pass over the cities' buildings.
 * @param {number[]} majors
 */
export function readCommerce(majors) {
  const rolesFor = makeRolesFor(buildingData(), bankGoldYield());
  /** @type {Map<string, number>} */
  const tradeByCity = new Map();
  let industry = 0;
  /** @type {Map<number, CityRead[]>} */
  const cities = new Map();
  for (const pid of majors) {
    const buildingsOf = (/** @type {any} */ city) => {
      const list = readCityBuildings(city);
      const counts = countRoles(list);
      const key = cityKey(safe(() => city.id, null));
      if (key) tradeByCity.set(key, Math.round(counts.trade));
      industry += counts.industry;
      return list;
    };
    cities.set(pid, readCities(pid, rolesFor, buildingsOf));
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
 * The plan input for this turn: every major ever seen, stages carried forward, the engine's lines read once.
 * Updates the glue's seen list and stage turns.
 * @param {Session} session
 * @returns {PlanInput}
 */
export function buildInput(session) {
  const turn = turnNow(session);
  const majors = aliveMajorIds();
  const seen = [...new Set([...session.glue.seen, ...majors])].sort((a, b) => a - b);
  session.glue.seen = seen;
  session.glue.stages = readStageTurns(session.glue.stages, majors, turn);
  if (!session.params) session.params = engineLines(readGlobalParameters());
  const options = readOptions(session.glue);
  const commerce = options.markets || options.investment ? readCommerce(majors) : null;
  const civs = seen.map((pid) => readCiv(pid, majors, modelStages(session.glue.stages[String(pid)]),
    { cities: commerce?.cities.get(pid) }));
  return { turn, age: ageType(), ledger: session.ledger, civs, relations: readRelations(majors),
    requests: session.glue.requests, params: session.params, options, markets: session.markets,
    routes: options.markets && commerce ? commerce.routes : [],
    market: options.markets ? commerce?.market : undefined };
}

/**
 * Sends one plan's grants and bookings: one net Gold, Influence and celebration grant per civ, then the grievance
 * and relationship rows (DESIGN 4.14 commit).
 * @param {PlanOutput} plan
 */
export function sendPlan(plan) {
  let sent = 0;
  for (const [pid, cents] of netGrants(grantsFor(plan.transfers))) {
    if (typeof pid === "number" && sendGold(pid, cents)) sent += 1;
  }
  for (const [pid, amount] of sumBy(plan.influence)) if (sendInfluence(pid, amount)) sent += 1;
  for (const [pid, amount] of sumBy(plan.celebration)) if (sendCelebration(pid, amount)) sent += 1;
  for (const row of plan.grievances) bookGrievance(row);
  for (const row of plan.relationships) bookRelationship(row);
  return sent + sendProgressRows(plan.progress);
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
  session.glue.requests = [];
  session.lastPlan = plan;
  writeLedger(session);
  writeMarkets(session);
  writeGlue(session);
}

/**
 * The turn batch: snapshot, plan, write the ledger, send. Returns the plan, or null when nothing ran.
 * @param {Session} session
 * @param {string} why
 */
export function runTurn(session, why) {
  const started = Date.now();
  const input = buildInput(session);
  const plan = planTurn(input);
  if (plan.skipped) { logDebug(`turn ${input.turn} (${why}): skipped, ${plan.skipped}`); writeGlue(session); return null; }
  commitSession(session, plan);
  const sent = sendPlan(plan);
  const marketsText = saveMarkets(plan.markets);
  const violations = checkPlan({ plan, civs: input.civs, envelopeText: undefined, marketsText });
  for (const violation of violations) logLine(`invariant ${violation.id} on turn ${input.turn}: ${violation.detail}`);
  logLine(`turn ${input.turn} (${why}): ${plan.transfers.length} transfer(s), ${sent} grant(s), `
    + `${plan.events.length} event(s), ${Date.now() - started} ms`);
  return plan;
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
  const lost = batchStatus(batch, balances).filter((row) => row.status === "lost");
  for (const row of lost) {
    const saved = batch.civs.find((civ) => civ.pid === row.pid);
    sendGold(row.pid, row.cents);
    if (saved?.influence) sendInfluence(row.pid, saved.influence);
    if (saved?.celebration) sendCelebration(row.pid, saved.celebration);
    logLine(`batch ${batch.id} re-sent for player ${row.pid}: ${row.cents} cents`);
  }
  return lost;
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
  writeLedger(session);
  writeMarkets(session);
  writeGlue(session);
}
