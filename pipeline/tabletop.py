"""Rebuild the source-reviewed tabletop pilot from the sampled HN archive.

Only explicitly selected IDs are imported; this is not a general title matcher.
"""
import argparse
import datetime as dt
import gzip
import json
import re
from pathlib import Path

from .ingest import ROOT, plain, read


def build(archive: Path):
    selections = read(ROOT / 'data/tabletop-selections.json')
    games = selections['games']
    wanted = {str(item) for game in games for item in game['ids']}
    found = {}
    with gzip.open(archive, 'rt', encoding='utf-8') as stream:
        for line in stream:
            row = json.loads(line)
            item_id = str(row.get('objectID', ''))
            if item_id in wanted:
                found[item_id] = row
                if len(found) == len(wanted):
                    break
    missing = wanted - found.keys()
    if missing:
        raise ValueError(f'Archive is missing selected comments: {sorted(missing)}')

    seeds, records = [], []
    for game in games:
        title, aliases = game['title'], game['aliases']
        pattern = re.compile(r'(?<!\w)(?:' + '|'.join(re.escape(x) for x in [title, *aliases]) + r')(?!\w)', re.I)
        seeds.append({
            'id': game['id'], 'title': title, 'aliases': aliases,
            'medium': 'tabletop', 'genre': game['genre'], 'genres': [game['genre']],
            'platforms': [], 'releaseDate': '', 'description': game['description'],
            'coverUrl': None, 'metadataUrl': game['metadataUrl'],
            'metadataAttribution': 'Game reference: linked Wikipedia article. Summary: PROJECT 24 editorial.',
            'color': '#526551',
        })
        for item_id in game['ids']:
            item = found[str(item_id)]
            text = plain(item.get('comment_text'))
            match = pattern.search(text)
            if not match:
                raise ValueError(f'{game["id"]}: title missing from source comment {item_id}')
            if not item.get('story_id') or not item.get('created_at_i'):
                raise ValueError(f'{item_id}: missing parent discussion or timestamp')
            start = max(0, match.start() - 180)
            excerpt = ('…' if start else '') + text[start:start + 598] + ('…' if start + 598 < len(text) else '')
            records.append({
                'gameId': game['id'], 'id': str(item_id),
                'url': f'https://news.ycombinator.com/item?id={item_id}',
                'author': item.get('author') or 'unknown',
                'date': dt.datetime.fromtimestamp(item['created_at_i'], dt.timezone.utc).isoformat(),
                'text': excerpt, 'kind': 'comment', 'storyTitle': plain(item.get('story_title')),
                'storyUrl': f'https://news.ycombinator.com/item?id={item["story_id"]}',
                'classification': 'mention', 'confidence': 0.9,
                'provenance': 'tabletop-curated-v1; Codex reviewed title identity and source context; uncalibrated; not a verified recommendation',
            })

    for name, value in [('tabletop-games.json', seeds), ('tabletop-mentions.json', records)]:
        (ROOT / 'data' / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(f'Imported {len(seeds)} tabletop games and {len(records)} selected source mentions.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--comments', type=Path, required=True, help='sampled comments JSONL.gz')
    args = parser.parse_args()
    build(args.comments)


if __name__ == '__main__':
    main()
