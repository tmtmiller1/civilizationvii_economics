// site-descriptions.mjs - writes the descriptions for the other mod sites from the Steam one, so they say the same
// thing: docs/civfanatics-description.txt (XenForo BBCode, uppercase tags, sizes for headings) and
// docs/moddb-description.txt (plain text, headings on their own lines, "- " bullets, bare links). The short versions
// (docs/*-short.txt, the CivFanatics tag line) are written by hand. Run after changing the Steam text:
//   node scripts/site-descriptions.mjs

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "docs/steam-workshop-description.txt";
const steam = readFileSync(SOURCE, "utf8");

/**
 * Steam BBCode to XenForo BBCode, as CivFanatics' forum and downloads use it.
 * @param {string} text
 */
export function toCivFanatics(text) {
  return text
    .replace(/\[h1\](.*?)\[\/h1\]/g, "[SIZE=6][B]$1[/B][/SIZE]")
    .replace(/\[h2\](.*?)\[\/h2\]/g, "[SIZE=5][B]$1[/B][/SIZE]")
    .replace(/\[b\]/g, "[B]").replace(/\[\/b\]/g, "[/B]")
    .replace(/\[list\]/g, "[LIST]").replace(/\[\/list\]/g, "[/LIST]")
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/g, "[URL='$1']$2[/URL]");
}

/**
 * Steam BBCode to plain text for ModDB.
 * @param {string} text
 */
export function toPlain(text) {
  return text
    .replace(/\[h1\](.*?)\[\/h1\]/g, "$1")
    .replace(/\[h2\](.*?)\[\/h2\]/g, "$1")
    .replace(/\[\/?b\]/g, "")
    .replace(/\[list\]\n?/g, "").replace(/\n?\[\/list\]/g, "")
    .replace(/^\[\*\]/gm, "- ")
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/g, "$1");
}

writeFileSync("docs/civfanatics-description.txt", toCivFanatics(steam));
writeFileSync("docs/moddb-description.txt", toPlain(steam));
console.log("wrote docs/civfanatics-description.txt and docs/moddb-description.txt from", SOURCE);
