// econ-policy.js - Economics: the crisis paths (docs/CRISIS-PATHS-PROPOSAL-v6.md, built on v5, v4 and v3). Each
// government and ideology has its own answers to a crisis (econ-policy-catalog.js). This module decides who can take
// one, takes it (the Influence price and the card's one-off transactions), runs it each turn (its obligations, its
// standing effects, its contribution record), carries a Programme through its lifecycle (Active, Sustained,
// Resolving, then Earned, Compromised or Abandoned), writes the legacy it leaves and moves the civ's institutional
// drift. It also holds the AI's choice and the player's request. Nothing here reads the engine; the glue reads the
// Influence stock, production, routes and settlements into the plan input.
//
// Identities (v4 section 2): a card's id (`cardId`), one activation's id (`rid`, unique in the save through
// `ledger.policySeq`), and its transactions, written into the ledger with the batch before the grants, so the
// batch's own lost-batch re-send covers them. A recurring obligation keeps `settled`, the last turn it was settled,
// and settles every missed turn in order, each once.

import { POLICIES, POLICY_LEGACY_CHARGE, POLICY_LEGACY_SUPPORT, POLICY_LEGACY_TERMS, POLICY_RULES as PR, policyById }
  from "./econ-policy-catalog.js";
import { crisesOn, legaciesOf, settlementsOf, standingResponses } from "./econ-crisis-rows.js";
import { BOND, CITIZENS, CYCLE, PROGRESS } from "./econ-params.js";
import { emit, event, notice, openLoan } from "./econ-turn.js";
import { funds } from "./econ-batch.js";
import { LEDGER_LABELS, arrears, policyNameKey } from "./econ-arrears.js";
import { isOpen } from "./econ-loan.js";
import { planSplit } from "./econ-planned.js";
import { withTariff } from "./econ-trade.js";
import { bondRate, cardsFor, crisisFor, crisisOpen, debtShare, hardshipPoints, indexOf, objectiveOf, policyRefusal,
  priceOf, routesOf, runningPolicies, utilityOf, warTarget } from "./econ-policy-read.js";

export { arrearsCharge, hardTimesRows } from "./econ-arrears.js";
export { cardsFor, driftSteps, hardshipPoints, objectiveOf, owns, policyRefusal, policyView, priceOf, routesOf,
  runningPolicies, utilityOf } from "./econ-policy-read.js";

/** @typedef {import("./econ-policy-catalog.js").Policy} Policy */
/** @typedef {import("./econ-crisis-catalog.js").CrisisKind} CrisisKind */
/** @typedef {import("./econ-policy-read.js").PolicyRow} PolicyRow */

// --- Taking a card -------------------------------------------------------------------------------------------------

/** @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {PolicyRow} row */
function contributionAtCommit(ctx, civ, spec, row) {
  row.c = { inc: Math.max(0, civ.incomeCents), prod: Math.max(0, civ.production ?? 0), routes: routesOf(ctx, civ.id),
    share: debtShare(ctx, civ.id), nextId: ctx.ledger.nextId, str: civ.strength ?? 0,
    locs: (civ.cities || []).map((c) => c.loc).filter(Boolean), added: 0, streak: 0, maxStreak: 0, cut: false,
    reliefEnded: false, breach: null, selfHarm: false, warTurns: 0, everWar: false, lost: false };
}

/**
 * The one-off transactions of a card, the turn it's taken.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function takeEffects(ctx, civ, spec, row) {
  const income = Math.max(1000, civ.incomeCents);
  for (const eff of spec.effects) TAKE_EFFECTS[eff.type]?.(ctx, civ, row, eff, income);
}

/** @typedef {(ctx: TurnContext, civ: Civ, row: PolicyRow, eff: any, income: number) => void} TakeEffect */

/** Writes the civ's bond debt down by a share. @type {TakeEffect} */
function writeOffBond(ctx, civ, row, eff) {
  let cut = 0;
  for (const loan of ctx.ledger.loans.filter((l) => l.borrower === civ.id && l.lender === BOND && isOpen(l))) {
    const take = Math.floor((loan.outstanding * eff.pct) / 100);
    cut += take;
    const i = ctx.ledger.loans.findIndex((l) => l.id === loan.id);
    ctx.ledger.loans[i] = { ...loan, outstanding: loan.outstanding - take, writtenOff: loan.writtenOff + take };
  }
  row.c.writtenOff = cut;
  event(ctx, { kind: "debts-cut", pid: civ.id, cents: cut });
}

/** Grievances from every met civilization. @type {TakeEffect} */
function grievancesMet(ctx, civ, row, eff) {
  for (const r of ctx.relations || []) {
    if ((r.a !== civ.id && r.b !== civ.id) || r.level === "unmet") continue;
    const other = r.a === civ.id ? r.b : r.a;
    if (ctx.civ.get(other)?.alive !== true) continue;
    ctx.out.grievances.push({ from: other, against: civ.id, amount: eff.amount });
  }
}

/** The shared responses a card runs, at its share of their Gold. @type {TakeEffect} */
function runResponses(ctx, civ, row, eff) {
  for (const id of eff.ids) {
    const standing = standingResponses(ctx.ledger, civ.id).find((x) => x.id === id);
    if (standing) standing.costPct = eff.costPct;
    else {
      ctx.ledger.responses.push({ pid: civ.id, id, crisis: /** @type {CrisisKind} */ (row.crisis), since: ctx.turn,
        until: null, costPct: eff.costPct, policy: row.rid });
    }
  }
}

/**
 * The one-off transactions of each effect type, the turn the card is taken.
 * @type {Record<string, TakeEffect>}
 */
const TAKE_EFFECTS = {
  loan: (ctx, civ, row, eff, income) => {
    const lender = eff.lender === "citizens" ? CITIZENS : BOND;
    const ratePpm = Math.round((bondRate(ctx, civ.id) * eff.rateFactorPct) / 100);
    const made = openLoan(ctx, { lender, borrower: civ.id, principal: eff.incomeTurns * income, ratePpm,
      term: eff.term, source: "policy" });
    row.loanId = made?.id ?? null;
  },
  grant: (ctx, civ, row, eff, income) => {
    const cents = eff.incomeTurns * income;
    emit(ctx, { id: `PL${row.rid}` }, { from: BOND, to: civ.id, cents, reason: "policy" });
    row.debt = cents;
  },
  writeOff: writeOffBond,
  grievancesMet,
  highTariff: (ctx, civ) => { ctx.markets.tariffs = withTariff(ctx.markets.tariffs, civ.id, "high", ctx.turn); },
  responses: runResponses,
};

/**
 * Takes a card for a civ: the Influence price, the activation's id, its one-off transactions, the contribution
 * record, the event and the notice. The caller has checked policyRefusal.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {"request" | "ai"} source
 */
export function takePolicy(ctx, civ, spec, source) {
  const crisis = /** @type {any} */ (crisisFor(ctx, civ, spec));
  ctx.ledger.policySeq = (ctx.ledger.policySeq || 0) + 1;
  const rid = `${civ.id}-${crisis.since}-${ctx.ledger.policySeq}`;
  const price = priceOf(ctx, civ, spec);
  if (price > 0) ctx.out.influence.push({ pid: civ.id, amount: -price, reason: "policy" });
  /** @type {PolicyRow} */
  const row = { rid, card: spec.id, pid: civ.id, crisis: crisis.kind, crisisSince: crisis.since, since: ctx.turn,
    until: typeof spec.runs === "number" ? ctx.turn + spec.runs : null, state: "active", settled: ctx.turn - 1, c: {} };
  if (spec.warWithin) row.warBy = ctx.turn + spec.warWithin;
  contributionAtCommit(ctx, civ, spec, row);
  takeEffects(ctx, civ, spec, row);
  if (spec.runs !== 0) ctx.ledger.policies.push(row);
  else endMeasure(ctx, civ, spec, row);
  ctx.ledger.crisisTurns.push({ pid: civ.id, id: `policy:${spec.id}`, turn: ctx.turn,
    ...(ctx.ledger.age ? { age: ctx.ledger.age } : {}) });
  event(ctx, { kind: "policy", pid: civ.id, policy: spec.id, crisis: crisis.kind, cents: price, source, chronicle: 1 });
  notice(ctx, civ.id, { kind: "policy", policy: spec.id, crisis: crisis.kind, cents: price });
  if (source === "ai" && spec.warWithin && civ.atWar !== true) aiDeclare(ctx, civ);
  ctx.crisisTerms = new Map();
}

/**
 * An AI that commits to a war declares it on the weakest met major it isn't friendly with.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function aiDeclare(ctx, civ) {
  const pick = warTarget(ctx, civ);
  if (pick) {
    ctx.out.wars = ctx.out.wars || [];
    ctx.out.wars.push({ a: civ.id, b: pick.id });
  }
}

// --- Each turn -----------------------------------------------------------------------------------------------------

/** @param {TurnContext} ctx @param {number} pid @param {number} wanted */
const within = (ctx, pid, wanted) => Math.min(wanted, Math.max(0, funds(ctx.batch, pid)));

/**
 * Production points spread over the civ's builds, paid from its own Gold as public works are.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {PolicyRow} row
 * @param {number} points
 * @param {CityRead[]} cities
 */
function addProduction(ctx, civ, row, points, cities) {
  if (points <= 0 || !cities.length) return 0;
  const perPoint = ctx.params.goldPerPointCents || 400;
  const cents = within(ctx, civ.id, Math.round(points * perPoint));
  const split = planSplit(cents, cities, ctx.params.goldPerPointCents);
  let spent = 0;
  let pts = 0;
  for (const s of split) {
    spent += s.cents;
    pts += s.progress;
    const same = ctx.out.progress.find((p) => p.cityId === s.cityId);
    if (same) same.amount += s.progress;
    else ctx.out.progress.push({ host: civ.id, cityId: s.cityId, amount: s.progress, investmentId: `PL${row.rid}` });
  }
  if (spent > 0) emit(ctx, { id: `PLP${row.rid}` }, { from: civ.id, to: PROGRESS, cents: spent, reason: "policy" });
  return pts;
}

/**
 * One turn's obligations: Influence, administration. On the batch's own turn what the civ can't pay puts the card in
 * arrears (hard-times plan v2, Part 2); a missed turn settled late pays what it can.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {number} turn
 */
function settleObligations(ctx, civ, spec, row, turn) {
  const now = turn === ctx.turn;
  let unpaidInfluence = 0;
  let unpaidGold = 0;
  if (spec.perTurnInfluence) {
    const stock = Math.max(0, Math.floor(civ.influence ?? 0));
    const paid = now ? Math.min(stock, spec.perTurnInfluence) : spec.perTurnInfluence;
    unpaidInfluence = spec.perTurnInfluence - paid;
    if (paid > 0) ctx.out.influence.push({ pid: civ.id, amount: -paid, reason: "policy" });
  }
  if (spec.adminPct) {
    const charge = Math.round((row.c.inc * spec.adminPct) / 100);
    const paid = within(ctx, civ.id, charge);
    if (paid > 0) {
      emit(ctx, { id: `PLA${row.rid}` }, { from: civ.id, to: CYCLE, cents: paid, reason: "administration",
        label: LEDGER_LABELS.administration, labelArgs: [policyNameKey(spec.id)] });
    }
    unpaidGold = charge - paid;
  }
  if (now && spec.tier === "programme") arrears(ctx, { civ, spec, row }, unpaidInfluence, unpaidGold);
}

/**
 * One turn's standing effects.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function standingEffects(ctx, civ, spec, row) {
  const n = settlementsOf(civ);
  for (const eff of spec.effects) STANDING_EFFECTS[eff.type]?.(ctx, civ, row, eff, n);
  if (row.unmet) ctx.out.celebration.push({ pid: civ.id, amount: -200 * n, reason: "policy" });
}

/** @typedef {(ctx: TurnContext, civ: Civ, row: PolicyRow, eff: any, n: number) => void} StandingEffect */

/** Upkeep paid by the bond market while at war, the debt kept on the row. @type {StandingEffect} */
function borrowUpkeep(ctx, civ, row) {
  if (civ.atWar !== true) return;
  const cents = Math.max(0, civ.upkeepCents ?? 0);
  if (cents <= 0) return;
  emit(ctx, { id: `PLM${row.rid}` }, { from: BOND, to: civ.id, cents, reason: "mobilisation" });
  row.debt = (row.debt || 0) + cents;
}

/** Each trading partner's resentment, every so many turns. @type {StandingEffect} */
function partnersResent(ctx, civ, row, eff) {
  if ((ctx.turn - row.since) % eff.every !== 0 || ctx.turn <= row.since) return;
  const partners = new Set((ctx.routes || []).filter((r) => r.importer === civ.id || r.exporter === civ.id)
    .map((r) => (r.importer === civ.id ? r.exporter : r.importer)));
  for (const other of partners) ctx.out.relationships.push({ a: other, b: civ.id, delta: eff.level });
}

/**
 * What each effect type does each turn while the card runs.
 * @type {Record<string, StandingEffect>}
 */
const STANDING_EFFECTS = {
  support: (ctx, civ, row, eff, n) => {
    ctx.out.celebration.push({ pid: civ.id, amount: eff.perSettlement * n, reason: "policy" });
  },
  goldPerSettlement: (ctx, civ, row, eff, n) => {
    const cents = within(ctx, civ.id, eff.cents * n);
    if (cents > 0) emit(ctx, { id: `PLC${row.rid}` }, { from: civ.id, to: CITIZENS, cents, reason: "policy" });
  },
  routeProduction: (ctx, civ, row, eff) => {
    const pts = routesOf(ctx, civ.id) * eff.points;
    const cities = (civ.cities || []).filter((c) => c.build && c.neededProgress > 0);
    row.c.added += addProduction(ctx, civ, row, pts, cities);
  },
  militaryProduction: (ctx, civ, row, eff) => {
    if (eff.atWarOnly && civ.atWar !== true) return;
    const cities = (civ.cities || []).filter((c) => c.military && c.neededProgress > 0);
    row.c.added += addProduction(ctx, civ, row, eff.points * cities.length, cities);
  },
  borrowedUpkeep: borrowUpkeep,
  partnersResent,
};

/**
 * The contribution record's per-turn figures.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function track(ctx, civ, spec, row) {
  const c = row.c;
  const routes = routesOf(ctx, civ.id);
  c.streak = routes >= c.routes ? c.streak + 1 : 0;
  c.maxStreak = Math.max(c.maxStreak, c.streak);
  if (civ.atWar === true) { c.everWar = true; c.warTurns += 1; }
  const locs = new Set((civ.cities || []).map((x) => x.loc));
  if (c.locs.some((/** @type {string} */ loc) => !locs.has(loc))) c.lost = true;
  trackFlags(ctx, civ, row);
  trackWar(ctx, civ, spec, row);
}

/**
 * Austerity under 0.80 (a self-caused prolongation) and any default during the run.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {PolicyRow} row
 */
function trackFlags(ctx, civ, row) {
  if (standingResponses(ctx.ledger, civ.id).some((x) => x.id === "austerity") && indexOf(ctx, civ.id) < PR.ruinsBp) {
    row.c.selfHarm = true;
  }
  if (ctx.ledger.loans.some((l) => l.borrower === civ.id && l.state === "default")) row.c.defaulted = true;
}

/**
 * A war commitment missed by its deadline turns the card until the war comes.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function trackWar(ctx, civ, spec, row) {
  if (row.warBy && !row.c.everWar && ctx.turn > row.warBy && !row.unmet) {
    row.unmet = true;
    event(ctx, { kind: "policy-turned", pid: civ.id, policy: spec.id });
    notice(ctx, civ.id, { kind: "policy-turned", policy: spec.id });
  }
  if (row.unmet && civ.atWar === true) row.unmet = false;
}

/**
 * What a civ's running cards do this turn, in order: every missed turn's obligations once each, then this turn's
 * standing effects and the contribution record, then the lifecycle.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function policyPayerSteps(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ || civ.alive !== true || !crisesOn(ctx)) return;
  for (const row of [...runningPolicies(ctx.ledger, pid)]) {
    const spec = policyById(row.card);
    if (!spec) { removeRow(ctx, row); continue; }
    const from = Math.max(row.settled + 1, ctx.turn - 10);
    for (let turn = from; turn <= ctx.turn; turn += 1) settleObligations(ctx, civ, spec, row, turn);
    row.settled = Math.max(row.settled, ctx.turn);
    standingEffects(ctx, civ, spec, row);
    track(ctx, civ, spec, row);
    lifecycle(ctx, civ, spec, row);
  }
  legacyEffects(ctx, civ);
}

/** The standing support and charges of the crisis-paths legacies. @param {TurnContext} ctx @param {Civ} civ */
function legacyEffects(ctx, civ) {
  const n = settlementsOf(civ);
  for (const leg of legaciesOf(ctx.ledger, civ.id)) {
    const support = /** @type {Record<string, number>} */ (POLICY_LEGACY_SUPPORT)[leg.id];
    if (support) ctx.out.celebration.push({ pid: civ.id, amount: support * n, reason: "policy-legacy" });
    const charge = /** @type {Record<string, number>} */ (POLICY_LEGACY_CHARGE)[leg.id];
    if (charge) {
      const cents = within(ctx, civ.id, charge * n);
      if (cents > 0) emit(ctx, { id: `LG${civ.id}` }, { from: civ.id, to: CYCLE, cents, reason: "policy-legacy" });
    }
    if (leg.id === "path-war-earned" && civ.atWar === true) {
      const cities = (civ.cities || []).filter((c) => c.military && c.neededProgress > 0);
      const legacyRow = /** @type {PolicyRow} */ (/** @type {unknown} */ ({ rid: `LG${civ.id}` }));
      addProduction(ctx, civ, legacyRow, cities.length, cities);
    }
    if (leg.id === "shares-claim") {
      const cents = within(ctx, civ.id, Math.round((Math.max(0, civ.incomeCents) * PR.claimPctOfIncome) / 100));
      if (cents > 0) emit(ctx, { id: `SC${civ.id}` }, { from: civ.id, to: BOND, cents, reason: "claim" });
    }
  }
}

// --- The lifecycle and the outcome ---------------------------------------------------------------------------------

/** @param {TurnContext} ctx @param {PolicyRow} row */
function removeRow(ctx, row) {
  ctx.ledger.policies = ctx.ledger.policies.filter((x) => x !== row);
  ctx.crisisTerms = new Map();
}

/** @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {PolicyRow} row */
function lifecycle(ctx, civ, spec, row) {
  if (spec.tier !== "programme") { measureStep(ctx, civ, spec, row); return; }
  if (row.c.breach) { abandon(ctx, civ, spec, row, row.c.breach); return; }
  const turns = ctx.turn - row.since;
  if (row.state === "active" && turns >= (spec.minTurns ?? PR.minTurns)) {
    row.state = "sustained";
    event(ctx, { kind: "policy-sustained", pid: civ.id, policy: spec.id });
    notice(ctx, civ.id, { kind: "policy-sustained", policy: spec.id });
  }
  if (row.state === "sustained" && !crisisOpen(ctx, row)) adjudicate(ctx, civ, spec, row);
}

/**
 * A Measure's or a Gamble's run: its tests and its end.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function measureStep(ctx, civ, spec, row) {
  const when = spec.turns?.when;
  if (when === "indexUnderAfter") assemblyTest(ctx, civ, spec, row);
  if (when === "missOnLoan") lotteryTest(ctx, civ, spec, row);
  if (when === "offBookDue") offBook(ctx, civ, spec, row);
  if (row.until !== null && ctx.turn >= row.until) endMeasure(ctx, civ, spec, row);
}

/**
 * The assembly's test: the civ's own index under 0.90 the set turns after it spoke.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function assemblyTest(ctx, civ, spec, row) {
  if (row.turned || ctx.turn - row.since !== spec.turns?.after) return;
  if (indexOf(ctx, civ.id) < PR.gambleTestBp) turnGamble(ctx, civ, spec, row);
}

/**
 * The lottery loan's test: a miss on it doubles its rate for what's left.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function lotteryTest(ctx, civ, spec, row) {
  if (row.turned) return;
  const loan = ctx.ledger.loans.find((l) => l.id === row.loanId);
  if (!loan || !(loan.missed > 0)) return;
  const i = ctx.ledger.loans.findIndex((l) => l.id === loan.id);
  ctx.ledger.loans[i] = { ...loan, ratePpm: loan.ratePpm * 2 };
  turnGamble(ctx, civ, spec, row);
}

/**
 * Off-book bills: a settlement taken in the window pays what its Gold would in 10 turns; the rest becomes a loan.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function offBook(ctx, civ, spec, row) {
  const paid = row.c.paid || [];
  const taken = (civ.cities || []).filter((c) => c.loc && !row.c.locs.includes(c.loc) && c.orig !== civ.id
    && !paid.includes(c.loc));
  for (const city of taken) payFromCapture(ctx, civ, spec, row, city);
  if (ctx.turn - row.since >= PR.offBookTurns && (row.debt || 0) > 0 && !row.converted) convertOffBook(ctx, civ, row);
}

/**
 * A settlement taken pays what its Gold would in 10 turns toward the bills, no more.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {CityRead} city
 */
function payFromCapture(ctx, civ, spec, row, city) {
  const pay = Math.min(row.debt || 0, Math.max(0, city.goldCents ?? 0) * PR.offBookCaptureTurns);
  row.debt = (row.debt || 0) - pay;
  row.c.paid = [...(row.c.paid || []), city.loc];
  if (pay > 0) event(ctx, { kind: "policy-capture", pid: civ.id, policy: spec.id, cents: pay });
}

/**
 * What's left of the bills becomes a bond loan at 1.5 times the rate.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {PolicyRow} row
 */
function convertOffBook(ctx, civ, row) {
  const made = openLoan(ctx, { lender: BOND, borrower: civ.id, principal: row.debt || 0,
    ratePpm: Math.round(bondRate(ctx, civ.id) * 1.5), term: 10, source: "policy" });
  row.converted = true;
  row.loanId = made?.id ?? null;
  row.debt = 0;
}

/**
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function turnGamble(ctx, civ, spec, row) {
  row.turned = true;
  const leg = spec.legacies.turned;
  if (leg) pushLegacy(ctx, civ.id, leg, ctx.turn);
  event(ctx, { kind: "policy-turned", pid: civ.id, policy: spec.id });
  notice(ctx, civ.id, { kind: "policy-turned", policy: spec.id });
}

/**
 * A Gamble judged after its crisis: kept while the crisis runs, then tested some turns after it ends (on the turn it
 * ends the index has only just passed 0.80). True once the test has run and the card can end.
 * @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {PolicyRow} row
 */
function crisisEndTest(ctx, civ, spec, row) {
  if (crisisOpen(ctx, row)) {
    // Kept with its end turn passed, so the check runs again each turn (the first build stored it with no end turn,
    // and the card was never judged).
    if (!ctx.ledger.policies.includes(row)) ctx.ledger.policies.push(row);
    return false;
  }
  if (row.c.testAt === undefined) row.c.testAt = ctx.turn + (spec.turns?.after ?? 0);
  if (ctx.turn < row.c.testAt) return false;
  if (indexOf(ctx, civ.id) < (spec.turns?.bp ?? PR.gambleTestBp)) turnGamble(ctx, civ, spec, row);
  return true;
}

/**
 * A Measure's or a Gamble's end: its end legacy, and a gamble judged at its crisis's end.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function endMeasure(ctx, civ, spec, row) {
  if (spec.turns?.when === "indexUnderAtCrisisEnd" && !crisisEndTest(ctx, civ, spec, row)) return;
  const leg = spec.legacies.end;
  if (leg) pushLegacy(ctx, civ.id, leg, ctx.turn);
  removeRow(ctx, row);
  event(ctx, { kind: "policy-ended", pid: civ.id, policy: spec.id });
}

/**
 * @param {{ id: string, turns: number | null, nextAge?: boolean }} leg
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {{ id: string, turns: number | null, nextAge?: boolean }} leg
 * @param {number} turn
 */
function pushLegacy(ctx, pid, leg, turn) {
  if (leg.turns === 0) return;
  ctx.ledger.legacies = ctx.ledger.legacies.filter((row) => !(row.pid === pid && row.id === leg.id));
  ctx.ledger.legacies.push({ pid, id: leg.id, since: turn, until: leg.turns === null ? null : turn + leg.turns,
    nextAge: leg.nextAge === true });
}

/**
 * The outcome: Earned when the objective was met and the civ's own index stood at 0.80 or better; Compromised
 * otherwise (v4: an institution with its costs, not a partial win). A crisis prolonged by the civ's own austerity
 * fails the objective.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function adjudicate(ctx, civ, spec, row) {
  const objective = objectiveOf(ctx, civ, spec, row);
  const ruins = indexOf(ctx, civ.id) < PR.ruinsBp;
  const outcome = objective.met && !ruins && !row.c.selfHarm ? "earned" : "compromised";
  finish(ctx, civ, spec, row, { outcome, detail: objective.parts.filter((p) => p.done).map((p) => p.id).join(",") });
}

/**
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {string} why
 */
function abandon(ctx, civ, spec, row, why) {
  finish(ctx, civ, spec, row, { outcome: "abandoned", detail: String(why) });
}

/**
 * Writes the outcome: the legacy, the converted mobilisation debt, drift, the summary row, the event and the notice.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {{ outcome: string, detail: string }} result
 */
function finish(ctx, civ, spec, row, { outcome, detail }) {
  const leg = spec.legacies[outcome];
  if (leg) pushLegacy(ctx, civ.id, leg, ctx.turn);
  settleOutcome(ctx, civ, spec, row, outcome);
  for (const r of standingResponses(ctx.ledger, civ.id)) if (r.policy === row.rid) r.until = ctx.turn;
  if (outcome === "earned" && spec.path) drift(ctx, civ, spec.path);
  ctx.ledger.pathResults = [...(ctx.ledger.pathResults || []), { pid: civ.id, path: spec.path ?? spec.id,
    card: spec.id, outcome, turn: ctx.turn, crisis: row.crisis, crisisSince: row.crisisSince }].slice(-24);
  event(ctx, { kind: "policy-outcome", pid: civ.id, policy: spec.id, outcome, detail, chronicle: 1 });
  notice(ctx, civ.id, { kind: "policy-outcome", policy: spec.id, outcome, detail });
  removeRow(ctx, row);
}

/**
 * An abandoned citizens' republic closes the citizens for 20 turns; the war economy's borrowed upkeep becomes a bond
 * loan, at 1.25 times the rate unless Earned.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {string} outcome
 */
function settleOutcome(ctx, civ, spec, row, outcome) {
  if (outcome === "abandoned" && spec.path === "citizens-republic") {
    ctx.ledger.blocks.push({ lender: CITIZENS, borrower: civ.id, reason: "default", agesLeft: null,
      untilTurn: ctx.turn + 20 });
  }
  if ((row.debt || 0) > 0 && spec.effects.some((e) => e.type === "borrowedUpkeep")) {
    openLoan(ctx, { lender: BOND, borrower: civ.id, principal: row.debt || 0,
      ratePpm: Math.round((bondRate(ctx, civ.id) * (outcome === "earned" ? 100 : 125)) / 100),
      term: 10, source: "policy" });
  }
}

/**
 * Institutional drift (v3 4a): the earned path a step cheaper, the civ's other paths a step dearer, each within
 * three steps; earning another path later moves this one back.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {string} path
 */
function drift(ctx, civ, path) {
  ctx.ledger.affinity = ctx.ledger.affinity || [];
  let row = ctx.ledger.affinity.find((x) => x.pid === civ.id);
  if (!row) { row = { pid: civ.id, steps: {} }; ctx.ledger.affinity.push(row); }
  const clamp = (/** @type {number} */ v) => Math.max(-PR.driftMaxSteps, Math.min(PR.driftMaxSteps, v));
  const paths = new Set(POLICIES.filter((p) => p.path).map((p) => /** @type {string} */ (p.path)));
  for (const other of paths) {
    row.steps[other] = clamp((row.steps[other] ?? 0) + (other === path ? -1 : 1));
  }
}

/**
 * The player ends a running card early; a Programme ends Abandoned.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {string} id
 */
function cancelPolicy(ctx, civ, id) {
  const row = runningPolicies(ctx.ledger, civ.id).find((x) => x.card === id);
  const spec = policyById(id);
  if (!row || !spec) return "not-running";
  if (spec.tier === "programme") abandon(ctx, civ, spec, row, "ended");
  else endMeasure(ctx, civ, spec, row);
  return null;
}

/**
 * The player's request: `{ kind: "policy", pid, policy }`, with `cancel: true` to end one.
 * @param {TurnContext} ctx
 * @param {PlanRequest} request
 */
export function policyRequest(ctx, request) {
  const civ = ctx.civ.get(/** @type {number} */ (request.pid));
  if (!civ || civ.alive !== true) return "no-civ";
  const spec = policyById(String(request.policy));
  if (!spec) return "unknown";
  if (request.cancel === true) return cancelPolicy(ctx, civ, spec.id);
  const refusal = policyRefusal(ctx, civ, spec);
  if (refusal) return refusal;
  takePolicy(ctx, civ, spec, "request");
  return null;
}

/**
 * A shared response's Gold, after a card that halves it.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {string} id
 */
export function responseCostPct(ledger, pid, id) {
  return standingResponses(ledger, pid).find((x) => x.id === id)?.costPct ?? 100;
}

/**
 * Notes from the shared responses' own steps: a cut grant, relief ended early.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {string} what
 */
export function notePolicyResponse(ctx, pid, what) {
  for (const row of runningPolicies(ctx.ledger, pid)) {
    if (what === "cut") row.c.cut = true;
    if (what === "relief-ended") row.c.reliefEnded = true;
    if (what.startsWith("added:")) row.c.added = (row.c.added || 0) + Number(what.slice(6));
  }
}

// --- The terms and the index ----------------------------------------------------------------------------------------

/**
 * What a civ's running cards and crisis-paths legacies change in its crisis terms (econ-crisis-rows.js).
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {Record<string, any>} terms
 */
export function policyTerms(ctx, pid, terms) {
  for (const row of runningPolicies(ctx.ledger, pid)) {
    const spec = policyById(row.card);
    if (spec) runningTerms(spec, row, terms);
  }
  for (const leg of legaciesOf(ctx.ledger, pid)) {
    const t = /** @type {Record<string, any>} */ (POLICY_LEGACY_TERMS)[leg.id];
    if (t) applyTerms(terms, t);
  }
}

/**
 * One running card's terms: a Programme's own rate factor, its terms effects, aid's goodwill, a missed war.
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {Record<string, any>} terms
 */
function runningTerms(spec, row, terms) {
  if (spec.tier === "programme") {
    terms.ownRatePct = Math.round((terms.ownRatePct * (spec.rateFactorPct ?? PR.programmeRateFactorPct)) / 100);
  }
  for (const eff of spec.effects) if (eff.type === "terms") applyTerms(terms, eff.terms);
  for (const eff of spec.effects) {
    if (eff.type !== "aid") continue;
    terms.aidGoodwillPct = eff.goodwillPct;
    terms.aidBondHalf = eff.bondHalf;
  }
  if (row.unmet) terms.billPct = Math.round((terms.billPct * 125) / 100);
}

/** @param {Record<string, any>} terms @param {Record<string, any>} add */
function applyTerms(terms, add) {
  for (const [key, value] of Object.entries(add)) {
    if (typeof value === "boolean") terms[key] = value;
    else if (key === "capTurns" || key === "piExtraPpm") terms[key] = (terms[key] ?? 0) + value;
    else terms[key] = Math.round(((terms[key] ?? 100) * value) / 100);
  }
}

/**
 * The index weights the cards put on their holders (v6: only confidence moves the index directly): the assembly
 * speaks, the turn after; the war economy's legacy dragging at peace.
 * @param {TurnContext} ctx
 */
export function policyWeights(ctx) {
  return [...confidenceWeights(ctx), ...idleWeights(ctx)];
}

/** @typedef {{ kind: string, a: number | null, b: null, w: number, world: boolean }} PolicyWeight */

/**
 * The confidence lift the turn after a card that carries one was taken.
 * @param {TurnContext} ctx
 * @returns {PolicyWeight[]}
 */
function confidenceWeights(ctx) {
  /** @type {PolicyWeight[]} */
  const out = [];
  for (const ev of ctx.ledger.events) {
    if (ev.turn !== ctx.ledger.lastTurn || ev.kind !== "policy") continue;
    const conf = policyById(String(ev.policy))?.effects.find((e) => e.type === "confidence");
    if (conf && conf.type === "confidence") {
      out.push({ kind: "policy-confidence", a: /** @type {number} */ (ev.pid), b: null, w: conf.bp, world: false });
    }
  }
  return out;
}

/**
 * The war economy's legacy dragging on a civ at peace ten turns or more.
 * @param {TurnContext} ctx
 * @returns {PolicyWeight[]}
 */
function idleWeights(ctx) {
  /** @type {PolicyWeight[]} */
  const out = [];
  for (const civ of ctx.civs) {
    if (civ.alive !== true || civ.atWar === true) continue;
    if (!legaciesOf(ctx.ledger, civ.id).some((l) => l.id === "path-war-earned")) continue;
    const peace = ctx.macro.cycle.atWar?.[String(civ.id)] === false ? peaceTurns(ctx, civ.id) : 0;
    if (peace >= PR.warHoldTurns) out.push({ kind: "war-economy-idle", a: civ.id, b: null, w: -100, world: false });
  }
  return out;
}

/** Turns at peace, counted on the crisis counters. @param {TurnContext} ctx @param {number} pid */
function peaceTurns(ctx, pid) {
  const row = (ctx.ledger.crisisCounters || []).find((x) => x.pid === pid);
  if (row) row.peace = ctx.civ.get(pid)?.atWar === true ? 0 : (row.peace ?? 0) + 1;
  return row?.peace ?? 0;
}

/**
 * Each living civ's hardship this turn, for Partisans (`__towerEconomics.hardship`).
 * @param {TurnContext} ctx
 * @returns {Record<string, number>}
 */
export function hardshipRows(ctx) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!crisesOn(ctx)) return out;
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const running = (/** @type {string} */ id) => standingResponses(ctx.ledger, civ.id).some((x) => x.id === id);
    const points = hardshipPoints({ index: indexOf(ctx, civ.id), relief: running("relief")
      || runningPolicies(ctx.ledger, civ.id).some((x) => x.card === "new-deal"), austerity: running("austerity") });
    if (points > 0) out[String(civ.id)] = points;
  }
  return out;
}

// --- The AI -------------------------------------------------------------------------------------------------------

/**
 * The AI takes the best of its own cards when it scores above nothing, once a crisis, a war card only when it's
 * already at war or strong (v6 3; phase 0 opened AI-declared wars). A card with a per-turn Influence price also needs
 * the Influence forecast to pass (utilityOf's reserve rule), so the turn's stock goes in the log first.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiPolicy(ctx, civ) {
  if (!crisesOn(ctx) || civ.human === true) return;
  noteInfluence(ctx, civ);
  const open = cardsFor(ctx, civ).filter((spec) => !policyRefusal(ctx, civ, spec));
  const scored = open.map((spec) => ({ spec, u: utilityOf(ctx, civ, spec) })).filter((x) => x.u > 0)
    .sort((a, b) => b.u - a.u || a.spec.order - b.spec.order);
  if (scored.length) takePolicy(ctx, civ, scored[0].spec, "ai");
}

/**
 * Writes the civ's Influence stock this turn into the ledger's log, the last six turns kept; a turn planned again
 * replaces its own entry.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function noteInfluence(ctx, civ) {
  if (typeof civ.influence !== "number" || !Number.isFinite(civ.influence)) return;
  const log = ctx.ledger.influenceLog = ctx.ledger.influenceLog || [];
  let row = log.find((x) => x.pid === civ.id);
  if (!row) { row = { pid: civ.id, turn: ctx.turn, stocks: [] }; log.push(row); }
  else if (row.turn === ctx.turn) row.stocks.pop();
  row.stocks = [...row.stocks, Math.round(civ.influence)].slice(-6);
  row.turn = ctx.turn;
}
