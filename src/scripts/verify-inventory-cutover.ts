/**
 * Verify IMEI cutover: legacy imei_child → crm_inventory_items migration health.
 *
 * Usage:
 *   npm run verify:inventory-cutover
 *   npm run verify:inventory-cutover -- --json
 */
import dataSource from '../database/data-source';

type CountRow = { c: string | number };

type DuplicateImeiRow = { branchId: string; imei: string; c: string | number };

type OrphanRow = { id: string };

function countValue(row: CountRow | undefined): number {
  return Number(row?.c ?? 0);
}

async function countQuery(sql: string, params: unknown[] = []): Promise<number> {
  const rows = (await dataSource.query(sql, params)) as CountRow[];
  return countValue(rows[0]);
}

async function main() {
  const asJson = process.argv.includes('--json');
  await dataSource.initialize();

  try {
    const isPostgres = dataSource.options.type === 'postgres';
    const activeCol = isPostgres ? '"isActive" = true' : 'isActive = 1';
    const inactiveCol = isPostgres ? '"isActive" = false' : 'isActive = 0';
    const deletedNull = isPostgres ? '"deletedAt" IS NULL' : 'deletedAt IS NULL';

    const activeImeiChildren = await countQuery(
      `SELECT COUNT(*) as c FROM crm_product_variants WHERE ${
        isPostgres ? '"variantType" = \'imei_child\'' : "variantType = 'imei_child'"
      } AND ${activeCol}`,
    );

    const inactiveImeiChildren = await countQuery(
      `SELECT COUNT(*) as c FROM crm_product_variants WHERE ${
        isPostgres ? '"variantType" = \'imei_child\'' : "variantType = 'imei_child'"
      } AND ${inactiveCol}`,
    );

    const inventoryTotal = await countQuery(
      `SELECT COUNT(*) as c FROM crm_inventory_items WHERE ${deletedNull}`,
    );

    const inventoryFromLegacy = await countQuery(
      `SELECT COUNT(*) as c FROM crm_inventory_items WHERE ${deletedNull} AND ${
        isPostgres ? '"legacyVariantId" IS NOT NULL' : 'legacyVariantId IS NOT NULL'
      }`,
    );

    const parentsWithoutTracking = await countQuery(
      `SELECT COUNT(*) as c FROM crm_product_variants WHERE ${
        isPostgres
          ? '("variantType" = \'parent\' OR "isParent" = true) AND COALESCE("trackInventoryItems", false) = false'
          : "(variantType = 'parent' OR isParent = 1) AND COALESCE(trackInventoryItems, 0) = 0"
      } AND ${activeCol}`,
    );

    const duplicateImeis = (await dataSource.query(
      `SELECT ${isPostgres ? '"branchId"' : 'branchId'} as branchId, ${
        isPostgres ? 'imei' : 'imei'
      } as imei, COUNT(*) as c
       FROM crm_inventory_items
       WHERE ${deletedNull} AND imei IS NOT NULL AND imei != ''
       GROUP BY ${isPostgres ? '"branchId"' : 'branchId'}, imei
       HAVING COUNT(*) > 1
       LIMIT 20`,
    )) as DuplicateImeiRow[];

    const orphanItems = (await dataSource.query(
      `SELECT i.${isPostgres ? 'id' : 'id'} as id
       FROM crm_inventory_items i
       LEFT JOIN crm_product_variants v ON v.${isPostgres ? 'id' : 'id'} = i.${
         isPostgres ? '"variantId"' : 'variantId'
       }
       WHERE i.${deletedNull} AND v.${isPostgres ? 'id' : 'id'} IS NULL
       LIMIT 20`,
    )) as OrphanRow[];

    const report = {
      ok:
        activeImeiChildren === 0 &&
        duplicateImeis.length === 0 &&
        orphanItems.length === 0 &&
        parentsWithoutTracking === 0,
      activeImeiChildren,
      inactiveImeiChildren,
      inventoryTotal,
      inventoryFromLegacy,
      parentsWithoutTracking,
      duplicateImeiCount: duplicateImeis.length,
      duplicateImeis: duplicateImeis.slice(0, 10),
      orphanInventoryCount: orphanItems.length,
      orphanInventoryIds: orphanItems.slice(0, 10).map((r) => r.id),
      warnings: [] as string[],
    };

    if (activeImeiChildren > 0) {
      report.warnings.push(`${activeImeiChildren} active imei_child variant(s) remain — re-run migration or deactivate manually.`);
    }
    if (parentsWithoutTracking > 0) {
      report.warnings.push(`${parentsWithoutTracking} parent variant(s) missing trackInventoryItems=true.`);
    }
    if (duplicateImeis.length > 0) {
      report.warnings.push(`${duplicateImeis.length} duplicate IMEI group(s) per branch.`);
    }
    if (orphanItems.length > 0) {
      report.warnings.push(`${orphanItems.length} inventory item(s) reference missing variants.`);
    }
    if (inventoryTotal > 0 && inventoryFromLegacy === 0 && inactiveImeiChildren > 0) {
      report.warnings.push('Legacy imei_child rows exist but no inventory items link via legacyVariantId.');
    }

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('Inventory cutover verification');
      console.log('===========================');
      console.log(`Status: ${report.ok ? 'PASS' : 'FAIL'}`);
      console.log(`Active imei_child variants: ${activeImeiChildren}`);
      console.log(`Inactive imei_child variants: ${inactiveImeiChildren}`);
      console.log(`Inventory items (active): ${inventoryTotal}`);
      console.log(`Migrated via legacyVariantId: ${inventoryFromLegacy}`);
      console.log(`Parent variants without IMEI tracking: ${parentsWithoutTracking}`);
      console.log(`Duplicate IMEI groups: ${duplicateImeis.length}`);
      console.log(`Orphan inventory items: ${orphanItems.length}`);
      if (report.warnings.length) {
        console.log('\nWarnings:');
        for (const w of report.warnings) console.log(`  - ${w}`);
      }
    }

    if (!report.ok) process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
