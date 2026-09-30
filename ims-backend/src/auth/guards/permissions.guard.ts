import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isPermissionKey } from '../rbac/permission-catalog';
import { PermissionResolver } from '../rbac/permission-resolver.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<unknown>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    // Existing controllers retain exactly their session + RolesGuard behavior.
    if (required === undefined) return true;
    // No OR fallback and no accidental double policy. Migrating a route requires
    // removing inherited @Roles metadata (or separating its controller).
    const hasRoles = targets.some(
      (target) => this.reflector.get(ROLES_KEY, target) !== undefined,
    );
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (hasRoles || isPublic)
      throw new InternalServerErrorException(
        'Conflicting authorization policy',
      );
    if (
      !Array.isArray(required) ||
      !required.length ||
      required.some((key) => typeof key !== 'string' || !isPermissionKey(key))
    ) {
      throw new ForbiddenException('Invalid permission requirement');
    }
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new UnauthorizedException('Authentication required');
    const grants = await this.resolver.resolve(user);
    if (
      !required.every((key: string) => isPermissionKey(key) && grants.has(key))
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return true;
  }
}
