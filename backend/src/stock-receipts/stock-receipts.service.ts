import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../common/sequences/sequences.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { CreateBonEntreeDto } from './dto/create-bon-entree.dto';
import { ConfirmBonEntreeDto } from './dto/confirm-bon-entree.dto';
import { EditStockReceiptDto } from './dto/edit-stock-receipt.dto';
import { toStockReceiptDTO, toEmployeeStockReceiptDTO } from './dto/stock-receipt-response.dto';

const RECEIPT_INCLUDE = {
  fabricant: true,
  employee: { select: { nom: true } },
  transporteur: { select: { nom: true } },
  items: { include: { product: { include: { images: true } } } },
} as const;

@Injectable()
export class StockReceiptsService {
  constructor(
    private prisma: PrismaService,
    private sequences: SequencesService,
  ) {}

  // ── ADMIN ────────────────────────────────────────────────────────────
  // Comportement historique inchangé : toujours créé CONFIRMEE, stock/coût
  // appliqués immédiatement — voir createDraftForEmployee pour le workflow
  // brouillon (Phase 38), réservé aux bons créés par un Employé.

  async create(dto: CreateStockReceiptDto) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });
    if (products.length !== dto.items.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const remise = dto.remisePourcentage;
    const reference = await this.generateReference();
    const { itemsData, total, totalAchat } = this.buildItemsData(dto.items, remise, productById);

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({
        data: {
          reference,
          fabricantId: dto.fabricantId,
          notes: dto.notes,
          remisePourcentage: remise,
          status: 'CONFIRMEE',
          total,
          totalAchat,
          items: { create: itemsData.map(({ prixAchatReel: _prixAchatReel, ...rest }) => rest) },
        },
      });

      await this.applyStockAndCostSync(tx, created.id, reference, fabricant.nom, itemsData, productById, remise);

      return created;
    });

    return this.findOne(receipt.id);
  }

  async findAll() {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { deletedAt: null },
      include: RECEIPT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return receipts.map(toStockReceiptDTO);
  }

  async findOne(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    return toStockReceiptDTO(receipt);
  }

  /** Correction d'un bon déjà CONFIRMEE — recalcule le delta de stock/coût réel par article, comme OrdersService.adminUpdateItems. */
  async adminEditConfirmed(id: string, dto: EditStockReceiptDto) {
    return this.editConfirmed(id, dto, null);
  }

  async getHistory(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    const logs = await this.prisma.stockReceiptChangeLog.findMany({ where: { stockReceiptId: id }, orderBy: { createdAt: 'desc' } });
    return logs.map((l) => ({ id: l.id, summary: l.summary, createdAt: l.createdAt }));
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Workflow BROUILLON → CONFIRMEE (Phase 38) : un bon créé par un Employé
  // ne touche JAMAIS le stock ni le solde fournisseur tant qu'il n'est pas
  // confirmé — voir confirmForEmployee.

  async createDraftForEmployee(employeeId: string, dto: CreateBonEntreeDto) {
    const employee = await this.assertCanCreateBonEntree(employeeId);

    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');
    if (dto.transporteurId) await this.assertTransporteurExists(dto.transporteurId);

    const products = await this.prisma.product.findMany({ where: { id: { in: dto.items.map((i) => i.productId) } } });
    if (products.length !== dto.items.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const remise = dto.remisePourcentage;
    const reference = await this.generateReference();
    const { itemsData, total, totalAchat } = this.buildEmployeeItemsData(dto.items, remise, productById, employee.canModifierPrixAchat);

    const receipt = await this.prisma.stockReceipt.create({
      data: {
        reference,
        fabricantId: dto.fabricantId,
        employeeId,
        numeroBonFournisseur: dto.numeroBonFournisseur,
        notes: dto.notes,
        remisePourcentage: remise,
        transporteurId: dto.transporteurId,
        destination: dto.destination,
        fraisLivraison: dto.fraisLivraison ?? 0,
        status: 'BROUILLON',
        total,
        totalAchat,
        items: { create: itemsData.map(({ prixAchatReel: _prixAchatReel, ...rest }) => rest) },
      },
    });

    return this.findOneForEmployee(employeeId, receipt.id);
  }

  async updateDraftForEmployee(employeeId: string, id: string, dto: CreateBonEntreeDto) {
    const employee = await this.assertCanCreateBonEntree(employeeId);
    const receipt = await this.getOwnDraft(employeeId, id);

    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');
    if (dto.transporteurId) await this.assertTransporteurExists(dto.transporteurId);

    const products = await this.prisma.product.findMany({ where: { id: { in: dto.items.map((i) => i.productId) } } });
    if (products.length !== dto.items.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const remise = dto.remisePourcentage;
    const { itemsData, total, totalAchat } = this.buildEmployeeItemsData(dto.items, remise, productById, employee.canModifierPrixAchat);

    await this.prisma.$transaction(async (tx) => {
      await tx.stockReceiptItem.deleteMany({ where: { stockReceiptId: id } });
      await tx.stockReceipt.update({
        where: { id },
        data: {
          fabricantId: dto.fabricantId,
          numeroBonFournisseur: dto.numeroBonFournisseur,
          notes: dto.notes,
          remisePourcentage: remise,
          transporteurId: dto.transporteurId ?? null,
          destination: dto.destination ?? null,
          fraisLivraison: dto.fraisLivraison ?? 0,
          total,
          totalAchat,
          items: { create: itemsData.map(({ prixAchatReel: _prixAchatReel, ...rest }) => rest) },
        },
      });
    });

    return this.findOneForEmployee(employeeId, receipt.id);
  }

  /** BROUILLON → CONFIRMEE : c'est ICI, et seulement ici, que le stock/coût produit/paiement fournisseur sont appliqués. */
  async confirmForEmployee(employeeId: string, id: string, dto: ConfirmBonEntreeDto) {
    await this.assertCanCreateBonEntree(employeeId);
    const receipt = await this.getOwnDraft(employeeId, id);
    const confirmed = await this.confirm(receipt.id, dto);
    return this.findOneForEmployee(employeeId, confirmed.id);
  }

  /** Admin confirme directement un brouillon (créé par un Employé) sans restriction de propriété. */
  async confirmForAdmin(id: string, dto: ConfirmBonEntreeDto) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    if (receipt.status !== 'BROUILLON') throw new BadRequestException('Ce bon est déjà confirmé.');
    const confirmed = await this.confirm(id, dto);
    return this.findOne(confirmed.id);
  }

  private async confirm(id: string, dto: ConfirmBonEntreeDto) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true, fabricant: true } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    if (receipt.status !== 'BROUILLON') throw new BadRequestException('Ce bon est déjà confirmé.');

    const products = await this.prisma.product.findMany({ where: { id: { in: receipt.items.map((i) => i.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    const itemsData = receipt.items.map((item) => ({
      productId: item.productId,
      quantite: item.quantite,
      prixAchat: item.prixAchat.toNumber(),
      prixAchatReel: receipt.remisePourcentage
        ? item.prixAchat.mul(new Prisma.Decimal(100).minus(receipt.remisePourcentage)).div(100)
        : item.prixAchat,
    }));

    await this.prisma.$transaction(async (tx) => {
      await this.applyStockAndCostSync(tx, receipt.id, receipt.reference, receipt.fabricant.nom, itemsData, productById, receipt.remisePourcentage?.toNumber());

      const montantPaye = dto.montantPaye ?? 0;
      if (montantPaye > 0) {
        await tx.payment.create({
          data: {
            fabricantId: receipt.fabricantId,
            stockReceiptId: receipt.id,
            montant: montantPaye,
            method: dto.method ?? 'ESPECES',
            status: 'VALIDE',
          },
        });
      }

      await tx.stockReceipt.update({
        where: { id: receipt.id },
        data: { status: 'CONFIRMEE', montantPaye: { increment: montantPaye } },
      });

      await tx.stockReceiptChangeLog.create({
        data: { stockReceiptId: receipt.id, summary: `Bon confirmé — stock mis à jour${montantPaye > 0 ? ` · Payé: ${montantPaye} DA` : ''}.` },
      });
    });

    return receipt;
  }

  async findAllForEmployee(employeeId: string) {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { employeeId, deletedAt: null },
      include: RECEIPT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const canVoirPrixVente = await this.getCanVoirPrixVente(employeeId);
    return receipts.map((r) => toEmployeeStockReceiptDTO(r, canVoirPrixVente));
  }

  async findOneForEmployee(employeeId: string, id: string) {
    const receipt = await this.prisma.stockReceipt.findFirst({ where: { id, employeeId, deletedAt: null }, include: RECEIPT_INCLUDE });
    if (!receipt) throw new NotFoundException('Bon de réception introuvable.');
    const canVoirPrixVente = await this.getCanVoirPrixVente(employeeId);
    return toEmployeeStockReceiptDTO(receipt, canVoirPrixVente);
  }

  /** Annule un brouillon (jamais appliqué au stock, donc rien à reverser) — voir remove() pour le cas CONFIRMEE. */
  async cancelDraftForEmployee(employeeId: string, id: string) {
    await this.getOwnDraft(employeeId, id);
    await this.prisma.stockReceipt.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Correction d'un bon déjà CONFIRMEE — uniquement si l'Admin a accordé canModifierBonApresConfirmation. */
  async editConfirmedForEmployee(employeeId: string, id: string, dto: EditStockReceiptDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee?.canModifierBonApresConfirmation) {
      throw new ForbiddenException("Vous n'avez pas la permission de modifier un bon déjà confirmé.");
    }
    const receipt = await this.prisma.stockReceipt.findFirst({ where: { id, employeeId, deletedAt: null } });
    if (!receipt) throw new NotFoundException('Bon de réception introuvable.');
    await this.editConfirmed(id, dto, employee.canModifierPrixAchat ? null : { forcePrixAchat: true });
    return this.findOneForEmployee(employeeId, id);
  }

  // ── Shared item/stock math ──────────────────────────────────────────

  private buildItemsData(
    items: { productId: string; cartons: number; unitesParCarton: number; prixAchat: number; prixVente: number }[],
    remise: number | undefined,
    productById: Map<string, { prixAchat: Prisma.Decimal }>,
  ) {
    let total = new Prisma.Decimal(0);
    let totalAchat = new Prisma.Decimal(0);
    const itemsData = items.map((item) => {
      const quantite = item.cartons * item.unitesParCarton;
      total = total.plus(new Prisma.Decimal(item.prixVente).mul(quantite));
      totalAchat = totalAchat.plus(new Prisma.Decimal(item.prixAchat).mul(quantite));
      const prixAchatReel = remise
        ? new Prisma.Decimal(item.prixAchat).mul(new Prisma.Decimal(100).minus(remise)).div(100)
        : new Prisma.Decimal(item.prixAchat);
      return {
        productId: item.productId,
        cartons: item.cartons,
        unitesParCarton: item.unitesParCarton,
        quantite,
        prixAchat: item.prixAchat,
        prixVente: item.prixVente,
        prixAchatReel,
      };
    });
    return { itemsData, total, totalAchat };
  }

  /** Same math as buildItemsData but prixVente is never taken from the caller — always the product's own, and prixAchat is forced back to the product's current one unless the employee has canModifierPrixAchat. */
  private buildEmployeeItemsData(
    items: { productId: string; cartons: number; unitesParCarton: number; prixAchat: number }[],
    remise: number | undefined,
    productById: Map<string, { prixAchat: Prisma.Decimal; prixVente: Prisma.Decimal }>,
    canModifierPrixAchat: boolean,
  ) {
    let total = new Prisma.Decimal(0);
    let totalAchat = new Prisma.Decimal(0);
    const itemsData = items.map((item) => {
      const product = productById.get(item.productId)!;
      const quantite = item.cartons * item.unitesParCarton;
      const prixAchat = canModifierPrixAchat ? item.prixAchat : product.prixAchat.toNumber();
      const prixVente = product.prixVente.toNumber();
      total = total.plus(new Prisma.Decimal(prixVente).mul(quantite));
      totalAchat = totalAchat.plus(new Prisma.Decimal(prixAchat).mul(quantite));
      const prixAchatReel = remise
        ? new Prisma.Decimal(prixAchat).mul(new Prisma.Decimal(100).minus(remise)).div(100)
        : new Prisma.Decimal(prixAchat);
      return {
        productId: item.productId,
        cartons: item.cartons,
        unitesParCarton: item.unitesParCarton,
        quantite,
        prixAchat,
        prixVente,
        prixAchatReel,
      };
    });
    return { itemsData, total, totalAchat };
  }

  /** Applies stock increment + StockMovement ENTREE + prixAchat-après-remise sync — the one place stock/cost actually change. */
  private async applyStockAndCostSync(
    tx: Prisma.TransactionClient,
    stockReceiptId: string,
    reference: string,
    fabricantNom: string,
    itemsData: { productId: string; quantite: number; prixAchatReel: Prisma.Decimal }[],
    productById: Map<string, { prixAchat: Prisma.Decimal; prixVente: Prisma.Decimal }>,
    remise: number | undefined,
  ) {
    for (const item of itemsData) {
      await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'ENTREE',
          quantite: item.quantite,
          stockReceiptId,
          motif: `Réception ${reference} — ${fabricantNom}`,
        },
      });

      if (remise) {
        const product = productById.get(item.productId)!;
        if (!product.prixAchat.equals(item.prixAchatReel)) {
          await tx.product.update({ where: { id: item.productId }, data: { prixAchat: item.prixAchatReel } });
          await tx.productPriceHistory.create({
            data: { productId: item.productId, prixAchat: item.prixAchatReel, prixVente: product.prixVente },
          });
        }
      }
    }
  }

  /** Shared by adminEditConfirmed/editConfirmedForEmployee — recomputes the per-product stock delta, exactly like OrdersService.adminUpdateItems. */
  private async editConfirmed(id: string, dto: EditStockReceiptDto, opts: { forcePrixAchat: true } | null) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true, fabricant: true } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    if (receipt.status !== 'CONFIRMEE') throw new BadRequestException('Ce bon doit être confirmé avant de pouvoir être corrigé de cette façon.');

    const oldQtyByProduct = new Map(receipt.items.map((i) => [i.productId, i.quantite]));
    const products = await this.prisma.product.findMany({ where: { id: { in: dto.items.map((i) => i.productId) } } });
    if (products.length !== dto.items.length) throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    const productById = new Map(products.map((p) => [p.id, p]));

    const allProductIds = [...new Set([...oldQtyByProduct.keys(), ...productById.keys()])];
    const allProducts = await this.prisma.product.findMany({ where: { id: { in: allProductIds } }, select: { id: true, nom: true } });
    const nameByProduct = new Map(allProducts.map((p) => [p.id, p.nom]));

    // Prisma silently ignores an `undefined` field in `data`, so when the
    // caller omits remisePourcentage the persisted value on `receipt` is
    // left untouched — the math here must fall back to that same persisted
    // value, otherwise the prixAchat resync below would wrongly treat an
    // unchanged remise as "no remise" and skip updating Product.prixAchat.
    const remise = dto.remisePourcentage ?? receipt.remisePourcentage?.toNumber();
    let total = new Prisma.Decimal(0);
    let totalAchat = new Prisma.Decimal(0);
    const newQtyByProduct = new Map<string, number>();
    const itemsData = dto.items.map((item) => {
      const quantite = item.cartons * item.unitesParCarton;
      const prixAchat = opts?.forcePrixAchat ? productById.get(item.productId)!.prixAchat.toNumber() : item.prixAchat;
      total = total.plus(new Prisma.Decimal(item.prixVente).mul(quantite));
      totalAchat = totalAchat.plus(new Prisma.Decimal(prixAchat).mul(quantite));
      newQtyByProduct.set(item.productId, quantite);
      const prixAchatReel = remise
        ? new Prisma.Decimal(prixAchat).mul(new Prisma.Decimal(100).minus(remise)).div(100)
        : new Prisma.Decimal(prixAchat);
      return { productId: item.productId, cartons: item.cartons, unitesParCarton: item.unitesParCarton, quantite, prixAchat, prixVente: item.prixVente, prixAchatReel };
    });

    const changes: string[] = [];
    const productIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

    await this.prisma.$transaction(async (tx) => {
      for (const productId of productIds) {
        const oldQty = oldQtyByProduct.get(productId) ?? 0;
        const newQty = newQtyByProduct.get(productId) ?? 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;

        const nom = nameByProduct.get(productId) ?? productId;
        if (oldQty === 0) changes.push(`+ ${nom} (qté ${newQty})`);
        else if (newQty === 0) changes.push(`- ${nom} (retiré, était ${oldQty})`);
        else changes.push(`${nom}: ${oldQty} → ${newQty}`);

        await tx.product.update({ where: { id: productId }, data: { stockReel: { increment: delta } } });
        await tx.stockMovement.create({
          data: { productId, type: 'AJUSTEMENT', quantite: Math.abs(delta), stockReceiptId: id, motif: `Modification ${receipt.reference}` },
        });
      }

      if (remise) {
        for (const item of itemsData) {
          const product = productById.get(item.productId)!;
          if (!product.prixAchat.equals(item.prixAchatReel)) {
            await tx.product.update({ where: { id: item.productId }, data: { prixAchat: item.prixAchatReel } });
            await tx.productPriceHistory.create({
              data: { productId: item.productId, prixAchat: item.prixAchatReel, prixVente: product.prixVente },
            });
          }
        }
      }

      if (!receipt.totalAchat.equals(totalAchat)) {
        changes.push(`Sous-total achat: ${receipt.totalAchat} → ${totalAchat} DA`);
      }

      await tx.stockReceiptItem.deleteMany({ where: { stockReceiptId: id } });
      await tx.stockReceipt.update({
        where: { id },
        data: {
          numeroBonFournisseur: dto.numeroBonFournisseur,
          notes: dto.notes,
          remisePourcentage: remise,
          transporteurId: dto.transporteurId ?? null,
          destination: dto.destination ?? null,
          fraisLivraison: dto.fraisLivraison ?? 0,
          total,
          totalAchat,
          items: { create: itemsData.map(({ prixAchatReel: _prixAchatReel, ...rest }) => rest) },
        },
      });

      if (changes.length > 0) {
        await tx.stockReceiptChangeLog.create({ data: { stockReceiptId: id, summary: changes.join(' · ') } });
      }
    });

    return receipt;
  }

  // ── Permission/ownership guards ─────────────────────────────────────

  private async assertCanCreateBonEntree(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee?.canCreateBonEntree) {
      throw new ForbiddenException("Vous n'avez pas la permission de créer un bon d'entrée.");
    }
    return employee;
  }

  private async getOwnDraft(employeeId: string, id: string) {
    const receipt = await this.prisma.stockReceipt.findFirst({ where: { id, employeeId, deletedAt: null } });
    if (!receipt) throw new NotFoundException('Bon de réception introuvable.');
    if (receipt.status !== 'BROUILLON') throw new BadRequestException('Ce bon est déjà confirmé.');
    return receipt;
  }

  private async assertTransporteurExists(id: string) {
    const t = await this.prisma.transporteur.findUnique({ where: { id } });
    if (!t || t.deletedAt) throw new NotFoundException('Transporteur introuvable.');
  }

  private async getCanVoirPrixVente(employeeId: string): Promise<boolean> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { canVoirPrixVente: true } });
    return employee?.canVoirPrixVente ?? false;
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { deletedAt: { not: null } },
      include: RECEIPT_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
    return receipts.map(toStockReceiptDTO);
  }

  // Moves to the corbeille. Only a CONFIRMEE receipt has ever touched real
  // stock — a BROUILLON never did, so reversing it here would wrongly
  // decrement stock it never added (see Phase 38: draft ≠ applied).
  async remove(id: string) {
    const receipt = await this.getActiveWithItems(id);
    await this.prisma.$transaction(async (tx) => {
      if (receipt.status === 'CONFIRMEE') {
        for (const item of receipt.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockReel: { decrement: item.quantite } } });
        }
      }
      await tx.stockReceipt.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // Restores from the corbeille — symmetric with `remove`: only re-applies
  // stock if the receipt was CONFIRMEE (a restored draft is still a draft).
  async restore(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!receipt || !receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable dans la corbeille.');

    await this.prisma.$transaction(async (tx) => {
      if (receipt.status === 'CONFIRMEE') {
        for (const item of receipt.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
        }
      }
      await tx.stockReceipt.update({ where: { id }, data: { deletedAt: null } });
    });
  }

  async permanentDelete(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt || !receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.stockReceipt.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des paiements sont encore enregistrés sur ce bon.',
    );
  }

  private async getActiveWithItems(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    return receipt;
  }

  /** Human-readable, sequential, unique per year: BR-2026-0001, BR-2026-0002, ... */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const n = await this.sequences.next(`BR-${year}`);
    return `BR-${year}-${String(n).padStart(4, '0')}`;
  }
}
