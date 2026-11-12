// The escrow account and the AI's preference rows (AI-PLAN 4.2): next turn's dues held outside the treasury after
// the payments and released into the funds at the start of the next turn, two turns' worth for a civ in distress,
// within what the civ has; the account nets to zero over a loan's life (debt-8); a civ that dies loses what it held;
// a ledger without the account holds nothing. The preference rows: every AI's every turn, the Gold bias up with its debt service,
// the budgets down in distress.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { checkPlan, debt8 } from "../ui/econ-invariants.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { escrowOf } from "../ui/econ-escrow.js";
import { treasuryView } from "../ui/econ-view-model.js";
import { CLOSED, PARAMS, civ, input } from "./_fixtures.mjs";
import { step, world } from "./_sim.mjs";

const ME = 3;
const AI = 6;
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, ...over });
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });
const ledgerWith = (loans, over = {}) => ({ ...emptyLedger(), loans, nextId: loans.length + 1, ...over });
const escrow = (plan) => plan.transfers.filter((t) => t.reason === "escrow").map((t) => [t.from, t.to, t.cents]);

test("after the payments, next turn's dues are held in escrow; they come back into the funds at the next turn", () => {
  const first = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [me({ balanceCents: 10000 })] }));
  assert.deepEqual(escrow(first), [[ME, "escrow", 2070]], "28500 at 2% plus the 1500 slice");
  assert.deepEqual(first.ledger.escrow, [{ pid: ME, cents: 2070 }]);
  assert.equal(first.batch.civs[0].net, -2100 - 2070, "the payment and the hold both leave the treasury");
  assert.deepEqual(checkPlan({ plan: first, civs: [me()] }), []);
  const next = planTurn(input({ turn: 51, ledger: first.ledger, civs: [me({ balanceCents: 0, incomeCents: 2040 })] }));
  assert.deepEqual(escrow(next), [["escrow", ME, 2070], [ME, "escrow", 2040]], "released, paid from, held again");
  assert.equal(next.transfers.find((t) => t.reason === "payment").cents, 2070, "the payment is made from the escrow");
  assert.deepEqual(next.influence, [], "no miss with nothing in the treasury: the escrow covered it");
  assert.equal(escrowOf(next.ledger, ME), 2040);
  const broke = planTurn(input({ turn: 51, ledger: first.ledger, civs: [me({ balanceCents: 0, incomeCents: 0 })] }));
  assert.deepEqual(escrow(broke), [["escrow", ME, 2070]], "nothing left after the payment: nothing held");
});

test("the account nets to zero over a loan's life, and a civ with nothing open holds nothing", () => {
  let w = world({ civs: [me({ balanceCents: 0, incomeCents: 5000 })], params: PARAMS });
  let held = 0;
  let released = 0;
  let paid = 0;
  const count = (plan) => {
    for (const t of plan.transfers) {
      if (t.to === "escrow") held += t.cents;
      if (t.from === "escrow") released += t.cents;
      if (t.reason === "payment") paid += t.cents;
    }
  };
  const opened = step(w, { requests: [{ kind: "borrow", borrower: ME, lender: "bond", principal: 12345, term: 10 }] });
  count(opened.plan);
  w = opened.next;
  for (let k = 0; k < 11; k += 1) {
    const { plan, next } = step(w);
    count(plan);
    w = next;
  }
  assert.equal(w.ledger.loans[0].state, "closed");
  assert.deepEqual(w.ledger.escrow, [], "nothing held once the loan is closed");
  assert.equal(released, held, "every Gold put in came back");
  assert.equal(w.balances.get(ME), 5000 * 12 + 12345 - paid, "the treasury ends where income, the loan and its payments put it");
});

test("a civ in distress (short this turn or last) has two turns' dues held, within what it has left", () => {
  const due = loan("L1", { borrower: AI, principal: 10000, outstanding: 10000, ratePpm: 20000, term: 10, opened: 1 });
  const lender = civ(8, { balanceCents: 300000, incomeCents: 1000 });
  const short = planTurn(input({ ledger: ledgerWith([due]), civs: [me(), civ(AI, { balanceCents: 0, incomeCents: 1000 }),
    lender] }));
  assert.equal(short.events.some((e) => e.kind === "refinance" && e.pid === AI), true);
  assert.equal(escrowOf(short.ledger, AI), 0, "short this turn: nothing left to hold after the payment");
  assert.deepEqual(short.ledger.distress, [{ pid: AI, turn: 50 }]);
  const after = planTurn(input({ turn: 51, ledger: short.ledger, civs: [me(), civ(AI, { balanceCents: 0,
    incomeCents: 100000 }), lender] }));
  const dues = after.ledger.loans.filter((l) => l.borrower === AI && l.state === "active")
    .reduce((sum, l) => sum + Math.round(l.outstanding * 0.02) + Math.floor(l.principal / 10), 0);
  assert.ok(escrowOf(after.ledger, AI) > dues && escrowOf(after.ledger, AI) <= 2 * dues + 2,
    `held ${escrowOf(after.ledger, AI)} against ${dues} a turn: two turns' worth the turn after it was short`);
  const calm = planTurn(input({ turn: 52, ledger: after.ledger, civs: [me(), civ(AI, { balanceCents: 0,
    incomeCents: 100000 }), lender] }));
  assert.ok(escrowOf(calm.ledger, AI) <= dues + 2, "two turns on, one turn's dues again");
  const poor = planTurn(input({ ledger: ledgerWith([loan("L1", { opened: 1 })]), civs: [me({ balanceCents: 0,
    incomeCents: 2500, stages: CLOSED })], options: { guard: false } }));
  assert.deepEqual(escrow(poor), [[ME, "escrow", 400]], "25 of funds, 21 paid, the 4 left is held");
  assert.deepEqual(checkPlan({ plan: poor, civs: [me()] }), []);
});

test("a civ that dies loses what it held; Loans off releases and holds nothing; a ledger without the account holds nothing", () => {
  const held = ledgerWith([loan("L1")], { escrow: [{ pid: ME, cents: 2070 }] });
  const gone = planTurn(input({ ledger: held, civs: [me({ alive: false })] }));
  assert.deepEqual(gone.ledger.escrow, []);
  assert.deepEqual(gone.events.filter((e) => e.kind === "escrow-lost"), [{ turn: 50, kind: "escrow-lost", pid: ME,
    cents: 2070 }]);
  assert.deepEqual(gone.transfers, []);
  const off = planTurn(input({ ledger: held, civs: [me()], options: { loans: false } }));
  assert.deepEqual(escrow(off), [["escrow", ME, 2070]], "what a save held comes back, nothing new is held");
  assert.deepEqual(off.ledger.escrow, []);
  const old = JSON.parse(save(ledgerWith([loan("L1")])));
  delete old.ledger.escrow;
  assert.deepEqual(load(JSON.stringify(old)).ledger.escrow, []);
  assert.deepEqual(load(save({ ...emptyLedger(), escrow: [{ pid: 1, cents: 5 }, { pid: 2, cents: 0 }, { pid: 1,
    cents: 9 }] })).ledger.escrow, [{ pid: 1, cents: 5 }], "one row per civ, empty rows dropped");
});

test("debt-8: the escrow's books agree with its flows", () => {
  const ledger = { ...emptyLedger(), loans: [loan("L1")], escrow: [{ pid: ME, cents: 500 }] };
  const hold = (cents) => ({ loanId: `EH${ME}`, turn: 50, from: ME, to: "escrow", cents, reason: "escrow", parts: {} });
  assert.deepEqual(debt8(ledger, [hold(500)]), []);
  assert.equal(debt8(ledger, [hold(400)]).length, 1, "held 400, holds 500");
  assert.equal(debt8({ ...ledger, escrow: [{ pid: ME, cents: -1 }] }, [hold(-1)]).length, 1);
  assert.equal(debt8({ ...ledger, loans: [] }, [hold(500)]).length, 1, "nothing open");
  assert.equal(debt8({ ...ledger, escrow: [] }, [hold(500)]).length, 1, "put in with no row");
});

test("the Treasury tab shows what's in escrow", () => {
  const ledger = ledgerWith([loan("L1")], { escrow: [{ pid: ME, cents: 2070 }] });
  assert.equal(treasuryView(input({ ledger, civs: [me()] }), ME).escrowCents, 2070);
  assert.equal(treasuryView(input({ civs: [me()] }), ME).escrowCents, 0);
});

test("preference rows (AI-PLAN 4.2): every AI's every turn; the Gold bias up with service, the budgets down in distress",
  () => {
    const rowsOf = (plan, pid) => plan.aiPreferences.filter((r) => r.pid === pid).map((r) => [r.system, r.item, r.factor]);
    const quiet = planTurn(input({ civs: [me(), civ(AI, { incomeCents: 10000 })] }));
    assert.deepEqual(rowsOf(quiet, AI), [["YieldBiases", "YIELD_GOLD", 1], ["AiBudgetBiases", "AI_BUDGET_STANDING_ARMY", 1],
      ["AiBudgetBiases", "AI_BUDGET_EXPANSION", 1]], "no debt: every factor sent as 1");
    assert.deepEqual(rowsOf(quiet, ME), [], "never for the human");
    // Service 2070 on 10000 of income: 20.7%, so 1 + 10 * 0.207 = 3.07 on the Gold bias; not in distress: budgets 1.
    // Balances under the reserve (10 turns of income), so no early repayment moves the service.
    const owes = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: AI })]), civs: [me(), civ(AI, {
      incomeCents: 10000, balanceCents: 50000 })] }));
    assert.deepEqual(rowsOf(owes, AI).map((r) => r[2]), [3.07, 1, 1]);
    const light = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: AI, principal: 1000, outstanding: 1000,
      term: 20 })]), civs: [me(), civ(AI, { incomeCents: 10000, balanceCents: 50000 })] }));
    assert.deepEqual(rowsOf(light, AI).map((r) => r[2]), [1, 1, 1], "service under a tenth of income: 1");
    const heavy = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: AI, principal: 300000,
      outstanding: 300000, term: 20 })]), civs: [me(), civ(AI, { incomeCents: 10000, balanceCents: 50000 })] }));
    assert.deepEqual(rowsOf(heavy, AI).map((r) => r[2]), [5, 1, 1], "capped at 5");
    // In distress (short this turn): the budgets at 1 / the Gold factor, never below 0.25.
    const due = loan("L1", { borrower: AI, principal: 10000, outstanding: 10000, ratePpm: 20000, term: 10, opened: 1 });
    const short = planTurn(input({ ledger: ledgerWith([due]), civs: [me(), civ(AI, { balanceCents: 0, incomeCents: 1000 }),
      civ(8, { balanceCents: 300000, incomeCents: 1000 })] }));
    assert.equal(short.events.some((e) => e.kind === "refinance" && e.pid === AI), true);
    const [gold, army, expansion] = rowsOf(short, AI).map((r) => r[2]);
    assert.equal(gold, 5, "payments past income: the cap");
    assert.deepEqual([army, expansion], [0.25, 0.25], "1 / 5 is under the floor of 0.25");
    assert.deepEqual(planTurn(input({ civs: [me(), civ(AI)], options: { ai: false } })).aiPreferences, [],
      "AI rules off: nothing sent");
    assert.deepEqual(planTurn(input({ civs: [me(), civ(AI, { alive: false })] })).aiPreferences, [], "a dead civ: nothing");
  });
