import type { ReactNode } from 'react';

type Block =
  | { type: 'blockquote'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'hr' }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4) });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3) });
      i += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const dataLines = tableLines.filter((l) => !isTableSeparator(l));
      if (dataLines.length === 0) continue;
      const headers = parseTableRow(dataLines[0]);
      const rows = dataLines.slice(1).map(parseTableRow);
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paraLines: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith('## ') ||
        next.startsWith('### ') ||
        /^>\s?/.test(next) ||
        /^---+$/.test(next) ||
        isTableRow(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n').trim() });
  }

  return blocks;
}

function formatInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const id = `${keyPrefix}-${key++}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={id}>{formatInline(token.slice(2, -2), id)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<strong key={id}>{formatInline(token.slice(1, -1), id)}</strong>);
    } else if (token.startsWith('_')) {
      nodes.push(<em key={id}>{formatInline(token.slice(1, -1), id)}</em>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={id}>{token.slice(1, -1)}</code>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length ? nodes : [text];
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case 'hr':
      return <hr key={index} className="ai-message-hr" />;
    case 'blockquote':
      return (
        <blockquote key={index} className="ai-message-quote">
          {formatInline(block.text, `q-${index}`)}
        </blockquote>
      );
    case 'heading':
      return block.level === 2 ? (
        <h2 key={index} className="ai-message-h2">
          {formatInline(block.text, `h2-${index}`)}
        </h2>
      ) : (
        <h3 key={index} className="ai-message-h3">
          {formatInline(block.text, `h3-${index}`)}
        </h3>
      );
    case 'paragraph':
      return (
        <p key={index} className="ai-message-p">
          {formatInline(block.text, `p-${index}`)}
        </p>
      );
    case 'ul':
      return (
        <ul key={index} className="ai-message-ul">
          {block.items.map((item, j) => (
            <li key={j}>{formatInline(item, `ul-${index}-${j}`)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className="ai-message-ol">
          {block.items.map((item, j) => (
            <li key={j}>{formatInline(item, `ol-${index}-${j}`)}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div key={index} className="ai-message-table-wrap">
          <table className="ai-message-table">
            <thead>
              <tr>
                {block.headers.map((h, j) => (
                  <th key={j}>{formatInline(h, `th-${index}-${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{formatInline(cell, `td-${index}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function aiMessageHasRichContent(content: string): boolean {
  return (
    content.includes('|') ||
    content.includes('## ') ||
    content.includes('### ') ||
    /^[-*]\s+/m.test(content) ||
    /^\d+\.\s+/m.test(content)
  );
}

interface AiMessageContentProps {
  content: string;
}

export function AiMessageContent({ content }: AiMessageContentProps) {
  const blocks = parseBlocks(content);
  const rich = blocks.some((b) => b.type === 'table' || b.type === 'heading');

  if (blocks.length === 0) {
    return <div className="ai-message-content">{content}</div>;
  }

  return (
    <div className={`ai-message-content${rich ? ' ai-message-content--rich' : ''}`}>
      {blocks.map(renderBlock)}
    </div>
  );
}
