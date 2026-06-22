# 🦱 hairxiv

A self-updating, hand-curatable field guide to research on **3D hair** — reconstructing, simulating, relighting, and generating digital hair. One horizontally-scrolling page, one card per paper.

Live at ritteannti818.github.io/hairxiv

The site reads like a mid-century archival index. Years are vertical columns along a timeline; every paper is a filed card with a conference-colored tab. Hover a card to peek at its abstract, authors, teaser, and links; click to pin it. The chip row toggles venues on and off, and a small panel swaps palette, background, font, and density.

## What's here

- **Only hair-focused 3D research.** Full head, face, and body avatars and generic 3D reconstruction are filtered out at tagging time, so the signal stays dense. Beard and fur are included — same underlying techniques.
- **The whole pipeline.** Geometry reconstruction, strand-level modeling, appearance and relighting, simulation and dynamics, generation, editing and grooming, rendering.
- **Every card links out.** arXiv page, project website, code repo, and one-click BibTeX.

## How it stays alive

The archive updates itself end-to-end — no human merge required. Every scheduler commits straight to the main branch and triggers a redeploy.

- **Weekly** — a crawler pulls new arXiv submissions matching the hair query set, the LLM tags the ones that genuinely belong, and they are promoted into the archive automatically.
- **Monthly** — scrapers re-resolve venues from conference lists, walk each project page for its stated conference and code repo, and refresh author-curated teaser images.

A preprint posted on a Tuesday shows up the following Monday. Once it is accepted to a venue, the tag recolors within a month of the list going public.

## Curating by hand

Automation only ever adds — it dedupes by arXiv link and never overwrites. To fix a mis-tagged entry, edit it directly and push; the next deploy reflects the change.

## Run locally

```bash
npm install
npm run dev      # localhost:3000
npm run build    # static export
```

## Fork it for your own topic

This repo is really a paper-archive generator. Point it at another field by changing three things: the arXiv query set, the LLM tagging criteria, and the branding. The automation carries over unchanged.
