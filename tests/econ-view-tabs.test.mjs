// Which tabs and sections of the Economics screen a player sees as the stages open, the "Opens next" part of each
// tab, the remembered tab's fallback, and the notification lines for what opened (econ-view-tabs.js).
import test from "node:test";
import assert from "node:assert/strict";
import { civ, input } from "./_fixtures.mjs";
import { emptyLedger } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { newlyOpened, openParts, startTab, tabFacts, tabRules } from "../ui/econ-view-tabs.js";

const ME = 2;
const NONE = { moneylending: null, publicDebt: null, trade: null, guildPatronage: null, charteredCompanies: null,
  tariffs: null, banking: null, capitalism: null };

/** An Antiquity input at turn 20 with the given stage turns for the player. */
function antiquity(stages = {}, over = {}) {
  return input({ turn: 20, age: "AGE_ANTIQUITY", civs: [civ(ME, { human: true, stages: { ...NONE, ...stages } }),
    civ(6)], ledger: emptyLedger(), ...over, options: { cycle: "standard", ...(over.options || {}) } });
}

const rulesOf = (planInput, stageTurns = {}, extra = {}) => {
  const facts = tabFacts(planInput, ME, stageTurns, extra);
  return { facts, rules: tabRules(facts) };
};

test("an Antiquity start shows Treasury and Fiscal only, with the guard on Treasury and the Trade tabs next", () => {
  const { rules } = rulesOf(antiquity());
  assert.deepEqual(rules.tabs, ["treasury", "fiscal"]);
  assert.equal(rules.sections["treasury.loans"], true, "the guard switch lives on Treasury until Loans opens");
  assert.equal(rules.sections["treasury.cycle"], true, "cycle Gold shows on Treasury until World opens");
  assert.equal(rules.sections["treasury.depth"], false);
  assert.equal(rules.sections["treasury.old"], false, "no old buildings in the first age");
  assert.equal(rules.sections["fiscal.tariff"], false);
  assert.deepEqual(rules.next.treasury, { stage: "trade", part: "LOC_ECONOMICS_PART_TAB_TRADE" });
  assert.deepEqual(rules.next.loans, { stage: "moneylending", part: "LOC_ECONOMICS_PART_CIV_LOANS" });
});

test("Coinage opens Markets and World together; Trade stays closed and is the Markets tab's next part", () => {
  const { rules } = rulesOf(antiquity(), { coinage: 12 });
  assert.deepEqual(rules.tabs, ["treasury", "fiscal", "markets", "world"]);
  assert.equal(rules.sections["treasury.cycle"], false, "the World tab carries the cycle now");
  assert.equal(rules.sections["treasury.depth"], true);
  assert.deepEqual(rules.next.markets, { stage: "trade", part: "LOC_ECONOMICS_PART_TRADE_BILLS" });
  assert.deepEqual(rules.next.treasury, { stage: "trade", part: "LOC_ECONOMICS_PART_TAB_TRADE_ONLY" });
});

test("Trade opens Markets and Trade; World waits for Coinage", () => {
  const { rules } = rulesOf(antiquity({ trade: 10 }));
  assert.deepEqual(rules.tabs, ["treasury", "fiscal", "markets", "trade"]);
  assert.equal(rules.next.markets, null, "nothing left to open on Markets");
  assert.deepEqual(rules.next.treasury, { stage: "coinage", part: "LOC_ECONOMICS_PART_TAB_WORLD" });
  assert.equal(rules.sections["trade.project"], false, "development loans wait for Guild patronage");
  assert.equal(rules.sections["trade.general"], false);
  assert.deepEqual(rules.next.trade, { stage: "guildPatronage", part: "LOC_ECONOMICS_PART_DEV_LOANS" });
});

test("a stage turn after this turn hasn't been reached; coinage reads from the glue's stage turns", () => {
  assert.deepEqual(rulesOf(antiquity({ trade: 21 })).rules.tabs, ["treasury", "fiscal"]);
  assert.deepEqual(rulesOf(antiquity(), { coinage: 25 }).rules.tabs, ["treasury", "fiscal"]);
});

test("the Loans tab opens at Moneylending, or earlier for an open loan or a citizens' offer", () => {
  assert.ok(rulesOf(antiquity({ moneylending: 15 })).rules.tabs.includes("loans"));
  const loan = makeLoan({ id: "L1", lender: "temple", borrower: ME, principal: 3000, ratePpm: 30000, term: 10, turn: 18 });
  const owing = rulesOf(antiquity({}, { ledger: { ...emptyLedger(), loans: [loan] } })).rules;
  assert.ok(owing.tabs.includes("loans"), "an emergency loan from the temple treasuries");
  assert.equal(owing.sections["treasury.loans"], false, "and the guard moves to the Loans tab");
  assert.equal(owing.sections["loans.borrow"], false, "no borrow form before Moneylending");
  const citizens = rulesOf(antiquity(), {}, { citizenOffer: true }).rules;
  assert.ok(citizens.tabs.includes("loans"));
  assert.equal(citizens.sections["loans.borrow"], true, "the citizens' offer is in the borrow form");
});

test("with the Economic stages option Off every tab and section is there from the start", () => {
  const { rules } = rulesOf(antiquity({}, { options: { stages: false } }));
  assert.deepEqual(rules.tabs, ["treasury", "loans", "fiscal", "markets", "trade", "world"]);
  assert.equal(rules.sections["fiscal.tariff"], true);
  assert.equal(rules.sections["trade.general"], true);
  for (const key of rules.tabs) assert.equal(rules.next[key], null, key);
});

test("options that turn a part off leave it out of the tabs and the next lines", () => {
  const { rules } = rulesOf(antiquity({}, { options: { tariffs: false, investment: false, inflation: true } }));
  assert.equal(rules.next.fiscal, null);
  assert.equal(rules.next.trade, null);
  assert.deepEqual(rules.next.world, { stage: "publicDebt", part: "LOC_ECONOMICS_PART_INFLATION" });
  assert.equal(rules.sections["world.inflation"], false, "inflation waits for Public debt when it's on");
});

test("the remembered tab falls back to Treasury when it isn't shown; an old index still reads", () => {
  const { rules } = rulesOf(antiquity());
  assert.equal(startTab(rules, "world"), "treasury");
  assert.equal(startTab(rules, "fiscal"), "fiscal");
  assert.equal(startTab(rules, 2), "fiscal", "index 2 was Fiscal");
  assert.equal(startTab(rules, 5), "treasury", "index 5 was World, not open");
  assert.equal(startTab(rules, undefined), "treasury");
});

test("what opened since last told: one line per tab, Markets folded with World or Trade, sections with their tab", () => {
  const start = rulesOf(antiquity());
  const told = openParts(start.rules, start.facts);
  assert.deepEqual(told, []);
  const coin = rulesOf(antiquity(), { coinage: 20 });
  const opened = newlyOpened(told, openParts(coin.rules, coin.facts), coin.facts);
  assert.deepEqual(opened.keys, ["LOC_ECONOMICS_OPENED_MARKETS_WORLD"]);
  assert.deepEqual(opened.tabs.sort(), ["markets", "world"]);
  const trade = rulesOf(antiquity({ trade: 20 }), { coinage: 18 });
  const later = newlyOpened(opened.told, openParts(trade.rules, trade.facts), trade.facts);
  assert.deepEqual(later.keys, ["LOC_ECONOMICS_OPENED_TRADE"]);
  assert.deepEqual(newlyOpened(later.told, openParts(trade.rules, trade.facts), trade.facts).keys, [],
    "nothing twice");
  const both = rulesOf(antiquity({ trade: 20 }), { coinage: 20 });
  assert.deepEqual(newlyOpened([], openParts(both.rules, both.facts), both.facts).keys,
    ["LOC_ECONOMICS_OPENED_MARKETS_TRADE", "LOC_ECONOMICS_OPENED_WORLD"]);
});

test("the Loans tab's line says whether other civilizations lend now", () => {
  const lending = rulesOf(antiquity({ moneylending: 20 }));
  const opened = newlyOpened([], openParts(lending.rules, lending.facts), lending.facts);
  assert.deepEqual(opened.keys, ["LOC_ECONOMICS_OPENED_LOANS_LENDERS"], "the civ-loans section folds into the tab line");
  const loan = makeLoan({ id: "L1", lender: "temple", borrower: ME, principal: 3000, ratePpm: 30000, term: 10, turn: 18 });
  const early = rulesOf(antiquity({}, { ledger: { ...emptyLedger(), loans: [loan] } }));
  const first = newlyOpened([], openParts(early.rules, early.facts), early.facts);
  assert.deepEqual(first.keys, ["LOC_ECONOMICS_OPENED_LOANS"]);
  const then = rulesOf(antiquity({ moneylending: 25 }, { turn: 25, ledger: { ...emptyLedger(), loans: [loan] } }));
  assert.deepEqual(newlyOpened(first.told, openParts(then.rules, then.facts), then.facts).keys,
    ["LOC_ECONOMICS_OPENED_CIV_LOANS"]);
});

test("the Treasury tab's loan figures wait for the rule that opens the Loans tab; aid sits there until Trade", () => {
  const start = rulesOf(antiquity()).rules;
  assert.equal(start.sections["treasury.loanFigures"], false, "turn 1 in Antiquity: no loans yet");
  assert.equal(start.sections["treasury.aid"], true, "aid needs no stage");
  assert.equal(rulesOf(antiquity({ moneylending: 15 })).rules.sections["treasury.loanFigures"], true);
  assert.equal(rulesOf(antiquity(), {}, { citizenOffer: true }).rules.sections["treasury.loanFigures"], true);
  const loan = makeLoan({ id: "L1", lender: "temple", borrower: ME, principal: 3000, ratePpm: 30000, term: 10, turn: 18 });
  assert.equal(rulesOf(antiquity({}, { ledger: { ...emptyLedger(), loans: [loan] } })).rules
    .sections["treasury.loanFigures"], true, "an emergency loan");
  assert.equal(rulesOf(antiquity({ trade: 10 })).rules.sections["treasury.aid"], false, "Trade carries aid now");
  assert.equal(rulesOf(antiquity({}, { options: { investment: false } })).rules.sections["treasury.aid"], false,
    "aid is part of Foreign investment");
  const off = rulesOf(antiquity({}, { options: { stages: false } })).rules;
  assert.equal(off.sections["treasury.loanFigures"], true, "stages Off: everything open");
  assert.equal(off.sections["treasury.aid"], false, "and aid lives on the Trade tab");
});
