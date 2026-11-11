// The screen's resource names: the game names its Distant Lands treasure resources after the plain ones, so those
// carry the game's own "Distant Lands" word; every other resource reads as the game names it.
import test from "node:test";
import assert from "node:assert/strict";
import { resourceLabel } from "../ui/econ-commerce-read.js";

const names = { RESOURCE_GOLD: "LOC_RESOURCE_GOLD_NAME", RESOURCE_GOLD_DISTANT_LANDS: "LOC_RESOURCE_GOLD_NAME" };
const text = { LOC_RESOURCE_GOLD_NAME: "Gold", LOC_RESOURCE_GENERAL_TYPE_DISTANT_LANDS: "Distant Lands" };
const locFn = (key, ...args) => (key === "LOC_ECONOMICS_RESOURCE_DISTANT_LANDS" ? `${args[0]} (${args[1]})` : text[key] ?? key);

test("a Distant Lands resource reads apart from the plain one", () => {
  globalThis.GameInfo = { Resources: { lookup: (t) => (names[t] ? { Name: names[t] } : null) } };
  try {
    assert.equal(resourceLabel("RESOURCE_GOLD", locFn), "Gold");
    assert.equal(resourceLabel("RESOURCE_GOLD_DISTANT_LANDS", locFn), "Gold (Distant Lands)");
  } finally { delete globalThis.GameInfo; }
});
