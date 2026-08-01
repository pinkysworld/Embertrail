#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { banned } = JSON.parse(readFileSync(join(root, "tools/banned-ip-terms.json"), "utf8"));
const exts = new Set([".ts", ".tsx", ".js", ".json", ".md", ".html", ".css"]);
const skipDirs = new Set(["node_modules", ".git", "dist", "assets", "docs", "data"]);
const roots = ["apps", "packages"].map((d) => join(root, d));

const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (skipDirs.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p);
    else if (exts.has(extname(name))) {
      const text = readFileSync(p, "utf8");
      for (const term of banned) {
        if (term.length <= 3) continue;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp("(?:^|[^\\w])" + escaped + "(?:$|[^\\w])", "i");
        if (re.test(text)) hits.push({ file: p, term });
      }
    }
  }
}

for (const r of roots) walk(r);
if (hits.length) {
  console.error("Banned IP terms found:");
  for (const h of hits) console.error(`  ${h.term} in ${h.file}`);
  process.exit(1);
}
console.log("IP scan clean.");
