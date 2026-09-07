import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { readSessionTokenFromRequest } from '../auth.utils';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const sessionToken = readSessionTokenFromRequest(request);

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const authenticatedUser =
      await this.sessionService.validateSession(sessionToken);

    if (!authenticatedUser) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = authenticatedUser;
    return true;
  }
}
