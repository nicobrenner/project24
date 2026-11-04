export interface Mention {
  id: string;
  url: string;
  author: string;
  date: string;
  text: string;
  kind: "comment" | "story";
  storyTitle: string;
  storyUrl: string;
  classification:
    | "recommendation"
    | "candidate"
    | "mention"
    | "criticism"
    | "technical";
  confidence: number;
  provenance: string;
  showHNSubmission?: boolean;
  theme?: {label: string; name: string; confidence: number; model: string};
  sentiment?: {label: "positive" | "negative" | "mixed" | "unclear"; name: string; model: string; provenance: string};
}
export interface Game {
  id: string;
  title: string;
  medium: "video" | "tabletop";
  aliases: string[];
  genre: string;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  description: string;
  coverUrl: string;
  metadataUrl: string;
  metadataAttribution: string;
  playUrl?: string;
  storeUrl?: string;
  color: string;
  mentions: Mention[];
  themes?: {label: string; name: string; count: number}[];
  keywordMatches: number | null;
  verifiedRecommendations: number;
  discussionCount: number;
  showHN: boolean;
  showHNSourceId?: string;
  sentimentSummary?: {label: "positive" | "negative" | "mixed" | "unclear"; evidenceCount: number};
}
export interface Catalog {
  generatedAt: string;
  coverage: { description: string; [key: string]: unknown };
  games: Game[];
}
