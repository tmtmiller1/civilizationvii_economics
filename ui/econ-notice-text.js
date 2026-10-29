// econ-notice-text.js - Economics: what each notice, refusal and ledger event says, as a LOC key and its arguments
// (DESIGN 9, the turn notification and the Loans tab's history). The glue composes the key in the game's language;
// this module only picks the key and the numbers, so the wording is pinned by tests without the engine.

import { formatGold, formatRate } from "./econ-format.js";
import { isWorldAccount } from "./econ-params.js";

/** @typedef {{ key: string, args: (string | number)[] }} Line */
/** @typedef {{ ledger: Ledger, nameOf: (party: Party) => string }} TextContext */

const PREFIX = "LOC_ECONOMICS_";

/** @param {string} code */
const upper = (code) => code.toUpperCase().replace(/-/g, "_");

/**
 * The LOC key for a refusal reason the model gives (`credit-cap`, `no-offer`, ...).
 * @param {unknown} reason
 */
export function reasonKey(reason) {
  return `${PREFIX}REASON_${typeof reason === "string" && reason ? upper(reason) : "UNKNOWN"}`;
}

/**
 * The LOC key naming a request kind (`borrow`, `lend`, ...).
 * @param {unknown} kind
 */
export function requestKey(kind) {
  return `${PREFIX}REQUEST_${typeof kind === "string" && kind ? upper(kind) : "UNKNOWN"}`;
}

/**
 * A world account's name key; a civ's name comes from the glue.
 * @param {Party} party
 */
export function worldNameKey(party) {
  return `${PREFIX}LENDER_${String(party).toUpperCase()}`;
}

/**
 * @param {TextContext} ctx
 * @param {unknown} loanId
 */
function loanOf(ctx, loanId) {
  return ctx.ledger.loans.find((loan) => loan.id === loanId);
}

/**
 * @param {TextContext} ctx
 * @param {unknown} party
 */
const name = (ctx, party) => ctx.nameOf(/** @type {Party} */ (party));
/** @param {unknown} cents */
const gold = (cents) => formatGold(Number(cents) || 0);

/** @type {Record<string, (notice: Record<string, unknown>, ctx: TextContext) => Line | null>} */
const NOTICES = {
  open(notice, ctx) {
    const loan = loanOf(ctx, notice.loanId);
    if (!loan) return null;
    return { key: `${PREFIX}NOTICE_OPEN`, args: [gold(loan.principal), name(ctx, loan.lender), formatRate(loan.ratePpm),
      loan.term] };
  },
  lent(notice, ctx) {
    const loan = loanOf(ctx, notice.loanId);
    return loan ? { key: `${PREFIX}NOTICE_LENT`, args: [gold(loan.principal), name(ctx, loan.borrower)] } : null;
  },
  miss: (notice) => ({ key: `${PREFIX}NOTICE_MISS`, args: [String(notice.loanId), Number(notice.missed) || 1] }),
  default: (notice) => ({ key: `${PREFIX}NOTICE_DEFAULT`, args: [String(notice.loanId)] }),
  "defaulted-on": (notice, ctx) => ({ key: `${PREFIX}NOTICE_DEFAULTED_ON`,
    args: [name(ctx, notice.borrower), String(notice.loanId)] }),
  guard: (notice, ctx) => ({ key: `${PREFIX}NOTICE_GUARD${notice.insolvent ? "_INSOLVENT" : ""}`,
    args: [gold(notice.cents), name(ctx, notice.lender)] }),
  "guard-cap": (notice) => ({ key: `${PREFIX}NOTICE_GUARD_CAP`,
    args: [gold(notice.cap), gold(notice.deficit), gold(notice.disbandLineCents ?? 0)] }),
  insolvent: (notice) => ({ key: `${PREFIX}NOTICE_INSOLVENT`, args: [Number(notice.turns) || 0] }),
  restructure: (notice) => ({ key: `${PREFIX}NOTICE_RESTRUCTURE`, args: [String(notice.loanId)] }),
  "restructure-ask": (notice, ctx) => ({ key: `${PREFIX}NOTICE_RESTRUCTURE_ASK`,
    args: [name(ctx, notice.borrower), String(notice.loanId)] }),
  repudiated: (notice, ctx) => ({ key: `${PREFIX}NOTICE_REPUDIATED`, args: [gold(notice.cents), name(ctx, notice.lender)] }),
  "repudiated-by": (notice, ctx) => ({ key: `${PREFIX}NOTICE_REPUDIATED_BY`,
    args: [name(ctx, notice.borrower), gold(notice.cents)] }),
};

/**
 * The line for one notice the plan addressed to the human, or null for a kind with nothing to say.
 * @param {Notice} notice
 * @param {TextContext} ctx
 * @returns {Line | null}
 */
export function describeNotice(notice, ctx) {
  const describe = Object.hasOwn(NOTICES, notice.kind) ? NOTICES[notice.kind] : null;
  return describe ? describe(notice, ctx) : null;
}

/**
 * The line for a refused request: "Your borrow was refused: {reason}". The reason is a second key the glue composes.
 * @param {LedgerEvent} event
 * @returns {{ key: string, args: (string | number)[], requestKey: string, reasonKey: string }}
 */
export function describeRefusal(event) {
  return { key: `${PREFIX}NOTICE_REFUSED`, args: [], requestKey: requestKey(event.request),
    reasonKey: reasonKey(event.reason) };
}

/**
 * The turn's net line for the human: Gold moved by loans, Influence lost to misses, the celebration meter.
 * @param {BatchRow | undefined} row
 * @returns {Line[]}
 */
export function describeBatchRow(row) {
  if (!row) return [];
  /** @type {Line[]} */
  const lines = [];
  if (row.net !== 0) lines.push({ key: `${PREFIX}NOTICE_NET`, args: [formatGold(row.net, { signed: true })] });
  if (row.influence !== 0) lines.push({ key: `${PREFIX}NOTICE_INFLUENCE`, args: [row.influence] });
  if (row.celebration !== 0) {
    lines.push({ key: `${PREFIX}NOTICE_CELEBRATION`, args: [formatGold(row.celebration, { signed: true })] });
  }
  return lines;
}

/**
 * Whether a ledger event is about this player, for the Loans tab's history.
 * @param {LedgerEvent} event
 * @param {number} pid
 */
export function eventConcerns(event, pid) {
  for (const field of ["pid", "borrower", "lender"]) if (event[field] === pid) return true;
  return false;
}

/** @type {Record<string, (event: LedgerEvent, who: (party: unknown) => string) => Line>} */
const EVENTS = {
  open: (event, who) => ({ key: `${PREFIX}EVENT_OPEN`, args: [String(event.loanId), gold(event.cents),
    who(event.lender), who(event.borrower)] }),
  miss: (event) => ({ key: `${PREFIX}EVENT_MISS`, args: [String(event.loanId), Number(event.missed) || 1] }),
  default: (event, who) => ({ key: `${PREFIX}EVENT_DEFAULT`, args: [String(event.loanId), who(event.borrower)] }),
  closed: (event) => ({ key: `${PREFIX}EVENT_CLOSED`, args: [String(event.loanId)] }),
  restructure: (event) => ({ key: `${PREFIX}EVENT_RESTRUCTURE`, args: [String(event.loanId), gold(event.cents)] }),
  repudiation: (event, who) => ({ key: `${PREFIX}EVENT_REPUDIATION`, args: [who(event.borrower), gold(event.cents),
    who(event.lender), Number(event.grievances) || 0] }),
  writeoff: (event) => ({ key: `${PREFIX}EVENT_WRITEOFF`, args: [String(event.loanId), gold(event.cents)] }),
  guard: (event, who) => ({ key: `${PREFIX}EVENT_GUARD`, args: [gold(event.cents), who(event.lender)] }),
  "guard-cap": (event) => ({ key: `${PREFIX}EVENT_GUARD_CAP`, args: [gold(event.cap)] }),
};

/**
 * One history line for a ledger event, or null for bookkeeping kinds. Parties are named through `ctx`.
 * @param {LedgerEvent} event
 * @param {TextContext} ctx
 * @returns {Line | null}
 */
export function describeEvent(event, ctx) {
  const who = (/** @type {unknown} */ party) => (party === undefined || party === null ? "" : name(ctx, party));
  return Object.hasOwn(EVENTS, event.kind) ? EVENTS[event.kind](event, who) : null;
}

/**
 * A lender or borrower that is a world account has a fixed name key; the glue resolves civs.
 * @param {Party} party
 */
export function isWorldParty(party) {
  return isWorldAccount(party);
}
