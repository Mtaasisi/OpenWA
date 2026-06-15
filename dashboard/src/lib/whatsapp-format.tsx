import type { ReactNode } from 'react';

type Marker = '*' | '_' | '~' | '```';

function markerLength(marker: Marker): number {
  return marker === '```' ? 3 : 1;
}

function wrapFormatted(marker: Marker, children: ReactNode, key: string): ReactNode {
  switch (marker) {
    case '*':
      return (
        <strong key={key} className="wa-bold">
          {children}
        </strong>
      );
    case '_':
      return (
        <em key={key} className="wa-italic">
          {children}
        </em>
      );
    case '~':
      return (
        <span key={key} className="wa-strike">
          {children}
        </span>
      );
    case '```':
      return (
        <code key={key} className="wa-mono">
          {children}
        </code>
      );
  }
}

function markerAt(text: string, index: number): Marker | null {
  if (text.startsWith('```', index)) return '```';
  const ch = text[index];
  if (ch === '*' || ch === '_' || ch === '~') return ch;
  return null;
}

/** Parse WhatsApp-style inline formatting: *bold*, _italic_, ~strike~, ```mono``` */
export function parseWhatsAppMarkdown(text: string, keyPrefix = 'wa'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let plain = '';
  let key = 0;
  let index = 0;

  const flushPlain = () => {
    if (plain) {
      nodes.push(plain);
      plain = '';
    }
  };

  while (index < text.length) {
    const marker = markerAt(text, index);
    if (!marker) {
      plain += text[index];
      index += 1;
      continue;
    }

    const openLen = markerLength(marker);
    const closeIndex = text.indexOf(marker, index + openLen);
    if (closeIndex === -1) {
      plain += text.slice(index, index + openLen);
      index += openLen;
      continue;
    }

    flushPlain();
    const inner = text.slice(index + openLen, closeIndex);
    const childKey = `${keyPrefix}-${key++}`;
    nodes.push(
      wrapFormatted(
        marker,
        inner ? parseWhatsAppMarkdown(inner, childKey) : '',
        childKey,
      ),
    );
    index = closeIndex + openLen;
  }

  flushPlain();
  return nodes;
}

interface InboxFormattedMessageBodyProps {
  text: string;
  className?: string;
}

export function InboxFormattedMessageBody({ text, className }: InboxFormattedMessageBodyProps) {
  return <span className={className}>{parseWhatsAppMarkdown(text)}</span>;
}
