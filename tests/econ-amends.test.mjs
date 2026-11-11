// Making amends after a repudiation (DESIGN 4.5): the wronged civ lender is closed for 10 turns, then lends again at
// 1.5 times its rate for 10 turns at most; any loan from it before the repudiation is made good is an amends loan;
// repaying one in full books favors worth half the grudge, a named note from every other major, the reputation back,
// and the repudiation stops counting against credit. An AI asks for one for a reason, never on a cadence.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { amendsRatePpm, amendsRecord, offersFor } from "../ui/econ-lenders.js";
import { recentRepudiations } from "../ui/econ-credit.js";
import { amendsRefusal } from "../ui/econ-shortfall.js";
import { OPEN, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 4;
const LENDER = 6;
const record = (over = {}) => ({ pid: ME, lender: LENDER, turn: 40, cents: 50000, atWar: false, grudge: 20, note: 3,
  madeGood: null, ...over });
const ledgerWith = (over = {}) => ({ ...emptyLedger(), nextId: 5, repudiations: [record()],
  blocks: [{ lender: LENDER, borrower: ME, reason: "repudiation", agesLeft: null, untilTurn: 50 }], ...over });
const query = (over = {}) => ({ ledger: ledgerWith(), borrower: ME, borrowerCiv: { id: ME, stages: OPEN },
  principal: 10000, term: 10, age: "AGE_EXPLORATION", turn: 50, standing: 100,
  lenders: [{ id: LENDER, balanceCents: 1e6, stages: OPEN, depthTurns: 0 }], ...over });

test("the wronged lender is closed 10 turns, then offers amends loans at 1.5 times its rate, 10 turns at most", () => {
  const plain = offersFor(query({ ledger: emptyLedger() })).find((o) => o.lender === LENDER);
  assert.equal(offersFor(query({ turn: 45 })).some((o) => o.lender === LENDER), false, "still cooling off");
  const amends = offersFor(query()).find((o) => o.lender === LENDER);
  assert.deepEqual(amends, { lender: LENDER, ratePpm: amendsRatePpm(/** @type {any} */ (plain).ratePpm), amends: true });
  assert.equal(amends.ratePpm, Math.round((plain.ratePpm * 150) / 100));
  assert.equal(offersFor(query({ term: 20 })).some((o) => o.lender === LENDER), false, "no amends loan past 10 turns");
  const good = ledgerWith({ repudiations: [record({ madeGood: 48 })] });
  assert.deepEqual(offersFor(query({ ledger: good })).find((o) => o.lender === LENDER), plain, "made good: plain terms");
  assert.equal(amendsRecord(ledgerWith(), ME, "bond", 50), null, "a world lender has no amends");
});

test("a loan from the wronged lender is an amends loan, and the mark survives a save", () => {
  const plan = planTurn(input({ ledger: ledgerWith(), civs: [civ(ME, { human: true, balanceCents: 0, incomeCents: 10000 }),
    civ(LENDER, { balanceCents: 1e7 })], requests: [{ kind: "borrow", borrower: ME, lender: LENDER, principal: 5000,
    term: 10 }] }));
  const loan = plan.ledger.loans.find((l) => l.lender === LENDER);
  assert.ok(loan, JSON.stringify(plan.events.slice(-3)));
  assert.equal(loan.amends, 40);
  assert.equal(load(save(plan.ledger)).ledger.loans.find((l) => l.id === loan.id).amends, 40);
});

test("repaying an amends loan in full makes the repudiation good: favors, a named note, reputation, credit", () => {
  const due = { ...makeLoan({ id: "L1", lender: LENDER, borrower: ME, principal: 1000, ratePpm: 20000, term: 1,
    turn: 49 }), amends: 40 };
  const plan = planTurn(input({ ledger: ledgerWith({ loans: [due] }), civs: [civ(ME, { human: true }),
    civ(LENDER, { balanceCents: 1e7 })] }));
  assert.equal(plan.ledger.loans[0].state, "closed");
  assert.ok(plan.favors.some((f) => f.from === ME && f.to === LENDER && f.amount === 10), "half the grudge of 20");
  assert.deepEqual(plan.notes.filter((n) => n.line === "REPAID"), [{ pid: ME, line: "REPAID", amount: 3 }]);
  assert.equal(plan.ledger.repudiations[0].madeGood, 50);
  assert.ok(plan.events.some((e) => e.kind === "credit-rep" && e.why === "made-good" && e.points === 30));
  assert.ok(plan.events.some((e) => e.kind === "made-good" && e.borrower === ME && e.lender === LENDER));
  assert.deepEqual(recentRepudiations(plan.ledger, ME, 51), [], "it stops counting for terms and credit");
  assert.equal(amendsRecord(plan.ledger, ME, LENDER, 51), null);
  const plainDue = { ...due, amends: undefined };
  const plain = planTurn(input({ ledger: ledgerWith({ loans: [plainDue] }), civs: [civ(ME, { human: true }),
    civ(LENDER, { balanceCents: 1e7 })] }));
  assert.equal(plain.ledger.repudiations[0].madeGood, null, "a loan that isn't an amends loan makes nothing good");
});

test("an AI asks for amends only with a reason, and each missing reason names itself", () => {
  const ai = civ(AI, { incomeCents: 2000 });
  const ctx = (over = {}) => ({ turn: 50, relations: [], civ: new Map([[AI, ai], [LENDER, civ(LENDER)]]),
    ledger: { ...emptyLedger(), repudiations: [record({ pid: AI, turn: 35 })], loans: [] }, ...over });
  assert.equal(amendsRefusal(ctx(), ai).reason, null);
  assert.equal(amendsRefusal(ctx(), { ...ai, incomeCents: 0 }).reason, "income");
  assert.equal(amendsRefusal(ctx({ ledger: emptyLedger() }), ai).reason, "none");
  assert.equal(amendsRefusal(ctx({ turn: 42 }), ai).reason, "cooling");
  assert.equal(amendsRefusal(ctx({ relations: [{ a: AI, b: LENDER, level: "war" }] }), ai).reason, "war");
  const open = { ...makeLoan({ id: "L2", lender: LENDER, borrower: AI, principal: 100, ratePpm: 1, term: 10, turn: 46 }),
    amends: 35 };
  assert.equal(amendsRefusal(ctx({ ledger: { ...emptyLedger(), repudiations: [record({ pid: AI, turn: 35 })],
    loans: [open] } }), ai).reason, "open");
  const dead = ctx({ civ: new Map([[AI, ai], [LENDER, civ(LENDER, { alive: false })]]) });
  assert.equal(amendsRefusal(dead, ai).reason, "none", "a dead lender can't be made good with");
});

test("an AI with a reason takes an amends loan from an AI lender; a human lender is asked once", () => {
  const ledger = { ...emptyLedger(), nextId: 5, repudiations: [record({ pid: AI, turn: 35 })] };
  const plan = planTurn(input({ ledger, civs: [civ(ME, { human: true }), civ(AI, { incomeCents: 2000 }),
    civ(LENDER, { balanceCents: 1e7 })] }));
  const loan = plan.ledger.loans.find((l) => l.source === "amends");
  assert.ok(loan, JSON.stringify(plan.events.map((e) => e.kind)));
  assert.deepEqual([loan.lender, loan.borrower, loan.term, loan.amends, loan.principal], [LENDER, AI, 10, 35, 6000],
    "3 turns of its 20 Gold of income, 10 turns");
  const again = planTurn(input({ turn: 51, ledger: plan.ledger, civs: [civ(ME, { human: true }),
    civ(AI, { incomeCents: 2000 }), civ(LENDER, { balanceCents: 1e7 })] }));
  assert.equal(again.ledger.loans.filter((l) => l.source === "amends").length, 1, "one open at a time");
  const toHuman = { ...emptyLedger(), nextId: 5, repudiations: [record({ pid: AI, lender: ME, turn: 35 })] };
  const asked = planTurn(input({ ledger: toHuman, civs: [civ(ME, { human: true }), civ(AI, { incomeCents: 2000 })] }));
  assert.equal(asked.notices.filter((n) => n.kind === "amends-ask" && n.pid === ME).length, 1);
  const later = planTurn(input({ turn: 51, ledger: asked.ledger, civs: [civ(ME, { human: true }),
    civ(AI, { incomeCents: 2000 })] }));
  assert.equal(later.notices.some((n) => n.kind === "amends-ask"), false, "asked once per repudiation");
});

test("the wronged lender takes amends with 5 turns of income in reserve, not the 20 an ordinary loan needs", () => {
  // Lab 2026-11-10: Hawaii held about 15 turns of its income and never lent at the ordinary 20.
  const ledger = { ...emptyLedger(), nextId: 5, repudiations: [record({ pid: AI, turn: 35 })] };
  const run = (balanceCents) => planTurn(input({ ledger, civs: [civ(ME, { human: true }), civ(AI, { incomeCents: 2000 }),
    civ(LENDER, { balanceCents, incomeCents: 3000 })] })).ledger.loans.find((l) => l.source === "amends");
  assert.ok(run(45000), "15 turns of 30 Gold in hand");
  assert.equal(run(14000), undefined, "under 5 turns it keeps its Gold");
});

test("the wronged AI lender offers amends whatever the borrower's reputation; other AI lenders still want 50", () => {
  // Lab 2026-11-10: the seat, 10 turns after repudiating Persia, had no offer from it: its reputation was under 50.
  const ledger = { ...ledgerWith({ blocks: [] }), creditRep: [{ pid: ME, rep: 4100, turn: 50 }] };
  const civs = [civ(ME, { human: true, incomeCents: 10000 }), civ(LENDER, { balanceCents: 1e7 }), civ(AI, { balanceCents: 1e7 })];
  const relations = [{ a: ME, b: LENDER, level: "neutral" }, { a: ME, b: AI, level: "neutral" },
    { a: AI, b: LENDER, level: "neutral" }];
  const plan = planTurn(input({ ledger, civs, relations, requests: [{ kind: "borrow", borrower: ME, lender: LENDER,
    principal: 5000, term: 10 }, { kind: "borrow", borrower: ME, lender: AI, principal: 5000, term: 10 }] }));
  const loans = plan.ledger.loans.filter((l) => l.borrower === ME);
  assert.deepEqual(loans.map((l) => [l.lender, l.amends]), [[LENDER, 40]], JSON.stringify(plan.events.map((e) => e.kind + ":" + (e.reason || ""))));
});
