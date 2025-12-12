import { Injectable, Logger } from '@nestjs/common'
import { hashPassword } from 'src/utils/crypto'
import { AuthenticationService } from '../authentication.service'
import { SystemDatabase } from 'src/system-database'
import { User } from 'src/user/entities/user'
import {
  UserPassword,
  UserPasswordState,
} from 'src/user/entities/user-password'
import {
  InviteCode,
  InviteRelation,
  InviteCodeState,
} from '../entities/invite-code'
import { UserProfile } from 'src/user/entities/user-profile'
import { UserService } from 'src/user/user.service'
import { ObjectId } from 'mongodb'
import { AccountService } from 'src/account/account.service'
import {
  AccountChargeOrder,
  AccountChargePhase,
  Currency,
  PaymentChannelType,
} from 'src/account/entities/account-charge-order'
import { TASK_LOCK_INIT_TIME } from 'src/constants'
import { Setting, SettingKey } from 'src/setting/entities/setting'

@Injectable()
export class UserPasswordService {
  private readonly logger = new Logger(UserPasswordService.name)
  private readonly db = SystemDatabase.db

  constructor(
    private readonly authService: AuthenticationService,
    private readonly userService: UserService,
    private readonly accountService: AccountService,
  ) {}

  // Signup by username and password
  async signup(
    username: string,
    password: string,
    phone: string,
    email: string,
    inviteCode: string,
  ) {
    this.logger.log(`Starting signup for user: ${username}`)
    
    try {
      // create user
      this.logger.log('Creating user...')
      const userResult = await this.db.collection<User>('User').insertOne({
        username,
        phone,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      this.logger.log(`User created with ID: ${userResult.insertedId}`)

      // create password
      this.logger.log('Creating password...')
      await this.db.collection<UserPassword>('UserPassword').insertOne({
        uid: userResult.insertedId,
        password: hashPassword(password),
        state: UserPasswordState.Active,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      this.logger.log('Password created')

      // create profile
      this.logger.log('Creating profile...')
      await this.db.collection<UserProfile>('UserProfile').insertOne({
        uid: userResult.insertedId,
        name: username,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      this.logger.log('Profile created')

      // Return the created user directly
      const createdUser = await this.db.collection<User>('User').findOne({ _id: userResult.insertedId })
      this.logger.log('User signup completed successfully')
      return createdUser

    } catch (error) {
      this.logger.error('Signup error:', error)
      throw error
    }
  }

  // Signin for user, means get access token
  signin(user: User) {
    return this.authService.getAccessTokenByUser(user)
  }

  // validate if password is correct
  async validatePassword(uid: ObjectId, password: string) {
    const userPasswd = await this.db
      .collection<UserPassword>('UserPassword')
      .findOne({ uid, state: UserPasswordState.Active })

    if (!userPasswd) {
      return 'password not exists'
    }

    if (userPasswd.password !== hashPassword(password)) {
      return 'password incorrect'
    }

    return null
  }

  // reset password
  async resetPassword(uid: ObjectId, password: string) {
    try {
      // disable old password
      await this.db
        .collection<UserPassword>('UserPassword')
        .updateMany(
          { uid },
          { $set: { state: UserPasswordState.Inactive } },
        )

      // create new password
      await this.db.collection<UserPassword>('UserPassword').insertOne({
        uid,
        password: hashPassword(password),
        state: UserPasswordState.Active,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (error) {
      this.logger.error('Reset password error:', error)
      throw error
    }
  }

  // check if set password
  async hasPassword(uid: ObjectId) {
    const res = await this.db
      .collection<UserPassword>('UserPassword')
      .findOne({ uid, state: UserPasswordState.Active })

    return res ? true : false
  }
}
