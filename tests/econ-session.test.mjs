// The glue against a fake engine: every civ is read by the same calls, the ledger is written before the grants go
// out, nets are one grant per civ, a reload re-sends only a lost batch, requests and the guard switch persist.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { buildInput, emptyGlue, loadSession, queueRequest, readCiv, readOptions, resendLostBatch, runTurn, sanitizeGlue,
  setGuard, GLUE_KEY } from "../ui/econ-session.js";
import { MOD_ID, load } from "../ui/econ-state.js";
import { resetBuildingDataForTests } from "../ui/econ-engine.js";
import { resetAnchorsForTests } from "../ui/econ-stage-read.js";

const civs = [{ id: 0, balance: 50, income: 12, human: true }, { id: 3, balance: 400, income: 12, nodes: ["NODE_CIVIC_EX_MAIN_ECONOMICS"],
  buildings: [1], war: [5] }, { id: 5, balance: 10, income: 3, war: [3] }];

function fresh(spec = {}) {
  removeFakeEngine();
  resetBuildingDataForTests();
  resetAnchorsForTests();
  return installFakeEngine({ civs, ...spec });
}

test("every major is read with the same fields, human and AI alike; stages come from the nodes and the age", () => {
  fresh();
  const session = loadSession();
  const input = buildInput(session);
  assert.deepEqual(input.civs.map((c) => c.id), [0, 3, 5]);
  for (const c of input.civs) {
    assert.deepEqual(Object.keys(c).sort(), ["alive", "atWar", "balanceCents", "cities", "commerceSettlements",
      "cushionBp", "depthFactorPct", "depthTurns", "government", "happinessCents", "human", "id", "ideology", "incomeCents",
      "stages", "tradeIncomeCents", "upkeepCents", "warehouses"], `civ ${c.id}`);
  }
  assert.deepEqual(input.civs.map((c) => [c.balanceCents, c.incomeCents, c.human, c.atWar]),
    [[5000, 1200, true, false], [40000, 1200, false, true], [1000, 300, false, true]]);
  const later = { guildPatronage: null, charteredCompanies: null, tariffs: null, banking: null, capitalism: null };
  assert.deepEqual(input.civs.map((c) => c.stages), [{ moneylending: 10, publicDebt: null, trade: 10, ...later },
    { moneylending: 10, publicDebt: 10, trade: 10, ...later }, { moneylending: 10, publicDebt: null, trade: 10, ...later }],
    "Moneylending and Trade are Antiquity's, open in Exploration; Public debt needs the civic");
  assert.deepEqual([input.civs[1].depthTurns, input.civs[1].depthFactorPct], [2, 96], "one Bank");
  assert.equal(input.civs[1].upkeepCents, 200, "one unit type at 1 Gold plus one building at 1 Gold");
  assert.deepEqual(input.relations.map((r) => [r.a, r.b, r.level]), [[0, 3, "neutral"], [0, 5, "neutral"], [3, 5, "war"]]);
  assert.deepEqual(input.params, { amenityLineCents: 0, disbandLineCents: -1000, goldPerPointCents: 400 });
  assert.equal(input.age, "AGE_EXPLORATION");
  removeFakeEngine();
});

test("options map from the setup keys, the guard switch overrides, and a dead civ reads as not alive", () => {
  fresh({ config: { ECONOMICS_LOANS: "ECONOMICS_LOANS_ON", ECONOMICS_GUARD: "ECONOMICS_GUARD_OFF", ECONOMICS_RATES: "ECONOMICS_RATES_HIGH",
    ECONOMICS_AI: "ECONOMICS_AI_OFF" } });
  const glue = emptyGlue();
  assert.deepEqual(readOptions(glue), { loans: true, guard: false, ai: false, rates: "high", stages: true, taxFallback: false,
    markets: true, tariffs: true, investment: true, inflation: false, cycle: "standard", swings: "volatile", systems: true });
  const session = loadSession();
  assert.equal(setGuard(session, true), true);
  assert.equal(setGuard(session, null), false, "null follows the setup option again");
  assert.equal(readCiv(77, [0, 3, 5], { moneylending: null, publicDebt: null }).alive, false);
  fresh({ config: { ECONOMICS_SWINGS: "ECONOMICS_SWINGS_EXTREME" } });
  assert.equal(readOptions(emptyGlue()).swings, "extreme");
  fresh({ config: { ECONOMICS_SWINGS: "ECONOMICS_SWINGS_SIDEWAYS" } });
  assert.equal(readOptions(emptyGlue()).swings, "volatile", "an unknown value keeps the setup default");
  removeFakeEngine();
});

test("a turn writes the ledger before any grant, nets one Gold grant per civ, and the same turn twice is skipped", () => {
  const world = fresh();
  const session = loadSession();
  session.glue.requests.push({ kind: "borrow", borrower: 0, lender: "bond", principal: 1000, term: 10 });
  // Public debt for the human, so the bond market is open to it.
  session.glue.stages = { 0: { moneylending: 1, publicDebt: 1 } };
  const plan = runTurn(session, "test");
  assert.ok(plan && !plan.skipped);
  const writes = world.calls.filter((c) => c.startsWith("write"));
  const grants = world.calls.filter((c) => c.startsWith("grant"));
  assert.ok(world.calls.indexOf(writes[0]) < world.calls.indexOf(grants[0]), "ledger write comes first");
  assert.ok(writes.includes(`write ${MOD_ID}`) && writes.includes(`write ${GLUE_KEY}`));
  assert.ok(grants.some((g) => g.startsWith("grant 0 1 ")), "the human got its Gold grant");
  assert.equal(grants.filter((g) => g.startsWith("grant 0 1 ")).length, 1, "one net Gold grant per civ");
  assert.equal(load(world.config[MOD_ID]).ledger.loans.length, plan.ledger.loans.length, "the saved ledger is the plan's");
  assert.deepEqual(session.glue.requests, [], "requests ran");
  assert.equal(runTurn(session, "again"), null, "already planned");
  removeFakeEngine();
});

test("on load, a batch saved this turn whose grants never landed is re-sent, and a landed one isn't", () => {
  // The cycle off, so the war between 3 and 5 moves nobody's Gold and only the player's borrow has a net.
  const world = fresh({ config: { ECONOMICS_CYCLE: "ECONOMICS_CYCLE_OFF" } });
  const session = loadSession();
  session.glue.stages = { 0: { moneylending: 1, publicDebt: 1 } };
  session.glue.requests.push({ kind: "borrow", borrower: 0, lender: "bond", principal: 1000, term: 10 });
  const plan = runTurn(session, "test");
  const row = plan.batch.civs.find((c) => c.pid === 0);
  assert.ok(row.net > 0);
  world.calls.length = 0;
  // The balance still reads the snapshot: the save fell before the grant landed.
  const reloaded = loadSession();
  assert.deepEqual(resendLostBatch(reloaded).map((r) => r.pid), [0]);
  assert.ok(world.calls.some((c) => c === `grant 0 1 ${row.net / 100}`));
  // Now the balance reads snapshot + net: nothing to do.
  world.civs.get(0).balance = (row.snapshot + row.net) / 100;
  assert.deepEqual(resendLostBatch(loadSession()), []);
  world.turn = 11;
  world.civs.get(0).balance = row.snapshot / 100;
  assert.deepEqual(resendLostBatch(loadSession()), [], "another turn's batch is left alone");
  removeFakeEngine();
});

test("the glue envelope keeps requests, stage turns, seen civs and the guard switch, and drops what it can't trust", () => {
  const world = fresh();
  const session = loadSession();
  assert.equal(queueRequest(session, { kind: "repay", loanId: "L1", cents: 100 }), true);
  assert.equal(queueRequest(session, { kind: "bogus" }), false);
  const again = loadSession();
  assert.deepEqual(again.glue.requests, [{ kind: "repay", loanId: "L1", cents: 100 }]);
  assert.ok(world.config[GLUE_KEY].includes("repay"));
  const clean = sanitizeGlue({ v: 1, stages: { 4: { moneylending: 3, publicDebt: "x" }, bad: {} }, seen: [1, -2, "3"],
    requests: [{ kind: "borrow" }, 5], guardOn: "yes" });
  assert.deepEqual(clean, { v: 2, stages: { 4: { moneylending: 3, publicDebt: null } }, seen: [1], requests: [{ kind: "borrow" }],
    guardOn: null, turns: { age: null, base: 0, last: 0 }, roles: {}, cycleEvents: [] });
  assert.deepEqual(sanitizeGlue("junk"), emptyGlue());
  removeFakeEngine();
});

test("every option off, the 1.2 ones too: the batch is skipped and says so in the log once", () => {
  const off = Object.fromEntries(["LOANS", "GUARD", "AI", "TAXES", "STAGES", "MARKETS", "TARIFFS", "INVESTMENT", "INFLATION",
    "CYCLE", "SYSTEMS"].map((key) => [`ECONOMICS_${key}`, `ECONOMICS_${key}_OFF`]));
  fresh({ config: off });
  const lines = [];
  const saved = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    const session = loadSession();
    assert.equal(runTurn(session, "TurnBegin 10"), null);
    assert.equal(runTurn(session, "TurnBegin 10"), null);
    assert.equal(lines.filter((line) => line.includes("skipped, all-off")).length >= 1, true, lines.join("\n"));
    const loud = lines.filter((line) => line === "[Economics] turn 10 (TurnBegin 10): skipped, all-off");
    assert.ok(loud.length >= 1);
  } finally {
    console.error = saved;
  }
  fresh({ config: { ...off, ECONOMICS_CYCLE: "ECONOMICS_CYCLE_STANDARD" } });
  assert.ok(runTurn(loadSession(), "TurnBegin 10"), "with the cycle on there's still a batch to run");
  removeFakeEngine();
});
