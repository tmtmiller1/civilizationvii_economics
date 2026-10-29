import test from "node:test";
import assert from "node:assert/strict";

import { aiAccepts, aiRepudiationTarget, aiRestructures, aiShortfall, aiWillLend, repudiationThreshold }
  from "../ui/econ-ai.js";
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

test("restructuring rule (DESIGN 6): an overdue loan with income > 0 at m = 2, once", () => {
  const l = makeLoan({ id: "L1", lender: 4, borrower: 2, principal: 100, ratePpm: 1, term: 10, turn: 1 });
  assert.equal(aiRestructures({ loan: { ...l, missed: 2 }, incomeCents: 1 }), true);
  assert.equal(aiRestructures({ loan: { ...l, missed: 1 }, incomeCents: 1 }), false);
  assert.equal(aiRestructures({ loan: { ...l, missed: 2 }, incomeCents: 0 }), false);
  assert.equal(aiRestructures({ loan: { ...l, missed: 2, restructured: true }, incomeCents: 1 }), false);
  assert.equal(aiRestructures({ loan: { ...l, missed: 3, state: "default" }, incomeCents: 1 }), false);
});

test("repudiation rule (DESIGN 6): an enemy at war first, then a hostile lender owed enough when insolvent or in"
  + " default, then the bond market when insolvent at the cap; never Friendly; once per 20 turns", () => {
  const debts = [{ lender: 4, cents: 50000, level: "friendly" }, { lender: 5, cents: 30000, level: "unfriendly" },
    { lender: 7, cents: 100, level: "war" }, { lender: "bond", cents: 9000, level: null }];
  const base = { debts, insolvent: false, inDefault: false, incomeCents: 1000, atCap: false, lastRepudiationTurn: null,
    turn: 50 };
  assert.equal(repudiationThreshold(1000), 10000);
  assert.equal(repudiationThreshold(-250), 10000, "10 Gold floors the income");
  assert.equal(aiRepudiationTarget(base), 7, "at war, however small the debt");
  const peace = { ...base, debts: debts.filter((d) => d.level !== "war") };
  assert.equal(aiRepudiationTarget(peace), null, "solvent and paying: no repudiation");
  assert.equal(aiRepudiationTarget({ ...peace, insolvent: true }), 5);
  assert.equal(aiRepudiationTarget({ ...peace, inDefault: true }), 5);
  assert.equal(aiRepudiationTarget({ ...peace, inDefault: true, incomeCents: 3000 }), null, "30000 is not above 30000");
  const noHostile = { ...peace, debts: peace.debts.filter((d) => d.level !== "unfriendly") };
  assert.equal(aiRepudiationTarget({ ...noHostile, insolvent: true }), null);
  assert.equal(aiRepudiationTarget({ ...noHostile, insolvent: true, atCap: true }), "bond");
  assert.equal(aiRepudiationTarget({ ...base, lastRepudiationTurn: 31 }), null);
  assert.equal(aiRepudiationTarget({ ...base, lastRepudiationTurn: 30 }), 7);
});
