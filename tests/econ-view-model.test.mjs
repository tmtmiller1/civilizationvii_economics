import test from "node:test";
import assert from "node:assert/strict";
import { borrowerRisk, loanOffers, loansView, repudiationPreview, restructurePreview, servicePct,
  termsOpen, treasuryView } from "../ui/econ-view-model.js";
import { civ, input } from "./_fixtures.mjs";
import { emptyLedger } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";

const ME = 2;
const me = (over = {}) => civ(ME, { human: true, balanceCents: 20000, incomeCents: 4000, ...over });
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 40000,
  term: 10, turn: 40 }), ...over });
const ledgerWith = (loans, over = {}) => ({ ...emptyLedger(), loans, nextId: loans.length + 1, ...over });

test("the Treasury tab: due next turn, the service share, and a 20-turn projection with and without the loans", () => {
  const view = treasuryView(input({ civs: [me()], ledger: ledgerWith([loan("L1")]) }), ME);
  assert.equal(view.dueNextCents, 1200 + 3000, "interest on 300 at 4% plus the 30 slice");
  assert.equal(view.servicePct, 105);
  assert.equal(view.projection.without.length, 20);
  assert.equal(view.projection.without[19], 20000 + 20 * 4000);
  assert.ok(view.projection.withLoans[19] < view.projection.without[19], "the loan's payments show");
  assert.equal(servicePct(100, 0), 100);
  assert.equal(servicePct(0, 0), 0);
  assert.equal(treasuryView(input({ civs: [] }), 99).balanceCents, 0, "an unknown civ reads empty");
});

test("loan offers carry the payment, the total interest and the model's refusal; terms follow the stage", () => {
  const lender = civ(6, { balanceCents: 1e6, incomeCents: 3000 });
  const offers = loanOffers(input({ civs: [me(), lender] }), ME, 10000, 10);
  assert.deepEqual(offers.map((o) => [o.lender, o.refusal]), [[6, null], ["bond", null]]);
  assert.equal(offers[0].paymentCents, 100 + 1000, "1% on 100 Gold in Exploration plus the first slice");
  assert.ok(offers[0].interestCents > 0);
  assert.equal(offers[0].servicePctAfter, Math.round((100 * 1100) / me().incomeCents), "the share of income with it");
  const tooBig = loanOffers(input({ civs: [me(), lender] }), ME, 2000000, 10);
  assert.equal(tooBig.find((o) => o.lender === "bond")?.refusal, "credit-cap");
  assert.equal(tooBig.find((o) => o.lender === "bond")?.mostCents, 16600, "the most whose first payment fits 20 Gold");
  assert.equal(offers[0].mostCents, null, "nothing to suggest when it fits");
  assert.deepEqual(termsOpen(input({ civs: [me()] }), ME), [10, 20, 30]);
  assert.deepEqual(termsOpen(input({ civs: [me({ stages: { moneylending: 0, publicDebt: null } })] }), ME), [10, 20],
    "Moneylending opens 20 turns");
  assert.deepEqual(termsOpen(input({ civs: [me({ stages: { moneylending: null, publicDebt: null } })] }), ME), [10]);
  assert.deepEqual(loanOffers(input({ civs: [] }), 99, 1000, 10), []);
});

test("the Loans tab puts troubled loans first and reads the limits, standing, guard allowance and stages", () => {
  const ledger = ledgerWith([loan("L1"), loan("L2", { missed: 2 }), loan("L3", { state: "default" }),
    loan("L4", { lender: ME, borrower: 6 })], { creditRep: [{ pid: ME, rep: 8000, turn: 50 }] });
  const view = loansView(input({ civs: [me(), civ(6)], ledger }), ME);
  assert.deepEqual(view.mine.map((row) => row.id), ["L2", "L3", "L1"]);
  assert.equal(view.mine[0].overdue, true);
  assert.deepEqual(view.lent.map((row) => row.id), ["L4"]);
  assert.equal(view.standingPct, 80, "the reputation after a default");
  assert.equal(view.emergencyCapCents, 40000);
  assert.deepEqual(view.stages, { moneylending: true, publicDebt: true });
  assert.equal(view.serviceCapCents, 2000, "half of income");
});

test("the repudiation preview says what DESIGN 5 asks: Gold kept, grudge, witnesses, standing, how long the lender closes", () => {
  const ledger = ledgerWith([loan("L1", { lender: 6, outstanding: 20000 }), loan("L2", { lender: 6, outstanding: 5000 })]);
  const civs = [me(), civ(6, { incomeCents: 1000 }), civ(8), civ(9)];
  const relations = [{ a: ME, b: 6, level: "neutral" }, { a: ME, b: 8, level: "friendly" }];
  const p = repudiationPreview(input({ civs, ledger, relations }), ME, 6);
  assert.deepEqual([p.keptCents, p.loans, p.grudge, p.witnesses, p.witnessDelta], [25000, 2, 40, [8], -3],
    "25 turns of the lender's income: the grudge caps at 40; civ 9 hasn't met the player");
  assert.deepEqual([p.standingNow, p.standingAfter, p.closedTurns, p.closedAges, p.creditTurnsLost], [100, 70, null, 1, 4]);
  const bond = repudiationPreview(input({ civs, ledger: ledgerWith([loan("L1")]), relations }), ME, "bond");
  assert.deepEqual([bond.grudge, bond.witnessDelta, bond.closedTurns], [0, -6, 30]);
  const war = repudiationPreview(input({ civs, ledger, relations: [{ a: ME, b: 6, level: "war" }] }), ME, 6);
  assert.deepEqual([war.atWar, war.witnessDelta, war.standingAfter], [true, -2, 85]);
});

test("the restructure preview shows the new 10-turn schedule and whether the loan may take it", () => {
  const ledger = ledgerWith([loan("L1", { missed: 1, outstanding: 20000 }), loan("L2", { restructured: true }),
    loan("L3")]);
  const p = restructurePreview(ledger, "L1");
  assert.deepEqual([p.outstanding, p.term, p.allowed], [20000, 10, true]);
  assert.equal(p.paymentCents, 800 + 2000);
  assert.equal(restructurePreview(ledger, "L2").allowed, false, "once per loan");
  assert.equal(restructurePreview(ledger, "L3").allowed, true, "from no misses on (AI-PLAN 4.3)");
  assert.equal(restructurePreview(ledger, "L9"), null);
});

test("borrower risk reads the AI rule's conditions", () => {
  const ledger = ledgerWith([loan("L1", { lender: ME, borrower: 6, outstanding: 9000 })], { lowIncome: [{ pid: 6, turns: 5 }] });
  const risk = borrowerRisk(input({ civs: [me(), civ(6, { incomeCents: 0 })], ledger,
    relations: [{ a: ME, b: 6, level: "unfriendly" }] }), ME, 6);
  assert.deepEqual([risk.level, risk.insolvent, risk.thresholdCents, risk.owedCents, risk.wouldLendByRule],
    ["unfriendly", true, 4000, 9000, false], "4 turns of income, 10 Gold at the least");
});

test("the Loans tab's reserve reading (AI-PLAN 4.3): the AI's yardstick, what the player holds above it, the look-ahead", () => {
  const civs = [civ(ME, { human: true, balanceCents: 50000, incomeCents: 3000, upkeepCents: 1000 })];
  const view = loansView(input({ ledger: ledgerWith([loan("L1")]), civs }), ME);
  assert.equal(view.reserveCents, 30000, "10 turns of income beats three turns' dues (about 62) plus upkeep");
  assert.equal(view.aboveReserveCents, 50000 + 3000 - 30000, "funds this turn less the reserve");
  assert.equal(view.ahead.length, 4, "this turn and the next three");
  assert.ok(view.ahead.every((row) => row.gap === 0));
});
