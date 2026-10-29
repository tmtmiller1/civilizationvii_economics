// _balance.mjs - the 1.0 rows of DESIGN 10's balance ladder, run in the Node simulation. A seeded 12-civ, 500-turn
// game with three ages, exogenous incomes that grow, dip in wars and sometimes run negative, stage turns per civ,
// and a human who borrows now and then and lends to short AIs at the base rate. Each game is run twice from the
// same seed: with the mod (On) and with Loans Off, so the mod's own effect can be read. Nothing here is a tuned
// number; the constants are DESIGN's starting points.

import { planTurn } from "../ui/econ-plan.js";
import { applyGrants, grantsFor } from "../ui/econ-conservation.js";
import { load, save, utf8Bytes } from "../ui/econ-state.js";
import { batchStatus } from "../ui/econ-batch.js";
import { emergencyCap } from "../ui/econ-guard.js";
import { emergencyOutstandingOf } from "../ui/econ-credit.js";
import { civRatePpm } from "../ui/econ-lenders.js";
import { totalInterest } from "../ui/econ-loan.js";
import { BASE_RATE_PPM } from "../ui/econ-params.js";
import { gen } from "./_prng.mjs";
import { PARAMS } from "./_fixtures.mjs";

export const TURNS = 500;
export const AGES = [[1, "AGE_ANTIQUITY"], [151, "AGE_EXPLORATION"], [331, "AGE_MODERN"]];
const LEVELS = ["friendly", "neutral", "neutral", "neutral", "unfriendly"];

export function ageAt(turn) {
  let age = AGES[0][1];
  for (const [from, a] of AGES) if (turn >= from) age = a;
  return age;
}

/** One civ's exogenous income path in cents: growth with the game, noise, war dips and, for some, deficit spells. */
function incomePath(g, factor, deficitProne) {
  const spells = [];
  for (let k = 0; k < 4; k += 1) {
    if (g.chance(0.6)) spells.push({ from: g.int(20, TURNS - 30), length: g.int(10, 25), mult: 0.5, war: true });
  }
  if (deficitProne) {
    for (let k = 0; k < 2; k += 1) {
      spells.push({ from: g.int(40, TURNS - 40), length: g.int(15, 40), mult: -0.4, war: false });
    }
  }
  const noise = Array.from({ length: TURNS + 1 }, () => 1 + (g.next() - 0.5) * 0.3);
  return (turn) => {
    const base = (800 + 25 * turn) * factor;
    let mult = 1;
    let atWar = false;
    for (const s of spells) {
      if (turn >= s.from && turn < s.from + s.length) { mult = Math.min(mult, s.mult); atWar = atWar || s.war; }
    }
    return { incomeCents: Math.round(base * mult * noise[turn]), atWar };
  };
}

export function makeGame(seed, civCount = 12) {
  const g = gen(seed);
  const ids = [];
  while (ids.length < civCount) { const id = g.int(0, 63); if (!ids.includes(id)) ids.push(id); }
  const deficitProne = new Set(ids.slice(1).filter(() => g.chance(0.25)));
  const civs = ids.map((id, i) => ({ id, human: i === 0, factor: 0.6 + g.next() * 0.9,
    income: incomePath(g, 0.6 + g.next() * 0.9, deficitProne.has(id)), startCents: g.int(2000, 40000),
    depthTurns: 0, depthFactorPct: 100,
    stages: { moneylending: g.int(30, 80), publicDebt: g.int(170, 260) },
    banking: g.int(260, 400) }));
  const relations = [];
  for (let i = 0; i < civCount; i += 1) for (let j = i + 1; j < civCount; j += 1) {
    relations.push({ a: ids[i], b: ids[j], level: g.pick(LEVELS) });
  }
  const wars = [];
  for (let k = 0; k < 6; k += 1) {
    const a = g.pick(ids); const b = g.pick(ids);
    if (a !== b) wars.push({ a, b, from: g.int(20, TURNS - 20), length: g.int(10, 30) });
  }
  return { seed, g, civs, relations, wars, humanBorrowEvery: g.int(20, 40) };
}

function relationsAt(game, turn) {
  return game.relations.map((r) => {
    const war = game.wars.some((w) => turn >= w.from && turn < w.from + w.length
      && ((w.a === r.a && w.b === r.b) || (w.a === r.b && w.b === r.a)));
    return war ? { ...r, level: "war" } : r;
  });
}

function civsAt(game, turn, balances) {
  return game.civs.map((c) => {
    const { incomeCents, atWar } = c.income(turn);
    return { id: c.id, alive: true, human: c.human, balanceCents: balances.get(c.id), incomeCents,
      upkeepCents: Math.round(Math.abs(incomeCents) * 0.5) + 300, stages: c.stages, atWar,
      depthTurns: turn >= c.banking ? 2 : 0, depthFactorPct: turn >= c.banking ? 90 : 100 };
  });
}

/** The human's requests: a 10-turn bond or civ loan of 5 turns' income now and then; loans to every short AI. */
function humanRequests(game, turn, civs, ledger, age, lend) {
  const me = civs.find((c) => c.human);
  const out = [];
  if (turn % game.humanBorrowEvery === 0 && me.incomeCents > 0) {
    out.push({ kind: "borrow", borrower: me.id, lender: "bond", principal: 5 * me.incomeCents, term: 10 });
  }
  if (!lend) return out;
  const rate = civRatePpm({ age, standing: 100, level: "neutral" });
  for (const c of civs) {
    if (c.human || c.balanceCents + c.incomeCents >= 0 || c.incomeCents <= 0) continue;
    out.push({ kind: "lend", lender: me.id, borrower: c.id, principal: -(c.balanceCents + c.incomeCents),
      ratePpm: rate, term: 10 });
  }
  return out;
}

/**
 * Runs one game. options.loans false is the Off run. Returns per-turn facts the ladder reads.
 */
export function runGame(game, { on = true, lend = true, roundTrip = true } = {}) {
  let balances = new Map(game.civs.map((c) => [c.id, c.startCents]));
  let ledger;
  const facts = { balances: new Map(game.civs.map((c) => [c.id, []])), events: [], maxBytes: 0, planMs: [],
    lostResend: 0, lent: 0, received: 0, writtenOffToHuman: 0, capBreaches: 0, capHits: [] };
  const me = game.civs.find((c) => c.human).id;
  for (let turn = 1; turn <= TURNS; turn += 1) {
    const age = ageAt(turn);
    const civs = civsAt(game, turn, balances);
    const relations = relationsAt(game, turn);
    const requests = on ? humanRequests(game, turn, civs, ledger, age, lend) : [];
    const t0 = process.hrtime.bigint();
    const plan = planTurn({ turn, age, civs, relations, requests, params: PARAMS, options: { loans: on }, ledger });
    facts.planMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
    const incomes = new Map(civs.map((c) => [c.id, c.incomeCents]));
    const earned = new Map([...balances].map(([id, b]) => [id, b + incomes.get(id)]));
    const next = applyGrants(earned, grantsFor(plan.transfers));
    if (on) {
      readTurn(facts, plan, civs, me, next, earned, incomes);
      const text = save(plan.ledger);
      facts.maxBytes = Math.max(facts.maxBytes, utf8Bytes(text));
      ledger = roundTrip ? load(text).ledger : plan.ledger;
    }
    balances = spend(civs, next);
    for (const c of civs) facts.balances.get(c.id).push(balances.get(c.id));
  }
  facts.ledger = ledger;
  return facts;
}

/**
 * The game's own spending, which the model never sees: each civ buys things with most of what it holds above a
 * reserve of 5 turns' income, so balances sit near the reserve and a deficit spell drains them in a few turns.
 */
function spend(civs, balances) {
  const out = new Map(balances);
  for (const c of civs) {
    const reserve = 5 * Math.max(c.incomeCents, 1000);
    const above = out.get(c.id) - reserve;
    if (above > 0) out.set(c.id, out.get(c.id) - Math.floor(above * 0.8));
  }
  return out;
}

function readTurn(facts, plan, civs, me, next, earned, incomes) {
  for (const e of plan.events) facts.events.push(e);
  for (const t of plan.transfers) {
    if (t.from === me && t.reason === "principal") facts.lent += t.cents;
    if (t.to === me && t.reason !== "principal") facts.received += t.cents;
  }
  for (const e of plan.events) {
    if (e.kind === "repudiation" && e.lender === me) facts.writtenOffToHuman += e.cents;
    if (e.kind === "writeoff") {
      const l = plan.ledger.loans.find((x) => x.id === e.loanId);
      if (l?.lender === me) facts.writtenOffToHuman += e.cents;
    }
  }
  for (const c of civs) {
    const cap = emergencyCap(c.incomeCents);
    const open = emergencyOutstandingOf(plan.ledger, c.id);
    if (plan.events.some((e) => e.kind === "guard" && e.pid === c.id) && open > cap) facts.capBreaches += 1;
    if (plan.events.some((e) => e.kind === "guard-cap" && e.pid === c.id)) facts.capHits.push({ pid: c.id, turn: plan.batch.turn });
  }
  // Save integrity: with the grants applied every row reads landed; with none applied every moved row reads lost,
  // and re-sending the lost nets gives the same balances.
  const landed = batchStatus(plan.batch, next, incomes);
  if (landed.some((r) => r.status !== "landed")) throw new Error(`batch not landed at turn ${plan.batch.turn}`);
  const lost = batchStatus(plan.batch, earned, incomes);
  const resent = applyGrants(earned, lost.filter((r) => r.status === "lost").map((r) => ({ pid: r.pid, cents: r.cents })));
  for (const [pid, b] of next) if (resent.get(pid) !== b) throw new Error(`resend mismatch at ${plan.batch.turn}`);
  facts.lostResend += lost.filter((r) => r.status === "lost").length;
}

/** Borrowing pays: the game's own numbers for a Market, read from the compiled gameplay DB (see NOTES). */
export const PURCHASES = {
  market: { cost: 90, goldYield: [3, 5], age: "AGE_ANTIQUITY", note: "BUILDING_MARKET: Cost 90, +3 Gold, +1 per adjacent coast, navigable river or wonder" },
  bazaar: { cost: 200, goldYield: [6, 8], age: "AGE_EXPLORATION", note: "BUILDING_BAZAAR: Cost 200, +6 Gold, same adjacencies" },
  bank: { cost: 380, goldYield: [8, 10], age: "AGE_MODERN", note: "BUILDING_BANK: Cost 380 (Exploration), +8 Gold, same adjacencies; the Modern comparison" },
  granary: { cost: 55, goldYield: [0, 0], age: "AGE_ANTIQUITY", note: "BUILDING_GRANARY: Cost 55, +1 Food, no Gold" },
};
export const GOLD_PURCHASE_MULTIPLIER = 4;

export function borrowingPays() {
  const rows = [];
  for (const [name, p] of Object.entries(PURCHASES)) {
    const price = p.cost * GOLD_PURCHASE_MULTIPLIER;
    const rate = BASE_RATE_PPM[p.age];
    const interest = totalInterest(price * 100, rate, 10) / 100;
    const [lo, hi] = p.goldYield;
    // Against saving at 10 Gold a turn: the building comes price / 10 turns sooner, each worth its yield.
    rows.push({ purchase: name, age: p.age, priceGold: price, ratePerTurn: rate / 1e6, interestGold: interest,
      yieldOverTermGold: [lo * 10, hi * 10], paysWithinTerm: hi * 10 >= interest, turnsSavedAtIncome10: price / 10,
      gainVsSavingAtIncome10: [lo, hi].map((y) => y * (price / 10) - interest), note: p.note });
  }
  return rows;
}
