import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { toAdminEmployeeDTO } from './dto/employee-response.dto';

const EMPLOYEE_INCLUDE_USER = { user: { select: { email: true, phone: true, status: true } } } as const;

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Cet email est déjà utilisé.');
    }
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existingPhone) throw new ConflictException('Ce téléphone est déjà utilisé.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const employee = await this.prisma.employee.create({
      data: {
        nom: dto.nom,
        telephone: dto.telephone,
        user: {
          create: {
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: 'EMPLOYEE',
            status: 'ACTIVE',
          },
        },
      },
      include: EMPLOYEE_INCLUDE_USER,
    });

    return toAdminEmployeeDTO(employee);
  }

  async findAllForAdmin() {
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      include: EMPLOYEE_INCLUDE_USER,
      orderBy: { nom: 'asc' },
    });
    return employees.map(toAdminEmployeeDTO);
  }

  async findOneForAdmin(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: EMPLOYEE_INCLUDE_USER });
    if (!employee || employee.deletedAt) throw new NotFoundException('Employé introuvable.');
    return toAdminEmployeeDTO(employee);
  }

  /**
   * An Employee reading their own granted permissions — purely a UX
   * convenience (show/hide the "Bon d'entrée" entry point etc). The real
   * enforcement always happens server-side in each service, never here.
   */
  async findMyPermissions(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        canSeeClientPhone: true,
        canSeeClientAddress: true,
        canCreateBonEntree: true,
        canModifierPrixAchat: true,
        canVoirPrixVente: true,
        canCreerProduit: true,
        canCreerFournisseur: true,
        canModifierProduit: true,
        canModifierBonApresConfirmation: true,
      },
    });
    if (!employee) throw new NotFoundException('Employé introuvable.');
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.assertActiveExists(id);
    const employee = await this.prisma.employee.update({ where: { id }, data: dto, include: EMPLOYEE_INCLUDE_USER });
    return toAdminEmployeeDTO(employee);
  }

  async setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.deletedAt) throw new NotFoundException('Employé introuvable.');
    await this.prisma.user.update({ where: { id: employee.userId }, data: { status } });
    return this.findOneForAdmin(id);
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: { not: null } },
      include: EMPLOYEE_INCLUDE_USER,
      orderBy: { deletedAt: 'desc' },
    });
    return employees.map(toAdminEmployeeDTO);
  }

  // Trashing an employee also suspends their login — restoring reactivates it.
  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.deletedAt) throw new NotFoundException('Employé introuvable.');
    await this.prisma.$transaction([
      this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.user.update({ where: { id: employee.userId }, data: { status: 'SUSPENDED' } }),
    ]);
  }

  async restore(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.deletedAt) throw new NotFoundException('Employé introuvable dans la corbeille.');
    await this.prisma.$transaction([
      this.prisma.employee.update({ where: { id }, data: { deletedAt: null } }),
      this.prisma.user.update({ where: { id: employee.userId }, data: { status: 'ACTIVE' } }),
    ]);
  }

  async permanentDelete(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.deletedAt) throw new NotFoundException('Employé introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.user.delete({ where: { id: employee.userId } }),
      'Impossible de supprimer définitivement : des commandes sont encore assignées à cet employé.',
    );
  }

  private async assertActiveExists(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.deletedAt) throw new NotFoundException('Employé introuvable.');
  }
}
