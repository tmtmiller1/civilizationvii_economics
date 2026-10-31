// econ-dock.js - Economics: the dock button that opens the Economics screen, and the status pills (DESIGN 9's
// top-bar pills: the debt while there is one, red in default; the phase; inflation while it runs). The button rides
// the subsystem dock (Demographics, Emigration: Controls.decorate on panel-sub-system-dock, addButton with a modifier
// class painted through a CSS mask). The pill
// sits in the resource bar, in the yield banner's own mod slot after the settlement limit
// (panel-yield-banner.js, #yield-banner-mod-slot). Several views carry their own banner, so each banner gets its own
// pill and a redraw updates them all.
// The icon is a shipped SVG file: Coherent's CSS parser drops data: URIs in a background image.

import { openScreen } from "./econ-screen.js";
import { pill } from "./econ-dom.js";
import { logDebug, logLine } from "./econ-log.js";
import { getSetting } from "./econ-settings.js";
import { loc } from "./econ-engine.js";

// The game serves a mod's files under its mod id, not its folder name (engine-closed, "UI context has no fetch").
const ICON_URL = "fs://game/tower-economics/images/econ-dock-icon.svg";
const ICON_TINT = "#ecdfbf";
const STYLE_ID = "econ-dock-icon-style";

/** Each attached banner's slot and the pill in it. @type {Map<HTMLElement, HTMLElement>} */
const pillNodes = new Map();
/** @typedef {{ text: string, tone: "plain" | "caution" | "warning" }} PillItem */
/** @typedef {{ pills: PillItem[], text: string, warning: boolean }} PillState */
/** @type {(() => PillState) | null} */
let pillSource = null;
/** The dock buttons drawn (one per dock the game attaches). @type {Set<HTMLElement>} */
const dockButtons = new Set();
/** The names of the tabs with something the player hasn't opened yet. @type {(() => string[]) | null} */
let markerSource = null;

function injectIconStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `.ssb__button-icon.economics { background-image: none; background-color: ${ICON_TINT};`
    + ` mask-image: url("${ICON_URL}"); mask-size: 64%; mask-position: center; mask-repeat: no-repeat; }`
    // The unseen marker: a small gold dot on the button's upper right, the way the game marks something new.
    + " .econ-dock-new { position: absolute; top: 0.15rem; right: 0.15rem; width: 0.7rem; height: 0.7rem;"
    + " border-radius: 0.35rem; background-color: #f3c34c; border-top: 1px solid #3a2a10;"
    + " border-right: 1px solid #3a2a10; border-bottom: 1px solid #3a2a10; border-left: 1px solid #3a2a10;"
    + " pointer-events: none; display: none; }"
    + " .econ-dock-new--on { display: flex; }";
  document.head.appendChild(style);
}

/** Shows or hides the dock button's unseen marker, with the tabs it's about in the button's tooltip. */
export function refreshMarker() {
  if (!markerSource) return;
  const tabs = markerSource();
  for (const button of dockButtons) {
    const dot = button.querySelector(".econ-dock-new");
    dot?.classList.toggle("econ-dock-new--on", tabs.length > 0);
    const tip = tabs.length ? loc("LOC_ECONOMICS_DOCK_NEW", tabs.join(", ")) : loc("LOC_ECONOMICS_OPEN");
    button.setAttribute("data-tooltip-content", tip);
  }
}

/** The pill and the marker, after a batch or an action. */
export function refreshDock() {
  refreshPill();
  refreshMarker();
}

/**
 * One row of pills, each coloured on its own (DESIGN 9); an empty row when there's nothing to say.
 * @param {{ text: string, tone: "plain" | "caution" | "warning" }[]} pills
 */
function pillRow(pills) {
  const row = document.createElement("div");
  row.className = "econ-bar-pill econ-bar-pills";
  row.style.display = "flex";
  row.style.alignItems = "center";
  for (const item of pills) {
    const node = pill(item.text, item.tone);
    node.style.marginLeft = "0.35rem";
    row.appendChild(node);
  }
  return row;
}

/** Redraws every banner's pills from their source; called after each batch and when the screen acts. */
export function refreshPill() {
  if (!pillSource) return;
  const { pills } = pillSource();
  for (const [slot, old] of [...pillNodes]) {
    const fresh = pillRow(pills);
    // The game's page has no Element.replaceWith (engine-closed); swap through the parent.
    if (old.parentNode === slot) slot.replaceChild(fresh, old);
    else slot.appendChild(fresh);
    pillNodes.set(slot, fresh);
  }
}

/**
 * Puts the unseen marker on a dock button and keeps the button for refreshMarker.
 * @param {HTMLElement} node
 */
function addMarker(node) {
  const dot = document.createElement("div");
  dot.className = "econ-dock-new";
  node.appendChild(dot);
  dockButtons.add(node);
  refreshMarker();
  return node;
}

class EconomicsDockDecorator {
  /** @param {any} panel */
  constructor(panel) {
    this.panel = panel;
    /** @type {HTMLElement | null} */
    this.button = null;
  }

  beforeAttach() {}

  afterAttach() {
    if (getSetting("dockButton") === false) return;
    try { injectIconStyle(); } catch (error) { logLine(`dock icon style: ${error}`); }
    try {
      if (!this.panel || typeof this.panel.addButton !== "function") { logDebug("dock: no addButton"); return; }
      const node = this.panel.addButton({ tooltip: "LOC_ECONOMICS_OPEN", modifierClass: "economics",
        callback: () => openScreen(), class: ["economics-dock-button"], audio: "data-audio-tab-selected",
        focusedAudio: "data-audio-focus-small" });
      if (!node) { logDebug("dock: addButton returned nothing"); return; }
      this.button = addMarker(node);
    } catch (error) {
      logLine(`dock button: ${error}`);
    }
  }

  beforeDetach() {}

  afterDetach() {
    if (this.button) dockButtons.delete(this.button);
  }
}

class EconomicsBannerDecorator {
  /** @param {any} panel */
  constructor(panel) {
    this.panel = panel;
    /** @type {HTMLElement | null} */
    this.slot = null;
  }

  beforeAttach() {}

  afterAttach() {
    try {
      const root = this.panel && this.panel.Root;
      const slot = root && (root.querySelector("#yield-banner-mod-slot")
        || root.querySelector(".panel-yield__top-bar-content"));
      if (!slot) { logDebug("banner: no mod slot"); return; }
      const node = pillRow([]);
      slot.appendChild(node);
      this.slot = slot;
      pillNodes.set(slot, node);
      refreshPill();
    } catch (error) {
      logLine(`banner pill: ${error}`);
    }
  }

  beforeDetach() {}

  afterDetach() {
    if (this.slot) pillNodes.delete(this.slot);
    this.slot = null;
  }
}

/**
 * Registers the dock decorator; `source` gives the pill's text and colour whenever it's redrawn, `marker` the names
 * of the tabs the player hasn't opened since something new appeared on them.
 * @param {() => PillState} source
 * @param {() => string[]} [marker]
 */
export function installDock(source, marker) {
  pillSource = source;
  markerSource = marker || null;
  try {
    if (typeof Controls !== "undefined" && typeof Controls.decorate === "function") {
      Controls.decorate("panel-sub-system-dock", (/** @type {any} */ panel) => new EconomicsDockDecorator(panel));
      Controls.decorate("panel-yield-banner", (/** @type {any} */ panel) => new EconomicsBannerDecorator(panel));
      logDebug("dock and banner decorators registered");
    }
  } catch (error) {
    logLine(`Controls.decorate failed: ${error}`);
  }
}
