import test from "node:test";
import assert from "node:assert/strict";

import { amortisationDue, firstPayment, interestDue, isOpen, isOverdue, loanId, loanSeq, makeLoan, paymentDue, repay,
  restructure, scheduledSlice, totalInterest } from "../ui/econ-loan.js";
import { applyPpm, divCeil, divRound, ppmOf, toCents, toGold } from "../ui/econ-money.js";
import { gen } from "./_prng.mjs";

const loan = (over = {}) => ({ ...makeLoan({ id: "L1", lender: "bond", borrower: 4, principal: 30000, ratePpm: 20000,
  term: 20, turn: 10 }), ...over });

test("money: gold to cents and back at the boundary; unreadable is 0", () => {
  assert.equal(toCents(12.34), 1234);
  assert.equal(toCents("-10"), -1000);
  assert.equal(toCents(NaN), 0);
  assert.equal(Object.is(toCents(-0.001), 0), true);
  assert.equal(toGold(1234), 12.34);
  assert.equal(ppmOf(0.02), 20000);
  assert.equal(divRound(5, 2), 3);
  assert.equal(divRound(4, 3), 1);
  assert.equal(divCeil(11, 10), 2);
  assert.equal(applyPpm(30000, 20000), 600);
});

test("loan record: DESIGN 4.1 shape with the emergency and restructured flags, kind loan, active, no misses", () => {
  assert.deepEqual(Object.keys(loan()).sort(), ["borrower", "closedTurn", "emergency", "id", "kind", "lender", "missed",
    "opened", "outstanding", "paid", "principal", "ratePpm", "restructured", "source", "state", "term", "writtenOff"]);
  assert.equal(loan().outstanding, 30000);
  assert.equal(loan().state, "active");
  assert.equal(loan().kind, "loan");
  assert.equal(loan().emergency, false);
  assert.equal(makeLoan({ id: "L2", lender: "temple", borrower: 1, principal: 1, ratePpm: 1, term: 10, turn: 1,
    emergency: true, source: "guard" }).emergency, true);
  assert.equal(loanId(7), "L7");
  assert.equal(loanSeq("L7"), 7);
  assert.equal(loanSeq("X7"), 0);
  assert.equal(loanSeq("L0"), 0);
});

test("open and overdue: active and defaulted loans are open; active with a miss is overdue", () => {
  assert.equal(isOpen(loan()), true);
  assert.equal(isOpen(loan({ state: "default" })), true);
  assert.equal(isOpen(loan({ state: "closed" })), false);
  assert.equal(isOpen(loan({ state: "repudiated" })), false);
  assert.equal(isOverdue(loan()), false);
  assert.equal(isOverdue(loan({ missed: 1 })), true);
  assert.equal(isOverdue(loan({ missed: 3, state: "default" })), false);
});

test("interest is O * r: 300 Gold at 0.02 is 6 Gold", () => {
  assert.equal(interestDue(loan()), 600);
  assert.equal(interestDue(loan({ outstanding: 15000 })), 300);
});

test("amortisation is P / T: 300 Gold over 20 turns is 15 Gold a turn", () => {
  assert.equal(amortisationDue(loan()), 1500);
  assert.deepEqual(paymentDue(loan()), { interest: 600, amortisation: 1500, total: 2100 });
  assert.equal(firstPayment(30000, 20000, 20), 2100);
});

test("amortisation: an uneven P spreads the odd cents so the slices sum to P", () => {
  const slices = Array.from({ length: 3 }, (_, k) => scheduledSlice(100, 3, k + 1));
  assert.deepEqual(slices, [33, 33, 34]);
});

test("amortisation: never more than what is outstanding, and the whole remainder at term", () => {
  assert.equal(amortisationDue(loan({ outstanding: 700 })), 700);
  assert.equal(amortisationDue(loan({ paid: 19, outstanding: 1501 })), 1501);
  assert.equal(amortisationDue(loan({ paid: 25, outstanding: 99 })), 99);
});

test("property: paying every slice reaches exactly 0 at T with no residue (500 cases)", () => {
  const g = gen(4242);
  for (let i = 0; i < 500; i += 1) {
    const P = g.int(1, 5_000_000);
    const T = g.pick([1, 3, 7, 10, 20, 30]);
    let l = loan({ principal: P, outstanding: P, term: T });
    let sum = 0;
    for (let k = 0; k < T; k += 1) {
      const a = amortisationDue(l);
      assert.ok(a >= 0);
      sum += a;
      l = { ...l, outstanding: l.outstanding - a, paid: l.paid + 1 };
    }
    assert.equal(l.outstanding, 0, `P=${P} T=${T}`);
    assert.equal(sum, P);
  }
});

test("restructure (DESIGN 4.4): what's left spread over 10 turns from now, rate kept, m to 0, flagged once", () => {
  const r = restructure(loan({ outstanding: 12345, missed: 2, paid: 7, ratePpm: 31250 }));
  assert.equal(r.principal, 12345);
  assert.equal(r.outstanding, 12345);
  assert.equal(r.term, 10);
  assert.equal(r.paid, 0);
  assert.equal(r.missed, 0);
  assert.equal(r.ratePpm, 31250);
  assert.equal(r.restructured, true);
  assert.equal(amortisationDue(r), 1234);
});

test("early repayment: any amount, capped at what is outstanding; full repayment closes", () => {
  assert.equal(repay(loan(), 1234).loan.outstanding, 30000 - 1234);
  assert.equal(repay(loan(), 1234).applied, 1234);
  assert.equal(repay(loan(), 99999).applied, 30000);
  assert.equal(repay(loan(), 99999).loan.state, "closed");
  assert.equal(repay(loan(), -5).applied, 0);
  assert.equal(repay(loan(), "x").applied, 0);
});

test("total interest: the figure the borrow screen shows before confirming", () => {
  // 300 over 20 at 2 percent: interest on 300, 285, ..., 15 = 0.02 * 15 * (20 * 21 / 2) = 63 Gold.
  assert.equal(totalInterest(30000, 20000, 20), 6300);
  // DESIGN 4.3: a 10-turn loan at 0.03 costs about 16.5 percent of P; at r_cap (0.12) about 66 percent.
  assert.equal(totalInterest(10000, 30000, 10), 1650);
  assert.equal(totalInterest(10000, 120000, 10), 6600);
});
