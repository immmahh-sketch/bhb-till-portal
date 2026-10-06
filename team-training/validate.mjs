// Checks session files against the spec in SESSION-SPEC.md.  node team-training/validate.mjs [key ...]   (no keys = all in index.json)
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const idx = JSON.parse(fs.readFileSync(path.join(HERE, 'sessions/index.json'), 'utf8'));
const keys = process.argv.slice(2).length ? process.argv.slice(2) : idx.sessions.map((s) => s.key);
const VIS = new Set(['cards', 'steps', 'two', 'ladder', 'matrix', 'bars', 'stats', 'pills']);
const TONES = new Set(['sage', 'gold', 'clay', 'slate', 'celadon', 'ink', 'bone']);
let bad = 0;
for (const key of keys) {
  const meta = idx.sessions.find((s) => s.key === key), errs = [], warn = [];
  const f = path.join(HERE, 'sessions', key + '.json');
  if (!meta) { console.log(key, 'FAIL not in index.json'); bad++; continue; }
  if (!fs.existsSync(f)) { console.log(key, 'FAIL file missing'); bad++; continue; }
  let s; try { s = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(key, 'FAIL bad JSON:', e.message); bad++; continue; }
  if (s.key !== key) errs.push('key does not match the file name');
  if (!s.title) errs.push('no title');
  if (!Array.isArray(s.cards)) { console.log(key, 'FAIL no cards'); bad++; continue; }
  const slides = s.cards.filter((c) => c.kind === 'slide'), checks = s.cards.filter((c) => c.kind === 'check');
  if (s.cards.some((c) => c.kind !== 'slide' && c.kind !== 'check')) errs.push('every card must be a slide or a check');
  if (s.cards[0]?.layout !== 'hero') errs.push('card 1 must be a hero slide');
  if (slides.length < 7 || slides.length > 10) errs.push(`${slides.length} slides (want 7 to 10 including the hero and the Remember slide)`);
  if (checks.length !== 10) errs.push(`${checks.length} checks (want exactly 10)`);
  const lastSlide = s.cards.map((c) => c.kind).lastIndexOf('slide'), firstCheck = s.cards.findIndex((c) => c.kind === 'check');
  if (firstCheck >= 0 && firstCheck < lastSlide) errs.push('all slides must come before the checks');
  let words = 0;
  for (const [i, c] of s.cards.entries()) {
    const w = `card ${i + 1}`;
    if (c.kind === 'slide') {
      if (!c.title) errs.push(`${w}: slide has no title`);
      words += String(c.body || '').split(/\s+/).length + String(c.title || '').split(/\s+/).length;
      if (c.visual) {
        const v = c.visual; if (!VIS.has(v.type)) errs.push(`${w}: unknown visual type ${v.type}`);
        const items = v.items || [];
        if (['cards', 'steps', 'ladder', 'bars', 'stats'].includes(v.type) && (items.length < 2 || items.length > 8)) errs.push(`${w}: ${v.type} needs 2 to 8 items`);
        if (v.type === 'two' && !(v.left?.items?.length && v.right?.items?.length)) errs.push(`${w}: two needs left.items and right.items`);
        if (v.type === 'matrix' && !['tl', 'tr', 'bl', 'br'].every((k) => v.cells?.[k]?.title)) errs.push(`${w}: matrix needs four cells`);
        for (const it of items) { if (it.tone && !TONES.has(it.tone)) errs.push(`${w}: tone ${it.tone}`); words += `${it.title || ''} ${it.text || ''} ${it.label || ''}`.split(/\s+/).length; }
      }
    } else if (c.kind === 'check') {
      if (!c.q) errs.push(`${w}: no question`);
      if (!c.why || c.why.length < 20) errs.push(`${w}: needs a why`);
      if (c.type === 'tf') { if (typeof c.answer !== 'boolean') errs.push(`${w}: tf answer must be true or false`); }
      else if (c.type === 'choice') {
        if (!Array.isArray(c.options) || c.options.length < 3 || c.options.length > 5) errs.push(`${w}: choice needs 3 to 5 options`);
        else if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length) errs.push(`${w}: choice answer must be an option number`);
        else if (new Set(c.options).size !== c.options.length) errs.push(`${w}: duplicate options`);
        else { const lens = c.options.map((o) => o.length), right = lens[c.answer]; if (right === Math.max(...lens) && right > 1.6 * (lens.reduce((a, b) => a + b) - right) / (lens.length - 1)) warn.push(`${w}: the right answer is much the longest`); }
      } else if (c.type === 'multi') {
        if (!Array.isArray(c.options) || c.options.length < 4 || !Array.isArray(c.answer) || c.answer.length < 2 || c.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= c.options.length)) errs.push(`${w}: multi needs 4+ options and an answer list of 2+ option numbers`);
      } else errs.push(`${w}: check type must be choice, tf or multi`);
      words += String(c.q || '').split(/\s+/).length + (c.options || []).join(' ').split(/\s+/).length;
    }
  }
  const mins = words / 150 + checks.length * 0.6 + slides.length * 0.15;
  if (words < 600 || words > 2300) warn.push(`${words} words (aim for roughly 700 to 1500)`);
  if (!Array.isArray(s.siteNotes)) errs.push('siteNotes must be a list (it may be empty)');
  if (!Array.isArray(s.legalNotes) || !s.legalNotes.length) errs.push('legalNotes must list the sources for the rules stated');
  const ans = checks.filter((c) => c.type === 'choice').map((c) => c.answer); if (ans.length >= 3 && new Set(ans).size === 1) warn.push('the right answer is always the same option number');
  console.log(key, errs.length ? 'FAIL' : 'OK', `· ${slides.length} slides, ${checks.length} checks, ~${words} words, ~${mins.toFixed(0)} min`, errs.length ? '\n   ' + errs.join('\n   ') : '', warn.length ? '\n   warn: ' + warn.join('\n   warn: ') : '');
  if (errs.length) bad++;
}
process.exit(bad ? 1 : 0);
