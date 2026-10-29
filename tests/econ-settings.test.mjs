import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, getSetting, resetSettingsForTests, setSetting, settings } from "../ui/econ-settings.js";

function fakeStorage(initial) {
  const store = { ...initial };
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  return store;
}

test("the economics slice is read once, laid over the defaults, and only that slice is written back", () => {
  const store = fakeStorage({ modSettings: JSON.stringify({ "tower-partisans": { debug: true }, economics: { lastTab: 2 } }) });
  resetSettingsForTests();
  assert.equal(getSetting("lastTab"), 2);
  assert.equal(getSetting("dockButton"), true, "a default fills a missing key");
  assert.equal(setSetting("lastTab", 1), true);
  assert.equal(setSetting("unknown", 1), false);
  const written = JSON.parse(store.modSettings);
  assert.deepEqual(written["tower-partisans"], { debug: true }, "another mod's slice is untouched");
  assert.deepEqual(written.economics, { lastTab: 1 });
  assert.equal(settings().lastTab, 1, "cached");
  delete globalThis.localStorage;
});

test("a store that can't be read keeps the value in memory and refuses the write", () => {
  globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  resetSettingsForTests();
  assert.deepEqual(settings(), { ...DEFAULTS });
  assert.equal(setSetting("lastTab", 2), false);
  assert.equal(getSetting("lastTab"), 2, "kept for the session");
  fakeStorage({ modSettings: "not json" });
  resetSettingsForTests();
  assert.equal(setSetting("lastTab", 1), false, "a root that isn't ours is never written over");
  delete globalThis.localStorage;
});
