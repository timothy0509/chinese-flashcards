import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "answers.md"), "utf-8").split("\n");

const chapters = [];
let current = "";
const cards = [];
const errors = [];

for (let i = 0; i < src.length; i++) {
  const line = src[i].trim();
  if (line.startsWith("## ")) {
    current = line.replace(/^##\s*/, "").trim();
    chapters.push({ name: current, count: 0 });
    continue;
  }
  const m = line.match(/^(\d+)\.\s*(.+)$/);
  if (!m) continue;
  if (!current) {
    errors.push(`line ${i + 1}: entry before any chapter`);
    continue;
  }
  const num = Number(m[1]);
  const rest = m[2];
  const sep = rest.match(/(｜|\|)\s*答案\s*[:：]/);
  if (!sep || sep.index === undefined) {
    errors.push(`line ${i + 1}: missing 答案 separator`);
    continue;
  }
  const left = rest.slice(0, sep.index).trim();
  const answer = rest.slice(sep.index + sep[0].length).trim();
  const termMatch = left.match(/\*\*(.+?)\*\*/);
  if (!termMatch) {
    errors.push(`line ${i + 1}: missing **term**`);
    continue;
  }
  const term = termMatch[1].trim();
  const sentence = left.replaceAll("**", "").trim();
  if (!sentence || !term || !answer) {
    errors.push(`line ${i + 1}: empty field`);
    continue;
  }
  const chapterIndex = chapters.length - 1;
  cards.push({
    id: `${chapterIndex + 1}-${num}`,
    chapter: current,
    num,
    sentence,
    term,
    answer,
  });
  chapters[chapters.length - 1].count += 1;
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const outDir = join(root, "src", "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "cards.json"), JSON.stringify(cards, null, 2) + "\n", "utf-8");
writeFileSync(join(outDir, "chapters.json"), JSON.stringify(chapters, null, 2) + "\n", "utf-8");
console.log(`wrote ${cards.length} cards across ${chapters.length} chapters`);
