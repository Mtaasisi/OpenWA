export interface MarkdownChunk {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
}

const DEFAULT_CHUNK_CHARS = 480;

/** Split markdown into line-bounded chunks for keyword recall search. */
export function chunkMarkdownFile(
  path: string,
  content: string,
  maxChars = DEFAULT_CHUNK_CHARS,
): MarkdownChunk[] {
  const lines = content.split('\n');
  const chunks: MarkdownChunk[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let startLine = 1;

  const flush = (endLine: number) => {
    const text = buf.join('\n').trim();
    if (text) {
      chunks.push({ path, startLine, endLine, text });
    }
    buf = [];
    bufLen = 0;
    startLine = endLine + 1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const addLen = line.length + 1;
    if (buf.length > 0 && bufLen + addLen > maxChars) {
      flush(lineNo - 1);
    }
    if (!buf.length) startLine = lineNo;
    buf.push(line);
    bufLen += addLen;
  }
  if (buf.length) flush(lines.length);
  return chunks;
}

export function scoreChunkText(text: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    const idx = lower.indexOf(kw);
    if (idx >= 0) score += 1 + 1 / (1 + idx / 200);
  }
  return score;
}

export function extractSearchKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(s => s.trim())
    .filter(s => s.length >= 2)
    .slice(0, 12);
}
