import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchAiProfile } from './entities/branch-ai-profile.entity';
import { BranchPaymentAccount } from './entities/branch-payment-account.entity';
import type {
  CreatePaymentAccountDto,
  UpdatePaymentAccountDto,
  UpsertBranchAiProfileDto,
} from './dto/ai-profile.dto';
import { DEFAULT_BRANCH_PROFILE_SEEDS } from './utils/ai-branch-profile-seed';
import { normalizePhoneNumbers } from './utils/phone-numbers.util';
import { PaymentMethodType } from './ai-signal.enums';

@Injectable()
export class AiProfileService implements OnModuleInit {
  private readonly logger = new Logger(AiProfileService.name);

  constructor(
    @InjectRepository(BranchAiProfile, 'data')
    private readonly profileRepo: Repository<BranchAiProfile>,
    @InjectRepository(BranchPaymentAccount, 'data')
    private readonly paymentRepo: Repository<BranchPaymentAccount>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultProfilesIfMissing();
  }

  /** Create Dar/Arusha starter profiles when none exist (payment accounts still manual). */
  async seedDefaultProfilesIfMissing(): Promise<number> {
    const count = await this.profileRepo.count();
    if (count > 0) return 0;

    let seeded = 0;
    for (const item of DEFAULT_BRANCH_PROFILE_SEEDS) {
      await this.upsertProfile(item.branchId, item.profile);
      seeded++;
    }
    if (seeded > 0) {
      this.logger.log(
        `Seeded ${seeded} default branch AI profile(s) (dar, arusha). Add payment accounts in Settings.`,
      );
    }
    return seeded;
  }

  async listProfiles(): Promise<BranchAiProfile[]> {
    const rows = await this.profileRepo.find({ order: { branchName: 'ASC', updatedAt: 'DESC' } });
    return rows.map(row => this.normalizeProfile(row));
  }

  async hasActivePaymentAccount(): Promise<boolean> {
    const rows = await this.paymentRepo.find({ where: { isActive: true } });
    return rows.some(r => !!r.accountNumber?.trim());
  }

  /**
   * Dev/bootstrap helper: seed active M-Pesa when OPENWA_MPESA_LIPA_NUMBER is set.
   * Never overwrites an existing active account for the branch.
   */
  async seedPaymentFromEnv(branchId = 'dar'): Promise<{ created: boolean; branchId: string }> {
    const accountNumber = process.env.OPENWA_MPESA_LIPA_NUMBER?.trim();
    if (!accountNumber) return { created: false, branchId };

    const existing = await this.listPaymentAccounts(branchId);
    if (existing.some(a => a.isActive && !!a.accountNumber?.trim())) {
      return { created: false, branchId };
    }

    const profile = await this.getProfile(branchId);
    await this.createPaymentAccount(branchId, {
      methodType: PaymentMethodType.MOBILE_MONEY,
      providerName: 'M-Pesa',
      accountName: profile?.businessName?.trim() || 'Inauzwa',
      accountNumber,
      instructions:
        'Tuma kwa lipa namba. Weka jina lako kwenye reference ili tukutambue haraka.',
      isActive: true,
      isDefault: true,
    });

    this.logger.log(`Seeded M-Pesa payment account for branch ${branchId} from env.`);
    return { created: true, branchId };
  }

  async getProfile(branchId: string): Promise<BranchAiProfile | null> {
    const row = await this.profileRepo.findOne({ where: { branchId } });
    return row ? this.normalizeProfile(row) : null;
  }

  private normalizeProfile(row: BranchAiProfile): BranchAiProfile {
    row.phoneNumbers = normalizePhoneNumbers(row.phoneNumbers);
    return row;
  }

  async upsertProfile(branchId: string, dto: UpsertBranchAiProfileDto): Promise<BranchAiProfile> {
    let row = await this.profileRepo.findOne({ where: { branchId } });
    if (!row) {
      row = this.profileRepo.create({ branchId });
    }
    if (dto.businessName !== undefined) row.businessName = dto.businessName;
    if (dto.branchName !== undefined) row.branchName = dto.branchName;
    if (dto.aiDisplayName !== undefined) row.aiDisplayName = dto.aiDisplayName;
    if (dto.locationDescription !== undefined) row.locationDescription = dto.locationDescription;
    if (dto.googleMapsUrl !== undefined) row.googleMapsUrl = dto.googleMapsUrl;
    if (dto.nearbyLandmarks !== undefined) row.nearbyLandmarks = dto.nearbyLandmarks;
    if (dto.openingHours !== undefined) row.openingHours = dto.openingHours;
    if (dto.phoneNumbers !== undefined) row.phoneNumbers = dto.phoneNumbers;
    if (dto.deliveryPolicy !== undefined) row.deliveryPolicy = dto.deliveryPolicy;
    if (dto.warrantyPolicy !== undefined) row.warrantyPolicy = dto.warrantyPolicy;
    if (dto.installmentPolicyDefault !== undefined) {
      row.installmentPolicyDefault = dto.installmentPolicyDefault;
    }
    if (dto.aiTone !== undefined) row.aiTone = dto.aiTone;
    const saved = await this.profileRepo.save(row);
    return this.normalizeProfile(saved);
  }

  async listPaymentAccounts(branchId: string, activeOnly = false): Promise<BranchPaymentAccount[]> {
    const where = activeOnly ? { branchId, isActive: true } : { branchId };
    return this.paymentRepo.find({
      where,
      order: { isDefault: 'DESC', providerName: 'ASC', createdAt: 'ASC' },
    });
  }

  async getDefaultPaymentAccount(branchId: string): Promise<BranchPaymentAccount | null> {
    const active = await this.listPaymentAccounts(branchId, true);
    return active.find(a => a.isDefault) ?? active[0] ?? null;
  }

  async createPaymentAccount(
    branchId: string,
    dto: CreatePaymentAccountDto,
  ): Promise<BranchPaymentAccount> {
    if (dto.isDefault) {
      await this.paymentRepo.update({ branchId }, { isDefault: false });
    }
    const row = this.paymentRepo.create({
      branchId,
      methodType: dto.methodType,
      providerName: dto.providerName ?? null,
      accountName: dto.accountName,
      accountNumber: dto.accountNumber,
      instructions: dto.instructions ?? null,
      isActive: dto.isActive !== false,
      isDefault: dto.isDefault === true,
    });
    return this.paymentRepo.save(row);
  }

  async updatePaymentAccount(id: string, dto: UpdatePaymentAccountDto): Promise<BranchPaymentAccount> {
    const row = await this.paymentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Payment account not found');
    if (dto.isDefault) {
      await this.paymentRepo.update({ branchId: row.branchId }, { isDefault: false });
    }
    if (dto.methodType !== undefined) row.methodType = dto.methodType;
    if (dto.providerName !== undefined) row.providerName = dto.providerName;
    if (dto.accountName !== undefined) row.accountName = dto.accountName;
    if (dto.accountNumber !== undefined) row.accountNumber = dto.accountNumber;
    if (dto.instructions !== undefined) row.instructions = dto.instructions;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.isDefault !== undefined) row.isDefault = dto.isDefault;
    return this.paymentRepo.save(row);
  }

  async deletePaymentAccount(id: string): Promise<void> {
    const row = await this.paymentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Payment account not found');
    await this.paymentRepo.remove(row);
  }

  formatLocationBlock(profile: BranchAiProfile): string {
    const parts: string[] = [];
    if (profile.locationDescription) parts.push(profile.locationDescription);
    if (profile.nearbyLandmarks) parts.push(profile.nearbyLandmarks);
    if (profile.openingHours) parts.push(`⏰ ${profile.openingHours}`);
    if (profile.googleMapsUrl) parts.push(`📍 Google Maps:\n${profile.googleMapsUrl}`);
    const phones = normalizePhoneNumbers(profile.phoneNumbers);
    if (phones?.length) {
      parts.push(`Ukipotea tupigie:\n${phones.join(' / ')}`);
    }
    return parts.join('\n\n');
  }

  formatPaymentBlock(account: BranchPaymentAccount): string {
    const lines = [
      account.providerName || 'Malipo',
      account.accountName ? `Jina: ${account.accountName}` : null,
      account.accountNumber ? `Namba: ${account.accountNumber}` : null,
      account.instructions,
    ].filter(Boolean);
    return lines.join('\n');
  }
}
