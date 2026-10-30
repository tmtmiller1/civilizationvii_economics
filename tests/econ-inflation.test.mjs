// Inflation's arithmetic (DESIGN 4.8; TEST-PLAN 12.1 econ-inflation): pi from bond debt over the members' Gold, the
// reserve, erosion above it, the bond premium.
import test from "node:test";
import assert from "node:assert/strict";
import { erosionCents, largestDebtor, piPpm, premiumPct, reserveCents } from "../ui/econ-inflation.js";

test("pi is 0 with no bond debt and 0.02 * B / max(M, 1000) otherwise, capped at 0.5%", () => {
  assert.equal(piPpm({ bondOutstandingCents: 0, memberBalancesCents: [500000] }), 0);
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [1000000] }), 2000, "B a tenth of M");
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [400000, 600000] }), 2000);
  assert.equal(piPpm({ bondOutstandingCents: 1000000, memberBalancesCents: [1000000] }), 5000, "at the cap");
  assert.equal(piPpm({ bondOutstandingCents: 10000, memberBalancesCents: [] }), 2000, "M counts as at least 1000");
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [1000000, -900000] }), 2000,
    "a member in debt adds nothing to M");
});

test("the reserve is 20 turns of max(income, 10); erosion only touches Gold above it", () => {
  assert.equal(reserveCents(5000), 100000);
  assert.equal(reserveCents(-3000), 20000, "income counts as at least 10");
  assert.equal(erosionCents({ piPpm: 5000, balanceCents: 300000, incomeCents: 5000 }), 1000);
  assert.equal(erosionCents({ piPpm: 5000, balanceCents: 90000, incomeCents: 5000 }), 0, "under the reserve");
  assert.equal(erosionCents({ piPpm: 5000, balanceCents: 300000, incomeCents: 5000, erosionPct: 200 }), 2000,
    "Corporatist erodes twice");
  assert.equal(erosionCents({ piPpm: 0, balanceCents: 300000, incomeCents: 5000 }), 0);
});

test("the bond premium is 50 * pi, at most 25%; the largest debtor names the cause", () => {
  assert.equal(premiumPct(0), 0);
  assert.equal(premiumPct(2000), 10);
  assert.equal(premiumPct(5000), 25);
  assert.equal(premiumPct(9000), 25);
  assert.equal(premiumPct(-5), 0);
  assert.deepEqual(largestDebtor([{ pid: 3, cents: 10 }, { pid: 5, cents: 40 }, { pid: 7, cents: 40 }]), { pid: 5, cents: 40 });
  assert.equal(largestDebtor([{ pid: 3, cents: 0 }]), null);
});
