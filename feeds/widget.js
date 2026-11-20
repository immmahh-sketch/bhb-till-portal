/* What's on strip for the Black Horse Beamish /news page.
   Loaded from the News page's Page Header Code Injection. Reads whats-on.json (built by build_feed.py),
   drops events that have finished, and shows a slim, slowly scrolling row of cards at the very top of the page,
   directly under the site header, then tightens the "Welcome" banner so the first posts show on load. */
(function () {
  var BASE = 'https://app.blackhorsebeamish.co.uk/feeds/';
  var ROOMS = 'https://www.blackhorsebeamish.co.uk/luxury-rooms-cottages';
  if (window.__bhbWhatsOn) return; window.__bhbWhatsOn = 1;

  var css = '\
.bhw{background:#4D604F !important;color:#fff !important;padding:calc(var(--bhw-hdr,120px) + 4px) 0 18px;position:relative;overflow:hidden;font-family:inherit}\
.bhw *{box-sizing:border-box;font-style:normal !important}\
.bhw-head{max-width:1200px;margin:0 auto 12px;padding:0 24px;display:flex;align-items:baseline;justify-content:space-between;gap:16px}\
.bhw-head h2{margin:0 !important;color:#fff !important;font-weight:400 !important;font-size:22px !important;line-height:1.2 !important;letter-spacing:.02em !important;text-transform:none !important}\
.bhw-head a{color:#fff !important;font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none !important;border-bottom:1px solid rgba(255,255,255,.6);padding-bottom:1px;white-space:nowrap}\
.bhw-wrap{position:relative}\
.bhw-row{display:flex;gap:16px;overflow-x:auto;overflow-y:hidden;padding:2px 24px 4px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}\
.bhw-row::-webkit-scrollbar{display:none}\
.bhw-card{flex:0 0 360px;width:360px;height:128px;background:#fff !important;color:#2b2f2b !important;display:flex;flex-direction:row;box-shadow:0 6px 18px rgba(0,0,0,.22);overflow:hidden}\
.bhw-ph{position:relative;flex:0 0 132px;width:132px;background:#ddd}\
.bhw-img{display:block;width:100%;height:100%;object-fit:cover}\
.bhw-credit{position:absolute;left:0;right:0;bottom:0;margin:0 !important;padding:10px 6px 3px;font-size:9px !important;line-height:1.2 !important;background:linear-gradient(transparent,rgba(0,0,0,.65));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.bhw-credit a{color:#fff !important;text-decoration:none !important;opacity:.9}\
.bhw-body{padding:10px 14px 9px;display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}\
.bhw-meta{display:flex;gap:8px;align-items:center;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#5b6b5d !important;white-space:nowrap;overflow:hidden}\
.bhw-chip{background:#4D604F !important;color:#fff !important;padding:2px 8px}\
.bhw-card h3{margin:0 !important;color:#4D604F !important;font-size:16px !important;line-height:1.2 !important;font-weight:400 !important;text-transform:none !important;letter-spacing:0 !important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\
.bhw-when{margin:0 !important;font-size:12px !important;color:#2b2f2b !important;font-weight:600;letter-spacing:.02em}\
.bhw-links{margin-top:auto;display:flex;gap:4px 14px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}\
.bhw-links a{color:#4D604F !important;text-decoration:none !important;border-bottom:1px solid #4D604F;padding-bottom:1px}\
.bhw-links a:hover{opacity:.7}\
.bhw-btn{position:absolute;top:50%;margin-top:-18px;width:36px;height:36px;border-radius:50%;border:1px solid #fff !important;background:rgba(77,96,79,.92) !important;color:#fff !important;font-size:18px;line-height:1;cursor:pointer;z-index:3;display:flex;align-items:center;justify-content:center;padding:0}\
.bhw-btn:hover{background:#fff !important;color:#4D604F !important}\
.bhw-prev{left:8px}.bhw-next{right:8px}\
article.sections>section.has-section-divider{min-height:0 !important;padding-top:22px !important;padding-bottom:46px !important}\
article.sections>section.has-section-divider .content-wrapper{padding-top:0 !important;padding-bottom:0 !important}\
article.sections>section.has-section-divider .fluid-engine{display:block !important}\
article.sections>section.has-section-divider .fe-block{grid-area:auto !important;margin:0 !important}\
article.sections>section.has-section-divider h1{font-size:clamp(26px,2.6vw,38px) !important;margin:0 0 6px !important;line-height:1.15 !important}\
article.sections>section.has-section-divider h3{font-size:clamp(14px,1.3vw,18px) !important;margin:0 !important;line-height:1.45 !important}\
@media(max-width:640px){.bhw-card{flex-basis:300px;width:300px;height:122px}.bhw-ph{flex-basis:108px;width:108px}.bhw-btn{display:none}.bhw-row{padding-left:16px;padding-right:16px}.bhw-head{padding:0 16px}.bhw-head h2{font-size:19px !important}}\
';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  function card(it) {
    var c = el('article', 'bhw-card');
    var ph = el('div', 'bhw-ph');
    var im = el('img', 'bhw-img'); im.src = it.image; im.alt = it.title; im.loading = 'lazy'; im.draggable = false; ph.appendChild(im);
    if (it.credit) { var cr = el('p', 'bhw-credit'); var ca = el('a', '', it.credit.text); ca.href = it.credit.url; ca.target = '_blank'; ca.rel = 'noopener'; cr.appendChild(ca); ph.appendChild(cr); }
    c.appendChild(ph);
    var b = el('div', 'bhw-body');
    var m = el('div', 'bhw-meta'); m.appendChild(el('span', 'bhw-chip', it.category)); m.appendChild(el('span', '', it.area)); b.appendChild(m);
    var h = el('h3', '', it.title); h.title = it.summary; b.appendChild(h);
    b.appendChild(el('p', 'bhw-when', it.when));
    var l = el('div', 'bhw-links');
    var a1 = el('a', '', 'Find out more'); a1.href = it.link; a1.target = '_blank'; a1.rel = 'noopener'; l.appendChild(a1);
    var a2 = el('a', '', 'Stay with us'); a2.href = ROOMS; a2.title = it.hook; l.appendChild(a2);
    b.appendChild(l); c.appendChild(b); return c;
  }

  function build(data) {
    var t = today();
    var items = (data.items || []).filter(function (i) { return i.end >= t; });
    items.sort(function (a, b) { var x = a.start < t ? t : a.start, y = b.start < t ? t : b.start; return x < y ? -1 : x > y ? 1 : (a.start < b.start ? -1 : 1); });
    if (!items.length) return;
    var art = document.querySelector('article.sections'); var list = document.querySelector('.blog-list');
    if (!art || !list) return;
    var first = art.querySelector(':scope > section'); if (!first) return;
    if (!document.getElementById('bhw-css')) { var s = el('style'); s.id = 'bhw-css'; s.textContent = css; document.head.appendChild(s); }

    var box = el('section', 'bhw'); box.setAttribute('aria-label', "What's on near the Black Horse");
    var head = el('div', 'bhw-head');
    head.appendChild(el('h2', '', "What's on near the Black Horse"));
    var fa = el('a', '', 'RSS feed'); fa.href = BASE + 'whats-on.xml'; head.appendChild(fa);
    box.appendChild(head);
    var wrap = el('div', 'bhw-wrap'); var row = el('div', 'bhw-row'); row.tabIndex = 0; row.setAttribute('aria-label', 'Scrolling list of events');
    items.forEach(function (i) { row.appendChild(card(i)); });
    var firstCount = row.children.length;
    if (items.length > 3) items.forEach(function (i) { var c = card(i); c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; }); row.appendChild(c); });
    wrap.appendChild(row);
    var prev = el('button', 'bhw-btn bhw-prev', '‹'), next = el('button', 'bhw-btn bhw-next', '›');
    prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Previous events'); next.setAttribute('aria-label', 'Next events');
    wrap.appendChild(prev); wrap.appendChild(next); box.appendChild(wrap);
    art.insertBefore(box, first);

    // The site header floats over the top of the page: keep the strip clear of it (same green, so it reads as one banner).
    function sizeHeader() { var h = document.querySelector('header'); box.style.setProperty('--bhw-hdr', (h ? Math.round(h.getBoundingClientRect().height) : 120) + 'px'); }
    sizeHeader(); window.addEventListener('resize', sizeHeader); window.addEventListener('load', sizeHeader);

    var step = function () { var c = row.children[0]; return c ? c.offsetWidth + 16 : 376; };
    var loopW = function () { return items.length > 3 ? row.children[firstCount].offsetLeft - row.children[0].offsetLeft : 0; };
    var paused = false, resumeAt = 0, acc = 0;
    function hold(ms) { paused = true; resumeAt = Date.now() + (ms || 4000); }
    ['mouseenter', 'focusin', 'touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { row.addEventListener(ev, function () { hold(5000); }, { passive: true }); });
    row.addEventListener('mouseleave', function () { hold(1200); });
    prev.addEventListener('click', function () { hold(6000); row.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { hold(6000); row.scrollBy({ left: step(), behavior: 'smooth' }); });
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || items.length <= 3) return;
    var visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(box);
    (function tick() {
      if (paused && Date.now() > resumeAt) paused = false;
      if (!paused && visible && !document.hidden) {
        acc += 0.45; if (acc >= 1) { var n = Math.floor(acc); acc -= n; row.scrollLeft += n; }
        var w = loopW(); if (w && row.scrollLeft >= w) row.scrollLeft -= w;
      }
      requestAnimationFrame(tick);
    })();
  }

  function go() {
    var v = Math.floor(Date.now() / 600000);
    fetch(BASE + 'whats-on.json?v=' + v).then(function (r) { return r.json(); }).then(build).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
