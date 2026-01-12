import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ResponseUtil } from '../utils/response';

@ApiTags('Authentication')
@Controller('auth')
export class MockAuthController {
  @ApiOperation({ summary: 'Get auth providers' })
  @Get('providers')
  async getProviders() {
    return ResponseUtil.ok([
      {
        name: 'user-password',
        type: 'user-password',
        state: 'Enabled',
        default: true,
      }
    ]);
  }

  @ApiOperation({ summary: 'Sign in' })
  @Post('signin')
  async signin() {
    return ResponseUtil.ok({
      token: 'mock_token',
      user: {
        _id: '000000000000000000000000',
        username: 'default_user',
      }
    });
  }
}
