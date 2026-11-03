"""Reference-assisted candidate discovery across every archive row, without a title shortlist.
Candidates are not published games. Entity approval is a separate step.
"""
import argparse, collections, csv, datetime as dt, gzip, json, re, unicodedata
from pathlib import Path
from .ingest import plain
from .discover import file_hash
TOKEN=re.compile(r"[^\W_]+",re.UNICODE)
CONTEXT=re.compile(r'\b(?:games?|gaming|gameplay|play(?:ed|ing)?|steam|nintendo|atari|amiga|arcade|console|puzzle|roguelike|platformer|rpg|fps|snes|nes|dos|commodore|videogames?|speedrun|multiplayer)\b',re.I)
def tokens(text):return [m.group().casefold() for m in TOKEN.finditer(unicodedata.normalize('NFKC',text))]
def reference(path):
 grouped=collections.defaultdict(list)
 for x in json.loads(path.read_text())['results']['bindings']:
  title=x['gameLabel']['value'];qid=x['game']['value'].rsplit('/',1)[-1]
  title=re.sub(r'\s*\((?:\d{4} )?video game\)$','',title)
  key=tuple(tokens(title))
  if len(title)<5 or re.fullmatch(r'Q\d+',title) or not key or len(key)>14:continue
  grouped[key].append({'qid':qid,'title':title})
 return grouped
class Matcher:
 def __init__(self,groups):
  self.trie={};self.groups=groups
  for key in groups:
   node=self.trie
   for word in key:node=node.setdefault(word,{})
   node[None]=key
 def match(self,text):
  words=list(TOKEN.finditer(unicodedata.normalize('NFKC',text)));found=[]
  for i,w in enumerate(words):
   node=self.trie.get(w.group().casefold());best=None
   if node is None:continue
   j=i
   while node is not None:
    if None in node:best=(node[None],w.start(),words[j].end())
    j+=1
    if j>=len(words):break
    node=node.get(words[j].group().casefold())
   if best:found.append(best)
  # A longer title subsumes its suffix and prefix, e.g. Civilization / Civilization II.
  return [x for x in found if not any(y[1]<=x[1] and y[2]>=x[2] and y[2]-y[1]>x[2]-x[1] for y in found)]
def scan(ref,comments,stories,out):
 groups=reference(ref);matcher=Matcher(groups);out.mkdir(parents=True,exist_ok=True)
 counts=collections.Counter();examples=collections.defaultdict(list);scanned=collections.Counter();seen=set()
 with (out/'reference-records.jsonl').open('w') as dest:
  def accept(x,kind):
   rid=str(x['objectID'] if kind=='comment' else x['object_id'])
   if rid in seen:return
   seen.add(rid);scanned[kind]+=1
   raw=x.get('comment_text','') if kind=='comment' else x['title'];text=plain(raw)
   context=plain(x.get('story_title','') if kind=='comment' else x['title'])
   if not CONTEXT.search(text+' '+context):return
   matches=matcher.match(text)
   if not matches:return
   sid=str(x.get('story_id') or '') if kind=='comment' else rid
   if not sid:return
   row={'id':rid,'kind':kind,'text':text,'storyTitle':context,'storyId':sid,'author':x.get('author','unknown'),'date':dt.datetime.fromtimestamp(int(x['created_at_i']),dt.timezone.utc).isoformat(),'matches':[{'key':' '.join(k),'start':a,'end':b} for k,a,b in matches]}
   dest.write(json.dumps(row,ensure_ascii=False)+'\n')
   for k,a,b in {k:(k,a,b) for k,a,b in matches}.values():
    counts[k]+=1
    if len(examples[k])<4:examples[k].append({'id':rid,'text':text[max(0,a-120):b+190]})
  with gzip.open(comments,'rt') as f:
   for i,line in enumerate(f):
    accept(json.loads(line),'comment')
    if i and i%250000==0:print('Scanned',i,'comments',flush=True)
  with stories.open() as f:
   for row in csv.DictReader(f):accept(row,'story')
 result={'reference':{'source':'https://www.wikidata.org/','license':'CC0','sha256':file_hash(ref),'titles':len(groups)},'scanned':dict(scanned),'candidates':[{'key':' '.join(k),'entities':groups[k],'sourceCount':n,'examples':examples[k]} for k,n in counts.most_common()]}
 (out/'reference-candidates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Candidate titles:',len(counts),flush=True)
def main():
 p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,required=True);p.add_argument('--comments',type=Path,required=True);p.add_argument('--stories',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();scan(a.reference,a.comments,a.stories,a.out)
if __name__=='__main__':main()
