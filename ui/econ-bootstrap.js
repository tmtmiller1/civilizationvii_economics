// econ-bootstrap.js - Economics: the game-scope entry script. In 0.1.0 it only says it loaded, so the load check
// (Modding.log, UI.log) has a line to find; prompt 4 hangs the turn batch, the ledger and the screens off it.
// Every engine read is guarded: a missing global at boot is logged, never thrown.

import { logLine } from "./econ-log.js";

const VERSION = "0.1.0";

function announce() {
  const multiplayer = (() => {
    try { return Configuration.getGame().isAnyMultiplayer === true; } catch (_error) { return false; }
  })();
  // Single-player writes only (DESIGN section 9): in multiplayer the mod says once that it is off and does nothing.
  logLine(multiplayer ? `v${VERSION} loaded; multiplayer game, the mod is off` : `v${VERSION} loaded; nothing runs yet`);
}

try {
  if (typeof engine !== "undefined" && engine.whenReady) engine.whenReady.then(announce);
  else announce();
} catch (error) {
  logLine(`boot failed: ${error instanceof Error ? error.message : String(error)}`);
}
