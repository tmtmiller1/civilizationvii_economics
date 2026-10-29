// no-empty-catch.test.mjs - no whitespace-only `catch` block anywhere under ui/. An empty catch turns breakage into
// random flakiness; a swallow that's meant carries a short reason comment (`catch (_) { /* ignore: ... */ }`), which
// makes the body non-empty and passes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_DIR, listJs, rel } from "./_fs-helpers.mjs";

// `\s` spans newlines, so this catches single- and multi-line empties; a comment or any code between the braces
// makes the body non-whitespace and is allowed.
const EMPTY_CATCH = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;

test("no empty catch block under ui/", () => {
  const offenders = [];
  for (const abs of listJs(UI_DIR)) {
    if (abs.endsWith("settings-keeper.js")) continue;
    const src = fs.readFileSync(abs, "utf8");
    for (const m of src.matchAll(EMPTY_CATCH)) offenders.push(`${rel(abs)}:${src.slice(0, m.index).split("\n").length}`);
  }
  assert.deepEqual(offenders, []);
});
