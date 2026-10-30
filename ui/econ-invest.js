// econ-invest.js - Economics: development loans, general investment and aid (DESIGN 4.12), as plain data. A
// development loan backs the build at the head of one city's queue right now, since a script can't set an AI's
// queue: G / 3 progress, capped at what the build needs, the rest never leaves the investor, and a fixed return for
// 25 turns. General investment is a Gold pair whose return moves with the host's income. Aid is either kind with no
// return and no record. The records keep the loan rules for misses, default and the lender block. Nothing here reads
// the engine; the glue lands the progress with addProgress and the Gold with grantYield.

import { INVEST, MISS } from "./econ-params.js";
import { divCeil } from "./econ-money.js";
import { garnishDue } from "./econ-payments.js";

/** @type {InvestKind[]} */
export const INVEST_KINDS = ["project", "general"];

/** @param {unknown} kind */
export function isInvestKind(kind) {
  return INVEST_KINDS.includes(/** @type {InvestKind} */ (kind));
}

/** @param {number} seq */
export function investId(seq) {
  return `I${seq}`;
}

/** @param {unknown} id */
export function investSeq(id) {
  const match = /^I([1-9]\d*)$/.exec(String(id));
  return match ? Number(match[1]) : 0;
}

/**
 * G / 3 Gold a point of progress, capped at what the build still needs; only the Gold the progress uses is spent.
 * @param {number} cents
 * @param {number} neededProgress
 */
export function progressFor(cents, neededProgress) {
  const perPoint = INVEST.goldPerProgress * 100;
  const wanted = Math.floor(Math.max(0, cents) / perPoint);
  const progress = Math.max(0, Math.min(wanted, Math.floor(neededProgress) || 0));
  return { progress, usedCents: progress * perPoint, refundCents: Math.max(0, cents) - progress * perPoint };
}

/**
 * The return a turn in thousandths: 5% for a development loan, 6% when it backs a role building, 4.5% for general.
 * @param {InvestKind} kind
 * @param {boolean} [roleBuilding]
 */
export function returnMille(kind, roleBuilding = false) {
  if (kind === "general") return INVEST.generalMille;
  return roleBuilding ? INVEST.roleProjectMille : INVEST.projectMille;
}

/**
 * The base dividend: ceil(G * mille / 1000).
 * @param {number} principal
 * @param {number} mille
 */
export function baseDividend(principal, mille) {
  return divCeil(principal * mille, 1000);
}

/**
 * growth = clamp(income now / income at investment, 0.5, 2.0) in thousandths; income at or below 0 now reads 0.5,
 * and an investment made at an income under 10 Gold counts from 10.
 * @param {number} incomeNow
 * @param {number} baseIncome
 */
export function growthMille(incomeNow, baseIncome) {
  if (!(incomeNow > 0)) return INVEST.growthMinMille;
  const base = Math.max(INVEST.minHostIncomeCents, baseIncome);
  const mille = Math.floor((incomeNow * 1000) / base);
  return Math.max(INVEST.growthMinMille, Math.min(INVEST.growthMaxMille, mille));
}

/**
 * This turn's dividend: fixed for a development loan, ceil(G * 4.5% * growth) for general.
 * @param {Investment} record
 * @param {number} hostIncomeCents
 */
export function dividendDue(record, hostIncomeCents) {
  if (record.kind === "project") return baseDividend(record.principal, record.mille);
  return divCeil(record.principal * record.mille * growthMille(hostIncomeCents, record.baseIncome), 1000000);
}

/**
 * The relationship a gift buys, once, both sides: +1 per `tenths / 10` turns of the host's income (at least 10 Gold
 * a turn), at most 10.
 * @param {number} cents
 * @param {number} hostIncomeCents
 * @param {number} tenthsPerPoint
 */
export function relationshipGain(cents, hostIncomeCents, tenthsPerPoint) {
  const perTurn = Math.max(INVEST.minHostIncomeCents, hostIncomeCents);
  const points = Math.floor((Math.max(0, cents) * 10) / (tenthsPerPoint * perTurn));
  return Math.min(INVEST.maxRelationship, points);
}

/**
 * The relationship rate for a kind, aid included.
 * @param {InvestKind} kind
 * @param {boolean} asAid
 */
export function tenthsFor(kind, asAid) {
  if (asAid) return INVEST.aidTenthsPerPoint;
  return kind === "project" ? INVEST.projectTenthsPerPoint : INVEST.generalTenthsPerPoint;
}

/**
 * @param {{ id: string, kind: InvestKind, investor: number, host: number, principal: number, turn: number,
 *   cityId?: string | null, roleBuilding?: boolean, baseIncome?: number }} spec
 * @returns {Investment}
 */
export function makeInvestment({ id, kind, investor, host, principal, turn, cityId = null, roleBuilding = false,
  baseIncome = 0 }) {
  const mille = returnMille(kind, roleBuilding);
  return { id, kind, investor, host, principal, mille, term: INVEST.term, paid: 0, missed: 0, state: "active",
    opened: turn, closedTurn: null, writtenOff: 0, outstanding: INVEST.term * baseDividend(principal, mille),
    cityId: kind === "project" ? cityId : null, baseIncome: kind === "general" ? baseIncome : 0 };
}

/** @param {Investment} record */
export function isOpenInvestment(record) {
  return record.state === "active" || record.state === "default";
}

/**
 * An active record's turn: the dividend in full or a miss. Three misses in a row is default, as for a loan
 * (DESIGN 4.4); the dividend itself doesn't step up, since its size is the contract.
 * @param {Investment} record
 * @param {{ funds: number, hostIncomeCents: number }} q
 */
export function settleDividend(record, { funds, hostIncomeCents }) {
  const due = dividendDue(record, hostIncomeCents);
  if (funds < due) {
    const missed = record.missed + 1;
    /** @type {LoanState} */
    const state = missed >= MISS.defaultAt ? "default" : "active";
    return { record: { ...record, missed, state }, cents: 0, missed: true, defaulted: state === "default",
      closed: false };
  }
  const paid = record.paid + 1;
  const closed = paid >= record.term;
  const outstanding = closed ? 0 : Math.max(0, record.outstanding - baseDividend(record.principal, record.mille));
  /** @type {LoanState} */
  const state = closed ? "closed" : "active";
  return { record: { ...record, paid, missed: 0, outstanding, state }, cents: due, missed: false, defaulted: false,
    closed };
}

/**
 * A defaulted record's garnish, by the loan rule (DESIGN 4.5), until what's left to come is paid.
 * @param {Investment} record
 * @param {{ incomeCents: number, balanceCents: number, cashCents: number }} q
 */
export function settleInvestmentDefault(record, q) {
  const cents = garnishDue(/** @type {Loan} */ (/** @type {unknown} */ ({ outstanding: record.outstanding })), q);
  const outstanding = record.outstanding - cents;
  /** @type {LoanState} */
  const state = outstanding === 0 ? "closed" : "default";
  return { record: { ...record, outstanding, state }, cents, closed: outstanding === 0 };
}

/**
 * A development loan whose city the host no longer holds closes with the rest written off; general stays.
 * @param {Investment} record
 * @param {Set<string>} hostCities
 * @param {number} turn
 * @returns {Investment | null} the closed record, or null when it stands
 */
export function lostCityWriteOff(record, hostCities, turn) {
  if (record.kind !== "project" || !isOpenInvestment(record) || record.cityId === null) return null;
  if (hostCities.has(record.cityId)) return null;
  return { ...record, state: "closed", closedTurn: turn, writtenOff: record.outstanding, outstanding: 0 };
}

/**
 * Closes every open record the host holds from the investor as repudiated; returns the records and the Gold
 * written off (DESIGN 4.12: a seizure of foreign holdings plays as a repudiation).
 * @param {Investment[]} investments
 * @param {{ host: number, investor: Party, turn: number }} q
 */
export function repudiateInvestments(investments, { host, investor, turn }) {
  let writtenOff = 0;
  /** @type {string[]} */
  const ids = [];
  const records = investments.map((record) => {
    if (record.host !== host || record.investor !== investor || !isOpenInvestment(record)) return record;
    writtenOff += record.outstanding;
    ids.push(record.id);
    return { ...record, state: /** @type {LoanState} */ ("repudiated"), closedTurn: turn,
      writtenOff: record.outstanding, outstanding: 0 };
  });
  return { records, writtenOff, ids };
}

/**
 * What's still owed on a host's open records, for the screens.
 * @param {Investment[]} investments
 * @param {number} host
 */
export function hostOwes(investments, host) {
  let sum = 0;
  for (const record of investments) if (record.host === host && isOpenInvestment(record)) sum += record.outstanding;
  return sum;
}

/**
 * Whether the relationship allows investment: not at war, Neutral or better (DESIGN 4.12).
 * @param {RelationLevel} level
 * @param {boolean} asAid aid only needs peace
 */
export function relationAllows(level, asAid) {
  if (level === "war") return false;
  return asAid || level !== "unfriendly";
}
