// econ-view-loans.js - Economics: the Loans tab (DESIGN 5, 9): the player's limits and standing, what it owes
// (overdue first) with repay, restructure and repudiate, what it has lent, the guard switch and its allowance, and
// the requests queued for the next batch. The borrow and lend forms are in econ-view-borrow.js. Before a repudiation
// or a restructure is queued, the tab shows what DESIGN 5 says to show and asks once more.

import { button, el, note, pill, row, section } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { loansView, repudiationPreview, restructurePreview } from "./econ-view-model.js";
import { renderBorrow, renderLend } from "./econ-view-borrow.js";
import { requestKey } from "./econ-notice-text.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */
/** @typedef {ReturnType<typeof loansView>["mine"][number]} LoanRow */

/** What the player is being asked to confirm, kept across re-renders. */
/** @type {{ kind: "repudiate", lender: Party } | { kind: "restructure", loanId: string } | null} */
let confirming = null;

/** @param {ScreenApi} api @param {number} cents */
const gold = (api, cents) => api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents));

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderLoans(host, api) {
  const input = api.input();
  const view = loansView(input, api.me);
  host.appendChild(limitsSection(view, api));
  host.appendChild(stageSection(view, api));
  if (view.stages.moneylending || view.stages.publicDebt) host.appendChild(renderBorrow(input, view, api));
  host.appendChild(mineSection(input, view, api));
  if (view.lent.length) host.appendChild(lentSection(view, api));
  if (view.stages.publicDebt) host.appendChild(renderLend(input, api));
  host.appendChild(guardSection(view, api));
  host.appendChild(pendingSection(api));
}

/**
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function limitsSection(view, api) {
  return section(api.loc("LOC_ECONOMICS_LOANS_LIMITS"), [
    row(api.loc("LOC_ECONOMICS_LOANS_CREDIT_ROOM"), gold(api, view.creditRoomCents)),
    row(api.loc("LOC_ECONOMICS_LOANS_SERVICE"), api.loc("LOC_ECONOMICS_LOANS_SERVICE_OF",
      formatGold(view.serviceCents), formatGold(view.serviceCapCents))),
    row(api.loc("LOC_ECONOMICS_LOANS_STANDING"), (view.standingPct / 100).toFixed(2)),
  ]);
}

/**
 * The parts a civ hasn't reached, greyed with the node that opens them (DESIGN 4.15).
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function stageSection(view, api) {
  /** @type {HTMLElement[]} */
  const lines = [];
  const closed = (/** @type {string} */ partKey, /** @type {string} */ stage) => {
    const opener = api.stageOpener(stage);
    const by = opener ? api.loc(opener) : api.loc("LOC_ECONOMICS_STAGE_NEXT_AGE");
    lines.push(el("div", "econ-line econ-muted", api.loc("LOC_ECONOMICS_LOANS_STAGE_CLOSED", api.loc(partKey), by)));
  };
  if (!view.stages.moneylending) closed("LOC_ECONOMICS_PART_CIV_LOANS", "moneylending");
  if (!view.stages.publicDebt) closed("LOC_ECONOMICS_PART_BOND", "publicDebt");
  const block = section(api.loc("LOC_ECONOMICS_LOANS_STAGES"), lines);
  if (!lines.length) block.appendChild(note(api.loc("LOC_ECONOMICS_LOANS_STAGES_ALL_OPEN")));
  return block;
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
function mineSection(input, view, api) {
  const block = section(api.loc("LOC_ECONOMICS_LOANS_MINE"));
  if (!view.mine.length) { block.appendChild(note(api.loc("LOC_ECONOMICS_LOANS_NONE"))); return block; }
  for (const loan of view.mine) block.appendChild(loanCard(input, loan, api));
  const lenders = [...new Set(view.mine.map((loan) => loan.lender))];
  const repudiate = el("div", "econ-actions");
  for (const lender of lenders) {
    repudiate.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPUDIATE_LENDER", api.nameOf(lender)),
      () => { confirming = { kind: "repudiate", lender }; api.rerender(); }));
  }
  block.appendChild(repudiate);
  if (confirming?.kind === "repudiate") block.appendChild(repudiateConfirm(input, confirming.lender, api));
  return block;
}

/**
 * @param {PlanInput} input
 * @param {LoanRow} loan
 * @param {ScreenApi} api
 */
function loanCard(input, loan, api) {
  const card = el("div", "econ-card");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_LOAN_ROW", loan.id, formatGold(loan.outstanding),
    api.nameOf(loan.lender), formatRate(loan.ratePpm), loan.turnsLeft)));
  head.appendChild(statusPill(loan, api));
  card.appendChild(head);
  card.appendChild(row(api.loc("LOC_ECONOMICS_LOAN_PAYMENT"), gold(api, loan.paymentCents)));
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPAY_ALL"),
    () => { api.request({ kind: "repay", loanId: loan.id, cents: loan.outstanding }); api.rerender(); }));
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_REPAY_HALF"),
    () => { api.request({ kind: "repay", loanId: loan.id, cents: Math.ceil(loan.outstanding / 2) }); api.rerender(); }));
  const canRestructure = loan.overdue && !loan.restructured;
  actions.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_RESTRUCTURE"),
    () => { confirming = { kind: "restructure", loanId: loan.id }; api.rerender(); }, { disabled: !canRestructure }));
  card.appendChild(actions);
  if (confirming?.kind === "restructure" && confirming.loanId === loan.id) {
    card.appendChild(restructureConfirm(input, loan.id, api));
  }
  return card;
}

/**
 * @param {PlanInput} input
 * @param {string} loanId
 * @param {ScreenApi} api
 */
function restructureConfirm(input, loanId, api) {
  const preview = restructurePreview(/** @type {Ledger} */ (input.ledger), loanId);
  const box = el("div", "econ-confirm");
  if (!preview) return box;
  box.appendChild(note(api.loc("LOC_ECONOMICS_RESTRUCTURE_PREVIEW", formatGold(preview.outstanding),
    formatRate(preview.ratePpm), formatGold(preview.paymentCents))));
  box.appendChild(confirmButtons(api, () => api.request({ kind: "restructure", loanId, pid: api.me })));
  return box;
}

/**
 * @param {PlanInput} input
 * @param {Party} lender
 * @param {ScreenApi} api
 */
function repudiateConfirm(input, lender, api) {
  const p = repudiationPreview(input, api.me, lender);
  const box = el("div", "econ-confirm");
  const closes = p.closedTurns !== null ? api.loc("LOC_ECONOMICS_CLOSED_TURNS", p.closedTurns)
    : api.loc("LOC_ECONOMICS_CLOSED_AGES");
  box.appendChild(note(api.loc("LOC_ECONOMICS_REPUDIATE_PREVIEW", formatGold(p.keptCents), api.nameOf(lender),
    p.grudge, p.witnesses.length, p.witnessDelta, (p.standingAfter / 100).toFixed(2), closes, p.creditTurnsLost)));
  if (p.atWar) box.appendChild(note(api.loc("LOC_ECONOMICS_REPUDIATE_AT_WAR")));
  box.appendChild(confirmButtons(api, () => api.request({ kind: "repudiate", borrower: api.me, lender })));
  return box;
}

/**
 * @param {ScreenApi} api
 * @param {() => void} onConfirm
 */
function confirmButtons(api, onConfirm) {
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc("LOC_ECONOMICS_CONFIRM"), () => { onConfirm(); confirming = null; api.rerender(); },
    { className: "econ-button--warning" }));
  actions.appendChild(button(api.loc("LOC_ECONOMICS_CANCEL"), () => { confirming = null; api.rerender(); }));
  return actions;
}

/**
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function lentSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_LOANS_LENT"));
  for (const loan of view.lent) {
    const card = el("div", "econ-card");
    const head = el("div", "econ-card-head");
    head.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_LENT_ROW", loan.id, formatGold(loan.outstanding),
      api.nameOf(loan.borrower), formatRate(loan.ratePpm), loan.turnsLeft)));
    head.appendChild(statusPill(loan, api));
    card.appendChild(head);
    if (loan.overdue && !loan.restructured) {
      card.appendChild(button(api.loc("LOC_ECONOMICS_LOANS_ALLOW_RESTRUCTURE"),
        () => { api.request({ kind: "restructure", loanId: loan.id, pid: api.me }); api.rerender(); }));
    }
    block.appendChild(card);
  }
  return block;
}

/**
 * @param {ReturnType<typeof loansView>} view
 * @param {ScreenApi} api
 */
function guardSection(view, api) {
  const on = api.guardOn();
  const block = section(api.loc("LOC_ECONOMICS_GUARD"), [
    row(api.loc("LOC_ECONOMICS_GUARD_STATE"), api.loc(on ? "LOC_ECONOMICS_ON" : "LOC_ECONOMICS_OFF")),
    row(api.loc("LOC_ECONOMICS_GUARD_ALLOWANCE"), api.loc("LOC_ECONOMICS_LOANS_SERVICE_OF",
      formatGold(Math.max(0, view.emergencyCapCents - view.emergencyOpenCents)), formatGold(view.emergencyCapCents))),
  ]);
  const actions = el("div", "econ-actions");
  actions.appendChild(button(api.loc(on ? "LOC_ECONOMICS_GUARD_SWITCH_OFF" : "LOC_ECONOMICS_GUARD_SWITCH_ON"),
    () => { api.setGuard(!on); api.rerender(); }));
  block.appendChild(actions);
  block.appendChild(note(api.loc("LOC_ECONOMICS_GUARD_NOTE")));
  return block;
}

/**
 * The requests waiting for the next batch, each with a way to take it back.
 * @param {ScreenApi} api
 */
function pendingSection(api) {
  const pending = api.pending();
  const block = section(api.loc("LOC_ECONOMICS_LOANS_PENDING"));
  if (!pending.length) { block.appendChild(note(api.loc("LOC_ECONOMICS_LOANS_PENDING_NONE"))); return block; }
  pending.forEach((request, index) => {
    const line = el("div", "econ-actions");
    line.appendChild(el("div", "econ-line", api.loc(requestKey(request.kind))));
    line.appendChild(button(api.loc("LOC_ECONOMICS_CANCEL"), () => { api.dropRequest(index); api.rerender(); },
      { className: "econ-button--small" }));
    block.appendChild(line);
  });
  block.appendChild(note(api.loc("LOC_ECONOMICS_LOANS_PENDING_NOTE")));
  return block;
}

/** Test hook. */
export function resetConfirmForTests() {
  confirming = null;
}
