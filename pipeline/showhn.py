"""Import a conservative, explicitly reviewed set of Show HN game launches."""
import argparse
import csv
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path, fallback):
    return json.loads(path.read_text()) if path.exists() else fallback


def import_showhn(stories_path):
    decisions = read(ROOT / "data/showhn-decisions.json", [])
    if len({d["id"] for d in decisions}) != len(decisions):
        raise ValueError("Duplicate story IDs in showhn-decisions.json")
    with stories_path.open(newline="", encoding="utf-8") as source:
        rows = {row["object_id"]: row for row in csv.DictReader(source)}

    seeds = read(ROOT / "data/seeds.json", [])
    snapshot = read(ROOT / "data/snapshot.json", {"records": [], "queries": [], "collectedAt": ""})
    curated = read(ROOT / "data/curated-mentions.json", [])
    by_id = {g["id"]: g for g in seeds}
    records = {(r["gameId"], r["id"]): r for r in snapshot["records"]}
    curated_records = {(r["gameId"], r["id"]): r for r in curated}
    for decision in decisions:
        row = rows.get(decision["id"])
        if not row or not row["title"].lower().startswith("show hn:"):
            raise ValueError(f"Missing or non-Show-HN source row: {decision['id']}")
        title = row["title"]
        game_id = "showhn-" + decision["id"]
        url = "https://news.ycombinator.com/item?id=" + decision["id"]
        project_url = row.get("url", "").strip()
        if game_id not in by_id:
            by_id[game_id] = {
                "id": game_id,
                "title": decision["title"],
                "aliases": [],
                "genre": decision["genre"],
                "genres": [decision["genre"]],
                "platforms": [],
                "releaseDate": "",
                "description": "An independently made game introduced in this Hacker News Show HN submission.",
                "coverUrl": None,
                "metadataUrl": project_url or url,
                "metadataAttribution": "Project identity and launch source: linked Hacker News submission. No cover or platform metadata asserted.",
                "color": "#607d70",
                "showHNSourceId": decision["id"],
            }
        created = dt.datetime.fromtimestamp(int(row["created_at_i"]), dt.timezone.utc).isoformat()
        record = {
            "gameId": game_id,
            "id": decision["id"],
            "url": url,
            "author": row.get("author") or "unknown",
            "date": created,
            "text": title,
            "kind": "story",
            "storyTitle": title,
            "storyUrl": url,
            "classification": "mention",
            "confidence": 1.0,
            "provenance": "curated-showhn-v1; source title and item ID matched in user-supplied historical HN submissions. Launch post is not an endorsement.",
            "showHNSubmission": True,
        }
        records[(game_id, decision["id"])] = record
        curated_records[(game_id, decision["id"])] = record
    snapshot["records"] = list(records.values())
    (ROOT / "data/seeds.json").write_text(json.dumps(list(by_id.values()), ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/curated-mentions.json").write_text(json.dumps(list(curated_records.values()), ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(decisions)} curated Show HN launches from {stories_path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stories", type=Path, required=True, help="Local story_scores.csv from the supplied HN archive")
    args = parser.parse_args()
    import_showhn(args.stories)


if __name__ == "__main__":
    main()
