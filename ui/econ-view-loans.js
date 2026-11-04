// econ-view-loans.js - Economics: the Loans tab (DESIGN 5, 9). The main column: the borrow form (econ-view-borrow.js)
// where the player's stages open one, then the player's loans (overdue first) with repay, restructure and repudiate,
// then what it has lent and the lend form. The side column: the debt-service gauge, the most the player can borrow
// (the same figure the borrow form opens on, with the limit that sets it) and standing,
// the guard switch with its allowance, and the requests waiting for the next turn. Each action opens a confirmation in
// place that says what it costs and what changes, and one more click sends it.

import { amount, button, changeRow, columns, confirmCard, el, empty, expander, facts, feedbackLine, isConfirming, note,
  pill, row, say, section, setConfirming, stat } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { loansView, repudiationPreview, restructurePreview } from "./econ-view-model.js";
import { borrowLimit, borrowTerm, limitReason, renderBorrow, renderLend } from "./econ-view-borrow.js";
import { requestKey } from "./econ-notice-text.js";
import { opensNext, rulesFor, send } from "./econ-view-common.js";
import { isOpen, paymentDue } from "./econ-loan.js";
import { serviceMeter } from "./econ-view-instruments.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */
/** @typedef {ReturnType<typeof loansView>["mine"][number]} LoanRow */

/** @param {ScreenApi} api @param {number} cents */
const gold = (api, cents) => amount(formatGold(cents), { tooltip: api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents)) });

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderLoans(host, api) {
  const input = api.input();
  const view = loansView(input, api.me);
  const { rules } = rulesFor(api);
  /** @type {HTMLElement[]} */
  const main = [];
  const borrow = rules.sections["loans.borrow"];
  const limit = borrow ? borrowLimit(input, api.me, view.creditRoomCents, borrowTerm(input, api.me)) : null;
  if (limit) main.push(renderBorrow(input, view, api, limit));
  main.push(mineSection(input, view, api));
  if (view.lent.length) main.push(lentSection(view, api));
  if (rules.sections["loans.lend"]) main.push(renderLend(input, api));
  const income = input.civs.find((civ) => civ.id === api.me)?.incomeCents ?? 0;
  host.appendChild(columns(main, [limitsSection(view, income, limit, api), guardSection(view, api),
    pendingSection(api)]));
  const next = opensNext(api, rules.next.loans);
  if (next) host.appendChild(next);
}

/**
 * The debt-service gauge, the most the player can borrow over the form's term with the limit that sets it (while the
 * borrow form is open), and its standing.
 * @param {ReturnType<typeof loansView>} view
 * @param {number} income
 * @param {import("./econ-view-borrow.js").BorrowLimit | null} limit
 * @param {ScreenApi} api
 */
function limitsSection(view, income, limit, api) {
  const share = income > 0 ? Math.round((100 * view.serviceCents) / income) : view.serviceCents > 0 ? 100 : 0;
  return section(api.loc("LOC_ECONOMICS_LOANS_LIMITS"), [serviceMeter(share, api),
    ...(limit ? [row(api.loc("LOC_ECONOMICS_LOANS_MOST", limit.term), gold(api, limit.mostCents)),
      limitReason(limit, api)] : []),
    row(api.loc("LOC_ECONOMICS_LOANS_SERVICE"), api.loc("LOC_ECONOMICS_LOANS_SERVICE_OF",
      formatGold(view.serviceCents), formatGold(view.serviceCapCents))),
    row(api.loc("LOC_ECONOMICS_LOANS_STANDING"), String(view.standingPct), view.standingPct < 100 ? "econ-negative" : "",
      { tooltip: api.loc("LOC_ECONOMICS_LOANS_STANDING_TIP") }),
    ...reserveRows(view, api),
  ]);
}

/**
 * AI-PLAN 4.3: the reserve the AI keeps (10 turns of income, or the next three turns' dues plus a turn of upkeep)
 * and what the player holds above it, the AI's own yardstick for repaying early; and next turn's payments against
 * what the player is on course to have, when they won't fit.
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function reserveRows(view, api) {
  if (!view.mine.length) return [];
  const above = view.aboveReserveCents;
  const rows = [row(api.loc("LOC_ECONOMICS_LOANS_RESERVE"), gold(api, view.reserveCents), "",
    { tooltip: api.loc("LOC_ECONOMICS_LOANS_RESERVE_TIP") }),
    row(api.loc(above >= 0 ? "LOC_ECONOMICS_LOANS_ABOVE_RESERVE" : "LOC_ECONOMICS_LOANS_UNDER_RESERVE"),
      gold(api, Math.abs(above)), above >= 0 ? "econ-positive" : "")];
  const next = view.ahead[1];
  if (next && next.gap > 0) rows.push(note(api.loc("LOC_ECONOMICS_LOANS_AHEAD_SHORT", formatGold(next.dues),
    formatGold(next.funds))));
  return rows;
}

/**
 * @param {LoanRow} loan
 * @param {ScreenApi} api
 */
function statusPill(loan, api) {
  if (loan.state === "default") return pill(api.loc("LOC_ECONOMICS_LOAN_DEFAULT"), true);
  if (loan.overdue) return pill(api.loc("LOC_ECONOMICS_LOAN_OVERDUE", loan.missed), true);
  if (loan.emergency) return pill(api.loc("LOC_ECONOMICS_LOAN_EMERGENCY"), false);
  return pill(api.loc("LOC_ECONOMICS_LOAN_ACTIVE"), false);
}

/**
 * @param {PlanInput} input
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
export function mineSection(input, view, api) {
  const block = section(api.loc("LOC_ECONOMICS_LOANS_MINE"));
  if (!view.mine.length) { block.appendChild(empty(api.loc("LOC_ECONOMICS_LOANS_NONE"))); return block; }
  const said = feedbackLine("mine");
  if (said) block.appendChild(said);
  for (const loan of view.mine) block.appendChild(loanCard(input, loan, api));
  const lenders = [...new Set(view.mine.map((loan) => loan.lender))];
  const repudiate = el("div", "econ-actions");
  for (const lender of lenders) {
    repudiate.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPUDIATE_LENDER", api.nameOf(lender)),
      () => { setConfirming(`repudiate:${lender}`); api.rerender(); }, { className: "econ-button--warning econ-button--small" }));
  }
  block.appendChild(repudiate);
  for (const lender of lenders) {
    if (isConfirming(`repudiate:${lender}`)) block.appendChild(repudiateConfirm(input, lender, api));
  }
  return block;
}

/**
 * The payment a loan charges next turn, opening to its interest and principal.
 * @param {PlanInput} input
 * @param {LoanRow} loan
 * @param {ScreenApi} api
 */
function paymentRow(input, loan, api) {
  const record = (input.ledger?.loans || []).find((row) => row.id === loan.id);
  const parts = record && record.state === "active" ? paymentDue(record) : { interest: 0, amortisation: 0, total: 0 };
  return expander(`payment:${loan.id}`, row(api.loc("LOC_ECONOMICS_LOAN_PAYMENT"), gold(api, loan.paymentCents)), () => [
    row(api.loc("LOC_ECONOMICS_LOAN_PART_INTEREST", formatRate(loan.ratePpm)), gold(api, parts.interest)),
    row(api.loc("LOC_ECONOMICS_LOAN_PART_PRINCIPAL"), gold(api, parts.amortisation)),
  ], api.rerender, { show: api.loc("LOC_ECONOMICS_SHOW_PARTS"), hide: api.loc("LOC_ECONOMICS_HIDE_PARTS") });
}

/**
 * @param {PlanInput} input
 * @param {LoanRow} loan
 * @param {ScreenApi} api
 */
function loanCard(input, loan, api) {
  const trouble = loan.overdue || loan.state === "default";
  const card = el("div", `econ-card${trouble ? " econ-card--trouble" : ""}`);
  const head = el("div", "econ-card-head");
  const titles = el("div", "");
  titles.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_LOAN_TITLE", api.nameOf(loan.lender))));
  titles.appendChild(el("div", "econ-card-sub", api.loc("LOC_ECONOMICS_LOAN_SUB", loan.id, loan.term)));
  head.appendChild(titles);
  head.appendChild(statusPill(loan, api));
  card.appendChild(head);
  card.appendChild(facts([
    stat(api.loc("LOC_ECONOMICS_LOAN_OWED"), gold(api, loan.outstanding)),
    stat(api.loc("LOC_ECONOMICS_RATE"), formatRate(loan.ratePpm)),
    stat(api.loc("LOC_ECONOMICS_LOAN_LEFT"), api.loc("LOC_ECONOMICS_TURNS", loan.turnsLeft)),
  ]));
  card.appendChild(paymentRow(input, loan, api));
  card.appendChild(loanActions(loan, api));
  const said = feedbackLine(`loan:${loan.id}`);
  if (said) card.appendChild(said);
  for (const share of ["all", "half"]) {
    if (isConfirming(`repay:${loan.id}:${share}`)) card.appendChild(repayConfirm(input, loan, share === "all", api));
  }
  if (isConfirming(`restructure:${loan.id}`)) card.appendChild(restructureConfirm(input, loan.id, api));
  return card;
}

/**
 * Repay all, repay half and restructure; restructure says why when it can't.
 * @param {LoanRow} loan
 * @param {ScreenApi} api
 */
function loanActions(loan, api) {
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPAY_ALL"),
    () => { setConfirming(`repay:${loan.id}:all`); api.rerender(); }));
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPAY_HALF"),
    () => { setConfirming(`repay:${loan.id}:half`); api.rerender(); }));
  // AI-PLAN 4.3: any active loan can be restructured once, misses or not; a defaulted one can't.
  const canRestructure = loan.state === "active" && !loan.restructured;
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_RESTRUCTURE"),
    () => { setConfirming(`restructure:${loan.id}`); api.rerender(); }, { disabled: !canRestructure,
      reason: canRestructure ? null : api.loc(loan.restructured ? "LOC_ECONOMICS_RESTRUCTURE_WHY_DONE"
        : "LOC_ECONOMICS_RESTRUCTURE_WHY_DEFAULT") }));
  return actions;
}

/**
 * Repaying all or half: now against after for the treasury, this loan and its payment a turn (the model's own
 * schedule on what's left).
 * @param {PlanInput} input
 * @param {LoanRow} loan
 * @param {boolean} all
 * @param {ScreenApi} api
 */
function repayConfirm(input, loan, all, api) {
  const cents = all ? loan.outstanding : Math.ceil(loan.outstanding / 2);
  const balance = input.civs.find((civ) => civ.id === api.me)?.balanceCents ?? 0;
  const record = (input.ledger?.loans || []).find((row) => row.id === loan.id);
  const left = loan.outstanding - cents;
  const after = record && left > 0 ? paymentDue({ ...record, outstanding: left }).total : 0;
  return confirmCard({ title: api.loc(all ? "LOC_ECONOMICS_LOANS_REPAY_ALL" : "LOC_ECONOMICS_LOANS_REPAY_HALF"),
    lines: [changeRow(api.loc("LOC_ECONOMICS_CHANGE_TREASURY"), formatGold(balance), formatGold(balance - cents), -1),
      changeRow(api.loc("LOC_ECONOMICS_LOAN_OWED"), formatGold(loan.outstanding), formatGold(left), 1),
      changeRow(api.loc("LOC_ECONOMICS_LOAN_PAYMENT"), formatGold(loan.paymentCents), formatGold(after), 1),
      note(api.loc("LOC_ECONOMICS_REPAY_NOTE"))],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"),
    onConfirm: () => send(api, { kind: "repay", loanId: loan.id, cents }, `loan:${loan.id}`),
    rerender: api.rerender });
}

/**
 * @param {PlanInput} input
 * @param {string} loanId
 * @param {ScreenApi} api
 */
function restructureConfirm(input, loanId, api) {
  const preview = restructurePreview(/** @type {Ledger} */ (input.ledger), loanId);
  if (!preview) return el("div", "");
  const record = (input.ledger?.loans || []).find((row) => row.id === loanId);
  const before = record && record.state === "active" ? paymentDue(record).total : 0;
  return confirmCard({ title: api.loc("LOC_ECONOMICS_LOANS_RESTRUCTURE"),
    lines: [changeRow(api.loc("LOC_ECONOMICS_LOAN_PAYMENT"), formatGold(before), formatGold(preview.paymentCents),
      preview.paymentCents < before ? 1 : 0),
    changeRow(api.loc("LOC_ECONOMICS_LOAN_LEFT"), String(record ? record.term - record.paid : 0), String(preview.term)),
    note(api.loc("LOC_ECONOMICS_RESTRUCTURE_PREVIEW", formatGold(preview.outstanding),
      formatRate(preview.ratePpm), formatGold(preview.paymentCents)))],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: true,
    onConfirm: () => send(api, { kind: "restructure", loanId, pid: api.me }, `loan:${loanId}`),
    rerender: api.rerender });
}

/**
 * @param {PlanInput} input
 * @param {Party} lender
 * @param {ScreenApi} api
 */
function repudiateConfirm(input, lender, api) {
  const p = repudiationPreview(input, api.me, lender);
  const closes = p.closedTurns !== null ? api.loc("LOC_ECONOMICS_CLOSED_TURNS", p.closedTurns)
    : api.loc("LOC_ECONOMICS_CLOSED_AGES");
  const owed = input.ledger ? input.ledger.loans.filter((loan) => loan.borrower === api.me && isOpen(loan))
    .reduce((sum, loan) => sum + loan.outstanding, 0) : 0;
  const lines = [row(api.loc("LOC_ECONOMICS_REPUDIATE_KEEP"), gold(api, p.keptCents)),
    changeRow(api.loc("LOC_ECONOMICS_CHANGE_DEBT"), formatGold(owed), formatGold(owed - p.keptCents)),
    changeRow(api.loc("LOC_ECONOMICS_REPUDIATE_STANDING"), String(p.standingNow), String(p.standingAfter), -1),
    note(api.loc("LOC_ECONOMICS_REPUDIATE_PREVIEW", formatGold(p.keptCents), api.nameOf(lender), p.grudge,
      p.witnesses.length, p.witnessDelta, String(p.standingAfter), closes, p.creditTurnsLost, p.lenderDelta))];
  if (p.atWar) lines.push(note(api.loc("LOC_ECONOMICS_REPUDIATE_AT_WAR")));
  return confirmCard({ title: api.loc("LOC_ECONOMICS_LOANS_REPUDIATE_LENDER", api.nameOf(lender)), lines,
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: true,
    onConfirm: () => send(api, { kind: "repudiate", borrower: api.me, lender }, "mine"), rerender: api.rerender });
}

/**
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function lentSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_LOANS_LENT"));
  for (const loan of view.lent) {
    const card = el("div", `econ-card${loan.overdue || loan.state === "default" ? " econ-card--trouble" : ""}`);
    const head = el("div", "econ-card-head");
    const titles = el("div", "");
    titles.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_LENT_TITLE", api.nameOf(loan.borrower))));
    titles.appendChild(el("div", "econ-card-sub", api.loc("LOC_ECONOMICS_LOAN_SUB", loan.id, loan.term)));
    head.appendChild(titles);
    head.appendChild(statusPill(loan, api));
    card.appendChild(head);
    card.appendChild(facts([stat(api.loc("LOC_ECONOMICS_LENT_OWED"), gold(api, loan.outstanding)),
      stat(api.loc("LOC_ECONOMICS_RATE"), formatRate(loan.ratePpm)),
      stat(api.loc("LOC_ECONOMICS_LENT_PAYMENT"), gold(api, loan.paymentCents)),
      stat(api.loc("LOC_ECONOMICS_LOAN_LEFT"), api.loc("LOC_ECONOMICS_TURNS", loan.turnsLeft))]));
    if (loan.state === "active" && !loan.restructured) {
      card.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_ALLOW_RESTRUCTURE"),
        () => send(api, { kind: "restructure", loanId: loan.id, pid: api.me }, `lent:${loan.id}`)));
    }
    const said = feedbackLine(`lent:${loan.id}`);
    if (said) card.appendChild(said);
    block.appendChild(card);
  }
  return block;
}

/**
 * The guard switch (DESIGN 4.6) and what it can still lend this age.
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
export function guardSection(view, api) {
  const on = api.guardOn();
  const block = section(api.loc("LOC_ECONOMICS_GUARD"));
  block.appendChild(row(api.loc("LOC_ECONOMICS_GUARD_STATE"), api.loc(on ? "LOC_ECONOMICS_ON" : "LOC_ECONOMICS_OFF"),
    on ? "econ-positive" : "econ-muted"));
  block.appendChild(row(api.loc("LOC_ECONOMICS_GUARD_ALLOWANCE"), api.loc("LOC_ECONOMICS_LOANS_SERVICE_OF",
    formatGold(Math.max(0, view.emergencyCapCents - view.emergencyOpenCents)), formatGold(view.emergencyCapCents))));
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc(on ? "LOC_ECONOMICS_GUARD_SWITCH_OFF" : "LOC_ECONOMICS_GUARD_SWITCH_ON"),
    () => {
      api.setGuard(!on);
      say(api.loc(on ? "LOC_ECONOMICS_GUARD_SAID_OFF" : "LOC_ECONOMICS_GUARD_SAID_ON"), { at: "guard" });
      api.rerender();
    }));
  block.appendChild(actions);
  const said = feedbackLine("guard");
  if (said) block.appendChild(said);
  block.appendChild(note(api.loc("LOC_ECONOMICS_GUARD_NOTE")));
  return block;
}

/**
 * The requests waiting for the next turn, each with a way to take it back.
 * @param {ScreenApi} api
 */
export function pendingSection(api) {
  const pending = api.pending();
  const block = section(api.loc("LOC_ECONOMICS_LOANS_PENDING"));
  if (!pending.length) { block.appendChild(empty(api.loc("LOC_ECONOMICS_LOANS_PENDING_NONE"))); return block; }
  pending.forEach((request, index) => {
    const line = el("div", "econ-row");
    line.appendChild(el("div", "econ-row-label", api.loc(requestKey(request.kind))));
    line.appendChild(button(api.loc("LOC_ECONOMICS_CANCEL"), () => { api.dropRequest(index); api.rerender(); },
      { className: "econ-button--small econ-button--quiet" }));
    block.appendChild(line);
  });
  block.appendChild(note(api.loc("LOC_ECONOMICS_LOANS_PENDING_NOTE")));
  return block;
}

/** Test hook. */
export function resetConfirmForTests() {
  setConfirming(null);
}
