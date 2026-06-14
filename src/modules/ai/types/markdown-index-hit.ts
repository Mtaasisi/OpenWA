export interface MarkdownIndexHit {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number;
}
