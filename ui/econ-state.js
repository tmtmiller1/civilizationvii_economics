// econ-state.js - Economics: the saved envelope. One versioned object holds the loan list, blocks, recent misses and
// repudiations, guard turns, insolvency counters, the last batch, the event log, and from version 3 the investment
// records and the AI's open investment offers (DESIGN 4.12); a version 2 ledger loads with none of those; load refuses
// anything that is not ours without throwing, and save(load(x)) is a fixed point because sanitize rebuilds every record
// with a fixed key order.

import { LIMITS, isWorldAccount } from "./econ-params.js";
import { LOAN_KINDS, LOAN_SOURCES, LOAN_STATES, loanSeq } from "./econ-loan.js";
import { INVEST_KINDS, investSeq } from "./econ-invest.js";

export const MOD_ID = "tower-economics";
export const VERSION = 3;

/** @returns {Ledger} */
export function emptyLedger() {
  return { age: null, nextId: 1, lastTurn: null, batchSeq: 0, loans: [], blocks: [], misses: [], repudiations: [],
    guardTurns: [], buildTurns: [], capHits: [], lowIncome: [], escrow: [], distress: [], taxes: [], events: [],
    lastBatch: null, investments: [], offers: [], nextInvestId: 1 };
}

/**
 * @template {object} T
 * @param {T[]} rows
 * @returns {T[]}
 */
const copyRows = (rows) => rows.map((row) => ({ ...row }));

/**
 * @param {Ledger} ledger
 * @returns {Ledger}
 */
export function cloneLedger(ledger) {
  return {
    age: ledger.age, nextId: ledger.nextId, lastTurn: ledger.lastTurn, batchSeq: ledger.batchSeq,
    loans: copyRows(ledger.loans), blocks: copyRows(ledger.blocks), misses: copyRows(ledger.misses),
    repudiations: copyRows(ledger.repudiations), guardTurns: copyRows(ledger.guardTurns),
    buildTurns: copyRows(ledger.buildTurns || []),
    capHits: copyRows(ledger.capHits), lowIncome: copyRows(ledger.lowIncome), escrow: copyRows(ledger.escrow || []),
    distress: copyRows(ledger.distress || []), taxes: copyRows(ledger.taxes),
    events: copyRows(ledger.events),
    lastBatch: ledger.lastBatch ? { ...ledger.lastBatch, civs: copyRows(ledger.lastBatch.civs) } : null,
    investments: copyRows(ledger.investments || []), offers: copyRows(ledger.offers || []),
    nextInvestId: ledger.nextInvestId || 1,
  };
}

// Anything read back from the save is untyped until a check has passed it.
/** @typedef {Record<string, any>} Raw */

/** @param {unknown} x */
const isInt = (x) => Number.isInteger(x);
/** @param {unknown} x */
const isPid = (x) => Number.isInteger(x) && /** @type {number} */ (x) >= 0;
/** @param {unknown} x */
const isParty = (x) => isWorldAccount(x) || isPid(x);
/** @param {unknown} x */
const isTurn = (x) => Number.isInteger(x);
/**
 * @param {unknown} x
 * @param {number} low
 */
const atLeast = (x, low) => isInt(x) && /** @type {number} */ (x) >= low;
/**
 * @param {unknown} x
 * @returns {Raw[]}
 */
const list = (x) => (Array.isArray(x) ? x : []);

// Each check is one rule a stored loan must pass; a loan failing any of them is dropped whole.
/** @type {((row: Raw) => boolean)[]} */
const LOAN_CHECKS = [
  (row) => loanSeq(row.id) > 0 && isParty(row.lender) && isPid(row.borrower) && row.lender !== row.borrower,
  (row) => atLeast(row.principal, 1) && atLeast(row.outstanding, 0),
  (row) => atLeast(row.ratePpm, 1) && atLeast(row.term, 1),
  (row) => atLeast(row.paid, 0) && row.paid <= row.term,
  (row) => atLeast(row.missed, 0) && row.missed <= 3,
  (row) => LOAN_STATES.includes(row.state) && isTurn(row.opened),
  (row) => !(row.state === "active" && row.missed >= 3),
];

/**
 * @param {Raw} row
 * @returns {Loan | null}
 */
function cleanLoan(row) {
  if (!row || typeof row !== "object" || !LOAN_CHECKS.every((check) => check(row))) return null;
  return {
    id: row.id, kind: LOAN_KINDS.includes(row.kind) ? row.kind : "loan", lender: row.lender, borrower: row.borrower,
    principal: row.principal, outstanding: row.outstanding, ratePpm: row.ratePpm, term: row.term, paid: row.paid,
    missed: row.missed, state: row.state, emergency: row.emergency === true, restructured: row.restructured === true,
    opened: row.opened, closedTurn: isTurn(row.closedTurn) ? row.closedTurn : null,
    writtenOff: atLeast(row.writtenOff, 1) ? row.writtenOff : 0,
    source: LOAN_SOURCES.includes(row.source) ? row.source : "borrow",
    // A Religious lender's partnership (DESIGN 4.17) keeps the borrower's income it opened at.
    ...(row.partnership === true ? { partnership: true, baseIncome: atLeast(row.baseIncome, 0) ? row.baseIncome : 0 }
      : {}),
  };
}

/**
 * @param {Raw} raw
 * @returns {LedgerEvent | null}
 */
function cleanEvent(raw) {
  if (!raw || typeof raw !== "object" || !isTurn(raw.turn) || typeof raw.kind !== "string") return null;
  /** @type {Raw} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const keep = typeof value === "string" ? value.length <= 64
      : typeof value === "number" ? Number.isFinite(value) : value === null;
    if (keep) out[key] = value;
  }
  return /** @type {LedgerEvent} */ (out);
}

/** @param {unknown} raw */
function cleanLoans(raw) {
  /** @type {Loan[]} */
  const loans = [];
  const seen = new Set();
  for (const row of list(raw)) {
    const loan = cleanLoan(row);
    if (!loan || seen.has(loan.id)) continue;
    seen.add(loan.id);
    loans.push(loan);
  }
  return loans;
}

/** @param {unknown} raw */
function cleanBlocks(raw) {
  /** @type {Block[]} */
  const blocks = [];
  for (const row of list(raw)) {
    if (!row || !isParty(row.lender) || !isPid(row.borrower)) continue;
    if (blocks.some((block) => block.lender === row.lender && block.borrower === row.borrower)) continue;
    blocks.push({ lender: row.lender, borrower: row.borrower,
      reason: row.reason === "repudiation" ? row.reason : "default",
      agesLeft: atLeast(row.agesLeft, 0) ? row.agesLeft : null,
      untilTurn: isTurn(row.untilTurn) ? row.untilTurn : null });
  }
  // A block with neither an age count nor an end turn is read as a default block for the rest of the age.
  return blocks.map((block) => (block.agesLeft === null && block.untilTurn === null
    ? { ...block, agesLeft: 0 } : block));
}

/**
 * Rows of { pid, <field> } with an integer field; `unique` keeps the first row per pid.
 * @param {unknown} raw
 * @param {"turn" | "turns" | "cents"} field
 * @param {boolean} unique
 */
function cleanPidRows(raw, field, unique) {
  /** @type {Raw[]} */
  const rows = [];
  for (const row of list(raw)) {
    if (!row || !isPid(row.pid) || !isInt(row[field])) continue;
    if (unique && rows.some((x) => x.pid === row.pid)) continue;
    rows.push({ pid: row.pid, [field]: row[field] });
  }
  return rows;
}

/** @param {unknown} raw */
function cleanMisses(raw) {
  /** @type {MissRow[]} */
  const rows = [];
  for (const miss of list(raw)) {
    if (!miss || !isPid(miss.pid) || !isTurn(miss.turn)) continue;
    const n = atLeast(miss.n, 1) ? miss.n : 1;
    const row = rows.find((x) => x.pid === miss.pid && x.turn === miss.turn);
    if (row) row.n += n; else rows.push({ pid: miss.pid, turn: miss.turn, n });
  }
  return rows;
}

/** @param {unknown} raw */
function cleanRepudiations(raw) {
  /** @type {RepudiationRow[]} */
  const rows = [];
  for (const row of list(raw)) {
    if (!row || !isPid(row.pid) || !isParty(row.lender) || !isTurn(row.turn) || !atLeast(row.cents, 0)) continue;
    rows.push({ pid: row.pid, lender: row.lender, turn: row.turn, cents: row.cents, atWar: row.atWar === true });
  }
  return rows;
}

/** @param {unknown} raw */
function cleanTaxes(raw) {
  /** @type {TaxRow[]} */
  const rows = [];
  for (const row of list(raw)) {
    const named = row && isPid(row.pid) && typeof row.level === "string" && row.level.length <= 16;
    if (!named || !isTurn(row.changedTurn)) continue;
    if (rows.some((x) => x.pid === row.pid)) continue;
    rows.push({ pid: row.pid, level: row.level, changedTurn: row.changedTurn });
  }
  return rows;
}

/**
 * @param {Raw} row
 * @returns {BatchRow | null}
 */
function cleanBatchRow(row) {
  if (!row || !isPid(row.pid) || !isInt(row.snapshot) || !isInt(row.net)) return null;
  return { pid: row.pid, snapshot: row.snapshot, net: row.net, influence: isInt(row.influence) ? row.influence : 0,
    celebration: isInt(row.celebration) ? row.celebration : 0, ...paidFields(row) };
}

/**
 * A batch row's whole-Gold payment and its carries (0.5.4), kept only when they're whole cents and a carry is under
 * one Gold; a row from an older save has none, and econ-batch.js paidOf reads its net instead.
 * @param {Raw} row
 */
function paidFields(row) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of ["paid", "celebrationPaid"]) if (isInt(row[key])) out[key] = row[key];
  for (const key of ["carry", "celebrationCarry"]) if (isInt(row[key]) && Math.abs(row[key]) < 100) out[key] = row[key];
  return out;
}

/**
 * @param {Raw | undefined} raw
 * @returns {BatchRecord | null}
 */
function cleanBatch(raw) {
  const ok = raw && typeof raw === "object" && typeof raw.id === "string" && raw.id.length <= 16 && isTurn(raw.turn);
  if (!ok) return null;
  const civs = /** @type {BatchRow[]} */ (list(raw.civs).map(cleanBatchRow).filter(Boolean));
  return { id: raw.id, turn: raw.turn, civs };
}

// Each check is one rule a stored investment must pass; a record failing any of them is dropped whole.
/** @type {((row: Raw) => boolean)[]} */
const INVESTMENT_CHECKS = [
  (row) => investSeq(row.id) > 0 && INVEST_KINDS.includes(row.kind) && isPid(row.investor) && isPid(row.host),
  (row) => row.investor !== row.host && atLeast(row.principal, 1) && atLeast(row.outstanding, 0),
  (row) => atLeast(row.mille, 1) && atLeast(row.term, 1) && atLeast(row.paid, 0) && row.paid <= row.term,
  (row) => atLeast(row.missed, 0) && row.missed <= 3 && LOAN_STATES.includes(row.state) && isTurn(row.opened),
];

/**
 * @param {Raw} row
 * @returns {Investment | null}
 */
function cleanInvestment(row) {
  if (!row || typeof row !== "object" || !INVESTMENT_CHECKS.every((check) => check(row))) return null;
  const cityId = typeof row.cityId === "string" && row.cityId.length <= 32 ? row.cityId : null;
  return { id: row.id, kind: row.kind, investor: row.investor, host: row.host, principal: row.principal,
    mille: row.mille, term: row.term, paid: row.paid, missed: row.missed, state: row.state, opened: row.opened,
    closedTurn: isTurn(row.closedTurn) ? row.closedTurn : null,
    writtenOff: atLeast(row.writtenOff, 1) ? row.writtenOff : 0, outstanding: row.outstanding, cityId: row.kind === "project" ? cityId : null,
    baseIncome: isInt(row.baseIncome) ? row.baseIncome : 0 };
}

/** @param {unknown} raw */
function cleanInvestments(raw) {
  /** @type {Investment[]} */
  const out = [];
  for (const row of list(raw)) {
    const record = cleanInvestment(row);
    if (record && !out.some((x) => x.id === record.id)) out.push(record);
  }
  return out;
}

/** @param {Raw} row */
function isOfferRow(row) {
  return !!row && typeof row.id === "string" && row.id.length <= 16 && isPid(row.investor) && isPid(row.host)
    && INVEST_KINDS.includes(row.kind) && atLeast(row.cents, 1) && isTurn(row.turn);
}

/** @param {unknown} raw */
function cleanOffers(raw) {
  /** @type {InvestOffer[]} */
  const out = [];
  for (const row of list(raw)) {
    if (!isOfferRow(row) || out.some((x) => x.id === row.id)) continue;
    out.push({ id: row.id, investor: row.investor, host: row.host, kind: row.kind, cents: row.cents,
      cityId: typeof row.cityId === "string" && row.cityId.length <= 32 ? row.cityId : null, turn: row.turn });
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {Investment[]} investments
 * @param {InvestOffer[]} offers
 */
function nextInvestIdFor(raw, investments, offers) {
  let max = 0;
  for (const record of investments) max = Math.max(max, investSeq(record.id));
  for (const offer of offers) max = Math.max(max, investSeq(offer.id));
  return Math.max(atLeast(raw, 1) ? /** @type {number} */ (raw) : 1, max + 1);
}

/**
 * @param {unknown} raw
 * @param {Loan[]} loans
 */
function nextIdFor(raw, loans) {
  const maxSeq = loans.reduce((max, loan) => Math.max(max, loanSeq(loan.id)), 0);
  return Math.max(atLeast(raw, 1) ? /** @type {number} */ (raw) : 1, maxSeq + 1);
}

/**
 * The per-civ counters: guard turns, AI build-loan turns, cap hits, turns of low income.
 * @param {Ledger} ledger
 * @param {Raw} raw
 */
function cleanCounters(ledger, raw) {
  ledger.guardTurns = /** @type {TurnRow[]} */ (cleanPidRows(raw.guardTurns, "turn", true));
  ledger.buildTurns = /** @type {TurnRow[]} */ (cleanPidRows(raw.buildTurns, "turn", true));
  ledger.capHits = /** @type {TurnRow[]} */ (cleanPidRows(raw.capHits, "turn", true));
  ledger.lowIncome = /** @type {LowIncomeRow[]} */ (cleanPidRows(raw.lowIncome, "turns", true));
  // A save from before the escrow account (0.5.4) holds nothing in it, and knows no distress.
  ledger.escrow = /** @type {EscrowRow[]} */ (cleanPidRows(raw.escrow, "cents", true)).filter((row) => row.cents > 0);
  ledger.distress = /** @type {TurnRow[]} */ (cleanPidRows(raw.distress, "turn", true));
}

/**
 * The 1.1 records (DESIGN 4.12): investments, open offers and the id counter they share.
 * @param {Ledger} ledger
 * @param {Raw} raw
 */
function cleanCommerce(ledger, raw) {
  ledger.investments = cleanInvestments(raw.investments);
  ledger.offers = cleanOffers(raw.offers);
  ledger.nextInvestId = nextInvestIdFor(raw.nextInvestId, ledger.investments, ledger.offers);
}

/**
 * @param {unknown} input
 * @returns {Ledger}
 */
export function sanitizeLedger(input) {
  const ledger = emptyLedger();
  if (!input || typeof input !== "object") return ledger;
  const raw = /** @type {Raw} */ (input);
  ledger.age = typeof raw.age === "string" ? raw.age : null;
  ledger.lastTurn = isTurn(raw.lastTurn) ? raw.lastTurn : null;
  ledger.batchSeq = atLeast(raw.batchSeq, 0) ? raw.batchSeq : 0;
  ledger.loans = cleanLoans(raw.loans);
  ledger.nextId = nextIdFor(raw.nextId, ledger.loans);
  ledger.blocks = cleanBlocks(raw.blocks);
  ledger.misses = cleanMisses(raw.misses);
  ledger.repudiations = cleanRepudiations(raw.repudiations);
  cleanCounters(ledger, raw);
  ledger.taxes = cleanTaxes(raw.taxes);
  ledger.events = /** @type {LedgerEvent[]} */ (list(raw.events).map(cleanEvent).filter(Boolean));
  ledger.lastBatch = cleanBatch(raw.lastBatch);
  cleanCommerce(ledger, raw);
  return prune(ledger);
}

/** @param {Loan} loan */
const isSettled = (loan) => loan.state === "closed" || loan.state === "repudiated";

/**
 * Caps the event log and the settled-loan history. Active and defaulted loans are never dropped.
 * @param {Ledger} ledger
 */
export function prune(ledger) {
  if (ledger.events.length > LIMITS.events) ledger.events = ledger.events.slice(-LIMITS.events);
  const settled = ledger.loans.filter(isSettled);
  if (settled.length > LIMITS.closedLoans) {
    const drop = new Set(settled.slice(0, settled.length - LIMITS.closedLoans).map((loan) => loan.id));
    ledger.loans = ledger.loans.filter((loan) => !drop.has(loan.id));
  }
  const records = ledger.investments || [];
  const done = records.filter((record) => record.state === "closed" || record.state === "repudiated");
  if (done.length > LIMITS.closedLoans) {
    const drop = new Set(done.slice(0, done.length - LIMITS.closedLoans).map((record) => record.id));
    ledger.investments = records.filter((record) => !drop.has(record.id));
  }
  return ledger;
}

/** @param {string} text */
export function utf8Bytes(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i += 1; }
    else bytes += 3;
  }
  return bytes;
}

/**
 * Drops the oldest settled loan, then the oldest settled investment; false when there is none left to drop.
 * @param {Ledger} ledger
 */
function dropSettled(ledger) {
  const at = ledger.loans.findIndex(isSettled);
  if (at >= 0) { ledger.loans.splice(at, 1); return true; }
  const done = ledger.investments.findIndex((record) => record.state === "closed" || record.state === "repudiated");
  if (done < 0) return false;
  ledger.investments.splice(done, 1);
  return true;
}

/**
 * The envelope text; if it would pass 64 KB, the oldest events and then the oldest settled loans go first.
 * @param {Ledger} ledger
 */
export function save(ledger) {
  const clean = prune(sanitizeLedger(ledger));
  let text = JSON.stringify({ mod: MOD_ID, v: VERSION, ledger: clean });
  while (utf8Bytes(text) > LIMITS.envelopeBytes) {
    if (clean.events.length) clean.events.shift();
    else if (!dropSettled(clean)) break;
    text = JSON.stringify({ mod: MOD_ID, v: VERSION, ledger: clean });
  }
  return text;
}

/**
 * @param {unknown} raw
 * @returns {{ obj?: unknown, error?: string }}
 */
function parse(raw) {
  if (typeof raw !== "string") return { obj: raw };
  try { return { obj: JSON.parse(raw) }; } catch { return { error: "unparseable" }; }
}

/** @param {unknown} obj */
function refusal(obj) {
  const envelope = /** @type {Raw | null} */ (obj);
  if (!envelope || typeof envelope !== "object" || envelope.mod !== MOD_ID || !Number.isInteger(envelope.v)
    || envelope.v < 1) return "foreign";
  return envelope.v > VERSION ? "newer" : null;
}

/**
 * Never throws. A refusal returns an empty ledger and leaves the stored value alone.
 * @param {unknown} raw
 * @returns {{ ok: boolean, reason: string, ledger: Ledger }}
 */
export function load(raw) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, reason: "empty", ledger: emptyLedger() };
  const { obj, error } = parse(raw);
  const reason = error || refusal(obj);
  if (reason) return { ok: false, reason, ledger: emptyLedger() };
  return { ok: true, reason: "loaded", ledger: sanitizeLedger(/** @type {Raw} */ (obj).ledger) };
}
