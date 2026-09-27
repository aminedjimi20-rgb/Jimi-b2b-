import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ActivityItem =
  | { type: 'note'; id: string; text: string; createdAt: Date; voidedAt: Date | null }
  | { type: 'sale_voucher'; id: string; number: string | null; status: string; createdAt: Date }
  | { type: 'purchase_voucher'; id: string; number: string | null; status: string; createdAt: Date };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calendrier complet d'un employé — même forme pour sa propre vue et pour celle de l'administrateur (elles doivent être identiques). */
  getCalendar(userId: string) {
    return this.prisma.attendance.findMany({
      where: { userId },
      include: { confirmedBy: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Cocher est idempotent (recocher un jour déjà coché ne fait rien) —
  // seul le jour civil compte, jamais un jour futur (on ne pointe pas par avance).
  async mark(userId: string, date: string) {
    if (date > today()) throw new BadRequestException('Impossible de cocher un jour futur');
    return this.prisma.attendance.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
    });
  }

  async unmark(userId: string, date: string) {
    const existing = await this.prisma.attendance.findUnique({ where: { userId_date: { userId, date } } });
    if (!existing) return;
    if (existing.confirmedAt) throw new BadRequestException('Ce jour est déjà confirmé par l\'administrateur — impossible de le décocher');
    await this.prisma.attendance.delete({ where: { id: existing.id } });
  }

  async confirm(adminId: string, userId: string, date: string) {
    const existing = await this.prisma.attendance.findUnique({ where: { userId_date: { userId, date } } });
    if (!existing) throw new NotFoundException("Ce jour n'a pas été coché par l'employé");
    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: { confirmedAt: new Date(), confirmedById: adminId },
      include: { confirmedBy: { select: { fullName: true } } },
    });
  }

  async unconfirm(userId: string, date: string) {
    const existing = await this.prisma.attendance.findUnique({ where: { userId_date: { userId, date } } });
    if (!existing) throw new NotFoundException('Jour introuvable');
    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: { confirmedAt: null, confirmedById: null },
    });
  }

  async setHidden(id: string, hidden: boolean) {
    const existing = await this.prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Jour introuvable');
    return this.prisma.attendance.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
  }

  /** Variante en libre-service : un employé ne peut cacher qu'un jour de son propre calendrier. */
  async setHiddenMine(userId: string, id: string, hidden: boolean) {
    const existing = await this.prisma.attendance.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Jour introuvable');
    return this.setHidden(id, hidden);
  }

  async addNote(userId: string, text: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Employé introuvable');
    return this.prisma.employeeNote.create({ data: { userId, text, createdById: actorId } });
  }

  async voidNote(noteId: string, voided: boolean) {
    const note = await this.prisma.employeeNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Remarque introuvable');
    return this.prisma.employeeNote.update({ where: { id: noteId }, data: { voidedAt: voided ? new Date() : null } });
  }

  // Fil combiné : remarques manuelles + actions déjà tracées automatiquement
  // (bons créés) — pas besoin d'écrire "j'ai servi 2 clients", le bon
  // apparaît tout seul dès qu'il est créé.
  async getActivity(userId: string): Promise<ActivityItem[]> {
    const [notes, saleVouchers, purchaseVouchers] = await Promise.all([
      this.prisma.employeeNote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.salesVoucher.findMany({
        where: { sellerId: userId, deletedAt: null },
        select: { id: true, number: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseVoucher.findMany({
        where: { buyerId: userId, deletedAt: null },
        select: { id: true, number: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items: ActivityItem[] = [
      ...notes.map((n) => ({ type: 'note' as const, id: n.id, text: n.text, createdAt: n.createdAt, voidedAt: n.voidedAt })),
      ...saleVouchers.map((v) => ({ type: 'sale_voucher' as const, id: v.id, number: v.number, status: v.status, createdAt: v.createdAt })),
      ...purchaseVouchers.map((v) => ({ type: 'purchase_voucher' as const, id: v.id, number: v.number, status: v.status, createdAt: v.createdAt })),
    ];

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
