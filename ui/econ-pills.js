// econ-pills.js - Economics: the top-bar pills (DESIGN 9), each with its own text and colour. A debt pill only
// while the player owes something ("Debt 56", or "In default" in red); a phase pill while the business cycle is on
// ("Steady" plain, a Slump amber, a Depression or a Panic red); an inflation pill only while the rate is above 0
// (amber from 1% a turn). Pure: the glue reads the session and the dock draws the pills.

/** @typedef {{ text: string, tone: "plain" | "caution" | "warning" }} Pill */

const PHASE_TONES = /** @type {Record<string, Pill["tone"]>} */ ({ slump: "caution", depression: "warning",
  panic: "warning" });

/**
 * @param {{ inDefault: boolean, owedCents: number, phase: string | null, cycleOn: boolean, inflationOn: boolean,
 *   piPpm: number }} q
 * @param {{ loc: (key: string, ...args: (string | number)[]) => string, gold: (cents: number) => string,
 *   rate: (ppm: number) => string, phaseKey: (phase: string) => string }} fmt
 * @returns {Pill[]}
 */
export function pillsFor(q, fmt) {
  /** @type {Pill[]} */
  const pills = [];
  if (q.inDefault) pills.push({ text: fmt.loc("LOC_ECONOMICS_PILL_DEFAULT"), tone: "warning" });
  else if (q.owedCents > 0) pills.push({ text: fmt.loc("LOC_ECONOMICS_PILL", fmt.gold(q.owedCents)), tone: "plain" });
  if (q.cycleOn && q.phase) pills.push({ text: fmt.loc(fmt.phaseKey(q.phase)), tone: PHASE_TONES[q.phase] ?? "plain" });
  if (q.inflationOn && q.piPpm > 0) {
    const tone = q.piPpm >= 10000 ? "caution" : "plain";
    pills.push({ text: fmt.loc("LOC_ECONOMICS_PILL_INFLATION", fmt.rate(q.piPpm)), tone });
  }
  return pills;
}
