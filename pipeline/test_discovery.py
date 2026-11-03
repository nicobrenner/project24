import unittest
from pipeline.catalogue import entity_match
from pipeline.discover import is_game, STEAM, candidates

class DiscoveryTests(unittest.TestCase):
 def row(self,text,**extra):return dict(text=text,storyTitle='',kind='comment',steamIds=[],**extra)
 def game(self,title,**extra):return dict(id=title.lower().replace(' ','-'),title=title,aliases=[],discoveredFrom='test',**extra)
 def test_common_word_requires_explicit_app(self):
  game=self.game('Everything',steamAppId=582270,discoveryMatchMode='explicit-url')
  self.assertIsNone(entity_match(game,self.row('Everything about this video game is great.')))
  row=self.row('Try this game');row['steamIds']=['582270']
  self.assertIsNotNone(entity_match(game,row))
 def test_another_world_needs_context(self):
  game=self.game('Another World');game['aliases']=['Out of This World']
  self.assertIsNone(entity_match(game,self.row('Gaming hardware is another world.')))
  self.assertIsNotNone(entity_match(game,self.row('Another World is an Amiga platformer.')))
 def test_tetris_metaphor_is_not_game_evidence(self):
  g=self.game('Tetris')
  self.assertIsNone(entity_match(g,self.row('Scheduling my calendar is Tetris.')))
  self.assertIsNotNone(entity_match(g,self.row('I played Tetris on my Gameboy.')))
 def test_software_is_not_a_game(self):
  self.assertFalse(is_game({'type':'game','genres':[{'id':'53'}]}))
  self.assertTrue(is_game({'type':'game','genres':[{'id':'2'}]}))
 def test_app_id_extraction(self):
  self.assertEqual(STEAM.findall('https://store.steampowered.com/app/233550/Another_World/'),['233550'])
 def test_entity_discovery_does_not_need_seed(self):
  self.assertIn('Chrono Trigger',candidates('I enjoyed Chrono Trigger on my console.'))
 def test_sequel_does_not_count_for_original(self):
  self.assertIsNone(entity_match(self.game('Quake'),self.row('Quake 3 is a video game.')))
