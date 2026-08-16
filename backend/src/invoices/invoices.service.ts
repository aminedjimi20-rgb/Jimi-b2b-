import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../common/sequences/sequences.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { toAdminInvoiceDTO, toClientInvoiceDTO } from './dto/invoice-response.dto';

const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, nom: true, code: true, images: { select: { url: true, isPrimary: true } } } },
    },
  },
  client: { select: { raisonSociale: true, telephone: true } },
  transporteur: { select: { nom: true } },
  employee: { select: { nom: true } },
} as const;

const INVOICE_INCLUDE = { order: { include: ORDER_INCLUDE } } as const;

const NOT_INVOICEABLE_STATUSES = new Set(['EN_ATTENTE', 'ANNULEE']);

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private sequences: SequencesService,
  ) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  /** Idempotent: re-generating for the same order returns the existing invoice instead of duplicating it. */
  async generateFromOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.deletedAt) throw new NotFoundException('Commande introuvable.');
    if (NOT_INVOICEABLE_STATUSES.has(order.status)) {
      throw new BadRequestException('Une facture ne peut être générée que pour une commande confirmée (pas en attente ni annulée).');
    }

    const existing = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (existing && !existing.deletedAt) {
      const full = await this.prisma.invoice.findUniqueOrThrow({ where: { id: existing.id }, include: INVOICE_INCLUDE });
      return toAdminInvoiceDTO(full);
    }

    const year = new Date().getFullYear();
    const n = await this.sequences.next(`FAC-${year}`);
    const reference = `FAC-${year}-${String(n).padStart(4, '0')}`;

    const invoice = existing
      ? await this.prisma.invoice.update({
          where: { id: existing.id },
          data: { deletedAt: null, reference, total: order.total },
          include: INVOICE_INCLUDE,
        })
      : await this.prisma.invoice.create({
          data: { reference, orderId, clientId: order.clientId, total: order.total },
          include: INVOICE_INCLUDE,
        });

    return toAdminInvoiceDTO(invoice);
  }

  async findAllForAdmin() {
    const invoices = await this.prisma.invoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: INVOICE_INCLUDE,
    });
    return invoices.map(toAdminInvoiceDTO);
  }

  async findOneForAdmin(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice || invoice.deletedAt) throw new NotFoundException('Facture introuvable.');
    return toAdminInvoiceDTO(invoice);
  }

  // ── CLIENT ───────────────────────────────────────────────────────────

  async findAllForClient(clientId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { deletedAt: null, clientId },
      orderBy: { createdAt: 'desc' },
      include: INVOICE_INCLUDE,
    });
    return invoices.map(toClientInvoiceDTO);
  }

  async findOneForClient(clientId: string, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice || invoice.deletedAt || invoice.clientId !== clientId) throw new NotFoundException('Facture introuvable.');
    return toClientInvoiceDTO(invoice);
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const invoices = await this.prisma.invoice.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: INVOICE_INCLUDE,
    });
    return invoices.map(toAdminInvoiceDTO);
  }

  async remove(id: string) {
    await this.assertActiveExists(id);
    await this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || !invoice.deletedAt) throw new NotFoundException('Facture introuvable dans la corbeille.');
    await this.prisma.invoice.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || !invoice.deletedAt) throw new NotFoundException('Facture introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.invoice.delete({ where: { id } }),
      'Impossible de supprimer définitivement cette facture.',
    );
  }

  private async assertActiveExists(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.deletedAt) throw new NotFoundException('Facture introuvable.');
  }
}
