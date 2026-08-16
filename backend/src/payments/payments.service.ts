import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /** ADMIN records a payment — money IN from a client, or money OUT to a fabricant. */
  async create(dto: CreatePaymentDto) {
    if (!!dto.clientId === !!dto.fabricantId) {
      throw new BadRequestException('Un paiement doit concerner soit un client, soit un fournisseur (jamais les deux).');
    }
    return dto.clientId ? this.createClientPayment(dto) : this.createFabricantPayment(dto);
  }

  /** Money IN — settles part of the client's crédit balance, and the order's montantPaye if linked. */
  private async createClientPayment(dto: CreatePaymentDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client introuvable.');

    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, clientId: dto.clientId, deletedAt: null } });
      if (!order) throw new NotFoundException('Commande introuvable pour ce client.');
    }

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
        where: { id: dto.clientId! },
        data: { soldeCredit: this.clampedDecrement(client.soldeCredit, dto.montant) },
      }),
      ...(dto.orderId
        ? [this.prisma.order.update({ where: { id: dto.orderId }, data: { montantPaye: { increment: dto.montant } } })]
        : []),
    ]);

    return payment;
  }

  /** Money OUT — settles part of what's owed to the fabricant for a bon de réception, if linked. */
  private async createFabricantPayment(dto: CreatePaymentDto) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fournisseur introuvable.');

    if (dto.stockReceiptId) {
      const receipt = await this.prisma.stockReceipt.findFirst({
        where: { id: dto.stockReceiptId, fabricantId: dto.fabricantId, deletedAt: null },
      });
      if (!receipt) throw new NotFoundException('Bon de réception introuvable pour ce fournisseur.');
    }

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          fabricantId: dto.fabricantId,
          stockReceiptId: dto.stockReceiptId,
          montant: dto.montant,
          method: dto.method,
          status: 'VALIDE',
        },
      }),
      ...(dto.stockReceiptId
        ? [
            this.prisma.stockReceipt.update({
              where: { id: dto.stockReceiptId },
              data: { montantPaye: { increment: dto.montant } },
            }),
          ]
        : []),
    ]);

    return payment;
  }

  async findAllForClient(clientId: string) {
    return this.prisma.payment.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  async findAllForAdmin(clientId?: string, fabricantId?: string) {
    return this.prisma.payment.findMany({
      where: { ...(clientId ? { clientId } : {}), ...(fabricantId ? { fabricantId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  private clampedDecrement(current: Prisma.Decimal, amount: number) {
    const next = current.minus(amount);
    return next.lessThan(0) ? new Prisma.Decimal(0) : next;
  }
}
