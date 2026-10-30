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
  for (let i = 0; i < GAMES; i += 1) {
    const on = runTradeGame(makeTradeGame(9100 + i), { on: true });
    const off = runTradeGame(makeTradeGame(9100 + i), { on: false });
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
