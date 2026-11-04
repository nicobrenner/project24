"""Conservative, reproducible phrase-cue sentiment signals for HN excerpts.

This deliberately favors abstention over guessing. It is not a sentiment model,
does not establish consensus, and is kept separate from recommendation labels.
"""
import argparse
import hashlib
import json
import re

from .ingest import ROOT, read

POSITIVE = re.compile(
    r"\b(love[ds]?|enjoy(?:ed|s)?|great|excellent|amazing|brilliant|fantastic|"
    r"favorite|favourite|masterpiece|recommend(?:ed|s)?|best game|"
    r"really good|wonderful|delightful|beautiful game)\b",
    re.I,
)
NEGATIVE = re.compile(
    r"\b(terrible|awful|dumb|embarrassing|hate[ds]?|boring|disappoint(?:ed|ing)?|"
    r"worst|sucks?|unplayable|mediocre|poor(?:ly)?|regret(?:ted)?|"
    r"not worth|bad game|tedious|frustrating)\b",
    re.I,
)
NEGATORS = re.compile(r"\b(not|never|no|hardly|barely|isn't|wasn't|aren't|weren't)\b", re.I)


def cues(pattern, text):
    result = 0
    for match in pattern.finditer(text):
        prefix = text[max(0, match.start() - 28):match.start()]
        # Ignore a cue under simple negation; complex scope and sarcasm remain unsupported.
        if NEGATORS.search(prefix):
            continue
        result += 1
    return result


def classify(text):
    positive = cues(POSITIVE, text)
    negative = cues(NEGATIVE, text)
    if positive and negative:
        label = "mixed"
    elif positive:
        label = "positive"
    elif negative:
        label = "negative"
    else:
        label = "unclear"
    return {
        "label": label,
        "name": {
            "positive": "Positive tone",
            "negative": "Critical tone",
            "mixed": "Mixed tone",
            "unclear": "No clear signal",
        }[label],
        "model": "phrase-cues-v1",
        "positiveCues": positive,
        "negativeCues": negative,
        "provenance": "Explicit sentiment phrase cue; heuristic, uncalibrated, and not a recommendation review.",
    }


def run():
    snapshot = read(ROOT / "data/snapshot.json", {"records": []})
    records = snapshot["records"] + read(ROOT / "data/tabletop-mentions.json", [])
    predictions = {hashlib.sha256(text.encode()).hexdigest(): classify(text)
                   for text in dict.fromkeys(r.get("text", "") for r in records)}
    result = {
        "model": {
            "id": "phrase-cues-v1",
            "method": "Conservative explicit positive/negative phrase cues with abstention",
            "scope": "Tone of an individual source excerpt; may refer to the surrounding discussion, not necessarily the game.",
            "limitations": "Heuristic and uncalibrated. Sarcasm, complex negation, implicit sentiment, and mixed context can be missed. Not a recommendation classifier or measure of community consensus.",
            "jeffyStatus": "The existing Jeffy head classifies conversation topics only. Sentiment remains separate until a sentiment-specific Jeffy head has labeled evaluation data.",
        },
        "predictions": predictions,
    }
    out = ROOT / "data/classifiers/sentiment-predictions.json"
    out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    example = classify("... utterly dumb. That's pretty embarrassing. Also Super Mario Sunshine is just terrible.")
    print(f"Classified {len(predictions)} excerpts; example: {example['label']}; explicit signals: {sum(p['label'] != 'unclear' for p in predictions.values())}")


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
