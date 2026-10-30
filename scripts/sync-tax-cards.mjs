// sync-tax-cards.mjs - writes the tax cards' amounts from ui/econ-tax-cards.js (CARD_LEVELS) into the places the
// game reads them: the Amount arguments of the cards' modifiers and the comment above each card in
// data/econ-tax-gameeffects.xml, and the amounts in each card's description row in every text file. A card with an
// `atWar` part (War Levy) has a second pair of modifiers, MOD_ECONOMICS_<level>_AT_WAR_GOLD and _HAPPINESS, with their
// own comment, and its description names the peacetime amounts first and the at-war totals second. An amount that
// differs by age (Light's Happiness) is written into one modifier per age, MOD_ECONOMICS_<level>_<yield>_<age>, under
// a comment "<title> in <age name>", and into one description row per age,
// LOC_ECONOMICS_CARD_<level>_DESCRIPTION_<age>.
// Which modifiers and description each age's card points at is checked by tests/econ-data.test.mjs. Change the
// numbers in CARD_LEVELS, then run:
//   node scripts/sync-tax-cards.mjs           write the files
//   node scripts/sync-tax-cards.mjs --check   exit 1 if a file is out of step (tests/econ-data.test.mjs runs this)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGE_SUFFIXES, CARD_LEVELS, amountIn, atWarAmounts, cardAmounts, descriptionKey } from "../ui/econ-tax-cards.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EFFECTS = "data/econ-tax-gameeffects.xml";
const TITLES = { LIGHT: "Light Taxation", HEAVY: "Heavy Taxation", WAR_LEVY: "War Levy" };
const AGE_NAMES = { AQ: "Antiquity", EX: "Exploration", MO: "Modern" };

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
   * The comment titled `title`: each number after "Gold " or "Happiness " in it set from `part`, where it has that
   * yield.
   * @param {string} title
   * @param {{ gold?: number, happiness?: number }} part
   */
  const setComment = (title, part) => {
    const comment = new RegExp(`<!-- ${title}:[^>]*?-->`);
    out = out.replace(comment, (text) => text
      .replace(/Gold [+-]?\d+/, (word) => (part.gold === undefined ? word : `Gold ${signed(part.gold)}`))
      .replace(/Happiness [+-]?\d+/, (word) => (part.happiness === undefined ? word : `Happiness ${signed(part.happiness)}`)));
  };
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    const title = TITLES[/** @type {keyof typeof TITLES} */ (level)];
    /** @type {{ gold?: number, happiness?: number }} */
    const shared = {};
    for (const [key, name] of /** @type {const} */ ([["gold", "GOLD"], ["happiness", "HAPPINESS"]])) {
      const amount = card[key];
      if (typeof amount === "number") {
        setAmount(`MOD_ECONOMICS_${level}_${name}`, amount);
        shared[key] = amount;
        continue;
      }
      for (const age of AGE_SUFFIXES) {
        setAmount(`MOD_ECONOMICS_${level}_${name}_${age}`, amountIn(amount, age));
        setComment(`${title} in ${AGE_NAMES[age]}`, { [key]: amountIn(amount, age) });
      }
    }
    setComment(title, shared);
    if (card.atWar) {
      setAmount(`MOD_ECONOMICS_${level}_AT_WAR_GOLD`, card.atWar.gold);
      setAmount(`MOD_ECONOMICS_${level}_AT_WAR_HAPPINESS`, card.atWar.happiness);
      setComment(`${title} at war`, card.atWar);
    }
  }
  return out;
}

/**
 * A text file with the amounts in each card's description row set from CARD_LEVELS, one row per age for a card whose
 * amounts differ by age. Only a number written right before "Gold" or "Happiness" is touched (a trailing % from the old
 * percentage cards goes too), so a translation that puts the words first is left for its translator.
 * @param {string} xml
 */
export function syncDescriptions(xml) {
  let out = xml;
  for (const level of Object.keys(CARD_LEVELS)) {
    const rows = new Map(AGE_SUFFIXES.map((age) => [descriptionKey(level, age), age]));
    for (const [key, age] of rows) {
      const row = new RegExp(`(Tag="${key}"[^>]*><Text>)([^<]*)(</Text>)`);
      // The peacetime amounts first, then (War Levy) the at-war totals, each in the order the text names them.
      const peace = cardAmounts(level, age);
      const war = CARD_LEVELS[level].atWar ? atWarAmounts(level, age) : null;
      const golds = [peace.gold, ...(war ? [war.gold] : [])];
      const joys = [peace.happiness, ...(war ? [war.happiness] : [])];
      out = out.replace(row, (_m, head, text, tail) => {
        let g = 0;
        let h = 0;
        const synced = String(text)
          .replace(/[+-]?\d+%? Gold/g, (word) => (g < golds.length ? `${signed(golds[g++])} Gold` : word))
          .replace(/[+-]?\d+%? Happiness/g, (word) => (h < joys.length ? `${signed(joys[h++])} Happiness` : word));
        return `${head}${synced}${tail}`;
      });
    }
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
