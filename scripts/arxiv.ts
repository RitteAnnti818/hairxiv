import { XMLParser } from 'fast-xml-parser';
import type { ArxivCandidate } from './schema';

const API = 'http://export.arxiv.org/api/query';

/** Query families narrowed to **3D Hair** research (hair / beard / fur). */
export const QUERY_FAMILIES: string[] = [
  // -- core 3D hair terms --
  'ti:"3D hair"',
  'ti:"hair reconstruction"',
  'abs:"3D hair" AND cat:cs.CV',
  'abs:"3D hair" AND cat:cs.GR',
  'abs:"hair reconstruction" AND cat:cs.CV',
  'abs:"hair modeling" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"hair geometry" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"hair capture" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"hair digitization"',

  // -- strand-based representations --
  'ti:"hair strand"',
  'abs:"hair strand" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"strand-based" AND abs:hair',
  'abs:"strand-level" AND abs:hair',
  'abs:"hair fiber" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"hair growth" AND (abs:3D OR abs:strand)',

  // -- generation / grooming --
  'abs:"hair generation" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"hairstyle" AND (abs:3D OR abs:strand OR abs:gaussian OR abs:nerf)',
  'abs:"hair grooming" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"text-to-hair"',
  'abs:"sketch-based" AND abs:hair',

  // -- gaussian splatting / nerf / implicit · hair --
  'abs:"gaussian" AND abs:hair AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"3D gaussian" AND abs:hair',
  'abs:"NeRF" AND abs:hair AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"neural radiance" AND abs:hair',
  'abs:"implicit" AND abs:hair AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"volumetric" AND abs:hair AND (cat:cs.CV OR cat:cs.GR)',

  // -- single-image / monocular hair --
  'abs:"single-image" AND abs:hair',
  'abs:"single image" AND abs:hair AND (abs:3D OR abs:strand)',
  'abs:"monocular" AND abs:hair',
  'abs:"in-the-wild" AND abs:hair',

  // -- simulation / dynamics / rendering --
  'abs:"hair simulation" AND (cat:cs.GR OR cat:cs.CV)',
  'abs:"hair dynamics" AND (cat:cs.GR OR cat:cs.CV)',
  'abs:"hair rendering" AND cat:cs.GR',
  'abs:"hair shading" AND cat:cs.GR',
  'abs:"hair appearance" AND (cat:cs.GR OR cat:cs.CV)',
  'abs:"hair relighting"',

  // -- editing / parametric --
  'abs:"hair editing" AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"parametric hair"',
  'abs:"PCA" AND abs:hair AND abs:3D',

  // -- beard / fur (same techniques, included on purpose) --
  'abs:beard AND (abs:3D OR abs:strand OR abs:gaussian OR abs:reconstruction) AND (cat:cs.CV OR cat:cs.GR)',
  'abs:"fur" AND (abs:3D OR abs:strand OR abs:simulation OR abs:rendering) AND (cat:cs.CV OR cat:cs.GR)',
];

export interface FetchOptions {
  fromDate: string; // YYYYMMDD
  toDate?: string; // YYYYMMDD
  maxPerQuery?: number;
}

export async function fetchArxivForQuery(
  query: string,
  opts: FetchOptions,
): Promise<ArxivCandidate[]> {
  const to = opts.toDate ?? todayYmd();
  const ranged = `(${query}) AND submittedDate:[${opts.fromDate}0000 TO ${to}2359]`;
  const params = new URLSearchParams({
    search_query: ranged,
    start: '0',
    max_results: String(opts.maxPerQuery ?? 100),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  });
  const url = `${API}?${params.toString()}`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(5000 * Math.pow(2, attempt - 1));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'hair-3d-archive/0.1 (research crawl)' },
      });
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`arxiv HTTP ${res.status}`);
      const xml = await res.text();
      return parseFeed(xml);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error('arxiv: unknown failure');
}

export async function fetchAllFamilies(opts: FetchOptions): Promise<ArxivCandidate[]> {
  const map = new Map<string, ArxivCandidate>();
  for (let i = 0; i < QUERY_FAMILIES.length; i++) {
    const q = QUERY_FAMILIES[i];
    try {
      const rows = await fetchArxivForQuery(q, opts);
      let added = 0;
      for (const r of rows) {
        if (!map.has(r.id)) {
          map.set(r.id, r);
          added++;
        }
      }
      console.log(
        `[arxiv] (${i + 1}/${QUERY_FAMILIES.length}) ${rows.length} hits, ${added} new · ${q}`,
      );
    } catch (err) {
      console.error(`[arxiv] query "${q}" failed:`, (err as Error).message);
    }
    if (i < QUERY_FAMILIES.length - 1) await sleep(6000);
  }
  return [...map.values()].sort((a, b) => b.published.localeCompare(a.published));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseFeed(xml: string): ArxivCandidate[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) =>
      name === 'entry' || name === 'author' || name === 'category' || name === 'link',
  });
  const feed = parser.parse(xml)?.feed;
  if (!feed || !feed.entry) return [];
  return feed.entry.map((e: unknown) => toCandidate(e as Record<string, unknown>));
}

function toCandidate(e: Record<string, unknown>): ArxivCandidate {
  const idUrl = (e.id as string) ?? '';
  const m = idUrl.match(/abs\/([^v]+)(v\d+)?$/);
  const id = m?.[1] ?? idUrl;
  const version = m?.[2] ?? 'v1';
  const authors = ((e.author as Array<{ name?: string }>) ?? [])
    .map((a) => (a?.name ?? '').trim())
    .filter(Boolean);
  const links = (e.link as Array<{ href?: string; title?: string; type?: string }>) ?? [];
  const pdf = links.find((l) => l.title === 'pdf' || l.type === 'application/pdf')?.href;
  const cats =
    ((e.category as Array<{ term?: string }>) ?? [])
      .map((c) => c.term)
      .filter((x): x is string => !!x) ?? [];
  const primaryTerm =
    ((e['arxiv:primary_category'] as { term?: string }) ?? {}).term ?? cats[0] ?? 'cs.CV';
  return {
    id,
    version,
    url: idUrl.replace(/v\d+$/, ''),
    title: String(e.title ?? '').trim().replace(/\s+/g, ' '),
    authors,
    abstract: String(e.summary ?? '').trim().replace(/\s+/g, ' '),
    published: String(e.published ?? ''),
    updated: String(e.updated ?? ''),
    primaryCategory: primaryTerm,
    categories: cats,
    pdfUrl: pdf,
  };
}
