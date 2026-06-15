import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyEnvUpdates, parseEnvFile } from './env-file.util';

describe('env-file.util', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openwa-env-'));
    envPath = path.join(tmpDir, '.env.generated');
    fs.writeFileSync(
      envPath,
      `# header
DATABASE_TYPE=sqlite
ENGINE_TYPE=whatsapp-web.js
`,
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates existing keys without removing others', () => {
    applyEnvUpdates(envPath, { ENGINE_TYPE: 'baileys' });
    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toContain('DATABASE_TYPE=sqlite');
    expect(content).toContain('ENGINE_TYPE=baileys');
    expect(content).not.toContain('ENGINE_TYPE=whatsapp-web.js');
  });

  it('appends new keys', () => {
    applyEnvUpdates(envPath, { PUPPETEER_HEADLESS: 'true' });
    const map = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    expect(map.get('PUPPETEER_HEADLESS')).toBe('true');
    expect(map.get('DATABASE_TYPE')).toBe('sqlite');
  });
});
