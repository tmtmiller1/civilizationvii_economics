import test from "node:test";
import assert from "node:assert/strict";

import { garnishDue, missRate, settleActive, settleDefault, withBlock } from "../ui/econ-payments.js";
import { makeLoan } from "../ui/econ-loan.js";

const loan = (over = {}) => ({ ...makeLoan({ id: "L1", lender: 6, borrower: 2, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });

test("a payment that fits is taken whole: interest plus amortisation, paid count up, m back to 0", () => {
  const r = settleActive(loan({ missed: 2 }), 2100);
  assert.equal(r.missed, false);
  assert.equal(r.cents, 2100);
  assert.equal(r.loan.outstanding, 28500);
  assert.equal(r.loan.paid, 1);
  assert.equal(r.loan.missed, 0, "a paid turn resets the run of misses (DESIGN 4.4)");
});

test("a payment the funds can't cover is a miss: m + 1, r * 1.25, the interest added to O, nothing taken", () => {
  const r = settleActive(loan(), 2099);
  assert.equal(r.missed, true);
  assert.equal(r.cents, 0);
  assert.equal(r.loan.missed, 1);
  assert.equal(r.loan.ratePpm, 25000);
  assert.equal(r.loan.outstanding, 30600, "missed interest is capitalised");
  assert.equal(r.capitalised, 600);
  assert.equal(r.loan.paid, 0, "the missed slice moves to the next turn");
});

test("negative funds miss every payment", () => {
  assert.equal(settleActive(loan(), -1).missed, true);
});

test("the rate steps per miss, 0.02, 0.025, 0.03125, and stops at r_cap", () => {
  assert.equal(missRate(20000), 25000);
  assert.equal(missRate(25000), 31250);
  assert.equal(missRate(31250), 39063);
  assert.equal(missRate(70000, 80000), 80000);
  assert.equal(settleActive(loan({ ratePpm: 70000 }), 0, { capPpm: 80000 }).loan.ratePpm, 80000);
});

test("the third miss in a row puts the loan in default", () => {
  const r = settleActive(loan({ missed: 2 }), 0);
  assert.equal(r.defaulted, true);
  assert.equal(r.loan.state, "default");
  assert.equal(settleActive(loan({ missed: 1 }), 0).loan.state, "active");
});

test("the last scheduled payment closes the loan at 0, capitalised interest included", () => {
  const r = settleActive(loan({ paid: 19, outstanding: 1500 }), 1e6);
  assert.equal(r.loan.outstanding, 0);
  assert.equal(r.closed, true);
  assert.equal(r.loan.state, "closed");
  const capitalised = settleActive(loan({ paid: 19, outstanding: 2200 }), 1e6);
  assert.equal(capitalised.amortisation, 2200);
  assert.equal(capitalised.closed, true);
});

test("early repayment rides on a made payment, capped by O and by what the borrower has", () => {
  assert.equal(settleActive(loan(), 1e6, { extra: 5000 }).loan.outstanding, 28500 - 5000);
  assert.equal(settleActive(loan(), 2100 + 300, { extra: 5000 }).extra, 300);
  assert.equal(settleActive(loan(), 1e6, { extra: 1e9 }).loan.outstanding, 0);
  assert.equal(settleActive(loan(), 2099, { extra: 5000 }).extra, 0, "no extra on a miss");
});

test("garnish with income above 0: min(ceil(O * 0.1), floor(0.5 * income), cash)", () => {
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { incomeCents: 4000, cashCents: 1e6 }), 1000);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { incomeCents: 1000, cashCents: 1e6 }), 500);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { incomeCents: 4000, cashCents: 300 }), 300);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { incomeCents: 4000, cashCents: -5 }), 0);
  assert.equal(garnishDue(loan({ outstanding: 4 }), { incomeCents: 1e6, cashCents: 1e6 }), 1, "rounds up");
  assert.equal(garnishDue(loan({ outstanding: 0 }), { incomeCents: 1e6, cashCents: 1e6 }), 0);
});

test("garnish with income at or below 0: min(ceil(O * 0.05), floor(0.1 * balance), cash) (NOTES finding C)", () => {
  const q = { incomeCents: 0, balanceCents: 8000, cashCents: 1e6 };
  assert.equal(garnishDue(loan({ outstanding: 10000 }), q), 500);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { ...q, balanceCents: 3000 }), 300);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { ...q, incomeCents: -50, balanceCents: -3000 }), 0);
  assert.equal(garnishDue(loan({ outstanding: 10000 }), { ...q, cashCents: 120 }), 120);
});

test("a defaulted loan pays the garnish from what's there, no interest, and closes at 0", () => {
  const d = loan({ state: "default", missed: 3, outstanding: 1000 });
  const r = settleDefault(d, { incomeCents: 10000, cashCents: 5000 });
  assert.equal(r.cents, 100);
  assert.equal(r.loan.outstanding, 900);
  assert.equal(r.loan.state, "default");
  assert.equal(settleDefault(d, { incomeCents: 10000, cashCents: -5000 }).cents, 0, "nothing to take");
  const last = settleDefault({ ...d, outstanding: 1 }, { incomeCents: 10000, cashCents: 1 });
  assert.equal(last.closed, true);
  assert.equal(last.loan.state, "closed");
});

test("a defaulted loan takes an early repayment only from what the borrower has", () => {
  const d = loan({ state: "default", missed: 3, outstanding: 1000 });
  assert.equal(settleDefault(d, { incomeCents: 10000, cashCents: 400 }, 9999).extra, 300);
  assert.equal(settleDefault(d, { incomeCents: 10000, cashCents: -1 }, 9999).extra, 0);
});

test("a block is added once per pair", () => {
  const b = withBlock([], { lender: 6, borrower: 2, reason: "default", agesLeft: 0, untilTurn: null });
  assert.equal(b.length, 1);
  assert.equal(withBlock(b, { lender: 6, borrower: 2, reason: "repudiation", agesLeft: 1, untilTurn: null }), b);
});
