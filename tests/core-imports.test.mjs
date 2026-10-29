// core-imports.test.mjs - every `/core/...` or `/base-standard/...` module ui/ imports exists in the installed game's
// script tree, so a game patch that moves an engine module, or a typo in a new import, is caught here instead of as
// a blank screen at load. `CIV7_GAME_DIR` overrides the lookup (the folder that holds Base/modules, or Base/modules
// itself). The mapping "/core/x.js" -> "<modules>/core/x.js" is checked by finding a known engine file first. With no
// install found the gate says so and passes, so a machine without the game still runs the suite.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UI_DIR, listJs, rel, stripComments } from "./_fs-helpers.mjs";

const KNOWN = "core/ui/panel-support.js";
const ENGINE_PREFIX = /^\/(core|base-standard)\//;
const appSupport = path.join(os.homedir(), "Library/Application Support");
const candidates = [
  process.env.CIV7_GAME_DIR,
  path.join(appSupport, "Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources"),
  path.join(appSupport, "Steam/steamapps/common/Sid Meier's Civilization VII"),
].filter(Boolean);

function findModulesRoot() {
  for (const c of candidates) {
    for (const probe of [c, path.join(c, "Base/modules"), path.join(c, "CivilizationVII.app/Contents/Resources/Base/modules")]) {
      if (fs.existsSync(path.join(probe, KNOWN))) return probe;
    }
  }
  return null;
}

const uses = new Map();
for (const abs of listJs(UI_DIR)) {
  const code = stripComments(fs.readFileSync(abs, "utf8"));
  for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)"([^"]+)"/g)) {
    if (!ENGINE_PREFIX.test(m[1])) continue;
    if (!uses.has(m[1])) uses.set(m[1], new Set());
    uses.get(m[1]).add(rel(abs));
  }
}

test("every engine module ui/ imports exists in the installed game", (t) => {
  const modulesRoot = findModulesRoot();
  if (!modulesRoot) {
    t.diagnostic(`no Civilization VII install found; ${uses.size} engine specifier(s) not checked`);
    return;
  }
  const missing = [];
  for (const [spec, importers] of [...uses].sort()) {
    if (!fs.existsSync(path.join(modulesRoot, spec))) missing.push(`${spec} <- ${[...importers].join(", ")}`);
  }
  t.diagnostic(`${uses.size} engine specifier(s) checked under ${modulesRoot}`);
  assert.deepEqual(missing, []);
});
