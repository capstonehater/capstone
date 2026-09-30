import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { AuthController } from './auth.controller';
import { PermissionResolver } from './rbac/permission-resolver.service';

@Injectable()
export class AuthPermissionsInterceptor implements NestInterceptor {
  constructor(private readonly resolver: PermissionResolver) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (
      context.getClass() !== AuthController ||
      !['login', 'getMe'].includes(context.getHandler().name)
    )
      return next.handle();
    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        if (!response || typeof response !== 'object' || !('user' in response))
          return response;
        const user = response.user;
        if (
          !user ||
          typeof user !== 'object' ||
          !('id' in user) ||
          typeof user.id !== 'string'
        )
          return response;
        const snapshot = await this.resolver.snapshot({ id: user.id });
        return { ...response, user: { ...user, ...snapshot } };
      }),
    );
  }
}
