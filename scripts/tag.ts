import OpenAI from 'openai';
import type { ArxivCandidate, TaggedFields } from './schema';

const client = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * System prompt narrowed to **3D hair** research specifically.
 * Accepts hair / beard / fur reconstruction, simulation, generation, relighting.
 * Rejects generic head-avatar / face / body work that only mentions hair in passing.
 */
const SYSTEM = `You tag 3D-hair-research papers for a curated archive.

Return STRICT JSON matching this exact schema:

{
  "is_hair_paper": boolean,         // true iff the paper's CENTRAL contribution is 3D hair (or beard/fur) reconstruction, strand modeling, generation, simulation/dynamics, relighting, rendering, or editing/grooming. Reject: generic head/face avatar with hair as a side effect, full-body avatars, hand/scene reconstruction, 2D hairstyle transfer in image space only, hair-color change w/o 3D, NLP, robotics, etc.
  "reject_reason": string,          // empty if accepted; else short reason
  "short": string,                  // method short name, e.g. "NeuralHDHair" or "HairStep". Kebab-case ok if no explicit name.
  "tags": string[],                 // 2-5 concise keywords. Pick from these axes when applicable:
                                    //   representation: {"Strand","Mesh","NeRF","3DGS","SDF","Implicit","Volume","Hybrid"}
                                    //   capture: {"Monocular","Multi-view","Studio","Single-image","Sketch","Text"}
                                    //   capability: {"Reconstruction","Generation","Simulation","Relightable","Editing","Grooming","Rendering","Dynamics"}
                                    //   subject: {"Hair","Beard","Fur"}
  "contribution": string,           // one-line key novelty ("First X that does Y via Z")
  "summary": string,                // neutral paraphrased abstract, <= 400 chars
  "importance": 1|2|3|4|5,          // 1=minor, 3=solid venue quality, 5=field-defining SOTA
  "code_hint": boolean,             // true if the abstract mentions code/project page release
  "project_url_hint": string        // empty if unknown; else a URL if the abstract mentions one explicitly
}

Rules:
- Accept ONLY when the MAIN target is 3D hair (or beard/fur). Reject general head-avatar papers that include hair only because the head has hair.
- Tags array must have 2-5 items.
- Output ONLY the JSON object. No prose, no fences.`;

export async function tagPaper(paper: ArxivCandidate): Promise<TaggedFields | null> {
  const userBody = JSON.stringify({
    title: paper.title,
    authors: paper.authors,
    published: paper.published,
    abstract: paper.abstract,
    arxiv_id: paper.id,
    primary_category: paper.primaryCategory,
  });

  const resp = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 900,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userBody },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? '';
  const json = extractJson(text);
  if (!json) {
    console.error('[tag] no JSON from model for', paper.id);
    return null;
  }

  return {
    is_hair_paper: Boolean(json.is_hair_paper),
    reject_reason: typeof json.reject_reason === 'string' ? json.reject_reason : undefined,
    short: String(json.short ?? paper.id),
    tags: Array.isArray(json.tags) ? json.tags.map(String).slice(0, 5) : [],
    contribution: String(json.contribution ?? ''),
    summary: String(json.summary ?? '').slice(0, 400),
    importance: clampImportance(json.importance),
    code_hint: Boolean(json.code_hint),
    project_url_hint: typeof json.project_url_hint === 'string' ? json.project_url_hint : undefined,
  };
}

function clampImportance(v: unknown): TaggedFields['importance'] {
  const n = Number(v);
  if (n >= 1 && n <= 5 && Number.isInteger(n)) return n as TaggedFields['importance'];
  return 2;
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
