import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
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
import { listenForOutboundClicks, trackPageView } from "./analytics";
import "./style.css";
const sections = [
  "All games",
  "Most Recommended",
  "Most Discussed",
  "Browser Games",
  "Show HN Games",
] as const;
type Section = (typeof sections)[number];
type Medium = "video" | "tabletop";
const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const appPath = (path: string) => `${appBase}${path.startsWith("/") ? path : `/${path}`}`;
const routePath = (path: string) => {
  const route = appBase && (path === appBase || path.startsWith(`${appBase}/`)) ? path.slice(appBase.length) || "/" : path;
  return route.replace(/\/+$/, "") || "/";
};
const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString();
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
function ProceduralArtwork({ game }: { game: Game }) {
  const seed = Array.from(game.id).reduce((value, char) => (value * 33 + char.charCodeAt(0)) >>> 0, 5381);
  const palettes = [
    ["#172b2a", "#e8754e", "#c9d59b"], ["#29233b", "#e1a84b", "#a8d6d2"],
    ["#173442", "#f07b58", "#e0d69a"], ["#30231f", "#a9ca7d", "#e8a769"],
    ["#252a40", "#d66f8e", "#8ad0c1"],
  ];
  const [base, accent, light] = palettes[seed % palettes.length];
  const id = game.id.replace(/[^a-z0-9-]/gi, "");
  return <div className="procedural-art" aria-label={`Generated artwork for ${game.title}`}>
    <svg viewBox="0 0 1200 560" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`art-bg-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={base}/><stop offset="1" stopColor="#101914"/></linearGradient>
        <radialGradient id={`art-glow-${id}`}><stop stopColor={accent} stopOpacity=".86"/><stop offset="1" stopColor={accent} stopOpacity="0"/></radialGradient>
        <pattern id={`art-grid-${id}`} width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke={light} strokeOpacity=".13" strokeWidth="1"/></pattern>
      </defs>
      <rect width="1200" height="560" fill={`url(#art-bg-${id})`}/>
      <rect width="1200" height="560" fill={`url(#art-grid-${id})`}/>
      <circle cx={250 + seed % 600} cy={190 + seed % 160} r="340" fill={`url(#art-glow-${id})`}/>
      <g className="procedural-orbit" fill="none" stroke={light} strokeOpacity=".48">
        <ellipse cx="790" cy="280" rx="360" ry="148" strokeWidth="2" transform={`rotate(${seed % 50 - 25} 790 280)`}/>
        <ellipse cx="790" cy="280" rx="250" ry="205" strokeWidth="1.5" transform={`rotate(${-seed % 45} 790 280)`}/>
        <circle cx="790" cy="280" r="92" strokeWidth="2"/>
      </g>
      <path d="M0 430 Q270 300 500 420 T1000 385 T1400 440 V560 H0Z" fill={base} fillOpacity=".7"/>
      <path d="M0 476 Q300 365 600 478 T1200 440 V560 H0Z" fill={accent} fillOpacity=".28"/>
      <g fill={light} fillOpacity=".82"><circle cx="170" cy="120" r="4"/><circle cx="1020" cy="110" r="5"/><circle cx="970" cy="430" r="3"/><circle cx="450" cy="180" r="3"/></g>
    </svg>
    <div className="procedural-art-label"><small>PROJECT 24 · {game.genre || "GAME"}</small></div>
  </div>;
}
function Cover({ game, className = "", fallbackVariant }: { game: Game; className?: string; fallbackVariant?: "procedural" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [game.id, game.coverUrl]);
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
      ) : fallbackVariant === "procedural" ? <ProceduralArtwork game={game} /> : (
        <div className="cover-fallback">
          <Gamepad2 size={42} />
          <span>{game.title}</span>
        </div>
      )}
    </div>
  );
}
function SentimentIndicator({
  label,
  evidenceCount,
  detail = false,
  compact = false,
  href,
  onClick,
}: {
  label: "positive" | "negative" | "mixed" | "unclear";
  evidenceCount?: number;
  detail?: boolean;
  compact?: boolean;
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  if (label === "unclear") return null;
  const name = detail
    ? { positive: "Positive tone", negative: "Critical tone", mixed: "Mixed tone", unclear: "No clear signal" }[label]
    : { positive: "Positive signals", negative: "Critical signals", mixed: "Mixed reactions", unclear: "No clear signal" }[label];
  const count = evidenceCount === undefined ? "" : ` · ${evidenceCount} excerpt${evidenceCount === 1 ? "" : "s"}`;
  const className = `sentiment-indicator ${label}${compact ? " compact" : ""}`;
  const content = <><i aria-hidden="true" />{compact ? null : <>{name}{count}</>}</>;
  const title = `Experimental sample tone${count}; phrase-cue heuristic, not calibrated.`;
  return href
    ? <a className={`${className} sentiment-indicator-link`} href={href} onClick={onClick} aria-label={`${name}${count}`} title={title}>{content}</a>
    : <span className={className} aria-label={`${name}${count}`} title={title}>{content}</span>;
}
function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState("");
  const [route, setRoute] = useState(routePath(location.pathname)),
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
  const [theme, setTheme] = useState(params.get("theme") || "all");
  const [sentiment, setSentiment] = useState(params.get("sentiment") || "all");
  const [medium, setMedium] = useState<Medium>(params.get("medium") === "tabletop" ? "tabletop" : "video");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [visibleGames, setVisibleGames] = useState(() => window.matchMedia("(max-width: 760px)").matches ? 5 : 48);
  const pageSize = isMobile ? 5 : 48;
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightPlaying, setSpotlightPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => setVisibleGames(pageSize), [query, section, genre, platform, sort, theme, sentiment, medium, pageSize]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
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
      setRoute(routePath(location.pathname));
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
      setTheme(p.get("theme") || "all");
      setSentiment(p.get("sentiment") || "all");
      setMedium(p.get("medium") === "tabletop" ? "tabletop" : "video");
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  function navigate(path: string) {
    history.pushState({}, "", appPath(path));
    setRoute(routePath(location.pathname));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    if (route !== "/") return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (theme !== "all") p.set("theme", theme);
    if (sentiment !== "all") p.set("sentiment", sentiment);
    if (medium === "tabletop") p.set("medium", medium);
    if (section !== "All games") p.set("section", section);
    if (genre !== "All genres") p.set("genre", genre);
    if (platform !== "All platforms") p.set("platform", platform);
    history.replaceState({}, "", appPath(`/${p.size ? "?" + p : ""}${location.hash}`));
  }, [query, section, genre, platform, route, theme, sentiment, medium]);
  const games = catalog?.games || [];
  const spotlightTopics = useMemo(() => [...new Map(games.filter(game => game.medium !== "tabletop").flatMap(game => game.mentions
    .filter(mention => mention.kind === "comment" && mention.theme && mention.text.trim().length >= 55 && mention.text.toLowerCase().includes(game.title.toLowerCase()))
    .map(mention => [mention.theme!.label, mention.theme!.name] as const))).entries()].sort((a,b) => a[1].localeCompare(b[1])), [games]);
  const selected = route.startsWith("/game/")
    ? games.find((g) => g.id === decodeURIComponent(route.slice(6)))
    : null;
  useEffect(() => {
    document.title = selected
      ? `${selected.title} — PROJECT 24`
      : route === "/about"
        ? "How the index works — PROJECT 24"
        : "PROJECT 24 — Games people on HN talk about.";
  }, [selected, route]);
  useEffect(listenForOutboundClicks, []);
  // Declared after the document.title effect so the page view carries the new title,
  // and keyed on the route alone so the filters, which only replaceState, do not
  // count as navigation. On /game/<id> it waits for the catalog, otherwise the title
  // is still the generic one. The ref also absorbs StrictMode's double effect in dev.
  const trackedRoute = useRef("");
  useEffect(() => {
    if (route.startsWith("/game/") && !catalog) return;
    if (trackedRoute.current === route) return;
    trackedRoute.current = route;
    trackPageView();
  }, [route, catalog, selected]);
  const collectionGames = games.filter(g => (g.medium || "video") === medium);
  const genres = [
    ...new Set(collectionGames.flatMap((g) => (g.genres?.length ? g.genres : [g.genre]))),
  ].sort();
  const platforms = [...new Set(collectionGames.flatMap((g) => g.platforms))].sort();
  const shown = useMemo(
    () =>
      games
        .filter((g) => {
          const matches = `${g.title} ${g.aliases.join(" ")} ${g.genre}`
            .toLowerCase()
            .includes(query.toLowerCase());
          return (
            matches &&
            (g.medium || "video") === medium &&
            (theme === "all" || !!g.themes?.some(t => t.label === theme)) &&
            (sentiment === "all" || g.sentimentSummary?.label === sentiment) &&
            (genre === "All genres" ||
              g.genres?.includes(genre) ||
              g.genre === genre) &&
            (platform === "All platforms" || g.platforms.includes(platform)) &&
            (section !== "Browser Games" || !!g.playUrl) &&
            (section !== "Show HN Games" || g.showHN) &&
            (section !== "Most Recommended" || g.verifiedRecommendations > 0)
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
    [games, query, genre, platform, section, sort, theme, sentiment, medium],
  );
  const spotlightItems = useMemo(() => {
    const items = games.filter(game => game.medium !== "tabletop").flatMap(game => game.mentions
      .filter(mention => mention.kind === "comment" && mention.theme && mention.text.trim().length >= 55 && (theme === "all" || mention.theme.label === theme))
      .map(mention => ({game, mention, direct: mention.text.toLowerCase().includes(game.title.toLowerCase())}))
      .filter(item => item.direct));
    const seen = new Set<string>();
    const candidates = items.sort((a, b) => (b.mention.theme?.confidence || 0) - (a.mention.theme?.confidence || 0) || a.mention.id.localeCompare(b.mention.id))
      .filter(item => { if (seen.has(item.mention.id)) return false; seen.add(item.mention.id); return true; });
    const labels = [...new Set(candidates.map(item => item.mention.theme!.label))].sort();
    const selected: typeof candidates = [];
    const selectedIds = new Set<string>();
    const selectedGames = new Set<string>();
    // First round gives each topic and game a turn; later rounds fill the remaining slots.
    for (const label of labels) {
      const item = candidates.find(candidate => candidate.mention.theme?.label === label && !selectedGames.has(candidate.game.id));
      if (item) { selected.push(item); selectedIds.add(item.mention.id); selectedGames.add(item.game.id); }
    }
    while (selected.length < 24) {
      let added = false;
      for (const label of labels) {
        if (selected.length >= 24) break;
        const item = candidates.find(candidate => candidate.mention.theme?.label === label && !selectedIds.has(candidate.mention.id));
        if (item) { selected.push(item); selectedIds.add(item.mention.id); added = true; }
      }
      if (!added) break;
    }
    return selected;
  }, [games, theme]);
  const activeSpotlight = spotlightItems.length ? spotlightItems[spotlightIndex % spotlightItems.length] : undefined;
  useEffect(() => { setSpotlightIndex(0); }, [theme]);
  useEffect(() => {
    if (!spotlightPlaying || spotlightItems.length < 2) return;
    const timer = window.setInterval(() => setSpotlightIndex(index => (index + 1) % spotlightItems.length), 9000);
    return () => window.clearInterval(timer);
  }, [spotlightPlaying, spotlightItems.length]);
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
        href={appPath(`/game/${game.id}`)}
        onClick={(e) => internal(e, `/game/${game.id}`)}
      >
        {children}
      </a>
    );
  }
  function reset() {
    setQuery("");
    setTheme("all");
    setSentiment("all");
    setGenre("All genres");
    setPlatform("All platforms");
    setSection("All games");
  }
  function changeMedium(next: Medium) {
    setMedium(next); setQuery(""); setSection("All games"); setSort("recommended");
    setGenre("All genres"); setPlatform("All platforms"); setTheme("all"); setSentiment("all");
  }
  function openTheme(e: React.MouseEvent<HTMLAnchorElement>, label: string, target: Medium = "video") {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setQuery("");
    setSection("All games");
    setGenre("All genres");
    setPlatform("All platforms");
    setSentiment("all");
    setTheme(label);
    setMedium(target);
    history.pushState({}, "", appPath(`/?theme=${encodeURIComponent(label)}${target === "tabletop" ? "&medium=tabletop" : ""}#catalog`));
    setRoute("/");
    window.requestAnimationFrame(() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }));
  }
  function openSentiment(e: React.MouseEvent<HTMLAnchorElement>, label: "positive" | "negative" | "mixed", target: Medium = "video") {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setQuery(""); setSection("All games"); setGenre("All genres"); setPlatform("All platforms"); setTheme("all"); setSentiment(label); setMedium(target);
    history.pushState({}, "", appPath(`/?sentiment=${label}${target === "tabletop" ? "&medium=tabletop" : ""}#catalog`));
    setRoute("/");
    window.requestAnimationFrame(() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }));
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <div className="wrap nav">
          <a
            className="brand"
            href={appPath("/")}
            onClick={(e) => {
              internal(e, "/");
              reset();
            }}
          >
            <span className="brand-icon">
              <Gamepad2 size={24} />
            </span>
            PROJECT <span>24</span>
          </a>
          <nav aria-label="Main navigation">
            <a
              className={route === "/" ? "current" : ""}
              href={appPath("/")}
              onClick={(e) => internal(e, "/")}
            >
              Discover
            </a>
            <a
              className={route === "/about" ? "current" : ""}
              href={appPath("/about")}
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
            <h1>Loading the collection…</h1>
            <p>Loading the PROJECT 24 index.</p>
          </div>
        ) : route === "/about" ? (
          <section className="about">
            <a className="back" href={appPath("/")} onClick={(e) => internal(e, "/")}>
              <ArrowLeft size={16} /> Back to discovery
            </a>
        <div className="eyebrow">PROJECT 24 · SMALL INDEX. OPEN EVIDENCE.</div>
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
                  <strong>Keyword matches</strong> are raw search estimates before
                  game detection. They may contain false positives, duplicates
                  across aliases, and unrelated uses of a name. They are never
                  treated as recommendations. An em dash means no search estimate is available.
                </p>
                <h2>Conversation themes and tone</h2>
                <p>A custom <a href="https://jeffyclassify.com" target="_blank" rel="noreferrer">Jeffy</a> classifier suggests topics such as puzzles, nostalgia, and technical craft. It does not classify sentiment. The small dots use explicit phrase cues to mark positive, critical, or mixed tone; they abstain when the text has no clear signal. This heuristic is uncalibrated and may miss sarcasm or refer to the surrounding discussion rather than the game. It is separate from reviewed recommendations and is not a measure of community consensus. A sentiment-specific Jeffy head needs labeled evaluation data before we can trust it enough to replace these limited cues.</p>
                <h2>A growing, incomplete collection</h2>
                <p>{catalog.coverage.description}</p><p>The local archive samples whole days, mostly from 2008–2026. Busy days can dominate a sample. It is not a complete history of HN; newer entries also have less recommendation review.</p>
                <p>The tabletop collection is an early, manually selected pilot from that archive. Its comments and identities were checked by Codex, and it is not updated by the video-game collector. Rankings are separate for each collection and reflect the evidence selected so far.</p>
                <p>
                  Rankings describe this sample, not all of Hacker News.
                  Collection limits, uneven coverage, and a small source-review
                  set introduce bias. We have temporarily removed Hidden Gems:
                  only one game meets our current reviewed-recommendation and
                  low-discussion threshold, and this sample cannot establish that
                  a game is truly obscure.
                </p>
              </div>
              <aside>
                <h3>Under the hood</h3>
                <ol>
                  <li>
                    Scan a local archive of 1,191,935 comments and 293,708 submissions, then collect additional discussions through the HN Algolia API.
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
                <a href={appPath("/data/catalog.json")} target="_blank" rel="noreferrer">
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
              each page. PROJECT 24 is an independent project, not affiliated
              with Hacker News, Y Combinator, Valve, or any game publisher.
            </p>
            <p>
              Future work includes broader historical coverage, community review
              tools, and a stronger independent evaluation of the experimental
              <a href="https://jeffyclassify.com" target="_blank" rel="noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}> Jeffy topic classifier</a>. PROJECT 24 has no exhaustive archive and does not automatically verify recommendations.
            </p>
          </section>
        ) : selected ? (
          <Detail
            game={selected}
            link={link}
            onBack={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              if (medium !== selected.medium) changeMedium(selected.medium || "video");
              navigate(selected.medium === "tabletop" ? "/?medium=tabletop#catalog" : "/");
            }}
            onSentimentClick={openSentiment}
            onThemeClick={openTheme}
            games={games}
          />
        ) : route !== "/" ? (
          <div className="empty">
            <h1>Game not found.</h1>
            <a href={appPath("/")} onClick={(e) => internal(e, "/")}>
              Browse the games →
            </a>
          </div>
        ) : (
          <>
            <section className="spotlight" aria-labelledby="spotlight-title">
              <div className="spotlight-heading">
                <div>
                  <div className="eyebrow"><span className="tiny-square" /> FROM HN CONVERSATIONS</div>
                  <h1 id="spotlight-title">What games is HN talking about?</h1>
                </div>
                <label className="spotlight-filter">Conversation theme
                  <span className="spotlight-select-wrap">
                    <select aria-label="Conversation theme" value={theme} onChange={e => {
                      if (medium === "tabletop") changeMedium("video");
                      setTheme(e.target.value);
                    }}>
                      <option value="all">All conversations</option>
                      {spotlightTopics.map(([value,name]) => <option key={value} value={value}>{name}</option>)}
                    </select>
                    <ChevronDown aria-hidden="true" size={17} />
                  </span>
                </label>
              </div>
              {activeSpotlight ? <article className="spotlight-card" aria-live="polite">
                <div className={`spotlight-visual${activeSpotlight.game.coverUrl ? " has-cover" : " generated-cover"}`}>
                  {activeSpotlight.game.coverUrl && <div className="spotlight-backdrop" aria-hidden="true" style={{backgroundImage: `url(${JSON.stringify(activeSpotlight.game.coverUrl)})`}} />}
                  <Cover game={activeSpotlight.game} className="spotlight-cover" fallbackVariant="procedural" />
                  <div className="spotlight-shade" />
                  <div className="spotlight-content">
                    <div className="spotlight-game-line">{link(activeSpotlight.game, <>{activeSpotlight.game.title} <ArrowUpRight size={17}/></>, "spotlight-game")}
                      {activeSpotlight.game.sentimentSummary && activeSpotlight.game.sentimentSummary.label !== "unclear" && <SentimentIndicator label={activeSpotlight.game.sentimentSummary.label} evidenceCount={activeSpotlight.game.sentimentSummary.evidenceCount} href={appPath(`/?sentiment=${activeSpotlight.game.sentimentSummary.label}#catalog`)} onClick={e => openSentiment(e, activeSpotlight.game.sentimentSummary!.label as "positive" | "negative" | "mixed")} />}
                    </div>
                    <blockquote>“{activeSpotlight.mention.text}”</blockquote>
                    {activeSpotlight.mention.theme && <a className="spotlight-topic" href={appPath(`/?theme=${encodeURIComponent(activeSpotlight.mention.theme.label)}#catalog`)} onClick={e => openTheme(e, activeSpotlight.mention.theme!.label)} aria-label={`Show games tagged ${activeSpotlight.mention.theme.name}`}>Jeffy topic · {activeSpotlight.mention.theme.name} <ArrowUpRight size={12}/></a>}
                    <div className="spotlight-source"><span>{activeSpotlight.mention.author} · {activeSpotlight.mention.storyTitle}</span><a href={activeSpotlight.mention.url} target="_blank" rel="noreferrer">Read on Hacker News <ArrowUpRight size={14}/></a></div>
                  </div>
                </div>
                <div className="spotlight-controls">
                  <button aria-label="Previous conversation" onClick={() => setSpotlightIndex(index => (index - 1 + spotlightItems.length) % spotlightItems.length)}><ArrowLeft size={17}/></button>
                  <span>{String(spotlightIndex + 1).padStart(2,"0")} <i>/</i> {String(spotlightItems.length).padStart(2,"0")}</span>
                  <button aria-label="Next conversation" onClick={() => setSpotlightIndex(index => (index + 1) % spotlightItems.length)}><ArrowRight size={17}/></button>
                  <button className="spotlight-play" aria-label={spotlightPlaying ? "Pause automatic rotation" : "Resume automatic rotation"} onClick={() => setSpotlightPlaying(value => !value)}>{spotlightPlaying ? "Pause" : "Play"}</button>
                  <span className="spotlight-note">Jeffy tags the topic; the tone cue is separate and experimental. The theme menu filters the video-game collection and this fixed sample.</span>
                </div>
              </article> : <div className="spotlight-empty">No matching excerpts in this theme yet. Try another conversation theme.</div>}
            </section>
            <section className="catalog" id="catalog">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">THE COLLECTION</div>
                  <h2>
                    Browse games<span>.</span>
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
              <div className="medium-switch" role="group" aria-label="Choose a collection">
                <button className={medium === "video" ? "active" : ""} aria-pressed={medium === "video"} onClick={() => changeMedium("video")}><Gamepad2 size={16} /> Video games <span>{games.filter(g => g.medium !== "tabletop").length}</span></button>
                <button className={medium === "tabletop" ? "active" : ""} aria-pressed={medium === "tabletop"} onClick={() => changeMedium("tabletop")}><span aria-hidden="true">✳</span> Tabletop games <span>{games.filter(g => g.medium === "tabletop").length}</span></button>
              </div>
              {medium === "tabletop" && <p className="tabletop-note">A small, source-checked collection of board, card, and tabletop role-playing games from the sampled HN archive.</p>}
              <div className="tabs" role="group" aria-label="Game collections">
                {sections.filter(s => medium === "video" || (s !== "Browser Games" && s !== "Show HN Games")).map((s) => (
                  <button
                    aria-pressed={section === s}
                    className={s === section ? "active" : ""}
                    onClick={() => {
                      setSection(s);
                      setSort("recommended");
                    }}
                    key={s}
                  >
                    {s === "All games" ? (
                      <Gamepad2 size={16} />
                    ) : s === "Browser Games" ? (
                      <Sparkles size={15} />
                    ) : s === "Show HN Games" ? (
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
                {medium === "video" && <label className="select">
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
                </label>}
                <label className="select">
                  <select aria-label="Filter by HN tone" value={sentiment} onChange={e => setSentiment(e.target.value)}>
                    <option value="all">All HN tones</option>
                    <option value="positive">Positive signals</option>
                    <option value="negative">Critical signals</option>
                    <option value="mixed">Mixed reactions</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="result-line">
                <span>
                  {shown.length} {shown.length === 1 ? "game" : "games"}
                  {section === "Show HN Games"
                    ? " · Curated creator launch posts · not recommendations"
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
                {shown.slice(0, visibleGames).map((g, i) => (
                  <article className="card" key={g.id}>
                    <a className="card-link" href={appPath(`/game/${g.id}`)} onClick={e => internal(e, `/game/${g.id}`)}>
                        <div className="card-art">
                          <Cover game={g} fallbackVariant={g.medium === "tabletop" ? "procedural" : undefined} />
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
                    </a>
                        <div className="card-body">
                          <div className="game-meta">
                            {g.genre}
                            {g.releaseDate && <><span>·</span>{g.releaseDate.match(/\d{4}/)?.[0] || g.releaseDate}</>}
                          </div>
                          <div className="card-title-line">
                            <h3><a className="card-title-link" href={appPath(`/game/${g.id}`)} onClick={e => internal(e, `/game/${g.id}`)}>{g.title}</a></h3>
                            {g.sentimentSummary && g.sentimentSummary.label !== "unclear" && <SentimentIndicator label={g.sentimentSummary.label} evidenceCount={g.sentimentSummary.evidenceCount} compact href={appPath(`/?sentiment=${g.sentimentSummary.label}${g.medium === "tabletop" ? "&medium=tabletop" : ""}#catalog`)} onClick={e => openSentiment(e, g.sentimentSummary!.label as "positive" | "negative" | "mixed", g.medium || "video")} />}
                          </div>
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
                  </article>
                ))}
              </div>
              {shown.length > visibleGames && <button className="random show-more" onClick={() => setVisibleGames(n => n + pageSize)}>Show next {Math.min(pageSize, shown.length - visibleGames)} games ({shown.length - visibleGames} remaining)</button>}
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
                  Rankings reflect a collected sample,
                  not all of HN. A mention isn’t an endorsement.
                  <br />
                  <a href={appPath("/about")} onClick={(e) => internal(e, "/about")}>
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
                  Help tend the collection.
                </h2>
                <p>
                  Missing a game? Found a bad match? Suggestions and corrections are welcome.
                </p>
              </div>
              <a href="https://github.com/nicobrenner/project24/issues" target="_blank" rel="noreferrer">
                Contribute on GitHub <ArrowUpRight size={18} />
              </a>
            </section>
          </>
        )}
      </main>
      <footer className="wrap">
        <a
          className="brand footer-brand"
                  href={appPath("/")}
          onClick={(e) => internal(e, "/")}
        >
          <Gamepad2 size={20} /> PROJECT 24
        </a>
        <p>Built from HN conversations. Still growing.</p>
        <a href={appPath("/about")} onClick={(e) => internal(e, "/about")}>
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
  onSentimentClick,
  onThemeClick,
  link,
  games,
}: {
  game: Game;
  onBack: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onSentimentClick: (e: React.MouseEvent<HTMLAnchorElement>, label: "positive" | "negative" | "mixed", medium?: Medium) => void;
  onThemeClick: (e: React.MouseEvent<HTMLAnchorElement>, label: string, medium?: Medium) => void;
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
      <a className="back" href={appPath(g.medium === "tabletop" ? "/?medium=tabletop#catalog" : "/")} onClick={onBack}>
        <ArrowLeft size={16} /> Back to the index
      </a>
      <div className="detail-hero">
        <Cover game={g} fallbackVariant={g.medium === "tabletop" ? "procedural" : undefined} />
        <div>
          <div className="eyebrow">
            {g.medium === "tabletop" ? "TABLETOP · " : ""}{g.genre}{g.releaseDate ? ` · ${g.releaseDate}` : ""}
          </div>
          <div className="game-title-line">
            <h1>{g.title}</h1>
            {g.sentimentSummary && g.sentimentSummary.label !== "unclear" && <SentimentIndicator label={g.sentimentSummary.label} evidenceCount={g.sentimentSummary.evidenceCount} href={appPath(`/?sentiment=${g.sentimentSummary.label}${g.medium === "tabletop" ? "&medium=tabletop" : ""}#catalog`)} onClick={e => onSentimentClick(e, g.sentimentSummary!.label as "positive" | "negative" | "mixed", g.medium || "video")} />}
          </div>
          <a className="conversation-jump-button" href="#conversations">
            Related HN conversations <ArrowDown size={16} />
          </a>
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
          <span>Raw search estimate · unverified</span>
        </div>
      </div>
      <section className="outside-links" aria-label="Videos, streams, communities, and reviews elsewhere">
        <div>
          <span className="eyebrow">FROM AROUND THE WEB</span>
          <h2>Watch a little. Read around.</h2>
          <p>These links open searches on other sites. PROJECT 24 does not endorse or reproduce their videos, streams, community posts, reviews, or ratings.</p>
        </div>
        <div className="outside-link-list">
          <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${g.title} gameplay trailer`)}`} target="_blank" rel="noreferrer">YouTube videos <ArrowUpRight size={15} /></a>
          <a href={`https://www.twitch.tv/search?term=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer">Find Twitch streams <ArrowUpRight size={15} /></a>
          <a href={`https://www.reddit.com/search/?q=${encodeURIComponent(g.title)}&type=sr`} target="_blank" rel="noreferrer">Find Reddit communities <ArrowUpRight size={15} /></a>
          {g.medium === "tabletop" ? <a href={`https://www.google.com/search?q=${encodeURIComponent(`site:${g.genre === "role-playing" ? "rpggeek.com" : "boardgamegeek.com"} ${g.title}`)}`} target="_blank" rel="noreferrer">Find {g.genre === "role-playing" ? "RPGGeek" : "BoardGameGeek"} pages <ArrowUpRight size={15} /></a> : <>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`site:metacritic.com/game ${g.title} reviews`)}`} target="_blank" rel="noreferrer">Find Metacritic reviews <ArrowUpRight size={15} /></a>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`site:opencritic.com ${g.title} reviews`)}`} target="_blank" rel="noreferrer">Find OpenCritic reviews <ArrowUpRight size={15} /></a>
            <a href={`https://www.imdb.com/find/?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer">Look up on IMDb <ArrowUpRight size={15} /></a>
          </>}
          {g.storeUrl?.includes('store.steampowered.com/app/') && <a href={`${g.storeUrl.replace(/\/$/, '')}/#app_reviews_hash`} target="_blank" rel="noreferrer">Steam player reviews <ArrowUpRight size={15} /></a>}
        </div>
      </section>
      <div className="discussion-layout">
        <div>
          <div className="section-heading" id="conversations">
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
                <SentimentIndicator label={m.sentiment?.label || "unclear"} detail />
                <time>{date(m.date)}</time>
              </div>
              {m.theme && <div className="theme-label">{m.theme.name} <span>· Jeffy suggestion</span></div>}
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
                {m.sentiment && <p>Sentiment signal: {m.sentiment.name}. {m.sentiment.provenance} Classifier: {m.sentiment.model}; confidence is uncalibrated and does not establish consensus.</p>}
                {m.theme && <p>Jeffy conversation topic: <a href={appPath(`/?theme=${encodeURIComponent(m.theme.label)}${g.medium === "tabletop" ? "&medium=tabletop" : ""}#catalog`)} onClick={e => onThemeClick(e, m.theme!.label, g.medium || "video")}>{m.theme.name}</a> · <a href="https://jeffyclassify.com" target="_blank" rel="noreferrer">About Jeffy</a>. Custom head {m.theme.model}, confidence {Math.round(m.theme.confidence * 100)}% (uncalibrated), trained on synthetic teaching examples. This describes the excerpt and may concern another game in the same comment; it is not a reviewed endorsement.</p>}
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
            A mention is only the beginning.
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
          <a href={appPath("/about")}>
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
              <Terminal size={16} /> Curated Show HN game launch post
              against the source.
            </p>
          )}
        </aside>
      </div>
      <div className="related">
        <h2>Keep exploring</h2>
        <div>
          {games
            .filter((other) => other.id !== g.id && other.genre === g.genre && other.medium === g.medium)
            .slice(0, 3)
            .map((other) => (
              <React.Fragment key={other.id}>
                {link(
                  other,
                  <>
                    <Cover game={other} fallbackVariant={other.medium === "tabletop" ? "procedural" : undefined} />
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
