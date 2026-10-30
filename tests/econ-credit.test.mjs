import test from "node:test";
import assert from "node:assert/strict";

import { activeDefaults, addMiss, creditCap, emergencyOutstandingOf, fitsService, outstandingOf, recentMisses,
  recentRepudiations, serviceCap, serviceOf, standingFrom, standingPct } from "../ui/econ-credit.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";

const ledgerWith = (loans = [], over = {}) => ({ ...emptyLedger(), loans, ...over });
const l = (borrower, state, outstanding, over = {}) => ({ ...makeLoan({ id: "L1", lender: "bond", borrower,
  principal: outstanding || 1, ratePpm: 20000, term: 10, turn: 1 }), state, outstanding, ...over });

test("credit cap: (12 + depth_turns - 4 * repudiations) * income - outstanding, never below 0", () => {
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 0 }), 12000);
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 5000 }), 7000);
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 0, depthTurns: 4 }), 16000);
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 0, depthTurns: 99 }), 24000, "depth stops at 12");
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 0, repudiations: 1 }), 8000);
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 0, repudiations: 3 }), 0);
  assert.equal(creditCap({ incomeCents: -500, outstandingCents: 0 }), 0);
  assert.equal(creditCap({ incomeCents: 1000, outstandingCents: 20000 }), 0);
});

test("debt-service limit: next turn's payments plus the new loan's first payment within half of income", () => {
  assert.equal(serviceCap(10000), 5000);
  assert.equal(serviceCap(-10), 0);
  const led = ledgerWith([l(3, "active", 10000, { ratePpm: 20000, term: 10 }), l(3, "default", 5000, { id: "L2" }),
    l(9, "active", 7000, { id: "L3" })]);
  assert.equal(serviceOf(led, 3), 200 + 1000, "the defaulted loan has no scheduled payment");
  assert.equal(fitsService({ serviceCents: 1200, firstPaymentCents: 3800, incomeCents: 10000 }), true);
  assert.equal(fitsService({ serviceCents: 1200, firstPaymentCents: 3801, incomeCents: 10000 }), false);
  assert.equal(fitsService({ serviceCents: 0, firstPaymentCents: 1, incomeCents: 0 }), false, "income 0 reads 0");
});

test("outstanding counts active and defaulted loans of this borrower only; emergency principal apart", () => {
  const led = ledgerWith([l(3, "active", 100), l(3, "default", 50, { id: "L2" }), l(3, "closed", 0, { id: "L3" }),
    l(3, "repudiated", 0, { id: "L4" }), l(9, "active", 7, { id: "L5" }),
    l(3, "active", 300, { id: "L6", emergency: true })]);
  assert.equal(outstandingOf(led, 3), 450);
  assert.equal(emergencyOutstandingOf(led, 3), 300);
  assert.equal(activeDefaults(led, 3), 1);
});

test("misses in one turn share a row, which is what standing counts and what the envelope stores", () => {
  const led = ledgerWith();
  addMiss(led, 3, 30);
  addMiss(led, 3, 30);
  addMiss(led, 3, 31);
  assert.deepEqual(led.misses, [{ pid: 3, turn: 30, n: 2 }, { pid: 3, turn: 31, n: 1 }]);
  assert.equal(recentMisses(led, 3, 31), 3);
});

test("standing: 1.0, minus 0.2 per active default, 0.1 per recent miss, 0.3 per recent repudiation", () => {
  assert.equal(standingFrom({ defaults: 0, misses: 0 }), 100);
  assert.equal(standingFrom({ defaults: 1, misses: 0 }), 80);
  assert.equal(standingFrom({ defaults: 0, misses: 1 }), 90);
  assert.equal(standingFrom({ defaults: 2, misses: 3 }), 30);
  assert.equal(standingFrom({ defaults: 0, misses: 0, repudiations: 1 }), 70);
  assert.equal(standingFrom({ defaults: 0, misses: 0, repudiationsAtWar: 1 }), 85, "half for a debt to an enemy");
});

test("standing: floored at 0.1 so a rate never divides by zero", () => {
  assert.equal(standingFrom({ defaults: 5, misses: 0 }), 10);
  assert.equal(standingFrom({ defaults: 9, misses: 9, repudiations: 9 }), 10);
});

test("standing windows: a miss 20 turns ago no longer counts; a repudiation 40 turns ago no longer counts", () => {
  const led = ledgerWith([l(3, "default", 10)], { misses: [{ pid: 3, turn: 30, n: 1 }, { pid: 3, turn: 11, n: 1 },
    { pid: 4, turn: 30, n: 1 }], repudiations: [{ pid: 3, lender: 7, turn: 0, cents: 5, atWar: false },
    { pid: 3, lender: "bond", turn: 20, cents: 5, atWar: true }] });
  assert.equal(recentMisses(led, 3, 30), 2);
  assert.equal(recentMisses(led, 3, 31), 1);
  assert.equal(recentRepudiations(led, 3, 39).length, 2);
  assert.equal(recentRepudiations(led, 3, 40).length, 1);
  assert.equal(standingPct(led, 3, 30), 100 - 20 - 20 - 30 - 15);
  assert.equal(standingPct(led, 3, 40), 100 - 20 - 10 - 15);
});
