// econ-arrears.js - Economics: Programmes in arrears and hard times for Partisans (Partisans'
// docs/HARD-TIMES-PLAN-v2.md, Parts 1 and 2). A Programme the civ can't pay for in a turn keeps running for up to
// three turns short, its shortfall bought with Gold at a premium that rises with each lapse, and costs Public
// support; the fourth turn short in a row, or the sixth lapse, ends it. `hardTimesRows` gives Partisans each civ's
// Depression, Austerity strain and arrears. Nothing here reads the engine.

import { POLICY_RULES as PR } from "./econ-policy-catalog.js";
import { crisesOn, settlementsOf, standingResponses } from "./econ-crisis-rows.js";
import { CYCLE } from "./econ-params.js";
import { emit, event, notice } from "./econ-turn.js";
import { payable } from "./econ-batch.js";
import { hardshipPoints, indexOf, keepOrEnd, runningPolicies } from "./econ-policy-read.js";

/** @typedef {import("./econ-policy-catalog.js").Policy} Policy */
/** @typedef {import("./econ-policy-read.js").PolicyRow} PolicyRow */

/** The text keys naming the crisis paths' lines in a ledger, each with the card's name as its argument. */
export const LEDGER_LABELS = { administration: "LOC_ECONOMICS_LEDGER_ADMINISTRATION",
  arrears: "LOC_ECONOMICS_LEDGER_ARREARS" };

/** A card's name key, as econ-notice-text.js builds it. @param {string} id */
export const policyNameKey = (id) => `LOC_ECONOMICS_POLICY_${id.toUpperCase().replace(/-/g, "_")}_NAME`;

/** @param {TurnContext} ctx @param {number} pid @param {number} wanted */
// An arrears charge is a due, so it can take the treasury into its overdraft (DESIGN 4.18).
const within = (ctx, pid, wanted) => Math.min(wanted, Math.max(0, payable(ctx.batch, pid)));

/**
 * What a turn short costs in Gold, in cents: the unpaid Influence at a twentieth of the income at Commit (a Gold a
 * point at least) plus the unpaid administration Gold, times the premium for the lapse points.
 * @param {PolicyRow} row
 * @param {number} unpaidInfluence
 * @param {number} unpaidGold cents
 * @param {number} points
 */
export function arrearsCharge(row, unpaidInfluence, unpaidGold, points) {
  const perPoint = Math.max(100, Math.round(Math.max(0, row.c.inc ?? 0) / PR.arrearsInfluenceDiv));
  const shortfall = unpaidInfluence * perPoint + Math.max(0, unpaidGold);
  return Math.round(shortfall * PR.arrearsPremium ** Math.max(0, points - 1));
}

/** A turn paid in full: the run clears, and every third paid turn in a row a lapse point. @param {PolicyRow} row */
function paidTurn(row) {
  row.arrearsRun = 0;
  row.paidRun = (row.arrearsPoints || 0) > 0 ? (row.paidRun || 0) + 1 : 0;
  if (row.paidRun >= PR.arrearsClearTurns) { row.arrearsPoints = (row.arrearsPoints || 0) - 1; row.paidRun = 0; }
}

/**
 * A Programme's arrears this turn: a turn short adds to both counts, charges the shortfall at the premium in Gold
 * from the treasury, and costs Public support. The fourth turn in a row short, or the sixth point, ends the card
 * instead (its "If ended early" mark). The AI weighs keeping it first.
 * @param {TurnContext} ctx
 * @param {{ civ: Civ, spec: Policy, row: PolicyRow }} card
 * @param {number} unpaidInfluence
 * @param {number} unpaidGold cents
 */
export function arrears(ctx, { civ, spec, row }, unpaidInfluence, unpaidGold) {
  if (row.arrearsTurn === ctx.turn) return;
  row.arrearsTurn = ctx.turn;
  if (unpaidInfluence <= 0 && unpaidGold <= 0) { paidTurn(row); return; }
  if (shortTurn(row)) return;
  const cents = arrearsCharge(row, unpaidInfluence, unpaidGold, row.arrearsPoints ?? 0);
  const nextCents = arrearsCharge(row, unpaidInfluence, unpaidGold, (row.arrearsPoints ?? 0) + 1);
  if (civ.human !== true && !keepOrEnd(ctx, civ, spec, row, { cents, support: 1, nextCents })) {
    row.c.breach = "arrears-ended";
    return;
  }
  chargeArrears(ctx, { civ, spec, row }, { cents, nextCents }, unpaidInfluence > 0);
}

/** A turn short: both counts up; true when it's the fourth in a row or the sixth point, which ends the card. */
function shortTurn(/** @type {PolicyRow} */ row) {
  row.paidRun = 0;
  row.arrearsRun = (row.arrearsRun || 0) + 1;
  row.arrearsPoints = (row.arrearsPoints || 0) + 1;
  if (row.arrearsRun <= PR.arrearsGrace && row.arrearsPoints < PR.arrearsPointsMax) return false;
  row.c.breach = "arrears";
  return true;
}

/**
 * The turn's charge from the treasury (its overdraft included, never a loan), and its Public support: 1 a
 * settlement, 2 when the treasury can't cover the Gold; the notice on the first turn short and the last of grace.
 * @param {TurnContext} ctx
 * @param {{ civ: Civ, spec: Policy, row: PolicyRow }} card
 * @param {{ cents: number, nextCents: number }} charge
 * @param {boolean} influence whether the turn was short of Influence (else of Gold)
 */
function chargeArrears(ctx, { civ, spec, row }, { cents, nextCents }, influence) {
  const paid = within(ctx, civ.id, cents);
  if (paid > 0) {
    emit(ctx, { id: `PLR${row.rid}` }, { from: civ.id, to: CYCLE, cents: paid, reason: "arrears",
      label: LEDGER_LABELS.arrears, labelArgs: [policyNameKey(spec.id)] });
  }
  const support = Math.min(PR.arrearsSupportMax, paid < cents ? 2 : 1);
  ctx.out.celebration.push({ pid: civ.id, amount: -100 * support * settlementsOf(civ), reason: "arrears" });
  Object.assign(row.c, { arrearsCents: (row.c.arrearsCents || 0) + paid, lastArrearsCents: paid,
    lastArrearsSupport: support, nextArrearsCents: nextCents });
  const run = row.arrearsRun ?? 0;
  event(ctx, { kind: "policy-arrears", pid: civ.id, policy: spec.id, run, points: row.arrearsPoints, cents: paid,
    support });
  if (run === 1 || run === PR.arrearsGrace) {
    notice(ctx, civ.id, { kind: "policy-arrears", policy: spec.id, run, turnsLeft: PR.arrearsGrace - run,
      influence });
  }
}

/**
 * One civ's strain and Depression start, moved once a turn with every missed turn counted.
 * @param {TurnContext} ctx
 * @param {HardTimesRow[]} rows
 * @param {number} pid
 * @param {{ austerity: boolean, depressed: boolean }} now
 */
function stepHardTimes(ctx, rows, pid, { austerity, depressed }) {
  let row = rows.find((x) => x.pid === pid);
  if (!row) { row = { pid, strain: 0, depSince: null, turn: ctx.turn - 1 }; rows.push(row); }
  const steps = Math.max(0, ctx.turn - row.turn);
  if (steps > 0) {
    row.strain = austerity ? row.strain + PR.strainUp * steps : Math.max(0, row.strain - PR.strainDown * steps);
    row.turn = ctx.turn;
  }
  if (!depressed) row.depSince = null;
  else if (row.depSince === null) row.depSince = ctx.turn;
  return row;
}

/**
 * One living civ's hard times: the Depression's points (relief halves them, Austerity adds nothing), how long the
 * index has been under 0.80, the Austerity strain and the running Programme's arrears points; null when all are 0.
 * @param {TurnContext} ctx
 * @param {HardTimesRow[]} rows
 * @param {Civ} civ
 * @returns {HardTimes | null}
 */
function hardTimesOf(ctx, rows, civ) {
  const responses = standingResponses(ctx.ledger, civ.id);
  const running = runningPolicies(ctx.ledger, civ.id);
  const austerity = responses.some((x) => x.id === "austerity");
  const index = indexOf(ctx, civ.id);
  const relief = responses.some((x) => x.id === "relief") || running.some((x) => x.card === "new-deal");
  const depression = hardshipPoints({ index, relief, austerity: false });
  const depressed = hardshipPoints({ index, relief: false, austerity: false }) > 0;
  const row = stepHardTimes(ctx, rows, civ.id, { austerity, depressed });
  const arrearsPoints = Math.max(0, ...running.map((x) => x.arrearsPoints || 0));
  if (!depressed && row.strain === 0 && !austerity && arrearsPoints === 0) return null;
  return { depression, depressionTurns: row.depSince === null ? 0 : ctx.turn - row.depSince + 1,
    austerityStrain: row.strain, austerityRunning: austerity, arrearsPoints };
}

/**
 * Each living civ's hard times this turn, for Partisans (`__towerEconomics.hardTimes`, hard-times plan v2, Part 1).
 * @param {TurnContext} ctx
 * @returns {Record<string, HardTimes>}
 */
export function hardTimesRows(ctx) {
  /** @type {Record<string, HardTimes>} */
  const out = {};
  if (!crisesOn(ctx)) return out;
  const rows = ctx.ledger.hardTimes || [];
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const ht = hardTimesOf(ctx, rows, civ);
    if (ht) out[String(civ.id)] = ht;
  }
  ctx.ledger.hardTimes = rows.filter((x) => x.strain > 0 || x.depSince !== null);
  return out;
}
