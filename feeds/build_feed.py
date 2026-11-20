"""Builds whats-on.xml from items.json. Items drop out once their end date has passed.
Run:  python build_feed.py   (from this folder)"""
import json, datetime as dt, email.utils as eu
from xml.sax.saxutils import escape
BASE = "https://app.blackhorsebeamish.co.uk/feeds/"
today = dt.date.today()
items = json.load(open("items.json", encoding="utf-8"))
live = [i for i in items if dt.date.fromisoformat(i["end"]) >= today]
live.sort(key=lambda i: (i["start"], i["title"]))
HOOK = {
 "Beamish": "Beamish Museum is just up the road from us: spend the day in the 1900s town, then come back to the Black Horse for dinner or stay in one of our rooms or cottages.",
 "Christmas": "Make it a festive break: a relaxed countryside pub with rooms and cottages, in Beamish with Durham and Newcastle within easy reach.",
 "Markets": "Browse by day, then come back to the Black Horse for a proper dinner and a comfortable bed.",
 "Music": "Make an evening of it and stay with us, a relaxed countryside pub with rooms and cottages near Durham.",
 "Family": "Bring the whole family: our rooms and cottages are a relaxed base for a family break.",
 "Exhibition": "Combine it with a night at the Black Horse, with rooms and cottages in the County Durham countryside.",
}
LINK = "https://www.blackhorsebeamish.co.uk/luxury-rooms-cottages"
def rfc(d): return eu.format_datetime(dt.datetime.combine(d, dt.time(8, 0), tzinfo=dt.timezone.utc))
out = ['<?xml version="1.0" encoding="UTF-8"?>',
 '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
 '<title>What\'s on near the Black Horse Beamish</title>',
 '<link>https://www.blackhorsebeamish.co.uk/news</link>',
 f'<atom:link href="{BASE}whats-on.xml" rel="self" type="application/rss+xml"/>',
 '<description>Christmas events, markets, exhibitions and days out in Beamish, County Durham and the wider North East, picked for our guests.</description>',
 '<language>en-gb</language>',
 f'<lastBuildDate>{rfc(today)}</lastBuildDate>']
for i in live:
    s, e = dt.date.fromisoformat(i["start"]), dt.date.fromisoformat(i["end"])
    when = f'{s.day} {s.strftime("%b %Y")}' if s == e else f'{s.day} {s.strftime("%b")} to {e.day} {e.strftime("%b %Y")}'
    out.append("<item>"
      f'<title>{escape(i["title"])} ({escape(i["area"])})</title>'
      f'<link>{escape(i["link"])}</link>'
      f'<guid isPermaLink="false">bhb-{escape(i["id"])}</guid>'
      f'<category>{escape(i["category"])}</category>'
      f'<pubDate>{rfc(min(max(s - dt.timedelta(days=7), dt.date(2026,11,20)), today))}</pubDate>'
      f'<description>{escape(when + ". " + i["summary"] + " " + HOOK.get(i["category"], HOOK["Christmas"]) + " Rooms and cottages: " + LINK)}</description></item>')
out.append("</channel></rss>")
open("whats-on.xml", "w", encoding="utf-8").write("\n".join(out))
print(len(live), "of", len(items), "items live")
