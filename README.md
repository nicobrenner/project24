# PROJECT 24

A small, evidence-first discovery index for video games discussed on Hacker News. React + TypeScript + Vite, served from static JSON; a Python/SQLite pipeline collects and classifies the source material.

## Local development

Requires Node.js 22+ and Python 3.10+ (pipeline uses the standard library and `curl`).

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The checked-in `public/data/catalog.json` works immediately without credentials or a backend.

```sh
npm test
npm run build
npm run preview
```

`dist/` is the deployable site. Source files are in `src/`; historical data and classifier documentation are in `data/` and `pipeline/`.

## Implemented

- Responsive discovery catalog with search, genre/platform filters, alphabetical and evidence-based sorting, and a random pick.
- All Games, Most Recommended, Most Discussed, Browser Games, and Show HN Games collections.
- Shareable `/game/<slug>` pages, plain-text source excerpts, HN links, confidence, and classification provenance.
- Historical HN comments and submissions, archive-based entity discovery, normalized aliases, and guarded matching for ambiguous titles.
- 818 game identities, including 695 added from the title-reference pass; 5,009 source records with exact HN links. The wider pass contributes mentions only and does not increase reviewed recommendation counts.
- Links from game pages to YouTube gameplay/trailer searches and external review searches (Metacritic, OpenCritic, IMDb, and Steam where available). No third-party ratings or video claims are copied into the catalog.
- Links from game pages to Twitch stream searches and Reddit community searches; live-player embeds are not included.
- Individual Codex source review separated from machine candidates, casual mentions, criticism, and technical discussion.
- An experimental, locally run Jeffy topic classifier has suggestions for 114 of 3,964 distinct excerpts. Its 24-example Codex-labeled diagnostic matched 15 top labels; this is not independent human evaluation or a claim of model accuracy.
- Metadata attribution, publisher artwork loaded from credited sources, image fallback, and official play links for browser games.
- Reproducible SQLite processing and static export, CI validation, and an incremental collection workflow.

The starter's game selection and discovery concept were retained. Its client-side live API fan-out, keyword-only ranking, emoji artwork, and unsafe HTML rendering were replaced. The original starter README is preserved in `STARTER.md`.

## Data collection and reproducibility

```sh
# Rebuild SQLite and the published JSON from committed sources, offline
python3 -m pipeline.ingest export
# Collect a bounded historical sample (increase pages deliberately)
python3 -m pipeline.ingest collect --pages 1
# Merge new evidence with the historical snapshot
python3 -m pipeline.ingest collect --incremental --pages 5
# Refresh available Steam metadata independently
python3 -m pipeline.ingest metadata
```

Read `pipeline/README.md` for schema, provenance, review procedure, rate limiting, and classifier extension details. `data/seeds.json`, `data/snapshot.json`, and `data/reviews.json` are versioned inputs. SQLite is derived and ignored. The initial checked-in snapshot can always be exported offline; re-fetching external APIs can change results.

The **Update HN evidence** GitHub Action runs daily or manually. It collects new evidence, runs the tests and production build, then commits the snapshot and export. It does not create new reviewed recommendations. Give GitHub Actions contents-write permission (the workflow requests only that); disable the schedule if you prefer manual updates. Existing reviews remain explicit versioned records. Cloudflare Git integration handles site deployments independently.

## Expanded archive discovery

The catalog contains **818 game identities and 5,009 source records**, including Tetris and Another World. It has **43 individually reviewed recommendations**; the additional archive matches are mentions, not recommendations.

The scanner processed 1,191,935 comments and 293,708 submissions from the user-supplied HN archive, then fetched 35 additional whole discussion threads through Algolia. Most archive records cover 2008–2026, with a small late-2007 boundary spillover. Sampling selected whole days, so observations are clustered and coverage is uneven. Submission scores had a 14-day settling window. Neither corpus is a complete HN archive.

Discovery now has two stages. Steam application URLs and selected Show/Ask HN threads contribute explicitly reviewed identities in `data/entity-decisions.json`. A second, high-recall pass matches exact, case-preserving titles from a frozen Wikidata game index against nearby video-game context. The curated allowlist records 727 title decisions; 726 identities passed the final collision check, with some matching existing games. The allowlist is in `data/reference-decisions.json`; each accepted mention retains the HN item ID, parent discussion, and match provenance. Wikidata descriptions, genres, and platforms are CC0 and attributed. Uncertain artwork is omitted. Context and title matches still need correction over time.

See [pipeline discovery instructions](pipeline/README.md#archive-and-thread-discovery) to reproduce both discovery passes. The Wikidata reference snapshot is checked in as `data/wikidata-game-index.json`; the large HN dumps remain local inputs and are not republished. Offline export from committed evidence remains available without the original dumps. The discovery pass does not advance the incremental API watermark.

Inspirations: HackerBooks, HackerTube, and Wikihack. [HackerTube’s data page](https://hackertube.org/data) links to the [OpenIndex HN dataset](https://huggingface.co/datasets/open-index/hacker-news), a possible future full-history source. This version uses the supplied local sample and Algolia; it does not ingest that dataset or assert it is a Karpathy archive.

## What the counts mean

**Reviewed recommendations** count individually source-reviewed endorsement comments for that specific game. They do not measure unique people. The initial source reviews were performed by Codex, not a human. Their provenance is explicit; they are fallible AI assessments of the quoted source. A rule-based classifier never upgrades a comment into a reviewed recommendation.

**Discussion threads** count distinct parent HN stories among accepted mentions in the collected sample. Criticism and technical discussion count as discussion, not endorsement.

**Raw keyword matches** report estimated Algolia search matches before disambiguation. Multiple alias query totals may overlap. They are not recommendation counts and are not used to rank games. A missing estimate is shown as an em dash, not zero.

**Hidden Gems** is temporarily omitted: the current reviewed recommendation set and low-discussion cutoff yields only one title, and this sample is too limited to claim a game is obscure. **Show HN Games** lists curated creator launch submissions from the supplied sampled archive. A launch post is a mention, not a recommendation or quality endorsement. The reviewed source IDs and repeatable importer are in `data/showhn-decisions.json` and `pipeline/showhn.py`.

The public methodology page explains these limits. Counts describe a bounded sample, not an exhaustive HN archive. Unequal search coverage and source-review selection bias affect rankings. Some games may have no reviewed recommendations despite substantial discussion.

## Cloudflare Pages

### Recommended: Git integration

1. Push this repository to your personal GitHub account as `hackergames`.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git** and select the repository.
3. Use production branch `main`, build command `npm run build`, output directory `dist`, and Node.js version `22`.
4. Deploy. Cloudflare assigns a free `*.pages.dev` URL; the exact name depends on availability. Future commits deploy through the Git integration.

The included `_redirects` supports direct game-detail routes. `_headers` adds a restrictive security policy. There is no server, database binding, paid service, or secret required at runtime. Build does not fetch HN or Steam.

### Alternative: direct upload / GitHub Actions

```sh
npm ci
npm run build
npx wrangler login
npx wrangler pages project create hackergames --production-branch main
npx wrangler pages deploy dist --project-name hackergames --branch main
```

For the manual **Deploy to Cloudflare Pages** workflow, add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit access for your account), and create the Pages project first. The workflow is manual so credentials are optional and a fresh checkout does not trigger a failing deployment. If the project name is taken, update the workflow command to your chosen name.

Choose either Git integration or direct upload when creating the Cloudflare project. Refer to [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/) for account-specific UI and hosting limitations.

## GitHub Pages (`github.io`)

This repository can also publish free to `https://nicobrenner.github.io/hackergames/`. The **Deploy to GitHub Pages** workflow builds the app with the repository subpath, generates direct HTML entry points for each game so detail links work on refresh, and publishes on pushes to `main`. To enable it once, open the repository’s **Settings → Pages** and choose **GitHub Actions** as the build and deployment source. The workflow then handles later updates. A custom domain can be connected in Pages settings if desired.

GitHub Pages is the simplest choice if you want the `github.io` URL and static hosting. Cloudflare Pages is already supported and gives a free `*.pages.dev` address with Git integration. Both serve the same static app and need no runtime secrets; Cloudflare remains the repository’s documented default.

## GitHub publication

From this directory, after authenticating with `gh auth login`:

```sh
gh repo create hackergames --public --source=. --remote=origin --push
```

Do not run this if the remote already exists; use `git push -u origin main` instead. The project has its own Git repository and does not modify the enclosing workspace repository.

## Rights and privacy

The MIT license applies to original code only. HN content belongs to its authors; each excerpt links to its source. Game artwork and metadata belong to their publishers/source providers, are attributed on game pages, and are not relicensed by this repository. Artwork is loaded remotely rather than redistributed as local assets. No broad artwork reuse license is claimed. Remote artwork requests reveal normal browser request information to the image host. No analytics, tracking scripts, cookies, account system, or paid placements are included.

Metadata describes the credited source edition (for example a Steam release date may differ from the game's original release). Missing data remains missing rather than inferred. Browser games with no usable licensed artwork use a typographic fallback.

## Future work / limitations

- Full-history backfill: the current local archive samples whole days, and additional thread searches are bounded. These cannot establish all-time HN popularity.
- More reviewed recommendations and a reviewer interface; multiple independent reviewers and calibrated confidence.
- Better Jeffy evaluation using independent human labels and more training examples. PROJECT 24 currently runs an experimental local Jeffy topic classifier; it labels conversation themes, not game identities or recommendations.
- Richer alias catalogs, edition-aware metadata, licensed local artwork, and ongoing source-deletion reconciliation.
- Broader coverage from additional full-history sources, multilingual titles, stronger alias resolution, and ongoing correction review.
- Frontend automated browser regression tests; current verification includes TypeScript production build, Python tests/data invariants, and manual browser interaction checks.

HN search API: <https://hn.algolia.com/api>. Original discussions: <https://news.ycombinator.com/>. This independent project is not affiliated with Y Combinator, Hacker News, Valve, or game publishers.
