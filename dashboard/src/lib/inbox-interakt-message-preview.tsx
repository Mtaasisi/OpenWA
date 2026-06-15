import type { ReactNode } from 'react';
import type { QuickReplyVariables } from '../services/api';

const VAR_RE = /\{[a-z_]+\}/i;

export function truncateMessageSnippet(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

export function messageHasVariables(body: string): boolean {
  return VAR_RE.test(body);
}

export function renderMessageBubbleContent(body: string, variables: QuickReplyVariables): ReactNode {
  const lines = body.split('\n');
  return lines.map((line, lineIdx) => (
    <span key={lineIdx}>
      {lineIdx > 0 && <br />}
      {line.split(/(\{[a-z_]+\})/gi).map((part, i) => {
        const match = part.match(/^\{([a-z_]+)\}$/i);
        if (match) {
          const key = match[1] as keyof QuickReplyVariables;
          const value = variables[key]?.trim() || part;
          return (
            <span key={i} className="inbox-interakt-tpl-modal__var">
              {value}
            </span>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </span>
  ));
}

export function formatMessagePreviewTime(): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}
