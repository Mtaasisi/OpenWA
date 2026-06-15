import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { RequireRole } from './decorators/auth.decorators';
import { ApiKeyRole } from './entities/api-key.entity';

@ApiTags('auth')
@Controller('auth/users')
@RequireRole(ApiKeyRole.ADMIN)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List staff users (admin only)' })
  findAll(): Promise<UserResponseDto[]> {
    return this.userService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create staff user (admin only)' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update staff user (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    return this.userService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate staff user (admin only)' })
  async deactivate(@Param('id') id: string): Promise<void> {
    await this.userService.deactivateUser(id);
  }
}
