import unittest

from pipeline.sentiment import classify


class SentimentCueTests(unittest.TestCase):
    def test_clear_negative_excerpt(self):
        result = classify("That is utterly dumb. Super Mario Sunshine is just terrible.")
        self.assertEqual(result["label"], "negative")
        self.assertEqual(result["model"], "phrase-cues-v1")

    def test_positive_and_negative_is_mixed(self):
        self.assertEqual(classify("I love the puzzles, but the story is terrible.")["label"], "mixed")

    def test_unmarked_factual_text_abstains(self):
        self.assertEqual(classify("The game shipped in 2002 for the GameCube.")["label"], "unclear")

    def test_simple_negation_does_not_create_a_positive_signal(self):
        self.assertEqual(classify("It is not a great game.")["label"], "unclear")


if __name__ == "__main__":
    unittest.main()
