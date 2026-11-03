import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Gamepad2,
  MessageSquare,
  Check,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  X,
  ExternalLink,
  Shuffle,
  ChevronDown,
} from "lucide-react";
import type { Catalog, Game, Mention } from "./types";
import "./style.css";
const sections = [
  "All games",
  "Most Recommended",
  "Most Discussed",
  "Hidden Gems",
  "Browser Games",
  "Show HN Games",
] as const;
type Section = (typeof sections)[number];
const fmt = (n: number) => n.toLocaleString();
const date = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.valueOf())
    ? value
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};
function Cover({ game, className = "" }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`cover ${className}`}
      style={{ backgroundColor: game.color || "#3e5144" }}
    >
      {game.coverUrl && !failed ? (
        <img
          src={game.coverUrl}
          alt={`${game.title} artwork`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <Gamepad2 size={42} />
          <span>{game.title}</span>
        </div>
      )}
    </div>
  );
}
function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState("");
  const [route, setRoute] = useState(location.pathname),
    [params, setParams] = useState(new URLSearchParams(location.search));
  const [query, setQuery] = useState(params.get("q") || ""),
    [section, setSection] = useState<Section>(
      sections.includes(params.get("section") as Section)
        ? (params.get("section") as Section)
        : "All games",
    );
  const [genre, setGenre] = useState(params.get("genre") || "All genres"),
    [platform, setPlatform] = useState(
      params.get("platform") || "All platforms",
    ),
    [sort, setSort] = useState("recommended");
  useEffect(() => {
    fetch("/data/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("The catalog could not be loaded.");
        return r.json();
      })
      .then(setCatalog)
      .catch(() =>
        setError("The catalog is temporarily unavailable. Please try again."),
      );
  }, []);
  useEffect(() => {
    const listener = () => {
      setRoute(location.pathname);
      const p = new URLSearchParams(location.search);
      setParams(p);
      setQuery(p.get("q") || "");
      setSection(
        sections.includes(p.get("section") as Section)
          ? (p.get("section") as Section)
          : "All games",
      );
      setGenre(p.get("genre") || "All genres");
      setPlatform(p.get("platform") || "All platforms");
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  function navigate(path: string) {
    history.pushState({}, "", path);
    setRoute(location.pathname);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    if (route !== "/") return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (section !== "All games") p.set("section", section);
    if (genre !== "All genres") p.set("genre", genre);
    if (platform !== "All platforms") p.set("platform", platform);
    history.replaceState({}, "", `/${p.size ? "?" + p : ""}${location.hash}`);
  }, [query, section, genre, platform, route]);
  const games = catalog?.games || [];
  const selected = route.startsWith("/game/")
    ? games.find((g) => g.id === decodeURIComponent(route.slice(6)))
    : null;
  useEffect(() => {
    document.title = selected
      ? `${selected.title} — HackerGames`
      : route === "/about"
        ? "How the index works — HackerGames"
        : "HackerGames — Games worth your downtime.";
  }, [selected, route]);
  const genres = [
    ...new Set(games.flatMap((g) => (g.genres?.length ? g.genres : [g.genre]))),
  ].sort();
  const platforms = [...new Set(games.flatMap((g) => g.platforms))].sort();
  const shown = useMemo(
    () =>
      games
        .filter((g) => {
          const matches = `${g.title} ${g.aliases.join(" ")} ${g.genre}`
            .toLowerCase()
            .includes(query.toLowerCase());
          return (
            matches &&
            (genre === "All genres" ||
              g.genres?.includes(genre) ||
              g.genre === genre) &&
            (platform === "All platforms" || g.platforms.includes(platform)) &&
            (section !== "Browser Games" || !!g.playUrl) &&
            (section !== "Show HN Games" || g.showHN) &&
            (section !== "Most Recommended" || g.verifiedRecommendations > 0) &&
            (section !== "Hidden Gems" ||
              (g.verifiedRecommendations > 0 && g.discussionCount <= 10))
          );
        })
        .sort((a, b) => {
          if (sort === "title") return a.title.localeCompare(b.title);
          if (section === "Most Discussed" || sort === "discussed")
            return (
              b.discussionCount - a.discussionCount ||
              a.title.localeCompare(b.title)
            );
          return (
            b.verifiedRecommendations - a.verifiedRecommendations ||
            b.discussionCount - a.discussionCount ||
            a.title.localeCompare(b.title)
          );
        }),
    [games, query, genre, platform, section, sort],
  );
  function internal(e: React.MouseEvent<HTMLAnchorElement>, path: string) {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      navigate(path);
    }
  }
  function link(game: Game, children: React.ReactNode, className = "") {
    return (
      <a
        className={className}
        href={`/game/${game.id}`}
        onClick={(e) => internal(e, `/game/${game.id}`)}
      >
        {children}
      </a>
    );
  }
  function reset() {
    setQuery("");
    setGenre("All genres");
    setPlatform("All platforms");
    setSection("All games");
  }
  const featured = ["outer-wilds", "factorio", "baba-is-you"]
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean) as Game[];
  const recommendations = games.reduce(
    (n, g) => n + g.verifiedRecommendations,
    0,
  );
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <div className="wrap nav">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              internal(e, "/");
              reset();
            }}
          >
            <span className="brand-icon">
              <Gamepad2 size={24} />
            </span>
            Hacker<span>Games</span>
            <small>BETA</small>
          </a>
          <nav aria-label="Main navigation">
            <a
              className={route === "/" ? "current" : ""}
              href="/"
              onClick={(e) => internal(e, "/")}
            >
              Discover
            </a>
            <a
              className={route === "/about" ? "current" : ""}
              href="/about"
              onClick={(e) => internal(e, "/about")}
            >
              How it works
            </a>
            <a
              className="hn-nav"
              href="https://news.ycombinator.com"
              target="_blank"
              rel="noreferrer"
            >
              Hacker News <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        {error ? (
          <div className="empty">
            <h1>Something didn’t load.</h1>
            <p>{error}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </div>
        ) : !catalog ? (
          <div className="loading" role="status">
            <Gamepad2 size={48} />
            <h1>Finding your next rabbit hole…</h1>
            <p>Loading the HackerGames index.</p>
          </div>
        ) : route === "/about" ? (
          <section className="about">
            <a className="back" href="/" onClick={(e) => internal(e, "/")}>
              <ArrowLeft size={16} /> Back to discovery
            </a>
            <div className="eyebrow">SMALL INDEX. OPEN EVIDENCE.</div>
            <h1>
              Good games.
              <br />
              Honest numbers.
            </h1>
            <p className="lede">
              A starting point for curious players, built from actual Hacker
              News conversations. Every recommendation has a source you can read
              yourself.
            </p>
            <div className="about-grid">
              <div>
                <h2>What the numbers mean</h2>
                <p>
                  <strong>Verified recommendations</strong> are endorsements of
                  a specific game, individually reviewed against the source by
                  Codex. These count individual comments, not unique players.
                  Automated candidates never enter this total.
                </p>
                <p>
                  <strong>Discussions</strong> are distinct HN threads
                  containing accepted mentions in our collected sample. A
                  technical conversation or a criticism is still a discussion.
                </p>
                <p>
                  <strong>Keyword matches</strong> are raw search results before
                  game detection. They may contain false positives, duplicates
                  across aliases, and unrelated uses of a name. They are never
                  treated as recommendations.
                </p>
                <h2>A deliberately bounded archive</h2>
                <p>{catalog.coverage.description}</p>
                <p>
                  Rankings describe this sample, not all of Hacker News.
                  Collection limits, uneven coverage, and a small source-review
                  set introduce bias. Hidden Gems means a game with at least one
                  reviewed recommendation and at most 10 sampled discussions; it
                  does not establish that a game is obscure.
                </p>
              </div>
              <aside>
                <h3>Under the hood</h3>
                <ol>
                  <li>
                    Collect historical submissions and comments through the HN
                    Algolia API.
                  </li>
                  <li>
                    Match known aliases with word boundaries and extra context
                    for ambiguous titles.
                  </li>
                  <li>
                    Classify conservatively. Store confidence, classifier
                    version, and review evidence. Codex reviews are AI
                    assessments, not human verification.
                  </li>
                  <li>
                    Publish a static snapshot with original source IDs and
                    links.
                  </li>
                </ol>
                <div className="snapshot">
                  <span className="live-dot" /> Snapshot:{" "}
                  {date(catalog.generatedAt)}
                </div>
                <a href="/data/catalog.json" target="_blank" rel="noreferrer">
                  Inspect the published dataset <ArrowUpRight size={15} />
                </a>
              </aside>
            </div>
            <h2>Attribution & independence</h2>
            <p>
              HN discussions are by their respective authors and linked to the
              originals. Game artwork belongs to its respective publishers and
              is loaded from the credited metadata source; it is not covered by
              this project’s code license. Game details include source links on
              each page. HackerGames is an independent project, not affiliated
              with Hacker News, Y Combinator, Valve, or any game publisher.
            </p>
            <p>
              Future work includes broader historical coverage, review tooling,
              richer metadata, and a pluggable Jeffy classifier. No exhaustive
              archive or automated recommendation verification is claimed.
            </p>
          </section>
        ) : selected ? (
          <Detail
            game={selected}
            link={link}
            onBack={(e) => internal(e, "/")}
            games={games}
          />
        ) : route !== "/" ? (
          <div className="empty">
            <h1>Game not found.</h1>
            <a href="/" onClick={(e) => internal(e, "/")}>
              Explore the index →
            </a>
          </div>
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-square" /> THE HACKER NEWS GAME INDEX
                </div>
                <h1>
                  Games worth
                  <br />
                  your <span>downtime.</span>
                  <svg viewBox="0 0 320 18" aria-hidden="true">
                    <path d="M3 12Q150 0 314 8M42 17Q175 8 280 13" />
                  </svg>
                </h1>
                <p>
                  Great games hide in great conversations.
                  <br />
                  Find your next obsession in the games
                  <br className="desktop" /> Hacker News can’t stop talking
                  about.
                </p>
                <a className="primary" href="#catalog">
                  Find your next game <ArrowRight size={17} />
                </a>
                <div className="hero-note">
                  <span className="hn-square">Y</span> Real conversations. No
                  paid placements.
                </div>
              </div>
              <div className="hero-art" aria-label="Games in the index">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="art-cross cross-one">+</span>
                <span className="art-cross cross-two">+</span>
                <div className="art-caption">
                  SIDE QUESTS START HERE <ArrowUpRight size={17} />
                </div>
                {featured.map((g, i) => (
                  <React.Fragment key={g.id}>
                    {link(
                      g,
                      <>
                        <Cover game={g} />
                        <div className="featured-label">
                          <span>{g.title}</span>
                          <ArrowUpRight size={17} />
                        </div>
                      </>,
                      `featured featured-${i}`,
                    )}
                  </React.Fragment>
                ))}
                <div className="evidence-sticker">
                  <span className="sticker-icon">
                    <MessageSquare size={19} />
                  </span>
                  <div>
                    Less scrolling.
                    <br />
                    <strong>More playing.</strong>
                  </div>
                </div>
              </div>
            </section>
            <div className="index-strip">
              <div>
                <span className="live-dot" /> A community’s taste, an open
                index.
              </div>
              <div>
                <strong>{games.length}</strong> games{" "}
                <span className="divider">/</span>{" "}
                <strong>{fmt(recommendations)}</strong> reviewed recommendations{" "}
                <span className="divider">/</span>{" "}
                <a href="/about" onClick={(e) => internal(e, "/about")}>
                  Explore the evidence <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
            <section className="catalog" id="catalog">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">YOUR NEXT RABBIT HOLE</div>
                  <h2>
                    Explore the index<span>.</span>
                  </h2>
                </div>
                <button
                  className="random"
                  onClick={() => {
                    if (shown.length)
                      navigate(
                        `/game/${shown[Math.floor(Math.random() * shown.length)].id}`,
                      );
                  }}
                  disabled={!shown.length}
                >
                  <Shuffle size={16} /> Surprise me
                </button>
              </div>
              <div className="tabs" role="group" aria-label="Game collections">
                {sections.map((s, i) => (
                  <button
                    aria-pressed={section === s}
                    className={s === section ? "active" : ""}
                    onClick={() => {
                      setSection(s);
                      setSort("recommended");
                    }}
                    key={s}
                  >
                    {i === 0 ? (
                      <Gamepad2 size={16} />
                    ) : i === 3 ? (
                      <Sparkles size={15} />
                    ) : i === 5 ? (
                      <Terminal size={16} />
                    ) : null}
                    {s}
                  </button>
                ))}
              </div>
              <div className="tools">
                <label className="search">
                  <Search size={19} />
                  <input
                    aria-label="Search games"
                    placeholder="Search games, genres, or a familiar favorite…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                  <kbd>/</kbd>
                </label>
                <label className="select">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Filter by genre"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  >
                    <option>All genres</option>
                    {genres.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
                <label className="select">
                  <select
                    aria-label="Filter by platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option>All platforms</option>
                    {platforms.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="result-line">
                <span>
                  {shown.length} {shown.length === 1 ? "game" : "games"}
                  {section === "Hidden Gems"
                    ? " · Reviewed picks in ≤10 sampled threads"
                    : section === "Show HN Games"
                      ? " · Reviewed original game submissions"
                      : ""}
                </span>
                <label>
                  Sort by{" "}
                  <select
                    aria-label="Sort games"
                    value={section === "Most Discussed" ? "discussed" : sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      if (section === "Most Discussed") setSection("All games");
                    }}
                  >
                    <option value="recommended">
                      Reviewed recommendations
                    </option>
                    <option value="discussed">Discussion count</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </label>
              </div>
              <div className="grid">
                {shown.map((g, i) => (
                  <article className="card" key={g.id}>
                    {link(
                      g,
                      <>
                        <div className="card-art">
                          <Cover game={g} />
                          <span className="rank">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {g.playUrl && (
                            <span className="browser-badge">
                              PLAY IN BROWSER <ArrowUpRight size={10} />
                            </span>
                          )}
                          <span className="card-arrow">
                            <ArrowUpRight size={22} />
                          </span>
                        </div>
                        <div className="card-body">
                          <div className="game-meta">
                            {g.genre}
                            <span>·</span>
                            {g.releaseDate?.match(/\d{4}/)?.[0] || "—"}
                          </div>
                          <h3>{g.title}</h3>
                          <p>{g.description}</p>
                          <div className="card-stats">
                            <span title="Recommendation comments individually source-reviewed by Codex">
                              <Check size={14} />
                              <strong>{g.verifiedRecommendations}</strong>{" "}
                              reviewed
                            </span>
                            <span title="Unique discussion threads in the collected sample">
                              <MessageSquare size={13} />
                              {fmt(g.discussionCount)} threads
                            </span>
                          </div>
                        </div>
                      </>,
                      "card-link",
                    )}
                  </article>
                ))}
              </div>
              {!shown.length && (
                <div className="empty">
                  <Search size={30} />
                  <h3>No games in this corner of the index.</h3>
                  <p>
                    Try another search or reset your filters. This is a growing,
                    curated catalog.
                  </p>
                  <button onClick={reset}>Reset filters</button>
                </div>
              )}
              <div className="catalog-note">
                <span className="note-icon">i</span>
                <p>
                  Quality over quantity. Rankings reflect a collected sample,
                  not all of HN. A mention isn’t an endorsement.
                  <br />
                  <a href="/about" onClick={(e) => internal(e, "/about")}>
                    Read how we count →
                  </a>
                </p>
                <span>UPDATED {date(catalog.generatedAt).toUpperCase()}</span>
              </div>
            </section>
            <section className="bottom-banner">
              <div className="banner-symbol">&gt;_</div>
              <div>
                <h2>
                  The best recommendations
                  <br />
                  come with a conversation.
                </h2>
                <p>
                  Follow the thread. Discover why a game stayed with someone.
                </p>
              </div>
              <a href="/about" onClick={(e) => internal(e, "/about")}>
                Behind the index <ArrowUpRight size={18} />
              </a>
            </section>
          </>
        )}
      </main>
      <footer className="wrap">
        <a
          className="brand footer-brand"
          href="/"
          onClick={(e) => internal(e, "/")}
        >
          <Gamepad2 size={20} /> HackerGames
        </a>
        <p>Made for curious minds with time to play.</p>
        <a href="/about" onClick={(e) => internal(e, "/about")}>
          Sources & methodology <ArrowUpRight size={13} />
        </a>
        <small>Independent. Not affiliated with Y Combinator.</small>
      </footer>
      <KeyboardSearch />
    </>
  );
}
function KeyboardSearch() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search games"]',
        );
        if (input) {
          e.preventDefault();
          input.focus();
          input.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return null;
}
function Detail({
  game: g,
  onBack,
  link,
  games,
}: {
  game: Game;
  onBack: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  link: (g: Game, c: React.ReactNode, cls?: string) => React.ReactNode;
  games: Game[];
}) {
  const [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(12);
  useEffect(() => {
    setFilter("all");
    setLimit(12);
  }, [g.id]);
  const mentions = [...g.mentions]
    .filter((m) => filter === "all" || m.classification === filter)
    .sort(
      (a, b) =>
        Number(b.classification === "recommendation") -
          Number(a.classification === "recommendation") ||
        b.date.localeCompare(a.date),
    );
  return (
    <section className="detail">
      <a className="back" href="/" onClick={onBack}>
        <ArrowLeft size={16} /> Back to the index
      </a>
      <div className="detail-hero">
        <Cover game={g} />
        <div>
          <div className="eyebrow">
            {g.genre} · {g.releaseDate}
          </div>
          <h1>{g.title}</h1>
          <p className="lede">{g.description}</p>
          <div className="platforms">
            {g.platforms.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
          <div className="detail-actions">
            {g.playUrl ? (
              <a
                className="primary"
                href={g.playUrl}
                target="_blank"
                rel="noreferrer"
              >
                Play in your browser <ArrowUpRight size={17} />
              </a>
            ) : g.storeUrl ? (
              <a
                className="primary"
                href={g.storeUrl}
                target="_blank"
                rel="noreferrer"
              >
                Visit game website <ArrowUpRight size={17} />
              </a>
            ) : null}
            <a
              className="text-link"
              href={g.metadataUrl}
              target="_blank"
              rel="noreferrer"
            >
              Game details <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
      <div className="detail-stats">
        <div>
          <strong>{g.verifiedRecommendations}</strong>
          <span>Reviewed recommendations</span>
        </div>
        <div>
          <strong>{g.discussionCount}</strong>
          <span>Sampled discussion threads</span>
        </div>
        <div>
          <strong>{fmt(g.keywordMatches)}</strong>
          <span>Raw keyword matches · unverified</span>
        </div>
      </div>
      <div className="discussion-layout">
        <div>
          <div className="section-heading">
            <h2>
              From the conversations<span>.</span>
            </h2>
            <label className="select">
              <select
                aria-label="Filter evidence"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setLimit(12);
                }}
              >
                <option value="all">All evidence</option>
                <option value="recommendation">Reviewed recommendations</option>
                <option value="candidate">Unreviewed candidates</option>
                <option value="mention">Mentions</option>
                <option value="criticism">Criticism</option>
                <option value="technical">Technical discussions</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Original comments and submissions. Excerpts are plain text; open the
            source for full context.
          </p>
          {mentions.slice(0, limit).map((m: Mention) => (
            <article className="comment" key={m.id}>
              <div className="comment-heading">
                <span className={`classification ${m.classification}`}>
                  {m.classification === "recommendation" ? (
                    <Check size={12} />
                  ) : (
                    <MessageSquare size={12} />
                  )}{" "}
                  {m.classification === "recommendation"
                    ? "Reviewed recommendation"
                    : m.classification === "candidate"
                      ? "Unreviewed candidate"
                      : m.classification}
                </span>
                <time>{date(m.date)}</time>
              </div>
              <blockquote>{m.text}</blockquote>
              <div className="comment-bottom">
                <span>
                  by <strong>{m.author || "unknown"}</strong>
                  {m.kind === "story" ? " · submission" : ""}
                </span>
                <a href={m.url} target="_blank" rel="noreferrer">
                  Read on HN <ArrowUpRight size={14} />
                </a>
              </div>
              <details>
                <summary>Classification evidence</summary>
                <p>
                  {m.provenance} · Confidence: {Math.round(m.confidence * 100)}%
                  (uncalibrated assessment)
                </p>
                {m.storyUrl && (
                  <a href={m.storyUrl} target="_blank" rel="noreferrer">
                    {m.storyTitle || "Parent discussion"} ↗
                  </a>
                )}
              </details>
            </article>
          ))}
          {!mentions.length && (
            <div className="empty">
              <p>No evidence in this category yet.</p>
            </div>
          )}
          {mentions.length > limit && (
            <button className="load-more" onClick={() => setLimit(limit + 12)}>
              Load more evidence ({mentions.length - limit} remaining)
            </button>
          )}
        </div>
        <aside className="detail-aside">
          <span className="eyebrow">CONTEXT MATTERS</span>
          <h3>
            A mention is
            <br />
            only the beginning.
          </h3>
          <p>
            People discuss games for all sorts of reasons. Only endorsements
            individually reviewed against the source by Codex count as
            recommendations here.
          </p>
          <p>
            Counts describe our collected sample. Multiple comments can come
            from the same person or conversation.
          </p>
          <a href="/about">
            How the index works <ArrowUpRight size={14} />
          </a>
          <hr />
          <h4>Metadata & artwork</h4>
          <p>{g.metadataAttribution}</p>
          <a href={g.metadataUrl} target="_blank" rel="noreferrer">
            View credited source <ArrowUpRight size={14} />
          </a>
          {g.showHN && (
            <p className="showhn-note">
              <Terminal size={16} /> Original Show HN game submission verified
              against the source.
            </p>
          )}
        </aside>
      </div>
      <div className="related">
        <h2>Keep exploring</h2>
        <div>
          {games
            .filter((other) => other.id !== g.id && other.genre === g.genre)
            .slice(0, 3)
            .map((other) => (
              <React.Fragment key={other.id}>
                {link(
                  other,
                  <>
                    <Cover game={other} />
                    <strong>{other.title}</strong>
                    <ArrowUpRight size={16} />
                  </>,
                  "related-card",
                )}
              </React.Fragment>
            ))}
        </div>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
