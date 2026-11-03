"""Apply reviewed entity decisions to discovery records, preserving source reviews."""
import argparse, datetime as dt, hashlib, json, re
from pathlib import Path
from . import ingest
from .discover import normal, is_game, GAME_CONTEXT

def entity_match(game, row):
    app=str(game.get('steamAppId',''))
    if app and app in row.get('steamIds',[]):return 'Explicit Steam application URL in source'
    if game.get('discoveryMatchMode')=='explicit-url':return None
    text=row['text']; context=row.get('storyTitle','')
    if game['id']=='another-world':
        if not re.search(r'Chahi|Delphine|Amiga|platformer|Out [Oo]f [Tt]his World|Another World.{0,35}(?:game|1991)|game.{0,35}Another World',text+' '+context):return None
    if game['id']=='tetris' and re.search(r'\bTetris\b',text,re.I):
        if re.search(r'\b(play(?:ed|ing)?|puzzle|tetromino|falling|blocks|gameboy|nintendo|Pajitnov|games?|gaming)\b',text+' '+context,re.I) and not re.search(r'(?:calendar|schedule|parking|luggage|packing).{0,30}tetris|tetris.{0,30}(?:calendar|schedule|parking|luggage|packing)',text,re.I):return 'Tetris title with game context; franchise-level reference'
        return None
    if game['id'] in {'quake','counter-strike','half-life'} and re.search(re.escape(game['title'])+r'\s*(?:[2-9]|II|III|IV|Live|: Source|: Global|: Alyx)\b',text,re.I):return None
    if not ingest.detect(game,text,context):return None
    if game.get('discoveredFrom') and not GAME_CONTEXT.search(text+' '+context) and row['kind']!='story':return None
    return 'Boundary-aware title/alias match with contextual game disambiguation'

def publish(out, decisions_path):
    decisions=json.loads(decisions_path.read_text());seeds=ingest.read(ingest.ROOT/'data/seeds.json');by_app={str(g['steamAppId']):g for g in seeds if g.get('steamAppId')};by_id={g['id']:g for g in seeds}
    for decision in decisions['accepted']:
        if not decision.get('reason'):raise ValueError('Entity approval requires a reason')
        app=str(decision['appId'])
        if app in by_app:continue
        d=ingest.read(out/'steam'/f'{app}.json')[app]['data']
        if not is_game(d):raise ValueError('Non-game metadata rejected: '+app)
        title=decision.get('title') or re.sub('[™®]','',d['name']).strip();slug=decision.get('id') or normal(title).replace(' ','-')
        if slug in by_id:raise ValueError('Slug conflict: '+slug)
        genres=[x['description'].lower() for x in d.get('genres',[]) if x['description'] not in ['Indie','Early Access','Free To Play']]
        aliases=list(dict.fromkeys(decision.get('aliases',[])+([d['name']] if title!=d['name'] else [])))
        g={'id':slug,'title':title,'aliases':aliases,'genre':genres[0] if genres else 'game','genres':genres or ['game'],'platforms':[{'windows':'Windows','mac':'macOS','linux':'Linux'}[k] for k,v in d.get('platforms',{}).items() if v and k in {'windows','mac','linux'}],'releaseDate':d.get('release_date',{}).get('date',''),'description':decision.get('description') or ingest.plain(d.get('short_description',''))[:300], 'coverUrl':d.get('header_image',''),'metadataUrl':f'https://store.steampowered.com/app/{app}/','metadataAttribution':'Artwork, metadata, and description excerpt: Steam and the respective publisher. Release date refers to the credited Steam edition.','storeUrl':f'https://store.steampowered.com/app/{app}/','color':'#55634d','steamAppId':int(app),'discoveredFrom':'Local HN archive and broad recommendation-thread discovery; entity approval in data/entity-decisions.json','discoveryMatchMode':decision.get('matchMode','title-context')}
        if decision.get('description'):g['metadataAttribution']='Artwork and metadata: Steam and respective publisher. Summary: HackerGames editorial. Release date refers to the credited Steam edition.'
        seeds.append(g);by_id[slug]=g
    if 'tetris' not in by_id:
        g={'id':'tetris','title':'Tetris','aliases':[],'genre':'puzzle','genres':['puzzle'],'platforms':['Browser'],'releaseDate':'','description':'Arrange falling blocks into complete lines. This listing groups discussion of the classic Tetris game and its versions.','coverUrl':'','metadataUrl':'https://play.tetris.com/','metadataAttribution':'Game identity and browser play link: The Tetris Company official website. Editorial summary; no publisher artwork reproduced. Franchise-level listing.','storeUrl':'https://tetris.com/','playUrl':'https://play.tetris.com/','color':'#52619b','discoveredFrom':'User-requested title verified against official Tetris site and local archive','discoveryMatchMode':'title-context'}
        seeds.append(g);by_id[g['id']]=g
    snapshot=ingest.read(ingest.ROOT/'data/snapshot.json');records={(r['gameId'],r['id']):r for r in snapshot['records']};added=0
    for line in (out/'records.jsonl').open():
        row=json.loads(line)
        for g in seeds:
            reason=entity_match(g,row)
            if not reason:continue
            key=(g['id'],row['id'])
            if key in records:continue
            label,confidence=ingest.classify(row['text'])
            records[key]={'gameId':g['id'],'id':row['id'],'url':'https://news.ycombinator.com/item?id='+row['id'],'author':row['author'],'date':row['date'],'text':ingest.excerpt(row['text'],g),'kind':row['kind'],'storyTitle':row['storyTitle'],'storyUrl':'https://news.ycombinator.com/item?id='+row['storyId'],'classification':label,'confidence':confidence,'provenance':ingest.VERSION+' heuristic; unreviewed sentiment. Entity: '+reason+'; corpus-discovery-v1.','entityConfidence':.99 if reason.startswith('Explicit') else .85,'sourceDataset':'local-hn-archive-and-thread-discovery-v1'};added+=1
    snapshot['records']=list(records.values());snapshot.setdefault('discoveryUpdatedAt',dt.datetime.now(dt.timezone.utc).isoformat())
    scan=json.loads((out/'scan.json').read_text());scan.pop('titleCandidates',None);scan.pop('steamApps',None)
    scan['acceptedNewEntities']=len(decisions['accepted'])+1;scan['description']='Sampled local HN archive plus whole recommendation threads; no population estimates. Entity discovery and recommendation verification are separate.'
    (ingest.ROOT/'data/discovery-coverage.json').write_text(json.dumps(scan,indent=2)+'\n')
    (ingest.ROOT/'data/seeds.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n')
    (ingest.ROOT/'data/snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n');ingest.export();print('Added',added,'sourced mentions')

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--decisions',type=Path,default=ingest.ROOT/'data/entity-decisions.json');a=p.parse_args();publish(a.out,a.decisions)
if __name__=='__main__':main()
