// econ-commerce.js - Economics: the 1.1 steps of the turn batch (DESIGN 4.14): prices in the snapshot, trade
// settlement at step 6, the dividends with the scheduled payments at step 8, write-offs for a lost city, and the
// AI rules of section 6 for tariffs, investment and aid. econ-plan.js calls these in order; the arithmetic is in
// econ-prices.js, econ-trade.js and econ-invest.js. The AI rules here exist because no native lever carries a per-pair
// bill, a tariff between two civs or a return on an investment the AI can see (DESIGN section 1, "Native first").
// Nothing here reads the engine.

import { INVEST, MISS, STANDING } from "./econ-params.js";
import { anyWar, nextPrices } from "./econ-prices.js";
import { aiTariffWanted, canChangeTariff, capPayments, highTariffCosts, netPairs, owedByPair, withTariff }
  from "./econ-trade.js";
import { investId, isOpenInvestment, lostCityWriteOff, settleDividend, settleInvestmentDefault } from "./econ-invest.js";
import { isIncomeGrowing, withIncomes } from "./econ-markets.js";
import { addMiss, activeDefaults } from "./econ-credit.js";
import { blockFor, relationLevel } from "./econ-lenders.js";
import { withBlock } from "./econ-payments.js";
import { hasStage } from "./econ-stages.js";
import { addInfluence, funds, lenderBalance } from "./econ-batch.js";
import { emit, event, incomeOf, isAlive, notice, termsFor } from "./econ-turn.js";
import { basePriceCents } from "./econ-prices.js";
import { takesCapitalism } from "./econ-systems.js";
import { isInDepression } from "./econ-macro.js";
import { aiHostRefusal, openInvestment, investRefusal } from "./econ-invest-open.js";

/**
 * Snapshot (step 1): the prices from this turn's market read, and each civ's income mark.
 * @param {TurnContext} ctx
 * @param {MarketRead | undefined} market
 */
export function marketStep(ctx, market) {
  const { markets } = ctx;
  markets.incomes = withIncomes(markets.incomes, ctx.civs);
  if (!ctx.options.markets || !market) return;
  for (const row of market.resources || []) ctx.basePrices[row.type] = basePriceCents(row.class);
  const civs = ctx.civs.filter((civ) => civ.alive === true).length;
  const next = nextPrices({ market, previous: markets, civs, war: anyWar(ctx.relations), eBp: ctx.readings.e,
    capitalism: capitalismPrices(ctx) });
  markets.prices = next.prices;
  markets.history = next.history;
  markets.lastTurn = ctx.turn;
}

/**
 * Whether the Capitalism stage's price smoothing (0.5, DESIGN 4.15) runs: a Market or Mixed civ has reached it.
 * @param {TurnContext} ctx
 */
function capitalismPrices(ctx) {
  return ctx.civs.some((civ) => civ.alive === true && hasStage(civ, "capitalism", ctx.turn, ctx.options)
    && takesCapitalism(ctx.macro.systems[String(civ.id)]?.system));
}

/**
 * The Capitalism stage's equity on a host (DESIGN 4.15): a Market or Mixed civ past the stage.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function hasEquity(ctx, pid) {
  return hasStage(ctx.civ.get(pid), "capitalism", ctx.turn, ctx.options)
    && takesCapitalism(ctx.macro.systems[String(pid)]?.system);
}

/**
 * The bill's terms for each civ from its system (DESIGN 4.17).
 * @param {TurnContext} ctx
 */
export function tradeTermsOf(ctx) {
  return (/** @type {number} */ pid) => termsFor(ctx, pid);
}

/**
 * The routes that settle this turn: both sides alive, both past the Trade stage.
 * @param {TurnContext} ctx
 */
function billedRoutes(ctx) {
  const open = (/** @type {number} */ pid) => isAlive(ctx, pid)
    && hasStage(ctx.civ.get(pid), "trade", ctx.turn, ctx.options);
  return ctx.routes.filter((route) => open(route.importer) && open(route.exporter));
}

/**
 * What each pair owes this turn, netted and capped (DESIGN 4.10), and the High tariff's relationship cost. The
 * payments themselves go out in each payer's own pass (settleTradeFor).
 * @param {TurnContext} ctx
 */
export function tradeStep(ctx) {
  if (!ctx.options.markets) return;
  const civIds = new Set(ctx.civs.filter((civ) => civ.alive === true).map((civ) => civ.id));
  const tariffsOn = ctx.options.tariffs === true;
  const owed = owedByPair({ routes: billedRoutes(ctx), prices: ctx.markets.prices, tariffs: ctx.markets.tariffs,
    civIds, tariffsOn, termsOf: tradeTermsOf(ctx), basePrices: ctx.basePrices });
  ctx.owed = owed;
  ctx.trade = capPayments(netPairs(owed), (pid) => incomeOf(ctx, pid)).map((row) => ({ ...row, paid: 0 }));
  if (!tariffsOn) return;
  const costs = highTariffCosts({ tariffs: ctx.markets.tariffs, owed, turn: ctx.turn,
    everyTurns: (pid) => termsFor(ctx, pid).highTariffEveryTurns });
  ctx.out.relationships.push(...costs);
  /** @type {Map<number, number>} */
  const partners = new Map();
  for (const row of costs) partners.set(row.a, (partners.get(row.a) || 0) + 1);
  for (const [pid, count] of partners) notice(ctx, pid, { kind: "tariff-cost", partners: count });
}

/**
 * One payer's settlements (step 6), each paid in full from its funds or waived; nothing is carried.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function settleTradeFor(ctx, pid) {
  for (const row of ctx.trade) {
    if (row.payer !== pid || row.cents <= 0) continue;
    if (funds(ctx.batch, pid) < row.cents) { row.waived += row.cents; continue; }
    emit(ctx, { id: `B${row.payer}-${row.payee}` }, { from: row.payer, to: row.payee, cents: row.cents,
      reason: "trade", parts: { owed: row.owed, waived: row.waived } });
    row.paid = row.cents;
  }
}

/**
 * The human's one line on the turn's settlements: what it paid, what it got, what was waived.
 * @param {TurnContext} ctx
 */
export function tradeNotices(ctx) {
  for (const civ of ctx.civs) {
    if (civ.human !== true) continue;
    let paid = 0;
    let received = 0;
    let waived = 0;
    for (const row of ctx.trade) {
      if (row.payer === civ.id) { paid += row.paid; waived += row.waived; }
      if (row.payee === civ.id) received += row.paid;
    }
    if (paid || received) notice(ctx, civ.id, { kind: "trade", paid, received, waived });
  }
}

/**
 * Step 8's dividends for one host, oldest record first, then the garnish on its defaulted ones.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function payDividendsFor(ctx, pid) {
  const mine = ctx.ledger.investments.filter((record) => record.host === pid && isOpenInvestment(record)
    && record.opened < ctx.turn).sort((a, b) => a.opened - b.opened || a.id.localeCompare(b.id));
  for (const record of mine) {
    if (record.state === "default") garnishInvestment(ctx, record);
    else payDividend(ctx, record);
  }
}

/**
 * @param {TurnContext} ctx
 * @param {Investment} record
 */
function replaceInvestment(ctx, record) {
  ctx.ledger.investments[ctx.ledger.investments.findIndex((row) => row.id === record.id)] = record;
}

/**
 * @param {TurnContext} ctx
 * @param {Investment} record
 */
function payDividend(ctx, record) {
  const result = settleDividend(record, { funds: funds(ctx.batch, record.host),
    hostIncomeCents: incomeOf(ctx, record.host), wide: hasEquity(ctx, record.host) });
  const closedTurn = result.closed ? ctx.turn : null;
  replaceInvestment(ctx, { ...result.record, closedTurn });
  if (!result.missed) {
    emit(ctx, record, { from: record.host, to: record.investor, cents: result.cents, reason: "dividend" });
    if (result.closed) event(ctx, { kind: "invest-closed", loanId: record.id });
    return;
  }
  addMiss(ctx.ledger, record.host, ctx.turn);
  addInfluence(ctx.batch, record.host, MISS.influence);
  ctx.out.influence.push({ pid: record.host, amount: MISS.influence, loanId: record.id, reason: "miss" });
  event(ctx, { kind: "invest-miss", loanId: record.id, borrower: record.host, missed: result.record.missed });
  notice(ctx, record.host, { kind: "invest-miss", loanId: record.id, missed: result.record.missed });
  if (!result.defaulted) return;
  ctx.ledger.blocks = withBlock(ctx.ledger.blocks, blockFor({ lender: record.investor, borrower: record.host,
    reason: "default", turn: ctx.turn }));
  event(ctx, { kind: "invest-default", loanId: record.id, lender: record.investor, borrower: record.host });
  notice(ctx, record.host, { kind: "invest-default", loanId: record.id });
  notice(ctx, record.investor, { kind: "invest-defaulted-on", loanId: record.id, borrower: record.host });
}

/**
 * @param {TurnContext} ctx
 * @param {Investment} record
 */
function garnishInvestment(ctx, record) {
  const civ = /** @type {Civ} */ (ctx.civ.get(record.host));
  const result = settleInvestmentDefault(record, { incomeCents: civ.incomeCents, balanceCents: civ.balanceCents,
    cashCents: Math.max(0, funds(ctx.batch, record.host)) });
  replaceInvestment(ctx, { ...result.record, closedTurn: result.closed ? ctx.turn : null });
  emit(ctx, record, { from: record.host, to: record.investor, cents: result.cents, reason: "garnish" });
  if (result.closed) event(ctx, { kind: "invest-closed", loanId: record.id });
}

/**
 * A record whose party is gone, or whose city the host lost, closes with the rest written off (DESIGN 4.12).
 * @param {TurnContext} ctx
 */
export function investWriteOffs(ctx) {
  for (const record of ctx.ledger.investments) {
    if (!isOpenInvestment(record)) continue;
    const host = ctx.civ.get(record.host);
    const gone = !isAlive(ctx, record.investor) || !isAlive(ctx, record.host);
    const cities = host?.cities ? new Set(host.cities.map((city) => city.id)) : null;
    const closed = gone ? { ...record, state: /** @type {LoanState} */ ("closed"), closedTurn: ctx.turn,
      writtenOff: record.outstanding, outstanding: 0 } : cities && lostCityWriteOff(record, cities, ctx.turn);
    if (!closed) continue;
    replaceInvestment(ctx, closed);
    event(ctx, { kind: "invest-writeoff", loanId: record.id, cents: record.outstanding, gone: gone ? 1 : 0 });
    notice(ctx, record.investor, { kind: "invest-writeoff", loanId: record.id, cents: record.outstanding });
  }
  ctx.ledger.offers = ctx.ledger.offers.filter((offer) => ctx.turn - offer.turn < INVEST.offerTurns
    && isAlive(ctx, offer.investor) && isAlive(ctx, offer.host));
}

/**
 * DESIGN 6 tariffs: option on only; an AI matches a High tariff set on its exports, and drops back with it.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiTariff(ctx, civ) {
  if (!ctx.options.markets || !ctx.options.tariffs) return;
  if (!hasStage(civ, "tariffs", ctx.turn, ctx.options)) return;
  const importers = (ctx.owed || []).filter((row) => row.exporter === civ.id && row.gross > 0)
    .map((row) => row.importer);
  const wanted = aiTariffWanted({ pid: civ.id, tariffs: ctx.markets.tariffs, importers, turn: ctx.turn });
  const row = ctx.markets.tariffs.find((tariff) => tariff.pid === civ.id);
  if (!wanted || !canChangeTariff(row?.changedTurn, ctx.turn)) return;
  ctx.markets.tariffs = withTariff(ctx.markets.tariffs, civ.id, wanted, ctx.turn);
  event(ctx, { kind: "tariff", pid: civ.id, level: wanted });
}

/**
 * Whether an AI can spare Gold for others: income above 0 and a balance above 20 turns of it (DESIGN 6). A civ with
 * income above 0 this turn is never insolvent, so the "never when insolvent" rule needs no check of its own.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function canSpare(ctx, civ) {
  return civ.incomeCents > 0 && lenderBalance(ctx.batch, civ.id) > 20 * civ.incomeCents;
}

/**
 * The last turn this AI invested or made an offer, answered or not.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function lastInvestTurn(ctx, pid) {
  const turn = ctx.markets.investTurn[String(pid)];
  return Number.isInteger(turn) ? turn : -Infinity;
}

/**
 * Whether `host` repudiated what it owed `investor` while that still counts against its standing (DESIGN 6, "After a
 * repudiation").
 * @param {TurnContext} ctx
 * @param {number} host
 * @param {number} investor
 */
function hasRepudiated(ctx, host, investor) {
  return ctx.ledger.repudiations.some((row) => row.pid === host && row.lender === investor
    && ctx.turn - row.turn < STANDING.repudiationWindowTurns);
}

/**
 * The living civs this AI is Friendly with and that haven't repudiated a debt to it lately, in id order. From the
 * Capitalism stage, AI civs invest in each other (DESIGN 4.15): a Market or Mixed investor past it also takes Neutral
 * hosts that are too.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {boolean} [equity] whether Neutral equity hosts count
 */
function friendlyHosts(ctx, civ, equity = false) {
  const wide = equity && hasEquity(ctx, civ.id);
  return ctx.civs.filter((host) => {
    if (host.id === civ.id || host.alive !== true || hasRepudiated(ctx, host.id, civ.id)) return false;
    const level = relationLevel(ctx.relations, civ.id, host.id);
    return level === "friendly" || (wide && level === "neutral" && hasEquity(ctx, host.id));
  });
}

/**
 * The first city of the host with a build that still needs progress, role buildings first (DESIGN 4.13).
 * @param {Civ | undefined} host
 */
function investableCity(host) {
  const open = (host?.cities || []).filter((city) => city.build && city.neededProgress > 0);
  return open.find((city) => city.roleBuilding === true) || open[0] || null;
}

/**
 * The investment an AI would make in `host`: general if the host's income is growing, else a development loan on
 * a city's current build; null when the stages or the host's cities allow neither.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Civ} host
 * @returns {{ form: InvestKind, cityId: string | null } | null}
 */
function aiTargetFor(ctx, civ, host) {
  const both = (/** @type {string} */ stage) => hasStage(civ, stage, ctx.turn, ctx.options)
    && hasStage(host, stage, ctx.turn, ctx.options);
  if (isIncomeGrowing(ctx.markets.incomes, host.id) && both("charteredCompanies")) {
    return { form: "general", cityId: null };
  }
  const city = both("guildPatronage") ? investableCity(host) : null;
  return city ? { form: "project", cityId: city.id } : null;
}

/**
 * DESIGN 6 investment: at most once per 10 turns, Friendly hosts only, 5 turns of the investor's income; to the
 * human it's an offer the player answers.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiInvest(ctx, civ) {
  if (!ctx.options.investment || !canSpare(ctx, civ)) return;
  if (ctx.turn - lastInvestTurn(ctx, civ.id) < INVEST.aiEveryTurns) return;
  const cents = INVEST.aiSizeTurns * civ.incomeCents;
  for (const host of friendlyHosts(ctx, civ, true)) {
    const target = aiTargetFor(ctx, civ, host);
    if (!target) continue;
    const spec = { investor: civ.id, host: host.id, form: target.form, cents, cityId: target.cityId, asAid: false };
    // An AI host answers by the same "Accepting" rule the player's investment meets (DESIGN 6).
    if (investRefusal(ctx, spec) || (host.human !== true && aiHostRefusal(ctx, spec))) continue;
    ctx.markets.investTurn[String(civ.id)] = ctx.turn;
    if (host.human === true) offerTo(ctx, spec);
    else openInvestment(ctx, spec, "ai");
    return;
  }
}

/**
 * @param {TurnContext} ctx
 * @param {{ investor: number, host: number, form: InvestKind, cents: number, cityId: string | null }} spec
 */
function offerTo(ctx, spec) {
  const id = investId(ctx.ledger.nextInvestId);
  ctx.ledger.nextInvestId += 1;
  ctx.ledger.offers.push({ id, investor: spec.investor, host: spec.host, kind: spec.form, cents: spec.cents,
    cityId: spec.cityId, turn: ctx.turn });
  event(ctx, { kind: "offer", loanId: id, lender: spec.investor, borrower: spec.host, cents: spec.cents,
    form: spec.form });
  notice(ctx, spec.host, { kind: "offer", offerId: id, investor: spec.investor, cents: spec.cents, form: spec.form });
}

/**
 * DESIGN 6 aid: income above 0; to a Friendly civ in default or in its own Depression (4.11), once per age, up to 5
 * turns of its own income.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiAid(ctx, civ) {
  if (!ctx.options.investment || !(civ.incomeCents > 0)) return;
  if (ctx.markets.aidAge[String(civ.id)] === ctx.age) return;
  const cents = Math.min(INVEST.aiSizeTurns * civ.incomeCents, Math.max(0, funds(ctx.batch, civ.id)));
  for (const host of friendlyHosts(ctx, civ)) {
    if (activeDefaults(ctx.ledger, host.id) === 0 && !isInDepression(ctx, host.id)) continue;
    const spec = { investor: civ.id, host: host.id, form: /** @type {InvestKind} */ ("general"), cents,
      cityId: null, asAid: true };
    if (investRefusal(ctx, spec)) continue;
    openInvestment(ctx, spec, "ai");
    ctx.markets.aidAge[String(civ.id)] = ctx.age;
    return;
  }
}
