// econ-view-commerce.js - Economics: the numbers the Markets and Trade tabs show (DESIGN 4.9, 4.10, 4.12, 9), from the
// same plan input the turn batch gets, so the bill the tab shows is the bill the next batch sends. Plain data in,
// plain data out; nothing here reads the engine.

import { INVEST } from "./econ-params.js";
import { capPayments, netPairs, owedByPair, routeBillCents, settlementCap, tariffOf } from "./econ-trade.js";
import { baseDividend, giftMinimumCents, isOpenInvestment, progressFor, relationshipGain, returnMille, tenthsFor }
  from "./econ-invest.js";
import { hasStage } from "./econ-stages.js";
import { relationLevel } from "./econ-lenders.js";
import { aiHostRefusal, investRefusal } from "./econ-invest-open.js";
import { viewContext } from "./econ-view-model.js";
import { emptyMarkets } from "./econ-markets.js";
import { tradeTermsOf } from "./econ-commerce.js";
import { basePriceCents } from "./econ-prices.js";

/**
 * The Markets tab: each priced resource with its holders, its price and the change over its history, dearest first.
 * @param {PlanInput} input
 */
export function marketView(input) {
  const markets = input.markets;
  const copies = input.market?.copies || {};
  /** @type {Record<string, string>} */
  const classes = {};
  for (const row of input.market?.resources || []) classes[row.type] = row.class;
  const rows = Object.entries(markets?.prices || {}).map(([type, price]) => {
    const history = markets?.history[type] || [];
    return { type, class: classes[type] || null, priceCents: price, holders: copies[type] || 0, history,
      changeCents: history.length > 1 ? price - history[0] : 0 };
  });
  return rows.sort((a, b) => b.priceCents - a.priceCents || a.type.localeCompare(b.type));
}

/**
 * The Trade tab's settlement block: for each partner, what each side owes, the net and who pays it, what the cap
 * lets through, and the Trade Income the engine pays this civ besides.
 * @param {PlanInput} input
 * @param {number} me
 */
export function tradeView(input, me) {
  const live = input.civs.filter((civ) => civ.alive === true);
  const civIds = new Set(live.map((civ) => civ.id));
  const tariffsOn = input.options?.tariffs !== false;
  const markets = input.markets || emptyMarkets();
  const tariffs = markets.tariffs;
  // The batch's own terms: each civ's system and crisis, so a tribute's doubled bill shows as the batch charges it.
  const ctx = viewContext(input);
  const owed = owedByPair({ routes: input.routes || [], prices: markets.prices, tariffs, civIds, tariffsOn,
    termsOf: tradeTermsOf(ctx), basePrices: ctx.basePrices });
  const income = (/** @type {number} */ pid) => live.find((civ) => civ.id === pid)?.incomeCents ?? 0;
  const paid = capPayments(netPairs(owed), income);
  const civ = live.find((c) => c.id === me);
  return { rows: partnerRows(owed, paid, me), capCents: settlementCap(income(me)),
    tradeIncomeCents: civ?.tradeIncomeCents ?? 0, tariff: tariffOf(tariffs, me), tariffsOn,
    stageOpen: hasStage(civ, "trade", input.turn, input.options), on: input.options?.markets !== false };
}

/**
 * One row per partner: what each side owes, what this civ pays or receives after netting and the cap.
 * @param {{ importer: number, exporter: number, owed: number }[]} owed
 * @param {{ payer: number, payee: number, cents: number, waived: number }[]} paid
 * @param {number} me
 */
function partnerRows(owed, paid, me) {
  /** @type {Map<number, { partner: number, theyOweCents: number, youOweCents: number, payCents: number,
   *   receiveCents: number, waivedCents: number }>} */
  const rows = new Map();
  const row = (/** @type {number} */ partner) => {
    const found = rows.get(partner) || { partner, theyOweCents: 0, youOweCents: 0, payCents: 0, receiveCents: 0,
      waivedCents: 0 };
    rows.set(partner, found);
    return found;
  };
  for (const pair of owed) {
    if (pair.importer === me) row(pair.exporter).youOweCents = pair.owed;
    if (pair.exporter === me) row(pair.importer).theyOweCents = pair.owed;
  }
  for (const pay of paid) {
    if (pay.payer === me) Object.assign(row(pay.payee), { payCents: pay.cents, waivedCents: pay.waived });
    if (pay.payee === me) row(pay.payer).receiveCents = pay.cents;
  }
  return [...rows.values()].sort((a, b) => a.partner - b.partner);
}

/**
 * What a new route would add to the bill, from the routes the game would let the player make (P7's preview read):
 * half the summed prices of the copies it would bring, before the Trade-building terms.
 * @param {{ owner: number, city: string, resources: string[] }[]} possible
 * @param {Record<string, number>} prices
 */
export function routePreview(possible, prices) {
  return possible.map((route) => ({ ...route,
    billCents: routeBillCents({ importer: -1, exporter: route.owner, resources: route.resources }, prices) }));
}

/**
 * What one gift would do, for the forecast beside its button: the Gold spent, the progress, the return a turn and in
 * all, and the relationship.
 * @param {{ form: InvestKind, cents: number, asAid: boolean, hostIncomeCents: number, city?: CityRead | null }} q
 */
export function investForecast({ form, cents, asAid, hostIncomeCents, city = null }) {
  const plan = form === "project" && city ? progressFor(cents, city.neededProgress, city.pointCents) : null;
  const spent = plan ? plan.usedCents : cents;
  const mille = returnMille(form, city?.roleBuilding === true);
  const perTurn = asAid ? 0 : baseDividend(spent, mille);
  return { spentCents: spent, progress: plan?.progress ?? 0, perTurnCents: perTurn, totalCents: perTurn * INVEST.term,
    relationship: relationshipGain(spent, hostIncomeCents, tenthsFor(form, asAid)),
    minimumCents: giftMinimumCents(hostIncomeCents, tenthsFor(form, asAid)) };
}

/**
 * The investment targets on the Trade tab: each other living major with what each kind would be refused for (null
 * when it can go ahead), and its cities with a build at the head of the queue.
 * @param {PlanInput} input
 * @param {number} me
 * @param {number} cents
 */
export function investTargets(input, me, cents) {
  const ctx = viewContext(input);
  return ctx.civs.filter((civ) => civ.alive === true && civ.id !== me).map((civ) => {
    // The AI host's acceptance rule too, so a host in default shows its refusal before the player asks (DESIGN 4.12).
    /** @type {(form: InvestKind, cityId: string | null, asAid: boolean) => string | null} */
    const spec = (form, cityId, asAid) => {
      const q = { investor: me, host: civ.id, form, cents, cityId, asAid };
      return investRefusal(ctx, q) || (civ.human === true ? null : aiHostRefusal(ctx, q));
    };
    const cities = (civ.cities || []).filter((city) => city.build && city.neededProgress > 0)
      .map((city) => ({ city, refusal: spec("project", city.id, false), aidRefusal: spec("project", city.id, true) }));
    return { pid: civ.id, level: relationLevel(ctx.relations, me, civ.id), incomeCents: civ.incomeCents,
      general: spec("general", null, false), aid: spec("general", null, true), cities };
  });
}

/**
 * The records the player holds or hosts, open first, and the AI offers waiting for an answer.
 * @param {PlanInput} input
 * @param {number} me
 */
export function investmentsView(input, me) {
  const records = (input.ledger?.investments || []).filter((record) => record.investor === me || record.host === me);
  const open = records.filter(isOpenInvestment);
  return { open, offers: (input.ledger?.offers || []).filter((offer) => offer.host === me),
    investedCents: open.filter((record) => record.investor === me).reduce((sum, r) => sum + r.outstanding, 0),
    owedCents: open.filter((record) => record.host === me).reduce((sum, r) => sum + r.outstanding, 0) };
}

/**
 * What one resource adds to the bills between this civ and each partner (Part 6), from the batch's own bill terms:
 * the bill with only this resource priced, before each pair nets and the cap. `carries` is true where a route
 * carries it, even when its share rounds to nothing.
 * @param {PlanInput} input
 * @param {number} me
 * @param {string} type
 * @returns {{ partner: number, youOweCents: number, theyOweCents: number }[]}
 */
export function resourceBills(input, me, type) {
  const live = new Set(input.civs.filter((civ) => civ.alive === true).map((civ) => civ.id));
  const routes = (input.routes || []).filter((route) => carries(route, me, type));
  /** @type {Map<number, { partner: number, youOweCents: number, theyOweCents: number }>} */
  const rows = new Map();
  for (const route of routes) {
    const partner = route.importer === me ? route.exporter : route.importer;
    if (live.has(partner)) rows.set(partner, { partner, youOweCents: 0, theyOweCents: 0 });
  }
  for (const pair of rows.size ? resourceOwed(input, routes, live, type) : []) {
    const row = rows.get(pair.importer === me ? pair.exporter : pair.importer);
    if (!row) continue;
    if (pair.importer === me) row.youOweCents = pair.owed;
    else row.theyOweCents = pair.owed;
  }
  return [...rows.values()].sort((a, b) => a.partner - b.partner);
}

/** @param {RouteRead} route @param {number} me @param {string} type */
const carries = (route, me, type) => (route.importer === me || route.exporter === me)
  && (route.resources || []).includes(type);

/**
 * The bills on these routes with only `type` priced, on the batch's own terms.
 * @param {PlanInput} input
 * @param {RouteRead[]} routes
 * @param {Set<number>} live
 * @param {string} type
 */
function resourceOwed(input, routes, live, type) {
  const markets = input.markets || emptyMarkets();
  const ctx = viewContext(input);
  // A civ on fixed prices pays the class base (econ-commerce.js marketStep fills the batch's own table).
  const resource = (input.market?.resources || []).find((row) => row.type === type);
  const base = resource ? basePriceCents(resource.class) : ctx.basePrices[type] ?? 0;
  return owedByPair({ routes, prices: { [type]: markets.prices[type] ?? 0 }, tariffs: markets.tariffs, civIds: live,
    tariffsOn: input.options?.tariffs !== false, termsOf: tradeTermsOf(ctx), basePrices: { [type]: base } });
}
