// econ-dock.js - Economics: the dock button that opens the Economics screen, and the status pill beside it (DESIGN
// 9's top-bar pill: outstanding debt, red in default). The subsystem dock is the one HUD host a Tower mod has
// decorated and watched (Demographics, Emigration: Controls.decorate on panel-sub-system-dock, addButton with a
// modifier class painted through a CSS mask), so the pill rides the same decoration until a top-bar host is watched.
// The icon is a shipped SVG file: Coherent's CSS parser drops data: URIs in a background image.

import { openScreen } from "./econ-screen.js";
import { pill } from "./econ-dom.js";
import { logDebug, logLine } from "./econ-log.js";
import { getSetting } from "./econ-settings.js";

// The game serves a mod's files under its mod id, not its folder name (engine-closed, "UI context has no fetch").
const ICON_URL = "fs://game/tower-economics/images/econ-dock-icon.svg";
const ICON_TINT = "#ecdfbf";
const STYLE_ID = "econ-dock-icon-style";

/** @type {HTMLElement | null} */
let pillNode = null;
/** @type {(() => { text: string, warning: boolean }) | null} */
let pillSource = null;

function injectIconStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `.ssb__button-icon.economics { background-image: none; background-color: ${ICON_TINT};`
    + ` mask-image: url("${ICON_URL}"); mask-size: 64%; mask-position: center; mask-repeat: no-repeat; }`;
  document.head.appendChild(style);
}

/** Redraws the pill from its source; called after each batch and when the screen acts. */
export function refreshPill() {
  if (!pillNode || !pillSource) return;
  const { text, warning } = pillSource();
  const fresh = pill(text, warning);
  fresh.classList.add("econ-dock-pill");
  // The game's page has no Element.replaceWith (engine-closed); swap through the parent.
  const parent = pillNode.parentNode;
  if (parent) parent.replaceChild(fresh, pillNode);
  pillNode = fresh;
}

class EconomicsDockDecorator {
  /** @param {any} panel */
  constructor(panel) {
    this.panel = panel;
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
      this.mountPill(node);
    } catch (error) {
      logLine(`dock button: ${error}`);
    }
  }

  /** @param {any} buttonNode */
  mountPill(buttonNode) {
    const parent = buttonNode && buttonNode.parentElement;
    if (!parent || !pillSource) return;
    pillNode = pill("", false);
    pillNode.classList.add("econ-dock-pill");
    parent.appendChild(pillNode);
    refreshPill();
  }

  beforeDetach() {}

  afterDetach() {
    pillNode = null;
  }
}

/**
 * Registers the dock decorator; `source` gives the pill's text and colour whenever it's redrawn.
 * @param {() => { text: string, warning: boolean }} source
 */
export function installDock(source) {
  pillSource = source;
  try {
    if (typeof Controls !== "undefined" && typeof Controls.decorate === "function") {
      Controls.decorate("panel-sub-system-dock", (/** @type {any} */ panel) => new EconomicsDockDecorator(panel));
      logDebug("dock decorator registered");
    }
  } catch (error) {
    logLine(`Controls.decorate failed: ${error}`);
  }
}
