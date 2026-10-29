// econ-dom.js - Economics: the small DOM pieces the three tabs are built from, in the shapes the game's own panels
// draw with (flex rows, the red status pill of Strategic Resources' sr-pill.js). GameFace has no grid, no italic and
// drops `border-color: var()`, so every look here is a class in econ-screen.css or a literal inline style.

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

/**
 * A titled block.
 * @param {string} title
 * @param {HTMLElement[]} [children]
 */
export function section(title, children = []) {
  const node = el("div", "econ-section");
  node.appendChild(el("div", "econ-section-title font-title text-base uppercase", title));
  for (const child of children) node.appendChild(child);
  return node;
}

/**
 * A label on the left, a value on the right.
 * @param {string} label
 * @param {string} value
 * @param {string} [valueClass]
 */
export function row(label, value, valueClass = "") {
  const node = el("div", "econ-row");
  node.appendChild(el("div", "econ-row-label", label));
  node.appendChild(el("div", `econ-row-value ${valueClass}`.trim(), value));
  return node;
}

/** @param {string} text */
export function note(text) {
  return el("div", "econ-note text-sm", text);
}

/**
 * A clickable button; `disabled` greys it and drops the click.
 * @param {string} caption
 * @param {() => void} onClick
 * @param {{ disabled?: boolean, className?: string }} [options]
 */
export function button(caption, onClick, { disabled = false, className = "" } = {}) {
  const node = el("div", `econ-button ${className}`.trim(), caption);
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "-1");
  if (disabled) node.classList.add("econ-button--disabled");
  else node.addEventListener("click", () => onClick());
  return node;
}

/**
 * A row of choices, the chosen one highlighted.
 * @param {{ id: string, label: string }[]} items
 * @param {string} chosen
 * @param {(id: string) => void} onPick
 */
export function chips(items, chosen, onPick) {
  const node = el("div", "econ-chips");
  for (const item of items) {
    const chip = el("div", `econ-chip${item.id === chosen ? " econ-chip--on" : ""}`, item.label);
    chip.addEventListener("click", () => onPick(item.id));
    node.appendChild(chip);
  }
  return node;
}

/**
 * The red status pill (memory: status text as a red pill), or the plain one.
 * @param {string} text
 * @param {boolean} warning
 */
export function pill(text, warning) {
  const node = el("div", "econ-pill font-body text-sm", text);
  const look = warning ? { border: "1px solid #FF7A66", background: "#A8201A", color: "#FFF3E3" }
    : { border: "1px solid #53565D", background: "#23252b", color: "#E5D2AC" };
  node.style.border = look.border;
  node.style.background = look.background;
  node.style.color = look.color;
  return node;
}

/**
 * A stepper for a Gold amount: minus and plus buttons around the value, in steps of 10 and 100 Gold.
 * @param {{ value: number, min: number, max: number, onChange: (cents: number) => void,
 *   format: (cents: number) => string }} q
 */
export function goldStepper({ value, min, max, onChange, format }) {
  const node = el("div", "econ-stepper");
  const clamp = (/** @type {number} */ cents) => Math.max(min, Math.min(max, cents));
  for (const step of [-10000, -1000]) node.appendChild(button(step === -10000 ? "-100" : "-10",
    () => onChange(clamp(value + step)), { className: "econ-button--small" }));
  node.appendChild(el("div", "econ-stepper-value", format(value)));
  for (const step of [1000, 10000]) node.appendChild(button(step === 10000 ? "+100" : "+10",
    () => onChange(clamp(value + step)), { className: "econ-button--small" }));
  return node;
}

/**
 * A simple bar chart of balances over turns, two series, drawn as flex columns (no SVG hit-testing needed).
 * @param {number[]} withLoans
 * @param {number[]} without
 * @param {(cents: number) => string} format
 */
export function projectionChart(withLoans, without, format) {
  const node = el("div", "econ-chart");
  const all = [...withLoans, ...without, 0];
  const top = Math.max(...all);
  const bottom = Math.min(...all);
  const span = Math.max(1, top - bottom);
  const column = (/** @type {number} */ cents, /** @type {string} */ className) => {
    const bar = el("div", `econ-bar ${className}`);
    bar.style.height = `${Math.max(2, Math.round((100 * (cents - bottom)) / span))}%`;
    bar.setAttribute("data-tooltip-content", format(cents));
    return bar;
  };
  for (let k = 0; k < withLoans.length; k += 1) {
    const pair = el("div", "econ-bar-pair");
    pair.appendChild(column(withLoans[k], "econ-bar--with"));
    pair.appendChild(column(without[k] ?? withLoans[k], "econ-bar--without"));
    node.appendChild(pair);
  }
  return node;
}
