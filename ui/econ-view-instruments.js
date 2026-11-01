// econ-view-instruments.js - Economics: the screen's instruments. The cycle's dial (the one dial on the screen: the
// player's own index, the world's under it, on the model's own phase lines), and two slim scales: the share of income
// the loan payments take, with the lenders' limit marked, and inflation a turn up to its cap.

import { gauge, meter } from "./econ-dom.js";
import { CREDIT, INFLATION_RULES } from "./econ-params.js";
import { phaseKey } from "./econ-notice-text.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * The player's own index on the cycle dial, the world's under it.
 * @param {ReturnType<typeof import("./econ-view-macro.js").worldView>} world
 * @param {ScreenApi} api
 */
export function cycleDial(world, api) {
  const phase = world.mine?.phase ?? world.worldPhase;
  const index = world.mine?.index ?? world.e;
  const bad = ["slump", "depression", "panic"].includes(phase);
  return gauge("cycle-mine", (index / 10000 - 0.5), { title: api.loc("LOC_ECONOMICS_WORLD_YOURS"),
    reading: `${(index / 10000).toFixed(2)} · ${api.loc(phaseKey(phase))}`, tone: bad ? -1 : phase === "boom" ? 1 : 0,
    sub: api.loc("LOC_ECONOMICS_GAUGE_WORLD_SUB", (world.e / 10000).toFixed(2), api.loc(phaseKey(world.worldPhase))),
    scale: ["0.50", "1.50"], tooltip: cycleTip(world, api) });
}

/**
 * The dial's tooltip: what the index is and what moves it, the bands, what the needle reads for the player against
 * the world, and what the reading does to the player's Gold this turn, in their own numbers.
 * @param {ReturnType<typeof import("./econ-view-macro.js").worldView>} world
 * @param {ScreenApi} api
 */
export function cycleTip(world, api) {
  const phase = world.mine?.phase ?? world.worldPhase;
  const index = world.mine?.index ?? world.e;
  const gold = Math.round(Math.abs(world.goldCents || 0) / 100);
  const effect = world.outOfCycle ? api.loc("LOC_ECONOMICS_GAUGE_CYCLE_TIP_OUTSIDE")
    : world.goldCents > 0 ? api.loc("LOC_ECONOMICS_GAUGE_CYCLE_TIP_PAYS", gold)
      : world.goldCents < 0 ? api.loc("LOC_ECONOMICS_GAUGE_CYCLE_TIP_CHARGES", gold)
        : api.loc("LOC_ECONOMICS_GAUGE_CYCLE_TIP_EVEN");
  return api.loc("LOC_ECONOMICS_GAUGE_CYCLE_TIP", (index / 10000).toFixed(2), api.loc(phaseKey(phase)),
    (world.e / 10000).toFixed(2), api.loc(phaseKey(world.worldPhase)), effect);
}

/**
 * The share of income the loan payments take, 0 to 100%, the lenders' limit marked.
 * @param {number} pct
 * @param {ScreenApi} api
 */
export function serviceMeter(pct, api) {
  const share = Math.max(0, pct);
  return meter({ title: api.loc("LOC_ECONOMICS_GAUGE_SERVICE"), share: share / 100,
    reading: api.loc("LOC_ECONOMICS_GAUGE_SERVICE_READING", share), low: "0%", high: "100%",
    limit: CREDIT.servicePct / 100, limitLabel: api.loc("LOC_ECONOMICS_GAUGE_LIMIT", CREDIT.servicePct),
    tooltip: api.loc("LOC_ECONOMICS_GAUGE_SERVICE_TIP", CREDIT.servicePct) });
}

/**
 * Inflation a turn, 0 to its cap.
 * @param {number} piPpm
 * @param {ScreenApi} api
 */
export function inflationMeter(piPpm, api) {
  return meter({ title: api.loc("LOC_ECONOMICS_WORLD_INFLATION_RATE"), share: piPpm / INFLATION_RULES.capPpm,
    reading: api.loc("LOC_ECONOMICS_GAUGE_INFLATION_READING", formatRateText(piPpm)), low: "0%",
    high: formatRateText(INFLATION_RULES.capPpm), tooltip: api.loc("LOC_ECONOMICS_GAUGE_INFLATION_TIP") });
}

/** @param {number} ppm */
const formatRateText = (ppm) => `${((ppm * 100) / 1e6).toFixed(1)}%`;

