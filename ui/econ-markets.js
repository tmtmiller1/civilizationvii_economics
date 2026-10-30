// econ-markets.js - Economics: the markets envelope (DESIGN 9), saved apart from the ledger: each resource's price and
// its last 30 turns, every civ's tariff level, the last ten turns of each civ's income (the AI investment rule asks
// whether a host's income is growing, DESIGN 6) and the age each AI last gave aid in (once per age, DESIGN 6). At most
// 32 KB; load refuses anything that isn't ours without throwing, and save(load(x)) is a fixed point.

import { INVEST, PRICES } from "./econ-params.js";
import { isTariffLevel } from "./econ-trade.js";
import { utf8Bytes } from "./econ-state.js";

export const MARKETS_KEY = "tower-economics-markets";
export const MARKETS_VERSION = 1;
export const MARKETS_MAX_BYTES = 32768;

/** @returns {MarketsState} */
export function emptyMarkets() {
  return { lastTurn: null, prices: {}, history: {}, tariffs: [], incomes: {}, aidAge: {}, investTurn: {} };
}

/** @param {unknown} x */
const isInt = (x) => Number.isInteger(x);
/** @param {unknown} x */
const isRecord = (x) => !!x && typeof x === "object" && !Array.isArray(x);
/** @param {string} key */
const isTypeKey = (key) => /^[A-Z0-9_]{1,64}$/.test(key);

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
function cleanPrices(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
    if (isTypeKey(key) && isInt(value) && value >= 0) out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {(key: string) => boolean} keyOk
 * @param {number} keep
 * @returns {Record<string, number[]>}
 */
function cleanSeries(raw, keyOk, keep) {
  /** @type {Record<string, number[]>} */
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
    if (!keyOk(key) || !Array.isArray(value)) continue;
    out[key] = value.filter((x) => isInt(x)).slice(-keep);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {TariffRow[]}
 */
function cleanTariffs(raw) {
  /** @type {TariffRow[]} */
  const out = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || !isInt(row.pid) || row.pid < 0 || !isTariffLevel(row.level) || !isInt(row.changedTurn)) continue;
    if (out.some((x) => x.pid === row.pid)) continue;
    out.push({ pid: row.pid, level: row.level, changedTurn: row.changedTurn });
  }
  return out.sort((a, b) => a.pid - b.pid);
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
function cleanAidAges(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
    if (/^\d{1,3}$/.test(key) && typeof value === "string" && isTypeKey(value)) out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
function cleanTurns(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
    if (/^\d{1,3}$/.test(key) && isInt(value)) out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} input
 * @returns {MarketsState}
 */
export function sanitizeMarkets(input) {
  const out = emptyMarkets();
  if (!isRecord(input)) return out;
  const raw = /** @type {Record<string, unknown>} */ (input);
  out.lastTurn = isInt(raw.lastTurn) ? /** @type {number} */ (raw.lastTurn) : null;
  out.prices = cleanPrices(raw.prices);
  out.history = cleanSeries(raw.history, isTypeKey, PRICES.historyTurns);
  out.tariffs = cleanTariffs(raw.tariffs);
  out.incomes = cleanSeries(raw.incomes, (key) => /^\d{1,3}$/.test(key), INVEST.incomeHistoryTurns);
  out.aidAge = cleanAidAges(raw.aidAge);
  out.investTurn = cleanTurns(raw.investTurn);
  return out;
}

/** @param {MarketsState} markets */
export function cloneMarkets(markets) {
  return sanitizeMarkets(JSON.parse(JSON.stringify(markets)));
}

/**
 * The envelope text; past 32 KB the oldest half of each price history goes first, then the histories.
 * @param {MarketsState} markets
 */
export function saveMarkets(markets) {
  const clean = sanitizeMarkets(markets);
  let text = JSON.stringify({ mod: MARKETS_KEY, v: MARKETS_VERSION, markets: clean });
  let keep = PRICES.historyTurns;
  while (utf8Bytes(text) > MARKETS_MAX_BYTES && keep > 0) {
    keep = Math.floor(keep / 2);
    for (const key of Object.keys(clean.history)) clean.history[key] = clean.history[key].slice(-keep);
    text = JSON.stringify({ mod: MARKETS_KEY, v: MARKETS_VERSION, markets: clean });
  }
  return text;
}

/**
 * Never throws; a refusal returns an empty state.
 * @param {unknown} raw
 * @returns {{ ok: boolean, reason: string, markets: MarketsState }}
 */
export function loadMarkets(raw) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, reason: "empty", markets: emptyMarkets() };
  const envelope = parseEnvelope(raw);
  const reason = envelope === undefined ? "unparseable" : refusal(envelope);
  if (reason) return { ok: false, reason, markets: emptyMarkets() };
  return { ok: true, reason: "loaded", markets: sanitizeMarkets(/** @type {Record<string, any>} */ (envelope).markets) };
}

/**
 * The envelope as an object, or undefined when the text doesn't parse.
 * @param {unknown} raw
 */
function parseEnvelope(raw) {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch (_error) { return undefined; }
}

/** @param {unknown} obj */
function refusal(obj) {
  const envelope = /** @type {Record<string, any> | null} */ (obj);
  if (!envelope || typeof envelope !== "object" || envelope.mod !== MARKETS_KEY || !isInt(envelope.v)) return "foreign";
  return envelope.v > MARKETS_VERSION ? "newer" : null;
}

/**
 * Each living civ's income added to its last ten turns; a civ that isn't listed loses its row.
 * @param {Record<string, number[]>} incomes
 * @param {Civ[]} civs
 */
export function withIncomes(incomes, civs) {
  /** @type {Record<string, number[]>} */
  const out = {};
  for (const civ of civs) {
    if (civ.alive !== true) continue;
    out[String(civ.id)] = [...(incomes[String(civ.id)] || []), civ.incomeCents].slice(-INVEST.incomeHistoryTurns);
  }
  return out;
}

/**
 * Whether a civ's income is above where it stood ten turns ago (a full ten-turn record is needed).
 * @param {Record<string, number[]>} incomes
 * @param {number} pid
 */
export function isIncomeGrowing(incomes, pid) {
  const row = incomes[String(pid)] || [];
  return row.length >= INVEST.incomeHistoryTurns && row[row.length - 1] > row[0];
}
