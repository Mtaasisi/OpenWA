import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { DesktopService } from './desktop.service';
import { DesktopLocalGuard } from './guards/desktop-local.guard';
import {
  CreateAdminDto,
  RegisterDeviceDto,
  SetupBranchDto,
  TestDatabaseDto,
} from './dto/desktop.dto';

@ApiTags('desktop')
@Controller()
@Public()
@UseGuards(DesktopLocalGuard)
export class DesktopController {
  constructor(private readonly desktopService: DesktopService) {}

  @Get('health/desktop')
  @ApiOperation({ summary: 'Extended health check for desktop app' })
  getDesktopHealth() {
    return this.desktopService.getDesktopHealth();
  }

  @Post('desktop/db/test')
  @ApiOperation({ summary: 'Test Neon database connection' })
  testDatabase(@Body() dto: TestDatabaseDto) {
    return this.desktopService.testDatabaseConnection(dto.databaseUrl);
  }

  @Post('desktop/db/migrate')
  @ApiOperation({ summary: 'Run pending database migrations' })
  runMigrations(@Body() dto: TestDatabaseDto) {
    return this.desktopService.runMigrations(dto.databaseUrl);
  }

  @Post('desktop/setup/seed')
  @ApiOperation({ summary: 'Idempotent default seeds for desktop setup' })
  seedDefaults() {
    return this.desktopService.seedDefaults();
  }

  @Get('desktop/setup/admin/status')
  @ApiOperation({ summary: 'Check whether an admin user already exists' })
  getAdminSetupStatus() {
    return this.desktopService.getAdminSetupStatus();
  }

  @Post('desktop/setup/admin')
  @ApiOperation({ summary: 'Create or update the desktop admin login account' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.desktopService.saveAdminAccount(dto);
  }

  @Get('desktop/setup/branches')
  @ApiOperation({ summary: 'List existing branch profiles' })
  listBranches() {
    return this.desktopService.listBranches();
  }

  @Post('desktop/setup/branch')
  @ApiOperation({ summary: 'Create or update branch profile' })
  setupBranch(@Body() dto: SetupBranchDto) {
    return this.desktopService.setupBranch(dto);
  }

  @Post('desktop/device/register')
  @ApiOperation({ summary: 'Register or update desktop device' })
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.desktopService.registerDevice(dto);
  }

  @Get('desktop/device/status')
  @ApiOperation({ summary: 'Device status and session lock warnings' })
  getDeviceStatus() {
    const deviceId = process.env.DESKTOP_DEVICE_ID || '';
    return this.desktopService.getDeviceStatus(deviceId);
  }
}
