// The Spoil Guard: our checkbox, Demographics' guard and a host's ceiling combine to the strictest, and the screen
// asks it about each civ.
import test from "node:test";
import assert from "node:assert/strict";
import { civHidden, combinedPolicy, forgetPolicy, hiddenUnder } from "../ui/econ-spoil.js";
import { resetSettingsForTests } from "../ui/econ-settings.js";

test("the strictest policy wins; Demographics' slice counts only when it hasn't published", () => {
  assert.equal(combinedPolicy({ own: true }), "met-civs-only");
  assert.equal(combinedPolicy({ own: false }), "full");
  assert.equal(combinedPolicy({ own: false, published: "met-civs-only" }), "met-civs-only", "Demographics still guards");
  assert.equal(combinedPolicy({ own: true, published: "full" }), "met-civs-only", "ours still guards");
  assert.equal(combinedPolicy({ own: false, demographics: "met-civs-only" }), "met-civs-only");
  assert.equal(combinedPolicy({ own: false, published: "full", demographics: "met-civs-only" }), "full",
    "the published policy is Demographics' current one");
  assert.equal(combinedPolicy({ own: false, host: "own-civ-only" }), "own-civ-only");
  assert.equal(combinedPolicy({ own: true, host: "disabled" }), "disabled");
});

test("a civ is hidden by policy: never the player's own, unmet ones under the guard, every other under own-civ-only", () => {
  const met = (pid) => pid === 6;
  assert.equal(hiddenUnder(2, { me: 2, policy: "disabled", met }), false);
  assert.equal(hiddenUnder(6, { me: 2, policy: "met-civs-only", met }), false);
  assert.equal(hiddenUnder(8, { me: 2, policy: "met-civs-only", met }), true);
  assert.equal(hiddenUnder(8, { me: 2, policy: "full", met }), false);
  assert.equal(hiddenUnder(6, { me: 2, policy: "own-civ-only", met }), true);
  assert.equal(hiddenUnder(6, { me: 2, policy: "met-civs-only", met: () => { throw new Error("no read"); } }), true,
    "a failed read hides");
});

test("in a game: the checkbox, the published policy and the met check, kept for a second", () => {
  const config = {};
  const store = { modSettings: JSON.stringify({ economics: { spoilGuard: false } }) };
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  globalThis.Configuration = { getGame: () => ({ getValue: (key) => config[key] ?? null }) };
  globalThis.Players = { get: () => ({ Diplomacy: { hasMet: (pid) => pid === 6 } }) };
  try {
    resetSettingsForTests();
    forgetPolicy();
    assert.equal(civHidden(8, 2), false, "our guard off, Demographics silent: everyone shows");
    config.DemographicsAnalyticsPolicyEffective_v1_P2 = "met-civs-only";
    assert.equal(civHidden(8, 2), false, "kept until the second is up");
    forgetPolicy();
    assert.equal(civHidden(8, 2), true, "Demographics' published guard hides the unmet civ");
    assert.equal(civHidden(6, 2), false, "a met civ shows");
    config.DemographicsAnalyticsPolicyEffective_v1_P2 = "full";
    store.modSettings = JSON.stringify({ economics: { spoilGuard: true } });
    resetSettingsForTests();
    forgetPolicy();
    assert.equal(civHidden(8, 2), true, "our own guard on");
  } finally {
    delete globalThis.localStorage;
    delete globalThis.Configuration;
    delete globalThis.Players;
    resetSettingsForTests();
    forgetPolicy();
  }
});
