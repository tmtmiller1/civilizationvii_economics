// econ-log.js - Economics: one place for log lines, tagged [Economics]. console.log never reaches UI.log in the
// game's runtime; console.error does, so every line goes out that way. DBG gates the chatty lines and release.sh
// forces it to false in the shipped copy.

const DBG = true;
const TAG = "[Economics]";

/**
 * A line the player or a log reader should always see: boot, a refused write, a setting read back wrong.
 * @param {string} message
 */
export function logLine(message) {
  console.error(`${TAG} ${message}`);
}

/**
 * A line for development only: per-turn plan sizes, timings, the odd branch taken.
 * @param {string} message
 */
export function logDebug(message) {
  if (DBG) console.error(`${TAG} ${message}`);
}
