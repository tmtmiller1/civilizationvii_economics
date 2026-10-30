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
 * @param {TariffLevel} a
 * @param {TariffLevel} b
 */
const lower = (a, b) => (RANK[b] < RANK[a] ? b : a);

/**
 * @typedef {{ pid?: number, level: RelationLevel, netPayer: boolean, sharePct?: number }} TariffPartner
 *   a civ the AI imports from: its relationship, whether the AI pays it on net, its share of the AI's imports
 */

/**
 * The level one partner alone gives an AI reason to set: High when it's Unfriendly or worse, Low (High for
 * `cheapHigh`) when the AI pays it on net and isn't Friendly with it, none when it sells under `aiPartnerSharePct`
 * of the AI's imports.
 * @param {TariffPartner} partner
 * @param {boolean} cheapHigh
 * @returns {TariffLevel}
 */
function ownReason(partner, cheapHigh) {
  if ((partner.sharePct ?? 100) < TRADE.aiPartnerSharePct) return "none";
  if (partner.level === "unfriendly" || partner.level === "war") return "high";
  if (partner.level !== "friendly" && partner.netPayer) return cheapHigh ? "high" : "low";
  return "none";
}

/**
 * The level an AI would set on its own: Low against a partner it pays more than it's paid and isn't Friendly with,
 * High against one it's Unfriendly or worse with. A tariff falls on everything a civ imports, so a partner counts
 * only when it sells the AI at least `aiPartnerSharePct` of its imports (sharePct, 100 when not given). An AI whose
 * High tariff costs it less (Mercantile, DESIGN 4.17) goes to High against any partner it isn't Friendly with and pays.
 * @param {TariffPartner[]} partners the civs it imports from
 * @param {boolean} cheapHigh
 * @returns {TariffLevel}
 */
export function aiOwnTariff(partners, cheapHigh) {
  /** @type {TariffLevel} */
  let want = "none";
  for (const partner of partners) want = higher(want, ownReason(partner, cheapHigh));
  return want;
}

/**
 * Each civ's reason for the AI's tariff, keyed by its id (a partner given without one gets a key of its own): the
 * answer to its tariff when it buys at least `aiPartnerSharePct` of the AI's exports, and the AI's own reason against
 * it, the higher of the two.
 * @param {{ pid: number, tariffs: TariffRow[], importers: number[], turn: number, partners?: TariffPartner[],
 *   cheapHigh?: boolean, importerSharePct?: (pid: number) => number }} q
 * @returns {Map<string, TariffLevel>}
 */
export function tariffReasons({ pid, tariffs, importers, turn, partners = [], cheapHigh = false,
  importerSharePct = () => 100 }) {
  const mine = tariffOf(tariffs, pid);
  /** @type {Map<string, TariffLevel>} */
  const out = new Map();
  const add = (/** @type {string} */ key, /** @type {TariffLevel} */ level) =>
    out.set(key, higher(out.get(key) ?? "none", level));
  for (const row of tariffs) {
    if (!importers.includes(row.pid) || importerSharePct(row.pid) < TRADE.aiPartnerSharePct) continue;
    add(String(row.pid), answerTo(row, mine, turn));
  }
  partners.forEach((partner, i) => add(Number.isInteger(partner.pid) ? String(partner.pid) : `partner-${i}`,
    ownReason(partner, cheapHigh)));
  return out;
}

/**
 * @typedef {{ peace: Record<string, number>, eased: Record<string, TariffLevel> }} TariffEasing
 *   by "<ai>-<other>": the turn the AI's count of turns at peace with the other civ started, while the other is a
 *   reason for its tariff; and, once it has eased off that civ, the lowest tariff the other civ has held since
 */

/** @param {number} pid @param {number} other */
export const easingKey = (pid, other) => `${pid}-${other}`;

/**
 * DESIGN 6, coming back down: while an AI holds a tariff, each civ that's a reason for it is counted turns at peace
 * from the turn it became one. After `aiPeaceTurns` of them in a row, or at once when the two are Friendly, the AI
 * eases off that civ: it stops counting it as a reason, so its own grudge and its answer to that civ's tariff both
 * go. It eases off only that civ; a reason from anyone else still holds. War ends the easing and starts the count
 * over. While eased, the other civ's tariff as it stood (and any lowering of it) goes unanswered, so the AI doesn't
 * raise again in kind the turn after it drops; a raise past the lowest level the other has held since is new, and is
 * answered as any tariff is. A civ the AI isn't tariffed against has no count. Returns the reasons that still count
 * and the easing state for the next turn; the AI's own entries for civs `alive` says are gone are dropped.
 * @param {{ pid: number, mine: TariffLevel, turn: number, reasons: Map<string, TariffLevel>, tariffs: TariffRow[],
 *   relationOf: (other: number) => RelationLevel, alive?: (other: number) => boolean, easing: TariffEasing }} q
 * @returns {{ counted: Map<string, TariffLevel>, easing: TariffEasing, eased: number[] }}
 */
export function easeTariffs({ pid, mine, turn, reasons, tariffs, relationOf, alive = () => true, easing }) {
  const state = { peace: { ...easing.peace }, eased: { ...easing.eased } };
  /** @type {Map<string, TariffLevel>} */
  const counted = new Map();
  /** @type {number[]} */
  const easedNow = [];
  const own = (/** @type {Record<string, unknown>} */ rec) => Object.keys(rec)
    .filter((key) => key.startsWith(`${pid}-`)).map((key) => key.slice(String(pid).length + 1));
  for (const other of new Set([...reasons.keys(), ...own(state.peace), ...own(state.eased)])) {
    const reason = reasons.get(other) ?? "none";
    if (!/^\d+$/.test(other)) { counted.set(other, reason); continue; }
    const id = Number(other);
    const verdict = easeOne(state, { key: easingKey(pid, id), alive: alive(id), relation: relationOf(id),
      theirs: tariffOf(tariffs, id), reason, mine, turn });
    if (verdict === "count") counted.set(other, reason);
    else if (verdict === "eased") easedNow.push(id);
  }
  return { counted, easing: state, eased: easedNow };
}

/**
 * One civ's turn in easeTariffs: "count" when it's still a reason, "eased" when the AI eases off it now, "skip" when
 * it's eased already or no reason, "gone" when it's dead. Updates `state` in place.
 * @param {TariffEasing} state
 * @param {{ key: string, alive: boolean, relation: RelationLevel, theirs: TariffLevel, reason: TariffLevel,
 *   mine: TariffLevel, turn: number }} c
 */
function easeOne(state, c) {
  const { peace, eased } = state;
  if (!c.alive || c.relation === "war") {
    delete peace[c.key];
    delete eased[c.key];
    return c.alive ? "count" : "gone";
  }
  if (stillEased(eased, c.key, c.theirs)) return "skip";
  if (c.reason === "none") { delete peace[c.key]; return "skip"; }
  // No count while the AI holds no tariff; Friendly eases at once.
  if (c.relation !== "friendly" && (c.mine === "none" || atPeaceUnder(peace, c.key, c.turn))) return "count";
  delete peace[c.key];
  eased[c.key] = c.theirs;
  return "eased";
}

/**
 * Whether an eased civ stays eased: yes while its tariff is no higher than the lowest it has held since (which this
 * keeps); a raise past that ends the easing.
 * @param {Record<string, TariffLevel>} eased
 * @param {string} key
 * @param {TariffLevel} theirs
 */
function stillEased(eased, key, theirs) {
  if (!Object.hasOwn(eased, key)) return false;
  if (RANK[theirs] <= RANK[eased[key]]) {
    eased[key] = lower(eased[key], theirs);
    return true;
  }
  delete eased[key];
  return false;
}

/**
 * Starts the count this turn if it hasn't started, and says whether it's still under `aiPeaceTurns`.
 * @param {Record<string, number>} peace
 * @param {string} key
 * @param {number} turn
 */
function atPeaceUnder(peace, key, turn) {
  if (!Object.hasOwn(peace, key)) peace[key] = turn;
  return turn - peace[key] < TRADE.aiPeaceTurns;
}

/**
 * DESIGN 6: an AI answers a tariff on its exports in kind (Low with Low, High with High) 2 turns after it's set, sets
 * one of its own by aiOwnTariff, takes the higher of the two, and drops back once neither reason holds. It answers an
 * importer that buys at least `aiPartnerSharePct` of its exports (`importerSharePct`, 100 when not given). With
 * `easing` given, a civ it has eased off (easeTariffs) is no reason any more. Returns the level it wants, or null to
 * stay, and the easing state for the next turn. The 5-turn limit is the caller's.
 * @param {{ pid: number, tariffs: TariffRow[], importers: number[], turn: number, partners?: TariffPartner[],
 *   cheapHigh?: boolean, importerSharePct?: (pid: number) => number, easing?: TariffEasing,
 *   relationOf?: (other: number) => RelationLevel, alive?: (other: number) => boolean }} q
 * @returns {{ wanted: TariffLevel | null, easing: TariffEasing | null, eased: number[] }}
 */
export function aiTariffStep(q) {
  const mine = tariffOf(q.tariffs, q.pid);
  const reasons = tariffReasons(q);
  const step = q.easing ? easeTariffs({ pid: q.pid, mine, turn: q.turn, reasons, tariffs: q.tariffs,
    relationOf: q.relationOf || (() => "neutral"), alive: q.alive, easing: q.easing }) : null;
  /** @type {TariffLevel} */
  let want = "none";
  for (const level of (step ? step.counted : reasons).values()) want = higher(want, level);
  return { wanted: want === mine ? null : want, easing: step ? step.easing : null, eased: step ? step.eased : [] };
}

/**
 * The level an AI wants without the easing (aiTariffStep), or null to stay.
 * @param {Parameters<typeof aiTariffStep>[0]} q
 * @returns {TariffLevel | null}
 */
export function aiTariffWanted(q) {
  return aiTariffStep({ ...q, easing: undefined }).wanted;
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
