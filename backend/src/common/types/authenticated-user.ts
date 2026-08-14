import { Role } from '@prisma/client';

/**
 * Shape of `request.user` after JwtAuthGuard runs — derived strictly
 * from the verified JWT payload, never from request body/query.
 * `clientId` is null for ADMIN/EMPLOYEE users.
 */
export interface AuthenticatedUser {
  userId: string;
  role: Role;
  clientId: string | null;
}
