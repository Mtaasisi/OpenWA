import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, type ApiKey } from '../auth/entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { WhatsAppGroupSafetyService } from '../whatsapp-safety/services/whatsapp-group-safety.service';

// DTOs
class CreateGroupDto {
  name: string;
  participants: string[];
  confirm?: boolean;
}

class ParticipantsDto {
  participants: string[];
  confirm?: boolean;
}

class GroupSubjectDto {
  subject: string;
  confirm?: boolean;
}

class GroupDescriptionDto {
  description: string;
  confirm?: boolean;
}

class GroupConfirmDto {
  confirm?: boolean;
}

@ApiTags('groups')
@Controller('sessions/:sessionId/groups')
@UseGuards(ApiKeyGuard)
export class GroupController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly groupSafety: WhatsAppGroupSafetyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all groups for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async findAll(@Param('sessionId') sessionId: string) {
    const engine = this.getEngine(sessionId);
    return engine.getGroups();
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get detailed group info' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID (e.g., 120363xxx@g.us)' })
  @ApiResponse({ status: 200, description: 'Group details with participants' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async findOne(@Param('sessionId') sessionId: string, @Param('groupId') groupId: string) {
    const engine = this.getEngine(sessionId);
    const group = await engine.getGroupInfo(groupId);
    if (!group) {
      throw new BadRequestException(`Group ${groupId} not found`);
    }
    return group;
  }

  @Post()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a new group' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiBody({ type: CreateGroupDto })
  @ApiResponse({ status: 201, description: 'Group created' })
  async create(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateGroupDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    const group = await engine.createGroup(dto.name, dto.participants);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupName: dto.name, participantCount: dto.participants.length },
    });
    return group;
  }

  @Post(':groupId/participants')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Add participants to a group' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: ParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants added' })
  @HttpCode(HttpStatus.OK)
  async addParticipants(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ParticipantsDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.addParticipants(groupId, dto.participants);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'add_participants', count: dto.participants.length },
    });
    return { success: true, message: 'Participants added' };
  }

  @Delete(':groupId/participants')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Remove participants from a group' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: ParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants removed' })
  async removeParticipants(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ParticipantsDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.removeParticipants(groupId, dto.participants);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'remove_participants', count: dto.participants.length },
    });
    return { success: true, message: 'Participants removed' };
  }

  @Post(':groupId/participants/promote')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Promote participants to admin' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: ParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants promoted' })
  @HttpCode(HttpStatus.OK)
  async promoteParticipants(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ParticipantsDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.promoteParticipants(groupId, dto.participants);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'promote', count: dto.participants.length },
    });
    return { success: true, message: 'Participants promoted to admin' };
  }

  @Post(':groupId/participants/demote')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Demote participants from admin' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: ParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants demoted' })
  @HttpCode(HttpStatus.OK)
  async demoteParticipants(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ParticipantsDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.demoteParticipants(groupId, dto.participants);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'demote', count: dto.participants.length },
    });
    return { success: true, message: 'Participants demoted from admin' };
  }

  @Put(':groupId/subject')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Change group name/subject' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: GroupSubjectDto })
  @ApiResponse({ status: 200, description: 'Subject updated' })
  async setSubject(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: GroupSubjectDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.setGroupSubject(groupId, dto.subject);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'set_subject' },
    });
    return { success: true, message: 'Group subject updated' };
  }

  @Put(':groupId/description')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Change group description' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({ type: GroupDescriptionDto })
  @ApiResponse({ status: 200, description: 'Description updated' })
  async setDescription(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: GroupDescriptionDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.setGroupDescription(groupId, dto.description);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'set_description' },
    });
    return { success: true, message: 'Group description updated' };
  }

  @Post(':groupId/leave')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Leave a group' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Left the group' })
  @HttpCode(HttpStatus.OK)
  async leave(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: GroupConfirmDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    await engine.leaveGroup(groupId);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'leave' },
    });
    return { success: true, message: 'Left the group' };
  }

  // ========== Gap Quick Wins: Invite Link ==========

  @Get(':groupId/invite-code')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Get group invite code/link' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group invite code' })
  async getInviteCode(@Param('sessionId') sessionId: string, @Param('groupId') groupId: string) {
    const engine = this.getEngine(sessionId);
    const inviteCode = await engine.getGroupInviteCode(groupId);
    return {
      inviteCode,
      inviteLink: `https://chat.whatsapp.com/${inviteCode}`,
    };
  }

  @Post(':groupId/invite-code/revoke')
  @RequireRole(ApiKeyRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke group invite code and generate new one' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'New invite code generated' })
  async revokeInviteCode(
    @Param('sessionId') sessionId: string,
    @Param('groupId') groupId: string,
    @Body() dto: GroupConfirmDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    await this.groupSafety.assertGroupManagementAllowed(sessionId, { confirm: dto.confirm });
    const engine = this.getEngine(sessionId);
    const newCode = await engine.revokeGroupInviteCode(groupId);
    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId,
      metadata: { groupId, action: 'revoke_invite' },
    });
    return {
      inviteCode: newCode,
      inviteLink: `https://chat.whatsapp.com/${newCode}`,
      message: 'Invite code revoked and new one generated',
    };
  }

  private getEngine(sessionId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new BadRequestException('Session is not started');
    }
    return engine;
  }
}
