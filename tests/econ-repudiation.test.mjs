import test from "node:test";
import assert from "node:assert/strict";

import { grudgeFor, repudiate, witnessDelta } from "../ui/econ-repudiation.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";

const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: 6, borrower: 2, principal: 10000, ratePpm: 20000, term: 10,
  turn: 1 }), ...over });

test("grudge (DESIGN 4.5): 5 per turn of the lender's income lost, 10 at 2 turns or less, 40 at 8 or more", () => {
  assert.equal(grudgeFor(2000, 1000), 10);
  assert.equal(grudgeFor(1, 1000), 10);
  assert.equal(grudgeFor(5000, 1000), 25);
  assert.equal(grudgeFor(8000, 1000), 40);
  assert.equal(grudgeFor(1e9, 1000), 40);
  assert.equal(grudgeFor(5000, 100), 25, "the lender's income is floored at 10 Gold");
  assert.equal(grudgeFor(5000, -3000), 25);
});

test("witnesses: -3 each; doubled for the bond market or temple; halved against an enemy at war", () => {
  assert.equal(witnessDelta({ worldLender: false, atWar: false }), -3);
  assert.equal(witnessDelta({ worldLender: true, atWar: false }), -6);
  assert.equal(witnessDelta({ worldLender: false, atWar: true }), -2);
});

test("repudiating a civ closes every open record with it, writes the debt off, books the grudge and the block", () => {
  const ledger = { ...emptyLedger(), loans: [loan("L1", { outstanding: 7000 }), loan("L2", { state: "default",
    missed: 3, outstanding: 3000 }), loan("L3", { lender: 9 }), loan("L4", { state: "closed", outstanding: 0 })] };
  const r = repudiate({ ledger, turn: 30, borrower: 2, lender: 6, lenderIncomeCents: 2000, witnesses: [9, 11, 6, 2] });
  assert.equal(r.writtenOff, 10000);
  assert.deepEqual(r.loanIds.sort(), ["L1", "L2"]);
  assert.deepEqual(r.ledger.loans.map((l) => [l.id, l.state, l.outstanding, l.writtenOff]),
    [["L1", "repudiated", 0, 7000], ["L2", "repudiated", 0, 3000], ["L3", "active", 10000, 0], ["L4", "closed", 0, 0]]);
  assert.deepEqual(r.grievances, [{ from: 2, against: 6, amount: 25 }]);
  assert.deepEqual(r.relationships, [{ a: 2, b: 9, delta: -3 }, { a: 2, b: 11, delta: -3 }],
    "the lender and the repudiator are never witnesses");
  assert.deepEqual(r.ledger.blocks, [{ lender: 6, borrower: 2, reason: "repudiation", agesLeft: 1, untilTurn: null }]);
  assert.deepEqual(r.ledger.repudiations, [{ pid: 2, lender: 6, turn: 30, cents: 10000, atWar: false }]);
  assert.equal(ledger.loans[0].state, "active", "the input ledger is left alone");
});

test("repudiating the bond market: no grudge, witnesses doubled, closed for 30 turns", () => {
  const ledger = { ...emptyLedger(), loans: [loan("L1", { lender: "bond" })] };
  const r = repudiate({ ledger, turn: 30, borrower: 2, lender: "bond", witnesses: [9] });
  assert.deepEqual(r.grievances, []);
  assert.deepEqual(r.relationships, [{ a: 2, b: 9, delta: -6 }]);
  assert.equal(r.ledger.blocks[0].untilTurn, 60);
});

test("repudiating an enemy at war: half the witnesses' cost, the standing record marked", () => {
  const ledger = { ...emptyLedger(), loans: [loan("L1")] };
  const r = repudiate({ ledger, turn: 30, borrower: 2, lender: 6, atWar: true, witnesses: [9] });
  assert.deepEqual(r.relationships, [{ a: 2, b: 9, delta: -2 }]);
  assert.equal(r.ledger.repudiations[0].atWar, true);
  assert.equal(r.grievances[0].amount, 40, "10000 cents over 10 Gold a turn is 10 turns");
});

test("nothing owed: null, and no record", () => {
  assert.equal(repudiate({ ledger: emptyLedger(), turn: 1, borrower: 2, lender: 6 }), null);
  const closed = { ...emptyLedger(), loans: [loan("L1", { state: "closed", outstanding: 0 })] };
  assert.equal(repudiate({ ledger: closed, turn: 1, borrower: 2, lender: 6 }), null);
});
