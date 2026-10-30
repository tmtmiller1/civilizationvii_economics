// econ-trade.js - Economics: trade settlement and tariffs (DESIGN 4.10), as plain data. Each pair of civs settles the
// net value of what they import from each other, every turn their routes stand; the side with the positive figure
// pays it, capped at 10% of its positive income, with several partners scaled down evenly and the part over the cap
// waived, never carried. The game already pays the exporter Trade Income for each copy a route takes (TradeYields),
// so this bill is what the importer owes on top, kept small so a route stays worth making. It stays a script
// transfer (level 2): the game's per-import modifier is player-wide and can't net one partner against another, cap a
// payment or hand it to the exporter. A tariff is the importer holding back a share of what it owes. Nothing here
// reads the engine.

import { TARIFF_PCT, TRADE } from "./econ-params.js";
import { priceOf } from "./econ-prices.js";

/** @type {TariffLevel[]} */
export const TARIFF_LEVELS = ["none", "low", "high"];

/** @param {unknown} level */
export function isTariffLevel(level) {
  return TARIFF_LEVELS.includes(/** @type {TariffLevel} */ (level));
}

/**
 * The bill's share for Trade buildings on one side: 10% a building, 30% at most (DESIGN 4.13).
 * @param {number | undefined} count
 */
export function tradeBuildingPct(count) {
  return Math.min(TRADE.tradeBuildingMaxPct, TRADE.tradeBuildingPct * Math.max(0, Math.floor(Number(count)) || 0));
}

/**
 * bill = 0.5 * the prices of the copies the route imports * (1 + exporter's Trade share) * (1 - importer's), in cents.
 * @param {RouteRead} route
 * @param {Record<string, number>} prices
 */
export function routeBillCents(route, prices) {
  let sum = 0;
  for (const type of route.resources || []) sum += priceOf(prices, type);
  const up = 100 + tradeBuildingPct(route.exporterTradeBuildings);
  const down = 100 - tradeBuildingPct(route.importerTradeBuildings);
  return Math.round((sum * TRADE.billPct * up * down) / 1000000);
}

/**
 * A civ's tariff level; every civ starts at None.
 * @param {TariffRow[]} tariffs
 * @param {number} pid
 * @returns {TariffLevel}
 */
export function tariffOf(tariffs, pid) {
  return tariffs.find((row) => row.pid === pid)?.level ?? "none";
}

/**
 * What each importer owes each exporter: the bills summed over its routes from that exporter, before and after its
 * tariff. Routes between a civ and itself, or with a party outside `civIds`, are skipped.
 * @param {{ routes: RouteRead[], prices: Record<string, number>, tariffs: TariffRow[], civIds: Set<number>,
 *   tariffsOn: boolean }} q
 * @returns {{ importer: number, exporter: number, gross: number, owed: number }[]}
 */
export function owedByPair({ routes, prices, tariffs, civIds, tariffsOn }) {
  /** @type {Map<string, { importer: number, exporter: number, gross: number, owed: number }>} */
  const rows = new Map();
  for (const route of routes) {
    if (route.importer === route.exporter || !civIds.has(route.importer) || !civIds.has(route.exporter)) continue;
    const key = `${route.importer}>${route.exporter}`;
    const row = rows.get(key) || { importer: route.importer, exporter: route.exporter, gross: 0, owed: 0 };
    row.gross += routeBillCents(route, prices);
    rows.set(key, row);
  }
  for (const row of rows.values()) {
    const held = tariffsOn ? TARIFF_PCT[tariffOf(tariffs, row.importer)] : 0;
    row.owed = Math.floor((row.gross * (100 - held)) / 100);
  }
  return [...rows.values()].sort((a, b) => a.importer - b.importer || a.exporter - b.exporter);
}

/**
 * net_AB = owed_AB - owed_BA; the side with the positive figure pays it to the other. Pairs that net to 0 drop out.
 * @param {{ importer: number, exporter: number, owed: number }[]} owed
 * @returns {{ payer: number, payee: number, cents: number }[]}
 */
export function netPairs(owed) {
  /** @type {Map<string, { a: number, b: number, net: number }>} */
  const pairs = new Map();
  for (const row of owed) {
    const [a, b] = row.importer < row.exporter ? [row.importer, row.exporter] : [row.exporter, row.importer];
    const pair = pairs.get(`${a}:${b}`) || { a, b, net: 0 };
    pair.net += row.importer === a ? row.owed : -row.owed;
    pairs.set(`${a}:${b}`, pair);
  }
  /** @type {{ payer: number, payee: number, cents: number }[]} */
  const out = [];
  for (const { a, b, net } of pairs.values()) {
    if (net > 0) out.push({ payer: a, payee: b, cents: net });
    else if (net < 0) out.push({ payer: b, payee: a, cents: -net });
  }
  return out.sort((x, y) => x.payer - y.payer || x.payee - y.payee);
}

/**
 * The 10% cap: what a payer can pay in all this turn, 0 when its income is at or below 0.
 * @param {number} incomeCents
 */
export function settlementCap(incomeCents) {
  return Math.floor((TRADE.capPct * Math.max(0, incomeCents)) / 100);
}

/**
 * paid = min(net, cap) per payer, several partners scaled down evenly; the rest is waived.
 * @param {{ payer: number, payee: number, cents: number }[]} nets
 * @param {(pid: number) => number} incomeOf
 * @returns {{ payer: number, payee: number, owed: number, cents: number, waived: number }[]}
 */
export function capPayments(nets, incomeOf) {
  /** @type {Map<number, number>} */
  const totals = new Map();
  for (const row of nets) totals.set(row.payer, (totals.get(row.payer) || 0) + row.cents);
  return nets.map((row) => {
    const total = /** @type {number} */ (totals.get(row.payer));
    const cap = settlementCap(incomeOf(row.payer));
    const cents = total <= cap ? row.cents : Math.floor((row.cents * cap) / total);
    return { payer: row.payer, payee: row.payee, owed: row.cents, cents, waived: row.cents - cents };
  });
}

/**
 * One change per 5 turns (DESIGN 4.10), for the player and the AI alike.
 * @param {number | undefined} changedTurn
 * @param {number} turn
 */
export function canChangeTariff(changedTurn, turn) {
  return !Number.isInteger(changedTurn) || turn - /** @type {number} */ (changedTurn) >= TRADE.tariffEveryTurns;
}

/**
 * The tariff rows with one civ's level set; None clears the row's level but keeps its turn for the 5-turn limit.
 * @param {TariffRow[]} tariffs
 * @param {number} pid
 * @param {TariffLevel} level
 * @param {number} turn
 * @returns {TariffRow[]}
 */
export function withTariff(tariffs, pid, level, turn) {
  const rest = tariffs.filter((row) => row.pid !== pid);
  return [...rest, { pid, level, changedTurn: turn }].sort((a, b) => a.pid - b.pid);
}

/**
 * A High tariff costs its importer 1 relationship with each exporter it bills, every 5 turns it stands.
 * @param {{ tariffs: TariffRow[], owed: { importer: number, exporter: number, gross: number }[], turn: number }} q
 * @returns {RelationshipRow[]}
 */
export function highTariffCosts({ tariffs, owed, turn }) {
  /** @type {RelationshipRow[]} */
  const out = [];
  for (const row of tariffs) {
    if (row.level !== "high" || turn <= row.changedTurn) continue;
    if ((turn - row.changedTurn) % TRADE.tariffEveryTurns !== 0) continue;
    for (const pair of owed) {
      if (pair.importer === row.pid && pair.gross > 0) {
        out.push({ a: row.pid, b: pair.exporter, delta: TRADE.highRelationship });
      }
    }
  }
  return out;
}

/**
 * DESIGN 6: an AI stays at None unless a civ that imports from it holds a High tariff; then it matches 2 turns after
 * that tariff was set, and drops back once no such partner holds one. Returns the level it wants, or null to stay.
 * @param {{ pid: number, tariffs: TariffRow[], importers: number[], turn: number }} q
 * @returns {TariffLevel | null}
 */
export function aiTariffWanted({ pid, tariffs, importers, turn }) {
  const mine = tariffOf(tariffs, pid);
  const against = tariffs.filter((row) => importers.includes(row.pid) && row.level === "high");
  const settled = against.some((row) => turn - row.changedTurn >= TRADE.aiMatchTurns);
  if (settled && mine !== "high") return "high";
  if (!against.length && mine === "high") return "none";
  return null;
}
