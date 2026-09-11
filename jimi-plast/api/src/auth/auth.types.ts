export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleKey: string;
  locale: string;
  permissions: string[]; // clés effectives (rôle + surcharges) résolues à l'authentification
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
}
