// i18n.test.mjs - every string a player sees can be translated: every LOC_ key the code, data, setup SQL and modinfo
// use has English text; no tag is defined twice; each translation folder holds exactly the English tags under the
// right Language with the same {placeholders}; and the modinfo lists every text file that exists.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const files = (dir, ext) => (fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f)) : []);

export const LANGUAGES = {
  de_de: "de_DE", es_es: "es_ES", fr_fr: "fr_FR", it_it: "it_IT", ja_jp: "ja_JP", ko_kr: "ko_KR",
  pl_pl: "pl_PL", pt_br: "pt_BR", ru_ru: "ru_RU", zh_cn: "zh_Hans_CN", zh_hk: "zh_Hant_HK",
};

/** Base-game keys the mod uses without defining. */
const BASE_KEYS = new Set(["LOC_MODULE_BASE_STANDARD_NAME", "LOC_UI_CONTENT_MGR_SUBTITLE",
  "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION"]);

function textsIn(paths) {
  const out = new Map();
  const dups = [];
  for (const p of paths) {
    for (const m of read(p).matchAll(/<(?:Row|Replace)\s+Tag="([A-Z0-9_]+)"[^>]*>\s*<Text>([\s\S]*?)<\/Text>/g)) {
      if (out.has(m[1])) dups.push(m[1]);
      out.set(m[1], m[2]);
    }
  }
  return { texts: out, dups };
}

const english = textsIn(files("text/en_us", ".xml"));

test("no English tag is defined twice", () => {
  assert.deepEqual(english.dups, []);
});

test("every LOC_ key the code, data, setup SQL and modinfo use has English text", () => {
  const used = new Set();
  const sources = [...files("ui", ".js"), ...files("data", ".xml"), ...files("data", ".sql"), ...files("config", ".sql"),
    "economics.modinfo"].filter((f) => !f.endsWith("settings-keeper.js"));
  // A stem the code completes, or a prefix in a comment, continues with "_" and something that isn't a key character.
  for (const f of sources) {
    const text = read(f);
    for (const m of text.matchAll(/LOC_[A-Z0-9_]*[A-Z0-9]/g)) if (text[m.index + m[0].length] !== "_") used.add(m[0]);
  }
  const missing = [...used].filter((k) => !english.texts.has(k) && !BASE_KEYS.has(k));
  assert.deepEqual(missing, []);
});

test("every tag is LOC_ECONOMICS_ (the names table) and every English text is non-empty", () => {
  for (const [tag, text] of english.texts) {
    // The Options screen names a mod's group by the game's own pattern, LOC_OPTIONS_GROUP_<group>; the Civilopedia
    // resolves its chapter text by its own convention, LOC_PEDIA_<section>_PAGE_<page>_CHAPTER_... (econ-pedia.test).
    if (tag !== "LOC_OPTIONS_GROUP_ECONOMICS") assert.match(tag, /^LOC_(ECONOMICS|PEDIA)_[A-Z0-9_]+$/, tag);
    assert.ok(text.trim().length > 0, `${tag} is empty`);
  }
});

test("each translation holds exactly the English tags, under its Language, with the English placeholders", () => {
  const placeholders = (s) => [...s.matchAll(/\{\d+_[A-Za-z]+\}/g)].map((m) => m[0]).sort();
  for (const [folder, language] of Object.entries(LANGUAGES)) {
    const paths = files(`text/${folder}`, ".xml");
    assert.ok(paths.length >= 1, `${folder} ships ModText`);
    const t = textsIn(paths);
    assert.deepEqual(t.dups, [], `${folder} duplicates`);
    assert.deepEqual([...t.texts.keys()].sort(), [...english.texts.keys()].sort(), `${folder} tags`);
    for (const p of paths) {
      const langs = new Set([...read(p).matchAll(/Language="([A-Za-z_]+)"/g)].map((m) => m[1]));
      assert.deepEqual([...langs], [language], p);
    }
    for (const [tag, text] of t.texts) {
      assert.deepEqual(placeholders(text), placeholders(english.texts.get(tag)), `${folder} ${tag}`);
    }
  }
});

test("the modinfo lists every text file that exists and nothing else", () => {
  const modinfo = read("economics.modinfo");
  for (const folder of ["en_us", ...Object.keys(LANGUAGES)]) {
    for (const f of files(`text/${folder}`, ".xml")) assert.ok(modinfo.includes(f), f);
  }
  for (const m of modinfo.matchAll(/>(text\/[a-z_]+\/[A-Za-z]+\.xml)</g)) assert.ok(fs.existsSync(path.join(root, m[1])), m[1]);
});
