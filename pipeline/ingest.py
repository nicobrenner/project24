"""Reproducible, conservative HN catalog collection. Standard library only."""
import tempfile
import hashlib
import argparse, datetime as dt, html, json, re, sqlite3, time, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VERSION='rules-v1'
def read(path, fallback=None):
 return json.loads(path.read_text()) if path.exists() else fallback
def plain(value):
 return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',value or ''))).strip()
def matches(text, alias):
 return bool(re.search(r'(?<!\w)'+re.escape(alias)+r'(?!\w)',text,re.I))
def detect(game,text,context=''):
 aliases=[game['title']]+game['aliases']
 locations=[m for alias in aliases for m in re.finditer(r'(?<!\w)'+re.escape(alias)+r'(?!\w)(?!\s*(?:2|II|Silksong)\b)',text,re.I)]
 if game['id']=='portal':
  # Generic teleport portals and hardware/products are not Valve's game.
  locations=[m for m in locations if m.group()=='Portal' or re.search(r'Valve|Aperture|GLaDOS',text[max(0,m.start()-80):m.end()+100])]
  if re.search(r'playstation.{0,3}portal|time portal|captive portal|login portal',text,re.I):return False
 if game['id']=='a-dark-room':
  # Ordinary dark rooms are very common in comments about other games.
  locations=[m for m in locations if m.group()=='A Dark Room' or 'adarkroom.doublespeakgames.com' in text.lower() or (m.start()>0 and text[m.start()-1] in '"“' and text[m.end():m.end()+1] in '"”')]
 if not locations:return False
 if game['id'] in {'portal','the-witness','celeste','noita','2048','ftl-faster-than-light','a-dark-room'}:
  nearby=' '.join(text[max(0,m.start()-120):m.end()+140] for m in locations)
  if game['id']=='the-witness':
   return bool(re.search(r'puzzle|jonathan blow|jblow|braid|the-witness.net|steam|the witness.{0,30}game|game.{0,30}the witness',nearby+' '+context,re.I))
  if game['id']=='portal' and re.search(r'portal (?:website|server|login|access|account)|captive portal',nearby,re.I):return False
  return bool(re.search(r'\b(game|games|gaming|played|playing|playthrough|puzzle|steam|valve|platformer|roguelike|dungeon|idle|webgl)\b',nearby+' '+context,re.I))
 return True
def classify(text):
 if re.search(r'\b(recommend|recommended|favorite|favourite|masterpiece|great game|amazing game|love this game|loved it)\b',text,re.I): return 'candidate',.65
 if re.search(r'\b(boring|disappointing|terrible|hate|hated)\b',text,re.I): return 'criticism',.55
 if re.search(r'\b(source code|engine|rendering|implementation|algorithm|performance|webgl)\b',text,re.I): return 'technical',.55
 return 'mention',.8
def excerpt(text,game):
 if len(text)<=600:return text
 indices=[m.start() for a in [game['title']]+game['aliases'] for m in re.finditer(re.escape(a),text,re.I)]
 start=max(0,min(indices or [0])-180)
 return ('…' if start else '')+text[start:start+598]+('…' if start+598<len(text) else '')
def fetch(url):
 for attempt in range(4):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PROJECT 24/0.1 public-data-index'}),timeout=40) as res:return json.load(res)
  except Exception:
   if attempt==3:raise
   time.sleep(2**attempt)

def import_cache(cache, metadata, previous=None, preserve_totals=True):
 seeds=read(ROOT/'data/seeds.json'); records=[]; queries=[]
 for g in seeds:
  if g.get('steamAppId'):
   detail=read(metadata/f"{g['id']}.json",{}).get(str(g['steamAppId']),{}).get('data',{})
   if detail:
    g['coverUrl']=detail.get('header_image',g['coverUrl'])
    g['platforms']=[{'windows':'Windows','mac':'macOS','linux':'Linux'}.get(k,k) for k,v in detail.get('platforms',{}).items() if v]
    g['releaseDate']=detail.get('release_date',{}).get('date','')
  g['releaseDate']=g.get('releaseDate') or ''
  for kind in ['comment','story']:
   paths=sorted(cache.glob(f"{g['id']}-{kind}*.json"))
   for p in paths:
    result=read(p,{})
    queries.append({'gameId':g['id'],'kind':kind,'page':result.get('page',0),'reportedSearchMatches':result.get('nbHits',0)})
    for hit in result.get('hits',[]):
     text=plain(hit.get('comment_text') if kind=='comment' else (hit.get('title','')+' '+(hit.get('story_text') or '')))
     context=plain(hit.get('story_title',''))
     if g.get('discoveredFrom'):
      from pipeline.catalogue import entity_match
      from pipeline.discover import STEAM
      raw=(hit.get('comment_text') or '')+' '+(hit.get('url') or '')
      if not entity_match(g,{'text':text,'storyTitle':context,'kind':kind,'steamIds':STEAM.findall(raw)}):continue
     elif not detect(g,text,context):continue
     label,confidence=classify(text)
     records.append({'gameId':g['id'],'id':str(hit['objectID']),'url':'https://news.ycombinator.com/item?id='+str(hit['objectID']),'author':hit.get('author','unknown'),'date':hit.get('created_at',''),'text':excerpt(text,g),'kind':kind,'storyTitle':context if kind=='comment' else plain(hit.get('title','')),'storyUrl':'https://news.ycombinator.com/item?id='+str(hit.get('story_id') or hit['objectID']),'classification':label,'confidence':confidence,'provenance':VERSION+' heuristic; not a verified recommendation'})
 records.extend(read(ROOT/'data/curated-mentions.json',[]))
 records=list({(r['gameId'],r['id']):r for r in records}.values())
 if previous:
  records=list({(r['gameId'],r['id']):r for r in previous['records']+records}.values())
  # Preserve baseline all-time query totals; incremental totals cover only the new interval.
  if preserve_totals:queries=previous['queries']
 snapshot={**({'discoveryUpdatedAt':previous['discoveryUpdatedAt']} if previous and 'discoveryUpdatedAt' in previous else {}),'collectedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'queries':queries,'records':records}
 (ROOT/'data/seeds.json').write_text(json.dumps(seeds,indent=2)+'\n')
 (ROOT/'data/snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
 export()
def export():
 snapshot=read(ROOT/'data/snapshot.json',{'records':[],'queries':[],'collectedAt':''})
 tabletop_records=read(ROOT/'data/tabletop-mentions.json',[])
 all_records=snapshot['records']+tabletop_records
 theme_data=read(ROOT/'data/classifiers/theme-predictions.json',{}); theme_predictions=theme_data.get('predictions',{})
 sentiment_data=read(ROOT/'data/classifiers/sentiment-predictions.json',{}); sentiment_predictions=sentiment_data.get('predictions',{})
 reviews=read(ROOT/'data/reviews.json',[]); lookup={(r['gameId'],r['id']):r for r in reviews}
 con=sqlite3.connect(ROOT/'data/catalog.sqlite');con.execute('CREATE TABLE IF NOT EXISTS mentions(game_id TEXT, id TEXT, payload TEXT, PRIMARY KEY(game_id,id))');con.execute('DELETE FROM mentions')
 games=[]
 for seed in read(ROOT/'data/seeds.json')+read(ROOT/'data/tabletop-games.json',[]):
  g={k:v for k,v in seed.items() if k!='steamAppId'}; mentions=[]
  g.setdefault('medium','video')
  for row in all_records:
   if row['gameId']!=g['id']:continue
   m={k:v for k,v in row.items() if k!='gameId'}; review=lookup.get((g['id'],m['id']))
   if review:
    if review['excerpt'] not in m['text']:raise ValueError('Review excerpt not in source: '+m['id'])
    m.update(classification=review['classification'],confidence=review['confidence'],provenance=review['provenance']+'; '+review['reason'])
   prediction=theme_predictions.get(hashlib.sha256(m['text'].encode()).hexdigest())
   if prediction and prediction['label']!='general' and prediction['confidence']>=theme_data['model']['threshold']:
    m['theme']={k:prediction[k] for k in ['label','name','confidence']};m['theme']['model']=theme_data['model']['id']
   sentiment=sentiment_predictions.get(hashlib.sha256(m['text'].encode()).hexdigest())
   if sentiment:m['sentiment']={k:sentiment[k] for k in ['label','name','model','provenance']}
   mentions.append(m);con.execute('INSERT INTO mentions VALUES(?,?,?)',(g['id'],m['id'],json.dumps(m)))
  mentions.sort(key=lambda m:(m['classification']!='recommendation',m['kind']!='comment',m['id']))
  totals={kind:max([q['reportedSearchMatches'] for q in snapshot['queries'] if q['gameId']==g['id'] and q['kind']==kind] or [0]) for kind in ['comment','story']}
  g.update(mentions=mentions,keywordMatches=sum(totals.values()) if any(q['gameId']==g['id'] for q in snapshot['queries']) else None,verifiedRecommendations=sum(m['classification']=='recommendation' for m in mentions),discussionCount=len({m['storyUrl'] for m in mentions}),showHN=any(m.get('showHNSubmission') for m in mentions) or any(r.get('showHNLaunch') and r['gameId']==g['id'] and any(m['id']==r['id'] for m in mentions) for r in reviews))
  sentiment_counts={label:sum(m.get('sentiment',{}).get('label')==label for m in mentions if m['kind']=='comment') for label in ['positive','negative','mixed']}
  evidence_count=sum(sentiment_counts.values())
  if sentiment_counts['mixed'] or (sentiment_counts['positive'] and sentiment_counts['negative']):summary_label='mixed'
  elif sentiment_counts['positive']:summary_label='positive'
  elif sentiment_counts['negative']:summary_label='negative'
  else:summary_label='unclear'
  g['sentimentSummary']={'label':summary_label,'evidenceCount':evidence_count}
  theme_groups={}
  for m in mentions:
   if m.get('theme'):
    t=m['theme'];group=theme_groups.setdefault(t['label'],{'label':t['label'],'name':t['name'],'count':0});group['count']+=1
  g['themes']=sorted(theme_groups.values(),key=lambda x:(-x['count'],x['label']))
  games.append(g)
 con.commit();con.close()
 result={'generatedAt':max(snapshot['collectedAt'],snapshot.get('discoveryUpdatedAt','')),'coverage':{'description':f'{len(games)} games identified in sampled historical HN records and recommendation threads, including a separately curated tabletop pilot. Counts describe collected, context-filtered evidence, not the entire HN archive.','method':'Sampled local HN archive, whole discussion threads, and bounded Algolia searches. Explicit game URLs and reviewed title identities; conservative context checks.','keywordMatches':'Raw Algolia-reported comment plus story query matches at baseline collection, before disambiguation. These are not unique verified game mentions or recommendations. Incremental updates preserve this baseline.', 'recommendations':'Only positive game endorsements individually source-reviewed by Codex count as verified. These are agent reviews, not independent human verification. Heuristic candidates are separate and unverified.','ranking':'Verified recommendations rank this sample; unequal search coverage and editorial review mean this is not a census.','limitations':['Sampled archive and selected recommendation threads; not an exhaustive HN archive.','Comments can discuss multiple games. Heuristic labels may be wrong.','Show HN Games lists curated creator launch posts from the sampled submission archive. A launch post is a mention, not a recommendation or quality endorsement.','Sentiment dots are uncalibrated phrase-cue signals over excerpts, not game ratings or community consensus.','Tabletop is a small manually selected archive pilot, not a complete tabletop index.'],'archive':read(ROOT/'data/discovery-coverage.json',{}),'themeClassifier':theme_data.get('model'),'sentimentClassifier':sentiment_data.get('model'),'source':'https://hn.algolia.com/api','snapshotRecords':len(all_records)},'games':games}
 (ROOT/'public/data').mkdir(parents=True,exist_ok=True)
 (ROOT/'public/data/catalog.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f"Exported {len(games)} games, {len(all_records)} evidence records, {sum(g['verifiedRecommendations'] for g in games)} reviewed recommendations")
def collect(pages,incremental):
 if pages<1:raise ValueError('--pages must be positive')
 old=read(ROOT/'data/snapshot.json')
 # Fresh temporary cache prevents stale page/query results contaminating a new run.
 with tempfile.TemporaryDirectory(prefix='hackergames-') as folder:
  cache=Path(folder)
  for g in read(ROOT/'data/seeds.json'):
   for kind in ['comment','story']:
    for page in range(pages):
     params={'query':'"'+g['title']+'"','tags':kind,'hitsPerPage':100 if kind=='comment' else 40,'page':page}
     if old and incremental:
      timestamp=int(dt.datetime.fromisoformat(old['collectedAt']).timestamp())-86400
      params['numericFilters']='created_at_i>'+str(timestamp)
     data=fetch('https://hn.algolia.com/api/v1/search?'+urllib.parse.urlencode(params))
     if old and incremental and data.get('nbPages',0)>pages:
      raise RuntimeError(f"Incremental coverage incomplete for {g['id']} {kind}: {data['nbPages']} pages available, --pages={pages}. Snapshot and watermark unchanged; rerun with a higher --pages value.")
     (cache/f"{g['id']}-{kind}-{page}.json").write_text(json.dumps(data));time.sleep(.35)
     if page+1>=data.get('nbPages',1):break
  import_cache(cache,ROOT/'data/metadata-cache',previous=old,preserve_totals=incremental)
def metadata():
 cache=ROOT/'data/metadata-cache';cache.mkdir(exist_ok=True)
 for g in read(ROOT/'data/seeds.json'):
  if g.get('steamAppId'):
   result=fetch('https://store.steampowered.com/api/appdetails?appids='+str(g['steamAppId']))
   (cache/f"{g['id']}.json").write_text(json.dumps(result));time.sleep(.5)
   detail=result.get(str(g['steamAppId']),{}).get('data',{})
   if detail:
    g['coverUrl']=detail.get('header_image',g['coverUrl'])
    g['platforms']=[{'windows':'Windows','mac':'macOS','linux':'Linux'}.get(k,k) for k,v in detail.get('platforms',{}).items() if v]
    g['releaseDate']=detail.get('release_date',{}).get('date','')
  # Seed fields are the durable metadata cache; failed API results preserve them.
  seeds=read(ROOT/'data/seeds.json');seeds=[g if x['id']==g['id'] else x for x in seeds]
  (ROOT/'data/seeds.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n')
 export()
def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
 c=sub.add_parser('collect');c.add_argument('--pages',type=int,default=1);c.add_argument('--incremental',action='store_true')
 sub.add_parser('metadata');sub.add_parser('export');c=sub.add_parser('import-cache');c.add_argument('cache',type=Path);c.add_argument('metadata',type=Path)
 a=p.parse_args()
 if a.command=='collect':collect(a.pages,a.incremental)
 elif a.command=='metadata':metadata()
 elif a.command=='import-cache':import_cache(a.cache,a.metadata)
 else:export()
if __name__=='__main__':main()
