// econ-distress.js - Economics: the distress read (AI-PLAN 4.1). Before any payment runs, each civ's dues for the
// turn (the scheduled loan payments, the dividends it owes, the trade settlements it pays, and the turn's own macro
// charges that come off its funds first: a slump's cycle charge, the plan's take, erosion) are read against its funds
// (econ-batch.js). Short means dues above funds, whatever the sign of income; the gap is what a refinancing loan has
// to cover. The same read serves the human's guard, the AI's shortfall rule and the player's lend offer, so both
// sides play one rule. Nothing here moves Gold or reads the engine. The macro charges joined the read after the
// stage A watch run (2026-10-31): a refinanced civ still came up short by its cycle charge, to the cent.

import { paymentDue } from "./econ-loan.js";
import { dividendDue, growthMille } from "./econ-invest.js";
import { hasStage } from "./econ-stages.js";
import { takesCapitalism } from "./econ-systems.js";
import { funds } from "./econ-batch.js";
import { incomeOf, termsFor } from "./econ-turn.js";
import { cycleGoldCents, swingFor } from "./econ-cycle.js";
import { planTakeCents } from "./econ-planned.js";
import { RESERVE } from "./econ-params.js";

/**
 * A partnership's interest moves with the borrower's income since it opened (DESIGN 4.17); any other loan's is flat.
 * @param {TurnContext} ctx
 * @param {Loan} loan
 */
export function loanGrowth(ctx, loan) {
  return loan.partnership === true ? growthMille(incomeOf(ctx, loan.borrower), loan.baseIncome ?? 0) : 1000;
}

/**
 * Whether the Capitalism stage's equity range applies on a host (DESIGN 4.15): a Market or Mixed civ past it.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function equityOn(ctx, pid) {
  return hasStage(ctx.civ.get(pid), "capitalism", ctx.turn, ctx.options)
    && takesCapitalism(ctx.macro.systems[String(pid)]?.system);
}

/**
 * What a civ owes this turn before anything is paid: its scheduled loan payments (loans opened before this turn),
 * the dividends on the investments it hosts, and the trade settlements it pays.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function duesOf(ctx, pid) {
  const loans = loanDues(ctx, pid);
  const dividends = dividendDues(ctx, pid);
  let trade = 0;
  for (const row of ctx.trade || []) if (row.payer === pid && row.cents > 0) trade += row.cents;
  const macro = macroDues(ctx, pid);
  return { loans, dividends, trade, macro, total: loans + dividends + trade + macro };
}

/**
 * The 1.2 charges a payer meets before its loans (econ-macro.js macroPayerSteps): erosion, the plan's take, and a
 * slump's cycle charge. Each is skipped when unfunded, but while funded it comes off the Gold the loans would use.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function macroDues(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ) return 0;
  const terms = termsFor(ctx, pid);
  let sum = 0;
  const reading = ctx.readings.civ.get(pid);
  if (reading && ctx.readings.kPct !== 0 && !terms.outOfCycle) {
    sum += Math.max(0, -cycleGoldCents(reading.index, civ.incomeCents, swingFor(ctx.options.swings)));
  }
  if (terms.plan) sum += planTakeCents(civ.incomeCents);
  return sum;
}

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function loanDues(ctx, pid) {
  let sum = 0;
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && loan.state === "active" && loan.opened < ctx.turn) {
      sum += paymentDue(loan, loanGrowth(ctx, loan)).total;
    }
  }
  return sum;
}

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function dividendDues(ctx, pid) {
  let sum = 0;
  for (const record of ctx.ledger.investments || []) {
    if (record.host === pid && record.state === "active" && record.opened < ctx.turn) {
      sum += dividendDue(record, incomeOf(ctx, pid), equityOn(ctx, pid));
    }
  }
  return sum;
}

/**
 * A civ's funds for the read: what the batch gives it, plus what it still holds in escrow for this turn's payments
 * when the read comes before the escrow's release (the row reads 0 once released, so nothing is counted twice).
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function fundsOf(ctx, pid) {
  return funds(ctx.batch, pid) + (ctx.ledger.escrow.find((row) => row.pid === pid)?.cents || 0);
}

/**
 * The scheduled payments on a loan over the next `turns` turns, as if each were paid in full.
 * @param {TurnContext} ctx
 * @param {Loan} loan
 * @param {number} turns
 */
function scheduleAhead(ctx, loan, turns) {
  /** @type {number[]} */
  const out = [];
  let next = loan;
  for (let k = 0; k < turns; k += 1) {
    if (next.state !== "active" || next.outstanding <= 0) { out.push(0); continue; }
    const due = paymentDue(next, loanGrowth(ctx, loan));
    out.push(due.total);
    next = { ...next, outstanding: next.outstanding - due.amortisation, paid: next.paid + 1 };
  }
  return out;
}

/**
 * AI-PLAN 4.3: the next `turns` turns' dues against the funds the civ is on course to have, income held flat and
 * this turn's dues met first (or missed, which leaves the Gold). Entry 0 is this turn (the distress read), entry k
 * the k-th turn after. Dividends and bills are held at this turn's figures; a loan's payments follow its schedule.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} [turns]
 * @returns {{ dues: number, funds: number, gap: number }[]}
 */
export function lookAhead(ctx, pid, turns = RESERVE.aheadTurns) {
  const now = distressOf(ctx, pid);
  const mine = ctx.ledger.loans.filter((loan) => loan.borrower === pid && loan.state === "active");
  const schedules = mine.map((loan) => scheduleAhead(ctx, loan, turns + 1));
  const other = now.parts.dividends + now.parts.trade + now.parts.macro;
  const income = incomeOf(ctx, pid);
  /** @type {{ dues: number, funds: number, gap: number }[]} */
  const out = [{ dues: now.dues, funds: now.funds, gap: now.gap }];
  let have = Math.max(0, now.funds - now.dues);
  for (let k = 1; k <= turns; k += 1) {
    let loans = 0;
    for (const [i, loan] of mine.entries()) loans += loan.opened < ctx.turn ? schedules[i][k] : schedules[i][k - 1];
    const dues = loans + other;
    const available = have + income;
    out.push({ dues, funds: available, gap: dues > 0 ? Math.max(0, dues - available) : 0 });
    have = Math.max(0, available - dues);
  }
  return out;
}

/**
 * AI-PLAN 4.3: a civ's reserve, 10 turns of income or the next three turns' dues plus a turn of upkeep, whichever is
 * more; what it holds above it is what it can spare for early repayment.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function reserveOf(ctx, pid) {
  const civ = ctx.civ.get(pid);
  const ahead = lookAhead(ctx, pid);
  let dues = 0;
  for (const row of ahead.slice(1)) dues += row.dues;
  const reserve = Math.max(RESERVE.incomeTurns * Math.max(0, civ?.incomeCents || 0),
    dues + Math.max(0, civ?.upkeepCents || 0));
  return { reserveCents: reserve, aboveCents: fundsOf(ctx, pid) - reserve, ahead };
}

/**
 * The distress read for one civ: its dues against its funds now. `gap` is what's missing to pay everything due;
 * `short` is true when a payment, dividend or bill is due and the funds don't reach it with the macro charges taken
 * first. A civ with nothing of those due is never short, however low its balance: a dip with nothing to pay is the
 * guard's and the engine's business (DESIGN 4.6, P4), and a slump's charge alone is skipped, not borrowed for.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @returns {{ dues: number, parts: { loans: number, dividends: number, trade: number, macro: number },
 *   funds: number, gap: number, short: boolean }}
 */
export function distressOf(ctx, pid) {
  const parts = duesOf(ctx, pid);
  const have = fundsOf(ctx, pid);
  const owed = parts.loans + parts.dividends + parts.trade;
  const gap = owed > 0 ? Math.max(0, parts.total - have) : 0;
  return { dues: parts.total, parts, funds: have, gap, short: gap > 0 };
}
