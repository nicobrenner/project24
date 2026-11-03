"""Train and run a real Jeffy head. Optional dependencies; offline export needs none."""
import argparse, hashlib, importlib.metadata, json
from pathlib import Path
from .ingest import ROOT, read
ENCODER='BAAI/bge-large-en-v1.5'
REVISION='d4aa6901d3a41ba39fb536a557fa166f842b0e09'
LABELS={'puzzles-and-systems':'Puzzles & systems','story-and-world':'Story & world','technical-craft':'How it’s built','nostalgia':'Childhood & memories','challenge-and-mastery':'Challenge & mastery','playing-together':'Playing together','relaxing-and-unwinding':'Unwinding','general':'General discussion'}
def digest(text):return hashlib.sha256(text.encode()).hexdigest()
def run(encoder,cache):
 import numpy as np
 import torch
 from jeffy.train import train_classifier
 torch.set_num_threads(4)
 training=read(ROOT/'data/classifiers/theme-training.json');snapshot=read(ROOT/'data/snapshot.json')
 examples=training['examples'];cache.mkdir(parents=True,exist_ok=True)
 clf=train_classifier([x['text'] for x in examples],[x['label'] for x in examples],task_id='conversation-theme-v1',C=.01,test_size=0,cv_folds=0,encoder=encoder,verbose=True)
 # Use the same Jeffy encoder/scaler/head in batches, avoiding repeated encoding of cross-game excerpts.
 texts=list(dict.fromkeys(r['text'] for r in snapshot['records'] if r['kind']=='comment' and len(r['text'])>=40))
 cache_key=digest(json.dumps(texts)+ENCODER+REVISION)
 embpath=cache/(cache_key+'.npz')
 if embpath.exists():embeddings=np.load(embpath,allow_pickle=False)['embeddings']
 else:
  embeddings=clf.encoder.encode(texts,batch_size=24,show_progress_bar=True)
  np.savez_compressed(embpath,embeddings=embeddings)
 probs=clf.clf.predict_proba(clf.scaler.transform(embeddings));predictions={}
 for text,row in zip(texts,probs):
  i=int(np.argmax(row));label=str(clf.clf.classes_[i]);confidence=float(row[i])
  predictions[digest(text)]={'label':label,'name':LABELS[label],'confidence':round(confidence,4),'probabilities':{str(k):round(float(v),4) for k,v in zip(clf.clf.classes_,row)}}
 result={'model':{'id':'conversation-theme-v1','package':'jeffy-classify','version':importlib.metadata.version('jeffy-classify'),'encoder':ENCODER,'encoderRevision':REVISION,'trainingSha256':digest(json.dumps(training,sort_keys=True)),'trainingExamples':len(examples),'trainingOrigin':'Synthetic examples written by Codex; not HN quotes','threshold':.5,'scope':'Topic of the source excerpt, not a verified attribute of the game or an endorsement.','limitations':'Experimental, single dominant theme, uncalibrated confidence. May attribute surrounding discussion to the wrong game. General or low-confidence predictions are hidden.','source':'https://github.com/nicobrenner/jeffy'},'labels':LABELS,'predictions':predictions}
 (ROOT/'data/classifiers/theme-predictions.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 # Durable, safe NPZ head; the encoder remains an external cached dependency.
 from jeffy.model_pack import load_artifact
 modeldir=ROOT/'data/classifiers/models';saved=Path(clf.save(str(modeldir)))
 for p in saved.glob('*.pkl'):p.unlink() # don't distribute pickle backups
 # Verify the persisted head can be read by Jeffy's own integrity-checking loader.
 loaded,scaler,manifest=load_artifact(saved)
 np.testing.assert_allclose(loaded.predict_proba(scaler.transform(embeddings[:3])),probs[:3],atol=1e-8)
 print('Jeffy classified',len(texts),'distinct source excerpts; visible non-general themes:',sum(p['label']!='general' and p['confidence']>=.5 for p in predictions.values()),flush=True)
def main():
 p=argparse.ArgumentParser();p.add_argument('--encoder',default=ENCODER);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();run(a.encoder,a.cache)
if __name__=='__main__':main()
