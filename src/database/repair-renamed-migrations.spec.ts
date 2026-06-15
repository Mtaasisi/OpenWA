import { repairRenamedMigrations } from './repair-renamed-migrations';

describe('repairRenamedMigrations', () => {
  it('renames legacy WhatsApp migration records', () => {
    const runs: string[] = [];
    const db = { run: (sql: string) => runs.push(sql.replace(/\s+/g, ' ').trim()) };

    repairRenamedMigrations(db);

    expect(runs.some(sql => sql.includes('AddWhatsAppGroupManagementSetting1780810000000'))).toBe(true);
    expect(runs.some(sql => sql.includes('AddStorageBackup1780799000000'))).toBe(true);
  });
});
