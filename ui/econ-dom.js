// econ-dom.js - Economics: the pieces the Economics screen is built from. The look is a treasury instrument in the
// game's own materials: warm charcoal panels, ivory figures, antique gold kept for focus, money and one rule under each
// major section; the cycle's index on the one dial (Zoom, Tilt and Rotate's face-and-needle craft), the debt-service
// share and inflation on slim horizontal scales. Numbers carry their yield icon, their sign and their unit, so colour
// is never the only cue. GameFace has no grid, no italic and drops `var()` in shorthands, so every look is a class in
// econ-screen.css, a longhand, or a literal inline style.
//
// Controls: in the game a control is an `fxs-activatable`, the element the game's own buttons are built on. It plays
// the press sounds, honours `disabled="true"`, and turns a mouse click, Enter or a controller's accept into one
// `action-activate` event. The game's navigation treats any element with a `tabindex` attribute as focusable
// (navigation-support.js isFocusable), so each control carries the game's own `tabindex="-1"`. Without the game (the
// tests) a control is a div that answers `click`.

const IMAGES = "fs://game/tower-economics/images/";
const SVG_NS = "http://www.w3.org/2000/svg";
const YIELD_ICONS = { gold: "blp:Yield_Gold", happiness: "blp:Yield_Happiness", influence: "blp:yield_influence" };
/** A second activation of the same control inside this many milliseconds is a double press and is dropped. */
const REPEAT_MS = 400;

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
export function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @param {HTMLElement} node @param {string | null | undefined} text */
function tip(node, text) {
  if (text) node.setAttribute("data-tooltip-content", text);
  return node;
}

const inGame = () => typeof Controls !== "undefined";

/**
 * A control: the game's activatable element, or a div outside the game; `onActivate` runs once per press.
 * @param {string} className
 * @param {() => void} onActivate
 * @param {{ disabled?: boolean, tooltip?: string | null }} [options]
 */
export function control(className, onActivate, { disabled = false, tooltip } = {}) {
  const node = el(inGame() ? "fxs-activatable" : "div", className);
  node.setAttribute("tabindex", "-1");
  node.setAttribute("role", "button");
  tip(node, tooltip);
  if (disabled) {
    node.setAttribute("disabled", "true");
    return node;
  }
  let last = -Infinity;
  const run = () => {
    const now = Date.now();
    if (now - last < REPEAT_MS) return;
    last = now;
    onActivate();
  };
  node.addEventListener(inGame() ? "action-activate" : "click", run);
  return node;
}

/**
 * A titled panel. `major` panels (a tab's main subjects) take the title font and the one gold rule; `minor` ones a
 * quieter title and no rule; `compact` ones no frame of their own, for a group inside another panel.
 * @param {string} title
 * @param {HTMLElement[]} [children]
 * @param {{ subtitle?: string, className?: string, variant?: "major" | "minor" | "compact" }} [options]
 */
export function section(title, children = [], { subtitle, className = "", variant = "major" } = {}) {
  const node = el("div", `econ-section econ-section--${variant} ${className}`.trim());
  const head = el("div", "econ-section-head");
  head.appendChild(el("div", variant === "major" ? "econ-section-title font-title uppercase" : "econ-section-title",
    title));
  if (subtitle) head.appendChild(el("div", "econ-section-subtitle font-body", subtitle));
  node.appendChild(head);
  if (variant === "major") node.appendChild(el("div", "econ-rule"));
  for (const child of children) node.appendChild(child);
  return node;
}

/**
 * Two columns: the wide one for the tab's subject (charts, ledgers), the narrow one for conditions and short lists.
 * One column on a narrow screen.
 * @param {HTMLElement[]} left
 * @param {HTMLElement[]} right
 */
export function columns(left, right) {
  const node = el("div", "econ-cols");
  const a = el("div", "econ-col econ-col--main");
  const b = el("div", "econ-col econ-col--side");
  for (const child of left) a.appendChild(child);
  for (const child of right) b.appendChild(child);
  node.appendChild(a);
  if (right.length) node.appendChild(b);
  return node;
}

/**
 * One of the game's yield icons.
 * @param {"gold" | "happiness" | "influence"} kind
 * @param {string} [size] a rem size
 */
export function icon(kind, size = "1.4rem") {
  const node = el("div", "econ-yicon");
  node.style.backgroundImage = `url("${YIELD_ICONS[kind]}")`;
  node.style.width = size;
  node.style.height = size;
  return node;
}

/** @param {number} tone */
const toneClass = (tone) => (tone > 0 ? " econ-positive" : tone < 0 ? " econ-negative" : "");

/**
 * A number with its yield icon. A signed number keeps its sign in the text; `tone` adds the colour (green for a
 * gain, coral for a loss) on top of it. `unit` follows the number ("a turn").
 * @param {string} text the number as shown, signed where it's a change
 * @param {{ kind?: "gold" | "happiness" | "influence" | null, tone?: number, tooltip?: string, big?: boolean,
 *   unit?: string }} [options]
 */
export function amount(text, { kind = "gold", tone = 0, tooltip, big = false, unit } = {}) {
  const node = el("div", `econ-amount${big ? " econ-amount--big" : ""}`);
  if (kind) node.appendChild(icon(kind, big ? "1.8rem" : "1.3rem"));
  node.appendChild(el("div", `econ-amount-value${toneClass(tone)}`, text));
  if (unit) node.appendChild(el("div", "econ-amount-unit", unit));
  return tip(node, tooltip);
}

/**
 * A ledger row: the label on the left, the value (text or a node) on the right.
 * @param {string} label
 * @param {string | HTMLElement} value
 * @param {string} [valueClass]
 */
export function row(label, value, valueClass = "") {
  const node = el("div", "econ-row");
  node.appendChild(el("div", "econ-row-label", label));
  const cell = typeof value === "string" ? el("div", "econ-row-value", value) : value;
  if (typeof value !== "string") cell.classList.add("econ-row-value");
  for (const name of valueClass.split(" ").filter(Boolean)) cell.classList.add(name);
  node.appendChild(cell);
  return node;
}

/**
 * A row comparing now with after an action: "120 → 240".
 * @param {string} label
 * @param {string} before
 * @param {string} after
 * @param {number} [tone] the colour of the change
 */
export function changeRow(label, before, after, tone = 0) {
  const value = el("div", "econ-change");
  value.appendChild(el("div", "econ-change-before", before));
  value.appendChild(el("div", "econ-change-arrow", "→"));
  value.appendChild(el("div", `econ-change-after${toneClass(tone)}`, after));
  return row(label, value);
}

/** A short explanation under a block. @param {string} text */
export function note(text) {
  return el("div", "econ-note", text);
}

/**
 * What a block will show and when, where it has nothing yet.
 * @param {string} text
 */
export function empty(text) {
  return el("div", "econ-empty", text);
}

/**
 * A figure: a quiet label over the value, an optional line under it.
 * @param {string} label
 * @param {HTMLElement | string} value
 * @param {{ sub?: string, tooltip?: string, className?: string }} [options]
 */
export function stat(label, value, { sub, tooltip, className = "" } = {}) {
  const node = el("div", `econ-stat ${className}`.trim());
  node.appendChild(el("div", "econ-stat-label", label));
  node.appendChild(typeof value === "string" ? el("div", "econ-stat-value", value) : value);
  if (sub) node.appendChild(el("div", "econ-stat-sub", sub));
  return tip(node, tooltip);
}

/**
 * A row of figures on a card's face.
 * @param {HTMLElement[]} stats
 */
export function facts(stats) {
  const node = el("div", "econ-facts");
  for (const child of stats) node.appendChild(child);
  return node;
}

/**
 * A button in the game's button art. `className` picks its weight: `econ-button--primary` (the full button art),
 * the default secondary, `econ-button--warning` (red, for what can't be undone) or `econ-button--quiet`. Disabled,
 * it greys, takes no press, and `reason` says why beside it.
 * @param {string} caption
 * @param {() => void} onClick
 * @param {{ disabled?: boolean, className?: string, reason?: string | null, tooltip?: string }} [options]
 */
export function button(caption, onClick, { disabled = false, className = "", reason = null, tooltip } = {}) {
  const node = control(`econ-button ${className}`.trim(), onClick, { disabled, tooltip });
  if (disabled) node.classList.add("econ-button--disabled");
  const art = el("div", "econ-button-art");
  for (const look of ["base", "focus", "active", "disabled"]) {
    art.appendChild(el("div", `econ-button-bg econ-button-bg--${look}`));
  }
  node.appendChild(art);
  node.appendChild(el("div", "econ-button-label font-title", caption));
  if (!reason) return node;
  const wrap = el("div", "econ-button-why");
  wrap.appendChild(node);
  wrap.appendChild(el("div", "econ-why", reason));
  return wrap;
}

/**
 * A row of choices, the chosen one lit and marked: a segmented control.
 * @param {{ id: string, label: string, tooltip?: string }[]} items
 * @param {string} chosen
 * @param {(id: string) => void} onPick
 */
export function chips(items, chosen, onPick) {
  const node = el("div", "econ-chips");
  for (const item of items) {
    const on = item.id === chosen;
    const chip = control(`econ-chip${on ? " econ-chip--on" : ""}`, () => onPick(item.id), { tooltip: item.tooltip });
    chip.setAttribute("aria-selected", on ? "true" : "false");
    chip.appendChild(el("div", "econ-chip-label", item.label));
    node.appendChild(chip);
  }
  return node;
}

/**
 * The red status pill (memory: status text as a red pill) for what needs attention; the plain one for a state.
 * @param {string} text
 * @param {boolean} warning
 */
export function pill(text, warning) {
  const node = el("div", `econ-pill font-body${warning ? " econ-pill--warning" : ""}`, text);
  const look = warning ? { border: "1px solid #FF7A66", background: "#A8201A", color: "#FFF3E3" }
    : { border: "1px solid #6a5a3c", background: "#302E2A", color: "#EAE0CD" };
  node.style.border = look.border;
  node.style.background = look.background;
  node.style.color = look.color;
  return node;
}

/**
 * A stepper for a Gold amount. The amount is in cents, as the model keeps Gold; the steps are 10 and 100 Gold
 * (1,000 and 10,000 cents). Each press moves the shown amount at once and hands the new one to `onChange`; a step
 * that can't move it (at the least or the most) is marked off and does nothing.
 * @param {{ value: number, min: number, max: number, onChange: (cents: number) => void,
 *   format: (cents: number) => string, unit?: string }} q
 */
export function goldStepper({ value, min, max, onChange, format, unit }) {
  const node = el("div", "econ-stepper");
  let current = Math.max(min, Math.min(max, value));
  const shown = el("div", "econ-stepper-value");
  /** @type {{ node: HTMLElement, by: number }[]} */
  const steps = [];
  const draw = () => {
    while (shown.firstChild) shown.removeChild(shown.firstChild);
    shown.appendChild(amount(format(current), { kind: "gold", unit }));
    for (const step of steps) step.node.classList.toggle("econ-step--off", step.by < 0 ? current <= min : current >= max);
  };
  const step = (/** @type {number} */ by, /** @type {string} */ caption) => {
    const chip = control("econ-step font-title", () => {
      const next = Math.max(min, Math.min(max, current + by));
      if (next === current) return;
      current = next;
      draw();
      onChange(current);
    });
    chip.appendChild(el("div", "econ-step-label", caption));
    steps.push({ node: chip, by });
    return chip;
  };
  node.appendChild(step(-10000, "-100"));
  node.appendChild(step(-1000, "-10"));
  node.appendChild(shown);
  node.appendChild(step(1000, "+10"));
  node.appendChild(step(10000, "+100"));
  draw();
  return node;
}

/** @param {number} share */
const clamp01 = (share) => Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));

/** Needles already drawn at a reading, so a re-render doesn't sweep them again. @type {Map<string, number>} */
const needles = new Map();

/**
 * The cycle's dial: Zoom, Tilt and Rotate's face-and-needle craft. The face marks the model's own phase lines;
 * `share` is 0 at the low end of the scale and 1 at the high. The needle sweeps once, the first time a reading is
 * drawn; after that a re-render draws it in place.
 * @param {string} id what the dial reads, for its sweep
 * @param {number} share
 * @param {{ title: string, reading: string, sub?: string, tooltip?: string, tone?: number,
 *   scale?: [string, string] }} text
 */
export function gauge(id, share, { title, reading, sub, tooltip, tone = 0, scale }) {
  const node = el("div", "econ-gauge");
  node.appendChild(el("div", "econ-gauge-title", title));
  node.appendChild(dialOf(id, share));
  if (scale) {
    const ends = el("div", "econ-gauge-ends");
    ends.appendChild(el("div", "", scale[0]));
    ends.appendChild(el("div", "", scale[1]));
    node.appendChild(ends);
  }
  node.appendChild(el("div", `econ-gauge-reading${toneClass(tone)}`, reading));
  if (sub) node.appendChild(el("div", "econ-gauge-sub", sub));
  return tip(node, tooltip);
}

/**
 * The dial itself: the face and the needle at its reading, swept there the first time this reading is drawn.
 * @param {string} id
 * @param {number} share
 */
function dialOf(id, share) {
  const dial = el("div", "econ-gauge-dial");
  const plate = el("div", "econ-gauge-face");
  plate.style.backgroundImage = `url("${IMAGES}econ-gauge-cycle.png")`;
  const needle = el("div", "econ-gauge-needle");
  needle.style.backgroundImage = `url("${IMAGES}econ-gauge-needle.png")`;
  const degrees = Math.round(-90 + 180 * clamp01(share));
  needle.setAttribute("data-degrees", String(degrees));
  const before = needles.get(id);
  needle.style.transform = `rotate(${before ?? -90}deg)`;
  if (before !== degrees) sweep(needle, degrees);
  needles.set(id, degrees);
  dial.appendChild(plate);
  dial.appendChild(needle);
  return dial;
}

/**
 * Turns the needle to its reading on the next frame, so the CSS transition draws the sweep; at once without frames.
 * @param {HTMLElement} needle
 * @param {number} degrees
 */
function sweep(needle, degrees) {
  const set = () => { needle.style.transform = `rotate(${degrees}deg)`; };
  const frame = /** @type {any} */ (globalThis).requestAnimationFrame;
  if (typeof frame === "function") frame(() => frame(set));
  else set();
}

/**
 * A slim horizontal scale for a share: a filled bar to the reading, the model's own limit marked where it has one,
 * the ends labelled, the reading in words beside it. Past the limit the bar turns coral and the reading says so.
 * @param {{ title: string, share: number, reading: string, low: string, high: string, limit?: number | null,
 *   limitLabel?: string, sub?: string, tooltip?: string }} q `share` and `limit` from 0 to 1 of the scale
 */
export function meter({ title, share, reading, low, high, limit = null, limitLabel, sub, tooltip }) {
  const node = el("div", "econ-meter");
  const head = el("div", "econ-meter-head");
  head.appendChild(el("div", "econ-meter-title", title));
  const over = limit !== null && share > limit;
  head.appendChild(el("div", `econ-meter-reading${over ? " econ-negative" : ""}`, reading));
  node.appendChild(head);
  node.appendChild(meterTrack(share, limit, over));
  const ends = el("div", "econ-meter-ends");
  ends.appendChild(el("div", "", low));
  if (limitLabel) ends.appendChild(el("div", "econ-meter-limit-label", limitLabel));
  ends.appendChild(el("div", "", high));
  node.appendChild(ends);
  if (sub) node.appendChild(el("div", "econ-stat-sub", sub));
  return tip(node, tooltip);
}

/**
 * The meter's bar: filled to the reading, the limit marked.
 * @param {number} share
 * @param {number | null} limit
 * @param {boolean} over
 */
function meterTrack(share, limit, over) {
  const track = el("div", "econ-meter-track");
  const fill = el("div", `econ-meter-fill${over ? " econ-meter-fill--over" : ""}`);
  fill.style.width = `${(100 * clamp01(share)).toFixed(1)}%`;
  track.appendChild(fill);
  if (limit !== null) {
    const mark = el("div", "econ-meter-limit");
    mark.style.left = `${(100 * clamp01(limit)).toFixed(1)}%`;
    track.appendChild(mark);
  }
  return track;
}

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attributes
 */
function svgEl(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

const CHART_W = 300;
const CHART_H = 100;

/** @typedef {{ values: (number | null)[], tone: "gilt" | "ivory", label?: string }} Series */

/**
 * A line chart over turns. Every series is laid against the same list of turns (`turns`), one value or null per
 * turn, so two series always compare the same turn. The chart shows its scale (the high and low figures at the
 * left, the first and last turn under it), a legend where it names its series, a reference line where one means
 * something (zero for a balance, 1.00 for an index), and a readout under it naming each series' figure for the turn
 * under the pointer or in focus, the last turn until then. Values that aren't finite are left out and break the
 * line; a lone point is a dot; with nothing to draw it says `emptyText`.
 * @param {{ values: (number | null | undefined)[], tone?: "gilt" | "ivory", label?: string }[]} series
 * @param {{ format: (value: number) => string, turns: string[], reference?: number | null, height?: string,
 *   emptyText?: string }} options
 */
export function lineChart(series, { format, turns, reference = null, height = "7rem", emptyText = "" }) {
  const clean = cleanSeries(series, turns);
  const values = /** @type {number[]} */ (clean.flatMap((one) => one.values).filter((v) => v !== null));
  const wrap = el("div", "econ-chart-wrap");
  if (!values.length) { wrap.appendChild(empty(emptyText)); return wrap; }
  const readout = el("div", "econ-chart-readout");
  wrap.appendChild(chartBody(clean, { scale: chartScale(values, reference, turns.length), reference, height, turns,
    format }, readout));
  wrap.appendChild(chartTurns(turns));
  wrap.appendChild(readout);
  readout.textContent = readoutText(clean, turns, format, lastWithData(clean, turns.length));
  if (clean.some((one) => one.label)) wrap.appendChild(legend(clean));
  return wrap;
}

/**
 * The scale figures at the left and the chart with its hover columns.
 * @param {Series[]} series
 * @param {{ scale: { top: number, bottom: number, span: number, count: number }, reference: number | null,
 *   height: string, turns: string[], format: (value: number) => string }} q
 * @param {HTMLElement} readout
 */
function chartBody(series, { scale, reference, height, turns, format }, readout) {
  const body = el("div", "econ-chart-body");
  body.appendChild(chartAxis(scale, format));
  const node = el("div", "econ-chart");
  node.style.height = height;
  node.appendChild(chartSvg(series, scale, reference));
  node.appendChild(chartHits(series, turns, format, readout));
  body.appendChild(node);
  return body;
}

/**
 * Each series laid on the turns, with anything that isn't a finite number made a gap.
 * @param {{ values: (number | null | undefined)[], tone?: "gilt" | "ivory", label?: string }[]} series
 * @param {string[]} turns
 * @returns {Series[]}
 */
function cleanSeries(series, turns) {
  return series.map((one, index) => ({ label: one.label, tone: one.tone || (index === 0 ? "gilt" : "ivory"),
    values: turns.map((_, k) => {
      const v = one.values[k];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }) }));
}

/**
 * The drawing: the reference line, then each series.
 * @param {Series[]} series
 * @param {{ top: number, bottom: number, span: number, count: number }} scale
 * @param {number | null} reference
 */
function chartSvg(series, scale, reference) {
  const svg = svgEl("svg", { viewBox: `0 0 ${CHART_W} ${CHART_H}`, preserveAspectRatio: "none",
    class: "econ-chart-svg" });
  if (reference !== null) {
    const at = chartY(scale, reference).toFixed(1);
    svg.appendChild(svgEl("line", { x1: 0, x2: CHART_W, y1: at, y2: at, stroke: "#8a8578", "stroke-width": 1 }));
  }
  for (const one of series) drawSeries(svg, one, scale, reference);
  return svg;
}

/**
 * The chart's scale: its high and low, never a flat line (a constant series gets a band around it), the reference
 * inside it when there is one.
 * @param {number[]} values
 * @param {number | null} reference
 * @param {number} count
 */
function chartScale(values, reference, count) {
  let top = Math.max(...values, reference ?? -Infinity);
  let bottom = Math.min(...values, reference ?? Infinity);
  if (top - bottom < 1e-9) {
    const pad = Math.max(1, Math.abs(top) * 0.05);
    top += pad;
    bottom -= pad;
  }
  return { top, bottom, span: top - bottom, count: Math.max(2, count) };
}

/** @param {{ top: number, span: number }} scale @param {number} v */
const chartY = (scale, v) => 6 + ((scale.top - v) * (CHART_H - 12)) / scale.span;
/** @param {{ count: number }} scale @param {number} k */
const chartX = (scale, k) => (k * CHART_W) / (scale.count - 1);

/** The last turn any series has a figure for. @param {Series[]} series @param {number} count */
function lastWithData(series, count) {
  for (let k = count - 1; k >= 0; k -= 1) if (series.some((one) => one.values[k] !== null)) return k;
  return 0;
}

/**
 * The figures at the top and bottom of the scale, at the chart's left.
 * @param {{ top: number, bottom: number }} scale
 * @param {(value: number) => string} format
 */
function chartAxis(scale, format) {
  const axis = el("div", "econ-chart-axis");
  axis.appendChild(el("div", "", format(scale.top)));
  axis.appendChild(el("div", "", format(scale.bottom)));
  return axis;
}

/** The first and last turn under the chart. @param {string[]} turns */
function chartTurns(turns) {
  const foot = el("div", "econ-chart-turns");
  foot.appendChild(el("div", "", turns[0]));
  if (turns.length > 1) foot.appendChild(el("div", "", turns[turns.length - 1]));
  return foot;
}

/**
 * One series: the gilt one with a soft fill down to the reference (or the bottom), the others an ivory line; a lone
 * point is a dot. A gap (null) breaks the line.
 * @param {Element} svg
 * @param {Series} one
 * @param {{ top: number, bottom: number, span: number, count: number }} scale
 * @param {number | null} reference
 */
function drawSeries(svg, one, scale, reference) {
  const gilt = one.tone === "gilt";
  const colour = gilt ? "#D0B270" : "#EAE0CD";
  /** @type {{ x: number, y: number }[][]} */
  const runs = [[]];
  one.values.forEach((v, k) => {
    if (v === null) runs.push([]);
    else runs[runs.length - 1].push({ x: chartX(scale, k), y: chartY(scale, v) });
  });
  for (const run of runs.filter((r) => r.length)) {
    if (run.length === 1) {
      svg.appendChild(svgEl("circle", { cx: run[0].x.toFixed(1), cy: run[0].y.toFixed(1), r: 2.5, fill: colour }));
      continue;
    }
    const points = run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    if (gilt) {
      const base = chartY(scale, reference ?? scale.bottom).toFixed(1);
      svg.appendChild(svgEl("polygon", { points: `${run[0].x.toFixed(1)},${base} ${points} `
        + `${run[run.length - 1].x.toFixed(1)},${base}`, fill: colour, "fill-opacity": 0.14, stroke: "none",
      class: "econ-series-fill" }));
    }
    svg.appendChild(svgEl("polyline", { points, fill: "none", stroke: colour, "stroke-width": gilt ? 2.2 : 1.5,
      "stroke-opacity": gilt ? 1 : 0.8, class: gilt ? "econ-series-gilt" : "econ-series-ivory" }));
  }
}

/**
 * The columns over the chart, one per turn: hovering or focusing one shows that turn's figures in the readout.
 * @param {Series[]} series
 * @param {string[]} turns
 * @param {(value: number) => string} format
 * @param {HTMLElement} readout
 */
function chartHits(series, turns, format, readout) {
  const hits = el("div", "econ-chart-hits");
  turns.forEach((_, k) => {
    const cell = el("div", "econ-chart-hit");
    cell.setAttribute("tabindex", "-1");
    const text = readoutText(series, turns, format, k);
    tip(cell, text);
    const show = () => { readout.textContent = text; };
    cell.addEventListener("mouseenter", show);
    cell.addEventListener("focus", show);
    hits.appendChild(cell);
  });
  return hits;
}

/**
 * "Turn 54: With your loans 120, Without them 80".
 * @param {Series[]} series
 * @param {string[]} turns
 * @param {(value: number) => string} format
 * @param {number} k
 */
function readoutText(series, turns, format, k) {
  const parts = series.filter((one) => one.values[k] !== null)
    .map((one) => `${one.label ? `${one.label} ` : ""}${format(/** @type {number} */ (one.values[k]))}`);
  return `${turns[k]}: ${parts.join(", ")}`;
}

/**
 * The legend: a swatch of each series' colour and its name.
 * @param {Series[]} series
 */
function legend(series) {
  const node = el("div", "econ-legend");
  for (const one of series) {
    const item = el("div", "econ-legend-item");
    const swatch = el("div", "econ-legend-swatch");
    swatch.style.backgroundColor = one.tone === "gilt" ? "#D0B270" : "#EAE0CD";
    item.appendChild(swatch);
    item.appendChild(el("div", "", one.label || ""));
    node.appendChild(item);
  }
  return node;
}

/**
 * The projection chart: the balance with the loans and without them over the coming turns, zero marked.
 * @param {number[]} withLoans
 * @param {number[]} without
 * @param {{ format: (cents: number) => string, turns: string[], withLabel: string, withoutLabel: string }} q
 */
export function projectionChart(withLoans, without, { format, turns, withLabel, withoutLabel }) {
  return lineChart([{ values: withLoans, tone: "gilt", label: withLabel },
    { values: without, tone: "ivory", label: withoutLabel }], { format, turns, reference: 0, height: "8rem" });
}

/** Rows opened to show their parts, by id, kept across re-renders. @type {Set<string>} */
const opened = new Set();

/**
 * A total that opens to show its parts. The head says which way it goes in words as well as by the arrow.
 * @param {string} id
 * @param {HTMLElement} head the row with the total
 * @param {() => HTMLElement[]} parts
 * @param {() => void} rerender
 * @param {{ show: string, hide: string }} [words]
 */
export function expander(id, head, parts, rerender, words) {
  const open = opened.has(id);
  const node = el("div", `econ-expand${open ? " econ-expand--open" : ""}`);
  const top = control("econ-expand-head", () => {
    if (opened.has(id)) opened.delete(id);
    else opened.add(id);
    rerender();
  });
  top.setAttribute("aria-expanded", open ? "true" : "false");
  top.appendChild(el("div", "econ-expand-arrow img-arrow"));
  top.appendChild(head);
  if (words) top.appendChild(el("div", "econ-expand-word", open ? words.hide : words.show));
  node.appendChild(top);
  if (open) {
    const body = el("div", "econ-expand-body");
    for (const part of parts()) body.appendChild(part);
    node.appendChild(body);
  }
  return node;
}

/** What the player is confirming, by id, kept across re-renders. @type {string | null} */
let confirmingId = null;

/** @param {string | null} id */
export function setConfirming(id) {
  confirmingId = id;
}

/** @param {string} id */
export function isConfirming(id) {
  return confirmingId === id;
}

/**
 * The confirmation an action opens in place, under the control that opened it: what it does, now against after for
 * the figures it moves, and a confirm and a cancel. The confirm runs once, however fast it's pressed.
 * @param {{ title: string, lines: HTMLElement[], confirm: string, cancel: string, warning?: boolean,
 *   onConfirm: () => void, rerender: () => void }} q
 */
export function confirmCard({ title, lines, confirm, cancel, warning = false, onConfirm, rerender }) {
  const node = el("div", `econ-confirm${warning ? " econ-confirm--warning" : ""}`);
  node.appendChild(el("div", "econ-confirm-title font-title", title));
  for (const line of lines) node.appendChild(line);
  const actions = el("div", "econ-actions");
  let done = false;
  actions.appendChild(button(confirm, () => {
    if (done) return;
    done = true;
    confirmingId = null;
    onConfirm();
    rerender();
  }, { className: warning ? "econ-button--warning" : "econ-button--primary" }));
  actions.appendChild(button(cancel, () => { confirmingId = null; rerender(); }, { className: "econ-button--quiet" }));
  node.appendChild(actions);
  return node;
}

/** The line shown after an action, by the place on the tab it belongs to, once.
 * @type {{ at: string, text: string, ok: boolean } | null} */
let feedback = null;

/**
 * Says what an action did, next to where it was taken (`at`, the place's id; "top" for the top of the tab).
 * @param {string} text
 * @param {{ at?: string, ok?: boolean }} [options]
 */
export function say(text, { at = "top", ok = true } = {}) {
  feedback = { at, text, ok };
}

/**
 * The line for this place, cleared once taken; null when there's none for it.
 * @param {string} [at]
 */
export function takeFeedback(at = "top") {
  if (!feedback || feedback.at !== at) return null;
  const text = feedback.text;
  feedback = null;
  return text;
}

/**
 * The feedback line for a place as an element, or null.
 * @param {string} at
 */
export function feedbackLine(at) {
  const ok = feedback?.ok !== false;
  const text = takeFeedback(at);
  return text ? el("div", `econ-feedback${ok ? "" : " econ-feedback--failed"}`, text) : null;
}

/** Test hook. */
export function resetDomStateForTests() {
  opened.clear();
  needles.clear();
  confirmingId = null;
  feedback = null;
}
