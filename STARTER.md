# PROJECT 24

A starter discovery site for video games discussed on Hacker News.

## Run

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` publish to GitHub Pages through the **Deploy to GitHub Pages** workflow. See the root README.

## Data caveats

The starter catalog contains 20 manually selected games, not an exhaustive HN dataset. Live Algolia queries count keyword matches, not verified endorsements. Counts can include false positives, and only the first page of up to 100 comments is loaded for each game. No sentiment analysis is implemented. Game artwork is represented with stylized emoji placeholders. This is an interactive MVP, not a validated ranking or complete archive.

## Next steps

Ingest full HN historical data, entity-link games, classify recommendation strength, store materialized results, enrich licensed artwork, and expose stable game pages.
