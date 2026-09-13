import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrashService } from '../common/services/trash.service';
import { CreateBesoinDto } from './dto/create-besoin.dto';
import { RespondBesoinDto } from './dto/respond-besoin.dto';

@Injectable()
export class BesoinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly trash: TrashService,
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
    return this.prisma.besoin.findMany({ where: { authorId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  all(includeHidden = false) {
    return this.prisma.besoin.findMany({
      where: { deletedAt: null, ...(includeHidden ? {} : { hiddenAt: null }) },
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

  async hide(id: string) {
    const besoin = await this.prisma.besoin.findUnique({ where: { id } });
    if (!besoin || besoin.deletedAt) throw new NotFoundException('Besoin introuvable');
    return this.prisma.besoin.update({ where: { id }, data: { hiddenAt: new Date() } });
  }

  async unhide(id: string) {
    const besoin = await this.prisma.besoin.findUnique({ where: { id } });
    if (!besoin || besoin.deletedAt) throw new NotFoundException('Besoin introuvable');
    return this.prisma.besoin.update({ where: { id }, data: { hiddenAt: null } });
  }

  async remove(id: string, actorId: string) {
    const besoin = await this.prisma.besoin.findUnique({ where: { id } });
    if (!besoin) throw new NotFoundException('Besoin introuvable');

    await this.prisma.besoin.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'Besoin',
      entityId: id,
      snapshot: besoin as unknown as Record<string, unknown>,
      deletedById: actorId,
    });

    return { id };
  }
}
