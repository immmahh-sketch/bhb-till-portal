/* BHB Training: the picture side of a training slide (used by the host screen and the BHB Training phone app).
 *
 * A slide keeps its pictures as plain data, so the builder can store and edit them and nothing here needs a server:
 *   slide.layout  'plain' | 'hero' | 'photo' | 'photoright' | 'visual' | 'exercise'
 *   slide.kicker  the small label above the title ("Part 3 · 0:40")
 *   slide.media   { kind: 'image', url, credit }   a photograph
 *   slide.visual  { type, ... }                     a diagram, chart or mock-up drawn from data (see VIS below)
 *
 * Visual types: cards · steps · ladder · matrix · two · bars · form · seating · agenda · stats · pills
 * Everything is HTML and CSS in em units, so the same markup works at 1920 px on a TV and at 360 px on a phone
 * (the wrapper sets the font size, and container queries switch rows to columns when there is no room).
 */
(() => {
  const LQ = window.LQ;
  const { esc } = LQ;
  const tone = (t) => (/^(sage|gold|clay|slate|celadon|ink|bone)$/.test(t) ? t : 'sage');
  const inl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  const ico = (i) => (i ? `<span class="v-ico" aria-hidden="true">${esc(i)}</span>` : '');

  // ---- one item: an icon or number, a title and a line of text, in a tone
  function item(it, i, o = {}) {
    const badge = o.numbered ? `<span class="v-num">${it.n ?? i + 1}</span>` : ico(it.icon);
    return `<div class="v-item t-${tone(it.tone)}${it.hi ? ' hi' : ''}">${it.tag ? `<span class="v-tag">${esc(it.tag)}</span>` : ''}<div class="v-head">${badge}<b>${inl(it.title || '')}</b></div>${it.text ? `<p>${inl(it.text)}</p>` : ''}</div>`;
  }

  const VIS = {
    // A grid of cards. cols: 2-4 (it drops to one column when the screen is narrow).
    cards: (v) => `<div class="v-grid c${v.cols || Math.min(3, (v.items || []).length)}">${(v.items || []).map((it, i) => item(it, i, v)).join('')}</div>`,
    // Numbered steps in a row (or a column on a phone), with an arrow between each.
    steps: (v) => `<div class="v-steps c${v.cols || Math.min(4, (v.items || []).length)}">${(v.items || []).map((it, i) => item(it, i, { numbered: v.numbered !== false })).join('')}</div>`,
    // A staircase: each step is one up from the last, coloured from calm to serious. `side` is the box beside it.
    ladder: (v) => {
      const n = (v.items || []).length;
      return `<div class="v-ladder">
        <div class="v-stairs">${(v.items || []).map((it, i) => `<div class="v-stair t-${tone(it.tone)}" style="--i:${i};--n:${n}"><span class="v-num">${i + 1}</span><div><b>${inl(it.title)}</b>${it.text ? `<small>${inl(it.text)}</small>` : ''}</div>${it.band ? `<em>${esc(it.band)}</em>` : ''}</div>`).join('')}</div>
        ${v.side ? `<aside class="v-side t-${tone(v.side.tone || 'clay')}"><b>${inl(v.side.title)}</b><p>${inl(v.side.text || '')}</p></aside>` : ''}</div>`;
    },
    // Two axes, four boxes: tl, tr, bl, br.
    matrix: (v) => {
      const c = v.cells || {}, cell = (k) => `<div class="v-cell t-${tone(c[k]?.tone)}"><b>${inl(c[k]?.title || '')}</b>${c[k]?.text ? `<p>${inl(c[k].text)}</p>` : ''}</div>`;
      return `<div class="v-matrix"><div class="v-yax"><span>${esc(v.yAxis || '')}</span></div><div class="v-mgrid">${cell('tl')}${cell('tr')}${cell('bl')}${cell('br')}</div><div class="v-xax">${esc(v.xAxis || '')}</div></div>`;
    },
    // Two lists side by side: do and don't, can and cannot, conduct and competency.
    two: (v) => `<div class="v-two">${['left', 'right'].map((k) => { const s = v[k] || {}; return `<div class="v-col t-${tone(s.tone)}"><h4>${ico(s.icon)}${inl(s.title || '')}</h4><ul class="${s.mark || ''}">${(s.items || []).map((x) => `<li>${inl(x)}</li>`).join('')}</ul></div>`; }).join('')}</div>`,
    // Horizontal bars: a rough size of something, for a comparison. Marked illustrative so nobody reads it as data.
    bars: (v) => `<div class="v-bars">${(v.items || []).map((it, i) => `<div class="v-bar t-${tone(it.tone)}"><span class="v-bl">${inl(it.label)}</span><span class="v-bt"><i style="--w:${Math.max(2, Math.min(100, +it.v || 0))}%;--d:${i * 90}ms"></i></span><span class="v-bn">${inl(it.note || '')}</span></div>`).join('')}${v.caption ? `<p class="v-cap">${inl(v.caption)}</p>` : ''}</div>`,
    // A paper form: the Coaching & Advice record, or a statement. Fields can carry a tip chip and a filled-in example.
    form: (v) => `<div class="v-form"><div class="v-fhead"><img class="v-flogo" src="assets/brand/bhb-logo-dark.png" alt="Black Horse Beamish"><b>${esc(v.title || '')}</b>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}</div>
      ${(v.top || []).length ? `<div class="v-ftop">${v.top.map((t) => `<span><i>${esc(t.k)}</i>${t.v ? `<u>${esc(t.v)}</u>` : '<u></u>'}</span>`).join('')}</div>` : ''}
      ${(v.fields || []).map((f) => `<div class="v-field${f.hi ? ' hi' : ''}"><div class="v-flabel"><span class="v-num">${f.n}</span><b>${esc(f.label)}</b>${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>${f.text ? `<div class="v-fbox">${inl(f.text)}</div>` : '<div class="v-fbox empty"></div>'}${f.tip ? `<div class="v-tip">${inl(f.tip)}</div>` : ''}</div>`).join('')}
      ${v.sign ? `<div class="v-fsign2"><div><span><i>Colleague name</i><u></u></span><span><i>Colleague signature</i><u></u></span><span><i>Date</i><u></u></span></div><div><span><i>Manager name</i><u></u></span><span><i>Manager signature</i><u></u></span><span><i>Date</i><u></u></span></div></div>` : ''}</div>`,
    // The meeting room: a table with a seat for each role. seats: [{role, who, at: 'tl'|'tr'|'bl'|'br'|'t'|'b', tone}]
    seating: (v) => `<div class="v-seating"><div class="v-room"><div class="v-table"><span>${esc(v.table || 'Private room · phones off · water on the table')}</span></div>${(v.seats || []).map((s) => `<div class="v-seat at-${esc(s.at || 't')} t-${tone(s.tone)}"><b>${esc(s.role)}</b><small>${esc(s.who || '')}</small></div>`).join('')}</div>
      ${(v.notes || []).length ? `<ul class="v-notes">${v.notes.map((x) => `<li>${inl(x)}</li>`).join('')}</ul>` : ''}</div>`,
    // The session's running order, with a bar showing how long each part is.
    agenda: (v) => {
      const items = v.items || [], total = items.reduce((a, x) => a + (+x.mins || 0), 0) || 1;
      return `<div class="v-agenda"><div class="v-abar">${items.map((x, i) => `<i class="t-${tone(x.tone || ['sage', 'slate', 'gold', 'clay'][i % 4])}" style="flex:${+x.mins || 1}" title="${esc(x.title)}"></i>`).join('')}</div>
        <ol>${items.map((x, i) => `<li class="t-${tone(x.tone || ['sage', 'slate', 'gold', 'clay'][i % 4])}"><span class="v-at">${esc(x.at || '')}</span><div><b>${inl(x.title)}</b>${x.text ? `<small>${inl(x.text)}</small>` : ''}</div><span class="v-mins">${x.mins ? x.mins + ' min' : ''}</span></li>`).join('')}</ol></div>`;
    },
    // Big numbers or short words with a label under each.
    stats: (v) => `<div class="v-stats c${(v.items || []).length}">${(v.items || []).map((it) => `<div class="v-stat t-${tone(it.tone)}"><strong>${esc(it.big)}</strong><span>${inl(it.label || '')}</span></div>`).join('')}</div>`,
    // The teams: each a coloured card with its members and their roles. They appear once the phones' wheels have landed.
    groups: (v) => `<div class="v-teams n${Math.min(6, (v.list || []).length)}${v.compact ? ' compact' : ''}">${v.compact ? '' : '<div class="v-spin">Spin your phone\'s wheel…</div>'}${(v.list || []).map((g, i) => `<div class="v-team" style="--tc:${esc(g.color)};--d:${4800 + i * 160}ms"><h4>${esc(g.name)}<small>${(g.members || []).length}</small></h4><ul>${(g.members || []).map((m) => `<li><span>${esc(m.emoji || '')} ${esc(m.name)}</span>${m.role ? `<em>${esc(m.role)}</em>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>`,
    // A row of short phrases, like tags.
    pills: (v) => `<div class="v-pills">${(v.items || []).map((x, i) => `<span class="t-${tone((v.tones || ['sage', 'slate', 'gold', 'clay'])[i % (v.tones || [1, 2, 3, 4]).length])}">${inl(x)}</span>`).join('')}</div>`,
  };
  /** The picture for slide data, or '' when the type is unknown. */
  function visualHtml(v) { try { return v && VIS[v.type] ? `<div class="vis vis-${v.type}">${VIS[v.type](v)}</div>` : ''; } catch { return ''; } }

  /** A whole training slide from {title, body, image, credit, layout, kicker, visual} (what the host broadcasts to phones).
   *  `brk` adds the countdown clock for an exercise: { prefix, what }. */
  function trainSlideHtml(sl, o = {}) {
    const layout = sl.layout || (sl.visual ? 'visual' : sl.image ? 'photo' : 'plain');
    const kicker = sl.kicker ? `<div class="ts-kicker">${esc(sl.kicker)}</div>` : '';
    const title = sl.title ? `<h1 class="ts-title">${esc(sl.title)}</h1>` : '';
    const body = sl.body ? `<div class="slidebody">${LQ.slideHtml(sl.body)}</div>` : '';
    const vis = visualHtml(sl.visual);
    const credit = sl.credit ? `<div class="ts-credit">${esc(sl.credit)}</div>` : '';
    const img = sl.image ? `<div class="ts-img"><img src="${esc(sl.image)}" alt=""></div>` : '';
    const clock = o.brk ? `<div class="ts-clock">${LQ.breakClockHtml(o.brk.prefix, o.brk.what)}<div class="brkback" id="${o.brk.prefix === 'brk' ? 'brkBack' : 'pbrkBack'}"></div></div>` : '';
    if (layout === 'hero') return `<div class="ts ts-hero" style="${sl.image ? `background-image:linear-gradient(90deg,rgba(20,28,22,.92) 0%,rgba(20,28,22,.62) 48%,rgba(20,28,22,.1) 100%),url('${esc(sl.image)}')` : ''}"><div class="ts-in">${kicker}${title}${body}${vis}</div>${credit}</div>`;
    if (layout === 'photo' || layout === 'photoright') return `<div class="ts ts-photo${layout === 'photoright' ? ' right' : ''}">${img}<div class="ts-txt">${kicker}${title}${body}${vis}</div>${credit}</div>`;
    if (layout === 'exercise' || o.brk) return `<div class="ts ts-ex"><div class="ts-main">${kicker}${title}${body}${vis}${o.teams ? `<div class="ts-teams">${o.teams}</div>` : ''}</div>${clock}</div>`;
    return layout === 'visual' ? `<div class="ts ts-vis"><div class="ts-head">${kicker}${title}</div>${vis}${body}${img}${credit}</div>` : `<div class="ts ts-plain"><div class="ts-head">${kicker}${title}</div>${body}${vis}${img}${credit}</div>`;
  }
  Object.assign(LQ, { visualHtml, trainSlideHtml });
})();
