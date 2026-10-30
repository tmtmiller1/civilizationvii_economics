import test from "node:test";
import assert from "node:assert/strict";

import { emergencyLenderKinds, hasStage } from "../ui/econ-stages.js";

test("a stage is open from the turn the civ reached it; unknown, missing or malformed reads closed", () => {
  const c = { stages: { moneylending: 12, publicDebt: null } };
  assert.equal(hasStage(c, "moneylending", 12), true);
  assert.equal(hasStage(c, "moneylending", 11), false);
  assert.equal(hasStage(c, "publicDebt", 500), false);
  assert.equal(hasStage({ stages: { moneylending: "12" } }, "moneylending", 50), false);
  assert.equal(hasStage({}, "moneylending", 50), false);
  assert.equal(hasStage(undefined, "moneylending", 50), false);
  assert.equal(hasStage({ stages: { tariffs: 1 } }, "tariffs", 50), true, "the 1.1 stages gate too");
  assert.equal(hasStage({ stages: { banking: 1 } }, "banking", 50), false, "a stage the model doesn't know reads closed");
});

test("Economic stages Off opens every stage from the start", () => {
  assert.equal(hasStage({}, "publicDebt", 1, { stages: false }), true);
});

test("emergency lenders by stage (DESIGN 4.6): temple, then civs or temple, then civs or the bond market", () => {
  assert.deepEqual(emergencyLenderKinds({ stages: {} }, 5), { civs: false, bond: false, temple: true });
  assert.deepEqual(emergencyLenderKinds({ stages: { moneylending: 1 } }, 5), { civs: true, bond: false, temple: true });
  assert.deepEqual(emergencyLenderKinds({ stages: { moneylending: 1, publicDebt: 3 } }, 5),
    { civs: true, bond: true, temple: false });
});
