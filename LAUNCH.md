# Launch handoff

The runtime is a static build; no API credentials are exposed to visitors.

## Completed validation

- TypeScript check and Vite production build pass.
- Sixteen Python tests pass, including ambiguity/sequel rejection, source-backed recommendation counts, review excerpts, incremental merge preservation, and safe failure when pagination would skip evidence.
- Browser interaction checks covered the earlier interface. The refreshed localhost browser review was blocked by the browser's loopback URL policy; this update was verified with the production build, data export, and pipeline tests.
- The original four browser play URLs were verified in the initial pass; the expansion adds the official Tetris play page.
- `npm audit` reported zero known vulnerabilities at install.
- Offline data export is deterministic for unchanged versioned inputs.

The expansion was checked for search and source-page rendering, with a 48-card initial page and a Show more control.

## Dataset

PROJECT 24 contains 818 game identities and 5,009 HN source records from the sampled archive and earlier searches. It has 43 endorsements individually source-reviewed by Codex; the newly discovered identity matches are mentions only. The review assessments carry provenance but are not independent human verification. This is a bounded sample, not all-time HN popularity. One verified historical Show HN game (Looptap) is included; its original hosting was unavailable, so no play link is offered.

## Hosting

The site is published by the **Deploy to GitHub Pages** workflow on every push to `main`,
at `https://nicobrenner.github.io/project24/`. The daily data-update workflow requires
GitHub Actions to be enabled and contents-write permission; it preserves reviewed
endorsements and does not automatically verify new ones.

## Remaining work

Expand historical and multilingual coverage, increase reviewed evidence, independently audit recommendations and Jeffy topic labels, add automated frontend browser regression tests, and reconcile deleted sources. Newly discovered games without licensed artwork use text treatments. Game pages link to external video and review searches without copying third-party scores.
