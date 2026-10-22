import json,re,unicodedata
d=json.load(open('/tmp/chv/wordlists/exclusive/old/1.json'))
ced={}
for l in open('/tmp/cedict_ts.u8'):
  if l.startswith('#'):continue
  m=re.match(r'(\S+) (\S+) \[([^\]]+)\] /(.*)/',l)
  if m and len(m[2])==1: ced.setdefault(m[2],[]).append((m[3],m[4].split('/')))
TM={'a':'āáǎà','e':'ēéěè','i':'īíǐì','o':'ōóǒò','u':'ūúǔù','ü':'ǖǘǚǜ'}
def mark(s):
  s=s.lower().replace('u:','ü');t=int(s[-1]) if s[-1].isdigit() else 5;s=s.rstrip('012345')
  if t==5:return s
  for v in 'ae':
    if v in s:return s.replace(v,TM[v][t-1],1)
  if 'ou' in s:return s.replace('o',TM['o'][t-1],1)
  for i in range(len(s)-1,-1,-1):
    if s[i] in TM:return s[:i]+TM[s[i]][t-1]+s[i+1:]
  return s
def base(s):
  s=unicodedata.normalize('NFD',s.lower());return ''.join(c for c in s if not unicodedata.combining(c)).replace('ü','v').replace('u:','v').rstrip('012345')
def tone(s):
  if s[-1].isdigit():return int(s[-1])
  for c in unicodedata.normalize('NFD',s):
    o=ord(c);r={0x304:1,0x301:2,0x30c:3,0x300:4}.get(o)
    if r:return r
  return 5
BAD=re.compile(r'^(surname|variant of|old variant|used in|abbr|archaic|\(archaic|\(old\)|see |Japanese variant|\(dialect|\(Cant)')
def clean(defs):
  g=[x for x in defs if not BAD.match(x) and not x.startswith('CL:')]
  return g
words=[];chars=[];seen=set();log=[]
for x in d:
  fs=[f for f in x['forms'] if f['meanings'] and not BAD.match(f['meanings'][0]) and f['transcriptions']['pinyin'][0].islower()] or x['forms']
  f=fs[0];words.append({'w':x['simplified'],'p':f['transcriptions']['pinyin'],'m':'; '.join(f['meanings'][:2])})
for wd in words:
  syl=wd['p'].split(' ')
  for i,c in enumerate(wd['w']):
    if c in seen:continue
    seen.add(c)
    s=syl[i];b=base(s);t=tone(s)
    cands=[(p,clean(df)) for p,df in ced.get(c,[]) if base(p)==b and p[0].islower()]
    cands=[x for x in cands if x[1]]
    ex=[x for x in cands if tone(x[0])==t]
    if t==5: ex=[x for x in cands if tone(x[0])!=5] or ex
    pick=(ex or cands)
    if not pick: log.append(c);chars.append({'c':c,'p':s,'m':'(in '+wd['w']+')'});continue
    p,df=pick[0];chars.append({'c':c,'p':mark(p),'m':'; '.join(df[:2])})
OV=json.load(open('/tmp/ov.json'))
for ch in chars:
  if ch['c'] in OV: ch['p'],ch['m']=OV[ch['c']]
for ch in chars:
  e=sorted([w for w in words if ch['c'] in w['w']],key=lambda w:(len(w['w'])==1,len(w['w'])))[0]
  ch['ex']=e['w'];ch['exp']=e['p'];ch['exm']=e['m']
json.dump({'words':words,'chars':chars},open('/tmp/hsk1.json','w'),ensure_ascii=False)
print(len(chars),'unmatched',log)
for c in chars:print(c['c'],c['p'],'|',c['m'][:60],'|',c['ex'])
