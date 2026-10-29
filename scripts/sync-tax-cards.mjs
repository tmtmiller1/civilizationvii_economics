// sync-tax-cards.mjs - writes the tax cards' percentages from ui/econ-tax-cards.js (CARD_LEVELS) into the places the
// game reads them: the Percent arguments of the cards' modifiers and the comment above each card in
// data/econ-tax-gameeffects.xml, and the percentages in each card's description row in every text file. Change the
// numbers in CARD_LEVELS, then run:
//   node scripts/sync-tax-cards.mjs           write the files
//   node scripts/sync-tax-cards.mjs --check   exit 1 if a file is out of step (tests/econ-data.test.mjs runs this)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_LEVELS } from "../ui/econ-tax-cards.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EFFECTS = "data/econ-tax-gameeffects.xml";
const TITLES = { LIGHT: "Light Taxation", HEAVY: "Heavy Taxation", WAR_LEVY: "War Levy" };

/** @param {number} pct */
const signed = (pct) => (pct > 0 ? `+${pct}` : String(pct));

/**
 * The effects file with each modifier's Percent and each card's comment set from CARD_LEVELS.
 * @param {string} xml
 */
export function syncEffects(xml) {
  let out = xml;
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    for (const [kind, pct] of [["GOLD", card.goldPct], ["HAPPINESS", card.happinessPct]]) {
      const pattern = new RegExp(`(<Modifier id="MOD_ECONOMICS_${level}_${kind}"[\\s\\S]*?<Argument name="Percent">)`
        + "(-?\\d+)(</Argument>)");
      out = out.replace(pattern, (_m, head, _old, tail) => `${head}${pct}${tail}`);
    }
    const title = TITLES[/** @type {keyof typeof TITLES} */ (level)];
    const comment = new RegExp(`(<!-- ${title}:[^>]*?Gold )[+-]?\\d+%(, Happiness )[+-]?\\d+%`);
    out = out.replace(comment, (_m, head, mid) => `${head}${signed(card.goldPct)}%${mid}${signed(card.happinessPct)}%`);
  }
  return out;
}

/**
 * A text file with the percentages in each card's description row set from CARD_LEVELS. Only a number written
 * right before "Gold" or "Happiness" is touched, so a translation that puts the words first is left for its
 * translator.
 * @param {string} xml
 */
export function syncDescriptions(xml) {
  let out = xml;
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    const row = new RegExp(`(Tag="LOC_ECONOMICS_CARD_${level}_DESCRIPTION"[^>]*><Text>)([^<]*)(</Text>)`);
    out = out.replace(row, (_m, head, text, tail) => `${head}${String(text)
      .replace(/[+-]?\d+% Gold/, `${signed(card.goldPct)}% Gold`)
      .replace(/[+-]?\d+% Happiness/, `${signed(card.happinessPct)}% Happiness`)}${tail}`);
  }
  return out;
}

/** Every file the numbers live in, relative to the project root. */
export function syncedFiles() {
  const texts = fs.readdirSync(path.join(root, "text"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "text", entry.name, "ModText.xml")))
    .map((entry) => `text/${entry.name}/ModText.xml`);
  return [EFFECTS, ...texts.sort()];
}

/**
 * The files whose text differs from what CARD_LEVELS gives, with their synced text.
 * @returns {{ file: string, text: string }[]}
 */
export function outOfStep() {
  const out = [];
  for (const file of syncedFiles()) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const synced = file === EFFECTS ? syncEffects(text) : syncDescriptions(text);
    if (synced !== text) out.push({ file, text: synced });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stale = outOfStep();
  if (process.argv.includes("--check")) {
    for (const { file } of stale) console.log(`out of step with CARD_LEVELS: ${file}`);
    process.exitCode = stale.length ? 1 : 0;
  } else {
    for (const { file, text } of stale) {
      fs.writeFileSync(path.join(root, file), text);
      console.log(`${file}: updated`);
    }
    if (!stale.length) console.log("every file already matches CARD_LEVELS");
  }
}
