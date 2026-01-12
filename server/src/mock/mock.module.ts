import { Module } from '@nestjs/common';
import { MockUserController } from './mock-user.controller';
import { MockAuthController } from './mock-auth.controller';
import { MockAccountController } from './mock-account.controller';

@Module({
  controllers: [MockUserController, MockAuthController, MockAccountController],
})
export class MockModule {}
