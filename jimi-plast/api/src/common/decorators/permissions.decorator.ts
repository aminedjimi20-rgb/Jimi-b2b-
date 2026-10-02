import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marque une route comme nécessitant un ou plusieurs droits précis
 * (ex: @RequirePermissions('users.manage')). Vérifié par PermissionsGuard
 * côté serveur — jamais une simple vérification d'écran.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
