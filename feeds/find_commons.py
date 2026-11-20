import urllib.request, urllib.parse, json, re, sys
UA={"User-Agent":"BlackHorseNewsPhotos/1.0 (venue website; contact via site)"}
def api(**p):
    p["format"]="json"; u="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
OK=("cc by","cc-by","cc0","public domain","pd","cc by-sa","cc-by-sa")
def search(q,n=12):
    r=api(action="query",generator="search",gsrsearch=q+" filetype:bitmap",gsrnamespace=6,gsrlimit=n,prop="imageinfo",iiprop="url|size|extmetadata|mime",iiurlwidth=900)
    out=[]
    for p in (r.get("query",{}).get("pages",{}) or {}).values():
        ii=p["imageinfo"][0]; m=ii.get("extmetadata",{})
        lic=m.get("LicenseShortName",{}).get("value","?"); art=re.sub("<[^>]+>","",m.get("Artist",{}).get("value","?"))[:60]
        if ii["mime"]!="image/jpeg": continue
        if not any(k in lic.lower() for k in ("cc by","cc0","public domain")): continue
        if "nc" in lic.lower().split("cc")[-1][:8] or "nd" in lic.lower().split()[-1:] : continue
        out.append(dict(title=p["title"],lic=lic,artist=art,w=ii["width"],h=ii["height"],thumb=ii["thumburl"],page=ii["descriptionurl"]))
    return out
Q=json.loads(sys.argv[1])
res={}
for k,q in Q.items():
    try: res[k]=search(q)
    except Exception as e: res[k]=[]; print("ERR",k,e)
    print(k,len(res[k]))
json.dump(res,open("candidates.json","w"),indent=1)
