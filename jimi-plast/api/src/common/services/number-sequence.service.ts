import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Numérotation centralisée (§38/§51 du cahier des charges) : BL-2026-000001,
 * ACH-2026-000001, RET-2026-000001, PAY-2026-000001... Un seul service pour
 * tous les types de document, jamais un compteur réinventé module par module.
 * L'incrémentation passe par une transaction pour rester correcte même avec
 * plusieurs bons créés en même temps.
 */
@Injectable()
export class NumberSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(prefix: string, date: Date = new Date()): Promise<string> {
    const year = date.getFullYear();

    const sequence = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.numberSequence.findUnique({
        where: { key_year: { key: prefix, year } },
      });

      if (existing) {
        return tx.numberSequence.update({
          where: { key_year: { key: prefix, year } },
          data: { lastNumber: { increment: 1 } },
        });
      }

      return tx.numberSequence.create({
        data: { key: prefix, year, lastNumber: 1 },
      });
    });

    return `${prefix}-${year}-${String(sequence.lastNumber).padStart(6, '0')}`;
  }
}
