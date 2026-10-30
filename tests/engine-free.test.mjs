import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// The model modules must run under Node with no game: no engine global, no DOM, no storage, and imports only of
// sibling econ- modules. Comments and string literals are stripped before the scan so prose cannot trip it. The two
// glue files that do talk to the engine are listed here by name; a new engine-facing module joins this list on
// purpose, never by accident. The views are glue too: they draw with the DOM.
const GLUE = new Set(["econ-bootstrap.js", "econ-log.js", "econ-engine.js", "econ-stage-read.js", "econ-session.js",
  "econ-notify.js", "econ-fiscal.js", "econ-settings.js", "econ-dom.js", "econ-screen.js", "econ-screen-api.js",
  "econ-dock.js", "econ-view-treasury.js", "econ-view-loans.js", "econ-view-borrow.js", "econ-view-fiscal.js",
  "econ-commerce-read.js", "econ-view-markets.js", "econ-view-trade.js"]);
const BANNED = ["Game", "GameContext", "Players", "GameplayMap", "GameInfo", "WorldBuilder", "Units", "Cities",
  "engine", "UI", "localStorage", "sessionStorage", "Configuration", "Network", "document", "window", "Controls",
  "ContextManager", "YieldTypes", "Database"];

const dir = new URL("../ui/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^econ-.*\.js$/.test(f) && !GLUE.has(f));

function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, "\"\"")
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

test("there are model modules to check", () => {
  assert.ok(files.length >= 11, files.join(","));
});

for (const f of files) {
  test(`engine-free: ${f}`, () => {
    const src = readFileSync(new URL(f, dir), "utf8");
    const body = code(src);
    for (const name of BANNED) {
      assert.equal(new RegExp(`(?<![.\\w$])${name}(?![\\w$])`).test(body), false, `${f} names ${name}`);
    }
    for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)) {
      assert.match(m[1], /^\.\/econ-[a-z-]+\.js$/, `${f} imports ${m[1]}`);
    }
    assert.equal(/\bconsole\.log\b/.test(body), false, `${f} uses console.log`);
  });
}

test("the banned-name scan catches a real use and ignores the same word in a comment or string", () => {
  const hit = (s) => BANNED.some((n) => new RegExp(`(?<![.\\w$])${n}(?![\\w$])`).test(code(s)));
  assert.equal(hit("const b = Players.get(1);"), true);
  assert.equal(hit("// Players are read by the glue\nconst s = \"GameplayMap\";"), false);
  assert.equal(hit("const x = obj.engine;"), false);
});
