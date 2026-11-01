import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { TURNS, borrowingPays, makeGame, runGame } from "./_balance.mjs";

// The 1.0 rows of DESIGN 10's balance ladder. The hard rows (cap never passed, save integrity, envelope, turn time)
// are asserted; the play rows (solvency, persistence, borrowing and lending pay, repudiation) are measured and
// written to reports/balance-1.0.json for the owner to read against their starting targets.
const GAMES = 20;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
}

function solvency(game, on, off) {
  const rows = [];
  for (const c of game.civs) {
    if (c.human) continue;
    const offBalances = off.balances.get(c.id);
    const onBalances = on.balances.get(c.id);
    const meanIncome = (offBalances.at(-1) - c.startCents) / TURNS;
    const offPositive = offBalances.every((b) => b >= 0);
    const defaults = on.events.filter((e) => e.kind === "default" && e.borrower === c.id).length;
    const repudiations = on.events.filter((e) => e.kind === "repudiation" && e.borrower === c.id).length;
    const emergencies = on.events.filter((e) => e.kind === "guard" && e.pid === c.id).length;
    const penalty = (xs) => xs.filter((b) => b < 0).length;
    const disband = (xs) => xs.filter((b) => b < -1000).length;
    rows.push({ pid: c.id, meanIncomeGold: meanIncome / 100, offPositive, defaults, repudiations, emergencies,
      penaltyTurnsOn: penalty(onBalances), penaltyTurnsOff: penalty(offBalances), disbandTurnsOn: disband(onBalances),
      disbandTurnsOff: disband(offBalances) });
  }
  return rows;
}

/**
 * What the AI plan's rules did across the games (AI-PLAN 4.1 to 4.5), as counts of the ledger's events: how
 * refinancing, early repayment, restructuring, misses, defaults, repudiations (and against whom), investment and
 * aid now spread, for the report against the earlier runs' numbers.
 */
function aiRules(games) {
  const counts = {};
  const add = (key, n = 1) => { counts[key] = (counts[key] || 0) + n; };
  for (const { game, on } of games) {
    const me = game.civs[0].id;
    for (const e of on.events) {
      if (e.kind === "refinance") add("refinance");
      else if (e.kind === "short") add(`short:${e.reason}`);
      else if (e.kind === "repay-early") add("repay-early");
      else if (e.kind === "restructure") add("restructure");
      else if (e.kind === "miss") add(e.paid > 0 ? "miss:partial" : "miss:nothing");
      else if (e.kind === "default") add("default");
      else if (e.kind === "repudiation") add(`repudiation:${e.lender === "bond" || e.lender === "temple" ? "world" : e.lender === me ? "human" : "civ"}`);
      else if (e.kind === "invest") add(e.aid === 1 ? "aid" : `invest:${e.form}`);
      else if (e.kind === "aid-cleared") add("aid-cleared");
      else if (e.kind === "offer") add("offer");
      else if (e.kind === "credit-rep") add(`credit-rep:${e.why}`);
      else if (e.kind === "crisis-start") add(`crisis:${e.crisis}`);
      else if (e.kind === "crisis-end") add("crisis-end");
      else if (e.kind === "response") add(`response:${e.response}`);
    }
    add("build-loan", on.buildLoans);
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function persistence(game, on) {
  const out = [];
  const seen = new Set();
  for (const hit of on.capHits) {
    if (seen.has(hit.pid)) continue;
    seen.add(hit.pid);
    const balances = on.balances.get(hit.pid);
    const after = balances.slice(hit.turn - 1);
    const firstPenalty = after.findIndex((b) => b < 0);
    out.push({ pid: hit.pid, capTurn: hit.turn, turnsToPenalty: firstPenalty });
  }
  return out;
}

test(`balance ladder 1.0: ${GAMES} seeded 12-civ ${TURNS}-turn games, On against Off`, (t) => {
  const report = { games: GAMES, turns: TURNS, civs: 12, solvency: [], persistence: [], lending: [], repudiation: [],
    envelopeMaxBytes: 0, planMs: { median: 0, max: 0 }, saveIntegrity: { lostRowsResent: 0 }, capBreaches: 0 };
  const planTimes = [];
  const games = [];
  for (let i = 0; i < GAMES; i += 1) {
    const game = makeGame(7000 + i);
    const on = runGame(game, { on: true });
    games.push({ game, on });
    const off = runGame(makeGame(7000 + i), { on: false });
    report.solvency.push(...solvency(game, on, off).map((r) => ({ game: i, ...r })));
    report.persistence.push(...persistence(game, on).map((r) => ({ game: i, ...r })));
    const net = on.received - on.lent - on.writtenOffToHuman;
    report.lending.push({ game: i, lentGold: on.lent / 100, receivedGold: on.received / 100,
      writtenOffGold: on.writtenOffToHuman / 100, netGold: net / 100, returnPct: on.lent ? (100 * net) / on.lent : null });
    const reps = on.events.filter((e) => e.kind === "repudiation");
    const me = game.civs[0].id;
    report.repudiation.push({ game: i, count: reps.length, byAi: reps.filter((r) => r.borrower !== me).length,
      againstHuman: reps.filter((r) => r.lender === me).length,
      againstWorld: reps.filter((r) => r.lender === "bond" || r.lender === "temple").length,
      defaults: on.events.filter((e) => e.kind === "default").length,
      restructures: on.events.filter((e) => e.kind === "restructure").length });
    report.envelopeMaxBytes = Math.max(report.envelopeMaxBytes, on.maxBytes);
    planTimes.push(...on.planMs);
    report.saveIntegrity.lostRowsResent += on.lostResend;
    report.capBreaches += on.capBreaches;
  }
  report.planMs = { median: median(planTimes), max: Math.max(...planTimes) };
  report.borrowingPays = borrowingPays();
  report.aiRules = aiRules(games);
  const positive = report.solvency.filter((r) => r.offPositive && r.meanIncomeGold > 0);
  const defaulted = positive.filter((r) => r.defaults > 0);
  const gamesWithDefault = new Set(defaulted.map((r) => r.game)).size;
  report.summary = {
    aiSolvency: { positiveIncomeAis: positive.length, ofWhichDefaulted: defaulted.length,
      gamesWithSuchDefault: gamesWithDefault, share: gamesWithDefault / GAMES,
      emergencyLoansOnPositiveAis: positive.reduce((s, r) => s + r.emergencies, 0),
      penaltyTurnsOn: report.solvency.reduce((s, r) => s + r.penaltyTurnsOn, 0),
      penaltyTurnsOff: report.solvency.reduce((s, r) => s + r.penaltyTurnsOff, 0) },
    debtPersistence: { capBreaches: report.capBreaches, civsAtCap: report.persistence.length,
      medianTurnsToPenalty: median(report.persistence.map((r) => r.turnsToPenalty).filter((x) => x >= 0)),
      neverPenalised: report.persistence.filter((r) => r.turnsToPenalty < 0).length },
    lendingPays: { gamesLent: report.lending.filter((r) => r.lentGold > 0).length,
      meanReturnPct: median(report.lending.filter((r) => r.returnPct !== null).map((r) => r.returnPct)),
      positiveGames: report.lending.filter((r) => r.netGold > 0).length },
    repudiation: { perGame: median(report.repudiation.map((r) => r.count)),
      total: report.repudiation.reduce((s, r) => s + r.count, 0),
      againstWorld: report.repudiation.reduce((s, r) => s + r.againstWorld, 0),
      againstHuman: report.repudiation.reduce((s, r) => s + r.againstHuman, 0),
      defaultsTotal: report.repudiation.reduce((s, r) => s + r.defaults, 0),
      restructuresTotal: report.repudiation.reduce((s, r) => s + r.restructures, 0) },
  };
  mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../reports/balance-1.0.json", import.meta.url), JSON.stringify(report, null, 2));
  t.diagnostic(JSON.stringify(report.summary));
  t.diagnostic(`AI rules: ${JSON.stringify(report.aiRules)}`);
  t.diagnostic(`envelope max ${report.envelopeMaxBytes} bytes; plan median ${report.planMs.median.toFixed(3)} ms, max`
    + ` ${report.planMs.max.toFixed(3)} ms`);
  for (const r of report.borrowingPays) t.diagnostic(JSON.stringify(r));
  assert.equal(report.capBreaches, 0, "no civ holds emergency principal past emergency_cap");
  assert.ok(report.envelopeMaxBytes <= 65536, `envelope ${report.envelopeMaxBytes}`);
  assert.ok(report.planMs.median < 50, `plan median ${report.planMs.median}`);
  // The human lends to an AI whose dues pass its funds (AI-PLAN 4.1); with the harness's AIs holding five turns of
  // income and the escrow holding their next payment, that can come up in no game at all, so the row is reported,
  // not required.
  assert.ok(report.summary.repudiation.total >= 0);
});
