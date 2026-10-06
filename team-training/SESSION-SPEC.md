# Team Training: how a session is written

Each session is one JSON file in `team-training/sessions/<key>.json`, played one card at a time on a phone (10 to 15 minutes), in the Black Horse Beamish house style. The session list, audiences and legal basis are in `sessions/index.json`; read your sessions' entries first.

## The file

```json
{
  "key": "slips-trips-falls",
  "title": "Slips, trips and falls",
  "version": 1,
  "siteNotes": ["Things only the venue can fill in, for the GM to confirm, e.g. the assembly point"],
  "legalNotes": ["Each rule you state, with the regulation it comes from. Flag anything you are not certain of."],
  "cards": [
    { "kind": "slide", "layout": "hero", "kicker": "Everyone · 10 minutes", "title": "Slips, trips and falls",
      "body": "By the end of this session you can:\n- spot the common causes\n- act on a hazard straight away\n- report it" },
    { "kind": "slide", "kicker": "Why it matters", "title": "...", "body": "...", "visual": { "type": "cards", "items": [] } },
    { "kind": "check", "type": "choice", "q": "...", "options": ["A", "B", "C", "D"], "answer": 1, "why": "One or two sentences that teach." },
    { "kind": "check", "type": "tf", "q": "...", "answer": false, "why": "..." },
    { "kind": "check", "type": "multi", "q": "Which TWO ...?", "options": ["A", "B", "C", "D", "E"], "answer": [0, 3], "why": "..." }
  ]
}
```

## Shape of a session
- Card 1: a `hero` slide: the title and "By the end of this session you can:" with 3 bullets.
- 6 to 8 teaching slides: short, concrete, in plain words. About 40 to 80 words each, plus a diagram on most.
- One `Remember` slide with the 3 to 5 rules to take away.
- Then exactly **10 knowledge checks** (`kind: "check"`), mostly short real-life scenarios, mixing `choice` (4 options), `tf` and at most two `multi`. Between them they must cover every teaching slide, and no two may test the same point.
- Pass mark is 80%, so 8 of 10; anyone who scores less repeats the session. Every check needs a `why`.

## Slide fields
- `kicker`: small label above the title. `title`: short. `body`: text, using the mini-markup below.
- `layout`: omit for a normal slide; `hero` for the first card only.
- `visual`: optional diagram, as data. Types and their data (see `assets/train-visuals.js` in the live-quiz repo for the full set):
  - `cards`: `{ "type": "cards", "cols": 3, "items": [{ "icon": "👣", "title": "...", "text": "...", "tone": "sage" }] }`
  - `steps`: `{ "type": "steps", "cols": 4, "items": [{ "title": "...", "text": "...", "tone": "sage" }] }` (numbered, in order)
  - `two`: `{ "type": "two", "left": { "title": "Do", "tone": "sage", "mark": "tick", "items": ["..."] }, "right": { "title": "Do not", "tone": "clay", "mark": "cross", "items": ["..."] } }`
  - `ladder`: `{ "type": "ladder", "items": [{ "title": "...", "text": "...", "tone": "sage" }] }` (bottom to top, calm to serious)
  - `matrix`: `{ "type": "matrix", "yAxis": "...", "xAxis": "...", "cells": { "tl": {...}, "tr": {...}, "bl": {...}, "br": {...} } }` (each cell `{ "title", "text", "tone" }`)
  - `bars`: `{ "type": "bars", "items": [{ "label": "...", "v": 40, "note": "...", "tone": "gold" }], "caption": "Illustrative" }`
  - `stats`: `{ "type": "stats", "items": [{ "big": "5", "label": "...", "tone": "sage" }] }`
  - `pills`: `{ "type": "pills", "items": ["...", "..."] }`
  - Tones: `sage`, `gold`, `clay`, `slate`, `celadon`, `ink`. Use `clay` for danger and `sage` for safe.
  - 2 to 6 items per diagram, each text under about 14 words. Icons are single emoji.
- Body mini-markup: lines starting `- ` are bullets; `✔ ` and `✘ ` make tick and cross lists; `## ` is a small heading; `> ` is a boxed callout; `**bold**` works anywhere.

## Writing rules
- British English. Plain, direct, kind. Written for hotel, restaurant, bar, kitchen, housekeeping, wedding and events staff at a venue in County Durham. Use their world: guests, rooms, the pass, the cellar, the marquee, the bar, a wedding breakfast.
- Teach what the law and good practice actually require. **Do not invent figures, dates, penalties or regulation numbers.** State only what you are confident is correct, and put each rule's source in `legalNotes`. If you are unsure of a detail, leave it out and say so in `legalNotes`.
- Anything that depends on this venue (where the assembly point is, who the first aiders are, which cleaning products are used) is written as "your manager will show you" and listed in `siteNotes`. Never make up local facts or names.
- Do not write "UK" or "in the UK" or explain what everyone already knows. No filler like "it is important to note". Do not give the answer away in the question or make the right answer the longest.
- Every check must test something the slides taught. Wrong answers must be tempting and realistic, not silly. Vary which option is right.
- The tone is respectful: this is for every member of the team, including those new to the work.

## Check your work
Run `node team-training/validate.mjs <key> [<key>...]` from the repo root. It must print OK for each of your sessions.
