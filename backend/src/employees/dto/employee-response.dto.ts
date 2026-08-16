import { Employee, User } from '@prisma/client';

type EmployeeWithUser = Employee & { user: Pick<User, 'email' | 'phone' | 'status'> };

/** Allow-list mapper — never leaks passwordHash. */
export function toAdminEmployeeDTO(employee: EmployeeWithUser) {
  return {
    id: employee.id,
    nom: employee.nom,
    telephone: employee.telephone,
    email: employee.user.email,
    phone: employee.user.phone,
    status: employee.user.status,
    canSeeClientPhone: employee.canSeeClientPhone,
    canSeeClientAddress: employee.canSeeClientAddress,
    canCreateBonEntree: employee.canCreateBonEntree,
    canModifierPrixAchat: employee.canModifierPrixAchat,
    canVoirPrixVente: employee.canVoirPrixVente,
    canCreerProduit: employee.canCreerProduit,
    canCreerFournisseur: employee.canCreerFournisseur,
    canModifierProduit: employee.canModifierProduit,
    canModifierBonApresConfirmation: employee.canModifierBonApresConfirmation,
    createdAt: employee.createdAt,
  };
}

export type AdminEmployeeDTO = ReturnType<typeof toAdminEmployeeDTO>;
