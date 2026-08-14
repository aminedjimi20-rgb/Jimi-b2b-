import { Client, User } from '@prisma/client';

type ClientWithUser = Client & { user: Pick<User, 'email' | 'phone' | 'status'> };

/**
 * Allow-list mapper — Admin sees everything about a client, including
 * credit exposure and internal notes.
 */
export function toAdminClientDTO(client: ClientWithUser) {
  return {
    id: client.id,
    raisonSociale: client.raisonSociale,
    telephone: client.telephone,
    adresse: client.adresse,
    ville: client.ville,
    email: client.user.email,
    phone: client.user.phone,
    status: client.user.status,
    limiteCredit: client.limiteCredit,
    soldeCredit: client.soldeCredit,
    notesInternes: client.notesInternes,
    createdAt: client.createdAt,
  };
}

/**
 * Allow-list mapper — a client viewing their own profile. Deliberately
 * omits `notesInternes` (Admin-only commentary about this client) even
 * though it's the client's own record — internal notes are never client
 * facing, by design.
 */
export function toSelfClientDTO(client: ClientWithUser) {
  return {
    id: client.id,
    raisonSociale: client.raisonSociale,
    telephone: client.telephone,
    adresse: client.adresse,
    ville: client.ville,
    email: client.user.email,
    phone: client.user.phone,
    limiteCredit: client.limiteCredit,
    soldeCredit: client.soldeCredit,
  };
}

export type AdminClientDTO = ReturnType<typeof toAdminClientDTO>;
export type SelfClientDTO = ReturnType<typeof toSelfClientDTO>;
