// The stake score (AI-PLAN 4.5) from plain facts, the facts read from the turn's rows, and the lender gate.
import test from "node:test";
import assert from "node:assert/strict";

import { lenderGate, levelNumber, stakeFacts, stakeFor, stakeOf } from "../ui/econ-stake.js";
import { viewContext } from "../ui/econ-view-model.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { civ, input } from "./_fixtures.mjs";

const base = { levelNum: 0, routes: 0, allied: false, sharedEnemy: false, distance: null, agenda: 0, growing: false,
  hostile: false, repPoints: 100 };

test("the stake score adds the plan's terms: level / 3, routes, alliance, a shared enemy, a neighbour, agendas, growth, hostility, reputation", () => {
  assert.equal(stakeOf(base), 0);
  assert.equal(stakeOf({ ...base, levelNum: 30 }), 10);
  assert.equal(stakeOf({ ...base, levelNum: -30 }), -10);
  assert.equal(stakeOf({ ...base, routes: 2 }), 6);
  assert.equal(stakeOf({ ...base, routes: 5 }), 9, "three routes is the most that counts");
  assert.equal(stakeOf({ ...base, allied: true, sharedEnemy: true }), 10);
  assert.equal(stakeOf({ ...base, distance: 20 }), 3);
  assert.equal(stakeOf({ ...base, distance: 21 }), 0);
  assert.equal(stakeOf({ ...base, agenda: -10 }), -5, "the AI's own agenda rows, as the engine scored them, halved");
  assert.equal(stakeOf({ ...base, growing: true }), 3);
  assert.equal(stakeOf({ ...base, hostile: true }), -6);
  assert.equal(stakeOf({ ...base, repPoints: 70 }), -3, "a bad debtor: the shortfall over 10");
  assert.equal(stakeOf({ ...base, levelNum: 12, routes: 1, growing: true, repPoints: 95 }), 9.5, "to a tenth");
});

test("the facts come from the relation row the glue read, with stand-ins when it read nothing", () => {
  const relations = [{ a: 6, b: 9, level: "friendly", levelNum: 25, routes: 1, allied: true, distance: 12, agendaAB: 4,
    agendaBA: -10 }, { a: 6, b: 11, level: "war" }, { a: 9, b: 11, level: "war" }];
  const ledger = { ...emptyLedger(), creditRep: [{ pid: 9, rep: 8000, turn: 50 }] };
  const markets = { ...emptyMarkets(), incomes: { 9: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] } };
  const ctx = viewContext(input({ civs: [civ(6), civ(9), civ(11)], relations, ledger, markets }));
  assert.deepEqual(stakeFacts(ctx, 6, 9), { levelNum: 25, routes: 1, allied: true, sharedEnemy: true, distance: 12,
    agenda: 4, growing: true, hostile: false, repPoints: 80 });
  assert.equal(stakeFacts(ctx, 9, 6).agenda, -10, "each side's own agenda rows");
  assert.equal(stakeFor(ctx, 6, 9), stakeOf(stakeFacts(ctx, 6, 9)));
  assert.equal(ctx.stakes.get("6:9"), stakeFor(ctx, 6, 9), "read once per pair per turn");
  assert.deepEqual([levelNumber(null, "friendly"), levelNumber(null, "unfriendly"), levelNumber(null, "war"),
    levelNumber({ a: 1, b: 2, level: "neutral", levelNum: 7 }, "neutral")], [20, -15, -30, 7]);
  const hostile = viewContext(input({ civs: [civ(6), civ(9)], relations: [{ a: 6, b: 9, level: "unfriendly",
    levelNum: -25 }] }));
  assert.equal(stakeFacts(hostile, 6, 9).hostile, true, "Hostile: a level at or under -20");
  const mild = viewContext(input({ civs: [civ(6), civ(9)], relations: [{ a: 6, b: 9, level: "unfriendly", levelNum: -5 }] }));
  assert.equal(stakeFacts(mild, 6, 9).hostile, false);
});

test("the lender gate: a reputation of 50 or more and a stake of 0 or more", () => {
  const ok = viewContext(input({ civs: [civ(6), civ(9)], relations: [{ a: 6, b: 9, level: "neutral" }] }));
  assert.equal(lenderGate(ok, 6, 9), true);
  const cold = viewContext(input({ civs: [civ(6), civ(9)], relations: [{ a: 6, b: 9, level: "unfriendly" }] }));
  assert.equal(lenderGate(cold, 6, 9), false, "a stake of -5");
  const bad = viewContext(input({ civs: [civ(6), civ(9)], relations: [{ a: 6, b: 9, level: "friendly", levelNum: 30 }],
    ledger: { ...emptyLedger(), creditRep: [{ pid: 9, rep: 4999, turn: 50 }] } }));
  assert.equal(lenderGate(bad, 6, 9), false, "a reputation under 50, however good the stake");
});
