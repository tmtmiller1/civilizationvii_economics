import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { devLoanRatioRows, makeTradeGame, routeProfitRows, runTradeGame, wideTallRows } from "./_balance-commerce.mjs";

// The 1.1 rows of DESIGN 10's balance ladder. The hard rows (no payer past 10% of its income, the markets envelope
// under 32 KB, the turn under 50 ms with 40 routes and 60 settlements, the bills summing to zero) are asserted; the
// play rows (trade profit, the development-loan ratio, wide and tall) are measured and written to
// reports/balance-1.1.json for the owner to read against their starting targets.
const GAMES = 10;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
};

test(`balance ladder 1.1: ${GAMES} seeded 12-civ trade games, On against Off, and the price and ratio tables`, () => {
  const report = { games: GAMES, turns: 200, civs: 12, routes: 40, settlements: 60, tradeGames: [],
    routeProfit: { exploration: routeProfitRows("exploration"), modern: routeProfitRows("modern") },
    devLoanRatio: devLoanRatioRows(), wideTall: wideTallRows() };
  const times = [];
  const tariffs = { none: 0, low: 0, high: 0, highPairTurns: 0, pairTurns: 0, changes: 0, aiGain: [], eased: 0,
    lastQuarter: { none: 0, low: 0, high: 0 }, aisTariffedAtEnd: 0, ais: 0 };
  for (let i = 0; i < GAMES; i += 1) {
    const on = runTradeGame(makeTradeGame(9100 + i), { on: true });
    const off = runTradeGame(makeTradeGame(9100 + i), { on: false });
    // The same game with the AI rules on, so the AIs set and answer tariffs (DESIGN 6): the spread of levels, pairs at
    // High on both sides, and each AI's net settlement against the run without them.
    const ruled = runTradeGame(makeTradeGame(9100 + i), { on: true, ai: true });
    for (const key of ["none", "low", "high"]) tariffs[key] += ruled.tariffTurns[key];
    tariffs.highPairTurns += ruled.highPairTurns;
    tariffs.pairTurns += ruled.pairTurns;
    tariffs.changes += ruled.tariffChanges;
    tariffs.eased += ruled.eased;
    for (const key of ["none", "low", "high"]) tariffs.lastQuarter[key] += ruled.lastQuarter[key];
    for (const [pid, level] of Object.entries(ruled.endLevels)) {
      if (Number(pid) === 1) continue;
      tariffs.ais += 1;
      if (level !== "none") tariffs.aisTariffedAtEnd += 1;
    }
    for (const [pid, net] of ruled.netByCiv) {
      if (pid !== 1) tariffs.aiGain.push((net - on.netByCiv.get(pid)) / 200 / 100);
    }
    let sum = 0;
    for (const net of on.netByCiv.values()) sum += net;
    assert.equal(sum, 0, "bills move Gold between civs and create none");
    assert.ok(on.paidShare.every((share) => share <= 0.1 + 1e-9), "no payer past 10% of its income");
    assert.ok(on.maxMarketsBytes <= 32768, `${on.maxMarketsBytes} bytes`);
    times.push(...on.planMs);
    const nets = [...on.netByCiv.values()].map((cents) => cents / 200 / 100);
    report.tradeGames.push({ game: i, meanNetGoldPerTurn: { min: Math.min(...nets), median: median(nets),
      max: Math.max(...nets) }, medianPaidShareOfIncome: median(on.paidShare), cappedRows: on.capped, settledRows: on.rows,
      waivedGold: on.waived / 100, maxMarketsBytes: on.maxMarketsBytes,
      offTransfers: [...off.netByCiv.values()].every((v) => v === 0) });
  }
  const civTurns = tariffs.none + tariffs.low + tariffs.high;
  const quarterTurns = tariffs.lastQuarter.none + tariffs.lastQuarter.low + tariffs.lastQuarter.high;
  // The AIs ease off a civ after 20 turns at peace (DESIGN 6) and this game has no war, so by the last quarter the
  // tariffs should be down: the share of AIs still tariffed at the end is the line to read.
  report.tariffs = { shareNone: tariffs.none / civTurns, shareLow: tariffs.low / civTurns,
    shareHigh: tariffs.high / civTurns, pairsBothHighShare: tariffs.highPairTurns / tariffs.pairTurns,
    lastQuarter: { shareNone: tariffs.lastQuarter.none / quarterTurns, shareLow: tariffs.lastQuarter.low / quarterTurns,
      shareHigh: tariffs.lastQuarter.high / quarterTurns },
    aisTariffedAtEndShare: tariffs.aisTariffedAtEnd / tariffs.ais, eased: tariffs.eased,
    changes: tariffs.changes, aiNetGainGoldPerTurn: { mean: tariffs.aiGain.reduce((s, x) => s + x, 0)
      / tariffs.aiGain.length, median: median(tariffs.aiGain), positive: tariffs.aiGain.filter((x) => x > 0).length,
    negative: tariffs.aiGain.filter((x) => x < 0).length, ais: tariffs.aiGain.length } };
  let cappedRows = 0;
  let settledRows = 0;
  for (const row of report.tradeGames) { cappedRows += row.cappedRows; settledRows += row.settledRows; }
  report.cappedShare = cappedRows / settledRows;
  assert.ok(report.cappedShare < 0.2, `the cap binds on ${report.cappedShare}`);
  assert.ok(report.tariffs.pairsBothHighShare < 0.5, "tariffs don't spiral into every pair at High");
  assert.ok(report.tariffs.aisTariffedAtEndShare < 0.25, "after long peace most AIs have come back down");
  const max = Math.max(...times);
  assert.ok(median(times) < 50, `median ${median(times)} ms`);
  report.planMs = { median: median(times), max };
  const ratios = report.devLoanRatio.map((row) => row.repaidOverPurchase);
  assert.ok(ratios.every((r) => r > 0.5 && r < 2), "a development loan costs about what buying would");
  const [tall, wide] = report.wideTall;
  assert.ok(wide.creditCapCents / tall.creditCapCents < 2 * (wide.incomeCents / tall.incomeCents));
  mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../reports/balance-1.1.json", import.meta.url), `${JSON.stringify(report, null, 1)}\n`);
});
