// The two 4.2 limits after the owner's decision of 2026-10-30 (NOTES finding U): base rates halved, the debt-service
// limit at half of income, 20-turn terms from Moneylending. A 20-turn loan at Antiquity's civ rate then reaches about
// 7.7 turns of income and a 30-turn one at Exploration's about 11.5, so credit_cap's 12 turns is the stock limit the
// long loans meet. The lab's two refusals (300 Gold at 20 of income, 50 at 9) still refuse, and now name the most.
import test from "node:test";
import assert from "node:assert/strict";
import { planTurn } from "../ui/econ-plan.js";
import { servicePrincipalCents } from "../ui/econ-citizens.js";
import { OPEN, civ, input } from "./_fixtures.mjs";

const ME = 3;
const LENDER = 6;
const borrow = (incomeCents, principal, term = 10, over = {}) => planTurn(input({
  civs: [civ(ME, { human: true, incomeCents, balanceCents: 10000, stages: OPEN }),
    civ(LENDER, { balanceCents: 1e7, depthTurns: 2 })],
  requests: [{ kind: "borrow", borrower: ME, lender: "bond", principal, term }], ...over }));
const refused = (plan) => plan.events.find((e) => e.kind === "refused") ?? null;
const refusal = (plan) => refused(plan)?.reason ?? null;

test("300 Gold at 20 Gold of income is over the credit limit (12 turns, 240 Gold), and the refusal names the most", () => {
  const out = borrow(2000, 30000);
  assert.equal(refusal(out), "credit-cap");
  const { lender, term, most } = refused(out);
  assert.deepEqual([lender, term], ["bond", 10]);
  assert.equal(most, 8300, "83 Gold: a first payment of 1.66 interest and 8.30 principal fits 10 Gold");
  assert.equal(refusal(borrow(2000, most)), null, "borrowing that instead goes through");
  assert.equal(refusal(borrow(2000, most + 100)), "service-cap");
});

test("50 Gold at 9 Gold of income: the first payment (1 + 5) is over half of income (4.5)", () => {
  const out = borrow(900, 5000);
  assert.equal(refusal(out), "service-cap");
  assert.equal(refused(out).most, 3700, "37 Gold's first payment, 4.44, fits");
  assert.equal(refusal(borrow(900, 3700)), null);
  assert.equal(refusal(borrow(900, 3800)), "service-cap");
});

test("a 20-turn loan at Antiquity's civ rate reaches about 7.7 turns of income", () => {
  const most = servicePrincipalCents({ roomCents: 1000, ratePpm: 15000, term: 20 });
  assert.ok(most > 7.6 * 2000 && most < 7.7 * 2000, `${most}`);
  const antiquity = (principal) => planTurn(input({ age: "AGE_ANTIQUITY",
    civs: [civ(ME, { human: true, incomeCents: 2000, stages: { moneylending: 0, publicDebt: null } }),
      civ(LENDER, { balanceCents: 1e7, depthTurns: 2, stages: { moneylending: 0, publicDebt: null } })],
    requests: [{ kind: "borrow", borrower: ME, lender: LENDER, principal, term: 20 }] }));
  assert.equal(refusal(antiquity(15200)), null, "152 Gold over 20 turns before Public debt");
  assert.equal(refusal(antiquity(15500)), "service-cap");
  assert.equal(refused(antiquity(15500)).most, 15300);
});

test("a 30-turn loan at Exploration's civ rate reaches about 11.5 turns, so credit_cap's 12 turns is the stock limit", () => {
  const most = servicePrincipalCents({ roomCents: 1000, ratePpm: 10000, term: 30 });
  assert.ok(most > 11.4 * 2000 && most < 11.6 * 2000, `${most}`);
  const civLoan = (principal) => borrow(2000, principal, 30, { requests: [{ kind: "borrow", borrower: ME,
    lender: LENDER, principal, term: 30 }] });
  assert.equal(refusal(civLoan(23000)), null);
  assert.equal(refusal(civLoan(24100)), "credit-cap", "12 turns of 20 Gold is 240");
});

test("from a civ lender the most is also no more than half what it holds", () => {
  const out = planTurn(input({ civs: [civ(ME, { human: true, incomeCents: 2000, stages: OPEN }),
    civ(LENDER, { balanceCents: 10000, depthTurns: 2 })],
  requests: [{ kind: "borrow", borrower: ME, lender: LENDER, principal: 5000, term: 10 }] }));
  assert.equal(refusal(out), null, "50 Gold from a lender holding 100");
  const over = planTurn(input({ civs: [civ(ME, { human: true, incomeCents: 2000, stages: OPEN }),
    civ(LENDER, { balanceCents: 10000, depthTurns: 2 })], ledger: undefined,
  requests: [{ kind: "borrow", borrower: ME, lender: LENDER, principal: 4000, term: 10 },
    { kind: "borrow", borrower: ME, lender: LENDER, principal: 30000, term: 10 }] }));
  assert.equal(refusal(over), "no-offer", "the lender has 60 Gold left uncommitted, short of 2 * 300");
});

test("a civ whose payments already fill the limit is told the most is nothing", () => {
  const full = borrow(2000, 8300);
  const out = planTurn(input({ turn: 51, ledger: full.ledger, civs: [civ(ME, { human: true, incomeCents: 2000,
    balanceCents: 10000, stages: OPEN })], requests: [{ kind: "borrow", borrower: ME, lender: "bond", principal: 1000,
    term: 10 }] }));
  assert.equal(refusal(out), "service-cap");
  assert.equal(refused(out).most, 0);
});
