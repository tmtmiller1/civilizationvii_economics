// The lab's build checks 1.1 and 2.6 (2026-10-30): a 300 Gold bond loan at 20 Gold of income was refused for the
// credit limit, and 50 Gold at 9 Gold of income for the debt-service limit. Both are the 4.2 limits as written; these
// pin the arithmetic, and how far below credit_cap the service limit holds a 10-turn loan (NOTES finding U).
import test from "node:test";
import assert from "node:assert/strict";
import { planTurn } from "../ui/econ-plan.js";
import { servicePrincipalCents } from "../ui/econ-citizens.js";
import { OPEN, civ, input } from "./_fixtures.mjs";

const ME = 3;
const borrow = (incomeCents, principal, term = 10) => planTurn(input({
  civs: [civ(ME, { human: true, incomeCents, balanceCents: 10000, stages: OPEN })],
  requests: [{ kind: "borrow", borrower: ME, lender: "bond", principal, term }] }));
const refusal = (plan) => plan.events.find((e) => e.kind === "refused")?.reason ?? null;

test("300 Gold at 20 Gold of income is over the credit limit (12 turns, 240 Gold)", () => {
  assert.equal(refusal(borrow(2000, 30000)), "credit-cap");
  assert.equal(refusal(borrow(2000, 24000)), "service-cap", "240 fits the limit but its first payment, 33.6, doesn't fit 7");
});

test("50 Gold at 9 Gold of income: the first payment (2 + 5) is over 35% of income (3.15)", () => {
  assert.equal(refusal(borrow(900, 5000)), "service-cap");
  assert.equal(refusal(borrow(900, 2000)), null, "20 Gold's first payment, 2.8, fits");
});

test("the service limit holds a 10-turn bond loan to about 2.5 turns of income, a 30-turn one to about 4.8", () => {
  const most10 = servicePrincipalCents({ roomCents: 700, ratePpm: 40000, term: 10 });
  const most30 = servicePrincipalCents({ roomCents: 700, ratePpm: 40000, term: 30 });
  assert.equal(refusal(borrow(2000, most10)), null);
  assert.equal(refusal(borrow(2000, most10 + 300)), "service-cap");
  assert.equal(refusal(borrow(2000, most30, 30)), null);
  assert.ok(most10 > 4500 && most10 < 5100, `${most10}`);
  assert.ok(most30 > 9000 && most30 < 9700, `${most30}`);
});
