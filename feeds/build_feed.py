"""Builds whats-on.xml (RSS) and whats-on.json (for the /news page strip) from items.json.
Items drop out once their end date has passed.  Run from this folder:  python build_feed.py

Each item may have "image": a file name inside feeds/img/ (our own photos only). If missing, DEFAULT_IMAGE is used."""
import json, os, datetime as dt, email.utils as eu
from xml.sax.saxutils import escape

BASE = "https://app.blackhorsebeamish.co.uk/feeds/"
LINK = "https://www.blackhorsebeamish.co.uk/luxury-rooms-cottages"
DEFAULT_IMAGE = "snowy-sunset-lavender.jpg"
HOOK = {
 "Beamish": "Beamish Museum is just up the road from us: spend the day in the 1900s town, then come back to the Black Horse for dinner or stay in one of our rooms or cottages.",
 "Christmas": "Make it a festive break: a relaxed countryside pub with rooms and cottages, in Beamish with Durham and Newcastle within easy reach.",
 "Markets": "Browse by day, then come back to the Black Horse for a proper dinner and a comfortable bed.",
 "Music": "Make an evening of it and stay with us, a relaxed countryside pub with rooms and cottages near Durham.",
 "Family": "Bring the whole family: our rooms and cottages are a relaxed base for a family break.",
 "Exhibition": "Combine it with a night at the Black Horse, with rooms and cottages in the County Durham countryside.",
}
today = dt.date.today()
here = os.path.dirname(os.path.abspath(__file__))
items = json.load(open(os.path.join(here, "items.json"), encoding="utf-8"))
live = [i for i in items if dt.date.fromisoformat(i["end"]) >= today]
live.sort(key=lambda i: (i["start"], i["title"]))

def rfc(d):
    return eu.format_datetime(dt.datetime.combine(d, dt.time(8, 0), tzinfo=dt.timezone.utc))

def when(i):
    s, e = dt.date.fromisoformat(i["start"]), dt.date.fromisoformat(i["end"])
    if s == e:
        return f'{s.day} {s.strftime("%b %Y")}'
    return f'{s.day} {s.strftime("%b")} to {e.day} {e.strftime("%b %Y")}'

def image(i):
    name = i.get("image") or DEFAULT_IMAGE
    if not os.path.exists(os.path.join(here, "img", name)):
        name = DEFAULT_IMAGE
    return name, os.path.getsize(os.path.join(here, "img", name))

out = ['<?xml version="1.0" encoding="UTF-8"?>',
 '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>',
 "<title>What's on near the Black Horse Beamish</title>",
 '<link>https://www.blackhorsebeamish.co.uk/news</link>',
 f'<atom:link href="{BASE}whats-on.xml" rel="self" type="application/rss+xml"/>',
 '<description>Christmas events, markets, exhibitions and days out in Beamish, County Durham and the wider North East, picked for our guests.</description>',
 '<language>en-gb</language>',
 f'<image><url>{BASE}img/sign-at-sunset-snow.jpg</url><title>What\'s on near the Black Horse Beamish</title><link>https://www.blackhorsebeamish.co.uk/news</link></image>',
 f'<lastBuildDate>{rfc(today)}</lastBuildDate>']
js = []
for i in live:
    img, size = image(i)
    url = BASE + "img/" + img
    hook = HOOK.get(i["category"], HOOK["Christmas"])
    cr = i.get("credit")
    plain = f'{when(i)}. {i["summary"]} {hook} Rooms and cottages: {LINK}' + (f' ({cr["text"]}, via Wikimedia Commons)' if cr else '')
    html = (f'<p><img src="{url}" alt="{escape(i["title"])}" style="max-width:100%"/></p>'
            f'<p><strong>{escape(when(i))}.</strong> {escape(i["summary"])}</p>'
            f'<p>{escape(hook)} <a href="{LINK}">See our rooms and cottages</a></p>'
            f'<p><a href="{escape(i["link"])}">Find out more from the organiser</a></p>'
            + (f'<p><small><a href="{escape(cr["url"])}">{escape(cr["text"])}</a> (Wikimedia Commons)</small></p>' if cr else ''))
    pub = rfc(min(max(dt.date.fromisoformat(i["start"]) - dt.timedelta(days=7), dt.date(2026, 11, 20)), today))
    out.append("<item>"
      f'<title>{escape(i["title"])} ({escape(i["area"])})</title>'
      f'<link>{escape(i["link"])}</link>'
      f'<guid isPermaLink="false">bhb-{escape(i["id"])}</guid>'
      f'<category>{escape(i["category"])}</category>'
      f'<pubDate>{pub}</pubDate>'
      f'<enclosure url="{url}" length="{size}" type="image/jpeg"/>'
      f'<media:content url="{url}" medium="image" type="image/jpeg"/>'
      f'<media:thumbnail url="{url}"/>'
      f'<description>{escape(plain)}</description>'
      f'<content:encoded><![CDATA[{html}]]></content:encoded></item>')
    js.append({"id": i["id"], "title": i["title"], "area": i["area"], "category": i["category"],
               "when": when(i), "start": i["start"], "end": i["end"], "summary": i["summary"],
               "hook": hook, "link": i["link"], "image": url, "credit": i.get("credit")})
out.append("</channel></rss>")
open(os.path.join(here, "whats-on.xml"), "w", encoding="utf-8").write("\n".join(out))
json.dump({"built": today.isoformat(), "rooms": LINK, "items": js},
          open(os.path.join(here, "whats-on.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(live), "of", len(items), "items live")
