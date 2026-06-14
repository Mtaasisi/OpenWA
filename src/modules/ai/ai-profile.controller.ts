import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiProfileService } from './ai-profile.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import {
  CreatePaymentAccountDto,
  UpdatePaymentAccountDto,
  UpsertBranchAiProfileDto,
} from './dto/ai-profile.dto';

@ApiTags('ai')
@Controller('ai/profile')
export class AiProfileController {
  constructor(private readonly profileService: AiProfileService) {}

  @Get('branches')
  @ApiOperation({ summary: 'List branch AI profiles' })
  listBranches() {
    return this.profileService.listProfiles();
  }

  @Post('seed-defaults')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Seed Dar/Arusha branch profiles when table is empty' })
  async seedDefaults() {
    const seeded = await this.profileService.seedDefaultProfilesIfMissing();
    const payment = await this.profileService.seedPaymentFromEnv('dar');
    return {
      seeded,
      payment,
      profiles: await this.profileService.listProfiles(),
    };
  }

  @Post('branches/:branchId/seed-payment-from-env')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Create active M-Pesa account from OPENWA_MPESA_LIPA_NUMBER when branch has none',
  })
  seedPaymentFromEnv(@Param('branchId') branchId: string) {
    return this.profileService.seedPaymentFromEnv(branchId);
  }

  @Get('branches/:branchId')
  @ApiOperation({ summary: 'Get branch AI profile' })
  async getBranch(@Param('branchId') branchId: string) {
    const profile = await this.profileService.getProfile(branchId);
    const paymentAccounts = await this.profileService.listPaymentAccounts(branchId);
    return { profile, paymentAccounts };
  }

  @Post('branches/:branchId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create or update branch AI profile' })
  upsertBranch(@Param('branchId') branchId: string, @Body() dto: UpsertBranchAiProfileDto) {
    return this.profileService.upsertProfile(branchId, dto);
  }

  @Get('branches/:branchId/payment-accounts')
  @ApiOperation({ summary: 'List payment accounts for a branch' })
  listPaymentAccounts(@Param('branchId') branchId: string) {
    return this.profileService.listPaymentAccounts(branchId);
  }

  @Post('branches/:branchId/payment-accounts')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create payment account for a branch' })
  createPaymentAccount(@Param('branchId') branchId: string, @Body() dto: CreatePaymentAccountDto) {
    return this.profileService.createPaymentAccount(branchId, dto);
  }

  @Patch('payment-accounts/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update payment account' })
  updatePaymentAccount(@Param('id') id: string, @Body() dto: UpdatePaymentAccountDto) {
    return this.profileService.updatePaymentAccount(id, dto);
  }

  @Delete('payment-accounts/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete payment account' })
  async deletePaymentAccount(@Param('id') id: string) {
    await this.profileService.deletePaymentAccount(id);
    return { ok: true };
  }
}
