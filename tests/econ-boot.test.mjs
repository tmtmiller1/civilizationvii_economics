// The entry script against the fake engine: a single-player game boots, logs once, runs the batch at TurnBegin and
// sends the notification at the local turn; a save from before its turn's batch runs that batch once at load; a
// multiplayer game logs that the mod is off and listens to nothing. The game's own modules resolve to a stub.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fire, installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { installFakeDom, removeFakeDom } from "./_fake-dom.mjs";
import { emptyLedger, load, save, MOD_ID } from "../ui/econ-state.js";
import { resetBuildingDataForTests } from "../ui/econ-engine.js";
import { resetAnchorsForTests } from "../ui/econ-stage-read.js";
import { readFileSync } from "node:fs";

// The boot line names the release; tests/modinfo.test.mjs holds it to the modinfo and package.json.
const { version: VERSION } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

register("./_game-paths-hooks.mjs", import.meta.url);

const civs = [{ id: 0, balance: 500, income: 20, human: true, nodes: ["NODE_CIVIC_EX_MAIN_ECONOMICS"] },
  { id: 1, balance: 900, income: 15 }];

/** Boots a fresh copy of the bootstrap and returns the log lines it wrote. */
async function boot(tag, spec) {
  delete globalThis.__towerEconomics;
  resetBuildingDataForTests();
  resetAnchorsForTests();
  installFakeDom();
  const world = installFakeEngine({ civs, ...spec });
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    await import(`../ui/econ-bootstrap.js?${tag}`);
  } finally {
    console.error = original;
  }
  return { world, lines, harness: globalThis.__towerEconomics };
}

function quietly(fn) {
  const original = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = original; }
}

test.afterEach(() => { removeFakeEngine(); removeFakeDom(); delete globalThis.__towerEconomics; });

test("single player: one boot line, the batch at TurnBegin, the notification at the local turn and only once", async () => {
  const { world, lines, harness } = await boot("sp", {});
  assert.equal(lines.filter((line) => line.startsWith(`[Economics] v${VERSION} loaded; turn 10,`)).length, 1, lines.join("\n"));
  assert.deepEqual([...world.handlers.keys()].sort(), ["CityRazingStarted", "CityTransfered", "PlayerTurnActivated",
    "RandomEventOccurred", "TurnBegin"]);
  assert.equal(harness.multiplayer, false);
  assert.equal(harness.request({ kind: "borrow", borrower: 0, lender: "bond", principal: 3000, term: 10 }), true);
  world.turn = 11;
  quietly(() => fire(world, "TurnBegin", {}));
  assert.ok(world.calls.includes("grant 0 1 30"), world.calls.join("\n"));
  assert.equal(load(world.config[MOD_ID]).ledger.lastTurn, 11);
  quietly(() => fire(world, "PlayerTurnActivated", { player: 1 }));
  assert.equal(world.notifications.length, 0, "an AI's turn sends nothing");
  quietly(() => fire(world, "PlayerTurnActivated", { player: 0 }));
  quietly(() => fire(world, "PlayerTurnActivated", { player: 0 }));
  assert.equal(world.notifications.length, 1);
  assert.equal(world.notifications[0].pid, 0);
  assert.equal(harness.pill().warning, false);
});

test("a save from before its turn's batch runs that batch once at load, and the turn's TurnBegin can't repeat it", async () => {
  const ledger = { ...emptyLedger(), lastTurn: 9 };
  const { world, lines } = await boot("catchup", { config: { [MOD_ID]: save(ledger) } });
  assert.ok(lines.some((line) => line.includes("(load catch-up from turn 9)")), lines.join("\n"));
  assert.equal(load(world.config[MOD_ID]).ledger.lastTurn, 10);
  const before = world.calls.length;
  quietly(() => fire(world, "TurnBegin", {}));
  const after = world.calls.slice(before);
  assert.deepEqual(after.filter((call) => !call.startsWith("write tower-economics-glue")), [],
    "the same turn is skipped: no ledger write, no grant");
});

test("multiplayer: the mod says once that it's off and listens to nothing", async () => {
  const { world, lines, harness } = await boot("mp", { multiplayer: true });
  assert.deepEqual(lines, [`[Economics] v${VERSION} loaded; multiplayer game, the mod is off`]);
  assert.equal(world.handlers.size, 0);
  assert.equal(harness.multiplayer, true);
  assert.equal(world.calls.length, 0);
});
