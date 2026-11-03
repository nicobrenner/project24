# Evidence pipeline

Run from the repository root with Python 3.10+; no third-party Python packages are required.

```sh
python3 -m pipeline.ingest export
python3 -m unittest discover -s pipeline -p 'test_*.py'
python3 -m pipeline.ingest collect --pages 1
python3 -m pipeline.ingest collect --incremental --pages 2
python3 -m pipeline.ingest metadata
```

`export` is fully offline. It reads the checked-in `data/seeds.json`, `data/snapshot.json`, and `data/reviews.json`, recreates `data/catalog.sqlite`, and writes `public/data/catalog.json`. SQLite is an inspectable local processing artifact, not a production server. `mentions` has a composite primary key `(game_id, id)` and a JSON payload. Re-export does not change the collection timestamp.

`collect` queries the public HN Algolia API for each curated seed title, in separate comment and story searches, requesting up to 100 comments and 40 stories per page. Queries are relevance-ranked. This is a bounded historical sample, not an exhaustive HN archive. Additional pages increase coverage up to the API's search limits. Requests are sequential, spaced by 350 ms, with exponential retry backoff. A failed request aborts collection before replacing the snapshot. Use modest page counts and follow the provider's API policies. No authentication is required.

`--incremental` filters by the last collection time with a one-day overlap, then merges on game and HN item ID. It retains old evidence and manual reviews. It preserves baseline all-time Algolia totals because an incremental query's hit count describes only that time interval. If an incremental query reports more pages than requested, collection fails without advancing the snapshot or watermark; rerun with a higher `--pages`. Scheduled runs with high volume may require more pages; this collector does not guarantee complete coverage, catch every late-indexed comment, or automatically remove deleted HN material. Run a periodic full sample refresh and review deletion requests. Full collection can invalidate a review if its source falls outside the new sample; the exporter refuses to apply an excerpt that does not match an included source.

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
- Show HN status requires a reviewed `showHNLaunch: true` entry. Looptap has an individually verified original creator launch (HN 29921419). Other matching Show HN stories concern tools, ports, or derivatives and are not launch-verified. Looptap is listed historically; no working play link was verified.
- `keywordMatches` is the sum of baseline Algolia comment and story query totals before disambiguation; `mentions.length` is the smaller collected and filtered sample. `verifiedRecommendations` counts reviewed positive records. `discussionCount` counts distinct parent HN discussions represented in the sample. None is a census or unbiased popularity estimate.

## Extending the pipeline

Add a seed with aliases and attribution, collect evidence, inspect source context, and add review overrides. To integrate Jeffy, replace or wrap `classify(text)` with a classifier adapter that emits the same label/confidence/provenance fields. Keep automated candidate predictions separate from reviewed recommendation status. A future version should add calibrated model evaluations, full-history pagination/time windows, deletion reconciliation, metadata licenses/permissions auditing, richer aliases and developer-confirmed Show HN launch mapping.

`data/curated-mentions.json` contains two direct replies to the original Looptap creator launch, fetched from Algolia item 29921419. Their text omits the game name, so they are separately reviewed using the parent story as explicit entity context. Import merges these documented supplemental sources into the snapshot; they are not keyword search hits. The snapshot preserves both the text and this entity-resolution provenance.
