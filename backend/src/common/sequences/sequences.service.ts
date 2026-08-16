import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SequencesService {
  constructor(private prisma: PrismaService) {}

  /** Atomically returns the next value for `key` (e.g. "BC-2026"), starting at 1. */
  async next(key: string): Promise<number> {
    const seq = await this.prisma.sequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return seq.value;
  }
}
