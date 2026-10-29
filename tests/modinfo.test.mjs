// modinfo.test.mjs - the manifest matches the tree: every listed file exists, every ui module is imported in the
// game group, the keeper comes first in each UIScripts block, the id, version and AffectsSavedGames are set, the
// version matches package.json, every same-mod import of a declared module is itself declared (import closure), the
// shell group reaches nothing it doesn't declare, and the static import graph has no cycle. GameFace links every
// module of a group at load, so a cycle or an undeclared helper takes the whole mod down in game.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, listJs, rel, stripComments } from "./_fs-helpers.mjs";

const MOD = "economics";
const modinfo = fs.readFileSync(path.join(ROOT, `${MOD}.modinfo`), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("every listed file exists", () => {
  for (const m of modinfo.matchAll(/<Item(?: locale="[^"]+")?>([^<]+)<\/Item>/g)) {
    assert.ok(fs.existsSync(path.join(ROOT, m[1])), m[1]);
  }
});

test("every ui module is imported in the game group, and the keeper is the first UIScript of each group", () => {
  const ui = fs.readdirSync(path.join(ROOT, "ui")).filter((f) => f.endsWith(".js"));
  const game = modinfo.slice(modinfo.indexOf(`id="${MOD}-game"`));
  for (const f of ui) if (f !== "settings-keeper.js") assert.ok(game.includes(`<Item>ui/${f}</Item>`), f);
  for (const group of modinfo.split("<UIScripts>").slice(1)) {
    assert.match(group, /^\s*(?:<!--[^]*?-->\s*)?<Item>ui\/settings-keeper\.js<\/Item>/);
  }
});

test("the id, version and AffectsSavedGames are set, and the version matches package.json", () => {
  assert.match(modinfo, /<Mod id="tower-economics"/);
  const version = modinfo.match(/<Version>(\d+\.\d+\.\d+)<\/Version>/);
  assert.ok(version, "semver <Version>");
  assert.equal(version[1], pkg.version, "modinfo and package.json versions");
  assert.match(modinfo, /<AffectsSavedGames>1<\/AffectsSavedGames>/);
  assert.match(modinfo, /<Authors>Tower<\/Authors>/);
});

// The import graph over ui/*.js, comments stripped so JSDoc import() type references don't count. Same-mod imports
// are relative ("./econ-x.js") or absolute ("/economics/ui/econ-x.js"); both resolve to a file under ui/.
const VFS = (p) => `/${MOD}/` + p.replace(/^\.?\//, "");
const DISK = (id) => id.replace(`/${MOD}/`, "");
function resolveSpec(fromAbs, spec) {
  if (spec.startsWith(`/${MOD}/`)) return spec;
  if (spec.startsWith("./") || spec.startsWith("../")) return VFS(rel(path.resolve(path.dirname(fromAbs), spec)));
  return null;
}
const graph = new Map();
const staticGraph = new Map();
for (const abs of listJs(path.join(ROOT, "ui"))) {
  const code = stripComments(fs.readFileSync(abs, "utf8"));
  const deps = new Set();
  const staticDeps = new Set();
  for (const m of code.matchAll(/(?:from|import)\s*\(?\s*"([^"]+\.js)"/g)) {
    const target = resolveSpec(abs, m[1]);
    if (target) deps.add(target);
  }
  for (const m of code.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*"([^"]+)"/g)) {
    const target = resolveSpec(abs, m[1]);
    if (target) staticDeps.add(target);
  }
  for (const m of code.matchAll(/\bimport\s*"([^"]+)"/g)) {
    const target = resolveSpec(abs, m[1]);
    if (target) staticDeps.add(target);
  }
  graph.set(VFS(rel(abs)), [...deps]);
  staticGraph.set(VFS(rel(abs)), [...staticDeps]);
}

function itemsIn(group, tag) {
  const sec = group.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`));
  if (!sec) return [];
  return [...sec[0].matchAll(/<Item(?:\s+locale="[^"]+")?>([^<]+)<\/Item>/g)].map((m) => m[1]);
}
const groupOf = (id) => (modinfo.match(new RegExp(`<ActionGroup id="${id}"[\\s\\S]*?</ActionGroup>`)) || [""])[0];

test("every module a declared module imports is itself declared in the game group", () => {
  const game = groupOf(`${MOD}-game`);
  assert.ok(game, `modinfo has no ActionGroup id="${MOD}-game"`);
  const declared = new Set([...itemsIn(game, "UIScripts"), ...itemsIn(game, "ImportFiles")]
    .filter((x) => x.endsWith(".js")).map(VFS));
  const missing = new Set();
  for (const d of declared) for (const t of graph.get(d) || []) if (!declared.has(t)) missing.add(t);
  const frontier = [...missing];
  while (frontier.length) {
    const n = frontier.pop();
    for (const t of graph.get(n) || []) if (!declared.has(t) && !missing.has(t)) { missing.add(t); frontier.push(t); }
  }
  assert.deepEqual([...missing].map(DISK).sort(), []);
});

test("the shell group declares everything its scripts import", () => {
  const shell = groupOf(`${MOD}-shell`);
  assert.ok(shell, `modinfo has no ActionGroup id="${MOD}-shell"`);
  const declared = new Set([...itemsIn(shell, "UIScripts"), ...itemsIn(shell, "ImportFiles")]
    .filter((x) => x.endsWith(".js")).map(VFS));
  const missing = new Set();
  const frontier = itemsIn(shell, "UIScripts").map(VFS);
  const seen = new Set(frontier);
  while (frontier.length) {
    const n = frontier.pop();
    for (const t of graph.get(n) || []) {
      if (!declared.has(t)) missing.add(t);
      if (!seen.has(t)) { seen.add(t); frontier.push(t); }
    }
  }
  assert.deepEqual([...missing].map(DISK), []);
});

test("the static import graph of ui/ has no cycle", () => {
  // Tarjan's strongly connected components; any component larger than one module is a load-time cycle.
  const sccs = [];
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const visit = (v) => {
    idx.set(v, index); low.set(v, index); index += 1; stack.push(v); onStack.add(v);
    for (const w of staticGraph.get(v) || []) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const v of staticGraph.keys()) if (!idx.has(v)) visit(v);
  const cycles = sccs.filter((c) => c.length > 1).map((c) => c.map(DISK).sort().join(" <-> "));
  assert.deepEqual(cycles, []);
});
