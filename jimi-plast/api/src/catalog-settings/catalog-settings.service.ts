import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unités de conditionnement et niveaux de prix : listes de référence
 * administrables, jamais codées en dur dans le reste de l'application.
 */
@Injectable()
export class CatalogSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  listPackagingUnits() {
    return this.prisma.packagingUnit.findMany({ orderBy: { key: 'asc' } });
  }

  listPriceTierTypes() {
    return this.prisma.priceTierType.findMany({ orderBy: { sortOrder: 'asc' } });
  }
}
