/**
 * Merge `src/data/candidates.json` into `src/data/papers.json`,
 * deduping by arXiv URL. Sort newest-first by (year, month).
 *
 * Run: `npm run promote`           — merge + write
 *      `npm run promote -- --dry`  — preview only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Paper } from '../src/types/paper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAPERS = path.join(ROOT, 'src', 'data', 'papers.json');
const CANDIDATES = path.join(ROOT, 'src', 'data', 'candidates.json');

const DRY = process.argv.includes('--dry');

function load(p: string): Paper[] {
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Paper[];
}

const existing = load(PAPERS);
const candidates = load(CANDIDATES);

if (candidates.length === 0) {
  console.log('[promote] no candidates to merge.');
  process.exit(0);
}

const seen = new Set(existing.map((p) => p.arxiv));
const fresh = candidates.filter((p) => !seen.has(p.arxiv));
const merged = [...existing, ...fresh].sort(
  (a, b) => b.year - a.year || b.month - a.month,
);

console.log(
  `[promote] papers=${existing.length}  candidates=${candidates.length}  new=${fresh.length}  → ${merged.length}`,
);

if (fresh.length > 0) {
  console.log('[promote] new entries:');
  for (const p of fresh) console.log(`  + ${p.short.padEnd(24)} ${p.year}-${String(p.month).padStart(2, '0')}  ${p.title.slice(0, 70)}`);
}

if (DRY) {
  console.log('[dry] no file written.');
  process.exit(0);
}

fs.writeFileSync(PAPERS, JSON.stringify(merged, null, 2) + '\n');
console.log(`[write] ${PAPERS}`);
