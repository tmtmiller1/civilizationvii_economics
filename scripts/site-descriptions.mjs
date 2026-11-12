// site-descriptions.mjs - writes the descriptions for the other mod sites from the Steam one, so they say the same
// thing: docs/civfanatics-description.txt (XenForo BBCode, uppercase tags, sizes for headings) and
// docs/moddb-description.txt (plain text, headings on their own lines, "- " bullets, bare links) and
// docs/github-release.md (Markdown, the GitHub release body). The short versions
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

// The GitHub release body opens with the preview image at the release's tag, as the other Tower mods' releases do.
const TAG = "v1.0.0";
const REPO = "tmtmiller1/civilizationvii_economics";
const GITHUB_HEAD = `<p align="center"><img src="https://raw.githubusercontent.com/${REPO}/${TAG}/docs/workshop-preview.png" `
  + `alt="Economics" width="200"></p>\n\nThis is the mod's first release.\n\n`;

/**
 * Steam BBCode to Markdown for the GitHub release (its title is docs/github-release-title.txt).
 * @param {string} text
 */
export function toGitHub(text) {
  const body = text
    .replace(/\[h1\].*?\[\/h1\]\n+/, "")
    .replace(/\[h2\](.*?)\[\/h2\]/g, "## $1")
    // A blank line after a list, or the next line joins the list's last item.
    .replace(/\[list\]\n?/g, "").replace(/\[\/list\]\n?(?=\S)/g, "\n").replace(/\[\/list\]\n?/g, "")
    .replace(/\[\*\]/g, "- ")
    .replace(/\[b\](.*?)\[\/b\]/g, "**$1**")
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/g, "[$2]($1)");
  return `${GITHUB_HEAD}${body}`;
}

writeFileSync("docs/civfanatics-description.txt", toCivFanatics(steam));
writeFileSync("docs/moddb-description.txt", toPlain(steam));
writeFileSync("docs/github-release.md", toGitHub(steam));
console.log("wrote docs/civfanatics-description.txt, docs/moddb-description.txt and docs/github-release.md from", SOURCE);
