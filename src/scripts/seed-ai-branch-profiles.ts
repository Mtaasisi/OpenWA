/**
 * Seed default Dar/Arusha branch AI profiles when the table is empty.
 *
 * Usage:
 *   npm run seed:ai-profiles
 */
import dataSource from '../database/data-source';
import { BranchAiProfile } from '../modules/ai/entities/branch-ai-profile.entity';
import { BranchPaymentAccount } from '../modules/ai/entities/branch-payment-account.entity';
import { DEFAULT_BRANCH_PROFILE_SEEDS } from '../modules/ai/utils/ai-branch-profile-seed';
import { PaymentMethodType } from '../modules/ai/ai-signal.enums';

async function seedPaymentFromEnv(
  profileRepo: ReturnType<typeof dataSource.getRepository<BranchAiProfile>>,
): Promise<void> {
  const lipa = process.env.OPENWA_MPESA_LIPA_NUMBER?.trim();
  if (!lipa) {
    console.log('Next: add M-Pesa in Settings → Branch AI profile, or set OPENWA_MPESA_LIPA_NUMBER in .env');
    return;
  }

  const paymentRepo = dataSource.getRepository(BranchPaymentAccount);
  const darAccounts = await paymentRepo.find({ where: { branchId: 'dar' } });
  if (darAccounts.some(a => a.isActive && !!a.accountNumber?.trim())) {
    console.log('Dar already has an active M-Pesa account — skipping payment seed.');
    return;
  }

  const darProfile = await profileRepo.findOne({ where: { branchId: 'dar' } });
  await paymentRepo.save(
    paymentRepo.create({
      branchId: 'dar',
      methodType: PaymentMethodType.MOBILE_MONEY,
      providerName: 'M-Pesa',
      accountName: darProfile?.businessName?.trim() || 'Inauzwa',
      accountNumber: lipa,
      instructions: 'Tuma kwa lipa namba. Weka jina lako kwenye reference ili tukutambue haraka.',
      isActive: true,
      isDefault: true,
    }),
  );
  console.log('Seeded M-Pesa payment for dar from OPENWA_MPESA_LIPA_NUMBER.');
}

async function main() {
  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(BranchAiProfile);
    const count = await repo.count();
    if (count > 0) {
      const existing = await repo.find({ order: { branchName: 'ASC' } });
      console.log(`Branch profiles already exist (${count}). Skipping profile seed.`);
      for (const p of existing) {
        console.log(`  - ${p.branchId}: ${p.branchName ?? p.businessName ?? '(unnamed)'}`);
      }
      await seedPaymentFromEnv(repo);
      return;
    }

    for (const item of DEFAULT_BRANCH_PROFILE_SEEDS) {
      const row = repo.create({
        branchId: item.branchId,
        businessName: item.profile.businessName ?? null,
        branchName: item.profile.branchName ?? null,
        aiDisplayName: item.profile.aiDisplayName ?? null,
        locationDescription: item.profile.locationDescription ?? null,
        googleMapsUrl: item.profile.googleMapsUrl ?? null,
        nearbyLandmarks: item.profile.nearbyLandmarks ?? null,
        openingHours: item.profile.openingHours ?? null,
        phoneNumbers: item.profile.phoneNumbers ?? null,
        deliveryPolicy: item.profile.deliveryPolicy ?? null,
        warrantyPolicy: item.profile.warrantyPolicy ?? null,
        installmentPolicyDefault: item.profile.installmentPolicyDefault ?? null,
        aiTone: item.profile.aiTone ?? 'boss_friendly_mtaani',
      });
      await repo.save(row);
      console.log(`Seeded branch profile: ${item.branchId} (${item.profile.branchName})`);
    }

    await seedPaymentFromEnv(repo);
  } finally {
    await dataSource.destroy();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
