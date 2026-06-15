import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { UserService } from './user.service';
import { LoginDto, LoginResponseDto } from './dto/user.dto';

export type JwtTokenType = 'access' | 'refresh';

export type OpenWaJwtPayload = {
  sub: string;
  type: JwtTokenType;
  ver: number;
};

export type AuthenticatedIdentity = {
  user: User;
  apiKey: ApiKey;
};

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.userService.validatePassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const apiKey = await this.userService.getLinkedApiKey(user);
    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedException('User account is not fully configured');
    }

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: this.userService.toResponse(user, apiKey),
    };
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const payload = await this.verifyToken(refreshToken, 'refresh');
    const user = await this.userService.findById(payload.sub);

    if (!user.isActive || payload.ver !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const apiKey = await this.userService.getLinkedApiKey(user);
    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedException('User account is not fully configured');
    }

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: this.userService.toResponse(user, apiKey),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userService.incrementRefreshTokenVersion(userId);
  }

  async resolveIdentityFromAccessToken(token: string): Promise<AuthenticatedIdentity> {
    const payload = await this.verifyToken(token, 'access');
    const user = await this.userService.findById(payload.sub);

    if (!user.isActive || payload.ver !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Session expired');
    }

    const apiKey = await this.userService.getLinkedApiKey(user);
    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedException('User account is not fully configured');
    }

    return { user, apiKey };
  }

  private async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const ver = user.refreshTokenVersion;
    const accessToken = await this.signToken(user.id, 'access', ver);
    const refreshToken = await this.signToken(user.id, 'refresh', ver);
    return { accessToken, refreshToken };
  }

  private async signToken(userId: string, type: JwtTokenType, ver: number): Promise<string> {
    const payload: OpenWaJwtPayload = { sub: userId, type, ver };
    const expiresIn =
      type === 'access'
        ? this.configService.get<string>('jwt.accessExpiresIn', '8h')
        : this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    return this.jwtService.signAsync(payload, { expiresIn: expiresIn as `${number}h` | `${number}d` });
  }

  private async verifyToken(token: string, expectedType: JwtTokenType): Promise<OpenWaJwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<OpenWaJwtPayload>(token);
      if (payload.type !== expectedType || !payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
