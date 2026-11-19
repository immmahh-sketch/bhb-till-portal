/* Black Horse Beamish Photo Gallery.  On the website: <div id="bhbGallery"></div><script src="https://app.blackhorsebeamish.co.uk/gallery/gallery.js"></script>
   Five banners (Weddings, Food, The Venue, The Rooms, The Views); a banner opens its photos, a photo opens full screen. Pictures and manifest.json sit beside this file. */
(function () {
  var me = document.currentScript, base = me ? me.src.replace(/[^\/]*$/, '') : 'https://app.blackhorsebeamish.co.uk/gallery/';
  var host = document.getElementById('bhbGallery'); if (!host) return;
  function add(tag, attrs) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); document.head.appendChild(e); }
  add('link', { rel: 'stylesheet', href: base + 'gallery.css?v=2' });
  add('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Raleway:wght@400;500;600&display=swap' });
  var wrap = document.createElement('div'); wrap.className = 'wrap'; host.className = 'bhbg'; host.appendChild(wrap);
  var lb = document.createElement('div'); lb.id = 'bhbLb'; lb.className = 'bhbg-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo');
  lb.innerHTML = '<button class="x" aria-label="Close">&times;</button><button class="p" aria-label="Previous">&#8249;</button><img alt=""><button class="n" aria-label="Next">&#8250;</button><div class="c"></div>';
  document.body.appendChild(lb);
  var lbi = lb.querySelector('img'), lbc = lb.querySelector('.c'), data = null, cur = 0, idx = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  fetch(base + 'manifest.json?v=' + Math.floor(Date.now() / 600000)).then(function (r) { return r.json(); }).then(function (d) { data = d; build(); })
    .catch(function () { wrap.innerHTML = '<div class="empty">The gallery could not be loaded just now. Please try again in a moment.</div>'; });
  function build() {
    wrap.innerHTML = data.categories.map(function (c, i) {
      return '<section class="cat" id="bhbc' + i + '"><button class="banner" aria-expanded="false"><span class="bg" style="background-image:url(\'' + esc(base + c.cover) + '\')"></span><span class="tx"><h2>' + esc(c.title) + '</h2><p>' + c.photos.length + ' photos</p></span><span class="chev" aria-hidden="true"></span></button><div class="grid"></div></section>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.banner'), function (b, i) { b.onclick = function () { toggle(i); }; });
  }
  function toggle(i) {
    var sec = document.getElementById('bhbc' + i), open = !sec.classList.contains('open');
    Array.prototype.forEach.call(wrap.querySelectorAll('.cat.open'), function (s) { s.classList.remove('open'); s.querySelector('.banner').setAttribute('aria-expanded', 'false'); });
    if (!open) return;
    var g = sec.querySelector('.grid');
    if (!g.firstChild) {
      g.innerHTML = data.categories[i].photos.map(function (p, k) { return '<a href="' + esc(base + p.f) + '" data-k="' + k + '"><img loading="lazy" src="' + esc(base + p.t) + '" width="' + p.tw + '" height="' + p.th + '" alt="' + esc(p.a) + '"></a>'; }).join('');
      Array.prototype.forEach.call(g.querySelectorAll('a'), function (a) { a.onclick = function (e) { e.preventDefault(); show(i, +a.getAttribute('data-k')); }; });
      Array.prototype.forEach.call(g.querySelectorAll('img'), function (im) { if (im.complete) im.classList.add('in'); else im.onload = function () { im.classList.add('in'); }; });
    }
    sec.classList.add('open'); sec.querySelector('.banner').setAttribute('aria-expanded', 'true');
    setTimeout(function () { var r = sec.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * .6) window.scrollTo({ top: window.scrollY + r.top - 70, behavior: 'smooth' }); }, 30);
  }
  function show(i, k) {
    var list = data.categories[i].photos; cur = i; idx = (k + list.length) % list.length; var p = list[idx];
    lbi.src = base + p.f; lbi.alt = p.a; lbc.textContent = p.a + '  ·  ' + (idx + 1) + ' / ' + list.length; lb.classList.add('on');
    var nx = list[(idx + 1) % list.length]; if (nx) new Image().src = base + nx.f;
  }
  function hide() { lb.classList.remove('on'); lbi.removeAttribute('src'); }
  lb.querySelector('.x').onclick = hide;
  lb.querySelector('.p').onclick = function (e) { e.stopPropagation(); show(cur, idx - 1); };
  lb.querySelector('.n').onclick = function (e) { e.stopPropagation(); show(cur, idx + 1); };
  lb.onclick = function (e) { if (e.target === lb) hide(); };
  document.addEventListener('keydown', function (e) { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') hide(); else if (e.key === 'ArrowLeft') show(cur, idx - 1); else if (e.key === 'ArrowRight') show(cur, idx + 1); });
  var sx = 0; lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) { var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(cur, idx + (d < 0 ? 1 : -1)); });
})();
