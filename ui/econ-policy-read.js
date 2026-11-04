// econ-policy-read.js - Economics: the crisis paths' reads (econ-policy.js holds the moves). Who owns a card, what it
// costs, why a civ can't take it, each path's objective on the contribution record, the hardship for Partisans, the
// AI's utility and the panel's view. Nothing here writes the ledger or reads the engine.

import { POLICIES, POLICY_RULES as PR, policyById } from "./econ-policy-catalog.js";
import { ageKeyOf } from "./econ-crisis-catalog.js";
import { crisesOn, openCrises, settlementsOf, standingResponses } from "./econ-crisis-rows.js";
import { BOND, CITIZENS } from "./econ-params.js";
import { offerQuery } from "./econ-turn.js";
import { funds } from "./econ-batch.js";
import { duesOf } from "./econ-distress.js";
import { isOpen } from "./econ-loan.js";
import { bondRatePpm } from "./econ-lenders.js";

/** @typedef {import("./econ-policy-catalog.js").Policy} Policy */
/** @typedef {import("./econ-policy-catalog.js").PolicyEffect} PolicyEffect */

/**
 * One running card. `c` is the contribution record (v4 section 1): the figures at Commit and what the card has done.
 * @typedef {{ rid: string, card: string, pid: number, crisis: string, crisisSince: number, since: number,
 *   until: number | null, state: "active" | "sustained", settled: number, loanId?: string | null, debt?: number,
 *   warBy?: number | null, unmet?: boolean, turned?: boolean, converted?: boolean, c: Record<string, any>,
 *   arrearsRun?: number, arrearsPoints?: number, paidRun?: number, arrearsTurn?: number }} PolicyRow
 */

/** @param {Ledger} ledger @param {number} pid */
export function runningPolicies(ledger, pid) {
  return (ledger.policies || []).filter((row) => row.pid === pid);
}

/** @param {TurnContext} ctx @param {number} pid */
export const indexOf = (ctx, pid) => ctx.readings?.civ?.get(pid)?.index ?? 10000;

/** The routes a civ is on, either end. @param {TurnContext} ctx @param {number} pid */
export function routesOf(ctx, pid) {
  return (ctx.routes || []).filter((r) => r.importer === pid || r.exporter === pid).length;
}

/** A civ's debt service as a share of its income, in ppm. @param {TurnContext} ctx @param {number} pid */
export function debtShare(ctx, pid) {
  const civ = ctx.civ.get(pid);
  const income = Math.max(1000, civ?.incomeCents ?? 0);
  return Math.round((duesOf(ctx, pid).loans * 1e6) / income);
}

/** The bond market's rate to a civ now, in ppm. @param {TurnContext} ctx @param {number} pid */
export function bondRate(ctx, pid) {
  const q = offerQuery(ctx, pid);
  return bondRatePpm({ age: ctx.age, standing: q.standing, rates: q.rates, depthFactorPct: q.depthFactorPct,
    systemPct: q.bondPct }) ?? 20000;
}

/** Whether a card is one of the civ's: its government or its ideology. @param {Policy} spec @param {Civ} civ */
export function owns(spec, civ) {
  return (spec.owners.government || []).includes(String(civ.government))
    || (spec.owners.ideology || []).includes(String(civ.ideology));
}

/** The civ's cards in this age. @param {TurnContext} ctx @param {Civ} civ */
export function cardsFor(ctx, civ) {
  const age = ageKeyOf(ctx.age);
  return POLICIES.filter((spec) => spec.ages.includes(age) && owns(spec, civ)).sort((a, b) => a.order - b.order);
}

/**
 * A path's drift steps for a civ (negative is cheaper).
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {string} path
 */
export function driftSteps(ledger, pid, path) {
  return (ledger.affinity || []).find((row) => row.pid === pid)?.steps?.[path] ?? 0;
}

/**
 * The Influence a card costs this civ: drift moves a Programme's price 5% a step.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 */
export function priceOf(ctx, civ, spec) {
  const steps = spec.path ? driftSteps(ctx.ledger, civ.id, spec.path) : 0;
  return Math.max(0, Math.round((spec.influence * (100 + steps * PR.driftStepPct)) / 100));
}

/**
 * The open crisis a card answers for a civ, oldest first.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 */
export function crisisFor(ctx, civ, spec) {
  return openCrises(ctx.ledger, civ.id).filter((row) => spec.kinds.includes(row.kind))
    .sort((a, b) => a.since - b.since)[0] || null;
}

/** Whether a row's crisis is still open for the civ. @param {TurnContext} ctx @param {PolicyRow} row */
export const crisisOpen = (ctx, row) => openCrises(ctx.ledger, row.pid)
  .some((c) => c.kind === row.crisis && c.since === row.crisisSince);

/**
 * Whether a met major the civ isn't at war with is at war with someone else (Lend-lease went from a country at peace
 * in 1941; the first build also asked the giver to be at war, and no lab AI ever met it).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function friendAtWar(ctx, civ) {
  const rel = ctx.relations || [];
  const met = new Set(rel.filter((r) => (r.a === civ.id || r.b === civ.id) && r.level !== "war")
    .map((r) => (r.a === civ.id ? r.b : r.a)));
  return rel.some((r) => r.level === "war" && !(r.a === civ.id || r.b === civ.id)
    && [r.a, r.b].some((id) => met.has(id) && ctx.civ.get(id)?.alive === true));
}

/**
 * The weakest met major a civ isn't friendly with or already fighting: the war a Fascist AI would declare.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @returns {Civ | null}
 */
export function warTarget(ctx, civ) {
  const targets = (ctx.relations || []).filter((r) => (r.a === civ.id || r.b === civ.id)
    && !["unmet", "friendly", "alliance", "war"].includes(String(r.level)))
    .map((r) => ctx.civ.get(r.a === civ.id ? r.b : r.a))
    .filter(/** @returns {other is Civ} */ (other) => !!other && other.alive === true);
  return targets.sort((a, b) => (a.strength ?? 0) - (b.strength ?? 0) || a.id - b.id)[0] || null;
}

/**
 * What a card needs to act on (v5 section 5): routes, the bond market, bond debt, a build to feed, the citizens as
 * lenders, a met major, a friend at war with one's enemy.
 * @type {Record<string, (ctx: TurnContext, civ: Civ) => boolean>}
 */
const NEEDS = {
  routes: (ctx, civ) => routesOf(ctx, civ.id) > 0,
  bond: (ctx, civ) => !ctx.ledger.blocks.some((b) => b.lender === BOND && b.borrower === civ.id),
  bondDebt: (ctx, civ) => ctx.ledger.loans.some((l) => l.borrower === civ.id && l.lender === BOND && isOpen(l)),
  build: (ctx, civ) => (civ.cities || []).some((c) => c.build && c.neededProgress > 0),
  citizens: (ctx, civ) => !ctx.ledger.blocks.some((b) => b.lender === CITIZENS && b.borrower === civ.id),
  metMajor: (ctx, civ) => (ctx.relations || []).some((r) => (r.a === civ.id || r.b === civ.id) && r.level !== "unmet"
    && ctx.civ.get(r.a === civ.id ? r.b : r.a)?.alive === true),
  friendAtWar,
};

/** @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {any} crisis */
function takenBefore(ctx, civ, spec, crisis) {
  const rows = ctx.ledger.crisisTurns.filter((row) => row.pid === civ.id && row.id === `policy:${spec.id}`);
  if (!rows.length) return false;
  if (spec.once === "crisis") return rows.some((row) => row.turn >= (crisis?.since ?? ctx.turn));
  if (spec.once === "age") return rows.some((row) => row.age === ctx.ledger.age);
  return true;
}

/** Whether a path was already awarded in this crisis. @param {TurnContext} ctx @param {Civ} civ @param {any} crisis */
function pathAwarded(ctx, civ, crisis) {
  return (ctx.ledger.pathResults || []).some((row) => row.pid === civ.id && row.crisisSince === crisis.since
    && row.crisis === crisis.kind && (row.outcome === "earned" || row.outcome === "compromised"));
}

/**
 * The checks before the crisis is looked up; a card the civ already runs says so ahead of its other conditions.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 */
function gateRefusal(ctx, civ, spec) {
  if (!crisesOn(ctx)) return "crises-off";
  if (!owns(spec, civ)) return "not-yours";
  if (runningPolicies(ctx.ledger, civ.id).some((row) => row.card === spec.id)) return "running";
  if (ctx.ledgerNearlyFull) return "ledger-full";
  if (!spec.ages.includes(ageKeyOf(ctx.age))) return "age";
  return null;
}

/**
 * What the card needs, then the other cards running.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {any} crisis
 */
function runningRefusal(ctx, civ, spec, crisis) {
  for (const need of spec.needs) if (NEEDS[need] && !NEEDS[need](ctx, civ)) return `needs-${need}`;
  const mine = runningPolicies(ctx.ledger, civ.id);
  const programme = spec.tier === "programme";
  if (programme && mine.some((row) => policyById(row.card)?.tier === "programme")) return "programme-running";
  if (programme && pathAwarded(ctx, civ, crisis)) return "path-awarded";
  if (takenBefore(ctx, civ, spec, crisis)) return "once";
  return null;
}

/** @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec */
function influenceRefusal(ctx, civ, spec) {
  if (civ.influence === null || civ.influence === undefined) return "influence-unread";
  if (civ.influence < priceOf(ctx, civ, spec)) return "influence";
  return null;
}

/**
 * Why a civ can't take a card now, or null.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @returns {string | null}
 */
export function policyRefusal(ctx, civ, spec) {
  const gate = gateRefusal(ctx, civ, spec);
  if (gate) return gate;
  const crisis = crisisFor(ctx, civ, spec);
  if (!crisis) return "no-crisis";
  return runningRefusal(ctx, civ, spec, crisis) || influenceRefusal(ctx, civ, spec);
}

// --- Objectives -----------------------------------------------------------------------------------------------------

/** @typedef {{ parts: { id: string, done: boolean }[], met: boolean }} Objective */
/** @param {{ id: string, done: boolean }[]} parts @returns {Objective} */
const allOf = (parts) => ({ parts, met: parts.every((p) => p.done) });
/** A loan id's sequence number ("L12" is 12). @param {unknown} id */
const loanSeq = (id) => Number(String(id).slice(1));

/**
 * Each path's objective (v6 section 4, v5 section 4), read on the contribution record.
 * @type {Record<string, (ctx: TurnContext, civ: Civ, row: PolicyRow) => Objective>}
 */
const OBJECTIVES = {
  "citizens-republic": (ctx, civ, row) => {
    const c = row.c;
    const loan = ctx.ledger.loans.find((l) => l.id === row.loanId);
    const onSchedule = !!loan && loan.missed === 0 && loan.state !== "default";
    const noOther = !ctx.ledger.loans.some((l) => l.borrower === civ.id && l.lender === CITIZENS && l.id !== row.loanId
      && loanSeq(l.id) >= c.nextId);
    return allOf([{ id: "on-schedule", done: onSchedule }, { id: "no-second-call", done: noOther }]);
  },
  "company-state": (ctx, civ, row) => {
    const c = row.c;
    const loan = ctx.ledger.loans.find((l) => l.id === row.loanId);
    const serviced = !loan || loan.missed === 0;
    const parts = [{ id: "more-routes", done: routesOf(ctx, civ.id) >= c.routes + 1 },
      { id: "funded-production", done: c.added >= 0.25 * c.prod },
      { id: "routes-held", done: c.maxStreak >= holdTurns(ctx, row) }];
    return { parts: [{ id: "loan-serviced", done: serviced }, ...parts],
      met: serviced && parts.filter((p) => p.done).length >= 2 };
  },
  "public-investment": (ctx, civ, row) => {
    const c = row.c;
    return allOf([{ id: "grants-landed", done: !c.cut }, { id: "production", done: c.added >= 0.5 * c.prod },
      { id: "relief-held", done: !c.reliefEnded }]);
  },
  "financial-reform": (ctx, civ, row) => {
    const c = row.c;
    const newLoans = ctx.ledger.loans.some((l) => l.borrower === civ.id && loanSeq(l.id) >= c.nextId
      && l.source !== "policy");
    const shareNow = debtShare(ctx, civ.id);
    return allOf([{ id: "service-down", done: c.share === 0 ? shareNow === 0 : shareNow * 3 <= c.share * 2 },
      { id: "no-default", done: !c.defaulted }, { id: "no-new-loans", done: !newLoans }]);
  },
  "war-economy": (ctx, civ, row) => {
    const c = row.c;
    const income = Math.max(1000, c.inc);
    return allOf([{ id: "war-in-time", done: c.everWar && !row.unmet },
      { id: "debt-bounded", done: (row.debt || 0) <= PR.warDebtIncomeTurns * income },
      { id: "outcome", done: warOutcome(civ, c, holdTurns(ctx, row)) }]);
  },
};

/**
 * How long a hold part asks for: the turns the Programme has run, up to ten. The 2026-11-03 lab's crises lasted five
 * and six turns, and a flat ten could never be met in them.
 * @param {TurnContext} ctx
 * @param {PolicyRow} row
 */
function holdTurns(ctx, row) {
  return Math.max(1, Math.min(PR.warHoldTurns, ctx.turn - row.since));
}

/**
 * The war economy's strategic outcome: a settlement taken and held; or the war over with nothing lost and strength
 * kept; or at war the whole run (up to ten turns) with nothing lost.
 * @param {Civ} civ
 * @param {Record<string, any>} c
 * @param {number} hold
 */
function warOutcome(civ, c, hold) {
  const captured = (civ.cities || []).some((x) => x.loc && !c.locs.includes(x.loc) && x.orig !== civ.id);
  const held = !c.lost && !civ.atWar && (civ.strength ?? 0) >= c.str;
  return captured || (c.everWar && held) || (c.warTurns >= hold && !c.lost);
}

/**
 * Each path's objective, read on the contribution record. Returns the parts and whether enough of them were met.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @returns {Objective}
 */
export function objectiveOf(ctx, civ, spec, row) {
  const judge = spec.path ? OBJECTIVES[spec.path] : undefined;
  return judge ? judge(ctx, civ, row) : { parts: [], met: false };
}

/**
 * Hardship for Partisans, in Happiness points a settlement: 2 for each tenth the civ's own index is under 0.80, up to
 * 6, halved while Relief or New Deal programmes run; and 3 more while Austerity runs, in any crisis and at any index
 * (the owner, 2026-11-03: austerity should make risings likelier). Relief doesn't soften Austerity's share.
 * @param {{ index: number, relief: boolean, austerity: boolean }} q
 */
export function hardshipPoints({ index, relief, austerity }) {
  let points = index < PR.ruinsBp
    ? Math.min(PR.hardshipCap, Math.floor(((PR.ruinsBp - index) / 1000) * PR.hardshipPerTenth)) : 0;
  if (relief) points = Math.floor(points / 2);
  if (austerity) points += PR.austerityHardship;
  return Math.max(0, points);
}

// --- The AI's utility ----------------------------------------------------------------------------------------------

/**
 * A stable jitter in [0, 1) from the civ, its crisis and the card, so a reload decides the same.
 * @param {number} pid
 * @param {number} since
 * @param {string} id
 */
function jitter(pid, since, id) {
  let h = 2166136261 ^ (pid * 16777619) ^ (since * 2654435761);
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** @param {TurnContext} ctx @param {number} pid */
function owedBond(ctx, pid) {
  return ctx.ledger.loans.filter((l) => l.borrower === pid && l.lender === BOND && isOpen(l))
    .reduce((s, l) => s + l.outstanding, 0);
}

/** @typedef {{ ctx: TurnContext, civ: Civ, income: number, depth: number, short: number }} GainQuery */

/**
 * What one effect is worth to the civ, by its type, in Gold-equivalent cents.
 * @type {Record<string, (eff: any, q: GainQuery, spec: Policy) => number>}
 */
const GAINS = {
  loan: (eff, q) => 0.4 * eff.incomeTurns * q.income * q.short,
  grant: (eff, q) => 0.6 * eff.incomeTurns * q.income * q.short,
  // The write-off, less the company's claim on income (3% a turn, counted over twenty turns).
  writeOff: (eff, q) => (eff.pct / 100) * owedBond(q.ctx, q.civ.id) - (PR.claimPctOfIncome / 100) * q.income * 20,
  responses: (eff, q) => 3 * q.income * q.depth,
  routeProduction: (eff, q) => 3 * q.income * q.depth,
  terms: (eff, q) => (eff.terms.capTurns ? 2 * q.income * q.depth : 0),
  militaryProduction: (eff, q) => (q.civ.atWar ? 4 : 1) * q.income,
  // Public support is worth more the deeper the Depression (the 2026-11-03 grid: at a flat half turn of income Land
  // reform never beat holding its Influence); the Gold a card pays out per settlement is its cost over the run.
  support: (eff, q) => (eff.perSettlement > 0 ? q.income * q.depth : 0),
  goldPerSettlement: (eff, q, spec) => -eff.cents * Math.max(1, (q.civ.cities || []).length)
    * (typeof spec.runs === "number" ? spec.runs : PR.minTurns),
  confidence: (eff, q) => 2 * q.income * q.depth,
  highTariff: (eff, q) => (q.ctx.trade.some((r) => r.payer === q.civ.id && r.cents > 0) ? q.income : 0),
  aid: (eff, q) => (friendAtWar(q.ctx, q.civ) ? q.income : 0),
};

/**
 * How deep the civ's Depression is and whether its treasury is short, for the gains.
 * @param {TurnContext} ctx @param {Civ} civ @param {number} income
 * @returns {GainQuery}
 */
function gainQuery(ctx, civ, income) {
  const depth = Math.max(0, PR.ruinsBp + 1500 - indexOf(ctx, civ.id)) / 1000;
  return { ctx, civ, income, depth, short: funds(ctx.batch, civ.id) < 5 * income ? 2 : 1 };
}

/** @param {GainQuery} q @param {Policy} spec */
function gainOf(q, spec) {
  let gain = 0;
  for (const eff of spec.effects) gain += GAINS[eff.type] ? GAINS[eff.type](eff, q, spec) : 0;
  return gain;
}

/**
 * Lottery loan turns on a missed payment, not on the index: the risk is a treasury too thin to pay it, or ten turns
 * of income already owed (the turn's payments aren't planned yet when the AI chooses).
 * @param {TurnContext} ctx @param {Civ} civ @param {number} income
 */
function missRisk(ctx, civ, income) {
  const owed = ctx.ledger.loans.filter((l) => l.borrower === civ.id && isOpen(l))
    .reduce((sum, l) => sum + (l.outstanding || 0), 0);
  return income * (funds(ctx.batch, civ.id) < 2 * income || owed > 10 * income ? 8 : 0.5);
}

/**
 * Where the index will stand when the Gamble is tested: today's (at least 0.80 for a test at the crisis's end, where
 * a Depression ends), drifting back a tenth of the gap a turn, plus the card's own lift.
 * @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec
 */
function projectedIndex(ctx, civ, spec) {
  const now = indexOf(ctx, civ.id);
  const lift = spec.effects.find((e) => e.type === "confidence");
  let idx = (spec.turns?.when === "indexUnderAtCrisisEnd" ? Math.max(now, PR.ruinsBp) : now)
    + (lift && lift.type === "confidence" ? lift.bp : 0);
  for (let i = 0; i < (spec.turns?.after ?? 5); i += 1) idx += Math.round((10000 - idx) / 10);
  return idx;
}

/**
 * The Gamble's risk in cents. A test it would fail weighs the whole turning price; one it would pass, a little (the
 * 2026-11-03 lab: four of five AIs took The assembly speaks at 0.70 and all four turned).
 * @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {number} income
 */
function riskOf(ctx, civ, spec, income) {
  if (spec.tier !== "gamble") return 0;
  if (spec.turns?.when === "missOnLoan") return missRisk(ctx, civ, income);
  return income * (projectedIndex(ctx, civ, spec) < (spec.turns?.bp ?? PR.gambleTestBp) ? 8 : 0.5);
}

/**
 * The AI's utility for a card in Gold-equivalent cents (v3 section 7): what it would bring against the civ's
 * actual problem, less its Influence, administration and risk, with a reserve rule for Programmes.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 */
export function utilityOf(ctx, civ, spec) {
  const income = Math.max(1000, civ.incomeCents);
  const cost = costOf(ctx, civ, spec, income);
  const gain = gainOf(gainQuery(ctx, civ, income), spec);
  // A Programme's institution, if it's earned, counts for four turns of income (v4: the legacy is the point).
  const institution = spec.tier === "programme" ? 4 * income : 0;
  let u = gain + institution - cost.admin - cost.influenceCents - riskOf(ctx, civ, spec, income);
  if (spec.warWithin && civ.atWar !== true) u -= warCost(ctx, civ) * income;
  if (spec.tier === "programme" && !cost.reserved) return -Infinity;
  return u * (0.9 + 0.2 * jitter(civ.id, crisisFor(ctx, civ, spec)?.since ?? 0, spec.id));
}

/**
 * What starting a war costs a civ at peace, in turns of income: four, or one for a state at least half again as
 * strong as the weakest rival it would declare on (the Fascist cards push a strong state toward conflict).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function warCost(ctx, civ) {
  const target = warTarget(ctx, civ);
  if (!target) return 4;
  return (civ.strength ?? 0) * 2 >= (target.strength ?? 0) * 3 && (civ.strength ?? 0) > 0 ? 1 : 4;
}

/**
 * A card's costs to the AI over its minimum run: administration in cents, its Influence valued dearer when the civ
 * holds little, and whether the civ has the reserve a Programme needs.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {number} income
 */
function costOf(ctx, civ, spec, income) {
  const price = priceOf(ctx, civ, spec);
  const stock = civ.influence ?? 0;
  // An Influence point is worth a twentieth of a turn's income to the civ (about half a turn of income for a turn of
  // a civ's usual 10 Influence), three times that when the price would take most of what it holds. A flat Gold a
  // point (the first build) priced every Programme out for an Antiquity civ earning 6 to 9 Gold (lab, 2026-11-03).
  const infValue = Math.round((income / 20) * (stock < price * 2 ? 3 : 1));
  const minTurns = spec.minTurns ?? PR.minTurns;
  const admin = spec.adminPct ? (spec.adminPct * income * minTurns) / 100 : 0;
  const upkeepInf = (spec.perTurnInfluence ?? 0) * minTurns;
  const reserve = funds(ctx.batch, civ.id) + 0.8 * income * minTurns;
  // A card with a per-turn price also needs the Influence to keep coming (hard-times plan v2, Part 2).
  const forecast = !spec.perTurnInfluence || influenceForecast(ctx, civ.id, spec.perTurnInfluence);
  return { admin, influenceCents: (price + upkeepInf) * infValue,
    reserved: !(reserve < admin * 1.25 || stock < price + upkeepInf) && forecast };
}

// --- The AI's choice in arrears (hard-times plan v2, Part 2) --------------------------------------------------------

/**
 * The figures the AI's arrears choice weighs. A rising costs four turns of income for any government, spread over the
 * ten turns of misery it takes to build one, so a settlement a turn under pressure costs a tenth of that. A Public
 * support point a settlement is valued like an Influence point, a twentieth of a turn's income. The "If ended early"
 * mark is worth a turn of income.
 */
const ARREARS_AI = { fascistWarPct: 150, risingIncomeTurns: 4, risingBuildTurns: 10, markIncomeTurns: 1,
  supportDiv: 20, forecastTurns: 5, forecastNeed: 3 };

/** Effects paid once, the turn the card was taken: one more turn of the card adds nothing of theirs. */
const ONE_OFF = new Set(["loan", "grant", "writeOff"]);

/**
 * Whether the AI expects to pay a per-turn Influence price again soon: its stock grew by at least the price on most
 * (three) of the last five turns, so a one-time gain doesn't count. Read on the ledger's Influence log.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} perTurn
 */
export function influenceForecast(ctx, pid, perTurn) {
  const stocks = (ctx.ledger.influenceLog || []).find((row) => row.pid === pid)?.stocks || [];
  let grew = 0;
  for (let i = Math.max(1, stocks.length - ARREARS_AI.forecastTurns); i < stocks.length; i += 1) {
    if (stocks[i] - stocks[i - 1] >= perTurn) grew += 1;
  }
  return grew >= ARREARS_AI.forecastNeed;
}

/**
 * Settlements under pressure from Partisans' hard-times shares (hard-times plan v2, Part 1), worked out here because
 * Economics can't read Partisans: the Depression's, Austerity's and the arrears' shares together, with the minimum
 * of one; the hold is left out.
 * @param {{ depression: number, depressionTurns: number, strain: number, arrearsPoints: number, n: number }} q
 *   n: the civ's non-capital settlements
 */
export function underPressure({ depression, depressionTurns, strain, arrearsPoints, n }) {
  if (n <= 0) return 0;
  const d = Math.max(0, depression) / 40;
  const a = strain <= 4 ? 0 : Math.min(0.8, 0.8 * ((strain - 4) / 10) ** 2);
  const r = Math.min(0.3, 0.05 * Math.max(0, arrearsPoints));
  const k = Math.round((1 - (1 - d) * (1 - a) * (1 - r)) * n);
  const floor = a > 0 || r > 0 || (depression >= 4 && depressionTurns >= 10) ? 1 : 0;
  return Math.min(n, Math.max(k, floor));
}

/**
 * The risings keeping the card makes likelier: the settlements its arrears points put under pressure beyond what
 * ending it leaves, times a rising's cost a turn. The same for every government.
 * @param {TurnContext} ctx @param {Civ} civ @param {PolicyRow} row @param {number} income
 */
function risingCost(ctx, civ, row, income) {
  const n = Math.max(0, (civ.cities || []).length - 1);
  const ht = (ctx.ledger.hardTimes || []).find((x) => x.pid === civ.id);
  const relief = standingResponses(ctx.ledger, civ.id).some((x) => x.id === "relief")
    || runningPolicies(ctx.ledger, civ.id).some((x) => x.card === "new-deal");
  const base = { depression: hardshipPoints({ index: indexOf(ctx, civ.id), relief, austerity: false }),
    depressionTurns: ht && ht.depSince !== null ? ctx.turn - ht.depSince + 1 : 0, strain: ht?.strain ?? 0, n };
  const more = underPressure({ ...base, arrearsPoints: row.arrearsPoints || 0 })
    - underPressure({ ...base, arrearsPoints: 0 });
  return (more * income * ARREARS_AI.risingIncomeTurns) / ARREARS_AI.risingBuildTurns;
}

/**
 * One more turn of the card's standing effects, at the value its card choice uses spread over its minimum run. A
 * Fascist state at war values Diversionary war's military production at half again; borrowed upkeep is a turn of
 * upkeep the bond market pays while at war.
 * @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {number} income
 */
function turnValue(ctx, civ, spec, income) {
  const q = gainQuery(ctx, civ, income);
  const runs = spec.minTurns ?? PR.minTurns;
  return spec.effects.reduce((sum, eff) => sum + effectTurn(q, spec, eff, runs), 0);
}

/**
 * One effect's turn, as turnValue weighs it.
 * @param {GainQuery} q @param {Policy} spec @param {any} eff @param {number} runs
 */
function effectTurn(q, spec, eff, runs) {
  const atWar = q.civ.atWar === true;
  if (ONE_OFF.has(eff.type)) return 0;
  if (eff.type === "borrowedUpkeep") return atWar ? Math.max(0, q.civ.upkeepCents ?? 0) : 0;
  const v = GAINS[eff.type] ? GAINS[eff.type](eff, q, spec) / runs : 0;
  const fascistWar = eff.type === "militaryProduction" && atWar && q.civ.ideology === "IDEOLOGY_FASCISM";
  return fascistWar ? (v * ARREARS_AI.fascistWarPct) / 100 : v;
}

/**
 * Whether a path's objective would be met with these parts: the company state's needs the loan serviced and two of
 * the other three; every other path needs them all (objectiveOf's own rules).
 * @param {Policy} spec @param {{ id: string, done: boolean }[]} parts
 */
function enough(spec, parts) {
  if (spec.path !== "company-state") return parts.every((p) => p.done);
  return parts[0].done && parts.slice(1).filter((p) => p.done).length >= 2;
}

/** Production added at the rate so far reaches a share of production at Commit within `left` turns. */
const productionReach = (/** @type {TurnContext} */ ctx, /** @type {PolicyRow} */ row, /** @type {number} */ left,
  /** @type {number} */ share) => {
  const rate = (row.c.added || 0) / Math.max(1, ctx.turn - row.since);
  return (row.c.added || 0) + rate * left >= share * (row.c.prod || 0);
};

/** A hold part (routes held, at war the run) can still reach the turns it will ask for. */
const holdReach = (/** @type {TurnContext} */ ctx, /** @type {PolicyRow} */ row, /** @type {number} */ have,
  /** @type {number} */ left) => have + left >= Math.min(PR.warHoldTurns, ctx.turn - row.since + left);

/**
 * Whether an open goal part can still be met in `left` turns. A part not listed (a missed payment, a cut, a default,
 * a second call, a new loan, debt past its bound) can't be undone.
 * @type {Record<string, (ctx: TurnContext, civ: Civ, row: PolicyRow, left: number) => boolean>}
 */
const REACH = {
  "more-routes": () => true,
  "funded-production": (ctx, civ, row, left) => productionReach(ctx, row, left, 0.25),
  "routes-held": (ctx, civ, row, left) => holdReach(ctx, row, row.c.streak || 0, left),
  production: (ctx, civ, row, left) => productionReach(ctx, row, left, 0.5),
  // Service falls as loans run out: what's owed on loans still running after `left` turns, against today's.
  "service-down": (ctx, civ, row, left) => {
    const open = ctx.ledger.loans.filter((l) => l.borrower === civ.id && isOpen(l));
    const owed = open.reduce((s, l) => s + l.outstanding, 0);
    const after = open.filter((l) => l.term - l.paid > left).reduce((s, l) => s + l.outstanding, 0);
    const share = owed > 0 ? (debtShare(ctx, civ.id) * after) / owed : 0;
    return row.c.share === 0 ? share === 0 : share * 3 <= row.c.share * 2;
  },
  "war-in-time": (ctx, civ) => civ.atWar === true || warTarget(ctx, civ) !== null,
  outcome: (ctx, civ, row, left) => !row.c.lost && (civ.atWar === true || warTarget(ctx, civ) !== null)
    && holdReach(ctx, row, row.c.warTurns || 0, left),
};

/**
 * The institution's value (four turns of income) times the share of goal parts met, counted only while the open
 * parts can still be met in the turns left: the grace the card has if it stays short, this turn included.
 * @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec @param {PolicyRow} row @param {number} income
 */
function goalValue(ctx, civ, spec, row, income) {
  const { parts } = objectiveOf(ctx, civ, spec, row);
  if (!parts.length) return 0;
  const left = Math.max(1, PR.arrearsGrace - (row.arrearsRun || 0) + 1);
  const reach = parts.map((p) => ({ id: p.id, done: p.done || (REACH[p.id]?.(ctx, civ, row, left) ?? false) }));
  if (!enough(spec, reach)) return 0;
  return (4 * income * parts.filter((p) => p.done).length) / parts.length;
}

/**
 * What keeping a Programme that's short this turn is worth to an AI against ending it (0), in Gold-equivalent cents
 * (hard-times plan v2, Part 2, "The AI's choice"): a turn of its effects, the institution's share while the goal can
 * still be met, the early mark ending would leave (counted only when the AI expects to pay again, since a card that
 * stays short ends anyway), less this turn's and next turn's charge and Public support and the likelier risings.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {{ cents: number, support: number, nextCents: number }} charge
 */
export function keepValue(ctx, civ, spec, row, charge) {
  const income = Math.max(1000, civ.incomeCents);
  const abandoned = spec.legacies.abandoned;
  const mark = abandoned && abandoned.turns !== 0 && influenceForecast(ctx, civ.id, spec.perTurnInfluence ?? 0)
    ? ARREARS_AI.markIncomeTurns * income : 0;
  const support = (2 * charge.support * settlementsOf(civ) * income) / ARREARS_AI.supportDiv;
  return turnValue(ctx, civ, spec, income) + goalValue(ctx, civ, spec, row, income) + mark
    + upkeepLoanCost(ctx, civ, spec, row) - charge.cents - charge.nextCents - support
    - risingCost(ctx, civ, row, income);
}

/**
 * What ending mid-war adds to the borrowed upkeep: it becomes a bond loan at 1.25 times the rate, so the extra
 * quarter of the interest over its 10 turns is a cost that keeping the card avoids.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 */
function upkeepLoanCost(ctx, civ, spec, row) {
  const borrows = spec.effects.some((e) => e.type === "borrowedUpkeep");
  if (civ.atWar !== true || !((row.debt || 0) > 0) || !borrows) return 0;
  return Math.round(((row.debt || 0) * bondRate(ctx, civ.id) * 25 * 10) / (100 * 1e6));
}

/**
 * Whether an AI keeps a Programme that's short this turn, before the charge.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Policy} spec
 * @param {PolicyRow} row
 * @param {{ cents: number, support: number, nextCents: number }} charge
 */
export function keepOrEnd(ctx, civ, spec, row, charge) {
  return keepValue(ctx, civ, spec, row, charge) > 0;
}

// --- The view -------------------------------------------------------------------------------------------------------

/** One of the civ's cards as the panel shows it. @param {TurnContext} ctx @param {Civ} civ @param {Policy} spec */
function cardView(ctx, civ, spec) {
  const ideological = !!civ.ideology && (spec.owners.ideology || []).includes(String(civ.ideology));
  return { id: spec.id, tier: spec.tier, path: spec.path ?? null, price: priceOf(ctx, civ, spec),
    perTurn: spec.perTurnInfluence ?? 0,
    adminCents: spec.adminPct ? Math.round((Math.max(0, civ.incomeCents) * spec.adminPct) / 100) : 0,
    refusal: policyRefusal(ctx, civ, spec), owner: ideological ? civ.ideology : civ.government,
    stock: civ.influence ?? null };
}

/** A running card as the panel shows it. @param {TurnContext} ctx @param {Civ} civ @param {PolicyRow} row */
function runningView(ctx, civ, row) {
  const spec = /** @type {Policy} */ (policyById(row.card));
  const min = spec.minTurns ?? PR.minTurns;
  const turns = ctx.turn - row.since;
  const objective = objectiveOf(ctx, civ, spec, row);
  return { id: row.card, tier: spec.tier, path: spec.path ?? null, state: row.state, turns,
    minLeft: Math.max(0, min - turns), left: row.until === null ? null : Math.max(0, row.until - ctx.turn),
    crisisOpen: crisisOpen(ctx, row), parts: objective.parts, met: objective.met, unmet: row.unmet === true,
    warBy: row.warBy ? Math.max(0, row.warBy - ctx.turn) : null, debtCents: row.debt || 0, added: row.c.added };
}

/**
 * What the crisis panel shows of the paths for one civ: its own cards with price and refusal, the running ones with
 * their state, turns, minimum, objective parts and whether the outcome is still provisional, its drift.
 * @param {TurnContext} ctx
 * @param {number} me
 */
export function policyView(ctx, me) {
  const civ = ctx.civ.get(me);
  if (!civ || !crisesOn(ctx)) return { cards: [], running: [], drift: {}, results: [] };
  const cards = cardsFor(ctx, civ).map((spec) => cardView(ctx, civ, spec));
  const running = runningPolicies(ctx.ledger, me).map((row) => runningView(ctx, civ, row));
  const steps = (ctx.ledger.affinity || []).find((x) => x.pid === me)?.steps || {};
  const results = (ctx.ledger.pathResults || []).filter((x) => x.pid === me);
  return { cards, running, drift: steps, results };
}
