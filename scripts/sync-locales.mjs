// sync-locales.mjs - keeps the eleven translation files in step with text/en_us/ModText.xml and
// text/en_us/EconomicsPedia.xml (the Civilopedia pages): every English tag
// appears once in each, under the folder's Language. A row whose English hasn't changed since the last run keeps
// what the language has (a translation, or the placeholder); a new tag, or one whose English changed, gets the new
// English as its placeholder, so a translation of the old meaning never ships under the new one. The English each
// row was last synced from is kept in scripts/locale-baseline.json (text/README.md). Run after changing English:
//   node scripts/sync-locales.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASELINE = "scripts/locale-baseline.json";
const LANGUAGES = { de_de: "de_DE", es_es: "es_ES", fr_fr: "fr_FR", it_it: "it_IT", ja_jp: "ja_JP", ko_kr: "ko_KR",
  pl_pl: "pl_PL", pt_br: "pt_BR", ru_ru: "ru_RU", zh_cn: "zh_Hans_CN", zh_hk: "zh_Hant_HK" };

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function texts(xml) {
  const out = [];
  for (const m of xml.matchAll(/<(?:Row|Replace)\s+Tag="([A-Z0-9_]+)"[^>]*>\s*<Text>([\s\S]*?)<\/Text>/g)) out.push([m[1], m[2]]);
  return out;
}


/** The English files synced into every language, each with its own baseline of the English last synced from. */
const FILES = [{ name: "ModText.xml", baseline: BASELINE, note: "text/en_us/ModText.xml" },
  { name: "EconomicsPedia.xml", baseline: "scripts/locale-baseline-pedia.json", note: "text/en_us/EconomicsPedia.xml" }];

for (const file of FILES) syncFile(file);

/** @param {{ name: string, baseline: string, note: string }} file */
function syncFile({ name, baseline: baselinePath, note }) {
  const english = texts(read(`text/en_us/${name}`));
  const baseline = readBaselineAt(baselinePath);
  const changed = (tag, text) => baseline !== null && baseline.get(tag) !== text;
  for (const [folder, language] of Object.entries(LANGUAGES)) {
    const file = `text/${folder}/${name}`;
    const have = new Map(fs.existsSync(path.join(root, file)) ? texts(read(file)) : []);
    const rows = english.map(([tag, text]) => {
      const kept = have.get(tag);
      const value = kept !== undefined && !changed(tag, text) ? kept : text;
      return `        <Replace Tag="${tag}" Language="${language}"><Text>${value}</Text></Replace>`;
    });
    const body = `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${language}: English placeholders until the translation pass (prompt 5). Every tag in ${note}\n     appears here once, under this Language, with the same placeholders. -->\n<Database>\n    <LocalizedText>\n${rows.join("\n")}\n    </LocalizedText>\n</Database>\n`;
    fs.writeFileSync(path.join(root, file), body);
    console.log(`${file}: ${rows.length} rows`);
  }
  fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(Object.fromEntries(english), null, 1)}\n`);
  console.log(`${baselinePath}: ${english.length} rows`);
}

/** @param {string} file */
function readBaselineAt(file) {
  try {
    return new Map(Object.entries(JSON.parse(read(file))));
  } catch (_error) {
    // No baseline yet: every row counts as unchanged, so what the languages hold is kept.
    return null;
  }
}
