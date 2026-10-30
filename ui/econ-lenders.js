// econ-lenders.js - Economics: who will lend, and at what rate (DESIGN 4.3). Relations are plain { a, b, level } rows;
// an unknown pair is neutral, which is also the fallback if the relationship level proves unreadable (probe P5).
// Blocks carry how long they last: a default blocks for the rest of the age, a repudiation of a civ for this age and
// the next, a repudiation of the bond market or temple treasuries for 30 turns (DESIGN 4.5).

import { BASE_RATE_PPM, BOND, BOND_FACTOR, CITIZENS, LENDER_BALANCE_MULTIPLE, RATE_CAP_MULTIPLE, RELATION_PCT,
  REPUDIATION, SHORT_TERM, TEMPLE, isWorldAccount } from "./econ-params.js";
import { divRound } from "./econ-money.js";
import { recentRepudiations } from "./econ-credit.js";
import { hasStage } from "./econ-stages.js";

/**
 * @param {Relation[] | undefined} relations
 * @param {Party} a
 * @param {Party} b
 * @returns {RelationLevel}
 */
export function relationLevel(relations, a, b) {
  for (const row of relations || []) {
    if ((row.a === a && row.b === b) || (row.a === b && row.b === a)) return row.level;
  }
  return "neutral";
}

/** @param {string} level */
export function relationPct(level) {
  return RELATION_PCT[level] ?? RELATION_PCT.neutral;
}

/**
 * @param {Ledger} ledger
 * @param {Party} lender
 * @param {number} borrower
 * @param {number} turn
 */
export function isBlocked(ledger, lender, borrower, turn) {
  return ledger.blocks.some((block) => block.lender === lender && block.borrower === borrower
    && (block.untilTurn === null || turn < block.untilTurn));
}

/**
 * @param {Ledger} ledger
 * @param {Party} lender
 * @param {number} borrower
 */
export function hasDefaultAgainst(ledger, lender, borrower) {
  return ledger.loans.some((loan) => loan.lender === lender && loan.borrower === borrower && loan.state === "default");
}

/**
 * A block row. A default lasts the age; a civ repudiation this age and the next; a world one 30 turns.
 * @param {{ lender: Party, borrower: number, reason: BlockReason, turn: number }} q
 * @returns {Block}
 */
export function blockFor({ lender, borrower, reason, turn }) {
  if (reason === "repudiation") {
    if (isWorldAccount(lender)) {
      return { lender, borrower, reason, agesLeft: null, untilTurn: turn + REPUDIATION.worldBlockTurns };
    }
    return { lender, borrower, reason, agesLeft: REPUDIATION.lenderBlockAges, untilTurn: null };
  }
  return { lender, borrower, reason: "default", agesLeft: 0, untilTurn: null };
}

/**
 * Blocks after an age change: the ones with ages left lose one; the ones with none end. Turn blocks run on.
 * @param {Block[]} blocks
 */
export function blocksAfterAge(blocks) {
  /** @type {Block[]} */
  const out = [];
  for (const block of blocks) {
    if (block.untilTurn !== null) out.push(block);
    else if (block.agesLeft !== null && block.agesLeft > 0) out.push({ ...block, agesLeft: block.agesLeft - 1 });
  }
  return out;
}

/**
 * @param {string} age
 * @param {number} [rates]
 */
export function rateCapPpm(age, rates = 100) {
  const base = BASE_RATE_PPM[age];
  return base ? divRound(base * RATE_CAP_MULTIPLE * rates, 100) : null;
}

/**
 * r_L = base / standing * relation_factor * depth_factor * rates option, in ppm, stopped at r_cap. `systemPct` is
 * the two systems' share (DESIGN 4.17: Merchant oligarchy lends and borrows at 0.8, Tribute borrows at 1.2).
 * @param {{ age: string, standing: number, level: string, rates?: number, depthFactorPct?: number,
 *   systemPct?: number }} q
 */
export function civRatePpm({ age, standing, level, rates = 100, depthFactorPct = 100, systemPct = 100 }) {
  const base = BASE_RATE_PPM[age];
  if (!base) return null;
  const rate = divRound(base * rates * relationPct(level) * depthFactorPct * systemPct, 100 * 100 * standing * 100);
  return Math.min(rate, /** @type {number} */ (rateCapPpm(age, rates)));
}

/**
 * r_bond = 2 * base / standing * depth_factor, which is also the temple treasuries' rate (DESIGN 4.6). For the bond
 * market `systemPct` carries the rest of 4.3's formula: the borrower's system, the cycle spread (4.11) and
 * inflation's premium (4.8); temple treasuries take none of them.
 * @param {{ age: string, standing: number, rates?: number, depthFactorPct?: number, systemPct?: number }} q
 */
export function worldRatePpm({ age, standing, rates = 100, depthFactorPct = 100, systemPct = 100 }) {
  const base = BASE_RATE_PPM[age];
  if (!base) return null;
  const rate = divRound(base * rates * BOND_FACTOR * depthFactorPct * systemPct, 100 * standing * 100);
  return Math.min(rate, /** @type {number} */ (rateCapPpm(age, rates)));
}

export const bondRatePpm = worldRatePpm;

/**
 * Why a civ will not lend P to the borrower, or null when it will. `balanceCents` is net of principal committed.
 * @param {{ ledger: Ledger, lender: number, borrower: number, principal: number, balanceCents: number,
 *   level: string, turn: number }} q
 */
export function civLenderRefusal({ ledger, lender, borrower, principal, balanceCents, level, turn }) {
  if (lender === borrower) return "self";
  if (balanceCents < LENDER_BALANCE_MULTIPLE * principal) return "balance";
  if (level === "war") return "war";
  if (hasDefaultAgainst(ledger, lender, borrower) || isBlocked(ledger, lender, borrower, turn)) return "blocked";
  return null;
}

/**
 * DESIGN 4.5: while a repudiation counts against standing, terms are 10 turns at most.
 * @param {Ledger} ledger
 * @param {number} borrower
 * @param {number} turn
 */
export function maxTerm(ledger, borrower, turn) {
  return recentRepudiations(ledger, borrower, turn).length ? REPUDIATION.maxTermWhileCounting : Infinity;
}

/**
 * DESIGN 4.3: 20- and 30-turn terms need the borrower's Public debt stage, and a civ lender a Banking building.
 * @param {{ ledger: Ledger, borrower: number, borrowerCiv?: Civ, lenderCiv?: Civ | LenderView | null, term: number,
 *   turn: number, options?: Partial<PlanOptions> }} q
 */
export function termRefusal({ ledger, borrower, borrowerCiv, lenderCiv, term, turn, options }) {
  if (term > maxTerm(ledger, borrower, turn)) return "term-repudiation";
  if (term <= SHORT_TERM) return null;
  if (!hasStage(borrowerCiv, "publicDebt", turn, options)) return "term-stage";
  if (lenderCiv && !(lenderCiv.depthTurns !== undefined && lenderCiv.depthTurns > 0)) return "term-banking";
  return null;
}

/**
 * @param {OfferQuery & { principal: number, term: number, rates: number, lenders: LenderView[],
 *   relations: Relation[], options: Partial<PlanOptions> }} query
 * @returns {Offer[]}
 */
function civOffers(query) {
  const { ledger, borrower, borrowerCiv, principal, term, age, turn, standing, rates, lenders, relations,
    options } = query;
  /** @type {Offer[]} */
  const out = [];
  if (query.civLendersClosed || !hasStage(borrowerCiv, "moneylending", turn, options)) return out;
  for (const lender of lenders) {
    if (!hasStage(lender, "moneylending", turn, options)) continue;
    const level = relationLevel(relations, lender.id, borrower);
    if (civLenderRefusal({ ledger, lender: lender.id, borrower, principal, balanceCents: lender.balanceCents, level,
      turn })) continue;
    if (termRefusal({ ledger, borrower, borrowerCiv, lenderCiv: lender, term, turn, options })) continue;
    const ratePpm = civRatePpm({ age, standing, level, rates, depthFactorPct: query.depthFactorPct,
      systemPct: query.civPct ? query.civPct(lender.id) : 100 });
    out.push({ lender: lender.id, ratePpm: /** @type {number} */ (ratePpm) });
  }
  out.sort((x, y) => x.ratePpm - y.ratePpm || Number(x.lender) - Number(y.lender));
  return out;
}

/**
 * civOffers with the query's optional fields filled, for the two public entry points below.
 * @param {OfferQuery} query
 * @param {number} term
 * @param {number} rates
 * @param {Partial<PlanOptions>} options
 */
function civOffersFor(query, term, rates, options) {
  return civOffers({ ...query, principal: query.principal ?? 0, term, rates, options, lenders: query.lenders || [],
    relations: query.relations || [] });
}

/**
 * Every standard offer open to a borrower for P over `term`: civ lenders by rate, then the bond market, which has no
 * balance test but needs the borrower's Public debt stage. `lenders` is [{ id, balanceCents, stages, depthTurns }]
 * for the live civs the caller allows to lend, balances net of what each has already committed this turn.
 * @param {OfferQuery} query
 * @returns {Offer[]}
 */
export function offersFor(query) {
  const { ledger, borrower, borrowerCiv, turn, age, standing, rates = 100, options = {}, term = SHORT_TERM } = query;
  if (!BASE_RATE_PPM[age]) return [];
  const offers = withCitizens(civOffersFor(query, term, rates, options), query, term);
  const bondOpen = !query.noBond && hasStage(borrowerCiv, "publicDebt", turn, options)
    && !isBlocked(ledger, BOND, borrower, turn)
    && !termRefusal({ ledger, borrower, borrowerCiv, lenderCiv: null, term, turn, options });
  if (bondOpen) {
    const ratePpm = worldRatePpm({ age, standing, rates, depthFactorPct: query.depthFactorPct,
      systemPct: query.bondPct ?? 100 });
    offers.push({ lender: BOND, ratePpm: /** @type {number} */ (ratePpm) });
  }
  return offers;
}

/**
 * A Civic market civ's citizens beside its civ lenders, cheapest first (DESIGN 4.17): 10-turn terms only, within
 * what they'd lend, and never while a repudiation of them closes them.
 * @param {Offer[]} offers
 * @param {OfferQuery} query
 * @param {number} term
 */
function withCitizens(offers, query, term) {
  const citizens = query.citizens;
  if (!citizens || term !== SHORT_TERM || (query.principal ?? 0) > citizens.roomCents) return offers;
  if (isBlocked(query.ledger, CITIZENS, query.borrower, query.turn)) return offers;
  /** @type {Offer} */
  const offer = { lender: CITIZENS, ratePpm: citizens.ratePpm };
  return [...offers, offer]
    .sort((x, y) => x.ratePpm - y.ratePpm || Number(isWorldAccount(x.lender)) - Number(isWorldAccount(y.lender)));
}

/**
 * A world lender's offer: the bond market with the borrower's system, cycle and inflation terms, temple treasuries
 * without them.
 * @param {Party} world
 * @param {{ age: string, standing: number, rates: number, depthFactorPct?: number, bondPct?: number }} q
 * @returns {Offer}
 */
function worldOffer(world, { age, standing, rates, depthFactorPct, bondPct }) {
  const systemPct = world === BOND ? bondPct ?? 100 : 100;
  return { lender: world, ratePpm: /** @type {number} */ (worldRatePpm({ age, standing, rates, depthFactorPct,
    systemPct })) };
}

/**
 * Emergency offers (DESIGN 4.6), cheapest first: civ lenders where the stage allows, then the bond market from Public
 * debt, else temple treasuries, which close once the bond market opens. A blocked world lender makes no offer.
 * @param {OfferQuery} query
 * @returns {Offer[]}
 */
export function emergencyOffersFor(query) {
  const { ledger, borrower, borrowerCiv, turn, age, standing, rates = 100, options = {} } = query;
  if (!BASE_RATE_PPM[age]) return [];
  const publicDebt = hasStage(borrowerCiv, "publicDebt", turn, options);
  const offers = civOffersFor(query, SHORT_TERM, rates, options);
  // A "civ lenders only" system still gets emergency loans from temple treasuries (DESIGN 4.6).
  const world = publicDebt && !query.noBond ? BOND : TEMPLE;
  // Temple treasuries are the fallback when no civ will lend; the bond market competes on rate.
  if ((publicDebt || offers.length === 0) && !isBlocked(ledger, world, borrower, turn)) {
    offers.push(worldOffer(world, { age, standing, rates, depthFactorPct: query.depthFactorPct,
      bondPct: query.bondPct }));
  }
  offers.sort((x, y) => x.ratePpm - y.ratePpm || Number(isWorldAccount(x.lender)) - Number(isWorldAccount(y.lender)));
  return offers;
}
