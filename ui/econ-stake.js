// econ-stake.js - Economics: what one AI has at stake in another civ (AI-PLAN 4.5), from the native signals the
// glue reads once a turn into the relation rows: the relationship level, the trade routes between them, an alliance,
// a shared enemy at war, the distance between capitals, the AI's own agenda rows toward the host, whether the host's
// income is growing, hostility, and the host's credit reputation. The score sets what the AI invests in, who it
// aids and whom it lends to. Nothing here moves Gold or reads the engine.

import { STAKE } from "./econ-params.js";
import { creditRepOf } from "./econ-credit.js";
import { amendsRecord, relationLevel } from "./econ-lenders.js";
import { isIncomeGrowing } from "./econ-markets.js";

/**
 * The relation row between two civs, whichever way round it was read.
 * @param {Relation[]} relations
 * @param {number} a
 * @param {number} b
 */
export function relationRow(relations, a, b) {
  return relations.find((row) => (row.a === a && row.b === b) || (row.a === b && row.b === a)) || null;
}

/**
 * A relationship level as a number: the row's own reading when the glue has it, else a stand-in by level name at
 * the middle of the game's band (Friendly 30 to 60, Unfriendly -60 to -30, war read as Hostile's top).
 * @param {Relation | null} row
 * @param {RelationLevel} level
 */
export function levelNumber(row, level) {
  if (row && Number.isFinite(row.levelNum)) return /** @type {number} */ (row.levelNum);
  return { war: -60, unfriendly: -45, neutral: 0, friendly: 45, unmet: 0 }[level] ?? 0;
}

/**
 * The Friendly line and the top of Hostile for this game: the engine's bands when the session read them
 * (relationshipBands in econ-params.js), else STAKE's numbers.
 * @param {TurnContext} ctx
 */
export function bandsOf(ctx) {
  const params = ctx.params || {};
  return { friendlyLevel: Number.isFinite(params.friendlyLevel) ? /** @type {number} */ (params.friendlyLevel)
    : STAKE.friendlyLevel, hostileLevel: Number.isFinite(params.hostileLevel)
    ? /** @type {number} */ (params.hostileLevel) : STAKE.hostileLevel };
}

/**
 * The AI's own agenda rows toward the host, as the engine scored them: the row holds each side's sum.
 * @param {Relation | null} row
 * @param {number} ai
 */
function agendaToward(row, ai) {
  if (!row) return 0;
  const value = row.a === ai ? row.agendaAB : row.agendaBA;
  return Number.isFinite(value) ? /** @type {number} */ (value) : 0;
}

/**
 * The stake score from plain facts (AI-PLAN 4.5):
 *   level / 3, + 3 per route (at most 9), + 6 allied, + 4 sharing an enemy at war, + 3 for capitals within 20
 *   plots, + the AI's agenda rows toward the host / 2, + 3 if the host's income is growing, - 6 if the host is
 *   hostile to the AI or at war with an ally of it, - the host's reputation shortfall / 10.
 * @param {{ levelNum: number, routes: number, allied: boolean, sharedEnemy: boolean, distance: number | null,
 *   agenda: number, growing: boolean, hostile: boolean, repPoints: number }} f
 */
export function stakeOf(f) {
  let stake = f.levelNum / STAKE.levelDiv;
  stake += Math.min(STAKE.routesMax, STAKE.perRoute * Math.max(0, f.routes));
  if (f.allied) stake += STAKE.allied;
  if (f.sharedEnemy) stake += STAKE.sharedEnemy;
  if (f.distance !== null && f.distance <= STAKE.neighbourPlots) stake += STAKE.neighbour;
  stake += f.agenda / STAKE.agendaDiv;
  if (f.growing) stake += STAKE.growing;
  if (f.hostile) stake += STAKE.hostile;
  stake -= Math.max(0, 100 - f.repPoints) / STAKE.repDiv;
  return Math.round(stake * 10) / 10;
}

/**
 * Whether `host` is at war with a civ `ai` is allied with, or hostile to `ai` itself.
 * @param {TurnContext} ctx
 * @param {number} ai
 * @param {number} host
 */
function hostileTo(ctx, ai, host) {
  const row = relationRow(ctx.relations, ai, host);
  const level = relationLevel(ctx.relations, ai, host);
  if (level === "unfriendly" && levelNumber(row, level) <= bandsOf(ctx).hostileLevel) return true;
  for (const other of ctx.civs) {
    if (other.id === ai || other.id === host || other.alive !== true) continue;
    const allied = relationRow(ctx.relations, ai, other.id)?.allied === true;
    if (allied && relationLevel(ctx.relations, host, other.id) === "war") return true;
  }
  return false;
}

/**
 * Whether the two are both at war with some third civ.
 * @param {TurnContext} ctx
 * @param {number} ai
 * @param {number} host
 */
function sharedEnemy(ctx, ai, host) {
  for (const other of ctx.civs) {
    if (other.id === ai || other.id === host || other.alive !== true) continue;
    if (relationLevel(ctx.relations, ai, other.id) === "war" && relationLevel(ctx.relations, host, other.id) === "war") {
      return true;
    }
  }
  return false;
}

/**
 * The facts behind one AI's stake in a host, from the turn's rows.
 * @param {TurnContext} ctx
 * @param {number} ai
 * @param {number} host
 */
export function stakeFacts(ctx, ai, host) {
  const row = relationRow(ctx.relations, ai, host);
  const level = relationLevel(ctx.relations, ai, host);
  return { levelNum: levelNumber(row, level), routes: row?.routes ?? 0, allied: row?.allied === true,
    sharedEnemy: sharedEnemy(ctx, ai, host),
    distance: Number.isFinite(row?.distance) ? /** @type {number} */ (row?.distance) : null,
    agenda: agendaToward(row, ai), growing: isIncomeGrowing(ctx.markets.incomes, host),
    hostile: hostileTo(ctx, ai, host), repPoints: creditRepOf(ctx.ledger, host, ctx.turn) / 100 };
}

/**
 * One AI's stake in a host this turn, read once per pair (the cache lives in the turn context).
 * @param {TurnContext} ctx
 * @param {number} ai
 * @param {number} host
 */
export function stakeFor(ctx, ai, host) {
  const key = `${ai}:${host}`;
  const cached = ctx.stakes.get(key);
  if (cached !== undefined) return cached;
  const stake = stakeOf(stakeFacts(ctx, ai, host));
  ctx.stakes.set(key, stake);
  return stake;
}

/**
 * AI-PLAN 4.5: an AI lends to a civ whose credit reputation is 50 or more and in which its stake is 0 or more.
 * @param {TurnContext} ctx
 * @param {number} lender
 * @param {number} borrower
 */
export function lenderGate(ctx, lender, borrower) {
  // A lender the borrower repudiated and hasn't been made good to lends it an amends loan whatever its reputation and
  // its stake: the repudiation is what put both there, and the loan's 1.5 times rate is the price of the risk (DESIGN
  // 4.5; lab 2026-11-10, the seat 10 turns after repudiating Persia had reputation 41 and Persia's stake -16.9).
  if (amendsRecord(ctx.ledger, borrower, lender, ctx.turn) !== null) return true;
  if (creditRepOf(ctx.ledger, borrower, ctx.turn) < STAKE.lendRepMin * 100) return false;
  return stakeFor(ctx, lender, borrower) >= STAKE.lendStakeMin;
}
