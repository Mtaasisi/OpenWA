import { IsOptional, IsString, IsObject } from 'class-validator';

export class AgentActionResolveDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  currentPage?: string;

  @IsString()
  @IsOptional()
  currentChatId?: string;

  @IsString()
  @IsOptional()
  currentCustomerId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class AgentActionExecuteDto {
  @IsString()
  actionId: string;

  @IsObject()
  @IsOptional()
  params?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  currentPage?: string;

  @IsString()
  @IsOptional()
  currentChatId?: string;

  @IsString()
  @IsOptional()
  currentCustomerId?: string;
}

export class AgentActionConfirmDto {
  @IsString()
  confirmationId: string;

  @IsString()
  @IsOptional()
  conversationId?: string;
}
