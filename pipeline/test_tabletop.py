import gzip
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline import tabletop


class TabletopImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'data').mkdir()
        selection = {'games': [{
            'id': 'tabletop-go', 'title': 'Go', 'aliases': [], 'genre': 'abstract strategy',
            'description': 'A board game.', 'metadataUrl': 'https://example.org/go', 'ids': ['42'],
        }]}
        (self.root / 'data/tabletop-selections.json').write_text(json.dumps(selection))
        self.archive = self.root / 'comments.jsonl.gz'

    def write_archive(self, text):
        row = {'objectID': '42', 'comment_text': text, 'story_id': 12,
               'created_at_i': 1234567890, 'author': 'alice', 'story_title': 'Board games'}
        with gzip.open(self.archive, 'wt', encoding='utf-8') as stream:
            stream.write(json.dumps(row) + '\n')

    def test_import_preserves_source_and_does_not_invent_recommendations(self):
        self.write_archive('I enjoy playing <i>Go</i> with friends.')
        with patch.object(tabletop, 'ROOT', self.root):
            tabletop.build(self.archive)
        record = json.loads((self.root / 'data/tabletop-mentions.json').read_text())[0]
        self.assertEqual(record['text'], 'I enjoy playing Go with friends.')
        self.assertEqual(record['url'], 'https://news.ycombinator.com/item?id=42')
        self.assertEqual(record['storyUrl'], 'https://news.ycombinator.com/item?id=12')
        self.assertEqual(record['classification'], 'mention')

    def test_import_rejects_missing_title(self):
        self.write_archive('I enjoy playing chess with friends.')
        with patch.object(tabletop, 'ROOT', self.root):
            with self.assertRaisesRegex(ValueError, 'title missing'):
                tabletop.build(self.archive)
        self.assertFalse((self.root / 'data/tabletop-mentions.json').exists())


if __name__ == '__main__':
    unittest.main()
