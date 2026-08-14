import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Allow-list of roles permitted to call this handler.
 * Combined with RolesGuard — a route with no @Roles() decorator
 * still requires a valid JWT but any authenticated role can access it.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
