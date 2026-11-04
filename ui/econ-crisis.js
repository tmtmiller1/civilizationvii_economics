// econ-crisis.js - Economics: crises (DESIGN 4.11b, 4.11c). Six kinds are read from the model's state on any turn
// (a Depression, a credit panic, a price shock, a debt crisis, runaway inflation, a trade collapse); a civ in one
// chooses a response from its age's menu (econ-crisis-respond.js), each an immediate change plus a legacy; the
// events read from the state (a bank run, bank failures, the Dust Bowl, the Bonus Army, a bubble, a bankruptcy
// cascade) make it worse. The rows live in the ledger and the rules they change read them through the turn
// context's crisis hooks (econ-crisis-rows.js). Nothing here reads the engine.

import { policyWeights } from "./econ-policy.js";
import { CRISIS_KINDS, CRISIS_RULES, RESPONSE_RULES as RR, ageKeyOf, responseById, responsesFor }
  from "./econ-crisis-catalog.js";
import { crisesOn, crisisTerms, forgetTerms, hasLegacy, isRunning, legaciesOf, openCrises, standingResponses }
  from "./econ-crisis-rows.js";
import { costOf, responseRefusal } from "./econ-crisis-respond.js";
import { BOND, INFLATION_RULES } from "./econ-params.js";
import { event, isAlive, notice } from "./econ-turn.js";
import { duesOf } from "./econ-distress.js";
import { isOpen } from "./econ-loan.js";
import { hasStage } from "./econ-stages.js";

/** @typedef {import("./econ-crisis-catalog.js").CrisisKind} CrisisKind */
/** @typedef {import("./econ-cycle.js").Weighted} Weighted */

// --- The conditions ------------------------------------------------------------------------------------------------

/** @param {TurnContext} ctx @param {number} pid */
function counterRow(ctx, pid) {
  const rows = ctx.ledger.crisisCounters;
  let row = rows.find((x) => x.pid === pid);
  if (!row) { row = { pid, dues: 0, hot: 0, routes: [] }; rows.push(row); }
  return row;
}

/**
 * Each turn's readings that the conditions count: turns of dues over income, of inflation at its cap, routes.
 * @param {TurnContext} ctx
 */
function updateCounters(ctx) {
  const hot = ctx.readings.piPpm >= INFLATION_RULES.capPpm;
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const row = counterRow(ctx, civ.id);
    const dues = duesOf(ctx, civ.id).total;
    row.dues = dues > Math.max(0, civ.incomeCents) && dues > 0 ? row.dues + 1 : 0;
    row.hot = hot ? row.hot + 1 : 0;
    const routes = ctx.routes.filter((r) => r.importer === civ.id || r.exporter === civ.id).length;
    row.routes = [...row.routes, routes].slice(-CRISIS_RULES.keepTurns);
  }
  ctx.ledger.crisisCounters = ctx.ledger.crisisCounters.filter((row) => isAlive(ctx, row.pid));
}

/**
 * The resource classes whose price index moved by the shock share on 10 turns ago, up or down.
 * @param {TurnContext} ctx
 */
function shockedClasses(ctx) {
  /** @type {Map<string, { now: number, then: number }>} */
  const sums = new Map();
  for (const res of ctx.market?.resources || []) {
    const history = ctx.markets.history[res.type] || [];
    const now = ctx.markets.prices[res.type];
    const then = history[history.length - 1 - CRISIS_RULES.priceLookback];
    if (!(now > 0) || !(then > 0)) continue;
    const sum = sums.get(res.class) || { now: 0, then: 0 };
    sums.set(res.class, { now: sum.now + now, then: sum.then + then });
  }
  const out = new Set();
  for (const [cls, sum] of sums) {
    if (Math.abs(sum.now - sum.then) * 100 >= sum.then * CRISIS_RULES.priceShockPct) out.add(cls);
  }
  return out;
}

/** The classes a civ imports or exports this turn. @param {TurnContext} ctx @param {number} pid */
function tradedClasses(ctx, pid) {
  const classOf = new Map((ctx.market?.resources || []).map((r) => [r.type, r.class]));
  const out = new Set();
  for (const route of ctx.routes) {
    if (route.importer !== pid && route.exporter !== pid) continue;
    for (const res of route.resources || []) if (classOf.has(res)) out.add(classOf.get(res));
  }
  return out;
}

/** @param {TurnContext} ctx @param {Civ} civ */
function routesCollapsed(ctx, civ) {
  const series = counterRow(ctx, civ.id).routes;
  if (series.length < 2) return false;
  const peak = Math.max(...series.slice(0, -1).slice(-CRISIS_RULES.collapseWithin));
  const now = series[series.length - 1];
  const share = crisisTerms(ctx, civ.id).collapseHalf ? CRISIS_RULES.collapseSharePct / 2
    : CRISIS_RULES.collapseSharePct;
  return peak >= 3 && (peak - now) * 100 >= peak * share;
}

/** @param {TurnContext} ctx @param {number} pid */
function defaultedToCiv(ctx, pid) {
  return ctx.ledger.loans.some((loan) => loan.borrower === pid && loan.state === "default"
    && typeof loan.lender === "number");
}

/** @param {TurnContext} ctx @param {number} pid */
function offGoldLong(ctx, pid) {
  return legaciesOf(ctx.ledger, pid).some((l) => l.id === "gold-standard"
    && ctx.turn - l.since >= CRISIS_RULES.goldStandardTurns);
}

/** Each kind's condition. @type {Record<CrisisKind, (ctx: TurnContext, civ: Civ, shocked: Set<string>) => boolean>} */
const CONDITIONS = {
  depression: (ctx, civ) => ctx.readings.civ.get(civ.id)?.phase === "depression",
  "credit-panic": (ctx, civ) => (ctx.readings.panic || ctx.ledger.bubble?.burst === ctx.turn)
    && ctx.ledger.loans.some((loan) => loan.borrower === civ.id && isOpen(loan)),
  "price-shock": (ctx, civ, shocked) => [...tradedClasses(ctx, civ.id)].some((cls) => shocked.has(cls)),
  debt: (ctx, civ) => counterRow(ctx, civ.id).dues >= CRISIS_RULES.duesTurns || defaultedToCiv(ctx, civ.id),
  inflation: (ctx, civ) => (ctx.options.inflation === true && counterRow(ctx, civ.id).hot >= CRISIS_RULES.hotTurns)
    || offGoldLong(ctx, civ.id),
  "trade-collapse": (ctx, civ) => ctx.options.markets === true && routesCollapsed(ctx, civ),
};

/**
 * Whether a kind can come for a civ: its age, the stage it needs, the spacing and the two-at-once cap.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {CrisisKind} kind
 */
function canStart(ctx, civ, kind) {
  const age = ageKeyOf(ctx.age);
  if (!CRISIS_KINDS[kind].ages.includes(age)) return false;
  if (kind === "credit-panic" && age !== "MO" && !hasStage(civ, "banking", ctx.turn, ctx.options)) return false;
  if (kind === "inflation" && !hasStage(civ, "publicDebt", ctx.turn, ctx.options)) return false;
  const open = openCrises(ctx.ledger, civ.id);
  if (open.length >= CRISIS_RULES.maxAtOnce || open.some((row) => row.kind === kind)) return false;
  const last = ctx.ledger.crisisTurns.find((row) => row.pid === civ.id && row.id === `end:${kind}`);
  return !last || ctx.turn - last.turn >= CRISIS_RULES.spacingTurns;
}

/**
 * The causes behind a civ's phase lately, for the crisis notice and panel: the cycle's logged event kinds.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} [turns]
 */
export function causesFor(ctx, pid, turns = 5) {
  const rows = (ctx.macro.cycle.events || []).filter((row) => ctx.turn - row.turn <= turns && row.w < 0
    && (row.a === pid || row.b === pid || (row.a === null && row.b === null)));
  return [...new Set(rows.map((row) => row.kind))];
}

/** @param {TurnContext} ctx @param {Civ} civ @param {CrisisKind} kind */
function startCrisis(ctx, civ, kind) {
  const causes = causesFor(ctx, civ.id).join(",");
  ctx.ledger.crises.push({ pid: civ.id, kind, since: ctx.turn });
  event(ctx, { kind: "crisis-start", pid: civ.id, crisis: kind, causes, chronicle: 1 });
  notice(ctx, civ.id, { kind: "crisis-start", crisis: kind, causes });
}

/** @param {TurnContext} ctx @param {Civ} civ @param {CrisisRow} row */
function endCrisis(ctx, civ, row) {
  ctx.ledger.crises = ctx.ledger.crises.filter((x) => x !== row);
  const by = [...new Set(ctx.ledger.crisisTurns.filter((x) => x.pid === civ.id && x.turn >= row.since
    && x.id.startsWith("take:")).map((x) => x.id.slice(5)))].join(",");
  ctx.ledger.crisisTurns = ctx.ledger.crisisTurns.filter((x) => !(x.pid === civ.id && x.id === `end:${row.kind}`));
  ctx.ledger.crisisTurns.push({ pid: civ.id, id: `end:${row.kind}`, turn: ctx.turn });
  const turns = ctx.turn - row.since;
  event(ctx, { kind: "crisis-end", pid: civ.id, crisis: row.kind, turns, by, chronicle: 1 });
  notice(ctx, civ.id, { kind: "crisis-end", crisis: row.kind, turns, by });
  for (const standing of standingResponses(ctx.ledger, civ.id)) {
    const spec = responseById(standing.id);
    if (spec && spec.runs === "crisis" && standing.until === null && standing.crisis === row.kind) {
      standing.until = ctx.turn + (spec.after || 0);
    }
  }
}

/** Starts and ends crises for every living civ, with their events and notices. @param {TurnContext} ctx */
function detect(ctx) {
  const shocked = shockedClasses(ctx);
  const kinds = /** @type {CrisisKind[]} */ (Object.keys(CRISIS_KINDS));
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    for (const row of openCrises(ctx.ledger, civ.id)) {
      if (!CONDITIONS[row.kind](ctx, civ, shocked)) endCrisis(ctx, civ, row);
    }
    for (const kind of kinds) {
      if (CONDITIONS[kind](ctx, civ, shocked) && canStart(ctx, civ, kind)) startCrisis(ctx, civ, kind);
    }
  }
  ctx.ledger.crises = ctx.ledger.crises.filter((row) => isAlive(ctx, row.pid));
}

// --- The events, read from the state -------------------------------------------------------------------------------

/**
 * A bank run: a lender civ in Depression with two borrowers in default to it, once per crisis, unless insured.
 * @param {TurnContext} ctx
 */
function bankRuns(ctx) {
  for (const civ of ctx.civs) {
    if (civ.alive !== true || ctx.readings.civ.get(civ.id)?.phase !== "depression") continue;
    if (hasLegacy(ctx.ledger, civ.id, "deposit-insurance") || isRunning(ctx.ledger, civ.id, "bank-run")) continue;
    const crisis = openCrises(ctx.ledger, civ.id).find((row) => row.kind === "depression");
    if (!crisis) continue;
    if (ctx.ledger.events.some((e) => e.kind === "bank-run" && e.pid === civ.id && e.turn >= crisis.since)) continue;
    const defaulted = new Set(ctx.ledger.loans.filter((loan) => loan.lender === civ.id && loan.state === "default")
      .map((loan) => loan.borrower));
    if (defaulted.size < RR.bankRun.defaults) continue;
    ctx.ledger.responses.push({ pid: civ.id, id: "bank-run", crisis: "depression", since: ctx.turn,
      until: ctx.turn + RR.bankRun.closedTurns });
    event(ctx, { kind: "bank-run", pid: civ.id, borrowers: defaulted.size, chronicle: 1 });
    notice(ctx, civ.id, { kind: "bank-run", borrowers: defaulted.size });
  }
}

/** The share of the world's open loans in default, in percent. @param {TurnContext} ctx */
function defaultSharePct(ctx) {
  let total = 0;
  let bad = 0;
  for (const loan of ctx.ledger.loans) {
    if (!isOpen(loan)) continue;
    total += loan.outstanding;
    if (loan.state === "default") bad += loan.outstanding;
  }
  return total > 0 ? (bad * 100) / total : 0;
}

/**
 * Closes the bond market for a few turns to each civ without deposit insurance.
 * @param {TurnContext} ctx
 * @param {number} turns
 * @param {string} kind the notice
 */
function closeBondMarket(ctx, turns, kind) {
  for (const civ of ctx.civs) {
    if (civ.alive !== true || hasLegacy(ctx.ledger, civ.id, "deposit-insurance")) continue;
    if (!ctx.ledger.blocks.some((b) => b.lender === BOND && b.borrower === civ.id)) {
      ctx.ledger.blocks.push({ lender: BOND, borrower: civ.id, reason: "default", agesLeft: null,
        untilTurn: ctx.turn + turns });
    }
    notice(ctx, civ.id, { kind });
  }
}

/**
 * Bank failures: defaults past a fifth of the world's loans in a world Depression close the bond market.
 * @param {TurnContext} ctx
 */
function bankFailures(ctx) {
  if (ctx.macro.cycle.e >= 8000 || hasLegacy(ctx.ledger, -1, "bank-failures")) return;
  if (defaultSharePct(ctx) < RR.bankFailures.defaultSharePct) return;
  closeBondMarket(ctx, RR.bankFailures.closedTurns, "bank-failures");
  ctx.ledger.legacies.push({ pid: null, id: "bank-failures", since: ctx.turn, until: null, nextAge: false });
  event(ctx, { kind: "bank-failures", chronicle: 1 });
}

/**
 * A bubble: credit growing fast five turns running in a Boom; it bursts into a credit panic when the index turns.
 * @param {TurnContext} ctx
 */
function bubble(ctx) {
  const state = ctx.ledger.bubble;
  if (!state) {
    const growth = (ctx.macro.cycle.events || []).filter((row) => row.kind === "credit-growth"
      && ctx.turn - row.turn < RR.bubble.creditTurns);
    if (growth.length < RR.bubble.creditTurns || ctx.macro.cycle.e <= 10500) return;
    ctx.ledger.bubble = { since: ctx.turn, burst: null };
    event(ctx, { kind: "bubble", chronicle: 1 });
    for (const civ of ctx.civs) if (civ.alive === true) notice(ctx, civ.id, { kind: "bubble" });
    return;
  }
  if (state.burst !== null) return;
  if (ctx.macro.cycle.e < RR.bubble.burstBelowBp) {
    state.burst = ctx.turn;
    event(ctx, { kind: "bubble-burst", chronicle: 1 });
  } else if (ctx.turn - state.since > RR.bubble.withinTurns + RR.bubble.creditTurns) {
    ctx.ledger.bubble = null;
  }
}

/**
 * Standing responses and legacies that have run their course end, with a line in the chronicle.
 * @param {TurnContext} ctx
 */
function expire(ctx) {
  const ended = ctx.ledger.responses.filter((row) => row.until !== null && ctx.turn >= row.until);
  ctx.ledger.responses = ctx.ledger.responses.filter((row) => !ended.includes(row) && isAlive(ctx, row.pid));
  for (const row of ended) {
    if (row.id === "bank-run") continue;
    event(ctx, { kind: "response-ended", pid: row.pid, response: row.id, early: 0 });
    notice(ctx, row.pid, { kind: "response-ended", response: row.id });
  }
  const gone = ctx.ledger.legacies.filter((row) => row.until !== null && ctx.turn >= row.until);
  ctx.ledger.legacies = ctx.ledger.legacies.filter((row) => !gone.includes(row)
    && (row.pid === null || isAlive(ctx, row.pid)));
  for (const row of gone) if (row.pid !== null) notice(ctx, row.pid, { kind: "legacy-ended", legacy: row.id });
  ctx.ledger.crisisTurns = ctx.ledger.crisisTurns.filter((row) => isAlive(ctx, row.pid) && ctx.turn - row.turn <= 200);
  forgetTerms(ctx);
}

/** The age change: legacies for the age go, the ones that carry stay one more age. @param {TurnContext} ctx */
export function crisisAgeChange(ctx) {
  ctx.ledger.legacies = ctx.ledger.legacies.filter((row) => row.until !== null || row.nextAge === true)
    .map((row) => (row.until === null ? { ...row, nextAge: false } : row));
  ctx.ledger.responses = [];
  ctx.ledger.crises = [];
  ctx.ledger.bubble = null;
}

/**
 * The crisis step, after the macro snapshot has read phases and prices: what has run its course, the counters, a
 * bubble, the starts and ends, the bank events.
 * @param {TurnContext} ctx
 */
export function crisisStep(ctx) {
  if (!crisesOn(ctx)) return;
  expire(ctx);
  updateCounters(ctx);
  bubble(ctx);
  detect(ctx);
  bankRuns(ctx);
  bankFailures(ctx);
}

// --- The weights on the cycle -------------------------------------------------------------------------------------

/**
 * A civ five turns into a Depression with neither relief nor works running.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function bonusArmy(ctx, civ) {
  const crisis = openCrises(ctx.ledger, civ.id).find((row) => row.kind === "depression");
  if (!crisis || ctx.turn - crisis.since < RR.bonusArmy.turns) return false;
  return !isRunning(ctx.ledger, civ.id, "relief") && !isRunning(ctx.ledger, civ.id, "public-works");
}

/** The standing weights of one civ's responses. @param {TurnContext} ctx @param {Civ} civ */
function civWeights(ctx, civ) {
  const pid = civ.id;
  const own = (/** @type {string} */ kind, /** @type {number} */ w) => ({ kind, a: pid, b: null, w, world: false });
  /** @type {Weighted[]} */
  const out = [];
  if (isRunning(ctx.ledger, pid, "public-works")) out.push(own("public-works", RR.publicWorks.ownBp));
  if (isRunning(ctx.ledger, pid, "austerity")) out.push(own("austerity", RR.austerity.ownBp));
  if (isRunning(ctx.ledger, pid, "rearmament")) out.push(own("rearmament", RR.rearmament.ownBp));
  if (isRunning(ctx.ledger, pid, "gold-standard")) out.push(own("gold-standard", RR.goldStandard.ownBp));
  if (bonusArmy(ctx, civ)) out.push(own("bonus-army", RR.bonusArmy.ownBp));
  return out;
}

/** The lifts and hits of last turn's response and bank-run events. @param {TurnContext} ctx */
function onceWeights(ctx) {
  const last = ctx.ledger.lastTurn;
  /** @type {Record<string, number>} */
  const once = { "bank-holiday": RR.bankHoliday.ownBp, suspend: RR.bankHoliday.ownBp,
    "cancel-debts": RR.cancelDebts.ownBp, confidence: RR.confidence.ownBp };
  /** @type {Weighted[]} */
  const out = [];
  for (const row of ctx.ledger.events) {
    if (row.turn !== last) continue;
    const pid = /** @type {number} */ (row.pid);
    if (row.kind === "response" && Object.hasOwn(once, String(row.response))) {
      out.push({ kind: String(row.response), a: pid, b: null, w: once[String(row.response)], world: false });
    }
    if (row.kind === "bank-run") out.push({ kind: "bank-run", a: pid, b: null, w: RR.bankRun.ownBp, world: false });
  }
  return out;
}

/**
 * The world's share of public works under 0.95, capped, and the trade war of three High holders under 0.80.
 * @param {TurnContext} ctx
 */
function worldWeights(ctx) {
  const live = ctx.civs.filter((civ) => civ.alive === true);
  const stimulus = ctx.macro.cycle.e < RR.publicWorks.worldUnderBp;
  const holders = stimulus ? live.filter((civ) => isRunning(ctx.ledger, civ.id, "public-works")).length : 0;
  const works = holders * RR.publicWorks.worldBp;
  const high = live.filter((civ) => ctx.markets.tariffs.find((row) => row.pid === civ.id)?.level === "high")
    .reduce((sum, civ) => sum + (crisisTerms(ctx, civ.id).tradeWarDouble ? 2 : 1), 0);
  /** @type {Weighted[]} */
  const out = [];
  if (works > 0) out.push({ kind: "public-works", a: null, b: null, w: Math.min(RR.publicWorks.worldCapBp, works), world: true });
  if (high >= RR.tradeWar.highHolders && ctx.macro.cycle.e < 8000) {
    out.push({ kind: "trade-war", a: null, b: null, w: RR.tradeWar.worldBp, world: true });
  }
  return out;
}

/**
 * The weights the responses and the crisis events put on the cycle this turn (DESIGN 4.11b): public works on its
 * holder and, under 0.95, on the world; austerity, rearmament and the gold standard on their holders; the once-off
 * lifts the turn after a bank holiday, a debt cancellation or a fireside chat; the trade war; a bank run; the Bonus
 * Army; and disasters weighing double on a civ in Depression (the Dust Bowl).
 * @param {TurnContext} ctx
 * @param {Weighted[]} events this turn's other events
 * @returns {Weighted[]}
 */
export function crisisWeights(ctx, events) {
  if (!crisesOn(ctx)) return [];
  /** @type {Weighted[]} */
  const out = [];
  for (const civ of ctx.civs) if (civ.alive === true) out.push(...civWeights(ctx, civ));
  out.push(...worldWeights(ctx), ...onceWeights(ctx), ...policyWeights(ctx));
  for (const row of events) {
    if (row.kind !== "disaster" || typeof row.a !== "number") continue;
    if (ctx.readings.civ.get(row.a)?.phase === "depression") out.push({ ...row, kind: "dust-bowl" });
  }
  return out;
}

// --- The view ------------------------------------------------------------------------------------------------------

/**
 * What the World tab's Crisis section and the Fiscal tab's legacy list show for one civ: the open crises with their
 * causes, the responses it could take now with each one's cost and refusal, the standing responses with their turns
 * left, the legacies with theirs.
 * @param {TurnContext} ctx a view context (econ-view-model.js viewContext)
 * @param {number} me
 */
export function crisisView(ctx, me) {
  const civ = ctx.civ.get(me);
  const age = ageKeyOf(ctx.age);
  const crises = openCrises(ctx.ledger, me).map((row) => ({ kind: row.kind, since: row.since,
    turns: ctx.turn - row.since, causes: causesFor(ctx, me, ctx.turn - row.since + 1) }));
  const seen = new Set();
  const responses = [];
  for (const row of crises) {
    for (const spec of responsesFor(row.kind, age)) {
      if (seen.has(spec.id)) continue;
      seen.add(spec.id);
      responses.push({ id: spec.id, trap: spec.trap === true, costCents: civ ? costOf(ctx, civ, spec) : 0,
        refusal: civ ? responseRefusal(ctx, civ, spec) : "no-civ", runs: spec.runs, legacy: spec.legacy || null });
    }
  }
  const left = (/** @type {number | null} */ until) => (until === null ? null : Math.max(0, until - ctx.turn));
  const standing = standingResponses(ctx.ledger, me).map((row) => ({ id: row.id, since: row.since,
    left: left(row.until), crisis: row.crisis }));
  const legacies = legaciesOf(ctx.ledger, me).map((row) => ({ id: row.id, since: row.since, world: row.pid === null,
    left: left(row.until), nextAge: row.nextAge === true }));
  return { on: crisesOn(ctx), crises, responses, standing, legacies, age };
}
