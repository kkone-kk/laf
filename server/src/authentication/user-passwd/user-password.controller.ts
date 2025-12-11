import { AuthenticationService } from '../authentication.service'
import { UserPasswordService } from './user-password.service'
import { Body, Controller, Logger, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from 'src/utils/response'
import { UserService } from '../../user/user.service'
import { PasswdSignupDto } from '../dto/passwd-signup.dto'
import { PasswdSigninDto } from '../dto/passwd-signin.dto'
import { SmsService } from '../phone/sms.service'
import { PasswdResetDto } from '../dto/passwd-reset.dto'
import { PasswdCheckDto } from '../dto/passwd-check.dto'
import { EmailService } from '../email/email.service'
import { ObjectId } from 'mongodb'

@ApiTags('Authentication')
@Controller('auth')
export class UserPasswordController {
  private readonly logger = new Logger(UserPasswordService.name)
  constructor(
    private readonly userService: UserService,
    private readonly passwdService: UserPasswordService,
    private readonly authService: AuthenticationService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Signup by username and password
   */
  @ApiOperation({ summary: 'Signup by user-password' })
  @ApiResponse({ type: ResponseUtil })
  @Post('passwd/signup')
  async signup(@Body() dto: PasswdSignupDto) {
    // Mock Signup
    return ResponseUtil.ok({ token: 'mock-token', user: { username: 'admin' } })
  }

  /**
   * Signin by username and password
   */
  @ApiOperation({ summary: 'Signin by user-password' })
  @ApiResponse({ type: ResponseUtil })
  @Post('passwd/signin')
  async signin(@Body() dto: PasswdSigninDto) {
    // Mock Signin: always return success with a mock token and the admin user
    // We should probably ensure the admin user exists in DB or just return what the frontend needs.
    // However, if we return a random user that doesn't exist in DB, other calls relying on DB might fail if we didn't mock the Guard.
    // But we DID mock the Guard to always inject the admin user (id: 000...000).
    // So for consistency, we should return the same user info here.

    const mockUser = {
      _id: new ObjectId('000000000000000000000000'),
      username: 'admin',
      name: 'Admin',
      email: 'admin@laf.run',
      profile: {},
    }

    // The frontend expects a JWT token usually.
    // Since our Guard ignores the token content and just injects the user, any string works.
    const token = 'mock-jwt-token'

    return ResponseUtil.ok(token)
  }

  /**
   * Reset password
   */
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ type: ResponseUtil })
  @Post('passwd/reset')
  async reset(@Body() dto: PasswdResetDto) {
    return ResponseUtil.ok('success')
  }

  /**
   * Check if user-password is set
   */
  @ApiOperation({ summary: 'Check if user-password is set' })
  @ApiResponse({ type: ResponseUtil })
  @Post('passwd/check')
  async check(@Body() dto: PasswdCheckDto) {
    return ResponseUtil.ok(true)
  }
}
