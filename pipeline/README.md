# Evidence pipeline

Run from the repository root with Python 3.10+; no third-party Python packages are required.

```sh
python3 -m pipeline.ingest export
python3 -m unittest discover -s pipeline -p 'test_*.py'
python3 -m pipeline.ingest collect --pages 1
python3 -m pipeline.ingest collect --incremental --pages 2
python3 -m pipeline.ingest metadata
```

`export` is fully offline. It reads the checked-in video-game seeds and snapshot, the tabletop seeds and mentions, and `data/reviews.json`; it recreates `data/catalog.sqlite` and writes `public/data/catalog.json`. SQLite is an inspectable local processing artifact, not a production server. `mentions` has a composite primary key `(game_id, id)` and a JSON payload. Re-export does not change the collection timestamp.

## Tabletop pilot

The tabletop pilot is a separately curated set of 16 games and 37 game–comment matches from 28 distinct HN comments in the supplied sampled archive. `data/tabletop-selections.json` records the selected identities and exact HN comment IDs; Codex reviewed the source text and parent discussion context. The checked-in `tabletop-games.json` and `tabletop-mentions.json` permit offline export. Recommendations remain separate review records in `data/reviews.json` and require a matching excerpt, just like video-game reviews. Classification confidence is editorial, not calibrated. The selection is deliberately small and is not an exhaustive or representative index.

To rebuild the checked-in tabletop files from the original archive, then update the optional phrase-cue signals and catalog:

```sh
python3 -m pipeline.tabletop --comments /path/to/comments_sample.jsonl.gz
python3 -m pipeline.sentiment
python3 -m pipeline.ingest export
```

The import refuses missing source IDs, missing timestamps or parent discussions, and comments without a selected title or alias. It does not discover new titles or run the Jeffy topic classifier. The incremental Algolia collector currently updates video games only; tabletop additions require explicit selection and review. Missing release dates and licensed artwork stay missing; the site uses generated artwork. Video-game and tabletop rankings are displayed separately.

`collect` queries the public HN Algolia API for each curated seed title, in separate comment and story searches, requesting up to 100 comments and 40 stories per page. Queries are relevance-ranked. This is a bounded historical sample, not an exhaustive HN archive. Additional pages increase coverage up to the API's search limits. Requests are sequential, spaced by 350 ms, with exponential retry backoff. A failed request aborts collection before replacing the snapshot. Use modest page counts and follow the provider's API policies. No authentication is required.

`--incremental` filters by the last collection time with a one-day overlap, then merges on game and HN item ID. It retains old evidence and manual reviews. It preserves baseline all-time Algolia totals because an incremental query's hit count describes only that time interval. If an incremental query reports more pages than requested, collection fails without advancing the snapshot or watermark; rerun with a higher `--pages`. Scheduled runs with high volume may require more pages; this collector does not guarantee complete coverage, catch every late-indexed comment, or automatically remove deleted HN material. Full collection also merges existing archive evidence rather than discarding it, and refreshes query estimates. Review deletion requests separately. The exporter refuses to apply a review excerpt that does not match its source.

`metadata` refreshes Steam header image URLs, release-date display strings and supported desktop platforms from Steam appdetails. Failed/empty metadata responses preserve previous seed fields. Steam release dates are the dates reported for that Steam edition, not necessarily the game's original launch. Browser game URLs and summaries are editorial seed metadata. Missing metadata remains missing; no dates or platforms are guessed. Artwork is linked remotely and attributed to Steam and the respective publisher. Publishers retain rights to their artwork; this project claims no ownership or blanket redistribution license. Browser games without artwork intentionally use designed text covers.

The initial snapshot was imported from fetched public search responses using:

```sh
python3 -m pipeline.ingest import-cache /path/to/hn-cache /path/to/metadata-cache
```

HN cache files use `<game-id>-comment.json` / `<game-id>-story.json` (optional page suffix); metadata files use `<game-id>.json`. Full raw API caches are disposable and excluded from Git. The checked-in snapshot is the portable, sanitized source evidence used for reproducible export. HTML is reduced to plain text and excerpts are capped at 600 characters around the game name. Every record retains its source item ID, URL, author, timestamp, discussion URL, and title. Excerpts are attributed and link to originals; this is not a redistribution of full HN threads.

## Detection and review policy

- Curated canonical names and boundary-aware aliases normalize the seed catalog. Searches currently use canonical titles; aliases improve detection but do not add separate search queries.
- Ambiguous names require nearby game context. The Witness gets stronger puzzle/developer context. Sequel-only occurrences such as Portal 2 or Slay the Spire 2 and Hollow Knight Silksong do not count toward their originals.
- Heuristics assign `candidate`, `mention`, `criticism`, or `technical`; they **never** assign verified recommendations. Candidate language can concern another game, a book, or a tool. Confidence is a rule-level indicator, not a calibrated probability.
- `data/reviews.json` contains explicit source-text reviews by Codex, with exact source excerpts, reasons, and provenance. These are agent-reviewed, not independently human-audited. Only an explicit positive endorsement of that game is labeled `recommendation`. Praise inside technical discussion can qualify; generic praise of another title cannot. Review confidence is editorial, not measured statistical accuracy.
- Show HN Games uses a conservative, manually curated list of creator game launch submissions in `data/showhn-decisions.json`. Rebuild these source-linked records with `python3 pipeline/showhn.py --stories /path/to/story_scores.csv`, then `python3 pipeline/ingest.py export`. Each entry links to its exact HN submission and is classified as a mention; launches never count as recommendations. The list is a subset of the sampled submission archive, not exhaustive.
- `keywordMatches` is the sum of baseline Algolia comment and story query totals before disambiguation; `mentions.length` is the smaller collected and filtered sample. `verifiedRecommendations` counts reviewed positive records. `discussionCount` counts distinct parent HN discussions represented in the sample. None is a census or unbiased popularity estimate.

## Extending the pipeline

Add a seed with aliases and attribution, collect evidence, inspect source context, and add review overrides. Keep automated candidate predictions separate from reviewed recommendation status. A future version should add calibrated model evaluations, full-history pagination/time windows, deletion reconciliation, metadata licenses/permissions auditing, richer aliases and developer-confirmed Show HN launch mapping.

`data/curated-mentions.json` contains two direct replies to the original Looptap creator launch, fetched from Algolia item 29921419. Their text omits the game name, so they are separately reviewed using the parent story as explicit entity context. Import merges these documented supplemental sources into the snapshot; they are not keyword search hits. The snapshot preserves both the text and this entity-resolution provenance.

## Archive and thread discovery

```sh
python3 -m pipeline.discover scan --comments /path/comments_sample.jsonl.gz --stories /path/story_scores.csv --out /path/discovery-cache
python3 -m pipeline.discover threads --out /path/discovery-cache --limit 35
python3 -m pipeline.discover resolve --out /path/discovery-cache --limit 500
# Review resolved.json and record approvals/rejections with reasons before publishing.
python3 -m pipeline.catalogue --out /path/discovery-cache --decisions data/entity-decisions.json
python3 -m pipeline.ingest export
```

The comment JSONL schema uses `objectID`, `created_at_i`, `author`, `story_id`, `story_title`, and `comment_text`. The story CSV schema uses `object_id`, `created_at_i`, `author`, `title`, and `url`. Other input columns are ignored. Keep caches outside the repository. The scanner streams compressed comments, records input SHA-256 hashes and actual row counts, and retains gaming-context records or explicit Steam URLs. It extracts repeated capitalized title phrases without a seed list. This heuristic misses lowercase titles, non-English titles, and many ordinary game-name mentions; the result is a discovery sample, not exhaustive extraction.

Thread discovery caches broad Ask HN and Show HN searches and walks selected full comment trees. Some search results concern development or related subjects, so thread selection alone never establishes game identity or an endorsement. Steam requests are sequential, cached, spaced 450 ms apart, and use exponential backoff. Provider changes may change results. Metadata marked as software or non-game is rejected.

Entity decisions select exact app IDs and a matching mode. `explicit-url` accepts only records containing that app link, protecting ambiguous names such as Everything or Outsider. `title-context` additionally requires alias boundaries and gaming context; specific guards cover Tetris metaphors, Another World, and sequels. Approved identities are agent-reviewed, not human-audited. Explicit links have a rule confidence of 0.99, contextual matches 0.85; neither is statistically calibrated. Sentiment indicators are excerpt-level heuristic signals and do not verify game identity or recommendations. New entries can therefore have zero reviewed recommendations.

Publication merges on `(gameId, HN item ID)`, preserves existing reviewed excerpts, and does not advance the Algolia incremental watermark. Full and incremental collection honor the same conservative entity modes for discovered games. No automatic population estimate, creator-launch verification, or recommendation verification is derived from the archive scan.

### Reference-assisted title matching

The published snapshot has 818 identities and 5,009 source records, including 695 additional identities from this pass. The exact evidence match file is checked in at `data/reference-matches.jsonl`; Wikidata's CC0 reference snapshot is `data/wikidata-game-index.json` (29,232 English-labeled game entities). Rebuild the pass with the local corpus supplied by the user:

```sh
python3 -m pipeline.reference_discovery \
  --reference data/wikidata-game-index.json \
  --comments /path/to/comments_sample.jsonl.gz \
  --stories /path/to/story_scores.csv \
  --out /tmp/project24-discovery
python3 -m pipeline.reference_approve /tmp/project24-discovery/reference-records.jsonl
python3 -m pipeline.reference_publish
python3 -m pipeline.ingest export
```

`data/reference-decisions.json` is the curated identity allowlist, not a sentiment or recommendation review. Matching requires an exact, case-preserving title and separate nearby game context; sequel suffixes are rejected. A title can still resolve incorrectly, so every mention remains labeled `mention` until source-reviewed. The sampled corpus covers whole days and is clustered, with uneven annual and topic coverage. The 818 is the number of identities in this checked-in sample, not the number of games ever discussed on HN. Wikidata contributes identity and CC0 description/genre/platform metadata; no unverified artwork is added.

The optional Jeffy pipeline in `pipeline/themes.py` predicts discussion topics from source excerpts. It uses a local BGE encoder and a custom Jeffy model trained on synthetic examples. Its small diagnostic is experimental and not calibrated. It does not determine game identity, endorsements, rankings, or game attributes. Low-confidence/general labels are hidden in the site.

Excerpt sentiment is currently a separate conservative phrase-cue heuristic, not Jeffy. Rebuild the visible signals with `python3 -m pipeline.sentiment` followed by `python3 -m pipeline.ingest export`. It labels explicit positive, critical, or mixed phrases and abstains otherwise. Game-level dots summarize only classified comment excerpts in this sample; they do not measure consensus. We have not repurposed the theme head for sentiment because it was trained on synthetic topic labels, not sentiment, and has no sentiment evaluation set. A dedicated Jeffy sentiment head should replace the phrase cues only after source-labeled evaluation.
