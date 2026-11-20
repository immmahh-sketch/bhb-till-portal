/* What's on strip for the Black Horse Beamish /news page.
   Loaded from the News page's Page Header Code Injection. Reads whats-on.json (built by build_feed.py),
   drops events that have finished, and shows a slowly scrolling row of cards above the blog list. */
(function () {
  var BASE = 'https://app.blackhorsebeamish.co.uk/feeds/';
  var ROOMS = 'https://www.blackhorsebeamish.co.uk/luxury-rooms-cottages';
  if (window.__bhbWhatsOn) return; window.__bhbWhatsOn = 1;

  var css = '\
.bhw{background:#4D604F !important;color:#fff !important;padding:56px 0 96px;position:relative;overflow:hidden;font-family:inherit}\
.bhw *{box-sizing:border-box;font-style:normal !important}\
.bhw-head{max-width:1100px;margin:0 auto 28px;padding:0 24px;text-align:center}\
.bhw-head h2{margin:0 0 10px !important;color:#fff !important;font-weight:400 !important;font-size:clamp(28px,4vw,44px) !important;line-height:1.15 !important;letter-spacing:.01em !important}\
.bhw-head p{margin:0 auto !important;max-width:640px;color:#fff !important;opacity:.92;font-size:16px !important;line-height:1.6 !important}\
.bhw-wrap{position:relative}\
.bhw-row{display:flex;gap:20px;overflow-x:auto;overflow-y:hidden;padding:6px 24px 14px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}\
.bhw-row::-webkit-scrollbar{display:none}\
.bhw-card{flex:0 0 300px;width:300px;background:#fff !important;color:#2b2f2b !important;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.22)}\
.bhw-img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;background:#ddd}\
.bhw-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:8px;flex:1}\
.bhw-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5b6b5d !important}\
.bhw-chip{background:#4D604F !important;color:#fff !important;padding:3px 10px;letter-spacing:.12em}\
.bhw-card h3{margin:0 !important;color:#4D604F !important;font-size:20px !important;line-height:1.25 !important;font-weight:400 !important;text-transform:none !important;letter-spacing:0 !important}\
.bhw-when{margin:0 !important;font-size:14px !important;color:#2b2f2b !important;font-weight:600}\
.bhw-sum{margin:0 !important;font-size:14px !important;line-height:1.55 !important;color:#444 !important;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}\
.bhw-links{margin-top:auto;padding-top:10px;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;letter-spacing:.14em;text-transform:uppercase}\
.bhw-links a{color:#4D604F !important;text-decoration:none !important;border-bottom:1px solid #4D604F;padding-bottom:1px}\
.bhw-links a:hover{opacity:.7}\
.bhw-credit{margin:6px 0 0 !important;font-size:10px !important;line-height:1.3 !important;color:#8a928b !important;letter-spacing:.02em}.bhw-credit a{color:#8a928b !important;text-decoration:none !important}.bhw-btn{position:absolute;top:34%;width:44px;height:44px;border-radius:50%;border:1px solid #fff !important;background:rgba(77,96,79,.92) !important;color:#fff !important;font-size:20px;line-height:1;cursor:pointer;z-index:3;display:flex;align-items:center;justify-content:center;padding:0}\
.bhw-btn:hover{background:#fff !important;color:#4D604F !important}\
.bhw-prev{left:10px}.bhw-next{right:10px}\
.bhw-foot{text-align:center;margin-top:22px;padding:0 24px;font-size:13px;opacity:.9}\
.bhw-foot a{color:#fff !important;text-decoration:underline !important}\
@media(max-width:640px){.bhw{padding:40px 0 80px}.bhw-card{flex-basis:250px;width:250px}.bhw-btn{display:none}.bhw-row{padding-left:16px;padding-right:16px}}\
';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  function card(it) {
    var c = el('article', 'bhw-card');
    var im = el('img', 'bhw-img'); im.src = it.image; im.alt = it.title; im.loading = 'lazy'; im.draggable = false; c.appendChild(im);
    var b = el('div', 'bhw-body');
    var m = el('div', 'bhw-meta'); m.appendChild(el('span', 'bhw-chip', it.category)); m.appendChild(el('span', '', it.area)); b.appendChild(m);
    b.appendChild(el('h3', '', it.title));
    b.appendChild(el('p', 'bhw-when', it.when));
    b.appendChild(el('p', 'bhw-sum', it.summary));
    var l = el('div', 'bhw-links');
    var a1 = el('a', '', 'Find out more'); a1.href = it.link; a1.target = '_blank'; a1.rel = 'noopener'; l.appendChild(a1);
    var a2 = el('a', '', 'Stay with us'); a2.href = ROOMS; a2.title = it.hook; l.appendChild(a2);
    b.appendChild(l);
    if (it.credit) { var cr = el('p', 'bhw-credit'); var ca = el('a', '', it.credit.text); ca.href = it.credit.url; ca.target = '_blank'; ca.rel = 'noopener'; cr.appendChild(ca); b.appendChild(cr); }
    c.appendChild(b); return c;
  }

  function build(data) {
    var t = today();
    var items = (data.items || []).filter(function (i) { return i.end >= t; });
    items.sort(function (a, b) { var x = a.start < t ? t : a.start, y = b.start < t ? t : b.start; return x < y ? -1 : x > y ? 1 : (a.start < b.start ? -1 : 1); });
    if (!items.length) return;
    var list = document.querySelector('.blog-list'); if (!list) return;
    var anchor = list.closest('section.page-section') || list;
    if (!document.getElementById('bhw-css')) { var s = el('style'); s.id = 'bhw-css'; s.textContent = css; document.head.appendChild(s); }

    var box = el('section', 'bhw'); box.setAttribute('aria-label', "What's on near the Black Horse");
    var head = el('div', 'bhw-head');
    head.appendChild(el('h2', '', "What's on near the Black Horse"));
    head.appendChild(el('p', '', 'Christmas lights, markets, concerts and days out around Beamish, County Durham and the North East, picked for our guests.'));
    box.appendChild(head);
    var wrap = el('div', 'bhw-wrap'); var row = el('div', 'bhw-row'); row.tabIndex = 0; row.setAttribute('aria-label', 'Scrolling list of events');
    items.forEach(function (i) { row.appendChild(card(i)); });
    var firstCount = row.children.length;
    if (items.length > 3) items.forEach(function (i) { var c = card(i); c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; }); row.appendChild(c); });
    wrap.appendChild(row);
    var prev = el('button', 'bhw-btn bhw-prev', '‹'), next = el('button', 'bhw-btn bhw-next', '›');
    prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Previous events'); next.setAttribute('aria-label', 'Next events');
    wrap.appendChild(prev); wrap.appendChild(next); box.appendChild(wrap);
    var foot = el('p', 'bhw-foot'); foot.appendChild(document.createTextNode('Follow it in your feed reader: '));
    var fa = el('a', '', 'RSS feed'); fa.href = BASE + 'whats-on.xml'; foot.appendChild(fa); box.appendChild(foot);
    anchor.parentNode.insertBefore(box, anchor);

    var step = function () { var c = row.children[0]; return c ? c.offsetWidth + 20 : 320; };
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
