import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { toAdminClientDTO, toSelfClientDTO } from './dto/client-response.dto';

const CLIENT_INCLUDE_USER = {
  user: { select: { email: true, phone: true, status: true } },
} as const;

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Cet email est déjà utilisé.');
    }
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existingPhone) throw new ConflictException('Ce téléphone est déjà utilisé.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const client = await this.prisma.client.create({
      data: {
        raisonSociale: dto.raisonSociale,
        telephone: dto.telephone,
        adresse: dto.adresse,
        ville: dto.ville,
        limiteCredit: dto.limiteCredit ?? 0,
        notesInternes: dto.notesInternes,
        user: {
          create: {
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: 'CLIENT',
            status: 'ACTIVE',
          },
        },
      },
      include: CLIENT_INCLUDE_USER,
    });

    return toAdminClientDTO(client);
  }

  async findAllForAdmin() {
    const clients = await this.prisma.client.findMany({
      include: CLIENT_INCLUDE_USER,
      orderBy: { raisonSociale: 'asc' },
    });
    return clients.map(toAdminClientDTO);
  }

  async findOneForAdmin(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: CLIENT_INCLUDE_USER,
    });
    if (!client) throw new NotFoundException('Client introuvable.');
    return toAdminClientDTO(client);
  }

  /** Client fetching their own profile — `clientId` always comes from the JWT, never from a request param. */
  async findSelf(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: CLIENT_INCLUDE_USER,
    });
    if (!client) throw new NotFoundException('Profil introuvable.');
    return toSelfClientDTO(client);
  }

  async setStatus(clientId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable.');
    await this.prisma.user.update({ where: { id: client.userId }, data: { status } });
    return this.findOneForAdmin(clientId);
  }
}
