import test from "node:test";
import assert from "node:assert/strict";

import { checkPlan } from "../ui/econ-invariants.js";
import { conservationGap, transferKey } from "../ui/econ-conservation.js";
import { planTurn } from "../ui/econ-plan.js";
import { load, save } from "../ui/econ-state.js";
import { MISS, TERMS } from "../ui/econ-params.js";
import { emergencyOutstandingOf } from "../ui/econ-credit.js";
import { emergencyCap } from "../ui/econ-guard.js";
import { PARAMS } from "./_fixtures.mjs";
import { gen } from "./_prng.mjs";
import { step, world } from "./_sim.mjs";

const CASES = 500;
const TURNS = 200;
const LEVELS = ["friendly", "neutral", "neutral", "unfriendly", "war"];

// A random economy: sparse player ids, exogenous income that drifts and can go negative, some civs eliminated, stages
// reached at random turns, and the three ages in order.
function economy(seed) {
  const g = gen(seed);
  const n = g.int(2, 12);
  const ids = [];
  while (ids.length < n) { const id = g.int(0, 63); if (!ids.includes(id)) ids.push(id); }
  const civs = ids.map((id, i) => ({ id, alive: true, human: i === 0, balanceCents: g.int(-5000, 200000),
    incomeCents: g.int(-3000, 6000), upkeepCents: g.int(0, 2000), depthTurns: g.pick([0, 0, 2, 4]),
    depthFactorPct: g.pick([100, 100, 90, 70]),
    stages: { moneylending: g.chance(0.8) ? g.int(0, 60) : null, publicDebt: g.chance(0.7) ? g.int(40, 120) : null } }));
  const relations = [];
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    relations.push({ a: ids[i], b: ids[j], level: g.pick(LEVELS) });
  }
  const dies = new Map(ids.slice(1).filter(() => g.chance(0.2)).map((id) => [id, g.int(1, TURNS)]));
  const options = { guard: g.chance(0.8), ai: g.chance(0.9), rates: g.pick(["low", "standard", "high"]),
    stages: g.chance(0.9), taxFallback: g.chance(0.2) };
  return { g, civs, relations, dies, options, explorationAt: g.int(40, 90), modernAt: g.chance(0.5) ? 150 : null };
}

function ageAt(e, turn) {
  if (e.modernAt !== null && turn >= e.modernAt) return "AGE_MODERN";
  return turn >= e.explorationAt ? "AGE_EXPLORATION" : "AGE_ANTIQUITY";
}

function requestsFor(g, civs, w) {
  const me = civs[0].id;
  const requests = [];
  const mine = (w.ledger?.loans || []).filter((l) => l.borrower === me && l.state !== "closed"
    && l.state !== "repudiated");
  if (g.chance(0.1)) {
    requests.push({ kind: "borrow", borrower: me, lender: g.chance(0.5) ? "bond" : g.pick(civs).id,
      principal: g.int(100, 20000), term: g.pick(TERMS) });
  }
  if (mine.length && g.chance(0.05)) requests.push({ kind: "repay", loanId: g.pick(mine).id, cents: g.int(1, 5000) });
  // Asked while a loan is overdue, as a player would; the model still refuses it with income at or below 0.
  const overdue = mine.filter((l) => l.missed >= 1);
  if (overdue.length && g.chance(0.5)) requests.push({ kind: "restructure", loanId: g.pick(overdue).id, pid: me });
  if (mine.length && g.chance(0.01)) requests.push({ kind: "repudiate", borrower: me, lender: g.pick(mine).lender });
  if (civs.length > 1 && g.chance(0.05)) {
    requests.push({ kind: "lend", lender: me, borrower: g.pick(civs.slice(1)).id, principal: g.int(100, 10000),
      ratePpm: g.int(10000, 120000), term: g.pick(TERMS) });
  }
  if (g.chance(0.02)) requests.push({ kind: "tax", pid: me, level: g.pick(["light", "standard", "heavy", "warLevy"]) });
  return requests;
}

function run(seed, onTurn, roundTrip = false) {
  const e = economy(seed);
  const { g } = e;
  let w = world({ civs: e.civs, params: PARAMS, options: e.options, relations: e.relations, turn: 1,
    age: ageAt(e, 1), roundTrip });
  for (let k = 0; k < TURNS; k += 1) {
    const turn = w.turn;
    const civs = w.civs.map((c) => ({ ...c, alive: c.alive && !(e.dies.get(c.id) <= turn),
      incomeCents: c.incomeCents + g.int(-150, 150), atWar: g.chance(0.1) }));
    w = { ...w, civs, age: ageAt(e, turn) };
    const requests = requestsFor(g, civs, w);
    const before = w.balances;
    const { plan, next, civs: planned } = step(w, { requests });
    onTurn({ turn, plan, civs: planned, before, after: next.balances, seed, requests, state: w });
    w = next;
  }
  return w;
}

function checkTurn({ turn, plan, civs, before, after, seed }, issued, opened) {
  const at = `seed ${seed} turn ${turn}`;
  const envelopeText = turn % 25 === 0 ? save(plan.ledger) : undefined;
  assert.deepEqual(checkPlan({ plan, civs, envelopeText, issued }), [], at);
  for (const t of plan.transfers) issued.add(transferKey(t));
  const incomeTotal = civs.reduce((s, c) => s + (c.alive ? c.incomeCents : 0), 0);
  assert.equal(conservationGap({ before, after, incomeTotal, transfers: plan.transfers }), 0, at);
  for (const v of after.values()) assert.ok(Number.isInteger(v), at);
  for (const c of civs) {
    if (!c.alive) continue;
    const cap = emergencyCap(c.incomeCents);
    const open = emergencyOutstandingOf(plan.ledger, c.id);
    const fresh = plan.events.some((e) => e.kind === "guard" && e.pid === c.id);
    if (fresh) assert.ok(open <= cap, `${at} civ ${c.id} emergency ${open} over cap ${cap}`);
  }
  for (const l of plan.ledger.loans) {
    assert.ok(l.outstanding >= 0, `${at} ${l.id}`);
    assert.ok(l.missed <= MISS.defaultAt, `${at} ${l.id}`);
    if (!opened.has(l.id)) opened.set(l.id, l);
  }
  for (const e of plan.events) {
    if (e.kind === "open") assert.equal(opened.get(e.loanId)?.opened, turn, `${at} loan id ${e.loanId} reused`);
  }
}

test(`property: ${CASES} random economies over ${TURNS} turns keep every ledger invariant`, () => {
  for (let i = 0; i < CASES; i += 1) {
    const seed = 9001 + i;
    const issued = new Set();
    const opened = new Map();
    const final = run(seed, (turnInfo) => checkTurn(turnInfo, issued, opened));
    for (const l of final.ledger.loans) {
      const gone = final.civs.some((c) => !c.alive && (c.id === l.lender || c.id === l.borrower));
      if (gone) assert.ok(l.state === "closed" || l.state === "repudiated", `seed ${seed} ${l.id} with a dead party`);
    }
  }
});

test("property: the same seed gives the same ledger and balances, with and without a reload between turns", () => {
  for (const seed of [1, 77, 4242]) {
    const a = run(seed, () => {});
    const b = run(seed, () => {});
    const c = run(seed, () => {}, true);
    assert.equal(save(a.ledger), save(b.ledger));
    assert.deepEqual([...a.balances], [...b.balances]);
    assert.equal(save(a.ledger), save(c.ledger), "save integrity: a reload every turn changes nothing");
    assert.deepEqual([...a.balances], [...c.balances]);
  }
});

test("property: the turn is order-free: every 7th turn re-planned with the civs reversed gives the same plan", () => {
  for (let i = 0; i < 40; i += 1) {
    run(9001 + i, ({ turn, plan, requests, state, civs, seed }) => {
      if (turn % 7 !== 0) return;
      const reversed = planTurn({ turn, age: state.age, civs: [...civs].reverse().map((c) => ({ ...c,
        balanceCents: state.balances.get(c.id) })), relations: [...(state.relations || [])].reverse(), requests,
        params: state.params, options: state.options || {}, ledger: state.ledger });
      assert.deepEqual(reversed.transfers, plan.transfers, `seed ${seed} turn ${turn}`);
      assert.deepEqual(reversed.ledger, plan.ledger, `seed ${seed} turn ${turn}`);
    });
  }
});

test("property: a loan is never planned twice: re-planning a turn from its saved ledger is a no-op", () => {
  run(9003, ({ turn, plan, state, civs }) => {
    if (turn % 11 !== 0) return;
    const again = planTurn({ turn, age: state.age, civs, relations: state.relations, requests: [], params: state.params,
      options: state.options, ledger: load(save(plan.ledger)).ledger });
    assert.equal(again.skipped, "already-planned");
    assert.deepEqual(again.transfers, []);
  });
});

test("property: the economies are not trivial (open, miss, default, close, restructure, repudiation, guard, cap)", () => {
  const seen = new Map();
  for (let i = 0; i < 80; i += 1) {
    run(9001 + i, ({ plan }) => { for (const e of plan.events) seen.set(e.kind, (seen.get(e.kind) || 0) + 1); });
  }
  for (const k of ["open", "miss", "default", "closed", "guard", "guard-cap", "writeoff", "restructure",
    "repudiation"]) {
    assert.ok(seen.get(k) > 0, k);
  }
});
