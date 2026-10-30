// econ-screen.js - Economics: the Economics screen (DESIGN 9), a base-UI panel (fxs-frame, header, close button)
// pushed through the ContextManager, in the shape of the Demographics and Emigration screens. Defined at load with
// Controls.define (a definition made after startup never initialises on 1.5.0, engine-closed) and opened from the
// dock button or the turn notification. The tab bar is built once and kept across re-renders, since a rebuilt
// fxs-tab-bar flashes its first tab (engine-closed).

import Panel from "/core/ui/panel-support.js";
import { renderTreasury } from "./econ-view-treasury.js";
import { renderLoans } from "./econ-view-loans.js";
import { renderFiscal } from "./econ-view-fiscal.js";
import { renderMarkets } from "./econ-view-markets.js";
import { renderTrade } from "./econ-view-trade.js";
import { renderWorld } from "./econ-view-world.js";
import { el } from "./econ-dom.js";
import { getSetting, setSetting } from "./econ-settings.js";
import { logLine } from "./econ-log.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

export const SCREEN_ID = "screen-economics";
const TABS = [
  { key: "LOC_ECONOMICS_TAB_TREASURY", render: renderTreasury },
  { key: "LOC_ECONOMICS_TAB_LOANS", render: renderLoans },
  { key: "LOC_ECONOMICS_TAB_FISCAL", render: renderFiscal },
  { key: "LOC_ECONOMICS_TAB_MARKETS", render: renderMarkets },
  { key: "LOC_ECONOMICS_TAB_TRADE", render: renderTrade },
  { key: "LOC_ECONOMICS_TAB_WORLD", render: renderWorld },
];

/** @type {ScreenApi | null} */
let screenApi = null;
/** @type {ScreenEconomics | null} */
let openScreenInstance = null;

/** The bootstrap hands the screen what it reads and acts on. @param {ScreenApi} api */
export function setScreenApi(api) {
  screenApi = api;
}

/**
 * @param {{ id: string, label: string }[]} items
 * @param {(index: number) => void} onSelect
 * @param {number} start
 */
function makeTabBar(items, onSelect, start) {
  if (typeof Controls === "undefined") {
    const bar = el("div", "econ-chips");
    items.forEach((item, index) => {
      const chip = el("div", `econ-chip${index === start ? " econ-chip--on" : ""}`, item.label);
      chip.addEventListener("click", () => {
        for (const [k, node] of [...bar.children].entries()) node.classList.toggle("econ-chip--on", k === index);
        onSelect(index);
      });
      bar.appendChild(chip);
    });
    return bar;
  }
  const bar = /** @type {any} */ (document.createElement("fxs-tab-bar"));
  bar.classList.add("w-full", "font-title", "text-sm");
  bar.setAttribute("data-audio-group-ref", "audio-screen-unlocks");
  bar.setAttribute("tab-items", JSON.stringify(items));
  bar.setAttribute("selected-tab-index", String(start));
  bar.setAttribute("tab-item-class", "font-title text-base");
  bar.setAttribute("nav-help-right-class", "relative right-0");
  bar.setAttribute("nav-help-left-class", "relative left-0");
  bar.addEventListener("tab-selected", (/** @type {any} */ event) => {
    const id = event?.detail?.selectedItem?.id;
    if (id != null) onSelect(parseInt(id, 10));
  });
  return bar;
}

class ScreenEconomics extends Panel {
  /** @type {number} */
  tab = 0;

  onInitialize() {
    super.onInitialize?.();
    this.enableOpenSound = true;
    this.enableCloseSound = true;
    try { this.Root?.setAttribute?.("data-audio-group-ref", "audio-screen-unlocks"); } catch (_error) {
      /* the audio cue is optional */
    }
  }

  onAttach() {
    try { super.onAttach?.(); } catch (error) { logLine(`screen attach: ${error}`); }
    openScreenInstance = this;
    this.tab = Number(getSetting("lastTab")) || 0;
    try {
      this.wireClose();
      this.buildTabs();
      this.render();
    } catch (error) {
      logLine(`screen render failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  onDetach() {
    if (openScreenInstance === this) openScreenInstance = null;
    try { super.onDetach?.(); } catch (_error) { /* nothing to release */ }
  }

  wireClose() {
    const close = this.Root?.querySelector?.("fxs-close-button");
    close?.addEventListener?.("action-activate", () => this.close());
  }

  buildTabs() {
    const host = this.Root?.querySelector?.(".econ-tab-host");
    if (!host || !screenApi) return;
    const items = TABS.map((tab, index) => ({ id: String(index), label: screenApi?.loc(tab.key) || tab.key }));
    host.appendChild(makeTabBar(items, (index) => this.selectTab(index), this.tab));
  }

  /** @param {number} index */
  selectTab(index) {
    this.tab = Math.max(0, Math.min(TABS.length - 1, index));
    setSetting("lastTab", this.tab);
    this.render();
  }

  render() {
    const host = /** @type {HTMLElement | null} */ (this.Root?.querySelector?.(".econ-screen-host") ?? null);
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!screenApi) { host.appendChild(el("div", "econ-note", "Economics: no session")); return; }
    try {
      TABS[this.tab].render(host, screenApi);
    } catch (error) {
      logLine(`tab ${this.tab} failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      host.appendChild(el("div", "econ-note econ-negative", screenApi.loc("LOC_ECONOMICS_TAB_FAILED")));
    }
  }

  close() {
    try { super.close?.(); } catch (error) { logLine(`screen close: ${error}`); }
  }
}

try {
  if (typeof Controls !== "undefined" && typeof Controls.define === "function") {
    // Paths are under the mod id, which is how the game serves a mod's files.
    Controls.define(SCREEN_ID, {
      createInstance: ScreenEconomics,
      description: "Economics: the Treasury, Loans, Fiscal, Markets, Trade and World tabs.",
      styles: ["fs://game/tower-economics/ui/econ-screen.css"],
      content: ["fs://game/tower-economics/ui/econ-screen.html"],
      attributes: [],
      classNames: ["econ-screen", "w-full", "h-full"],
    });
  }
} catch (error) {
  logLine(`Controls.define failed: ${error}`);
}

/** Re-draws the open screen's current tab, after an action or a turn. */
export function rerenderScreen() {
  openScreenInstance?.render();
}

/** Opens the screen (pushes it onto the context stack); nothing happens without a context manager. */
export function openScreen() {
  import("/core/ui/context-manager/context-manager.js").then((/** @type {any} */ mod) => {
    const manager = mod.default || mod.ContextManager || mod;
    if (manager && typeof manager.push === "function") manager.push(SCREEN_ID, { singleton: true, createMouseGuard: true });
  }).catch((error) => logLine(`open screen failed: ${error}`));
}
