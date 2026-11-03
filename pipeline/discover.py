"""Discover candidate games from local HN corpora; no fixed title list required.

Raw archives and network caches stay outside the published repository. Reviewed
entity decisions are durable; algorithmic sentiment never becomes verification.
"""
import argparse, collections, csv, datetime as dt, gzip, hashlib, html, json, re, time, unicodedata
from pathlib import Path
from . import ingest

GAME_CONTEXT = re.compile(r'\b(video games?|computer games?|pc games?|gaming|gameplay|gamer|gamers|videogames?|steam|roguelike|platformer|rpg|playthrough|game engine|indie game|browser game|game recommendations?|favorite games?|favourite games?|games? (?:you|that|like|recommend|played)|tetris)\b', re.I)
STEAM = re.compile(r'(?:store\.steampowered\.com/app/|store\.steampowered\.com/agecheck/app/)(\d+)', re.I)
TITLE = re.compile(r"\b[A-Z][A-Za-z0-9'’:+-]*(?:\s+(?:(?:of|the|and|a|to|in|for)\s+)?(?:[A-Z][A-Za-z0-9'’:+-]*|[0-9]+)){0,6}\b")
STOP = set('I A The This That It Its And But Or So My You Your We Our They Their There Here What Why How When Where Which With Without Yes No Not Also Just For From To In On At As If Is Are Was Were Be Been Have Has Had Do Does Did Can Could Would Should Will May Might Steam Windows Linux Mac Apple Microsoft Google Github Python Javascript Java Rust C HTML HTTP HTTPS AI API HN Ask Show News Hacker Open Source Free Really Very More Most Some One Two First Last Good Great Thanks Thank Edit Update Note People Personally Actually Unfortunately Fortunately However Anyway English US USA PC PS Xbox Nintendo Switch'.casefold().split())

STOP.update("""of a an the and or to for in on with from by at into its it's i've that's there's i'll then these well because android while after facebook like don't nvidia sure you're many yeah sony they're intel youtube perhaps unity once those another internet store amazon same since gpus play world every instead although gamers netflix edit right epic only having flash playstation blizzard software sometimes please apple's engine everything japanese china mario seems what's look life both steam's wine opengl other let's american back probably unless using something especially online sorry apis super imagine still call though twitter discord proton obviously quest oculus time reddit nothing plus twitch star take given make valve's finally rpgs isn't japan chinese being part atari think indie chrome interesting meanwhile macbook computer much basically things everyone fortress anyone again making nobody over honestly you'll html5 today otherwise someone warcraft john sounds machine modern apparently duty we've cpus europe best second iirc hopefully playing mobile microsoft's basic city wars halo can't looking firefox never before imho except similarly looks fantasy final about none photoshop exactly you'd check mmos currently live social zynga he's adobe agreed each metal getting dark kids ryzen nice definitely give team wikipedia office steamvr gear that'd also comes gets want really very used use years year sure almost rather less enough any said say did do just game games gaming video windows linux mac apple microsoft google github python javascript java rust http https api hn ask show news hacker open source free""".split())

def normal(s):
    s=unicodedata.normalize('NFKD',s).casefold().replace('™','').replace('®','')
    return re.sub(r'[^a-z0-9]+',' ',s).strip()

def candidates(text):
    result=set()
    for m in TITLE.finditer(text):
        words=m.group().split()
        # Subphrases accommodate a sentence starting "Try Slay the Spire".
        for i in range(len(words)):
            for j in range(i+1,min(len(words),i+6)+1):
                phrase=' '.join(words[i:j]).strip(':+-')
                if words[i].casefold() in STOP or words[j-1].casefold() in STOP:continue
                if len(phrase)<4 or len(phrase)>70:continue
                result.add(phrase)
    return result

def file_hash(path):
    digest=hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
    return digest.hexdigest()

def scan(comments, stories, out):
    out.mkdir(parents=True,exist_ok=True)
    counts=collections.Counter(); titles={}; steam=collections.defaultdict(set); years=collections.Counter(); kinds=collections.Counter(); seen=set(); kept=0
    records_path=out/'records.jsonl'
    with records_path.open('w') as dest:
        def accept(row):
            nonlocal kept
            if row['id'] in seen:return
            seen.add(row['id']);kinds[row['kind']]+=1;years[row['date'][:4]]+=1
            text=ingest.plain(row['text']); context=ingest.plain(row['storyTitle']); links=html.unescape(row.get('outboundUrl','')+' '+row['text'])
            ids=STEAM.findall(links)
            if not (ids or GAME_CONTEXT.search(text+' '+context)):return
            row['text']=text;row['storyTitle']=context;row['steamIds']=list(set(ids))
            dest.write(json.dumps(row,ensure_ascii=False)+'\n');kept+=1
            for appid in ids:steam[appid].add(row['id'])
            for title in candidates(text):
                key=normal(title);counts[key]+=1;titles.setdefault(key,title)
        with gzip.open(comments,'rt') as f:
            for line in f:
                if not line.strip():continue
                x=json.loads(line)
                if x.get('deleted') or x.get('dead'):continue
                sid=str(x.get('story_id') or '')
                if not sid:continue # never invent a parent thread
                accept({'id':str(x['objectID']),'kind':'comment','author':x.get('author','unknown'),'date':dt.datetime.fromtimestamp(x['created_at_i'],dt.timezone.utc).isoformat(),'text':x.get('comment_text',''),'storyId':sid,'storyTitle':x.get('story_title',''),'outboundUrl':''})
        with stories.open() as f:
            for x in csv.DictReader(f):
                accept({'id':str(x['object_id']),'kind':'story','author':x.get('author','unknown'),'date':dt.datetime.fromtimestamp(int(x['created_at_i']),dt.timezone.utc).isoformat(),'text':x['title'],'storyId':str(x['object_id']),'storyTitle':x['title'],'outboundUrl':x.get('url','')})
    result={'scanned':dict(kinds),'years':dict(sorted(years.items())),'gamingContextRecords':kept,'steamApps':[{'id':k,'sourceCount':len(v)} for k,v in sorted(steam.items(),key=lambda kv:-len(kv[1]))],'titleCandidates':[{'title':titles[k],'key':k,'sourceCount':n} for k,n in counts.most_common() if n>=3],'sampling':'User-provided sampled HN corpus. Whole-day/cluster sampling; not exhaustive or i.i.d. No population estimates.','inputs':[{'name':p.name,'bytes':p.stat().st_size,'sha256':file_hash(p)} for p in [comments,stories]]}
    (out/'scan.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['scanned','gamingContextRecords']}));print(len(steam),'Steam app IDs;',len(result['titleCandidates']),'repeated title candidates')

def is_game(d):
    software={'50','51','52','53','54','55','56','57','58','59','60'}
    return d.get('type')=='game' and not any(str(g['id']) in software for g in d.get('genres',[]))

def cached(url,path):
    if path.exists():return json.loads(path.read_text())
    data=ingest.fetch(url);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data));time.sleep(.45);return data

def resolve(out,limit):
    scan=json.loads((out/'scan.json').read_text());matches={};queue=[]
    for item in scan['steamApps']:
        appid=item['id']
        try:
            info=cached('https://store.steampowered.com/api/appdetails?appids='+appid+'&l=english&cc=us',out/'steam'/f'{appid}.json').get(appid,{})
            d=info.get('data',{})
            if is_game(d):matches[appid]={'appId':appid,'name':d['name'],'method':'explicit Steam app URL','candidate':d['name'],'sourceCount':item['sourceCount']}
        except Exception as e:print('Metadata failed',appid,str(e),flush=True)
    print('Linked game apps:',len(matches),flush=True)
    plausible=[v for v in scan['titleCandidates'] if not any(w in STOP for w in [v['title'].casefold().split()[0],v['title'].casefold().split()[-1]]) and "'" not in v['title'] and len(v['title'])>3]
    for item in plausible[:limit]:
        title=item['title']; key=item['key']
        if any(normal(v['name'])==key for v in matches.values()):continue
        try:
            data=cached('https://store.steampowered.com/api/storesearch/?'+ingest.urllib.parse.urlencode({'term':title,'l':'english','cc':'us'}),out/'search'/(hashlib.sha256(key.encode()).hexdigest()[:16]+'.json'))
            exact=[v for v in data.get('items',[]) if normal(v['name'])==key]
            for v in exact:
                appid=str(v['id']);d=cached('https://store.steampowered.com/api/appdetails?appids='+appid+'&l=english&cc=us',out/'steam'/f'{appid}.json').get(appid,{}).get('data',{})
                if is_game(d):matches.setdefault(appid,{'appId':appid,'name':d['name'],'method':'exact metadata title match; entity review required','candidate':title,'sourceCount':item['sourceCount']})
        except Exception as e:print('Search failed',title,str(e),flush=True)
        (out/'resolved.json').write_text(json.dumps(list(matches.values()),indent=2)+'\n')
    (out/'resolved.json').write_text(json.dumps(list(matches.values()),indent=2)+'\n');print('Resolved',len(matches),'game identities for review',flush=True)

def threads(out, limit):
    """Expand discovery from whole recommendation threads and Show HN submissions."""
    queries=['Ask HN games recommend','Ask HN favorite video games','Ask HN games playing','Ask HN best computer games','Show HN game','Show HN browser game']
    stories={}
    for query in queries:
        data=cached('https://hn.algolia.com/api/v1/search?'+ingest.urllib.parse.urlencode({'query':query,'tags':'story','hitsPerPage':100,'typoTolerance':'false'}),out/'threads'/(hashlib.sha256(query.encode()).hexdigest()[:12]+'.json'))
        for h in data.get('hits',[]):
            title=h.get('title','')
            if re.search(r'board game|game engine|game dev|game theory|game revenue|video lecture',title,re.I):continue
            if re.search(r'^Ask HN:',title,re.I) and re.search(r'games?|gaming',title,re.I) or re.search(r'^Show HN:',title,re.I) and re.search(r'games?|gaming',title,re.I):stories[h['objectID']]=h
    chosen=sorted(stories.values(),key=lambda h:-(h.get('num_comments') or 0))[:limit]
    records={r['id']:r for r in map(json.loads,(out/'records.jsonl').read_text().splitlines())}
    for h in chosen:
        sid=str(h['objectID']);tree=cached('https://hn.algolia.com/api/v1/items/'+sid,out/'threads'/('item-'+sid+'.json'))
        def walk(node):
            text=ingest.plain(node.get('text') or node.get('title') or '')
            if text and not node.get('deleted') and not node.get('dead'):
                rid=str(node['id']);records.setdefault(rid,{'id':rid,'kind':'story' if rid==sid else 'comment','author':node.get('author','unknown'),'date':node.get('created_at',''),'text':text,'storyId':sid,'storyTitle':h['title'],'outboundUrl':h.get('url','') if rid==sid else '', 'steamIds':list(set(STEAM.findall(html.unescape(node.get('text') or ''))))})
            for child in node.get('children',[]):walk(child)
        walk(tree)
    (out/'records.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records.values()))
    summary=json.loads((out/'scan.json').read_text());summary['additionalThreads']=[{'id':str(h['objectID']),'title':h['title']} for h in chosen]
    counts=collections.Counter();titles={};apps=collections.defaultdict(set)
    for r in records.values():
        for appid in r.get('steamIds',[]):apps[appid].add(r['id'])
        for title in candidates(r['text']):
            key=normal(title);counts[key]+=1;titles.setdefault(key,title)
    summary['steamApps']=[{'id':k,'sourceCount':len(v)} for k,v in sorted(apps.items(),key=lambda kv:-len(kv[1]))]
    summary['titleCandidates']=[{'title':titles[k],'key':k,'sourceCount':n} for k,n in counts.most_common() if n>=3]
    summary['gamingContextRecords']=len(records)
    (out/'scan.json').write_text(json.dumps(summary,indent=2)+'\n');print('Fetched',len(chosen),'whole threads;',len(records),'discovery records;',len(apps),'app IDs')

def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
    s=sub.add_parser('scan');s.add_argument('--comments',type=Path,required=True);s.add_argument('--stories',type=Path,required=True);s.add_argument('--out',type=Path,required=True)
    s=sub.add_parser('threads');s.add_argument('--out',type=Path,required=True);s.add_argument('--limit',type=int,default=30)
    s=sub.add_parser('resolve');s.add_argument('--out',type=Path,required=True);s.add_argument('--limit',type=int,default=300)
    a=p.parse_args()
    if a.command=='scan':scan(a.comments,a.stories,a.out)
    elif a.command=='threads':threads(a.out,a.limit)
    else:resolve(a.out,a.limit)
if __name__=='__main__':main()
