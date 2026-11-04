import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist");
const site = (process.env.SITE_URL || "https://nicobrenner.github.io/project24").replace(/\/$/, "");
const template = await readFile(path.join(output, "index.html"), "utf8");
const catalog = JSON.parse(await readFile(path.join(output, "data/catalog.json"), "utf8"));

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Attribute order survives vite's HTML minifier, but do not rely on it: match the whole
// tag, then swap its content. A missing tag is a build failure rather than a silent
// page that previews as the home page.
function setAttribute(html, pattern, attribute, value) {
  const found = html.match(pattern);
  if (!found) throw new Error(`generate-pages-routes: no tag matching ${pattern} in index.html`);
  const re = new RegExp(`${attribute}="[^"]*"`);
  if (!re.test(found[0])) throw new Error(`generate-pages-routes: ${found[0]} has no ${attribute}`);
  const updated = found[0].replace(re, `${attribute}="${escapeHtml(value)}"`);
  return html.replace(pattern, () => updated);
}

const setMeta = (html, attribute, name, value) =>
  setAttribute(html, new RegExp(`<meta[^>]*\\s${attribute}="${name}"[^>]*>`, "i"), "content", value);

const clamp = (text, limit) => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, flat.lastIndexOf(" ", limit - 1)).replace(/[,.;:]$/, "") + "…";
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const article = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");

// 421 of the 859 catalogue descriptions are bare Wikidata or Show HN stubs ("1997 video
// game"), which makes a poor share preview. Those pages have a genre and a year, so say
// that instead. Everything else keeps the catalogue's own sentence.
const YEAR_STUB = /^\s*(?:(\d{4})\s+)?video game\s*\.?\s*$/i;
const SHOW_HN_STUB = /independently made game introduced in this Hacker News Show HN submission/i;

function lead(game) {
  const description = (game.description || "").trim();
  const stub = YEAR_STUB.exec(description);
  const genre = game.genre && !YEAR_STUB.test(game.genre) ? game.genre : "video game";
  if (stub) {
    const year = stub[1] || String(game.releaseDate || "").slice(0, 4);
    const noun = `${article(genre)} ${genre}`;
    return year ? `${game.title}, ${noun} from ${year}.` : `${game.title}, ${noun}.`;
  }
  if (SHOW_HN_STUB.test(description)) {
    return `${game.title}, an independently made ${genre} first shown on Hacker News as a Show HN.`;
  }
  return description;
}

// Mirrors the page's own caution: these are collected, context-filtered counts, not a
// claim about the whole archive.
function describe(game) {
  const bits = [];
  if (game.discussionCount) bits.push(plural(game.discussionCount, "collected HN mention"));
  if (game.verifiedRecommendations)
    bits.push(plural(game.verifiedRecommendations, "reviewed recommendation"));
  const evidence = bits.length
    ? `${bits.join(", ")}, with links to the original threads.`
    : "With links to the original Hacker News threads.";
  return clamp(`${lead(game)} ${evidence}`, 200);
}

function page(html, { title, description, url }) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
  next = setAttribute(next, /<link[^>]*\srel="canonical"[^>]*>/i, "href", url);
  next = setMeta(next, "name", "description", description);
  next = setMeta(next, "property", "og:url", url);
  next = setMeta(next, "property", "og:title", title);
  next = setMeta(next, "property", "og:description", description);
  next = setMeta(next, "name", "twitter:title", title);
  next = setMeta(next, "name", "twitter:description", description);
  return next;
}

const pages = [
  {
    route: "about",
    title: "How the index works — PROJECT 24",
    description: clamp(catalog.coverage.description, 200),
  },
  ...catalog.games.map((game) => ({
    route: `game/${game.id}`,
    title: `${game.title} — PROJECT 24`,
    description: describe(game),
  })),
];

for (const { route, title, description } of pages) {
  const directory = path.join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "index.html"),
    page(template, { title, description, url: `${site}/${route}/` }),
  );
}

// The home page keeps the template's own tags; only its absolute URLs need the site.
const home = template
  .replaceAll("https://nicobrenner.github.io/project24", site)
  .replace(/\s+$/, "\n");
await writeFile(path.join(output, "index.html"), home);
// 404.html is the SPA fallback, so it must not claim to be a page of its own.
await copyFile(path.join(output, "index.html"), path.join(output, "404.html"));
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Generated ${pages.length} direct GitHub Pages routes with per-route metadata.`);
