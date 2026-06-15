import { migPrimaryUuidColumn, migDateTime, migNowDefault, migUuidFkColumn } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddProductInventoryItems1781050000000 implements MigrationInterface {
  name = 'AddProductInventoryItems1781050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    // Product extensions
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN brand varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN model varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN barcode varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN tags text NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN warrantyDefault varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN supplier varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN visibility varchar DEFAULT 'public'`);
    await queryRunner.query(`ALTER TABLE crm_products ADD COLUMN costPrice real NULL`);

    // Variant extensions
    await queryRunner.query(`ALTER TABLE crm_product_variants ADD COLUMN barcode varchar NULL`);
    await queryRunner.query(`ALTER TABLE crm_product_variants ADD COLUMN costPrice real NULL`);
    await queryRunner.query(
      `ALTER TABLE crm_product_variants ADD COLUMN trackInventoryItems boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE crm_product_variants ADD COLUMN lowStockThreshold integer DEFAULT 10`,
    );

    // Inventory items table
    await queryRunner.createTable(
      new Table({
        name: 'crm_inventory_items',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          migUuidFkColumn(queryRunner, 'productId'),
          migUuidFkColumn(queryRunner, 'variantId'),
          { name: 'branchId', type: 'varchar' },
          { name: 'imei', type: 'varchar', isNullable: true },
          { name: 'serialNumber', type: 'varchar', isNullable: true },
          { name: 'deviceId', type: 'varchar', isNullable: true },
          { name: 'barcode', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'available'" },
          { name: 'costPrice', type: 'real', isNullable: true },
          { name: 'sellingPrice', type: 'real', isNullable: true },
          { name: 'supplier', type: 'varchar', isNullable: true },
          { name: 'purchaseBatch', type: 'varchar', isNullable: true },
          { name: 'reservedAt', type: dt, isNullable: true },
          { name: 'soldAt', type: dt, isNullable: true },
          { name: 'saleId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'legacyVariantId', type: 'varchar', isNullable: true },
          { name: 'externalId', type: 'varchar', isNullable: true },
          { name: 'deletedAt', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'crm_inventory_items',
      new TableIndex({
        name: 'IDX_inventory_product_variant_status',
        columnNames: ['productId', 'variantId', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'crm_inventory_items',
      new TableIndex({
        name: 'IDX_inventory_branch_status',
        columnNames: ['branchId', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'crm_inventory_items',
      new TableIndex({
        name: 'IDX_inventory_external_id',
        columnNames: ['externalId'],
      }),
    );

    // Import batch tables
    await queryRunner.createTable(
      new Table({
        name: 'product_import_batches',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'fileName', type: 'varchar' },
          { name: 'fileType', type: 'varchar', length: '16' },
          { name: 'importType', type: 'varchar', length: '64' },
          { name: 'mode', type: 'varchar', length: '32' },
          { name: 'status', type: 'varchar', length: '32', default: "'pending'" },
          { name: 'totalRows', type: 'integer', default: 0 },
          { name: 'validRows', type: 'integer', default: 0 },
          { name: 'warningRows', type: 'integer', default: 0 },
          { name: 'errorRows', type: 'integer', default: 0 },
          { name: 'createdCount', type: 'integer', default: 0 },
          { name: 'updatedCount', type: 'integer', default: 0 },
          { name: 'skippedCount', type: 'integer', default: 0 },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'completedAt', type: dt, isNullable: true },
          { name: 'errorSummary', type: 'text', isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_import_rows',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          migUuidFkColumn(queryRunner, 'importBatchId'),
          { name: 'rowNumber', type: 'integer' },
          { name: 'rowData', type: 'text' },
          { name: 'mappedData', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'errors', type: 'text', isNullable: true },
          { name: 'warnings', type: 'text', isNullable: true },
          { name: 'targetProductId', type: 'varchar', isNullable: true },
          { name: 'targetVariantId', type: 'varchar', isNullable: true },
          { name: 'targetInventoryItemId', type: 'varchar', isNullable: true },
          { name: 'action', type: 'varchar', length: '16', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'product_import_rows',
      new TableIndex({
        name: 'IDX_import_rows_batch',
        columnNames: ['importBatchId', 'rowNumber'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_audit_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'productId', type: 'varchar' },
          { name: 'variantId', type: 'varchar', isNullable: true },
          { name: 'inventoryItemId', type: 'varchar', isNullable: true },
          { name: 'action', type: 'varchar', length: '64' },
          { name: 'actorId', type: 'varchar', isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'product_audit_events',
      new TableIndex({
        name: 'IDX_product_audit_product',
        columnNames: ['productId', 'createdAt'],
      }),
    );

    // Normalize parent variants → trackInventoryItems
    await queryRunner.query(`
      UPDATE crm_product_variants
      SET trackInventoryItems = true
      WHERE variantType = 'parent' OR isParent = true
    `);

    // Migrate imei_child variants → inventory items
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const branchResult = await queryRunner.query(
      isPostgres
        ? `SELECT "branchId" FROM crm_inauzwa_sync_settings WHERE id = 'default' LIMIT 1`
        : `SELECT branchId FROM crm_inauzwa_sync_settings WHERE id = 'default' LIMIT 1`,
    );
    const branchRows = Array.isArray(branchResult) ? branchResult : branchResult?.rows ?? [];
    const defaultBranch = branchRows[0]?.branchId ?? 'default';

    const imeiChildren = await queryRunner.query(`
      SELECT id, productId, parentVariantId, name, sellingPrice, quantity, isActive, attributes, externalId
      FROM crm_product_variants
      WHERE variantType = 'imei_child' OR (parentVariantId IS NOT NULL AND variantType != 'standard')
    `);
    const childRows = Array.isArray(imeiChildren) ? imeiChildren : imeiChildren?.rows ?? [];

    for (const child of childRows) {
      if (!child.parentVariantId) continue;
      let attrs: Record<string, unknown> = {};
      try {
        attrs =
          typeof child.attributes === 'string'
            ? JSON.parse(child.attributes)
            : child.attributes ?? {};
      } catch {
        attrs = {};
      }
      const imei = (attrs.imei as string) || child.name || null;
      const serial = (attrs.serial_number as string) || null;
      const status =
        !child.isActive || (child.quantity ?? 0) <= 0 ? 'inactive' : 'available';

      if (isPostgres) {
        await queryRunner.query(
          `INSERT INTO crm_inventory_items (
            id, "productId", "variantId", "branchId", imei, "serialNumber", status,
            "sellingPrice", "legacyVariantId", "externalId", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
          )`,
          [
            child.productId,
            child.parentVariantId,
            defaultBranch,
            imei,
            serial,
            status,
            child.sellingPrice,
            child.id,
            child.externalId,
          ],
        );
        await queryRunner.query(`UPDATE crm_product_variants SET "isActive" = false WHERE id = $1`, [
          child.id,
        ]);
      } else {
        await queryRunner.query(
          `INSERT INTO crm_inventory_items (
            id, productId, variantId, branchId, imei, serialNumber, status,
            sellingPrice, legacyVariantId, externalId, createdAt, updatedAt
          ) VALUES (
            lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
            substr(lower(hex(randomblob(2))),2) || '-' ||
            substr('89ab', abs(random()) % 4 + 1, 1) ||
            substr(lower(hex(randomblob(2))),2) || '-' ||
            lower(hex(randomblob(6))),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
          )`,
          [
            child.productId,
            child.parentVariantId,
            defaultBranch,
            imei,
            serial,
            status,
            child.sellingPrice,
            child.id,
            child.externalId,
          ],
        );
        await queryRunner.query(`UPDATE crm_product_variants SET isActive = 0 WHERE id = ?`, [
          child.id,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_audit_events', true);
    await queryRunner.dropTable('product_import_rows', true);
    await queryRunner.dropTable('product_import_batches', true);
    await queryRunner.dropTable('crm_inventory_items', true);
    // Note: product/variant column drops omitted for safety
  }
}
