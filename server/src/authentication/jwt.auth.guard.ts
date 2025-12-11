import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MockAuthGuard } from 'src/local-cluster/auth/mock-auth.guard'

// Replace standard JWT Guard with Mock Guard for local mode
@Injectable()
export class JwtAuthGuard extends MockAuthGuard {}
