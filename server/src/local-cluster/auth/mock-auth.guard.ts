import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ObjectId } from 'mongodb';

@Injectable()
export class MockAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Inject a default admin user
    request.user = {
      _id: new ObjectId('000000000000000000000000'),
      username: 'admin',
      name: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      password: 'mock',
      email: 'admin@laf.run',
      profile: {},
    };
    return true;
  }
}
