import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /** ADMIN records a payment received from a client — settles part of their crédit balance. */
  async create(dto: CreatePaymentDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client introuvable.');

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          clientId: dto.clientId,
          orderId: dto.orderId,
          montant: dto.montant,
          method: dto.method,
          status: 'VALIDE',
        },
      }),
      this.prisma.client.update({
        where: { id: dto.clientId },
        data: { soldeCredit: this.clampedDecrement(client.soldeCredit, dto.montant) },
      }),
    ]);

    return payment;
  }

  async findAllForClient(clientId: string) {
    return this.prisma.payment.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  async findAllForAdmin(clientId?: string) {
    return this.prisma.payment.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  private clampedDecrement(current: Prisma.Decimal, amount: number) {
    const next = current.minus(amount);
    return next.lessThan(0) ? new Prisma.Decimal(0) : next;
  }
}
