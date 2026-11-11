// The standing Gold lines (econ-standing.js): each civ's lines for the next roll from the ledger after the turn, in
// whole Gold per loan and per bill so a lender's line matches its borrowers'; a borrower's charges stop at what it can
// still pay after the batch, its overdraft included (DESIGN 4.18); the batch row takes what the lines moved at the roll off the grant, and a reload still tells a landed grant
// from a lost one.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { batchStatus, createBatch, grantOf, paidOf, record } from "../ui/econ-batch.js";
import { chargeCents, markerType, parseMarkerType, priceRiseBp, priceRiseFor, priceStackFor, priceStandFor, rungsOf,
  standAmount, standingRows }
  from "../ui/econ-standing.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });
const ledgerWith = (loans) => ({ ...emptyLedger(), loans, nextId: loans.length + 1 });
const lines = (plan) => (plan.standing || []).map((row) => [row.pid, row.line, row.gold]);

test("rungs add up to the amount, largest first, and stop at 1,023", () => {
  assert.deepEqual(rungsOf(23), [16, 4, 2, 1]);
  assert.deepEqual(rungsOf(0), []);
  assert.deepEqual(rungsOf(-5), []);
  assert.deepEqual(rungsOf(2000), [512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
  assert.equal(markerType("DEBT", 16), "BUILDING_ECON_LINE_DEBT_16");
  assert.deepEqual(parseMarkerType("BUILDING_ECON_LINE_BILLIN_512"), { line: "BILLIN", rung: 512 });
  assert.deepEqual(parseMarkerType("BUILDING_ECON_LINE_WORLD_4"), { line: "WORLD", rung: 4 });
  assert.equal(parseMarkerType("BUILDING_ECON_LINE_DEBT_3"), null, "only the ladder's rungs");
  assert.equal(parseMarkerType("BUILDING_PALACE"), null);
  assert.equal(chargeCents([{ line: "DEBT", rung: 16 }, { line: "DEBT", rung: 4 }, { line: "LOAN", rung: 2 }]), -1800);
});

test("next turn's loan payment becomes a Debt service line; a civ lender gets the same Gold as Loan repayments", () => {
  const civLoan = loan("L1", { lender: AI });
  const plan = planTurn(input({ ledger: ledgerWith([civLoan]),
    civs: [civ(ME, { incomeCents: 10000 }), civ(AI, { incomeCents: 10000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 20], [AI, "LOAN", 20]], "2070 due next turn: 20 whole Gold each side");
});

test("a bond's borrower gets a Debt service line and nobody gets the repayment line", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [civ(ME, { incomeCents: 10000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 20]]);
});

test("a borrower's lines stop at what it can still pay, its overdraft included, and can take its income below 0", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1"), loan("L2", { opened: 2 })]),
    civs: [civ(ME, { human: true, incomeCents: 3000, balanceCents: 100000 })] }));
  assert.deepEqual(lines(plan), [[ME, "DEBT", 40]], "two payments of 20 against an income of 30: both stand");
  const broke = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { human: true, incomeCents: -500, balanceCents: 100000 })] }));
  assert.deepEqual(lines(broke), [[ME, "DEBT", 20]], "an income below 0 still carries its debt service");
  const spent = planTurn(input({ ledger: ledgerWith([loan("L1")]), options: { guard: false },
    civs: [civ(ME, { human: true, incomeCents: 1000, balanceCents: 0 })] }));
  assert.deepEqual(lines(spent), [], "no overdraft and nothing left after the batch: no room");
  const overdrawn = planTurn(input({ ledger: ledgerWith([loan("L1")]), options: { guard: false },
    civs: [civ(ME, { human: true, incomeCents: 1000, balanceCents: 0, overdraftCents: undefined })] }));
  assert.deepEqual(overdrawn.transfers.map((t) => [t.reason, t.cents]), [["payment", 2100]],
    "the overdraft (100 Gold) pays the 21 the 10 of funds can't");
  assert.deepEqual(lines(overdrawn).filter(([, line]) => line === "DEBT"), [[ME, "DEBT", 20]]);
});

test("the batch row carries what the lines moved at the roll, and the grant takes it off", () => {
  // The roll took 20 Gold; the glue counted it back into the balance, so the plan pays as if it hadn't.
  const plain = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [civ(ME, { incomeCents: 10000 })] }));
  const charged = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { incomeCents: 10000, engineCents: -2000 })] }));
  const row = charged.batch.civs[0];
  assert.equal(row.engine, -2000);
  assert.equal(paidOf(row), paidOf(plain.batch.civs[0]), "the plan's payment doesn't change");
  assert.equal(grantOf(row), paidOf(row) + 2000, "the 20 the roll took comes off what the grant takes");
  assert.equal(plain.batch.civs[0].engine, undefined, "no lines, no field");
  assert.deepEqual(checkPlan({ plan: charged, civs: [civ(ME, { incomeCents: 10000 })] }), []);
  const kept = load(save(charged.ledger));
  assert.equal(kept.ledger.lastBatch.civs[0].engine, -2000, "the save keeps it");
});

test("on reload a grant that landed and one that was lost are told apart with the lines' charge", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { incomeCents: 10000, engineCents: -2000 })] }));
  const row = plan.batch.civs[0];
  const raw = row.snapshot + row.engine;
  const landed = batchStatus(plan.batch, new Map([[ME, raw + grantOf(row)]]))[0];
  assert.equal(landed.status, "landed");
  const lost = batchStatus(plan.batch, new Map([[ME, raw]]))[0];
  assert.deepEqual([lost.status, lost.cents], ["lost", grantOf(row)], "re-sent as the grant, not the payment");
});

test("this turn's trade bill stands as next turn's Trade bills lines", () => {
  const plan = planTurn(input({ ledger: emptyLedger(), civs: [civ(ME, { incomeCents: 10000 }), civ(AI)] }));
  const trade = plan.transfers.find((t) => t.reason === "trade");
  if (!trade) { assert.deepEqual(lines(plan), []); return; }
  const gold = Math.floor(trade.cents / 100);
  assert.deepEqual(lines(plan).filter(([, line]) => line.startsWith("BILL")),
    gold ? [[trade.from, "BILL", gold], [trade.to, "BILLIN", gold]].sort((a, b) => a[0] - b[0]) : []);
});

// The world-account lines, read straight from a turn's transfers.
const worldRows = (transfers, civs, loans = []) => standingRows({ ledger: ledgerWith(loans), out: { transfers },
  crisis: null }, civs).map((row) => [row.pid, row.line, row.gold]);
const tr = (from, to, cents, reason, loanId = "X") => ({ loanId, turn: 5, from, to, cents, reason, parts: {} });

test("recurring world charges stand as Economy costs, world payments as Economy receipts", () => {
  const rows = worldRows([tr(ME, "inflation", 1250, "erosion"), tr(ME, "cycle", 800, "cycle"),
    tr("cycle", AI, 1999, "cycle"), tr(AI, "citizens", 300, "relief")],
  [civ(ME, { incomeCents: 10000 }), civ(AI, { incomeCents: 10000 })]);
  assert.deepEqual(rows, [[ME, "WORLD", 20], [AI, "WORLD", 3], [AI, "WORLDIN", 19]],
    "whole Gold per transfer: 12 + 8 for ME; 19.99 is 19");
});

test("one-off world Gold stays a grant; a path's Gold a settlement recurs, its lump sum doesn't", () => {
  const rows = worldRows([tr(ME, "bond", 5000, "response", "CR3"), tr("bond", ME, 9000, "policy", "PL3-1-1"),
    tr(ME, "citizens", 400, "policy", "PLC3-1-1"), tr(ME, "progress", 700, "policy", "PLP3-1-1"),
    tr(ME, AI, 600, "trade")], [civ(ME, { incomeCents: 10000 }), civ(AI, { incomeCents: 10000 })]);
  assert.deepEqual(rows.filter(([, line]) => line === "WORLD"), [[ME, "WORLD", 4]]);
});

test("world charges come after loans and bills within what the civ can still pay; receipts aren't capped", () => {
  const civs = [civ(ME, { incomeCents: 3000, balanceCents: 1200 }), civ(AI, { incomeCents: 10000 })];
  const transfers = [tr(ME, AI, 500, "trade"), tr(ME, "inflation", 5000, "erosion"), tr("cycle", ME, 4000, "cycle")];
  const batch = createBatch(civs);
  for (const t of transfers) record(batch, t);
  const rows = standingRows({ ledger: ledgerWith([loan("L1")]), out: { transfers }, crisis: null, batch }, civs)
    .map((row) => [row.pid, row.line, row.gold]);
  assert.deepEqual(rows, [[ME, "BILL", 5], [ME, "DEBT", 21], [ME, "WORLD", 1], [ME, "WORLDIN", 40], [AI, "BILLIN", 5]],
    "room 27 (12 + 30 + 40 in, 5 + 50 out): the payment, then the bill, then what's left for erosion");
  const overdrawn = civs.map((c) => (c.id === ME ? { ...c, overdraftCents: 10000 } : c));
  const deep = createBatch(overdrawn);
  for (const t of transfers) record(deep, t);
  const all = standingRows({ ledger: ledgerWith([loan("L1")]), out: { transfers }, crisis: null, batch: deep },
    overdrawn).map((row) => [row.pid, row.line, row.gold]);
  assert.deepEqual(all.find(([pid, line]) => pid === ME && line === "WORLD"), [ME, "WORLD", 50],
    "with a 100 Gold overdraft the whole erosion stands");
});

test("a paying line stands at face / (1 + the Income percentage) and counts back what landed; charges at face", () => {
  assert.equal(standAmount("LOAN", 32, 0), 32);
  assert.equal(standAmount("LOAN", 32, 100), 16, "Deity in Modern: +100%");
  assert.equal(standAmount("LOAN", 32, -20), 40, "Settler outside Modern");
  assert.equal(standAmount("WORLDIN", 10, -76), 0, "an unhappy capital keeping under a quarter: a grant instead");
  assert.equal(standAmount("DEBT", 32, 100), 32, "a charge lands at its face");
  assert.equal(standAmount("PRICE", 12, 100), 12, "other kinds stand at their amount");
  const held = [{ line: "LOAN", rung: 16 }, { line: "DEBT", rung: 8 }, { line: "PRICE", rung: 4 }];
  assert.equal(chargeCents(held, 100), 3200 - 800, "16 paid at +100% is 32; the debt line 8; prices count nothing");
  assert.equal(chargeCents(held, -4.79), Math.round(16 * 95.21) - 800);
});

test("price and note markers have their own ladders and types", () => {
  assert.equal(markerType("PRICE", 8), "BUILDING_ECON_PRICE_8");
  assert.equal(markerType("REPUDIATED", 2), "BUILDING_ECON_NOTE_REPUDIATED_2");
  assert.deepEqual(parseMarkerType("BUILDING_ECON_PRICE_64"), { line: "PRICE", rung: 64 });
  assert.deepEqual(parseMarkerType("BUILDING_ECON_NOTE_REPUDIATED_4"), { line: "REPUDIATED", rung: 4 });
  assert.equal(parseMarkerType("BUILDING_ECON_PRICE_128"), null);
  assert.deepEqual(rungsOf(13, [1, 2, 4, 8, 16, 32, 64]), [8, 4, 1]);
  assert.deepEqual(rungsOf(500, [1, 2, 4, 8, 16, 32, 64]), [64, 32, 16, 8, 4, 2, 1], "capped at 127");
});

test("a price level and a repudiation note become standing rows", () => {
  const rows = standingRows({ ledger: ledgerWith([]), out: { transfers: [], notes: [{ pid: ME, line: "REPUDIATED",
    amount: 3 }] }, crisis: null, macro: { inflation: { levels: { [String(ME)]: 123456, [String(AI)]: 4000 } } } },
  [civ(ME, { incomeCents: 10000 }), civ(AI, { incomeCents: 10000 })]).map((r) => [r.pid, r.line, r.gold]);
  assert.deepEqual(rows, [[ME, "PRICE", 13], [ME, "REPUDIATED", 3]],
    "12.35% is a stack of 13 (it charges 12.78%); AI's 0.4% is nearer no stack (0) than 1 (0.90%)");
});

test("with room to spare the line carries the whole payment", () => {
  const roomy = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [civ(ME, { balanceCents: 100000,
    incomeCents: 10000 })] }));
  const [[, line, gold]] = lines(roomy);
  assert.equal(line, "DEBT");
  assert.ok(gold >= 19, "19 after the AI repays a little early");
});

test("a part of a Gold the lines moved at the roll carries, so the whole-Gold grant loses nothing", () => {
  // A +16 Loan repayments line at +115% paid 34.40 at the roll: the grant is whole Gold and the 0.40 carries.
  const first = planTurn(input({ ledger: ledgerWith([loan("L1")]),
    civs: [civ(ME, { incomeCents: 10000, engineCents: 3440 })] }));
  const row = first.batch.civs[0];
  assert.equal(Math.abs(grantOf(row) % 100), 0, "the grant is whole Gold");
  assert.equal(row.paid + row.carry, row.net, "nothing dropped: paid and carry add up to the turn's net");
});

test("price markers stand for the rise the game charges, from the lab's measured table", () => {
  // W8 (2026-11-10): 8 gave 7.44%, 31 gave 33.42%, 127 gave 144.02%.
  assert.deepEqual([0, 1, 8, 31, 64, 127].map(priceRiseBp), [0, 90, 744, 3342, 7147, 14402]);
  assert.equal(priceRiseBp(10), 955, "between two measured stacks, on the straight line");
  assert.equal(priceStandFor(3342), 31, "a 33.42% level is a stack of 31");
  assert.equal(priceStandFor(3100), 29, "31% of price rise takes a stack of 29, which charges 31.1%");
  assert.equal(priceStandFor(30), 0, "0.3% is nearer no stack than one of 1");
  for (let bp = 0; bp <= 12700; bp += 37) {
    const s = priceStandFor(bp);
    const gap = Math.max(priceRiseBp(s + 1) - priceRiseBp(s), s > 0 ? priceRiseBp(s) - priceRiseBp(s - 1) : 0);
    assert.ok(Math.abs(priceRiseBp(s) - bp) <= Math.ceil(gap / 2) + 1, `${bp}`);
  }
});

test("once a civ's stack is measured, the next stack is scaled from what that civ's prices really did", () => {
  // Lab W9 (2026-11-10): 25% of markers raised the seat's prices 24.95% and an AI's 26.5% on the same turn.
  const seat = { stack: 25, factorPpm: 1249500 };
  const ai = { stack: 25, factorPpm: 1265000 };
  assert.equal(priceStackFor(2688, seat), 27, "a 26.88% level: 27 at the seat's 0.998% a point");
  assert.equal(priceStackFor(2688, ai), 25, "and 25 at the AI's 1.06%");
  assert.equal(priceStackFor(2688, null), 25, "before a measurement, the lab's table");
  assert.equal(priceRiseFor(25, seat), 2495, "the stack that stands: what was measured");
  assert.equal(priceRiseFor(27, seat), 2695, "another stack: scaled from the measurement");
  assert.equal(priceRiseFor(8, { stack: 0, factorPpm: 1000000 }), 744, "nothing measured yet: the table");
});
