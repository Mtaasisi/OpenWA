import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from './decorators/auth.decorators';
import { AuthSessionService } from './auth-session.service';
import { LoginDto, RefreshTokenDto, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthSessionController {
  constructor(private readonly authSession: AuthSessionService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authSession.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authSession.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate refresh tokens' })
  async logout(@Req() req: Request & { user?: User }): Promise<void> {
    if (req.user?.id) {
      await this.authSession.logout(req.user.id);
    }
  }

  @Get('me')
  @ApiOperation({ summary: 'Current logged-in user profile' })
  me(@Req() req: Request & { user?: User }): UserResponseDto {
    const user = req.user!;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      staffId: user.linkedApiKeyId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
