// econ-invest-open.js - Economics: opening a development loan, a general investment or aid inside the turn batch
// (DESIGN 4.12, 4.14 step 2), for the player's request, an accepted AI offer and the AI rules alike, so every side
// runs through the same checks. A development loan's Gold goes to the progress account and lands as addProgress on
// the city's current build; general and aid as Gold go to the host. Nothing here reads the engine.

import { PROGRESS } from "./econ-params.js";
import { investId, isInvestKind, makeInvestment, progressFor, relationAllows, relationshipGain, tenthsFor }
  from "./econ-invest.js";
import { activeDefaults } from "./econ-credit.js";
import { isBlocked, relationLevel } from "./econ-lenders.js";
import { hasStage } from "./econ-stages.js";
import { funds } from "./econ-batch.js";
import { emit, event, incomeOf, isAlive, isHuman, notice } from "./econ-turn.js";

/**
 * @typedef {{ investor: number, host: number, form: InvestKind, cents: number, cityId: string | null,
 *   asAid: boolean }} InvestSpec
 */

/** The stage each kind needs on both sides; aid needs none (DESIGN 4.12, 4.15). */
const STAGE_FOR = { project: "guildPatronage", general: "charteredCompanies" };

/**
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
function cityFor(ctx, spec) {
  return (ctx.civ.get(spec.host)?.cities || []).find((city) => city.id === spec.cityId) || null;
}

/**
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
function areParties(ctx, spec) {
  return Number.isInteger(spec.investor) && Number.isInteger(spec.host) && spec.investor !== spec.host
    && isAlive(ctx, spec.investor) && isAlive(ctx, spec.host);
}

/**
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
function partiesRefusal(ctx, spec) {
  if (!ctx.options.investment) return "investment-off";
  if (!areParties(ctx, spec)) return "parties";
  if (!isInvestKind(spec.form) || !Number.isInteger(spec.cents) || spec.cents <= 0) return "terms";
  return relationAllows(relationLevel(ctx.relations, spec.investor, spec.host), spec.asAid === true) ? null : "relation";
}

/**
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
function termsRefusal(ctx, spec) {
  const gate = spec.asAid ? null : gateRefusal(ctx, spec);
  if (gate) return gate;
  if (funds(ctx.batch, spec.investor) < spec.cents) return "balance";
  if (spec.form === "project") {
    const city = cityFor(ctx, spec);
    if (!city || !city.build || !(city.neededProgress > 0)) return "build";
  }
  const key = giftKey(spec);
  return ctx.out.transfers.some((transfer) => transfer.loanId === key) ? "same-turn" : null;
}

/**
 * Both sides past the kind's stage, and the investor not blocked from the host.
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
function gateRefusal(ctx, spec) {
  const stage = STAGE_FOR[spec.form];
  const both = hasStage(ctx.civ.get(spec.investor), stage, ctx.turn, ctx.options)
    && hasStage(ctx.civ.get(spec.host), stage, ctx.turn, ctx.options);
  if (!both) return "invest-stage";
  return isBlocked(ctx.ledger, spec.investor, spec.host, ctx.turn) ? "blocked" : null;
}

/** @param {InvestSpec} spec */
const giftKey = (spec) => `A${spec.investor}-${spec.host}`;

/**
 * Why this investment can't open, or null. Both parties alive, at peace and Neutral or better (aid only at peace),
 * both past the kind's stage, the investor not blocked by a default or repudiation, the Gold in this turn's funds,
 * and for a development loan a city of the host's with a build at the head of its queue.
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
export function investRefusal(ctx, spec) {
  return partiesRefusal(ctx, spec) || termsRefusal(ctx, spec);
}

/**
 * DESIGN 6 "Accepting": an AI host takes a development loan on any current build, general investment unless it's in
 * default, and aid always.
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 */
export function aiHostRefusal(ctx, spec) {
  if (!ctx.options.ai) return "ai-off";
  if (!spec.asAid && spec.form === "general" && activeDefaults(ctx.ledger, spec.host) > 0) return "declined";
  return null;
}

/**
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 * @param {{ id: string, spent: number, city: CityRead | null }} q
 */
function bookRecord(ctx, spec, { id, spent, city }) {
  ctx.ledger.nextInvestId += 1;
  ctx.ledger.investments.push(makeInvestment({ id, kind: spec.form, investor: spec.investor, host: spec.host,
    principal: spent, turn: ctx.turn, cityId: city ? city.id : null, roleBuilding: city?.roleBuilding === true,
    baseIncome: incomeOf(ctx, spec.host) }));
}

/**
 * Sends the Gold, books the record (none for aid), the progress row and the relationship gain.
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 * @param {"request" | "ai" | "offer"} source
 */
export function openInvestment(ctx, spec, source) {
  const spend = spendFor(ctx, spec);
  if (spend.cents <= 0) return null;
  const id = spec.asAid ? giftKey(spec) : investId(ctx.ledger.nextInvestId);
  emit(ctx, { id }, { from: spec.investor, to: spend.city ? PROGRESS : spec.host, cents: spend.cents,
    reason: "invest", parts: { refund: spend.refund } });
  if (spend.city) {
    ctx.out.progress.push({ host: spec.host, cityId: spend.city.id, amount: spend.progress, investmentId: id });
  }
  if (!spec.asAid) bookRecord(ctx, spec, { id, spent: spend.cents, city: spend.city });
  const gain = relationshipGain(spend.cents, incomeOf(ctx, spec.host), tenthsFor(spec.form, spec.asAid));
  if (gain > 0) ctx.out.relationships.push({ a: spec.investor, b: spec.host, delta: gain });
  const fields = { loanId: id, lender: spec.investor, borrower: spec.host, cents: spend.cents, form: spec.form,
    aid: spec.asAid ? 1 : 0, progress: spend.progress, relationship: gain, source };
  event(ctx, { kind: "invest", ...fields });
  notice(ctx, spec.investor, { kind: "invested", ...fields });
  notice(ctx, spec.host, { kind: "invested-in", ...fields });
  return id;
}

/**
 * What the investment spends: a development loan only the Gold its progress uses (the rest stays with the investor),
 * anything else the whole amount.
 * @param {TurnContext} ctx
 * @param {InvestSpec} spec
 * @returns {{ city: CityRead | null, cents: number, refund: number, progress: number }}
 */
function spendFor(ctx, spec) {
  const city = spec.form === "project" ? cityFor(ctx, spec) : null;
  if (!city) return { city: null, cents: spec.form === "project" ? 0 : spec.cents, refund: 0, progress: 0 };
  const plan = progressFor(spec.cents, city.neededProgress);
  return { city, cents: plan.usedCents, refund: plan.refundCents, progress: plan.progress };
}

/**
 * The human's invest request (DESIGN 5): the same checks, then the AI host's acceptance rule.
 * @param {TurnContext} ctx
 * @param {Record<string, any>} request
 */
export function investRequestRefusal(ctx, request) {
  /** @type {InvestSpec} */
  const spec = { investor: request.investor, host: request.host, form: request.form, cents: request.cents,
    cityId: typeof request.cityId === "string" ? request.cityId : null, asAid: request.asAid === true };
  if (!isHuman(ctx, spec.investor) || isHuman(ctx, spec.host)) return "parties";
  const refused = investRefusal(ctx, spec) || aiHostRefusal(ctx, spec);
  if (refused) return refused;
  openInvestment(ctx, spec, "request");
  return null;
}

/**
 * The human's answer to an AI's offer: accept opens it if it still can open, decline drops it.
 * @param {TurnContext} ctx
 * @param {Record<string, any>} request
 * @param {boolean} accept
 */
export function offerAnswerRefusal(ctx, request, accept) {
  const offer = ctx.ledger.offers.find((row) => row.id === request.offerId);
  if (!offer || !isHuman(ctx, offer.host)) return "no-offer";
  ctx.ledger.offers = ctx.ledger.offers.filter((row) => row.id !== offer.id);
  if (!accept) { event(ctx, { kind: "offer-declined", loanId: offer.id, lender: offer.investor }); return null; }
  /** @type {InvestSpec} */
  const spec = { investor: offer.investor, host: offer.host, form: offer.kind, cents: offer.cents,
    cityId: offer.cityId, asAid: false };
  const refused = investRefusal(ctx, spec);
  if (refused) return refused;
  openInvestment(ctx, spec, "offer");
  return null;
}
