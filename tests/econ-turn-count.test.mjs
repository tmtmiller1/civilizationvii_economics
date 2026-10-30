// The turn count that keeps rising across the ages (econ-turn-count.js): the game's turn restarts at 1 in a new age,
// the count doesn't, so the plan's "already planned" check and its windows keep working after an age change.
import test from "node:test";
import assert from "node:assert/strict";
import { countTurn, emptyTurnCount, gameTurnOf, sanitizeTurnCount } from "../ui/econ-turn-count.js";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { buildInput, displayTurn, loadSession, runTurn, turnNow } from "../ui/econ-session.js";
import { resetBuildingDataForTests } from "../ui/econ-engine.js";
import { resetAnchorsForTests } from "../ui/econ-stage-read.js";

test("a new game counts from the game's own turn; the same age keeps its base", () => {
  const first = countTurn(emptyTurnCount(), "AGE_ANTIQUITY", 1);
  assert.deepEqual(first, { count: { age: "AGE_ANTIQUITY", base: 0, last: 1 }, turn: 1 });
  const later = countTurn(first.count, "AGE_ANTIQUITY", 57);
  assert.deepEqual(later, { count: { age: "AGE_ANTIQUITY", base: 0, last: 57 }, turn: 57 });
  assert.equal(countTurn(later.count, "AGE_ANTIQUITY", 57).turn, 57, "reading twice in a turn changes nothing");
});

test("a new age moves the base to the last turn counted, so turn 1 of Exploration follows turn 120", () => {
  const end = countTurn(emptyTurnCount(), "AGE_ANTIQUITY", 120).count;
  const next = countTurn(end, "AGE_EXPLORATION", 1);
  assert.deepEqual(next, { count: { age: "AGE_EXPLORATION", base: 120, last: 121 }, turn: 121 });
  const modern = countTurn(countTurn(next.count, "AGE_EXPLORATION", 95).count, "AGE_MODERN", 1);
  assert.equal(modern.turn, 216);
  assert.equal(gameTurnOf(modern.count, 216), 1);
  assert.equal(gameTurnOf(modern.count, 215), null, "a turn of an earlier age has no game turn now");
});

test("a save from before the count existed: past the ledger's last turn only when the game's turn is behind it", () => {
  assert.equal(countTurn(emptyTurnCount(), "AGE_EXPLORATION", 3, 118).turn, 121, "made after an age change");
  assert.equal(countTurn(emptyTurnCount(), "AGE_EXPLORATION", 50, 50).turn, 50, "reloaded on a planned turn");
  assert.equal(countTurn(emptyTurnCount(), "AGE_EXPLORATION", 50, 49).turn, 50);
  assert.equal(countTurn(emptyTurnCount(), "AGE_EXPLORATION", 50, null).turn, 50);
});

test("the saved count drops what it can't trust", () => {
  assert.deepEqual(sanitizeTurnCount(null), emptyTurnCount());
  assert.deepEqual(sanitizeTurnCount({ age: 4, base: -2, last: 1.5 }), emptyTurnCount());
  assert.deepEqual(sanitizeTurnCount({ age: "AGE_MODERN", base: 200, last: 210 }), { age: "AGE_MODERN", base: 200,
    last: 210 });
});

test("in game: the first batch of a new age runs, and its turn follows the old age's last", () => {
  removeFakeEngine();
  resetBuildingDataForTests();
  resetAnchorsForTests();
  const world = installFakeEngine({ turn: 120, civs: [{ id: 0, balance: 50, income: 12 }, { id: 3, balance: 400, income: 9 }] });
  world.ageHash = 5;
  const session = loadSession();
  assert.equal(runTurn(session, "test")?.ledger.lastTurn, 120);
  world.ageHash = 7;
  world.turn = 1;
  const plan = runTurn(session, "test");
  assert.ok(plan, "the new age's first turn isn't read as already planned");
  assert.equal(plan.ledger.lastTurn, 121);
  assert.equal(plan.ledger.age, "AGE_EXPLORATION");
  assert.equal(turnNow(session), 121);
  assert.equal(displayTurn(session, 121), 1);
  assert.equal(buildInput(session).turn, 121);
  assert.equal(runTurn(session, "test"), null, "the same turn twice is still skipped");
  const reloaded = loadSession();
  assert.equal(turnNow(reloaded), 121, "the count lives in the glue envelope");
  removeFakeEngine();
});
