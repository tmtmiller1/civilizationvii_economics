// econ-macro.js - Economics: the 1.2 steps of the turn batch (DESIGN 4.14). In the snapshot: each civ's system
// (4.17), the business cycle (4.11) and inflation's pi (4.8). Positive cycle Gold is a world inflow counted in the
// payers' funds; then, in each payer's own pass, erosion (step 3), the plan (step 4) and negative cycle Gold (step 5).
// The AI's rule for citizen loans and the cycle's AI aid trigger live here too: no native lever carries a loan (P18)
// or reads the cycle, so both are script rules.
// econ-plan.js calls these in order; the arithmetic is in econ-cycle.js, econ-inflation.js, econ-systems.js,
// econ-citizens.js and econ-planned.js. Nothing here reads the engine.

import { BOND, CITIZENS, CYCLE, CYCLE_RULES as R, CYCLE_WEIGHTS as W, PLAN, SHORT_TERM }
  from "./econ-params.js";
import { civSum, crisisEvents, cycleGoldCents, emptyCycle, engineEvents, growthBp, ledgerEvents, leverPct,
  nextBoomTurns, nextE, nextL, nextTrendBp, overheatEvents, pairKey, panicDropBp, panicStarts, routeEvents,
  stageScalePct, swingFor, trendEvents, warEvents, worldSum } from "./econ-cycle.js";
import { largestDebtor, nextLevelPpm, piPpm } from "./econ-inflation.js";
import { nextSystems } from "./econ-systems.js";
import { cycleKPct, emptyInflation, macroReadings } from "./econ-macro-state.js";
import { planSplit, planTakeCents } from "./econ-planned.js";
import { aiCitizenPrincipal, servicePrincipalCents } from "./econ-citizens.js";
import { serviceCap, serviceOf } from "./econ-credit.js";
import { isOpen } from "./econ-loan.js";
import { hasStage } from "./econ-stages.js";
import { funds, lenderBalance, payable } from "./econ-batch.js";
import { citizensFor, emit, event, incomeOf, isAlive, notice, openLoan, termsFor } from "./econ-turn.js";
import { isAtLoanLimit, limitRefusal } from "./econ-requests.js";
import { isInsolventCiv } from "./econ-shortfall.js";

/** Kinds that repeat every turn and stay out of the World tab's list; overheating shows every 5th turn of a Boom. */
const QUIET_KINDS = new Set(["war-ongoing", "crisis"]);

/**
 * @param {import("./econ-cycle.js").Weighted} row
 * @param {number} boomTurns turns in Boom before this one
 */
const isLogged = (row, boomTurns) => (row.kind === "overheating" ? boomTurns % 5 === 0 : !QUIET_KINDS.has(row.kind));

/**
 * The furthest stage any living civ has (DESIGN 4.15's world stage), for the cycle's scale and Panic.
 * @param {TurnContext} ctx
 */
export function worldStage(ctx) {
  const any = (/** @type {string} */ stage) => ctx.civs.some((civ) => civ.alive === true
    && hasStage(civ, stage, ctx.turn, ctx.options));
  return { publicDebt: any("publicDebt"), banking: any("banking"), capitalism: any("capitalism") };
}

/**
 * DESIGN 4.14 step 1 for 1.2: systems, then the cycle, then pi; the readings the rest of the turn uses are rebuilt
 * from the new state.
 * @param {TurnContext} ctx
 * @param {PlanInput} input
 */
export function macroSnapshot(ctx, input) {
  const reforms = systemsStep(ctx);
  ctx.readings = macroReadings(ctx.macro, { civs: ctx.civs, turn: ctx.turn, options: ctx.options });
  cycleStep(ctx, input, reforms);
  inflationStep(ctx);
  ctx.readings = macroReadings(ctx.macro, { civs: ctx.civs, turn: ctx.turn, options: ctx.options });
  phaseNotices(ctx);
  ctx.macro.lastTurn = ctx.turn;
}

/**
 * Each living civ's system from its government and ideology; a change is an event, a notice to the player and a
 * reform shock on the civ's L.
 * @param {TurnContext} ctx
 * @returns {Set<number>}
 */
function systemsStep(ctx) {
  const next = nextSystems(ctx.macro.systems, ctx.civs, ctx.turn, ctx.options.systems !== false);
  ctx.macro.systems = next.systems;
  for (const change of next.changes) {
    event(ctx, { kind: "system", pid: change.pid, from: change.from, to: change.to });
    notice(ctx, change.pid, { kind: "system", from: change.from, to: change.to });
  }
  return new Set(next.changes.map((change) => change.pid));
}

/**
 * The war and route pairs between living civs this turn.
 * @param {TurnContext} ctx
 */
function pairsNow(ctx) {
  const wars = ctx.relations.filter((row) => row.level === "war" && isAlive(ctx, row.a) && isAlive(ctx, row.b))
    .map((row) => pairKey(row.a, row.b));
  const routes = ctx.routes.filter((route) => route.importer !== route.exporter && isAlive(ctx, route.importer)
    && isAlive(ctx, route.exporter)).map((route) => pairKey(route.importer, route.exporter));
  return { wars: [...new Set(wars)].sort(), routes: [...new Set(routes)].sort() };
}

/**
 * Every weighted event of the turn, and the state's pairs, series and crisis stage moved on.
 * @param {TurnContext} ctx
 * @param {PlanInput} input
 */
function turnEvents(ctx, input) {
  const state = ctx.macro.cycle;
  const now = pairsNow(ctx);
  const crisis = Number.isInteger(input.crisisStage) ? /** @type {number} */ (input.crisisStage) : state.crisis;
  let income = 0;
  for (const civ of ctx.civs) if (civ.alive === true) income += Math.max(0, civ.incomeCents);
  let outstanding = 0;
  for (const loan of ctx.ledger.loans) if (isOpen(loan)) outstanding += loan.outstanding;
  const series = (/** @type {number[]} */ xs, /** @type {number} */ x) => [...xs, x].slice(-11);
  const incomeSeries = series(state.income, income);
  const creditSeries = series(state.credit, outstanding);
  const last = ctx.ledger.lastTurn;
  const base = [...warEvents(state.wars, now.wars), ...routeEvents(state.routes, now.routes),
    ...engineEvents(input.cycleEvents || []), ...crisisEvents(state.crisis, crisis),
    ...ledgerEvents(ctx.ledger.events.filter((row) => row.turn === last)),
    ...trendEvents(incomeSeries, creditSeries, state.trend), ...overheatEvents(state.boomTurns)];
  // The responses to a crisis and the crisis events weigh too (DESIGN 4.11b), through the plan's hook.
  const events = [...base, ...(ctx.crisis ? ctx.crisis.weights(base) : [])];
  Object.assign(state, { wars: now.wars, routes: ctx.options.markets ? now.routes : state.routes, crisis,
    income: incomeSeries, credit: creditSeries, trend: nextTrendBp(state.trend, growthBp(incomeSeries)) });
  return { events, outstanding, income };
}

/**
 * DESIGN 4.11: E moves by its reversion and the world's events, a Panic may start, each civ's L by its own; with the
 * cycle Off the state stays at rest.
 * @param {TurnContext} ctx
 * @param {PlanInput} input
 * @param {Set<number>} reforms
 */
function cycleStep(ctx, input, reforms) {
  const kPct = cycleKPct(ctx.options.cycle);
  if (kPct === 0) { ctx.macro.cycle = emptyCycle(); return; }
  const state = ctx.macro.cycle;
  const boomBefore = state.boomTurns;
  const { events, outstanding, income } = turnEvents(ctx, input);
  const stage = worldStage(ctx);
  const swing = swingFor(ctx.options.swings);
  state.e = nextE(state.e, worldSum(events), kPct, stageScalePct(stage, swing),
    { prev: state.history.at(-2) ?? state.e, swing });
  const panicked = panicStarts({ allowed: stage.banking, e: state.e, lastPanic: state.lastPanic, turn: ctx.turn, swing,
    leverPct: leverPct(outstanding, [income]) });
  if (panicked) startPanic(ctx, kPct, swing);
  state.boomTurns = nextBoomTurns(state.boomTurns, state.e);
  for (const civ of ctx.civs) if (civ.alive === true) civCycle(ctx, civ, { events, kPct, reform: reforms.has(civ.id),
    panicked });
  state.history = [...state.history, state.e].slice(-R.historyTurns);
  const logged = events.filter((row) => isLogged(row, boomBefore))
    .map((row) => ({ turn: ctx.turn, kind: row.kind, a: row.a, b: row.b, w: row.w }));
  state.events = [...state.events, ...logged].slice(-R.eventsKept);
}

/**
 * A Panic (DESIGN 4.11): E drops once (0.2 at Standard, scaled by the Business cycle option), its own event (a
 * chronicle entry) and notice, for 5 turns.
 * @param {TurnContext} ctx
 * @param {number} kPct
 * @param {import("./econ-cycle.js").Swing} swing
 */
function startPanic(ctx, kPct, swing) {
  const state = ctx.macro.cycle;
  state.e = Math.max(swing.eMin, state.e - panicDropBp(kPct));
  state.panicUntil = ctx.turn + R.panicTurns;
  state.lastPanic = ctx.turn;
  event(ctx, { kind: "panic", until: state.panicUntil, chronicle: 1 });
  for (const civ of ctx.civs) if (civ.alive === true) notice(ctx, civ.id, { kind: "panic", until: state.panicUntil });
}

/**
 * One civ's L: the events it took part in, the reform shock of a new system, Corporatist's war boom and its fall
 * at peace, and the Panic hit on Market and Merchant oligarchy civs. A Planned civ is outside the cycle.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {{ events: import("./econ-cycle.js").Weighted[], kPct: number, reform: boolean, panicked: boolean }} q
 */
function civCycle(ctx, civ, { events, kPct, reform, panicked }) {
  const state = ctx.macro.cycle;
  const key = String(civ.id);
  const terms = termsFor(ctx, civ.id);
  const wasAtWar = state.atWar[key] === true;
  state.atWar[key] = civ.atWar === true;
  if (terms.outOfCycle) { delete state.l[key]; return; }
  // Deposit insurance (DESIGN 4.11b) halves the civ's own Panic hit.
  const panicPct = ctx.crisis ? ctx.crisis.terms(civ.id).panicPct : 100;
  const panicHit = panicked ? Math.round((terms.panicL * panicPct) / 100) : 0;
  const sum = civSum(events, civ.id) + (reform ? W.reform : 0) + panicHit
    + warBoom(terms.warBoom, wasAtWar, civ.atWar === true);
  const l = nextL(state.l[key] ?? 0, sum, { kPct, decayPct: terms.lDecayPct, multPct: terms.lMultPct });
  if (l === 0) delete state.l[key]; else state.l[key] = l;
}

/**
 * Corporatist's war economy (DESIGN 4.17): +0.01 a turn on its own L while at war, -0.03 once when peace comes.
 * @param {boolean} on
 * @param {boolean} wasAtWar
 * @param {boolean} atWar
 */
function warBoom(on, wasAtWar, atWar) {
  if (!on) return 0;
  if (atWar) return W.corporatistWar;
  return wasAtWar ? W.corporatistPeace : 0;
}

/**
 * What each member owes the bond market.
 * @param {TurnContext} ctx
 * @param {Set<number>} ids
 */
function bondDebts(ctx, ids) {
  /** @type {Map<number, number>} */
  const owed = new Map();
  for (const loan of ctx.ledger.loans) {
    if (loan.lender !== BOND || !isOpen(loan) || !ids.has(loan.borrower)) continue;
    owed.set(loan.borrower, (owed.get(loan.borrower) || 0) + loan.outstanding);
  }
  return owed;
}

/**
 * DESIGN 4.8: pi over the civs with Public debt, the bond debt they owe and the Gold they hold; Off reads 0.
 * @param {TurnContext} ctx
 */
function inflationStep(ctx) {
  if (ctx.options.inflation !== true) { ctx.macro.inflation = emptyInflation(); return; }
  // Each civ's price level carries from turn to turn and starts again with each age's own prices.
  const before = ctx.macro.inflation || emptyInflation();
  const sameAge = before.levelAge === ctx.age;
  const levels = sameAge ? { ...(before.levels || {}) } : {};
  const members = ctx.civs.filter((civ) => civ.alive === true && hasStage(civ, "publicDebt", ctx.turn, ctx.options));
  const owed = bondDebts(ctx, new Set(members.map((civ) => civ.id)));
  let bond = 0;
  for (const cents of owed.values()) bond += cents;
  const balances = members.map((civ) => civ.balanceCents);
  let money = 0;
  for (const cents of balances) money += Math.max(0, cents);
  ctx.macro.inflation = { piPpm: piPpm({ bondOutstandingCents: bond, memberBalancesCents: balances }), bondCents: bond,
    moneyCents: money, top: largestDebtor([...owed].map(([pid, cents]) => ({ pid, cents })))?.pid ?? null,
    levels, levelAge: ctx.age ?? null };
}

/**
 * The player's notice when its phase changes, naming the events it took part in (or the world's) behind it.
 * @param {TurnContext} ctx
 */
function phaseNotices(ctx) {
  const phases = ctx.macro.cycle.phases;
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const key = String(civ.id);
    const phase = ctx.readings.civ.get(civ.id)?.phase ?? "steady";
    const before = phases[key];
    phases[key] = phase;
    if (before === undefined || before === phase) continue;
    const mine = ctx.macro.cycle.events.filter((row) => row.turn === ctx.turn
      && (row.a === civ.id || row.b === civ.id));
    const causes = (mine.length ? mine : ctx.macro.cycle.events.filter((row) => row.turn === ctx.turn))
      .sort((x, y) => Math.abs(y.w) - Math.abs(x.w)).slice(0, 3);
    notice(ctx, civ.id, { kind: "phase", from: before, to: phase, causes: causes.map((row) => row.kind).join(",") });
  }
}

/**
 * This turn's cycle Gold for a civ (DESIGN 4.11): positive in a boom, negative in a slump; 0 outside the cycle.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function cycleGoldFor(ctx, civ) {
  const reading = ctx.readings.civ.get(civ.id);
  if (!reading || ctx.readings.kPct === 0 || termsFor(ctx, civ.id).outOfCycle) return 0;
  return cycleGoldCents(reading.index, civ.incomeCents, swingFor(ctx.options.swings));
}

/**
 * Positive cycle Gold, a world inflow (DESIGN 4.14 step 3: it counts in the payers' funds this turn).
 * @param {TurnContext} ctx
 */
export function cycleInflows(ctx) {
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const cents = cycleGoldFor(ctx, civ);
    if (cents > 0) emit(ctx, { id: `CY${civ.id}` }, { from: CYCLE, to: civ.id, cents, reason: "cycle" });
  }
}

/**
 * One payer's 1.2 charges in order: prices (step 3), the plan (step 4), negative cycle Gold (step 5). The cycle charge
 * is paid in full from the payer's funds and overdraft (DESIGN 4.18) or skipped; the plan's take buys production and
 * comes from Gold in hand only; nothing is carried.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function macroPayerSteps(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ || civ.alive !== true) return;
  priceFor(ctx, civ);
  planFor(ctx, civ);
  const charge = -cycleGoldFor(ctx, civ);
  if (charge > 0 && payable(ctx.batch, pid) >= charge) {
    emit(ctx, { id: `CY${pid}` }, { from: pid, to: CYCLE, cents: charge, reason: "cycle" });
  }
}

/**
 * DESIGN 4.8: a member's prices climb by its share of the rate (none outside Public debt). The level stands in its
 * capital as purchase-price markers, so the game charges more for everything it buys; nothing is taken from its Gold.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function priceFor(ctx, civ) {
  const rate = priceRate(ctx, civ);
  if (!rate) return;
  const levels = ctx.macro.inflation.levels;
  const key = String(civ.id);
  const next = nextLevelPpm({ levelPpm: levels[key] ?? 0, piPpm: rate.pi, pricePct: rate.pricePct });
  if (next > 0) levels[key] = next;
}

/**
 * A member's rate this turn and its share, or null outside inflation. A civ off the gold standard, with bullion
 * fleets or a debased coin carries inflation of its own; a recoinage halves its share (DESIGN 4.11c).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function priceRate(ctx, civ) {
  if (ctx.options.inflation !== true) return null;
  const crisis = ctx.crisis ? ctx.crisis.terms(civ.id) : null;
  const pi = ctx.readings.piPpm + (crisis?.piExtraPpm ?? 0);
  if (!pi || !hasStage(civ, "publicDebt", ctx.turn, ctx.options) || termsFor(ctx, civ.id).outOfCycle) return null;
  return { pi, pricePct: Math.round((termsFor(ctx, civ.id).pricePct * (crisis?.priceCapPct ?? 100)) / 100) };
}

/**
 * DESIGN 4.17 the plan: 20% of positive income into the cities' builds, split by population, at the game's purchase
 * rate a point, landed with the development loans' progress (one row per city, econ-3).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function planFor(ctx, civ) {
  if (!termsFor(ctx, civ.id).plan) return;
  const split = planSplit(Math.min(planTakeCents(civ.incomeCents), Math.max(0, funds(ctx.batch, civ.id))),
    civ.cities || [], ctx.params.goldPerPointCents);
  let cents = 0;
  for (const row of split) {
    cents += row.cents;
    const same = ctx.out.progress.find((progress) => progress.cityId === row.cityId);
    if (same) same.amount += row.progress;
    else ctx.out.progress.push({ host: civ.id, cityId: row.cityId, amount: row.progress, investmentId: `PL${civ.id}` });
  }
  if (cents <= 0) return;
  emit(ctx, { id: `PL${civ.id}` }, { from: civ.id, to: PLAN, cents, reason: "plan" });
  notice(ctx, civ.id, { kind: "plan", cents, cities: split.length });
}

/**
 * DESIGN 6's citizen rule for each AI (econ-citizens.js aiCitizenPrincipal), inside the 4.2 limits.
 * @param {TurnContext} ctx
 * @param {Civ[]} ai
 */
export function aiMacro(ctx, ai) {
  if (!ctx.options.loans) return;
  for (const civ of ai) {
    const offer = citizensFor(ctx, civ.id);
    if (!offer || isAtLoanLimit(ctx, civ.id)) continue;
    const owes = ctx.ledger.loans.some((loan) => loan.borrower === civ.id && loan.lender === CITIZENS && isOpen(loan));
    // Sized to fit the debt-service limit, as any standard loan must (DESIGN 4.2).
    const serviceRoom = servicePrincipalCents({ roomCents: serviceCap(civ.incomeCents) - serviceOf(ctx.ledger, civ.id),
      ratePpm: offer.ratePpm, term: SHORT_TERM });
    const principal = aiCitizenPrincipal({ incomeCents: civ.incomeCents, balanceCents: lenderBalance(ctx.batch, civ.id),
      insolvent: isInsolventCiv(ctx, civ.id), owesCitizens: owes, roomCents: Math.min(offer.roomCents, serviceRoom) });
    if (principal <= 0 || limitRefusal(ctx, civ.id, { principal, ratePpm: offer.ratePpm, term: SHORT_TERM })) continue;
    openLoan(ctx, { lender: CITIZENS, borrower: civ.id, principal, ratePpm: offer.ratePpm, term: SHORT_TERM,
      source: "ai-citizens" });
  }
}

/**
 * Whether a civ is in its own Depression this turn (DESIGN 6's aid trigger).
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function isInDepression(ctx, pid) {
  return ctx.readings.civ.get(pid)?.phase === "depression";
}

/**
 * The share of income the plan takes this turn, for the Fiscal tab; 0 for any system but Planned.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function planTakeFor(ctx, pid) {
  return termsFor(ctx, pid).plan ? planTakeCents(incomeOf(ctx, pid)) : 0;
}
