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
}
export interface Game {
  id: string;
  title: string;
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
  keywordMatches: number;
  verifiedRecommendations: number;
  discussionCount: number;
  showHN: boolean;
}
export interface Catalog {
  generatedAt: string;
  coverage: { description: string; [key: string]: unknown };
  games: Game[];
}
