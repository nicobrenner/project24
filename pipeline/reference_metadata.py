"""Fetch compact CC0 Wikidata metadata for approved candidate identities."""
import argparse,json,time,urllib.parse
from pathlib import Path
from .ingest import ROOT,fetch
from .discover import file_hash
PROPERTIES={'P577':'release','P136':'genre','P400':'platform','P1733':'steam','P856':'website'}
def run(cache):
 cache.mkdir(parents=True,exist_ok=True);decisions=json.loads((ROOT/'data/reference-decisions.json').read_text());ids=sorted({r['qid'] for r in decisions['accepted']});metadata={qid:{} for qid in ids};related=set()
 for start in range(0,len(ids),60):
  batch=ids[start:start+60];query='SELECT ?game ?property ?value WHERE { VALUES ?game { '+' '.join('wd:'+q for q in batch)+' } { VALUES ?property { '+' '.join('wdt:'+p for p in PROPERTIES)+' } ?game ?property ?value. } UNION { BIND(schema:description AS ?property) ?game schema:description ?value. FILTER(LANG(?value)="en") } }'
  path=cache/f'metadata-{start}.json'
  # Cache binds exact IDs so a changed decision set cannot silently reuse the wrong response.
  if path.exists() and json.loads(path.read_text()).get('ids')==batch:data=json.loads(path.read_text())['data']
  else:
   data=fetch('https://query.wikidata.org/sparql?'+urllib.parse.urlencode({'query':query,'format':'json'}));path.write_text(json.dumps({'ids':batch,'data':data}));time.sleep(1)
  for row in data['results']['bindings']:
   qid=row['game']['value'].rsplit('/',1)[-1];prop=row['property']['value'];key=PROPERTIES.get(prop.rsplit('/',1)[-1],'description');value=row['value']['value'];metadata[qid].setdefault(key,[]).append(value)
   if key in {'genre','platform'}:related.add(value.rsplit('/',1)[-1])
  print('Metadata',min(start+60,len(ids)),'/',len(ids),flush=True)
 labels={};related=sorted(related)
 for start in range(0,len(related),100):
  batch=related[start:start+100];query='SELECT ?item ?label WHERE { VALUES ?item { '+' '.join('wd:'+q for q in batch)+' } ?item rdfs:label ?label. FILTER(LANG(?label)="en") }'
  path=cache/f'labels-{start}.json'
  if path.exists() and json.loads(path.read_text()).get('ids')==batch:data=json.loads(path.read_text())['data']
  else:
   data=fetch('https://query.wikidata.org/sparql?'+urllib.parse.urlencode({'query':query,'format':'json'}));path.write_text(json.dumps({'ids':batch,'data':data}));time.sleep(1)
  labels.update({r['item']['value'].rsplit('/',1)[-1]:r['label']['value'] for r in data['results']['bindings']})
 result={'source':'https://www.wikidata.org/','license':'CC0','decisionsSha256':file_hash(ROOT/'data/reference-decisions.json'),'entities':metadata,'labels':labels}
 (ROOT/'data/reference-metadata.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);a=p.parse_args();run(a.cache)
