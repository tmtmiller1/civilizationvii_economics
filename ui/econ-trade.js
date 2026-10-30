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
 * The bill's share for Trade buildings on one side: 10% a building (12% for a Civic market civ, DESIGN 4.17), 30%
 * at most (DESIGN 4.13).
 * @param {number | undefined} count
 * @param {number} [perBuildingPct]
 */
export function tradeBuildingPct(count, perBuildingPct = TRADE.tradeBuildingPct) {
  return Math.min(TRADE.tradeBuildingMaxPct, perBuildingPct * Math.max(0, Math.floor(Number(count)) || 0));
}

/**
 * bill = 0.5 * the prices of the copies the route imports * (1 + exporter's Trade share) * (1 - importer's), in cents.
 * @param {RouteRead} route
 * @param {Record<string, number>} prices
 * @param {{ exporterPct?: number, importerPct?: number }} [perBuilding] each side's share a Trade building
 */
export function routeBillCents(route, prices, perBuilding = {}) {
  let sum = 0;
  for (const type of route.resources || []) sum += priceOf(prices, type);
  const up = 100 + tradeBuildingPct(route.exporterTradeBuildings, perBuilding.exporterPct);
  const down = 100 - tradeBuildingPct(route.importerTradeBuildings, perBuilding.importerPct);
  return Math.round((sum * TRADE.billPermille * up * down) / 10000000);
}

/**
 * @typedef {{ tradeBuildingPct: number, billPaidPct: number, exportPct: number, highTariffEveryTurns: number,
 *   fixedPrices: boolean }} TradeTerms
 */

/** The terms a civ trades on when nobody says otherwise (Mixed). @type {TradeTerms} */
const PLAIN = { tradeBuildingPct: TRADE.tradeBuildingPct, billPaidPct: 100, exportPct: 100,
  highTariffEveryTurns: TRADE.tariffEveryTurns, fixedPrices: false };

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
 * tariff. Routes between a civ and itself, or with a party outside `civIds`, are skipped. Between systems (DESIGN
 * 4.17) the bill uses the importer's prices (a Planned importer's are the class prices, `basePrices`), each side's
 * Trade buildings count at its own share, a Manorial importer pays 20% less and a Mercantile exporter is owed 10% more.
 * @param {{ routes: RouteRead[], prices: Record<string, number>, tariffs: TariffRow[], civIds: Set<number>,
 *   tariffsOn: boolean, termsOf?: (pid: number) => TradeTerms, basePrices?: Record<string, number> }} q
 * @returns {{ importer: number, exporter: number, gross: number, owed: number }[]}
 */
export function owedByPair({ routes, prices, tariffs, civIds, tariffsOn, termsOf = () => PLAIN, basePrices = {} }) {
  /** @type {Map<string, { importer: number, exporter: number, gross: number, owed: number }>} */
  const rows = new Map();
  const billed = routes.filter((route) => route.importer !== route.exporter && civIds.has(route.importer)
    && civIds.has(route.exporter));
  for (const route of billed) {
    const key = `${route.importer}>${route.exporter}`;
    const row = rows.get(key) || { importer: route.importer, exporter: route.exporter, gross: 0, owed: 0 };
    const importer = termsOf(route.importer);
    row.gross += routeBillCents(route, importer.fixedPrices ? basePrices : prices,
      { exporterPct: termsOf(route.exporter).tradeBuildingPct, importerPct: importer.tradeBuildingPct });
    rows.set(key, row);
  }
  for (const row of rows.values()) {
    const held = tariffsOn ? TARIFF_PCT[tariffOf(tariffs, row.importer)] : 0;
    const system = termsOf(row.importer).billPaidPct * termsOf(row.exporter).exportPct;
    row.owed = Math.floor((row.gross * (100 - held) * system) / 1000000);
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
 * A High tariff costs its importer 1 relationship with each exporter it bills, every 5 turns it stands (every 10 for
 * a Mercantile importer, DESIGN 4.17).
 * @param {{ tariffs: TariffRow[], owed: { importer: number, exporter: number, gross: number }[], turn: number,
 *   everyTurns?: (pid: number) => number }} q
 * @returns {RelationshipRow[]}
 */
export function highTariffCosts({ tariffs, owed, turn, everyTurns = () => TRADE.tariffEveryTurns }) {
  /** @type {RelationshipRow[]} */
  const out = [];
  for (const row of tariffs) {
    if (row.level !== "high" || turn <= row.changedTurn) continue;
    if ((turn - row.changedTurn) % Math.max(1, everyTurns(row.pid)) !== 0) continue;
    for (const pair of owed) {
      if (pair.importer === row.pid && pair.gross > 0) {
        out.push({ a: row.pid, b: pair.exporter, delta: TRADE.highRelationship });
      }
    }
  }
  return out;
}

/** Tariff levels from lowest to highest. */
const RANK = { none: 0, low: 1, high: 2 };

/**
 * @param {TariffLevel} a
 * @param {TariffLevel} b
 */
const higher = (a, b) => (RANK[b] > RANK[a] ? b : a);

/**
 * The level an AI would set on its own: Low against a partner it pays more than it's paid and isn't Friendly with,
 * High against one it's Unfriendly or worse with. A tariff falls on everything a civ imports, so a partner counts
 * only when it sells the AI at least `aiPartnerSharePct` of its imports (sharePct, 100 when not given). An AI whose
 * High tariff costs it less (Mercantile, DESIGN 4.17) goes to High against any partner it isn't Friendly with and pays.
 * @param {{ level: RelationLevel, netPayer: boolean, sharePct?: number }[]} partners the civs it imports from
 * @param {boolean} cheapHigh
 * @returns {TariffLevel}
 */
export function aiOwnTariff(partners, cheapHigh) {
  /** @type {TariffLevel} */
  let want = "none";
  for (const partner of partners) {
    if ((partner.sharePct ?? 100) < TRADE.aiPartnerSharePct) continue;
    if (partner.level === "unfriendly" || partner.level === "war") want = higher(want, "high");
    else if (partner.level !== "friendly" && partner.netPayer) want = higher(want, cheapHigh ? "high" : "low");
  }
  return want;
}

/**
 * DESIGN 6: an AI answers a tariff on its exports in kind (Low with Low, High with High) 2 turns after it's set, sets
 * one of its own by aiOwnTariff, takes the higher of the two, and drops back once neither reason holds. It answers an
 * importer that buys at least `aiPartnerSharePct` of its exports (`importerSharePct`, 100 when not given). Returns
 * the level it wants, or null to stay. The 5-turn limit is the caller's.
 * @param {{ pid: number, tariffs: TariffRow[], importers: number[], turn: number,
 *   partners?: { level: RelationLevel, netPayer: boolean, sharePct?: number }[], cheapHigh?: boolean,
 *   importerSharePct?: (pid: number) => number }} q
 * @returns {TariffLevel | null}
 */
export function aiTariffWanted({ pid, tariffs, importers, turn, partners = [], cheapHigh = false,
  importerSharePct = () => 100 }) {
  const mine = tariffOf(tariffs, pid);
  /** @type {TariffLevel} */
  let answer = "none";
  for (const row of tariffs) {
    if (!importers.includes(row.pid) || importerSharePct(row.pid) < TRADE.aiPartnerSharePct) continue;
    answer = higher(answer, answerTo(row, mine, turn));
  }
  const want = higher(answer, aiOwnTariff(partners, cheapHigh));
  return want === mine ? null : want;
}

/**
 * The answer to one importer's tariff: its level once it's 2 turns old; before that the lower of it and the AI's own
 * level, so a raise waits 2 turns and an easing is followed at once.
 * @param {TariffRow} row
 * @param {TariffLevel} mine
 * @param {number} turn
 * @returns {TariffLevel}
 */
function answerTo(row, mine, turn) {
  const settled = turn - row.changedTurn >= TRADE.aiMatchTurns;
  return settled || RANK[mine] >= RANK[row.level] ? row.level : mine;
}
