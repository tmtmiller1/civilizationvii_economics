// econ-view-macro.js - Economics: the numbers the World tab, the Fiscal tab's system section and the Treasury tab's
// inflation lines show (DESIGN 4.8, 4.11, 4.17, 9), from the same plan input the turn batch gets and the macro
// envelope it left, so what the player reads is what the next batch works from. Plain data in, plain data out;
// nothing here reads the engine.

import { DEFAULT_OPTIONS } from "./econ-plan.js";
import { macroReadings, emptyMacro } from "./econ-macro-state.js";
import { phaseOf, leverPct } from "./econ-cycle.js";
import { erosionCents, reserveCents } from "./econ-inflation.js";
import { IDEOLOGY_SYSTEMS, systemFor, termsOf } from "./econ-systems.js";
import { planSplit, planTakeCents } from "./econ-planned.js";
import { isOpen } from "./econ-loan.js";
import { hasStage } from "./econ-stages.js";
import { CYCLE_RULES, SYSTEM_BLEND_TURNS } from "./econ-params.js";
import { cycleGoldFor } from "./econ-macro.js";
import { viewContext } from "./econ-view-model.js";

/** @param {PlanInput} input */
const optionsOf = (input) => ({ ...DEFAULT_OPTIONS, ...(input.options || {}) });

/**
 * The World tab: E and its phase, the player's own index and phase, a running Panic, the cycle's recent events
 * newest first, E's history, inflation and its cause, world debt against the Gold held.
 * @param {PlanInput} input
 * @param {number} me
 */
export function worldView(input, me) {
  const options = optionsOf(input);
  const macro = input.macro || emptyMacro();
  const readings = macroReadings(macro, { civs: input.civs, turn: input.turn, options });
  const live = input.civs.filter((civ) => civ.alive === true);
  let outstanding = 0;
  for (const loan of input.ledger?.loans || []) if (isOpen(loan)) outstanding += loan.outstanding;
  const { bondCents, moneyCents, top } = macro.inflation;
  return { cycleOn: readings.kPct > 0, e: readings.e, worldPhase: readings.panic ? "panic" : phaseOf(readings.e),
    mine: readings.civ.get(me) || null, panic: readings.panic, panicUntil: macro.cycle.panicUntil,
    goldCents: cycleGoldLine(input, me).cents,
    outOfCycle: termsOf(/** @type {import("./econ-systems.js").SystemId} */ (systemView(input, me).system)).outOfCycle,
    events: [...macro.cycle.events].reverse().slice(0, 12), history: [...macro.cycle.history],
    inflation: { on: options.inflation === true, piPpm: readings.piPpm, bondCents, moneyCents, top,
      ratioPct: moneyCents > 0 ? Math.round((bondCents * 100) / moneyCents) : 0 },
    debt: { outstandingCents: outstanding, leverPct: leverPct(outstanding, live.map((civ) => civ.incomeCents)),
      panicLeverPct: CYCLE_RULES.panicLeverPct },
    banking: live.some((civ) => hasStage(civ, "banking", input.turn, options)) };
}

/**
 * Where a civ's system comes from: its ideology, its government, or neither yet.
 * @param {Civ | null} civ
 */
function systemSource(civ) {
  if (civ?.ideology && Object.hasOwn(IDEOLOGY_SYSTEMS, civ.ideology)) return "ideology";
  return civ?.government ? "government" : "none";
}

/**
 * The Fiscal tab's system section: the system, where it comes from, how much of a change's blend is left, and the
 * plan's take this turn for a Planned civ and the Gold its whole points spend.
 * @param {PlanInput} input
 * @param {number} me
 */
export function systemView(input, me) {
  const civ = input.civs.find((row) => row.id === me) || null;
  const row = (input.macro || emptyMacro()).systems[String(me)] || null;
  const on = optionsOf(input).systems !== false;
  if (!on) return { on, system: "mixed", source: systemSource(civ), from: null, blendLeft: 0, ...planFor("mixed", null, input) };
  const system = row ? row.system : systemFor(civ || {});
  const blendLeft = blendTurnsLeft(row, input.turn);
  return { on, system, source: systemSource(civ), from: blendLeft > 0 ? row?.from ?? null : null, blendLeft,
    ...planFor(system, civ, input) };
}

/**
 * The plan this turn for a Planned civ: its take and the Gold its whole points spend (the split the batch makes, so
 * the tab shows what leaves the treasury); both are 0 for any other system.
 * @param {import("./econ-systems.js").SystemId} system
 * @param {Civ | null} civ
 * @param {PlanInput} input
 */
function planFor(system, civ, input) {
  const rate = input.params?.goldPerPointCents ?? null;
  const take = termsOf(system).plan && civ ? planTakeCents(civ.incomeCents) : 0;
  let spent = 0;
  for (const row of planSplit(take, civ?.cities || [], rate)) spent += row.cents;
  return { planTakeCents: take, planSpentCents: spent };
}

/**
 * Turns left in a change's 10-turn blend; 0 when the system hasn't changed.
 * @param {import("./econ-systems.js").SystemRow | null} row
 * @param {number} turn
 */
function blendTurnsLeft(row, turn) {
  if (!row || row.from === row.system) return 0;
  return Math.max(0, SYSTEM_BLEND_TURNS - (turn - row.since));
}

/**
 * The Treasury tab's inflation lines (DESIGN 4.8): whether the civ takes part, its reserve and what erosion would
 * take from it at this turn's pi.
 * @param {PlanInput} input
 * @param {number} me
 */
export function inflationLines(input, me) {
  const options = optionsOf(input);
  const civ = input.civs.find((row) => row.id === me);
  if (!civ || options.inflation !== true) return { on: false, member: false, reserveCents: 0, erosionCents: 0 };
  const macro = input.macro || emptyMacro();
  const readings = macroReadings(macro, { civs: [civ], turn: input.turn, options });
  const terms = readings.terms.get(me) || termsOf("mixed");
  const member = hasStage(civ, "publicDebt", input.turn, options) && !terms.outOfCycle;
  return { on: true, member, reserveCents: reserveCents(civ.incomeCents),
    erosionCents: member ? erosionCents({ piPpm: readings.piPpm, balanceCents: civ.balanceCents,
      incomeCents: civ.incomeCents, erosionPct: terms.erosionPct }) : 0 };
}

/**
 * Next turn's cycle Gold for the player and its phase (DESIGN 4.11), for the Treasury tab's line before the World tab
 * opens: positive in a boom, negative in a slump.
 * @param {PlanInput} input
 * @param {number} me
 */
export function cycleGoldLine(input, me) {
  const ctx = viewContext(input);
  const civ = ctx.civ.get(me);
  const reading = ctx.readings.civ.get(me);
  if (!civ || !reading || ctx.readings.kPct === 0) return { on: false, cents: 0, phase: "steady" };
  return { on: true, cents: cycleGoldFor(ctx, civ), phase: reading.phase };
}
