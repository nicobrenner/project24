"""Publish Wikidata-assisted game identities and exact HN evidence matches.

This stage adds mention evidence only. It never assigns recommendation status.
"""
import datetime as dt
import hashlib
import json
import re
import unicodedata
from pathlib import Path

from . import ingest
from .discover import normal


ROOT = Path(__file__).resolve().parents[1]
DECISIONS = ROOT / "data/reference-decisions.json"
METADATA = ROOT / "data/reference-metadata.json"
RECORDS = ROOT / "data/reference-matches.jsonl"


def slugify(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "game"


def publish(records_path=RECORDS):
    decisions = json.loads(DECISIONS.read_text())
    metadata = json.loads(METADATA.read_text())
    seeds = ingest.read(ROOT / "data/seeds.json")
    snapshot = ingest.read(ROOT / "data/snapshot.json")
    if metadata["decisionsSha256"] != hashlib.sha256(DECISIONS.read_bytes()).hexdigest():
        raise ValueError("Wikidata metadata does not correspond to current identity decisions")

    norm_seed = {}
    by_id = {g["id"]: g for g in seeds}
    for game in seeds:
        for title in [game["title"], *game.get("aliases", [])]:
            norm_seed.setdefault(normal(title), game)

    approved = {}
    skipped = {"ambiguous-magnus-company": 0}
    for decision in decisions["accepted"]:
        # Same named entity can refer to a chess platform/company rather than the game.
        if decision["title"].casefold() == "play magnus":
            skipped["ambiguous-magnus-company"] += 1
            continue
        approved[decision["key"]] = decision

    game_by_key = {}
    for decision in approved.values():
        title = decision["title"]
        game = norm_seed.get(normal(title))
        if game is None:
            base = slugify(title)
            slug = base if base not in by_id else f"{base}-{decision['qid'].lower()}"
            info = metadata["entities"].get(decision["qid"], {})
            genres = list(dict.fromkeys(
                metadata["labels"].get(value.rsplit("/", 1)[-1], "")
                for value in info.get("genre", [])
            ))
            genres = [g for g in genres if g]
            platforms = list(dict.fromkeys(
                metadata["labels"].get(value.rsplit("/", 1)[-1], "")
                for value in info.get("platform", [])
            ))
            platforms = [p for p in platforms if p]
            description = next(iter(info.get("description", [])), "")
            # Wikidata descriptions can be quite long; keep the catalog summary compact.
            description = ingest.plain(description)[:320]
            game = {
                "id": slug,
                "title": title,
                "aliases": [],
                "genre": genres[0] if genres else "video game",
                "genres": genres,
                "platforms": platforms,
                "releaseDate": "",
                "description": description or f"A video game discussed on Hacker News. Read the linked conversations for context.",
                "coverUrl": "",
                "metadataUrl": decision["article"],
                "metadataAttribution": "Identity, description, genre, and platform labels: Wikidata (CC0). No artwork included. HN evidence is from the sampled archive.",
                "color": "#596d59",
                "discoveredFrom": "Wikidata English-Wikipedia game identity matched against the sampled HN archive; see data/reference-decisions.json",
                "discoveryMatchMode": "exact-title-with-game-context",
            }
            seeds.append(game)
            by_id[slug] = game
            norm_seed[normal(title)] = game
        game_by_key[decision["key"]] = game

    records = {(r["gameId"], str(r["id"])): r for r in snapshot["records"]}
    source_records = 0
    added = 0
    rejected_context = 0
    for line in Path(records_path).open():
        row = json.loads(line)
        key = row["matchedKey"]
        game = game_by_key.get(key)
        if game is None:
            continue
        source_records += 1
        # Prevent an obvious organization/chess-company collision for the game title.
        text = row["text"]
        if game["title"].casefold() == "play magnus" and re.search(r"company|app|magnus carlsen|online chess|chess platform", text, re.I):
            rejected_context += 1
            continue
        rid = str(row["id"])
        record_key = (game["id"], rid)
        if record_key in records:
            continue
        if len(text) > 600:
            start = max(0, row["matchStart"] - 180)
            text = ("…" if start else "") + text[start:start + 598] + ("…" if start + 598 < len(row["text"]) else "")
        records[record_key] = {
            "gameId": game["id"],
            "id": rid,
            "url": "https://news.ycombinator.com/item?id=" + rid,
            "author": row.get("author") or "unknown",
            "date": row.get("date", ""),
            "text": text,
            "kind": row["kind"],
            "storyTitle": row.get("storyTitle", ""),
            "storyUrl": "https://news.ycombinator.com/item?id=" + str(row["storyId"]),
            "classification": "mention",
            "confidence": 0.85,
            "provenance": "Exact case-preserving title match in Wikidata-backed candidate; nearby gaming context. Identity review is automated and fallible. Sentiment and recommendation status are unreviewed.",
            "entityConfidence": 0.85,
            "sourceDataset": "user-supplied clustered HN sample 2008-2026",
        }
        added += 1

    snapshot["records"] = list(records.values())
    snapshot["collectedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    snapshot["discoveryUpdatedAt"] = snapshot["collectedAt"]
    coverage = ingest.read(ROOT / "data/discovery-coverage.json", {})
    reference = coverage.get("wikidataReference", {})
    baseline_catalog_size = reference.get("baselineCatalogIdentities", 123)
    coverage["wikidataReference"] = {
        "source": "https://www.wikidata.org/",
        "license": "CC0",
        "acceptedIdentityDecisions": max(reference.get("acceptedIdentityDecisions", reference.get("acceptedIdentities", 0)), len(decisions["accepted"])),
        "publishedIdentityCount": max(reference.get("publishedIdentityCount", 0), len(approved)),
        "baselineCatalogIdentities": baseline_catalog_size,
        "matchedSourceRows": max(reference.get("matchedSourceRows", 0), source_records),
        "newEvidenceRows": max(reference.get("newEvidenceRows", 0), added),
        "newGameIdentities": max(reference.get("newGameIdentities", 0), len(seeds) - baseline_catalog_size),
        "excludedNameCollisions": max(reference.get("excludedNameCollisions", 0), len(skipped)),
        "excludedNameCollisionRows": max(reference.get("excludedNameCollisionRows", 0), rejected_context),
        "method": "Exact case-preserving title match plus separate nearby video-game context; curated candidate shortlist; no recommendation inference.",
        "limitations": "The source corpus is clustered sampled days, not an exhaustive or statistically representative HN history. Entity and context matches can still be wrong; correction requests are welcome.",
    }
    coverage["acceptedNewEntities"] = max(coverage.get("acceptedNewEntities", 0), len(seeds) - baseline_catalog_size)
    coverage["description"] = f"{len(seeds)} game identities have one or more accepted source records in the sampled HN corpus. This is not a census and mention counts are not recommendations."
    (ROOT / "data/discovery-coverage.json").write_text(json.dumps(coverage, indent=2) + "\n")
    (ROOT / "data/seeds.json").write_text(json.dumps(seeds, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    ingest.export()
    print(f"Reference identity decisions: {len(approved)}; catalog identities: {len(seeds)}; source rows in reference pass: {source_records}; evidence added this run: {added}; skipped identities: {skipped}")


if __name__ == "__main__":
    publish()
