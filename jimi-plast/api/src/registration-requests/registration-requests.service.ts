import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegistrationStatus } from '@prisma/client';
import { AcceptRegistrationRequestDto } from './dto/accept-request.dto';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class RegistrationRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(status?: RegistrationStatus) {
    const requests = await this.prisma.registrationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    // Ne jamais renvoyer le hash, même à l'admin.
    return requests.map(({ passwordHash, ...rest }) => rest);
  }

  private async findOrThrow(id: string) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');
    if (request.status !== 'NEW' && request.status !== 'INFO_REQUESTED') {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }
    return request;
  }

  async accept(id: string, dto: AcceptRegistrationRequestDto, actorId: string) {
    const request = await this.findOrThrow(id);

    const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
    if (!role) throw new BadRequestException(`Rôle "${dto.roleKey}" inconnu`);
    if (role.key === 'admin') throw new BadRequestException('Impossible de créer un ADMIN depuis une demande');

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(request.email ? [{ email: request.email }] : []),
          ...(request.phone ? [{ phone: request.phone }] : []),
        ],
      },
    });
    if (existingUser) throw new ConflictException('Un compte existe déjà avec cet email ou ce téléphone');

    // Le demandeur a pu choisir son propre mot de passe à l'inscription
    // (auto-inscription) — sinon l'admin doit en fournir un ici.
    if (!request.passwordHash && !dto.initialPassword) {
      throw new BadRequestException('Un mot de passe initial est requis pour ce compte');
    }
    const passwordHash = request.passwordHash ?? (await bcrypt.hash(dto.initialPassword as string, PASSWORD_SALT_ROUNDS));

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: request.email,
          phone: request.phone,
          fullName: request.fullName,
          passwordHash,
          roleId: role.id,
          status: 'ACTIVE',
        },
      });

      await tx.registrationRequest.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote,
          createdUserId: created.id,
        },
      });

      // Rôle fabricant => fiche fabricant créée et liée au compte ; tout
      // autre rôle commercial (sauf admin/employee) => dossier client créé
      // automatiquement avec les informations déjà fournies dans la demande.
      if (role.key === 'manufacturer') {
        await tx.manufacturer.create({
          data: {
            userId: created.id,
            name: request.businessName || request.fullName,
            company: request.businessName,
            contactName: request.fullName,
            phone: request.phone,
            email: request.email,
            address: request.address,
            wilaya: request.wilaya,
          },
        });
      } else if (role.key !== 'employee') {
        await tx.customer.create({
          data: {
            userId: created.id,
            businessName: request.businessName,
            address: request.address,
            wilaya: request.wilaya,
          },
        });
      }

      return created;
    });

    await this.auditLog.record({
      entityType: 'RegistrationRequest',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: request.status,
      newValue: 'ACCEPTED',
      actorId,
    });

    await this.notifications.notify({
      type: 'registration.accepted',
      title: 'Demande acceptée',
      body: `${request.fullName} a été accepté(e) en tant que ${role.name}.`,
      data: { requestId: id, userId: user.id },
    });

    return { user: { id: user.id, email: user.email, fullName: user.fullName } };
  }

  async reject(id: string, reviewNote: string, actorId: string) {
    const request = await this.findOrThrow(id);

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: actorId, reviewedAt: new Date(), reviewNote },
    });

    await this.auditLog.record({
      entityType: 'RegistrationRequest',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: request.status,
      newValue: 'REJECTED',
      reason: reviewNote,
      actorId,
    });

    return { id, status: 'REJECTED' };
  }

  async requestInfo(id: string, reviewNote: string, actorId: string) {
    const request = await this.findOrThrow(id);

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'INFO_REQUESTED', reviewedById: actorId, reviewedAt: new Date(), reviewNote },
    });

    await this.auditLog.record({
      entityType: 'RegistrationRequest',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: request.status,
      newValue: 'INFO_REQUESTED',
      reason: reviewNote,
      actorId,
    });

    return { id, status: 'INFO_REQUESTED' };
  }
}
