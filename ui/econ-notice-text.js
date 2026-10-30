// econ-notice-text.js - Economics: what each notice, refusal and ledger event says, as a LOC key and its arguments
// (DESIGN 9, the turn notification and the Loans tab's history). The glue composes the key in the game's language;
// this module only picks the key and the numbers, so the wording is pinned by tests without the engine.

import { formatGold, formatRate } from "./econ-format.js";
import { isWorldAccount } from "./econ-params.js";

/** @typedef {{ key: string, args: number[] }} Counted a key composed with its count, in a list */
/** @typedef {{ key: string, args: (string | number | (string | Counted)[])[] }} Line */
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

/**
 * A system's name key (DESIGN 4.17): `civicMarket` is LOC_ECONOMICS_SYSTEM_CIVIC_MARKET.
 * @param {unknown} id
 */
export function systemKey(id) {
  const code = String(id || "mixed").replace(/([A-Z])/g, "_$1");
  return `${PREFIX}SYSTEM_${upper(code)}`;
}

/**
 * A cycle phase's name key (DESIGN 4.11).
 * @param {unknown} phase
 */
export function phaseKey(phase) {
  return `${PREFIX}PHASE_${upper(String(phase || "steady"))}`;
}

/**
 * The key naming one kind of cycle event, for a phase change's causes and the World tab.
 * @param {unknown} kind
 */
export function cycleEventKey(kind) {
  return `${PREFIX}CYCLE_EVENT_${upper(String(kind || "unknown"))}`;
}

/**
 * A list as a sentence: "a, b and c", with the joining word in the game's language.
 * @param {(string | number)[]} items
 * @param {string} and
 */
export function joinList(items, and) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * The arguments as the game composes them: a LOC key is composed in the game's language first, a list of keys (or of
 * keys with a count) is composed and joined as a sentence, numbers and text pass through.
 * @param {Line["args"]} args
 * @param {(key: string, ...args: (string | number)[]) => string} compose
 * @returns {(string | number)[]}
 */
export function composeArgs(args, compose) {
  const one = (/** @type {string | number | Counted} */ arg) => {
    if (typeof arg === "object") return compose(arg.key, ...arg.args);
    return typeof arg === "string" && arg.startsWith(PREFIX) ? compose(arg) : arg;
  };
  return args.map((arg) => (Array.isArray(arg) ? joinList(arg.map(one), compose(`${PREFIX}LIST_AND`)) : one(arg)));
}

/** Cycle events that can come more than once in a turn, with a text for "2 wars declared". */
const COUNTED_KINDS = new Set(["war-declared", "peace", "capture", "raze", "disaster", "default", "repudiation",
  "route-new", "route-ended"]);

/**
 * A phase change's causes, each kind once in the order first seen; a kind seen more than once is named with its
 * count ("2 wars declared") rather than repeated.
 * @param {string[]} kinds
 * @returns {(string | Counted)[]}
 */
export function causeItems(kinds) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) || 0) + 1);
  return [...counts].map(([kind, n]) => (n > 1 && COUNTED_KINDS.has(kind)
    ? { key: `${cycleEventKey(kind)}_MANY`, args: [n] } : cycleEventKey(kind)));
}

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
  trade: (notice) => ({ key: `${PREFIX}NOTICE_TRADE${Number(notice.waived) > 0 ? "_WAIVED" : ""}`,
    args: [gold(notice.paid), gold(notice.received), gold(notice.waived)] }),
  "tariff-cost": (notice) => ({ key: `${PREFIX}NOTICE_TARIFF_COST`, args: [Number(notice.partners) || 1] }),
  invested: (notice, ctx) => ({ key: `${PREFIX}NOTICE_INVESTED_${investForm(notice)}`,
    args: [gold(notice.cents), name(ctx, notice.borrower), Number(notice.progress) || 0] }),
  "invested-in": (notice, ctx) => ({ key: `${PREFIX}NOTICE_INVESTED_IN_${investForm(notice)}`,
    args: [name(ctx, notice.lender), gold(notice.cents), Number(notice.progress) || 0] }),
  "invest-miss": (notice) => ({ key: `${PREFIX}NOTICE_INVEST_MISS`, args: [String(notice.loanId), Number(notice.missed) || 1] }),
  "invest-default": (notice) => ({ key: `${PREFIX}NOTICE_INVEST_DEFAULT`, args: [String(notice.loanId)] }),
  "invest-defaulted-on": (notice, ctx) => ({ key: `${PREFIX}NOTICE_INVEST_DEFAULTED_ON`,
    args: [name(ctx, notice.borrower), String(notice.loanId)] }),
  "invest-writeoff": (notice) => ({ key: `${PREFIX}NOTICE_INVEST_WRITEOFF`, args: [String(notice.loanId), gold(notice.cents)] }),
  offer: (notice, ctx) => ({ key: `${PREFIX}NOTICE_OFFER_${notice.form === "general" ? "GENERAL" : "PROJECT"}`,
    args: [name(ctx, notice.investor), gold(notice.cents)] }),
  system: (notice) => ({ key: `${PREFIX}NOTICE_SYSTEM`, args: [systemKey(notice.to), systemKey(notice.from)] }),
  phase: (notice) => {
    const causes = causeItems(String(notice.causes || "").split(",").filter(Boolean));
    return { key: `${PREFIX}NOTICE_PHASE${causes.length ? "" : "_QUIET"}`, args: [phaseKey(notice.to), causes] };
  },
  panic: () => ({ key: `${PREFIX}NOTICE_PANIC`, args: [] }),
  "age-gold": (notice) => ({ key: `${PREFIX}NOTICE_AGE_GOLD`, args: [gold(notice.after), gold(notice.before)] }),
  plan: (notice) => ({ key: `${PREFIX}NOTICE_PLAN`, args: [gold(notice.cents), Number(notice.cities) || 0] }),
};

/**
 * The key part naming what was given: a development loan, general investment, or aid of either kind.
 * @param {Record<string, unknown>} notice
 */
function investForm(notice) {
  if (Number(notice.aid) === 1) return "AID";
  return notice.form === "general" ? "GENERAL" : "PROJECT";
}

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
 * The second line of a borrow refused for a limit: the most that lender would lend over that term, which the Loans
 * tab can borrow instead; null for any other refusal.
 * @param {LedgerEvent} event
 * @param {TextContext} ctx
 * @returns {Line | null}
 */
export function describeRefusalMost(event, ctx) {
  if (event.request !== "borrow" || !Number.isInteger(event.most) || event.lender === undefined) return null;
  const most = /** @type {number} */ (event.most);
  return { key: `${PREFIX}NOTICE_REFUSED_${most > 0 ? "MOST" : "NONE"}`,
    args: [name(ctx, event.lender), Number(event.term) || 0, gold(most)] };
}

/**
 * The second line of a general investment refused by a host in default: the development loan still open to the
 * player, which it sets up on the Trade tab; null for any other refusal or when none is open.
 * @param {LedgerEvent} event
 * @param {TextContext} ctx
 * @returns {Line | null}
 */
export function describeRefusalProject(event, ctx) {
  if (event.request !== "invest" || event.reason !== "host-default" || event.project !== 1) return null;
  return { key: `${PREFIX}NOTICE_REFUSED_PROJECT`, args: [name(ctx, event.host), gold(event.cents)] };
}

/** What a transfer's reason moved, for the net line. @type {Record<string, string>} */
const FLOW_OF = { principal: "LOANS", payment: "LOANS", garnish: "LOANS", trade: "TRADE", invest: "INVESTMENT",
  dividend: "INVESTMENT", cycle: "CYCLE", erosion: "INFLATION", plan: "PLAN", tax: "TAX" };

/**
 * The kinds of flow that moved a civ's Gold this turn, as name keys in a fixed order (loans, trade, ...).
 * @param {Transfer[]} transfers
 * @param {number} pid
 */
export function flowKeys(transfers, pid) {
  const seen = new Set();
  for (const transfer of transfers || []) {
    if (transfer.from !== pid && transfer.to !== pid) continue;
    if (Object.hasOwn(FLOW_OF, transfer.reason)) seen.add(FLOW_OF[transfer.reason]);
  }
  return [...new Set(Object.values(FLOW_OF))].filter((flow) => seen.has(flow)).map((flow) => `${PREFIX}FLOW_${flow}`);
}

/**
 * The turn's net line for the human: the Gold the mod moved and what moved it, Influence lost to misses, the
 * celebration meter. A net that rounds to 0 Gold says nothing.
 * @param {BatchRow | undefined} row
 * @param {string[]} [flows] name keys of what moved the Gold (flowKeys)
 * @returns {Line[]}
 */
export function describeBatchRow(row, flows = []) {
  if (!row) return [];
  /** @type {Line[]} */
  const lines = [];
  const net = formatGold(row.net, { signed: true });
  if (net !== "0") {
    lines.push(flows.length ? { key: `${PREFIX}NOTICE_NET`, args: [net, flows] }
      : { key: `${PREFIX}NOTICE_NET_PLAIN`, args: [net] });
  }
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
  "age-gold": (event, who) => ({ key: `${PREFIX}EVENT_AGE_GOLD`, args: [who(event.pid), gold(event.after),
    gold(event.before)] }),
  restructure: (event) => ({ key: `${PREFIX}EVENT_RESTRUCTURE`, args: [String(event.loanId), gold(event.cents)] }),
  repudiation: (event, who) => ({ key: `${PREFIX}EVENT_REPUDIATION`, args: [who(event.borrower), gold(event.cents),
    who(event.lender), Number(event.grievances) || 0] }),
  writeoff: (event) => ({ key: `${PREFIX}EVENT_WRITEOFF`, args: [String(event.loanId), gold(event.cents)] }),
  guard: (event, who) => ({ key: `${PREFIX}EVENT_GUARD`, args: [gold(event.cents), who(event.lender)] }),
  "guard-cap": (event) => ({ key: `${PREFIX}EVENT_GUARD_CAP`, args: [gold(event.cap)] }),
  invest: (event, who) => ({ key: `${PREFIX}EVENT_INVEST_${investForm(event)}`, args: [who(event.lender),
    who(event.borrower), gold(event.cents)] }),
  "invest-miss": (event) => ({ key: `${PREFIX}EVENT_INVEST_MISS`, args: [String(event.loanId), Number(event.missed) || 1] }),
  "invest-default": (event, who) => ({ key: `${PREFIX}EVENT_INVEST_DEFAULT`, args: [String(event.loanId),
    who(event.borrower)] }),
  "invest-closed": (event) => ({ key: `${PREFIX}EVENT_INVEST_CLOSED`, args: [String(event.loanId)] }),
  "invest-writeoff": (event) => ({ key: `${PREFIX}EVENT_INVEST_WRITEOFF`, args: [String(event.loanId), gold(event.cents)] }),
  offer: (event, who) => ({ key: `${PREFIX}EVENT_OFFER`, args: [who(event.lender), gold(event.cents)] }),
  "offer-declined": (event, who) => ({ key: `${PREFIX}EVENT_OFFER_DECLINED`, args: [who(event.lender)] }),
  tariff: (event, who) => ({ key: `${PREFIX}EVENT_TARIFF_${String(event.level).toUpperCase()}`, args: [who(event.pid)] }),
  system: (event, who) => ({ key: `${PREFIX}EVENT_SYSTEM`, args: [who(event.pid), systemKey(event.to)] }),
  panic: () => ({ key: `${PREFIX}EVENT_PANIC`, args: [] }),
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
