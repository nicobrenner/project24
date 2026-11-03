# Launch handoff

The project is ready for Cloudflare Pages. Its runtime is a static build; no API credentials are exposed to visitors.

## Completed validation

- TypeScript check and Vite production build pass.
- Sixteen Python tests pass, including ambiguity/sequel rejection, source-backed recommendation counts, review excerpts, incremental merge preservation, and safe failure when pagination would skip evidence.
- Browser checks cover rendered catalog, search, detail-page navigation, methodology, Hidden Gems, Show HN, and browser-game filtering.
- The original four browser play URLs were verified in the initial pass; the expansion adds the official Tetris play page.
- `npm audit` reported zero known vulnerabilities at install.
- Offline data export is deterministic for unchanged versioned inputs.

The expansion was checked for search and source-page rendering, with a 48-card initial page and a Show more control.

## Dataset

123 games; 2,986 accepted evidence records; 43 endorsements individually source-reviewed by Codex. Reviews are AI assessments with explicit provenance, not independent human verification. This is a bounded sample, not all-time HN popularity. One verified historical Show HN game (Looptap) is included; its original hosting was unavailable, so no play link is offered.

## Hosting setup still required

No Cloudflare API token or Wrangler OAuth configuration was available in the execution environment, so no public `pages.dev` deployment is claimed.

1. In Cloudflare Pages, connect `nicobrenner/hackergames` from GitHub.
2. Select branch `main`, build `npm run build`, output `dist`, Node `22`.
3. Deploy and use the free `pages.dev` URL Cloudflare returns.

For CLI/direct upload and optional GitHub deployment secrets, see the root README. The daily data-update workflow requires GitHub Actions to be enabled and repository contents-write permission; it preserves reviewed endorsements and does not automatically verify new ones.

## Remaining work

Expand historical/alias coverage, increase reviewed evidence, independently audit recommendations, integrate Jeffy, add automated frontend browser regression tests, reconcile deleted sources, and obtain any additional artwork permissions needed for broader reuse. Browser covers without supplied artwork deliberately use text treatments.
