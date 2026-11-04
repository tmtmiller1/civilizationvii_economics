// econ-pills.js - Economics: the top-bar pills (DESIGN 9), each with its own text and colour. A debt pill only
// while the player owes something ("Debt 56", or "In default" in red); a phase pill while the business cycle is on
// ("Steady" plain, a Slump amber, a Depression or a Panic red); an inflation pill only while the rate is above 0
// (amber from 1% a turn). Each pill names the tab that explains it and the section to land on, so a press opens the
// screen there: the debt pills the Loans tab (in default, the loan in trouble), the phase pill the World tab's cycle
// or, in a crisis, the Crisis section, the inflation pill the World tab's inflation. Pure: the glue reads the session
// and the dock draws the pills.

/**
 * @typedef {{ text: string, tone: "plain" | "caution" | "warning", tab: "loans" | "world", focus: string | null,
 *   tip: string }} Pill
 */

const PHASE_TONES = /** @type {Record<string, Pill["tone"]>} */ ({ slump: "caution", depression: "warning",
  panic: "warning" });

/**
 * @param {{ inDefault: boolean, owedCents: number, phase: string | null, cycleOn: boolean, inflationOn: boolean,
 *   piPpm: number, inCrisis?: boolean, running?: string[], arrears?: boolean }} q
 * @param {{ loc: (key: string, ...args: (string | number)[]) => string, gold: (cents: number) => string,
 *   rate: (ppm: number) => string, phaseKey: (phase: string) => string }} fmt
 * @returns {Pill[]}
 */
export function pillsFor(q, fmt) {
  return [debtPill(q, fmt), phasePill(q, fmt), inflationPill(q, fmt)].filter((pill) => pill !== null);
}

/** @type {(q: Parameters<typeof pillsFor>[0], fmt: Parameters<typeof pillsFor>[1]) => Pill | null} */
function debtPill(q, fmt) {
  if (q.inDefault) {
    return { text: fmt.loc("LOC_ECONOMICS_PILL_DEFAULT"), tone: "warning", tab: "loans",
      focus: ".econ-card--trouble", tip: fmt.loc("LOC_ECONOMICS_PILL_TIP_DEFAULT") };
  }
  if (!(q.owedCents > 0)) return null;
  return { text: fmt.loc("LOC_ECONOMICS_PILL", fmt.gold(q.owedCents)), tone: "plain", tab: "loans", focus: null,
    tip: fmt.loc("LOC_ECONOMICS_PILL_TIP_DEBT") };
}

/** @type {(q: Parameters<typeof pillsFor>[0], fmt: Parameters<typeof pillsFor>[1]) => string} */
function phaseText(q, fmt) {
  const parts = [fmt.loc(fmt.phaseKey(/** @type {string} */ (q.phase)))];
  if (q.inCrisis && q.running?.length) parts.push(fmt.loc(q.running[0]));
  if (q.inCrisis && q.arrears) parts.push(fmt.loc("LOC_ECONOMICS_PILL_ARREARS"));
  return parts.join(" · ");
}

/** @type {(q: Parameters<typeof pillsFor>[0], fmt: Parameters<typeof pillsFor>[1]) => Pill | null} */
function phasePill(q, fmt) {
  if (!q.cycleOn || !q.phase) return null;
  // While a crisis response or a crisis-paths card runs, the pill names it: "Depression · New Deal programmes".
  return { text: phaseText(q, fmt), tone: PHASE_TONES[q.phase] ?? "plain", tab: "world",
    focus: q.inCrisis ? ".econ-crisis" : ".econ-world-now",
    tip: fmt.loc(q.inCrisis ? "LOC_ECONOMICS_PILL_TIP_CRISIS" : "LOC_ECONOMICS_PILL_TIP_PHASE") };
}

/** @type {(q: Parameters<typeof pillsFor>[0], fmt: Parameters<typeof pillsFor>[1]) => Pill | null} */
function inflationPill(q, fmt) {
  if (!q.inflationOn || !(q.piPpm > 0)) return null;
  return { text: fmt.loc("LOC_ECONOMICS_PILL_INFLATION", fmt.rate(q.piPpm)), tone: q.piPpm >= 10000 ? "caution" : "plain",
    tab: "world", focus: ".econ-world-inflation", tip: fmt.loc("LOC_ECONOMICS_PILL_TIP_INFLATION") };
}
