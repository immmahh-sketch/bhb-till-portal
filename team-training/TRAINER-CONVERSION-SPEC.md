# Converting a BHB 10-minute trainer into a Team Training session

The venue already has 78 paper "10-minute trainers" (BHB-10MT-01 to 78): a page of reading ("What you need to know") and 10 questions marked against an answer sheet. Each one becomes one session in the Team Training tile. The parsed originals are in `team-training/source/trainers.json` (fields: code, title, for, body (paragraphs), questions (n, type tf/mc/short, q, options, answer)). Read `SESSION-SPEC.md` first for the session file format and the diagram types, then follow the changes below. Output file: `sessions/10mt-NN.json` where NN is the trainer number (e.g. BHB-10MT-04 -> `10mt-04.json`, `"key": "10mt-04"`).

## Faithful, not creative
- The trainer is the venue's own approved material. **Teach what the trainer says, in the same facts and figures.** Turn the paragraphs into slides: a short title, a few plain lines, and a diagram where it helps (cards, steps, two, ladder, matrix, bars, stats, pills). Do not add new rules, numbers or claims that are not in the trainer. You may reword for clarity and split into slides.
- If you believe a statement in the trainer is wrong or out of date in the law of England in October 2026, **do not silently change it**: keep it as the trainer says unless it is clearly dangerous or clearly wrong, soften the wording if needed, and record it in `legalNotes` as "CHECK: ..." so the GM can confirm. Put ordinary sourcing notes in `legalNotes` too ("From BHB-10MT-NN").
- Venue-specific facts the trainer leaves to "your manager" go in `siteNotes`.

## The session
- `"key": "10mt-NN"`, `"title"` as in the trainer, `"code": "BHB-10MT-NN"`, `"icon"`: one fitting emoji, `"blurb"`: one plain sentence (under 22 words) saying what the module covers, `"group"`: one of `Health and safety`, `Food safety`, `Guest service`, `Security`, `People and wellbeing`, `Working in the venue`, `First aid and emergencies`.
- Cards: 1 hero slide ("By the end of this session you can:" with 3 bullets from the trainer), then 3 to 6 teaching slides, then a "Remember" slide (3 to 5 rules, taken from the trainer). That is 5 to 8 slides in all. Every teaching slide should have a diagram unless it is text that reads best as a short list.
- Then **exactly the trainer's 10 questions, in the same order, as `check` cards**:
  - `tf` -> `{ "kind":"check","type":"tf","q":..., "answer": true|false, "why":... }` (same statement, same answer; the answer sheet says True/False).
  - multiple choice (a/b/c) -> `{ "type":"choice", "options":[...], "answer": index }`, same options and the same right answer. You may add a fourth plausible wrong option; you may reorder options.
  - short answer ("write your answer") -> `{ "type":"choice" }` with 4 options: the model answer (tidied, short) as the right one and three plausible but wrong answers a staff member might give. Wrong options must be wrong according to the trainer and similar in length to the right one.
  - Every check needs a `why` (one or two sentences, drawn from the trainer's text). Do not let the right answer be the longest option.
  - Keep the question wording from the trainer (light tidying only).
- Pass mark 8 of 10 (the validator and player handle it).

## Check
Run `node team-training/validate.mjs 10mt-NN ...` for your sessions until each prints OK (the "right answer is the longest" warning must be cleared too). Also check by eye that each check's right answer matches the answer sheet in `trainers.json`. Do not edit any file except your own session files.
