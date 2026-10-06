/* The two helpers the diagram code (train-visuals.js, copied from the Let's Quiz repo) needs: escaping and the slide mini-markup. */
window.LQ = window.LQ || {};
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Slide text as HTML: "- " bullets, ✔ / ✘ lists, "## " small heading, "> " callout, **bold**, the rest paragraphs. */
  function slideHtml(body) {
    let html = '', list = [], kind = '';
    const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const flush = () => { if (list.length) { html += `<ul${kind ? ` class="${kind}"` : ''}>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`; list = []; kind = ''; } };
    for (const raw of String(body || '').split(/\r?\n/)) {
      const l = raw.trim(); if (!l) { flush(); continue; }
      const m = l.match(/^(?:([✔✘])|[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { const k = m[1] === '✔' ? 'tick' : m[1] === '✘' ? 'cross' : ''; if (list.length && k !== kind) flush(); kind = k; list.push(m[2]); continue; }
      flush();
      if (/^##\s+/.test(l)) html += `<h3>${inline(l.replace(/^##\s+/, ''))}</h3>`;
      else if (/^>\s?/.test(l)) html += `<div class="callout">${inline(l.replace(/^>\s?/, ''))}</div>`;
      else html += `<p>${inline(l)}</p>`;
    }
    flush(); return html;
  }
  Object.assign(window.LQ, { esc, slideHtml, breakClockHtml: () => '' });
})();
