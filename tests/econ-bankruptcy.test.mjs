// A way out of a treasury below zero (DESIGN 4.18): the overdraft's interest never takes more than half a civ's
// income while it's above 0, and a civ can declare bankruptcy: the bond market writes its treasury back to 0, every
// loan it has is repudiated, and the penalties for being below zero stop. An AI weighs what staying below zero would
// cost it against what bankruptcy would.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { interestCapCents } from "../ui/econ-overdraft.js";
import { bankruptcyWeighing, lastBankruptcy } from "../ui/econ-bankruptcy.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { flowKeys } from "../ui/econ-notice-text.js";
import { BANKRUPTCY, OVERDRAWN } from "../ui/econ-params.js";
import { civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const real = (id, over = {}) => civ(id, { overdraftCents: undefined, ...over });
const bondLoan = (id, borrower) => makeLoan({ id, lender: "bond", borrower, principal: 30000, ratePpm: 20000, term: 20,
  turn: 40 });
const ledgerWith = (over = {}) => ({ ...emptyLedger(), ...over });
const relations = [{ a: ME, b: AI, level: "neutral" }];

test("the interest is capped at half the income while the income is above 0, and not capped otherwise", () => {
  assert.equal(interestCapCents(19000), 9500);
  assert.equal(interestCapCents(0), Infinity);
  assert.equal(interestCapCents(-500), Infinity);
  // Lab W15: about -6,000 with +190 a turn paid more interest than it earned and sank further every turn.
  const plan = planTurn(input({ civs: [real(ME, { human: true, balanceCents: -600000, incomeCents: 19000 })],
    options: { guard: false } }));
  const od = plan.transfers.find((t) => t.reason === "overdraft");
  assert.equal(od.cents, 9500);
  assert.equal(od.parts.capped, 1);
  const losing = planTurn(input({ civs: [real(ME, { human: true, balanceCents: -600000, incomeCents: -1000 })],
    options: { guard: false } })).transfers.find((t) => t.reason === "overdraft");
  assert.ok(losing.cents > 9500, "no income to cap it by");
  assert.equal(losing.parts.capped, 0);
});

test("bankruptcy: the treasury back to 0 from the bond market, every loan repudiated, no interest, no penalties", () => {
  const civs = [real(ME, { human: true, balanceCents: -20000, incomeCents: 1000 }), real(AI)];
  const plan = planTurn(input({ civs, relations, ledger: ledgerWith({ loans: [bondLoan("L1", ME)], nextId: 2 }),
    requests: [{ kind: "bankrupt", pid: ME }], options: { guard: false } }));
  const out = plan.transfers.find((t) => t.reason === "bankruptcy");
  assert.deepEqual([out.from, out.to, out.cents], ["bond", ME, 20000]);
  assert.equal(plan.transfers.some((t) => t.reason === "overdraft"), false);
  assert.equal(plan.ledger.loans[0].state, "repudiated");
  assert.equal(plan.overdrawn[String(ME)], undefined, "the penalties stop this turn");
  const rows = plan.ledger.repudiations.filter((r) => r.pid === ME);
  assert.equal(rows.length, 1, "the bond loan's repudiation carries the write-off");
  assert.deepEqual([rows[0].bankrupt, rows[0].cents], [1, plan.ledger.loans[0].writtenOff + 20000]);
  assert.equal(lastBankruptcy(plan.ledger, ME), 50);
  assert.ok(plan.events.some((e) => e.kind === "bankruptcy" && e.pid === ME && e.loans === 1));
  assert.ok(plan.notices.some((n) => n.pid === ME && n.kind === "bankrupt"));
  // Lab W18: the turn's line read "moved by +1968 Gold this turn, from trade bills and the business cycle".
  assert.ok(flowKeys(plan.transfers, ME).includes("LOC_ECONOMICS_FLOW_BANKRUPTCY"));
  assert.deepEqual(checkPlan({ plan, civs }), []);
});

test("bankruptcy with no loans is booked against the bond market: reputation, the note and a bond block", () => {
  const civs = [real(ME, { human: true, balanceCents: -20000, incomeCents: 1000 }), real(AI)];
  const plan = planTurn(input({ civs, relations, requests: [{ kind: "bankrupt", pid: ME }],
    options: { guard: false } }));
  const row = plan.ledger.repudiations.find((r) => r.pid === ME);
  assert.deepEqual([row.lender, row.cents, row.bankrupt], ["bond", 20000, 1]);
  assert.ok(plan.ledger.blocks.some((b) => b.lender === "bond" && b.borrower === ME));
  assert.ok(plan.events.some((e) => e.kind === "credit-rep" && e.why === "bankruptcy"));
  assert.ok((plan.standing || []).some((r) => r.pid === ME && r.line === "REPUDIATED"));
  assert.deepEqual(checkPlan({ plan, civs }), []);
});

test("bankruptcy is refused above zero and within 30 turns of the last one", () => {
  const refused = (balanceCents, ledger = emptyLedger()) => planTurn(input({ ledger, options: { guard: false },
    civs: [real(ME, { human: true, balanceCents, incomeCents: 1000 })], requests: [{ kind: "bankrupt", pid: ME }] }))
    .events.find((e) => e.kind === "refused")?.reason;
  assert.equal(refused(500), "not-overdrawn");
  const before = ledgerWith({ repudiations: [{ pid: ME, lender: "bond", turn: 50 - BANKRUPTCY.everyTurns + 1,
    cents: 100, atWar: false, bankrupt: 1 }] });
  assert.equal(refused(-20000, before), "bankrupt-recently");
  const old = ledgerWith({ repudiations: [{ pid: ME, lender: "bond", turn: 50 - BANKRUPTCY.everyTurns, cents: 100,
    atWar: false, bankrupt: 1 }] });
  assert.equal(refused(-20000, old), undefined);
});

// The Ottomans of W15/W16: +190 a turn, 6 settlements, 15 units with upkeep, 5 civs met, no loans.
const ottomans = (debtCents, turns, over = {}) => bankruptcyWeighing({ debtCents, turns, incomeCents: 19000,
  interestCents: Math.min(Math.ceil(debtCents * 0.04), 9500), gloom: debtCents > 190000 ? 15 : 6,
  premiumBp: debtCents > 190000 ? 3000 : 1500, settlements: 6, production: 150, units: 15, lenders: [], witnesses: 5,
  noteEach: 6, loansOpen: false, ...over });

test("the AI weighs staying below zero against bankruptcy, looking ahead to the units and buildings it'd lose", () => {
  // The first weighing comes after the warnings; it counts the whole payoff ahead, so it declares then or not at all.
  const first = OVERDRAWN.warnTurns + 1;
  assert.equal(ottomans(19000 * 30, first).declare, true, "30 turns of income under: bankrupt");
  assert.equal(ottomans(19000 * 9, first).declare, true, "9 turns: bankrupt");
  assert.equal(ottomans(19000 * 5, first).declare, false, "5 turns: it pays it off, losing units and a settlement");
  assert.equal(ottomans(19000 * 3, first).declare, false);
  const nothing = ottomans(100000, first, { incomeCents: -1000, interestCents: 400 });
  assert.equal(nothing.turnsOut, Infinity);
  assert.equal(nothing.declare, true, "no income to pay it down with");
  const fallen = ottomans(19000 * 5, OVERDRAWN.shutFrom, { incomeCents: 6000, interestCents: 3000 });
  assert.equal(fallen.declare, true, "the same debt once its income has fallen: it changes its mind");
  const friend = ottomans(19000 * 9, first, { loansOpen: true,
    lenders: [{ grudge: 40, level: "friendly", stronger: true }] });
  assert.ok(friend.bankruptCents > ottomans(19000 * 9, first).bankruptCents * 2);
  assert.equal(friend.declare, false, "a strong friend's loan holds it back");
  const enemy = ottomans(19000 * 9, first, { loansOpen: true, lenders: [{ grudge: 40, level: "war", stronger: false }] });
  assert.ok(enemy.bankruptCents < friend.bankruptCents, "repudiating an enemy at war costs little");
  const fewUnits = ottomans(19000 * 5, first, { units: 1 });
  assert.ok(fewUnits.stayCents < ottomans(19000 * 5, first).stayCents, "it can only lose the units it has");
});

test("an AI deep below zero declares in the plan, and the seat hears of it", () => {
  const ledger = ledgerWith({ lastBatch: { id: "B1", turn: 49, civs: [{ pid: AI, snapshot: -600000, net: 0,
    influence: 0, celebration: 0, below: OVERDRAWN.warnTurns }] } });
  const civs = [real(ME, { human: true }), real(AI, { balanceCents: -600000, incomeCents: 19000, settlements: 6,
    production: 150, units: 15 })];
  const plan = planTurn(input({ civs, relations, ledger, options: { guard: false } }));
  const weighed = plan.events.find((e) => e.kind === "bankruptcy-weighed" && e.pid === AI);
  assert.ok(weighed && weighed.stay > weighed.bankrupt, JSON.stringify(weighed));
  assert.ok(plan.events.some((e) => e.kind === "bankruptcy" && e.pid === AI));
  assert.ok(plan.transfers.some((t) => t.reason === "bankruptcy" && t.to === AI && t.cents === 600000));
  assert.ok(plan.notices.some((n) => n.pid === ME && n.kind === "bankrupt-other" && n.cents === 600000),
    "the seat hears of it");
  assert.deepEqual(checkPlan({ plan, civs }), []);
  const shallow = planTurn(input({ civs: [real(ME, { human: true }), real(AI, { balanceCents: -20000,
    incomeCents: 19000, settlements: 6, production: 150, units: 15 })], relations, options: { guard: false } }));
  assert.equal(shallow.events.some((e) => e.kind === "bankruptcy"), false, "200 deep: it pays it down");
  const warned = planTurn(input({ civs, relations, options: { guard: false } }));
  assert.equal(warned.events.some((e) => e.kind === "bankruptcy"), false, "its first turn below zero is a warning");
});
