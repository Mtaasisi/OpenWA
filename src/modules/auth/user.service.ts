import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { ApiKey, ApiKeyRole, ApiKeyType } from './entities/api-key.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { createLogger } from '../../common/services/logger.service';
import { isProductionEnv } from '../../common/utils/production-security.util';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = createLogger('UserService');

  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepo: Repository<User>,
    @InjectRepository(ApiKey, 'main')
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapAdminIfNeeded();
  }

  private async bootstrapAdminIfNeeded(): Promise<void> {
    const count = await this.userRepo.count();
    if (count > 0) return;

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!email || !password) {
      if (isProductionEnv()) {
        this.logger.warn(
          'No users exist. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first admin.',
        );
      }
      return;
    }

    try {
      const user = await this.createUser({
        email,
        name: 'Admin',
        password,
        role: ApiKeyRole.ADMIN,
      });
      this.logger.log(`Bootstrap admin user created: ${user.email}`);
    } catch (err) {
      this.logger.error(
        `Failed to bootstrap admin user: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerErrorException('Failed to bootstrap admin user');
    }
  }

  toResponse(user: User, linkedKey?: ApiKey | null): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      staffId: user.linkedApiKeyId ?? linkedKey?.id ?? null,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return users.map(u => this.toResponse(u));
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const linkedKey = await this.createLinkedApiKey(dto.name, dto.role);

    const user = this.userRepo.create({
      email,
      name: dto.name.trim(),
      passwordHash,
      role: dto.role,
      linkedApiKeyId: linkedKey.id,
      isActive: true,
    });

    const saved = await this.userRepo.save(user);
    await this.apiKeyRepo.update(linkedKey.id, { userId: saved.id });

    this.logger.log(`User created: ${saved.email}`, { userId: saved.id, role: saved.role });
    return this.toResponse(saved, linkedKey);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findById(id);

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      user.refreshTokenVersion += 1;
    }

    const saved = await this.userRepo.save(user);

    if (user.linkedApiKeyId) {
      const keyUpdate: Partial<ApiKey> = {};
      if (dto.name !== undefined) keyUpdate.name = `User: ${user.name}`;
      if (dto.role !== undefined) keyUpdate.role = dto.role;
      if (dto.isActive !== undefined) keyUpdate.isActive = dto.isActive;
      if (Object.keys(keyUpdate).length > 0) {
        await this.apiKeyRepo.update(user.linkedApiKeyId, keyUpdate);
      }
    }

    return this.toResponse(saved);
  }

  async deactivateUser(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    user.refreshTokenVersion += 1;
    await this.userRepo.save(user);
    if (user.linkedApiKeyId) {
      await this.apiKeyRepo.update(user.linkedApiKeyId, { isActive: false });
    }
    this.logger.log(`User deactivated: ${user.email}`, { userId: id });
  }

  async getLinkedApiKey(user: User): Promise<ApiKey | null> {
    if (!user.linkedApiKeyId) return null;
    return this.apiKeyRepo.findOne({ where: { id: user.linkedApiKeyId } });
  }

  async incrementRefreshTokenVersion(userId: string): Promise<void> {
    await this.userRepo.increment({ id: userId }, 'refreshTokenVersion', 1);
  }

  private async createLinkedApiKey(name: string, role: ApiKeyRole): Promise<ApiKey> {
    const rawKey = `owa_k1_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepo.create({
      name: `User: ${name}`,
      keyHash,
      keyPrefix,
      role,
      type: ApiKeyType.USER,
      isActive: true,
    });

    return this.apiKeyRepo.save(apiKey);
  }
}
