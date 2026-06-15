/**
 * Repairs migration records after timestamp renames so TypeORM does not re-run them.
 * Safe to call on every SQLite boot (idempotent).
 */
export function repairRenamedMigrations(db: { run: (sql: string) => void }): void {
  const renames: Array<{ oldName: string; newName: string; timestamp: number }> = [
    {
      oldName: 'AddWhatsAppGroupManagementSetting1780810000000',
      newName: 'AddWhatsAppGroupManagementSetting1780811000000',
      timestamp: 1780811000000,
    },
    {
      oldName: 'AddWhatsAppStatusPostsSetting1780820000000',
      newName: 'AddWhatsAppStatusPostsSetting1780821000000',
      timestamp: 1780821000000,
    },
    {
      oldName: 'AddWhatsAppCloudTemplateSyncSettings1780830000000',
      newName: 'AddWhatsAppCloudTemplateSyncSettings1780831000000',
      timestamp: 1780831000000,
    },
  ];

  for (const { oldName, newName, timestamp } of renames) {
    db.run(`
      UPDATE migrations
      SET name = '${newName}', timestamp = ${timestamp}
      WHERE name = '${oldName}'
        AND NOT EXISTS (SELECT 1 FROM migrations WHERE name = '${newName}')
    `);
  }

  db.run(`
    INSERT INTO migrations (timestamp, name)
    SELECT 1780799000000, 'AddStorageBackup1780799000000'
    WHERE EXISTS (SELECT 1 FROM migrations WHERE name = 'AddStorageBackup1780800000000')
      AND NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'AddStorageBackup1780799000000')
  `);
}
