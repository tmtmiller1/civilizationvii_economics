// Development loans, general investment and aid (DESIGN 4.12; TEST-PLAN 12.1): G / 3 progress capped at what the
// build needs, the fixed 25-turn return (6% on a role building), general's growth-linked return, the relationship
// gains in turns of the host's income, misses and default by the loan rules, the lost-city write-off and repudiation.
import test from "node:test";
import assert from "node:assert/strict";
import { baseDividend, dividendDue, giftMinimumCents, growthMille, hostOwes, investId, investSeq, isInvestKind, isOpenInvestment,
  lostCityWriteOff, makeInvestment, progressFor, relationAllows, relationshipGain, repudiateInvestments, returnMille,
  settleDividend, settleInvestmentDefault, tenthsFor } from "../ui/econ-invest.js";

const project = (over = {}) => makeInvestment({ id: "I1", kind: "project", investor: 2, host: 5, principal: 30000,
  turn: 10, cityId: "5:65536", ...over });
const general = (over = {}) => makeInvestment({ id: "I2", kind: "general", investor: 2, host: 5, principal: 20000,
  turn: 10, baseIncome: 2000, ...over });

test("ids and kinds", () => {
  assert.equal(investId(7), "I7");
  assert.equal(investSeq("I7"), 7);
  assert.equal(investSeq("L7"), 0);
  assert.equal(investSeq("I0"), 0);
  assert.equal(investSeq("I07"), 0);
  assert.equal(isInvestKind("project"), true);
  assert.equal(isInvestKind("general"), true);
  assert.equal(isInvestKind("loan"), false);
});

test("G / 3 Gold a point of progress, capped at what the build needs; only what's used is spent", () => {
  assert.deepEqual(progressFor(30000, 500), { progress: 100, usedCents: 30000, refundCents: 0 });
  assert.deepEqual(progressFor(30000, 40), { progress: 40, usedCents: 12000, refundCents: 18000 });
  assert.deepEqual(progressFor(1000, 500), { progress: 3, usedCents: 900, refundCents: 100 });
  assert.deepEqual(progressFor(200, 500), { progress: 0, usedCents: 0, refundCents: 200 });
  assert.deepEqual(progressFor(30000, 0), { progress: 0, usedCents: 0, refundCents: 30000 });
  assert.deepEqual(progressFor(-5, 10), { progress: 0, usedCents: 0, refundCents: 0 });
  assert.deepEqual(progressFor(3000, 4.7), { progress: 4, usedCents: 1200, refundCents: 1800 });
  assert.deepEqual(progressFor(1000, 500, 347), { progress: 2, usedCents: 694, refundCents: 306 },
    "at the build's own 3.47 a point");
  assert.deepEqual(progressFor(3000, Number.NaN), { progress: 0, usedCents: 0, refundCents: 3000 });
});

test("returns: 5% a turn for a development loan, 6% on a role building, 4.5% for general", () => {
  assert.equal(returnMille("project"), 50);
  assert.equal(returnMille("project", true), 60);
  assert.equal(returnMille("general"), 45);
  assert.equal(returnMille("general", true), 45);
  assert.equal(baseDividend(30000, 50), 1500);
  assert.equal(baseDividend(30001, 50), 1501, "rounded up");
  const record = project();
  assert.deepEqual([record.mille, record.term, record.outstanding, record.cityId, record.baseIncome],
    [50, 25, 37500, "5:65536", 0], "25 turns at 1500: 125% of G");
  assert.equal(project({ roleBuilding: true }).outstanding, 45000, "150% on a role building");
  const g = general();
  assert.deepEqual([g.mille, g.cityId, g.baseIncome, g.state, g.paid], [45, null, 2000, "active", 0]);
  assert.equal(makeInvestment({ id: "I3", kind: "project", investor: 1, host: 2, principal: 300, turn: 1,
    baseIncome: 999 }).baseIncome, 0, "only general keeps the host's income");
  assert.equal(general({ cityId: "x" }).cityId, null);
});

test("growth = income now / income then, clamped 0.5 to 2.0; the base counts from 10 Gold", () => {
  assert.equal(growthMille(2000, 2000), 1000);
  assert.equal(growthMille(3000, 2000), 1500);
  assert.equal(growthMille(9000, 2000), 2000);
  assert.equal(growthMille(500, 2000), 500);
  assert.equal(growthMille(0, 2000), 500, "no income now: the floor");
  assert.equal(growthMille(-100, 2000), 500);
  assert.equal(growthMille(1500, 300), 1500, "invested at 3 Gold: counted from 10");
  assert.equal(growthMille(2999, 2000), 1499);
});

test("this turn's dividend: fixed for a development loan, moving with the host for general", () => {
  assert.equal(dividendDue(project(), 0), 1500);
  assert.equal(dividendDue(project(), 99999), 1500);
  assert.equal(dividendDue(general(), 2000), 900);
  assert.equal(dividendDue(general(), 4000), 1800);
  assert.equal(dividendDue(general(), 100), 450);
  assert.equal(dividendDue(general({ principal: 20001 }), 2000), 901, "rounded up");
});

test("relationship: +1 per 1, 1.5 and 0.5 turns of the host's income, at least 10 Gold a turn, at most 20", () => {
  assert.equal(tenthsFor("project", false), 10);
  assert.equal(tenthsFor("general", false), 15);
  assert.equal(tenthsFor("general", true), 5);
  assert.equal(tenthsFor("project", true), 5);
  assert.equal(relationshipGain(2000, 2000, 10), 1);
  assert.equal(relationshipGain(1999, 2000, 10), 0);
  assert.equal(relationshipGain(30000, 2000, 15), 10);
  assert.equal(relationshipGain(30000, 15000, 5), 4, "300 Gold of aid to a 150 Gold host");
  assert.equal(relationshipGain(5000, 100, 5), 10, "a poor host counts as 10 Gold a turn");
  assert.equal(relationshipGain(1e7, 2000, 5), 20, "capped");
  assert.equal(relationshipGain(-5, 2000, 5), 0);
  assert.equal(giftMinimumCents(2000, 10), 2000, "the first whole Gold that buys a point");
  assert.equal(giftMinimumCents(15000, 5), 7500);
  assert.equal(giftMinimumCents(5310, 5), 2700, "26.55 rounds up to 27 Gold");
  assert.equal(giftMinimumCents(100, 5), 500, "the 10 Gold floor");
  assert.equal(relationshipGain(giftMinimumCents(15000, 5) - 100, 15000, 5), 0);
  assert.equal(relationshipGain(giftMinimumCents(15000, 5), 15000, 5), 1);
});

test("a dividend paid in full or missed; three misses in a row is default; the term ends the record", () => {
  const paid = settleDividend(project(), { funds: 1500, hostIncomeCents: 0 });
  assert.deepEqual([paid.cents, paid.missed, paid.record.paid, paid.record.outstanding, paid.record.state],
    [1500, false, 1, 36000, "active"]);
  const miss = settleDividend(project(), { funds: 1499, hostIncomeCents: 0 });
  assert.deepEqual([miss.cents, miss.missed, miss.defaulted, miss.record.missed, miss.record.paid], [0, true, false, 1, 0]);
  const third = settleDividend(project({ }), { funds: 0, hostIncomeCents: 0 });
  const twice = settleDividend(third.record, { funds: 0, hostIncomeCents: 0 });
  const thrice = settleDividend(twice.record, { funds: 0, hostIncomeCents: 0 });
  assert.equal(twice.defaulted, false);
  assert.deepEqual([thrice.defaulted, thrice.record.state, thrice.record.missed], [true, "default", 3]);
  const recovered = settleDividend(twice.record, { funds: 5000, hostIncomeCents: 0 });
  assert.equal(recovered.record.missed, 0, "a paid turn resets the count");
  const last = settleDividend({ ...project(), paid: 24, outstanding: 1500 }, { funds: 9999, hostIncomeCents: 0 });
  assert.deepEqual([last.closed, last.record.state, last.record.outstanding, last.record.paid], [true, "closed", 0, 25]);
  const growing = settleDividend(general(), { funds: 99999, hostIncomeCents: 4000 });
  assert.deepEqual([growing.cents, growing.record.outstanding], [1800, 22500 - 900],
    "what's left to come falls by the base dividend whatever the growth");
  const thin = settleDividend({ ...general(), outstanding: 100 }, { funds: 99999, hostIncomeCents: 2000 });
  assert.equal(thin.record.outstanding, 0, "never below 0");
});

test("a defaulted record is garnished by the loan rule until nothing is left", () => {
  const record = { ...project(), state: "default", outstanding: 10000 };
  const rich = settleInvestmentDefault(record, { incomeCents: 5000, balanceCents: 0, cashCents: 99999 });
  assert.deepEqual([rich.cents, rich.record.outstanding, rich.closed], [1000, 9000, false]);
  const poor = settleInvestmentDefault(record, { incomeCents: -100, balanceCents: 3000, cashCents: 99999 });
  assert.equal(poor.cents, 300, "income at or below 0: min(5% of O, 10% of the balance)");
  const part = settleInvestmentDefault({ ...record, outstanding: 450 }, { incomeCents: 5000, balanceCents: 0,
    cashCents: 99999 });
  assert.deepEqual([part.cents, part.closed, part.record.state], [100, false, "default"],
    "the floor of 1 Gold where 10% of what's left would be 45 cents");
  const done = settleInvestmentDefault({ ...record, outstanding: 1 }, { incomeCents: 5000, balanceCents: 0,
    cashCents: 99999 });
  assert.deepEqual([done.cents, done.closed, done.record.state], [1, true, "closed"]);
});

test("open records, the lost city, repudiation and what a host owes", () => {
  assert.equal(isOpenInvestment(project()), true);
  assert.equal(isOpenInvestment({ ...project(), state: "default" }), true);
  assert.equal(isOpenInvestment({ ...project(), state: "closed" }), false);
  const cities = new Set(["5:65536"]);
  assert.equal(lostCityWriteOff(project(), cities, 20), null);
  const lost = lostCityWriteOff(project(), new Set(), 20);
  assert.deepEqual([lost.state, lost.closedTurn, lost.writtenOff, lost.outstanding], ["closed", 20, 37500, 0]);
  assert.equal(lostCityWriteOff(general(), new Set(), 20), null, "general stays with the civ");
  assert.equal(lostCityWriteOff({ ...project(), state: "closed" }, new Set(), 20), null);
  assert.equal(lostCityWriteOff({ ...project(), cityId: null }, new Set(), 20), null);
  const records = [project(), general(), project({ id: "I3", investor: 7 }), { ...general({ id: "I4" }), state: "closed" }];
  const result = repudiateInvestments(records, { host: 5, investor: 2, turn: 30 });
  assert.deepEqual(result.ids, ["I1", "I2"]);
  assert.equal(result.writtenOff, 37500 + 22500);
  assert.deepEqual(result.records.map((r) => r.state), ["repudiated", "repudiated", "active", "closed"]);
  assert.equal(result.records[0].closedTurn, 30);
  assert.equal(hostOwes(records, 5), 37500 + 22500 + 37500);
  assert.equal(hostOwes(result.records, 5), 37500);
  assert.equal(hostOwes(records, 2), 0);
});

test("relationship gates: not at war, Neutral or better; aid needs only peace", () => {
  assert.equal(relationAllows("war", true), false);
  assert.equal(relationAllows("war", false), false);
  assert.equal(relationAllows("unfriendly", false), false);
  assert.equal(relationAllows("unfriendly", true), true);
  assert.equal(relationAllows("neutral", false), true);
  assert.equal(relationAllows("friendly", false), true);
});
