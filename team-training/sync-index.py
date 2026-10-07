"""Copies title, icon, blurb and group from each 10mt session file into sessions/index.json, and writes CHECKS-FOR-GM.md
(every CHECK note and every siteNote, by session).  python team-training/sync-index.py  (from the repo root)"""
import json,os
idx=json.load(open('team-training/sessions/index.json',encoding='utf8'))
checks=["# Things to confirm before relying on each module\n","Every `CHECK` below was raised while turning the paper 10-minute trainers into modules: something the trainer says that may be out of date, or a venue fact to confirm. The module teaches what the trainer says unless it is clearly wrong; change the wording in the module (or the trainer) once you have decided.\n"]
site=["# Venue facts the modules leave to \"your manager\"\n","Agree each answer once, then brief managers so they can show new starters.\n"]
miss=[]
for e in idx['sessions']:
    f='team-training/'+e['file']
    if not os.path.exists(f): miss.append(e['key']); continue
    j=json.load(open(f,encoding='utf8'))
    for k in ('title','icon','blurb','group'):
        if j.get(k): e[k]=j[k]
    c=[n for n in j.get('legalNotes',[]) if 'CHECK' in n]
    if c: checks.append(f"\n## {e['icon']} {e['title']} ({e['code']})\n"+'\n'.join('- [ ] '+n.replace('CHECK:','').replace('CHECK','').strip(' :') for n in c))
    if j.get('siteNotes'): site.append(f"\n## {e['icon']} {e['title']} ({e['code']})\n"+'\n'.join('- [ ] '+n for n in j['siteNotes']))
json.dump(idx,open('team-training/sessions/index.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
open('team-training/CHECKS-FOR-GM.md','w',encoding='utf8').write('\n'.join(checks)+'\n')
open('team-training/SITE-NOTES.md','w',encoding='utf8').write('\n'.join(site)+'\n')
print('synced',len(idx['sessions'])-len(miss),'missing',miss)
