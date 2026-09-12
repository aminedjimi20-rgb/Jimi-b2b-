import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBesoinDto } from './dto/create-besoin.dto';
import { RespondBesoinDto } from './dto/respond-besoin.dto';

@Injectable()
export class BesoinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(authorId: string, authorName: string, dto: CreateBesoinDto) {
    const besoin = await this.prisma.besoin.create({ data: { authorId, message: dto.message } });

    await this.notifications.notify({
      type: 'besoin.new',
      title: 'Nouveau besoin signalé',
      body: `${authorName} : ${dto.message}`,
      data: { besoinId: besoin.id },
    });

    return besoin;
  }

  mine(authorId: string) {
    return this.prisma.besoin.findMany({ where: { authorId }, orderBy: { createdAt: 'desc' } });
  }

  all() {
    return this.prisma.besoin.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { fullName: true, role: { select: { name: true, key: true } } } } },
    });
  }

  async respond(id: string, responderId: string, dto: RespondBesoinDto) {
    const besoin = await this.prisma.besoin.findUnique({ where: { id } });
    if (!besoin) throw new NotFoundException('Besoin introuvable');

    const updated = await this.prisma.besoin.update({
      where: { id },
      data: { response: dto.response, respondedById: responderId, respondedAt: new Date() },
    });

    await this.notifications.notify({
      type: 'besoin.responded',
      title: 'Réponse à votre besoin',
      body: dto.response,
      data: { besoinId: id, userId: besoin.authorId },
    });

    return updated;
  }
}
