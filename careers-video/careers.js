/* Black Horse Beamish: Head Chef section for the website Careers page.
   Loaded by the Careers page's header code injection. Edit the INDEED link and wording here, push, and the page updates (cached ~10 minutes). */
(function () {
  var POSTED = '19 November 2026'; // date the advert went live: change if the advert is renewed
  var INDEED = 'https://uk.indeed.com/job/head-chef-ef9bedfe5fbab1b5'; // the live Indeed listing
  var base = (document.currentScript && document.currentScript.src.replace(/[^\/]*$/, '')) || 'https://app.blackhorsebeamish.co.uk/careers-video/';
  function go() {
    if (document.querySelector('.bhb-hc')) return;
    var after = document.querySelector('section[data-section-id="67757e8e5a81aa19b4f9bf4d"]');
    var before = document.querySelector('section[data-section-id="6735ce43d1fc2530b98f3e79"]');
    if (!after && !before) return;
    var css = document.createElement('style');
    css.textContent = [
      '.bhb-hc{background:#F8F8F8;color:#3F2F28;padding:clamp(40px,6vw,84px) 20px;font-family:Raleway,"Helvetica Neue",Arial,sans-serif}',
      '.bhb-hc *{box-sizing:border-box}',
      '.bhb-hc .in{max-width:1080px;margin:0 auto}',
      '.bhb-hc .eyebrow{margin:0 0 10px!important;text-align:center;font:600 12px/1.4 Raleway,sans-serif!important;letter-spacing:.24em;text-transform:uppercase;color:#4D604F}',
      '.bhb-hc h2{margin:0 0 10px!important;text-align:center;color:#4D604F!important;text-transform:none!important;font:500 clamp(40px,6vw,68px)/1.05 "Orpheus Pro","Cormorant Garamond",Georgia,serif!important}',
      '.bhb-hc .posted{margin:0 0 16px!important;text-align:center;font:600 11px/1.4 Raleway,sans-serif!important;letter-spacing:.2em;text-transform:uppercase;color:#6b5a52}',
      '.bhb-hc .posted b{display:inline-block;background:#4D604F;color:#fff;font-weight:600;padding:3px 9px;margin-right:8px;letter-spacing:.16em}',
      '.bhb-hc .pay{margin:0 0 28px!important;text-align:center;font:600 clamp(15px,2vw,18px)/1.5 Raleway,sans-serif!important;letter-spacing:.04em;color:#3F2F28}',
      '.bhb-hc .vid{position:relative;aspect-ratio:16/9;background:#000;box-shadow:0 14px 44px rgba(63,47,40,.22)}',
      '.bhb-hc video{position:absolute;inset:0;width:100%;height:100%;display:block;background:#000}',
      '.bhb-hc .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(22px,3vw,44px);margin:clamp(30px,4vw,52px) 0 30px}',
      '.bhb-hc h3{margin:0 0 12px!important;color:#4D604F!important;text-transform:none!important;font:500 28px/1.15 "Orpheus Pro","Cormorant Garamond",Georgia,serif!important}',
      '.bhb-hc p,.bhb-hc li{font:400 16px/1.65 Raleway,sans-serif!important;color:#3F2F28!important}',
      '.bhb-hc p{margin:0 0 12px!important}',
      '.bhb-hc ul{margin:0!important;padding:0 0 0 18px!important}',
      '.bhb-hc li{margin:0 0 6px!important}',
      '.bhb-hc .act{text-align:center;margin-top:8px}',
      '.bhb-hc .btn{display:inline-block;padding:18px 40px;background:#4D604F;color:#fff!important;text-decoration:none!important;font:600 13px/1 Raleway,sans-serif;letter-spacing:.2em;text-transform:uppercase;transition:background .2s}',
      '.bhb-hc .btn:hover{background:#3F2F28}',
      '.bhb-hc .note{margin:18px 0 0!important;text-align:center;font-size:14px!important}',
      '@media(max-width:860px){.bhb-hc .cols{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(css);
    var s = document.createElement('section'); s.className = 'bhb-hc';
    s.innerHTML =
      '<div class="in">' +
      '<p class="eyebrow">An opportunity not to be missed</p>' +
      '<h2>Head Chef</h2>' +
      '<p class="posted"><b>Now open</b>Posted ' + POSTED + '</p>' +
      '<p class="pay">£40,000 to £55,000 a year, depending on experience &middot; Full time, 45 hours a week</p>' +
      '<div class="vid"><video controls playsinline preload="metadata" poster="' + base + 'poster.jpg"><source src="' + base + 'head-chef.mp4" type="video/mp4"></video></div>' +
      '<div class="cols">' +
      '<div><h3>The role</h3><p>Lead the kitchen at one of County Durham&rsquo;s best-loved country pubs: a 300-year-old estate in the Beamish Valley with its own kitchen garden, a menu that changes with the seasons, and a calendar that runs from Sunday lunch to weddings in the Orchard Marquee.</p><p>You will lead, train and inspire our kitchen team and set the standard for every plate that leaves the pass.</p></div>' +
      '<div><h3>About you</h3><ul><li>At least 2 years&rsquo; experience as a Head Chef in a similar venue</li><li>A passion for fresh, seasonal, local produce</li><li>The confidence to lead a team and the warmth to bring the best out of it</li><li>Creativity with menus and a firm grip on costings, ordering and rotas</li><li>Level 2 Food Hygiene (or above) and sound allergen knowledge</li></ul></div>' +
      '<div><h3>What you get</h3><ul><li>£40,000 to £55,000 a year, depending on experience</li><li>Full time, 45 hours a week</li><li>Staff meals and free parking</li><li>A pension and a share of the tips</li><li>Discounted stays and events</li><li>The freedom to put your own stamp on the menu</li></ul></div>' +
      '</div>' +
      '<div class="act"><a class="btn" href="' + INDEED + '" target="_blank" rel="noopener">Apply on Indeed</a></div>' +
      '<p class="note">Prefer a chat first? Call us on 01207 232569.</p>' +
      '</div>';
    if (after) after.parentNode.insertBefore(s, after.nextSibling); else before.parentNode.insertBefore(s, before);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
