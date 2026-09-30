import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [UsersService, UserRolesService],
  controllers: [UsersController, UserRolesController],
  exports: [UsersService],
})
export class UsersModule {}
