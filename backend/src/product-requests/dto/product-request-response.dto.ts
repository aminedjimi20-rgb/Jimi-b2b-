import { Client, ProductRequest } from '@prisma/client';

type RequestWithClient = ProductRequest & { client?: Pick<Client, 'raisonSociale' | 'telephone'> };

/** Admin view — includes which client made the request. */
export function toAdminProductRequestDTO(r: RequestWithClient) {
  return {
    id: r.id,
    imageUrl: r.imageUrl,
    description: r.description,
    status: r.status,
    adminNote: r.adminNote,
    clientId: r.clientId,
    clientNom: r.client?.raisonSociale,
    clientTelephone: r.client?.telephone,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Client view — their own request (caller already filtered by clientId), no need to repeat their own identity. */
export function toClientProductRequestDTO(r: ProductRequest) {
  return {
    id: r.id,
    imageUrl: r.imageUrl,
    description: r.description,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
