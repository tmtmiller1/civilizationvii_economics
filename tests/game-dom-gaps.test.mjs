// The game's page lacks some standard DOM methods (engine-closed.md, "UI runtime"). A call to one throws at run time
// and no browser test would catch it, so the shipped code is scanned for them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const MISSING = ["replaceWith"];
const dir = new URL("../ui/", import.meta.url);
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("no ui module calls a DOM method the game's page doesn't have", () => {
  const hits = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
    const src = code(readFileSync(new URL(f, dir), "utf8"));
    for (const m of MISSING) if (new RegExp(`\\.${m}\\s*\\(`).test(src)) hits.push(`${f}: .${m}(`);
  }
  assert.deepEqual(hits, []);
});
