import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadCsv } from './export-csv';

describe('downloadCsv', () => {
  let click: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    click = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.stubGlobal(
      'document',
      {
        createElement: vi.fn(() => ({
          href: '',
          download: '',
          click,
        })),
      } as unknown as Document,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes quotes in cells', () => {
    downloadCsv('out.csv', ['Col'], [['say "hi"']]);
    expect(click).toHaveBeenCalledOnce();
    const anchor = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { download: string };
    expect(anchor.download).toBe('out.csv');
  });
});
