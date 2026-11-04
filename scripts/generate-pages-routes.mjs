import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist");
const html = await readFile(path.join(output, "index.html"));
const catalog = JSON.parse(await readFile(path.join(output, "data/catalog.json"), "utf8"));
const routes = ["about", ...catalog.games.map((game) => `game/${game.id}`)];

for (const route of routes) {
  const directory = path.join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), html);
}

await copyFile(path.join(output, "index.html"), path.join(output, "404.html"));
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Generated ${routes.length} direct GitHub Pages routes.`);
