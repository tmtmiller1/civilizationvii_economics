import test from "node:test";
import assert from "node:assert/strict";

import { blockFor, blocksAfterAge, bondRatePpm, civLenderRefusal, civRatePpm, emergencyOffersFor, hasDefaultAgainst,
  isBlocked, maxTerm, offersFor, rateCapPpm, relationLevel, relationPct, termRefusal, worldRatePpm }
  from "../ui/econ-lenders.js";
import { emptyLedger } from "../ui/econ-state.js";
import { CLOSED, OPEN } from "./_fixtures.mjs";

const ex = "AGE_EXPLORATION";
const base = { ledger: emptyLedger(), lender: 5, borrower: 2, principal: 10000, balanceCents: 20000, level: "neutral",
  turn: 50 };
const lender = (id, over = {}) => ({ id, balanceCents: 1e6, stages: OPEN, depthTurns: 0, ...over });
const query = (over = {}) => ({ ledger: emptyLedger(), borrower: 2, borrowerCiv: { id: 2, stages: OPEN }, principal: 10000,
  term: 10, age: ex, turn: 50, standing: 100, ...over });

test("a civ lends only with balance >= 2 * P, net of what it committed this turn", () => {
  assert.equal(civLenderRefusal(base), null);
  assert.equal(civLenderRefusal({ ...base, balanceCents: 19999 }), "balance");
});

test("a civ never lends at war, nor to itself", () => {
  assert.equal(civLenderRefusal({ ...base, level: "war" }), "war");
  assert.equal(civLenderRefusal({ ...base, lender: 2 }), "self");
});

test("a civ never lends with a default against the borrower, nor while a block stands", () => {
  const def = { ...emptyLedger(), loans: [{ id: "L1", lender: 5, borrower: 2, state: "default" }] };
  assert.equal(hasDefaultAgainst(def, 5, 2), true);
  assert.equal(civLenderRefusal({ ...base, ledger: def }), "blocked");
  const blk = { ...emptyLedger(), blocks: [blockFor({ lender: 5, borrower: 2, reason: "default", turn: 1 })] };
  assert.equal(isBlocked(blk, 5, 2, 50), true);
  assert.equal(isBlocked(blk, 2, 5, 50), false);
  assert.equal(civLenderRefusal({ ...base, ledger: blk }), "blocked");
});

test("blocks (DESIGN 4.5): a default ends with the age, a civ repudiation in 10 turns, a world one in 30 turns", () => {
  const d = blockFor({ lender: 5, borrower: 2, reason: "default", turn: 10 });
  const r = blockFor({ lender: 5, borrower: 2, reason: "repudiation", turn: 10 });
  const b = blockFor({ lender: "bond", borrower: 2, reason: "repudiation", turn: 10 });
  const t = blockFor({ lender: "temple", borrower: 2, reason: "repudiation", turn: 10 });
  assert.deepEqual(d, { lender: 5, borrower: 2, reason: "default", agesLeft: 0, untilTurn: null });
  assert.deepEqual(r, { lender: 5, borrower: 2, reason: "repudiation", agesLeft: null, untilTurn: 20 });
  assert.equal(b.untilTurn, 40);
  assert.equal(t.untilTurn, 40);
  const next = blocksAfterAge([d, r, b]);
  assert.deepEqual(next.map((x) => [x.lender, x.agesLeft]), [[5, null], ["bond", null]], "turn blocks run on");
  assert.deepEqual(blocksAfterAge(next).map((x) => x.lender), [5, "bond"]);
  const led = { ...emptyLedger(), blocks: [b] };
  assert.equal(isBlocked(led, "bond", 2, 39), true);
  assert.equal(isBlocked(led, "bond", 2, 40), false);
});

test("r_L = base / standing * relation_factor (0.8, 1.0, 1.3) * depth_factor", () => {
  assert.equal(civRatePpm({ age: ex, standing: 100, level: "friendly" }), 8000);
  assert.equal(civRatePpm({ age: ex, standing: 100, level: "neutral" }), 10000);
  assert.equal(civRatePpm({ age: ex, standing: 100, level: "unfriendly" }), 13000);
  assert.equal(civRatePpm({ age: ex, standing: 50, level: "neutral" }), 20000);
  assert.equal(civRatePpm({ age: "AGE_MODERN", standing: 100, level: "neutral" }), 7500);
  assert.equal(civRatePpm({ age: "AGE_ANTIQUITY", standing: 100, level: "neutral" }), 15000);
  assert.equal(civRatePpm({ age: ex, standing: 100, level: "neutral", depthFactorPct: 75 }), 7500);
});

test("rates stop at r_cap = 4 * base, miss steps included; the rates option scales rate and cap alike", () => {
  assert.equal(rateCapPpm(ex), 40000);
  assert.equal(rateCapPpm(ex, 125), 50000);
  assert.equal(rateCapPpm("AGE_NOPE"), null);
  assert.equal(civRatePpm({ age: ex, standing: 10, level: "unfriendly" }), 40000);
  assert.equal(worldRatePpm({ age: ex, standing: 10 }), 40000);
  assert.equal(civRatePpm({ age: ex, standing: 100, level: "neutral", rates: 75 }), 7500);
  assert.equal(bondRatePpm({ age: ex, standing: 100, rates: 125 }), 25000);
});

test("bond market and temple treasuries: 2 * base / standing * depth_factor", () => {
  assert.equal(bondRatePpm({ age: ex, standing: 100 }), 20000);
  assert.equal(bondRatePpm({ age: ex, standing: 80 }), 25000);
  assert.equal(bondRatePpm({ age: "AGE_MODERN", standing: 80 }), 18750);
  assert.equal(worldRatePpm({ age: "AGE_ANTIQUITY", standing: 100, depthFactorPct: 90 }), 27000);
  assert.equal(worldRatePpm({ age: "AGE_NOPE", standing: 100 }), null);
});

test("relations: either order matches; unknown pairs and unknown levels are neutral", () => {
  const rel = [{ a: 5, b: 2, level: "friendly" }];
  assert.equal(relationLevel(rel, 2, 5), "friendly");
  assert.equal(relationLevel(rel, 2, 7), "neutral");
  assert.equal(relationLevel(undefined, 2, 7), "neutral");
  assert.equal(relationPct("allied-ish"), 100);
});

test("offers: civ lenders cheapest first, ineligible ones dropped, the bond market last with no balance test", () => {
  const rel = [{ a: 5, b: 2, level: "unfriendly" }, { a: 8, b: 2, level: "friendly" }, { a: 9, b: 2, level: "war" }];
  const lenders = [lender(5), lender(8), lender(9), lender(11, { balanceCents: 10 })];
  assert.deepEqual(offersFor(query({ lenders, relations: rel })), [{ lender: 8, ratePpm: 8000 },
    { lender: 5, ratePpm: 13000 }, { lender: "bond", ratePpm: 20000 }]);
});

test("offers: a borrower blocked by the bond market gets no bond offer", () => {
  const ledger = { ...emptyLedger(), blocks: [blockFor({ lender: "bond", borrower: 2, reason: "default", turn: 1 })] };
  assert.deepEqual(offersFor(query({ ledger })), []);
});

test("stage gates (DESIGN 4.15): civ loans need Moneylending on both sides, the bond market Public debt", () => {
  const lenders = [lender(5), lender(8, { stages: CLOSED })];
  const noML = query({ borrowerCiv: { id: 2, stages: CLOSED }, lenders });
  assert.deepEqual(offersFor(noML), []);
  const ml = query({ borrowerCiv: { id: 2, stages: { moneylending: 50, publicDebt: null } }, lenders });
  assert.deepEqual(offersFor(ml).map((o) => o.lender), [5], "lender 8 has no Moneylending; no bond market yet");
  assert.deepEqual(offersFor({ ...noML, options: { stages: false } }).map((o) => o.lender), [5, 8, "bond"]);
  assert.deepEqual(offersFor(query({ age: "AGE_ANTIQUITY", lenders: [lender(5)] })).map((o) => o.ratePpm),
    [15000, 30000], "Antiquity lends from Moneylending at 0.015");
});

test("terms (DESIGN 4.3): 20 turns need the borrower's Moneylending; 30 its Public debt and from a civ a Banking building", () => {
  const q = { ledger: emptyLedger(), borrower: 2, turn: 50, options: {} };
  const pd = { id: 2, stages: OPEN };
  const noPd = { id: 2, stages: { moneylending: 1, publicDebt: null } };
  const noMl = { id: 2, stages: CLOSED };
  assert.equal(termRefusal({ ...q, borrowerCiv: noPd, lenderCiv: null, term: 10 }), null);
  assert.equal(termRefusal({ ...q, borrowerCiv: noMl, lenderCiv: null, term: 20 }), "term-stage");
  assert.equal(termRefusal({ ...q, borrowerCiv: noPd, lenderCiv: null, term: 20 }), null, "Moneylending opens 20");
  assert.equal(termRefusal({ ...q, borrowerCiv: noPd, lenderCiv: null, term: 30 }), "term-stage");
  assert.equal(termRefusal({ ...q, borrowerCiv: noPd, lenderCiv: lender(5), term: 20 }), null, "no Bank needed for 20");
  assert.equal(termRefusal({ ...q, borrowerCiv: pd, lenderCiv: lender(5), term: 30 }), "term-banking");
  assert.equal(termRefusal({ ...q, borrowerCiv: pd, lenderCiv: lender(5, { depthTurns: 2 }), term: 30 }), null);
  assert.equal(termRefusal({ ...q, borrowerCiv: pd, lenderCiv: null, term: 30 }), null, "the bond market needs no Bank");
  const offers = offersFor(query({ term: 30, lenders: [lender(5), lender(8, { depthTurns: 2 })] }));
  assert.deepEqual(offers.map((o) => o.lender), [8, "bond"]);
  const early = offersFor(query({ term: 20, borrowerCiv: noPd, lenders: [lender(5)] }));
  assert.deepEqual(early.map((o) => o.lender), [5], "a civ lends over 20 turns before the bond market opens");
});

test("while a repudiation counts, terms are 10 at most", () => {
  const ledger = { ...emptyLedger(), repudiations: [{ pid: 2, lender: 9, turn: 20, cents: 1, atWar: false }] };
  assert.equal(maxTerm(ledger, 2, 59), 10);
  assert.equal(maxTerm(ledger, 2, 60), Infinity);
  assert.equal(termRefusal({ ledger, borrower: 2, borrowerCiv: { stages: OPEN }, lenderCiv: null, term: 20, turn: 30,
    options: {} }), "term-repudiation");
});

test("emergency offers (DESIGN 4.6): temple before Moneylending; civs first at Moneylending; cheapest of civs and bond"
  + " at Public debt; a blocked world lender makes none", () => {
  const lenders = [lender(5)];
  const early = emergencyOffersFor(query({ borrowerCiv: { id: 2, stages: CLOSED }, lenders }));
  assert.deepEqual(early, [{ lender: "temple", ratePpm: 20000 }]);
  const ml = query({ borrowerCiv: { id: 2, stages: { moneylending: 1, publicDebt: null } }, lenders });
  assert.deepEqual(emergencyOffersFor(ml).map((o) => o.lender), [5], "a civ will lend, so no temple offer");
  assert.deepEqual(emergencyOffersFor({ ...ml, lenders: [] }).map((o) => o.lender), ["temple"]);
  const pd = emergencyOffersFor(query({ lenders, relations: [{ a: 5, b: 2, level: "unfriendly" }], standing: 40 }));
  assert.deepEqual(pd.map((o) => [o.lender, o.ratePpm]), [[5, 32500], ["bond", 40000]]);
  const blocked = { ...emptyLedger(), blocks: [blockFor({ lender: "temple", borrower: 2, reason: "repudiation",
    turn: 40 })] };
  assert.deepEqual(emergencyOffersFor(query({ ledger: blocked, borrowerCiv: { id: 2, stages: CLOSED } })), []);
});
