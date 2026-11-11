import test from "node:test";
import assert from "node:assert/strict";

import { MOD_ID, VERSION, emptyLedger, load, sanitizeLedger, save, utf8Bytes } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { planTurn } from "../ui/econ-plan.js";
import { civ, input } from "./_fixtures.mjs";

const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: 3, principal: 1000, ratePpm: 40000,
  term: 10, turn: 5 }), ...over });

test("envelope: carries the mod id and version, and loads back", () => {
  const text = save({ ...emptyLedger(), loans: [loan("L1")], nextId: 2 });
  const obj = JSON.parse(text);
  assert.equal(obj.mod, MOD_ID);
  assert.equal(obj.v, VERSION);
  const back = load(text);
  assert.equal(back.ok, true);
  assert.equal(back.ledger.loans[0].id, "L1");
});

test("envelope: save(load(x)) is a fixed point on a ledger with every kind of row", () => {
  const civs = [civ(3, { human: true, balanceCents: 1e6 }), civ(7, { balanceCents: -9000, incomeCents: -100 }),
    civ(9, { incomeCents: 1000 })];
  const relations = [{ a: 3, b: 9, level: "neutral" }, { a: 7, b: 9, level: "war" }];
  const first = planTurn(input({ civs, relations, requests: [{ kind: "borrow", borrower: 3, lender: "bond",
    principal: 5000, term: 10 }] }));
  const owed = { ...first.ledger, loans: [...first.ledger.loans, loan("L9", { borrower: 7, lender: 9 }),
    loan("L10", { borrower: 3, lender: 9, missed: 1 })] };
  const plan = planTurn(input({ turn: 51, ledger: owed, civs, relations, options: { taxFallback: true },
    requests: [{ kind: "repudiate", borrower: 3, lender: 9 }, { kind: "tax", pid: 3, level: "heavy" }] }));
  assert.ok(plan.ledger.repudiations.length >= 1 && plan.ledger.lastBatch && plan.ledger.lowIncome.length);
  const once = save(plan.ledger);
  assert.equal(save(load(once).ledger), once);
  assert.equal(save(load(save(load(once).ledger)).ledger), once);
});

test("envelope: refuses foreign, unparseable and newer blobs without throwing", () => {
  assert.equal(load("{not json").reason, "unparseable");
  assert.equal(load(JSON.stringify({ mod: "other", v: 1 })).reason, "foreign");
  assert.equal(load({ mod: MOD_ID }).reason, "foreign");
  assert.equal(load({ mod: MOD_ID, v: 0 }).reason, "foreign");
  assert.equal(load({ mod: MOD_ID, v: VERSION + 1, ledger: {} }).reason, "newer");
  assert.equal(load(42).reason, "foreign");
  assert.equal(load("").ok, true);
  assert.equal(load(undefined).reason, "empty");
  for (const bad of ["null", "[]", "\"x\"", "{\"mod\":\"tower-economics\",\"v\":1,\"ledger\":7}"]) {
    assert.doesNotThrow(() => load(bad));
  }
  assert.deepEqual(load("[]").ledger, emptyLedger());
});

test("a version 1 envelope loads: its loans get the new flags' defaults", () => {
  const v1 = JSON.stringify({ mod: MOD_ID, v: 1, ledger: { nextId: 2, loans: [{ id: "L1", lender: "bond", borrower: 3,
    principal: 1000, outstanding: 900, ratePpm: 40000, term: 10, paid: 1, missed: 0, state: "active", opened: 5,
    closedTurn: null, writtenOff: 0, kind: "guard" }], blocks: [{ lender: "bond", borrower: 3 }] } });
  const l = load(v1).ledger;
  assert.deepEqual([l.loans[0].kind, l.loans[0].source, l.loans[0].emergency, l.loans[0].restructured],
    ["loan", "borrow", false, false]);
  assert.deepEqual(l.blocks, [{ lender: "bond", borrower: 3, reason: "default", agesLeft: 0, untilTurn: null }]);
  assert.equal(l.lastBatch, null);
});

test("sanitize: drops malformed loans, duplicate ids, active loans past the default line; keeps repudiated", () => {
  const raw = { loans: [loan("L1"), loan("L1"), loan("bad"), loan("L2", { outstanding: -1 }),
    loan("L3", { lender: 3 }), loan("L4", { state: "active", missed: 3 }), loan("L5", { state: "weird" }),
    loan("L6", { borrower: 1.5 }), loan("L7", { paid: 11 }), null, loan("L8", { kind: "odd", source: "odd",
    writtenOff: -4, emergency: 1 }), loan("L9", { state: "repudiated", outstanding: 0, writtenOff: 5,
    lender: "temple" })] };
  const l = sanitizeLedger(raw);
  assert.deepEqual(l.loans.map((x) => x.id), ["L1", "L8", "L9"]);
  assert.deepEqual([l.loans[1].kind, l.loans[1].source, l.loans[1].writtenOff, l.loans[1].emergency],
    ["loan", "borrow", 0, false]);
  assert.equal(l.loans[2].state, "repudiated");
});

test("loan ids are stable across reload, and nextId never reuses one", () => {
  const l = sanitizeLedger({ nextId: 2, loans: [loan("L9")] });
  assert.equal(l.nextId, 10);
  assert.equal(sanitizeLedger({ nextId: 40, loans: [loan("L9")] }).nextId, 40);
  const reloaded = load(save(l)).ledger;
  assert.equal(reloaded.loans[0].id, "L9");
  const plan = planTurn(input({ ledger: reloaded, civs: [civ(3, { human: true })],
    requests: [{ kind: "borrow", borrower: 3, lender: "bond", principal: 100, term: 10 }] }));
  assert.equal(plan.ledger.loans.at(-1).id, "L10");
});

test("sanitize: blocks, misses, repudiations, counters, taxes and the batch keep only well-formed rows", () => {
  const l = sanitizeLedger({
    blocks: [{ lender: "bond", borrower: 2, reason: "repudiation", untilTurn: 40 }, { lender: "bond", borrower: 2 },
      { lender: -1 }, { lender: 5, borrower: 2, reason: "repudiation", agesLeft: 1 }],
    misses: [{ pid: 2, turn: 3 }, { pid: "2", turn: 3 }, { pid: 2, turn: 3, n: 2 }],
    repudiations: [{ pid: 2, lender: 5, turn: 3, cents: 10, atWar: "yes" }, { pid: 2, lender: 5, turn: 3 }],
    guardTurns: [{ pid: 2, turn: 3 }, { pid: 2, turn: 4 }],
    capHits: [{ pid: 2, turn: 3 }], lowIncome: [{ pid: 2, turns: 4 }, { pid: 2, turns: 9 }, { pid: 3, turns: "x" }],
    taxes: [{ pid: 2, level: "heavy", changedTurn: 1 }, { pid: 2, level: "light", changedTurn: 2 }, { pid: 4 }],
    lastBatch: { id: "B3", turn: 9, civs: [{ pid: 2, snapshot: 10, net: -3 }, { pid: "x" }] },
    batchSeq: 3, age: 5, lastTurn: "x" });
  assert.deepEqual(l.blocks, [{ lender: "bond", borrower: 2, reason: "repudiation", agesLeft: null, untilTurn: 40 },
    { lender: 5, borrower: 2, reason: "repudiation", agesLeft: 1, untilTurn: null }]);
  assert.deepEqual(l.misses, [{ pid: 2, turn: 3, n: 3 }]);
  assert.deepEqual(l.repudiations, [{ pid: 2, lender: 5, turn: 3, cents: 10, atWar: false, grudge: 0, note: 0,
    madeGood: null }]);
  assert.deepEqual(l.guardTurns, [{ pid: 2, turn: 3 }]);
  assert.deepEqual(l.capHits, [{ pid: 2, turn: 3 }]);
  assert.deepEqual(l.lowIncome, [{ pid: 2, turns: 4 }]);
  assert.deepEqual(l.taxes, [{ pid: 2, level: "heavy", changedTurn: 1 }]);
  assert.deepEqual(l.lastBatch, { id: "B3", turn: 9, civs: [{ pid: 2, snapshot: 10, net: -3, influence: 0,
    celebration: 0 }] });
  assert.equal(l.batchSeq, 3);
  assert.equal(l.age, null);
  assert.equal(l.lastTurn, null);
  assert.equal(sanitizeLedger({ lastBatch: { id: 7 } }).lastBatch, null);
});

test("event log: capped at 100, oldest dropped; non-primitive fields stripped", () => {
  const events = Array.from({ length: 150 }, (_, i) => ({ turn: i, kind: "miss", nested: { x: 1 }, n: i }));
  const l = sanitizeLedger({ events: [...events, { kind: "no-turn" }] });
  assert.equal(l.events.length, 100);
  assert.equal(l.events[0].turn, 50);
  assert.equal("nested" in l.events[0], false);
});

test("settled loans: only the newest 32 closed or repudiated kept; open ones are never pruned", () => {
  const loans = Array.from({ length: 80 }, (_, i) => loan(`L${i + 1}`, { state: i % 2 ? "closed" : "repudiated",
    outstanding: 0 }));
  loans.push(loan("L81"));
  const l = sanitizeLedger({ loans });
  assert.equal(l.loans.filter((x) => x.state !== "active").length, 32);
  assert.equal(l.loans.at(-1).id, "L81");
});

test("envelope: the worst case the caps allow (12 civs x 6 open loans, 32 settled, 100 events, a batch) fits", () => {
  const big = { principal: 999999999, outstanding: 999999999, ratePpm: 400000, opened: 99999, writtenOff: 999999999,
    closedTurn: 99999, source: "ai-shortfall", lender: 99, emergency: true, restructured: true };
  const open = Array.from({ length: 72 }, (_, i) => loan(`L${100000 + i}`, { ...big, borrower: 100 + i,
    state: "default", missed: 3, closedTurn: null }));
  const closed = Array.from({ length: 32 }, (_, i) => loan(`L${200000 + i}`, { ...big, borrower: 300 + i,
    state: "repudiated", outstanding: 0 }));
  const events = Array.from({ length: 100 }, (_, i) => ({ turn: 99999 + i, kind: "repudiation", loanId: "L999999",
    lender: "bond", borrower: 99, cents: 999999999, ratePpm: 400000, term: 30, source: "ai-shortfall", chronicle: 1,
    grievances: 40, loans: 8 }));
  const pids = Array.from({ length: 12 }, (_, i) => 100 + i);
  const rows = (f) => pids.map(f);
  const text = save({ ...emptyLedger(), loans: [...open, ...closed], events, batchSeq: 99999,
    blocks: pids.flatMap((p) => [{ lender: "bond", borrower: p, reason: "repudiation", untilTurn: 99999 },
      { lender: 999, borrower: p, reason: "repudiation", agesLeft: 1 }]),
    misses: pids.flatMap((p) => Array.from({ length: 20 }, (_, k) => ({ pid: p, turn: 99999 - k, n: 6 }))),
    repudiations: pids.flatMap((p) => Array.from({ length: 2 }, (_, k) => ({ pid: p, lender: 999, turn: 99999 - k,
      cents: 999999999, atWar: true }))),
    guardTurns: rows((p) => ({ pid: p, turn: 99999 })), capHits: rows((p) => ({ pid: p, turn: 99999 })),
    lowIncome: rows((p) => ({ pid: p, turns: 99999 })), taxes: rows((p) => ({ pid: p, level: "standard",
      changedTurn: 99999 })),
    lastBatch: { id: "B99999", turn: 99999, civs: rows((p) => ({ pid: p, snapshot: -999999999, net: -999999999,
      influence: -999, celebration: -999999 })) } });
  assert.ok(utf8Bytes(text) <= 65536, `${utf8Bytes(text)} bytes`);
  assert.equal(JSON.parse(text).ledger.loans.length, 104);
  assert.equal(JSON.parse(text).ledger.events.length, 100);
});

test("envelope: past 64 KB, save drops events then settled loans, never an open one", () => {
  const loans = Array.from({ length: 400 }, (_, i) => loan(`L${i + 1}`, { borrower: i % 7 }));
  const events = Array.from({ length: 100 }, (_, i) => ({ turn: i, kind: "x".repeat(60), a: "y".repeat(60) }));
  const text = save({ ...emptyLedger(), loans, events });
  assert.equal(JSON.parse(text).ledger.events.length, 0);
  assert.equal(JSON.parse(text).ledger.loans.length, 400, "open loans are the caller's cap to keep, not save's");
});

test("utf8 byte count matches Buffer for mixed text", () => {
  const s = "aé中😀";
  assert.equal(utf8Bytes(s), Buffer.byteLength(s, "utf8"));
});
