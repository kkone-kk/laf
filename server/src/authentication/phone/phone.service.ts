import { Injectable, Logger } from '@nestjs/common'
import { AuthenticationService } from '../authentication.service'
import { PhoneSigninDto } from '../dto/phone-signin.dto'
import { hashPassword } from 'src/utils/crypto'
import { SmsVerifyCodeType } from '../entities/sms-verify-code'
import { User } from 'src/user/entities/user'
import {
  InviteRelation,
  InviteCode,
  InviteCodeState,
} from '../entities/invite-code'
import { SystemDatabase } from 'src/system-database'
import { UserService } from 'src/user/user.service'
import {
  UserPassword,
  UserPasswordState,
} from 'src/user/entities/user-password'
import { UserProfile } from 'src/user/entities/user-profile'
import { SmsService } from './sms.service'
import { AccountService } from 'src/account/account.service'
import {
  AccountChargeOrder,
  AccountChargePhase,
  Currency,
  PaymentChannelType,
} from 'src/account/entities/account-charge-order'
import { TASK_LOCK_INIT_TIME } from 'src/constants'
import { ObjectId } from 'mongodb'
import { Setting, SettingKey } from 'src/setting/entities/setting'

@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name)
  private readonly db = SystemDatabase.db

  constructor(
    private readonly smsService: SmsService,
    private readonly authService: AuthenticationService,
    private readonly userService: UserService,
    private readonly accountService: AccountService,
  ) {}

  /**
   * Send phone verify code
   * @param phone phone number
   * @param type sms type Signin | Signup | ResetPassword
   * @param ip client ip
   * @returns
   */
  async sendCode(phone: string, type: SmsVerifyCodeType, ip: string) {
    // check if phone number satisfy the send condition
    let err = await this.smsService.checkSendable(phone, ip)
    if (err) {
      return err
    }

    // Send sms code
    const code = Math.floor(Math.random() * 900000 + 100000).toString()
    err = await this.smsService.sendPhoneCode(phone, code)
    if (err) {
      return err
    }

    // disable previous sms code
    await this.smsService.disableSameTypeCode(phone, type)

    // Save new sms code to database
    await this.smsService.saveCode(phone, code, type, ip)

    return null
  }

  /**
   * Signup a user by phone
   * @param dto
   * @returns
   */
  async signup(dto: PhoneSigninDto, withUsername = false) {
    const { phone, username, password, inviteCode } = dto

    try {
      const randomUsername = new ObjectId()
      // create user
      const user = await this.db.collection<User>('User').insertOne({
        phone,
        username: username || randomUsername.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // create profile
      await this.db.collection<UserProfile>('UserProfile').insertOne({
        uid: user.insertedId,
        name: username || randomUsername.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      if (withUsername) {
        // create password
        await this.db.collection<UserPassword>('UserPassword').insertOne({
          uid: user.insertedId,
          password: hashPassword(password),
          state: UserPasswordState.Active,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // TODO: Handle invite code logic later if needed
      // if (inviteCode) {
      //   // invite code logic
      // }

      return await this.userService.findOneById(user.insertedId)
    } catch (err) {
      this.logger.error('Phone signup error:', err)
      throw err
    }
  }

  /**
   * signin a user, return token and if bind password
   * @param user user
   * @returns token and if bind password
   */
  signin(user: User) {
    const token = this.authService.getAccessTokenByUser(user)
    return token
  }

  // check if current user has bind password
  async ifBindPassword(user: User) {
    const count = await this.db
      .collection<UserPassword>('UserPassword')
      .countDocuments({
        uid: user._id,
        state: UserPasswordState.Active,
      })

    return count > 0
  }
}
