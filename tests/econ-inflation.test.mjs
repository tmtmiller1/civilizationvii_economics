// Inflation's arithmetic (DESIGN 4.8; TEST-PLAN 12.1 econ-inflation): pi from bond debt over the members' Gold, each
// member's price level compounding by its share, the bond premium.
import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL_CAP_PPM, largestDebtor, nextLevelPpm, piPpm, premiumPct } from "../ui/econ-inflation.js";

test("pi is 0 with no bond debt and 0.02 * B / max(M, 1000) otherwise, capped at 0.5%", () => {
  assert.equal(piPpm({ bondOutstandingCents: 0, memberBalancesCents: [500000] }), 0);
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [1000000] }), 2000, "B a tenth of M");
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [400000, 600000] }), 2000);
  assert.equal(piPpm({ bondOutstandingCents: 1000000, memberBalancesCents: [1000000] }), 5000, "at the cap");
  assert.equal(piPpm({ bondOutstandingCents: 10000, memberBalancesCents: [] }), 2000, "M counts as at least 1000");
  assert.equal(piPpm({ bondOutstandingCents: 100000, memberBalancesCents: [1000000, -900000] }), 2000,
    "a member in debt adds nothing to M");
});

test("the price level compounds by the civ's share of the rate and stops at +127%", () => {
  assert.equal(nextLevelPpm({ levelPpm: 0, piPpm: 5000 }), 5000, "0.5% from level prices");
  assert.equal(nextLevelPpm({ levelPpm: 100000, piPpm: 5000 }), 100000 + 5500, "0.5% of 110%");
  assert.equal(nextLevelPpm({ levelPpm: 0, piPpm: 5000, pricePct: 200 }), 10000, "Corporatist twice");
  assert.equal(nextLevelPpm({ levelPpm: 20000, piPpm: 5000, pricePct: 0 }), 20000, "Planned: prices held");
  assert.equal(nextLevelPpm({ levelPpm: 20000, piPpm: 0 }), 20000, "no rate, no rise; prices don't fall back");
  assert.equal(nextLevelPpm({ levelPpm: LEVEL_CAP_PPM - 10, piPpm: 5000 }), LEVEL_CAP_PPM);
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
