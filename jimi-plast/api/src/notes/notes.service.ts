import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  list(authorId: string, params: { q?: string; includeHidden?: boolean } = {}) {
    const { q, includeHidden } = params;
    return this.prisma.note.findMany({
      where: {
        authorId,
        ...(includeHidden ? {} : { hiddenAt: null }),
        ...(q ? { text: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(authorId: string, text: string) {
    return this.prisma.note.create({ data: { authorId, text } });
  }

  async setHidden(id: string, authorId: string, hidden: boolean) {
    const note = await this.prisma.note.findFirst({ where: { id, authorId } });
    if (!note) throw new NotFoundException('Note introuvable');
    return this.prisma.note.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
  }
}
