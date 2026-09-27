import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ActivityItem =
  | { type: 'note'; id: string; text: string; createdAt: Date; voidedAt: Date | null }
  | { type: 'sale_voucher'; id: string; number: string | null; status: string; createdAt: Date }
  | { type: 'purchase_voucher'; id: string; number: string | null; status: string; createdAt: Date };

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(userId: string) {
    const open = await this.getOpenAttendance(userId);
    if (open) throw new BadRequestException('Déjà pointé — pensez à pointer la sortie avant de repointer');
    return this.prisma.attendance.create({ data: { userId } });
  }

  async clockOut(userId: string) {
    const open = await this.getOpenAttendance(userId);
    if (!open) throw new BadRequestException("Aucun pointage d'entrée ouvert");
    return this.prisma.attendance.update({ where: { id: open.id }, data: { clockOutAt: new Date() } });
  }

  getOpenAttendance(userId: string) {
    return this.prisma.attendance.findFirst({
      where: { userId, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
    });
  }

  listAttendance(userId: string) {
    return this.prisma.attendance.findMany({ where: { userId }, orderBy: { clockInAt: 'desc' } });
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
