// sync-tax-cards.mjs - writes the tax cards' amounts from ui/econ-tax-cards.js (CARD_LEVELS) into the places the
// game reads them: the Amount arguments of the cards' modifiers and the comment above each card in
// data/econ-tax-gameeffects.xml, and the amounts in each card's description row in every text file. A card with an
// `atWar` part (War Levy) has a second pair of modifiers, MOD_ECONOMICS_<level>_AT_WAR_GOLD and _HAPPINESS, with their
// own comment, and its description names the peacetime amounts first and the at-war totals second. Change the
// numbers in CARD_LEVELS, then run:
//   node scripts/sync-tax-cards.mjs           write the files
//   node scripts/sync-tax-cards.mjs --check   exit 1 if a file is out of step (tests/econ-data.test.mjs runs this)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_LEVELS, atWarAmounts } from "../ui/econ-tax-cards.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EFFECTS = "data/econ-tax-gameeffects.xml";
const TITLES = { LIGHT: "Light Taxation", HEAVY: "Heavy Taxation", WAR_LEVY: "War Levy" };

/** @param {number} amount */
const signed = (amount) => (amount > 0 ? `+${amount}` : String(amount));

/**
 * The effects file with each modifier's Amount and each card's comment set from CARD_LEVELS.
 * @param {string} xml
 */
export function syncEffects(xml) {
  let out = xml;
  /**
   * @param {string} id
   * @param {number} amount
   */
  const setAmount = (id, amount) => {
    // The modifier's own Amount, after any requirements block: War Levy's war requirement carries an Amount of its
    // own (how many wars), which must stay at 1.
    const pattern = new RegExp(`(<Modifier id="${id}"[^>]*>`
      + "(?:\\s*<OwnerRequirements>[\\s\\S]*?</OwnerRequirements>)?[\\s\\S]*?<Argument name=\"Amount\">)"
      + "(-?\\d+)(</Argument>)");
    out = out.replace(pattern, (_m, head, _old, tail) => `${head}${amount}${tail}`);
  };
  /**
   * @param {string} title
   * @param {{ gold: number, happiness: number }} part
   */
  const setComment = (title, part) => {
    const comment = new RegExp(`(<!-- ${title}:[^>]*?Gold )[+-]?\\d+(, Happiness )[+-]?\\d+`);
    out = out.replace(comment, (_m, head, mid) => `${head}${signed(part.gold)}${mid}${signed(part.happiness)}`);
  };
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    setAmount(`MOD_ECONOMICS_${level}_GOLD`, card.gold);
    setAmount(`MOD_ECONOMICS_${level}_HAPPINESS`, card.happiness);
    const title = TITLES[/** @type {keyof typeof TITLES} */ (level)];
    setComment(title, card);
    if (card.atWar) {
      setAmount(`MOD_ECONOMICS_${level}_AT_WAR_GOLD`, card.atWar.gold);
      setAmount(`MOD_ECONOMICS_${level}_AT_WAR_HAPPINESS`, card.atWar.happiness);
      setComment(`${title} at war`, card.atWar);
    }
  }
  return out;
}

/**
 * A text file with the amounts in each card's description row set from CARD_LEVELS. Only a number written right
 * before "Gold" or "Happiness" is touched (a trailing % from the old percentage cards goes too), so a translation
 * that puts the words first is left for its translator.
 * @param {string} xml
 */
export function syncDescriptions(xml) {
  let out = xml;
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    const row = new RegExp(`(Tag="LOC_ECONOMICS_CARD_${level}_DESCRIPTION"[^>]*><Text>)([^<]*)(</Text>)`);
    // The peacetime amounts first, then (War Levy) the at-war totals, each in the order the text names them.
    const war = card.atWar ? atWarAmounts(level) : null;
    const golds = [card.gold, ...(war ? [war.gold] : [])];
    const joys = [card.happiness, ...(war ? [war.happiness] : [])];
    out = out.replace(row, (_m, head, text, tail) => {
      let g = 0;
      let h = 0;
      const synced = String(text)
        .replace(/[+-]?\d+%? Gold/g, (word) => (g < golds.length ? `${signed(golds[g++])} Gold` : word))
        .replace(/[+-]?\d+%? Happiness/g, (word) => (h < joys.length ? `${signed(joys[h++])} Happiness` : word));
      return `${head}${synced}${tail}`;
    });
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
