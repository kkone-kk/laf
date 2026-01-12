import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ResponseUtil } from '../utils/response';
import { DEFAULT_USER_ID } from '../constants';

@ApiTags('User')
@Controller('user')
export class MockUserController {
  @ApiOperation({ summary: 'Get current user profile' })
  @Get('profile')
  async getProfile() {
    return ResponseUtil.ok({
      _id: DEFAULT_USER_ID,
      username: 'default_user',
      name: 'Default User',
      email: 'default@example.com',
      phone: '1234567890',
      profile: {
        avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
    });
  }
}
