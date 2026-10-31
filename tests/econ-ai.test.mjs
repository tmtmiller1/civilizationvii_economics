import test from "node:test";
import assert from "node:assert/strict";

import { aiAccepts, aiChoice, aiRepudiationTarget, aiShortfall, aiWillLend, loanToRestructure,
  repudiationThreshold } from "../ui/econ-ai.js";
import { makeLoan } from "../ui/econ-loan.js";

test("an AI borrows exactly the shortfall when its balance would fall below zero", () => {
  assert.equal(aiShortfall(-2500), 2500);
  assert.equal(aiShortfall(0), 0);
  assert.equal(aiShortfall(10), 0);
});

test("an AI lends only when its balance exceeds 20 * income", () => {
  assert.equal(aiWillLend({ balanceCents: 20001, incomeCents: 1000 }), true);
  assert.equal(aiWillLend({ balanceCents: 20000, incomeCents: 1000 }), false);
});

test("an AI with no positive income never lends", () => {
  assert.equal(aiWillLend({ balanceCents: 1e9, incomeCents: 0 }), false);
  assert.equal(aiWillLend({ balanceCents: 1e9, incomeCents: -5 }), false);
});

test("an AI in shortfall accepts the player's offer at r <= 1.2 * its bond rate, income > 0, within its limits", () => {
  const ok = { offerRatePpm: 48000, bondRatePpm: 40000, shortfallCents: 1, incomeCents: 100 };
  assert.equal(aiAccepts(ok), true);
  assert.equal(aiAccepts({ ...ok, offerRatePpm: 48001 }), false);
  assert.equal(aiAccepts({ ...ok, incomeCents: 0 }), false, "finding E: no loan to a civ that can't pay");
  assert.equal(aiAccepts({ ...ok, fitsCredit: false }), false);
  assert.equal(aiAccepts({ ...ok, fitsService: false }), false);
});

test("an AI without a shortfall, or without a bond rate, declines", () => {
  assert.equal(aiAccepts({ offerRatePpm: 1, bondRatePpm: 40000, shortfallCents: 0, incomeCents: 1 }), false);
  assert.equal(aiAccepts({ offerRatePpm: 1, bondRatePpm: null, shortfallCents: 5, incomeCents: 1 }), false);
});

test("the ordered choice (AI-PLAN 4.3): pay, refinance, restructure, miss; the loan whose payment doesn't fit", () => {
  const base = { gapNow: 0, gapAhead: 0, refinanceOpen: true, incomeCents: 1000, restructurable: true };
  assert.equal(aiChoice(base), "pay");
  assert.equal(aiChoice({ ...base, gapNow: 100 }), "refinance");
  assert.equal(aiChoice({ ...base, gapNow: 100, refinanceOpen: false }), "restructure");
  assert.equal(aiChoice({ ...base, gapAhead: 100 }), "restructure", "next turn won't fit: restructure now");
  assert.equal(aiChoice({ ...base, gapNow: 100, refinanceOpen: false, incomeCents: 0 }), "miss");
  assert.equal(aiChoice({ ...base, gapNow: 100, refinanceOpen: false, restructurable: false }), "miss");
  const l = (id, over = {}) => ({ ...makeLoan({ id, lender: 4, borrower: 2, principal: 100, ratePpm: 1, term: 10,
    turn: 1 }), ...over });
  const paymentOf = (loan) => loan.principal / loan.term;
  assert.equal(loanToRestructure([l("L1"), l("L2", { principal: 1000 }), l("L3", { principal: 5000, restructured: true })],
    paymentOf)?.id, "L2", "the biggest payment among those not yet restructured");
  assert.equal(loanToRestructure([l("L1", { state: "default" })], paymentOf), null);
});

test("the repudiation weighing (AI-PLAN 4.4): a debt worth keeping, to an enemy at war, a weaker civ it dislikes, or"
  + " anyone but a friend while insolvent; the largest first; never Friendly; once per 20 turns", () => {
  const debts = [{ lender: 4, cents: 50000, level: "friendly" }, { lender: 5, cents: 30000, level: "unfriendly",
    lenderStrength: 10 }, { lender: 7, cents: 4001, level: "war" }, { lender: "bond", cents: 9000, level: null }];
  const base = { debts, insolvent: false, incomeCents: 1000, strength: 20, lastRepudiationTurn: null, turn: 50 };
  assert.equal(repudiationThreshold(1000), 4000, "4 turns of income");
  assert.equal(repudiationThreshold(-250), 4000, "10 Gold floors the income");
  assert.equal(aiRepudiationTarget(base), 5, "the weaker civ it dislikes is owed more than the enemy at war");
  assert.equal(aiRepudiationTarget({ ...base, strength: 5 }), 7, "stronger lender: only the enemy at war qualifies");
  assert.equal(aiRepudiationTarget({ ...base, strength: null }), 7, "no strength read: the weaker test fails safe");
  const small = { ...base, debts: debts.map((d) => ({ ...d, cents: 4000 })) };
  assert.equal(aiRepudiationTarget(small), null, "4 turns of income is the line, not over it: nothing worth keeping");
  const peace = { ...base, strength: 5, debts: debts.filter((d) => d.level !== "war") };
  assert.equal(aiRepudiationTarget(peace), null, "solvent and paying, lenders stronger: no repudiation");
  assert.equal(aiRepudiationTarget({ ...peace, insolvent: true }), 5, "insolvent: anyone but a friend, largest first");
  const onlyBond = { ...peace, debts: peace.debts.filter((d) => d.lender === "bond" || d.level === "friendly") };
  assert.equal(aiRepudiationTarget({ ...onlyBond, insolvent: true }), "bond", "the bond market has no friends");
  assert.equal(aiRepudiationTarget({ ...base, lastRepudiationTurn: 31 }), null);
  assert.equal(aiRepudiationTarget({ ...base, lastRepudiationTurn: 30 }), 5);
});
