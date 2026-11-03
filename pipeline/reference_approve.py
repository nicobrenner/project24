"""Rebuild exact, context-qualified reference matches from a corpus scan.

The checked-in decision file is the curated identity allowlist; this stage does
not infer recommendations or silently admit new game identities.
"""
import json
import re
from pathlib import Path

from .ingest import ROOT


def approve(scanned=Path("work/reference-records.jsonl")):
    decisions = json.loads((ROOT / "data/reference-decisions.json").read_text())
    allow = {d["key"]: d for d in decisions["accepted"]}
    counts = {key: 0 for key in allow}
    examples = {key: [] for key in allow}
    rows = []
    context = re.compile(r"\b(?:games?|gaming|gameplay|played|playing|steam|nintendo|atari|amiga|arcade|console|puzzle|roguelike|platformer|rpg|fps|snes|nes|dos|commodore|videogames?|speedrun|multiplayer)\b", re.I)
    with Path(scanned).open() as source:
        for line in source:
            row = json.loads(line)
            for match in row["matches"]:
                key = match["key"]
                decision = allow.get(key)
                if not decision:
                    continue
                title = decision["title"]
                if row["text"][match["start"]:match["end"]] != title:
                    continue
                if not context.search((row["text"][max(0, match["start"]-180):match["end"]+180] + " " + row.get("storyTitle", "")).replace(title, "")):
                    continue
                if re.match(r"\s*(?:[2-9]|II|III|IV|V|VI|VII|VIII|IX|X)\b", row["text"][match["end"]:]):
                    continue
                rows.append({**row, "matchedKey": key, "matchedTitle": title, "matchStart": match["start"], "matchEnd": match["end"]})
                counts[key] += 1
                if len(examples[key]) < 2:
                    examples[key].append({"id": row["id"], "excerpt": row["text"][max(0, match["start"]-180):match["end"]+180]})
    decisions["accepted"] = [
        {**d, "acceptedRecords": counts[d["key"]], "examples": examples[d["key"]]}
        for d in decisions["accepted"] if counts[d["key"]]
    ]
    (ROOT / "data/reference-decisions.json").write_text(json.dumps(decisions, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/reference-matches.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    print(f"Approved {len(decisions['accepted'])} identities; wrote {len(rows)} exact, contextual HN matches.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("scanned", type=Path, help="reference-records.jsonl from reference_discovery")
    approve(parser.parse_args().scanned)
