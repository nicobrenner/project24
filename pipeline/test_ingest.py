import json
import unittest
import tempfile
from unittest.mock import patch
import ingest
from pathlib import Path
from ingest import detect, classify, plain
ROOT=Path(__file__).resolve().parents[1]
class DetectionTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.seeds={g['id']:g for g in json.loads((ROOT/'data/seeds.json').read_text())}
 def test_ambiguous_names(self):
  cases=[('a-dark-room','I sat in a dark room to meditate.'),('portal','Use the login portal to access your account.'),('2048','RSA with 2048 bits is the standard.'),('the-witness','The witness gave a statement to police.'),('celeste','Celeste is my colleague.'),('portal','Portal 2 is a great game.'),('portal','In the game I went through a portal to enter.'),('portal','A game with a 2d-portal element.'),('portal','Sony’s PlayStation Portal gaming handheld'),('portal','Show HN: Time Portal – a game about history'),('a-dark-room','I was playing Q2 in a dark room when I was younger'),('slay-the-spire','Slay the Spire 2 is amazing.'),('hollow-knight','Hollow Knight Silksong is a game.')]
  for key,text in cases:
   with self.subTest(text=text):self.assertFalse(detect(self.seeds[key],text))
 def test_positive_detection(self):
  for key,text in [('portal','Portal is a great puzzle game.'),('2048','I play the game 2048.'),('the-witness','The Witness is a clever puzzle.'),('a-dark-room','A Dark Room is a wonderful idle game.'),('ftl-faster-than-light','FTL is my favorite game.')]:self.assertTrue(detect(self.seeds[key],text))
 def test_alias_boundaries(self):self.assertFalse(detect(self.seeds['portal'],'A portalized system'))
 def test_heuristics_never_verify(self):self.assertEqual(classify('I recommend Factorio')[0],'candidate')
 def test_html_is_plain_text(self):self.assertEqual(plain('<p>Hello &amp; goodbye</p>'),'Hello & goodbye')
class DatasetTests(unittest.TestCase):
 def test_catalog_provenance_and_counts(self):
  catalog=json.loads((ROOT/'public/data/catalog.json').read_text());reviews=json.loads((ROOT/'data/reviews.json').read_text());verified={(r['gameId'],r['id']) for r in reviews if r['classification']=='recommendation'}
  for game in catalog['games']:
   mentions=game['mentions'];self.assertEqual(len(mentions),len({m['id'] for m in mentions}))
   self.assertEqual(game['verifiedRecommendations'],sum(m['classification']=='recommendation' for m in mentions))
   self.assertEqual(game['discussionCount'],len({m['storyUrl'] for m in mentions}))
   for m in mentions:
    self.assertEqual(m['url'],'https://news.ycombinator.com/item?id='+m['id']);self.assertTrue(m['provenance']);self.assertGreaterEqual(m['confidence'],0);self.assertLessEqual(m['confidence'],1)
    self.assertNotIn('<script',m['text']);self.assertLessEqual(len(m['text']),600)
    if m['classification']=='recommendation':self.assertIn((game['id'],m['id']),verified)
 def test_review_excerpts_are_in_snapshot(self):
  snapshot=json.loads((ROOT/'data/snapshot.json').read_text());records={(r['gameId'],r['id']):r for r in snapshot['records']}
  for r in json.loads((ROOT/'data/reviews.json').read_text()):self.assertIn(r['excerpt'],records[(r['gameId'],r['id'])]['text'])
class IncrementalTests(unittest.TestCase):
 def test_incremental_refuses_to_skip_uncollected_pages(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'data').mkdir()
   seed=json.loads((ROOT/'data/seeds.json').read_text())[0]
   (root/'data/seeds.json').write_text(json.dumps([seed]))
   old={'collectedAt':'2026-01-01T00:00:00+00:00','queries':[],'records':[]}
   path=root/'data/snapshot.json';path.write_text(json.dumps(old));before=path.read_bytes()
   with patch.object(ingest,'ROOT',root),patch.object(ingest,'fetch',return_value={'nbPages':6,'hits':[]}),patch.object(ingest,'import_cache') as imported:
    with self.assertRaisesRegex(RuntimeError,'watermark unchanged'):ingest.collect(5,True)
    imported.assert_not_called()
   self.assertEqual(path.read_bytes(),before)
 def test_incremental_preserves_sources_metadata_and_baseline(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'data').mkdir();cache=root/'cache';cache.mkdir()
   seed=json.loads((ROOT/'data/seeds.json').read_text())[0]
   (root/'data/seeds.json').write_text(json.dumps([seed]))
   old={'queries':[{'gameId':seed['id'],'kind':'comment','reportedSearchMatches':1234}], 'records':[{'gameId':seed['id'],'id':'1','text':'Factorio is a game'}]}
   (cache/(seed['id']+'-comment.json')).write_text(json.dumps({'nbHits':1,'hits':[{'objectID':'2','comment_text':'I play Factorio','created_at':'2026-01-01'}]}))
   with patch.object(ingest,'ROOT',root),patch.object(ingest,'export') as exported:
    ingest.import_cache(cache,root/'missing-metadata',previous=old)
    exported.assert_called_once()
   result=json.loads((root/'data/snapshot.json').read_text())
   self.assertEqual({r['id'] for r in result['records']},{'1','2'})
   self.assertEqual(result['queries'],old['queries'])
   self.assertEqual(json.loads((root/'data/seeds.json').read_text())[0]['coverUrl'],seed['coverUrl'])
if __name__=='__main__':unittest.main()
