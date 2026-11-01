// econ-crisis-respond.js - Economics: the responses to a crisis (DESIGN 4.11b, 4.11c): what a civ can take, what
// each does the turn it's taken, what stands afterwards and what it pays each turn, what it leaves, the player's
// request and the AI's choice. The rows and the terms are in econ-crisis-rows.js; the conditions and events in
// econ-crisis.js. Nothing here reads the engine.

import { RESPONSE_RULES as RR, ageKeyOf, responseById, responsesFor } from "./econ-crisis-catalog.js";
import { crisesOn, forgetTerms, hasLegacy, isRunning, openCrises, settlementsOf, standingResponses }
  from "./econ-crisis-rows.js";
import { BASE_RATE_PPM, BOND, CITIZENS, CYCLE, INFLATION, PROGRESS, TEMPLE, isWorldAccount } from "./econ-params.js";
import { closeLoan, emit, event, notice, openLoan, repChange, replaceLoan } from "./econ-turn.js";
import { funds } from "./econ-batch.js";
import { duesOf } from "./econ-distress.js";
import { isOpen } from "./econ-loan.js";
import { hasStage } from "./econ-stages.js";
import { planSplit } from "./econ-planned.js";
import { withTariff } from "./econ-trade.js";
import { relationLevel } from "./econ-lenders.js";
import { isInsolvent } from "./econ-guard.js";

/** @typedef {import("./econ-crisis-catalog.js").Response} Response */
/** @typedef {import("./econ-crisis-catalog.js").CrisisKind} CrisisKind */

/** @param {TurnContext} ctx @param {number} pid */
const systemOf = (ctx, pid) => ctx.macro.systems?.[String(pid)]?.system ?? "mixed";

// --- Can a civ take it ------------------------------------------------------------------------------------------

/**
 * The Gold a response takes the turn it's taken, in cents.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Response} spec
 */
export function costOf(ctx, civ, spec) {
  return spec.costTurns ? spec.costTurns * Math.max(0, civ.incomeCents) : 0;
}

/**
 * The civ lenders Friendly with a civ that hold Gold, for Lend to the crown.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function crownLenders(ctx, civ) {
  return ctx.civs.filter((other) => other.id !== civ.id && other.alive === true
    && relationLevel(ctx.relations, other.id, civ.id) === "friendly" && other.balanceCents > 0);
}

/** @param {TurnContext} ctx @param {Civ} civ */
function trades(ctx, civ) {
  return (civ.tradeIncomeCents ?? 0) > 0 || ctx.routes.some((r) => r.importer === civ.id || r.exporter === civ.id);
}

/** @param {TurnContext} ctx @param {Civ} civ @param {Response} spec @param {number} since */
function takenAlready(ctx, civ, spec, since) {
  const rows = ctx.ledger.crisisTurns.filter((row) => row.pid === civ.id && row.id === `take:${spec.id}`);
  if (!rows.length) return false;
  const last = Math.max(...rows.map((row) => row.turn));
  if (spec.id === "confidence") return ctx.turn - last < RR.confidence.everyTurns;
  if (spec.oncePer === "crisis") return last >= since;
  if (spec.oncePer === "age") return ctx.ledger.age === null || rows.some((row) => row.age === ctx.ledger.age);
  return true;
}

/**
 * The checks in order, each the reason it gives.
 * @type {[string, (ctx: TurnContext, civ: Civ, spec: Response) => boolean][]}
 */
const CHECKS = [
  ["crises-off", (ctx) => !crisesOn(ctx)],
  ["age", (ctx, civ, spec) => !spec.ages.includes(ageKeyOf(ctx.age))],
  ["no-crisis", (ctx, civ, spec) => !openCrises(ctx.ledger, civ.id).some((row) => spec.kinds.includes(row.kind))],
  ["stage", (ctx, civ, spec) => !!spec.stage && !hasStage(civ, spec.stage, ctx.turn, ctx.options)],
  ["system", (ctx, civ, spec) => (!!spec.system && !spec.system.includes(systemOf(ctx, civ.id)))
    || (!!spec.notSystem && spec.notSystem.includes(systemOf(ctx, civ.id)))],
  ["running", (ctx, civ, spec) => isRunning(ctx.ledger, civ.id, spec.id)],
  ["once", (ctx, civ, spec) => takenAlready(ctx, civ, spec,
    openCrises(ctx.ledger, civ.id).find((row) => spec.kinds.includes(row.kind))?.since ?? ctx.turn)],
  ["funds", (ctx, civ, spec) => costOf(ctx, civ, spec) > Math.max(0, funds(ctx.batch, civ.id))],
  ["no-lender", (ctx, civ, spec) => spec.id === "lend-crown" && !crownLenders(ctx, civ).length],
  ["no-trade", (ctx, civ, spec) => spec.id === "charter" && !trades(ctx, civ)],
];

/**
 * Why a civ can't take a response now, or null when it can: the age, the crisis, the stage, the system, once per
 * crisis or age, the cost against its funds, a lender for the crown, trade for a company.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Response} spec
 * @returns {string | null}
 */
export function responseRefusal(ctx, civ, spec) {
  for (const [reason, fails] of CHECKS) if (fails(ctx, civ, spec)) return reason;
  return null;
}

// --- What each does the turn it's taken ---------------------------------------------------------------------------

/**
 * The civ lenders with an open loan to a civ, for the responses that cost their goodwill.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function civLendersOf(ctx, pid) {
  const out = new Set();
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && typeof loan.lender === "number" && isOpen(loan)) out.add(loan.lender);
  }
  return [...out];
}

/** @param {TurnContext} ctx @param {number} pid @param {number} level @param {number} grievance */
function lendersResent(ctx, pid, level, grievance) {
  for (const lender of civLendersOf(ctx, pid)) {
    ctx.out.relationships.push({ a: lender, b: pid, delta: level });
    if (grievance > 0) ctx.out.grievances.push({ from: lender, against: pid, amount: grievance });
  }
}

/**
 * Closes a civ's loans from a set of lenders as written off, for the debts cancelled.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {Party[]} lenders
 */
function writeOffLoans(ctx, pid, lenders) {
  let cents = 0;
  for (const loan of ctx.ledger.loans.filter((x) => x.borrower === pid && lenders.includes(x.lender) && isOpen(x))) {
    cents += loan.outstanding;
    closeLoan(ctx, { ...loan, writtenOff: loan.writtenOff + loan.outstanding, outstanding: 0 });
  }
  return cents;
}

/**
 * Cuts a civ's bond and temple debts by a share, for leaving the gold standard.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} share percent
 */
function cutWorldDebts(ctx, pid, share) {
  let cents = 0;
  for (const loan of ctx.ledger.loans.filter((x) => x.borrower === pid && isWorldAccount(x.lender) && isOpen(x))) {
    const cut = Math.floor((loan.outstanding * share) / 100);
    cents += cut;
    replaceLoan(ctx, { ...loan, outstanding: loan.outstanding - cut, writtenOff: loan.writtenOff + cut });
  }
  return cents;
}

/** @param {TurnContext} ctx @param {Party} lender @param {number} borrower */
function blockForAge(ctx, lender, borrower) {
  if (ctx.ledger.blocks.some((b) => b.lender === lender && b.borrower === borrower)) return;
  ctx.ledger.blocks.push({ lender, borrower, reason: "repudiation", agesLeft: 0, untilTurn: null });
}

/**
 * A one-off grant from a world account to the civ.
 * @param {TurnContext} ctx
 * @param {Party} account
 * @param {number} pid
 * @param {number} cents
 * @param {string} reason
 */
function worldGrant(ctx, account, pid, cents, reason) {
  if (cents > 0) emit(ctx, { id: `CR${pid}` }, { from: account, to: pid, cents, reason });
}

/**
 * Tribute: two turns of income from each civ Unfriendly or worse with the levier that it's stronger than.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function levyTribute(ctx, civ) {
  for (const other of ctx.civs) {
    if (other.id === civ.id || other.alive !== true) continue;
    const level = relationLevel(ctx.relations, civ.id, other.id);
    if (level !== "unfriendly" && level !== "war") continue;
    if (!((civ.strength ?? 0) > (other.strength ?? 0))) continue;
    const cents = Math.min(RR.tribute.incomeTurns * Math.max(0, other.incomeCents),
      Math.max(0, funds(ctx.batch, other.id)));
    if (cents <= 0) continue;
    emit(ctx, { id: `TR${other.id}-${civ.id}` }, { from: other.id, to: civ.id, cents, reason: "tribute" });
    ctx.out.grievances.push({ from: other.id, against: civ.id, amount: RR.tribute.grievance });
  }
}

/**
 * Recoinage: the civ's own inflation goes, with the responses that brought it.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function recoin(ctx, civ) {
  const own = ["bullion", "gold-standard", "debase"];
  ctx.ledger.legacies = ctx.ledger.legacies.filter((row) => !(row.pid === civ.id && own.includes(row.id)));
  ctx.ledger.responses = ctx.ledger.responses.filter((row) => !(row.pid === civ.id && own.includes(row.id)));
}

/**
 * The immediate change of each response, the turn it's taken.
 * @type {Record<string, (ctx: TurnContext, civ: Civ) => void>}
 */
const IMMEDIATE = {
  "bank-holiday": (ctx, civ) => {
    lendersResent(ctx, civ.id, RR.bankHoliday.lenderLevel, 0);
    repChange(ctx, civ.id, RR.bankHoliday.repPoints, "response");
  },
  confidence: (ctx, civ) => {
    ctx.out.influence.push({ pid: civ.id, amount: -RR.confidence.influence, reason: "confidence" });
  },
  "cancel-debts": (ctx, civ) => {
    const cents = writeOffLoans(ctx, civ.id, [CITIZENS, TEMPLE]);
    blockForAge(ctx, CITIZENS, civ.id);
    repChange(ctx, civ.id, RR.cancelDebts.repPoints, "response");
    event(ctx, { kind: "debts-cancelled", pid: civ.id, cents });
  },
  debase: (ctx, civ) => worldGrant(ctx, TEMPLE, civ.id, RR.debase.incomeTurns * Math.max(0, civ.incomeCents), "debase"),
  tribute: (ctx, civ) => levyTribute(ctx, civ),
  "temple-lends": (ctx, civ) => {
    openLoan(ctx, { lender: TEMPLE, borrower: civ.id,
      principal: Math.max(1000, RR.templeLends.incomeTurns * civ.incomeCents),
      ratePpm: BASE_RATE_PPM[ctx.age] ?? 10000, term: RR.templeLends.term, source: "crisis" });
  },
  suspend: (ctx, civ) => {
    lendersResent(ctx, civ.id, RR.suspend.lenderLevel, RR.suspend.grievance);
    for (const lender of civLendersOf(ctx, civ.id)) blockForAge(ctx, lender, civ.id);
  },
  recoinage: recoin,
  "navigation-acts": (ctx, civ) => { ctx.markets.tariffs = withTariff(ctx.markets.tariffs, civ.id, "high", ctx.turn); },
  bullion: (ctx, civ) => worldGrant(ctx, CYCLE, civ.id, RR.bullion.incomeTurns * Math.max(0, civ.incomeCents), "bullion"),
  "gold-standard": (ctx, civ) => {
    const cents = cutWorldDebts(ctx, civ.id, RR.goldStandard.writeOffPct);
    lendersResent(ctx, civ.id, RR.goldStandard.lenderLevel, RR.goldStandard.grievance);
    repChange(ctx, civ.id, RR.goldStandard.repPoints, "response");
    event(ctx, { kind: "debts-cut", pid: civ.id, cents });
  },
  austerity: (ctx, civ) => repChange(ctx, civ.id, RR.austerity.repPoints, "response"),
};

/** The legacy rows each response leaves, by id, with the turns each lasts (null: the age). */
/** @typedef {{ id: string, turns: number | null, world?: boolean }} LegacySpec */
const LEGACY_ROWS = /** @type {Record<string, (spec: Response) => LegacySpec[]>} */ ({
  bullion: () => [{ id: "bullion", turns: RR.bullion.piTurns },
    { id: "bullion-pirates", turns: RR.bullion.collapseHalfTurns }],
  "cancel-debts": () => [{ id: "cancel-debts", turns: RR.cancelDebts.templeTurns }],
  suspend: () => [{ id: "suspend", turns: RR.suspend.bondTurns }],
  // The temple's dearer rate is everyone's (DESIGN 4.11c): a world legacy.
  "temple-lends": () => [{ id: "temple-lends", turns: null, world: true }],
});

/** @param {TurnContext} ctx @param {Civ} civ @param {Response} spec */
function leaveLegacies(ctx, civ, spec) {
  const legacy = spec.legacy;
  if (!legacy) return;
  const rows = LEGACY_ROWS[spec.id] ? LEGACY_ROWS[spec.id](spec) : [{ id: spec.id, turns: legacy.turns ?? null }];
  const nextAge = legacy.nextAge === true && (!legacy.system || systemOf(ctx, civ.id) === legacy.system);
  for (const row of rows) {
    ctx.ledger.legacies.push({ pid: row.world ? null : civ.id, id: row.id, since: ctx.turn,
      until: row.turns === null ? null : ctx.turn + row.turns, nextAge });
  }
}

/**
 * A bankruptcy cascade: two suspensions within five turns close the bond market to everyone for five turns.
 * @param {TurnContext} ctx
 */
function noteSuspension(ctx) {
  const recent = ctx.ledger.crisisTurns.filter((row) => row.id === "take:suspend"
    && ctx.turn - row.turn <= RR.cascade.withinTurns);
  if (recent.length < RR.cascade.suspensions) return;
  for (const civ of ctx.civs) {
    if (civ.alive !== true || hasLegacy(ctx.ledger, civ.id, "deposit-insurance")) continue;
    if (ctx.ledger.blocks.some((b) => b.lender === BOND && b.borrower === civ.id)) continue;
    ctx.ledger.blocks.push({ lender: BOND, borrower: civ.id, reason: "default", agesLeft: null,
      untilTurn: ctx.turn + RR.cascade.closedTurns });
  }
  event(ctx, { kind: "cascade", chronicle: 1 });
  for (const civ of ctx.civs) if (civ.alive === true) notice(ctx, civ.id, { kind: "cascade" });
}

/**
 * Takes a response for a civ: the cost, the immediate change, the standing row, the legacies, the event and the
 * notice. The caller has checked responseRefusal.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Response} spec
 * @param {"request" | "ai"} source
 */
export function takeResponse(ctx, civ, spec, source) {
  const crisis = openCrises(ctx.ledger, civ.id).find((row) => spec.kinds.includes(row.kind));
  const kind = crisis?.kind ?? "depression";
  const cost = costOf(ctx, civ, spec);
  if (cost > 0) {
    emit(ctx, { id: `CR${civ.id}` }, { from: civ.id, to: spec.id === "recoinage" ? INFLATION : BOND, cents: cost,
      reason: "response" });
  }
  IMMEDIATE[spec.id]?.(ctx, civ);
  if (spec.runs !== 0) {
    ctx.ledger.responses.push({ pid: civ.id, id: spec.id, crisis: kind, since: ctx.turn,
      until: spec.runs === "crisis" ? null : ctx.turn + spec.runs });
  }
  leaveLegacies(ctx, civ, spec);
  ctx.ledger.crisisTurns.push({ pid: civ.id, id: `take:${spec.id}`, turn: ctx.turn,
    ...(ctx.ledger.age ? { age: ctx.ledger.age } : {}) });
  if (spec.id === "suspend") noteSuspension(ctx);
  event(ctx, { kind: "response", pid: civ.id, response: spec.id, crisis: kind, cents: cost, source, chronicle: 1 });
  notice(ctx, civ.id, { kind: "response", response: spec.id, crisis: kind, cents: cost });
  forgetTerms(ctx);
}

/**
 * Ends a standing response early (the player's choice); relief ended while its crisis runs is remembered.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {string} id
 */
export function cancelResponse(ctx, civ, id) {
  const row = standingResponses(ctx.ledger, civ.id).find((x) => x.id === id);
  if (!row) return "not-running";
  const crisisOpen = openCrises(ctx.ledger, civ.id).some((c) => c.kind === row.crisis);
  ctx.ledger.responses = ctx.ledger.responses.filter((x) => x !== row);
  if (id === "relief" && crisisOpen) {
    ctx.ledger.legacies.push({ pid: civ.id, id: "relief-ended", since: ctx.turn,
      until: ctx.turn + RR.relief.earlyEndTurns, nextAge: false });
  }
  event(ctx, { kind: "response-ended", pid: civ.id, response: id, early: crisisOpen ? 1 : 0 });
  forgetTerms(ctx);
  return null;
}

/**
 * The player's request: `{ kind: "respond", pid, response }` to take one, with `cancel: true` to end a standing
 * one. Returns the refusal reason or null.
 * @param {TurnContext} ctx
 * @param {PlanRequest} request
 */
export function respondRequest(ctx, request) {
  const civ = ctx.civ.get(/** @type {number} */ (request.pid));
  if (!civ || civ.alive !== true) return "no-civ";
  const spec = responseById(String(request.response));
  if (!spec) return "unknown";
  if (request.cancel === true) return cancelResponse(ctx, civ, spec.id);
  const refusal = responseRefusal(ctx, civ, spec);
  if (refusal) return refusal;
  takeResponse(ctx, civ, spec, "request");
  return null;
}

// --- The AI's choice ------------------------------------------------------------------------------------------------

/**
 * A holiday buys time for a civ whose dues pass its income and that can pay once it has the time: income above 0
 * and not insolvent (income at or below 0 for five turns). The balance run of 2026-10-31 showed a holiday taken in
 * a deficit spell keeping the loan alive for the repudiation rule instead of the default.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function wantsHoliday(ctx, civ) {
  return civ.incomeCents > 0 && duesOf(ctx, civ.id).total > civ.incomeCents && !insolventCiv(ctx, civ);
}

/** Income at or below 0 for five turns (DESIGN 4.6). @param {TurnContext} ctx @param {Civ} civ */
function insolventCiv(ctx, civ) {
  return isInsolvent(ctx.ledger.lowIncome.find((row) => row.pid === civ.id)?.turns ?? 0);
}

/**
 * What an insolvent AI may still take: the responses that cost it nothing it hasn't got. Works, a crown loan, a
 * temple loan, a company or a fleet put Gold or credit into a civ whose income is at or below 0, and the balance run
 * of 2026-10-31 showed those loans ending in repudiations (51 against 36 without crises); a holiday only hands the
 * loan to the repudiation rule. The player's seat keeps every choice.
 */
const INSOLVENT_OK = new Set(["confidence", "relief", "cancel-debts"]);

/**
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Response[]} open
 * @param {string} system
 * @param {CrisisKind} kind
 */
function aiPick(ctx, civ, open, system, kind) {
  const holiday = open.find((spec) => spec.id === "bank-holiday" || spec.id === "suspend");
  if (holiday && wantsHoliday(ctx, civ)) return holiday;
  if (insolventCiv(ctx, civ)) open = open.filter((spec) => INSOLVENT_OK.has(spec.id));
  const arms = open.find((spec) => spec.id === "rearmament");
  if (arms && civ.atWar === true) return arms;
  const rank = (/** @type {Response} */ spec) => {
    const i = spec.prefer.indexOf(system);
    return (i < 0 ? 100 : i) * 1000 + spec.order;
  };
  // The Hoover line is left alone, except a Mercantile civ in a trade collapse or paying trade bills, which raises
  // tariffs (DESIGN 4.11c: the trap is theirs to fall into).
  const trade = kind === "trade-collapse" || ctx.trade.some((row) => row.payer === civ.id && row.cents > 0);
  const allowed = open.filter((spec) => !spec.trap
    || (spec.id === "navigation-acts" && system === "mercantile" && trade));
  const preferred = allowed.filter((spec) => spec.prefer.includes(system));
  const fallback = allowed.filter((spec) => ["public-works", "relief", "confidence"].includes(spec.id));
  return (preferred.length ? preferred : fallback).sort((a, b) => rank(a) - rank(b))[0] || null;
}

/**
 * The AI takes one response per crisis, by its system's preferences, the Hoover line left to the Mercantile civs
 * that live on tariffs (DESIGN 4.11b); a civ whose dues pass its income takes the bank holiday first, one at war
 * rearms.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiRespond(ctx, civ) {
  if (!crisesOn(ctx) || civ.human === true) return;
  const system = systemOf(ctx, civ.id);
  for (const crisis of openCrises(ctx.ledger, civ.id)) {
    const taken = ctx.ledger.crisisTurns.some((row) => row.pid === civ.id && row.turn >= crisis.since
      && row.id.startsWith("take:"));
    if (taken) continue;
    const open = responsesFor(crisis.kind, ageKeyOf(ctx.age)).filter((spec) => !responseRefusal(ctx, civ, spec));
    const pick = aiPick(ctx, civ, open, system, crisis.kind);
    if (pick) { takeResponse(ctx, civ, pick, "ai"); return; }
  }
}

// --- Each turn: what the standing responses pay and move ------------------------------------------------------

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} wanted
 */
const within = (ctx, pid, wanted) => Math.min(wanted, Math.max(0, funds(ctx.batch, pid)));

/**
 * Relief: a Gold a settlement to the citizens, four Happiness a settlement back; the dole ended early, a grudge.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function reliefFor(ctx, civ) {
  const n = settlementsOf(civ);
  if (isRunning(ctx.ledger, civ.id, "relief")) {
    const cents = within(ctx, civ.id, RR.relief.goldPerSettlement * n);
    if (cents > 0) {
      emit(ctx, { id: `RL${civ.id}` }, { from: civ.id, to: CITIZENS, cents, reason: "relief" });
      ctx.out.celebration.push({ pid: civ.id, amount: RR.relief.celebrationPerSettlement * n, reason: "relief" });
    }
  }
  if (isRunning(ctx.ledger, civ.id, "cancel-debts")) {
    ctx.out.celebration.push({ pid: civ.id, amount: RR.cancelDebts.celebrationPerSettlement * n, reason: "cancel-debts" });
  }
  if (hasLegacy(ctx.ledger, civ.id, "relief-ended")) {
    ctx.out.celebration.push({ pid: civ.id, amount: -RR.relief.earlyEndPenaltyPerSettlement * n, reason: "relief-ended" });
  }
}

/**
 * Public works: the age's Gold a settlement into the civ's builds through the progress account, as the plan does.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function worksFor(ctx, civ) {
  const cents = within(ctx, civ.id, RR.publicWorks.goldPerSettlement[ageKeyOf(ctx.age)] * settlementsOf(civ));
  const split = planSplit(cents, civ.cities || [], ctx.params.goldPerPointCents);
  let spent = 0;
  for (const row of split) {
    spent += row.cents;
    const same = ctx.out.progress.find((progress) => progress.cityId === row.cityId);
    if (same) same.amount += row.progress;
    else ctx.out.progress.push({ host: civ.id, cityId: row.cityId, amount: row.progress, investmentId: `PW${civ.id}` });
  }
  if (spent > 0) emit(ctx, { id: `PW${civ.id}` }, { from: civ.id, to: PROGRESS, cents: spent, reason: "works" });
}

/**
 * A chartered company's dividends, price supports' bill and the importers' grudge every five turns.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function billsFor(ctx, civ) {
  const tradeIncome = civ.tradeIncomeCents ?? 0;
  if (hasLegacy(ctx.ledger, civ.id, "charter") && tradeIncome > 0) {
    const cents = within(ctx, civ.id, Math.floor((tradeIncome * RR.charter.dividendPct) / 100));
    if (cents > 0) emit(ctx, { id: `CO${civ.id}` }, { from: civ.id, to: CITIZENS, cents, reason: "company" });
  }
  if (isRunning(ctx.ledger, civ.id, "price-supports")) {
    const bill = Math.floor((Math.max(0, civ.incomeCents) * RR.priceSupports.costIncomePct) / 100);
    const cents = within(ctx, civ.id, bill);
    if (cents > 0) emit(ctx, { id: `PS${civ.id}` }, { from: civ.id, to: CYCLE, cents, reason: "price-supports" });
    importersResent(ctx, civ);
  }
}

/**
 * Price supports cost a relationship point with each civ that imports from the civ every five turns (dearer imports).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function importersResent(ctx, civ) {
  const row = standingResponses(ctx.ledger, civ.id).find((x) => x.id === "price-supports");
  if (!row || (ctx.turn - row.since) % RR.priceSupports.everyTurns !== 0 || ctx.turn === row.since) return;
  const importers = new Set(ctx.routes.filter((r) => r.exporter === civ.id).map((r) => r.importer));
  for (const other of importers) {
    ctx.out.relationships.push({ a: other, b: civ.id, delta: RR.priceSupports.importerLevel });
  }
}

/**
 * Relief, public works, a company's dividends and price supports: what a civ pays each turn while they run.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function crisisPayerSteps(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ || civ.alive !== true || !crisesOn(ctx)) return;
  reliefFor(ctx, civ);
  if (isRunning(ctx.ledger, pid, "public-works")) worksFor(ctx, civ);
  billsFor(ctx, civ);
}

/**
 * The uplift the running responses add to prices, and whether any civ floors the farm ones.
 * @param {TurnContext} ctx
 */
function priceMoves(ctx) {
  let pct = 0;
  let floors = false;
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const terms = ctx.crisis ? ctx.crisis.terms(civ.id) : null;
    pct += terms?.pricePct ?? 0;
    if (isRunning(ctx.ledger, civ.id, "price-supports") || (terms?.dole && ageKeyOf(ctx.age) === "AQ")) floors = true;
  }
  return { pct, floors };
}

/**
 * The floor price supports or a grain dole hold under this age's Bonus (farm) resources.
 * @param {TurnContext} ctx
 * @param {Record<string, number>} out
 */
function floorPrices(ctx, out) {
  for (const res of ctx.market?.resources || []) {
    if (!/BONUS/i.test(String(res.class))) continue;
    const history = ctx.markets.history[res.type] || [];
    const then = history[Math.max(0, history.length - RR.priceSupports.lookbackTurns)];
    if (then > 0) out[res.type] = Math.max(out[res.type] || 0, Math.round((then * RR.priceSupports.floorPct) / 100));
  }
}

/**
 * Prices this turn after the responses that move them: the uplift of a debasement, a fleet or the gold standard
 * while it runs, and the floor price supports or a grain dole hold under the farm resources.
 * @param {TurnContext} ctx
 * @param {Record<string, number>} prices
 */
export function adjustPrices(ctx, prices) {
  if (!crisesOn(ctx)) return prices;
  const { pct, floors } = priceMoves(ctx);
  const out = { ...prices };
  if (pct > 0) for (const key of Object.keys(out)) out[key] = Math.round((out[key] * (100 + pct)) / 100);
  if (floors) floorPrices(ctx, out);
  return out;
}

/** The civs running austerity, which repay early like the AI does (AI-PLAN 4.3). @param {TurnContext} ctx */
export function austerityCivs(ctx) {
  return ctx.civs.filter((civ) => civ.alive === true && isRunning(ctx.ledger, civ.id, "austerity"));
}
