import { Client, Employee, ProductRequest } from '@prisma/client';

type RequestWithSender = ProductRequest & {
  client?: Pick<Client, 'raisonSociale' | 'telephone'> | null;
  employee?: Pick<Employee, 'nom'> | null;
};

/** Admin view — includes which client or employee made the request. */
export function toAdminProductRequestDTO(r: RequestWithSender) {
  return {
    id: r.id,
    imageUrl: r.imageUrl,
    description: r.description,
    status: r.status,
    adminNote: r.adminNote,
    clientId: r.clientId,
    clientNom: r.client?.raisonSociale,
    clientTelephone: r.client?.telephone,
    employeeId: r.employeeId,
    employeeNom: r.employee?.nom,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Client/Employee view — their own request (caller already filtered by clientId/employeeId), no need to repeat their own identity. */
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
