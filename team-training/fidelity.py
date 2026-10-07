"""Compares every session's 10 checks with the original trainer: same questions in the same order, same right answers.
python team-training/fidelity.py   (run from the repo root)"""
import json,re,glob,os,sys
tr={t['code']:t for t in json.load(open('team-training/source/trainers.json',encoding='utf8'))}
norm=lambda s: re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
bad=0
for f in sorted(glob.glob('team-training/sessions/10mt-*.json')):
    j=json.load(open(f,encoding='utf8')); t=tr.get(j.get('code')); 
    if not t: print(f,'no trainer'); bad+=1; continue
    ch=[c for c in j['cards'] if c['kind']=='check']; msgs=[]
    for q,c in zip(t['questions'],ch):
        a=q['answer']
        if q['type']=='tf':
            want = a.strip().lower().startswith('true')
            if c['type']!='tf' or c['answer']!=want: msgs.append(f"Q{q['n']} tf answer differs (sheet {a})")
        elif q['type']=='mc':
            want=re.sub(r'^[a-d]\)\s*','',a).strip()
            if c['type']!='choice': msgs.append(f"Q{q['n']} not choice"); continue
            got=c['options'][c['answer']]
            if norm(want) not in norm(got) and norm(got) not in norm(want): msgs.append(f"Q{q['n']} right answer '{got}' vs sheet '{want}'")
        # question wording must still be recognisably the same
        words=set(norm(q['q']).split())-{'the','a','an','is','are','to','of','you','your','what','which','a'}
        gw=set(norm(c['q']).split())
        if words and len(words&gw)/len(words)<0.5: msgs.append(f"Q{q['n']} wording differs: '{c['q'][:60]}' vs '{q['q'][:60]}'")
    if len(ch)!=10: msgs.append(f'{len(ch)} checks')
    if msgs: bad+=1; print(os.path.basename(f), '; '.join(msgs))
print('done', 'problems in', bad, 'sessions')
