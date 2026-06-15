import { unzipSync, type Unzipped } from 'fflate';

function pickChatTextFile(entries: Unzipped): string | null {
  const names = Object.keys(entries)
    .filter(name => !name.endsWith('/') && name.toLowerCase().endsWith('.txt'))
    .sort((a, b) => {
      const score = (n: string) => {
        const base = n.split('/').pop()?.toLowerCase() ?? n;
        if (base.includes('chat')) return 0;
        if (base.startsWith('_chat')) return 0;
        return 1;
      };
      return score(a) - score(b) || a.length - b.length;
    });

  return names[0] ?? null;
}

/** Extract WhatsApp chat .txt from a zip export (without media). */
export function extractWhatsAppChatFromZip(bytes: Uint8Array): {
  content: string;
  fileName: string;
} {
  const entries = unzipSync(bytes);
  const entryName = pickChatTextFile(entries);
  if (!entryName) {
    throw new Error('No .txt chat file found in zip archive');
  }

  const content = new TextDecoder('utf-8').decode(entries[entryName]);
  if (!content.trim()) {
    throw new Error('Chat text file in zip is empty');
  }

  return {
    content,
    fileName: entryName.split('/').pop() ?? 'chat.txt',
  };
}
