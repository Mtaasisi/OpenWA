import * as fs from 'fs';
import * as path from 'path';
import { BUNDLED_KNOWLEDGE_FILES } from './ai-knowledge.service';
import { BUNDLED_MEMORY_FILES } from './ai-memory.service';

const MIN_BUNDLED_BYTES = 200;

describe('Inauzwa AI training seeds', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const knowledgeSeedDir = path.join(repoRoot, 'seed/ai-knowledge');
  const memorySeedDir = path.join(repoRoot, 'seed/ai-memory');

  it('includes every bundled knowledge file under seed/ai-knowledge', () => {
    expect(fs.existsSync(knowledgeSeedDir)).toBe(true);
    for (const name of BUNDLED_KNOWLEDGE_FILES) {
      const filePath = path.join(knowledgeSeedDir, name);
      expect(fs.existsSync(filePath)).toBe(true);
      const size = fs.statSync(filePath).size;
      expect(size).toBeGreaterThan(MIN_BUNDLED_BYTES);
    }
  });

  it('includes bundled staff memory under seed/ai-memory', () => {
    expect(fs.existsSync(memorySeedDir)).toBe(true);
    for (const name of BUNDLED_MEMORY_FILES) {
      const filePath = path.join(memorySeedDir, name);
      expect(fs.existsSync(filePath)).toBe(true);
      const size = fs.statSync(filePath).size;
      expect(size).toBeGreaterThan(MIN_BUNDLED_BYTES);
    }
  });

  it('covers all markdown files in seed/ai-knowledge (no orphan seeds)', () => {
    const seedFiles = fs
      .readdirSync(knowledgeSeedDir)
      .filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    for (const name of seedFiles) {
      expect(BUNDLED_KNOWLEDGE_FILES as readonly string[]).toContain(name);
    }
  });
});
