import { migPrimaryUuidColumn, migUuidFkColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddCrmQuotes1780300000000 implements MigrationInterface {
  name = 'AddCrmQuotes1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const uuidCol = () => migPrimaryUuidColumn(queryRunner);
    const tsCols = [
      { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
      { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
    ];

    await queryRunner.createTable(
      new Table({
        name: 'crm_quotes',
        columns: [
          uuidCol(),
          { name: 'quoteNumber', type: 'varchar', length: '32', isNullable: false },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'customerName', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', default: "'draft'", isNullable: false },
          { name: 'subtotal', type: 'real', default: 0, isNullable: false },
          { name: 'discountAmount', type: 'real', default: 0, isNullable: false },
          { name: 'deliveryFee', type: 'real', default: 0, isNullable: false },
          { name: 'taxAmount', type: 'real', default: 0, isNullable: false },
          { name: 'totalAmount', type: 'real', default: 0, isNullable: false },
          { name: 'currency', type: 'varchar', length: '8', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'paymentInstructions', type: 'text', isNullable: true },
          { name: 'branchPickupInfo', type: 'text', isNullable: true },
          { name: 'validUntil', type: migDateTime(queryRunner), isNullable: true },
          { name: 'linkedSaleId', type: 'varchar', isNullable: true },
          { name: 'externalProformaId', type: 'varchar', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'crm_quote_items',
        columns: [
          uuidCol(),
          migUuidFkColumn(queryRunner, 'quoteId'),
          { name: 'productId', type: 'varchar', isNullable: true },
          { name: 'variantId', type: 'varchar', isNullable: true },
          { name: 'itemName', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'quantity', type: 'real', default: 1, isNullable: false },
          { name: 'unitPrice', type: 'real', default: 0, isNullable: false },
          { name: 'discountAmount', type: 'real', default: 0, isNullable: false },
          { name: 'totalPrice', type: 'real', default: 0, isNullable: false },
          { name: 'warranty', type: 'varchar', isNullable: true },
          { name: 'stockStatus', type: 'varchar', isNullable: true },
          { name: 'sortOrder', type: 'int', default: 0, isNullable: false },
          { name: 'metadata', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'crm_quotes',
      new TableIndex({ name: 'IDX_crm_quotes_thread', columnNames: ['sessionId', 'chatId'] }),
    );
    await queryRunner.createIndex(
      'crm_quotes',
      new TableIndex({ name: 'IDX_crm_quotes_branch_status', columnNames: ['branchId', 'status'] }),
    );
    await queryRunner.createIndex(
      'crm_quotes',
      new TableIndex({ name: 'UQ_crm_quotes_number', columnNames: ['quoteNumber'], isUnique: true }),
    );
    await queryRunner.createIndex(
      'crm_quote_items',
      new TableIndex({ name: 'IDX_crm_quote_items_quote', columnNames: ['quoteId', 'sortOrder'] }),
    );

    await queryRunner.createForeignKey(
      'crm_quote_items',
      new TableForeignKey({
        name: 'FK_crm_quote_items_quote',
        columnNames: ['quoteId'],
        referencedTableName: 'crm_quotes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('crm_quote_items');
    await queryRunner.dropTable('crm_quotes');
  }
}
