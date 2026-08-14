import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Extracts the authenticated user (decoded from the JWT) attached
 * to the request by JwtAuthGuard. Never trust any client-supplied
 * userId/clientId/role field instead of this — this is the only
 * source of truth for "who is calling".
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
