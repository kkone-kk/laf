import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ResponseUtil } from '../utils/response';

@ApiTags('Account')
@Controller('accounts')
export class MockAccountController {
  @ApiOperation({ summary: 'Get account info' })
  @Get()
  async getAccount() {
    return ResponseUtil.ok({
      balance: 999999,
      deductionBalance: 0,
    });
  }

  @ApiOperation({ summary: 'Get charge order amount' })
  @Post('charge-order')
  async getChargeOrderAmount() {
    return ResponseUtil.ok({
      amount: 0,
    });
  }
}
