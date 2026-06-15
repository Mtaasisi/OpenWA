/**
 * One-time backfill: create crm_sale_attributions rows for existing linked sales.
 *
 * Usage:
 *   npm run backfill:sale-attributions
 *   npm run backfill:sale-attributions -- --dry-run
 */
import dataSource from '../database/data-source';
import { FollowupConversation } from '../modules/followup/entities/followup-conversation.entity';
import { CrmSaleAttribution } from '../modules/followup/entities/crm-sale-attribution.entity';
import { Quote } from '../modules/quote/entities/quote.entity';
import { backfillSaleAttributions } from '../modules/followup/utils/sale-attribution-backfill.util';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await dataSource.initialize();
  try {
    const convRepo = dataSource.getRepository(FollowupConversation);
    const quoteRepo = dataSource.getRepository(Quote);
    const attrRepo = dataSource.getRepository(CrmSaleAttribution);

    const result = await backfillSaleAttributions(convRepo, quoteRepo, attrRepo, { dryRun });

    console.log(
      dryRun
        ? `[dry-run] Would create ${result.created} attribution row(s); ${result.skipped} already attributed.`
        : `Created ${result.created} attribution row(s); skipped ${result.skipped} existing.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
