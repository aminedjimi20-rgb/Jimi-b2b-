import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateSettings() {
    const existing = await this.prisma.siteBranding.findFirst();
    if (existing) return existing;
    return this.prisma.siteBranding.create({ data: {} });
  }

  async get() {
    const [settings, logos] = await Promise.all([
      this.getOrCreateSettings(),
      this.prisma.partnerLogo.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const { id, updatedAt, ...rest } = settings;
    return { ...rest, logos };
  }

  /** Coordonnées légales seules, pour la génération de la facture. */
  async getCompanyInfo() {
    const settings = await this.getOrCreateSettings();
    return {
      companyLegalName: settings.companyLegalName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyRC: settings.companyRC,
      companyNIF: settings.companyNIF,
      companyNIS: settings.companyNIS,
      companyAI: settings.companyAI,
    };
  }

  async setExperienceYears(experienceYears: number) {
    const settings = await this.getOrCreateSettings();
    await this.prisma.siteBranding.update({ where: { id: settings.id }, data: { experienceYears } });
    return this.get();
  }

  async setCompanyInfo(data: {
    companyLegalName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyRC?: string;
    companyNIF?: string;
    companyNIS?: string;
    companyAI?: string;
  }) {
    const settings = await this.getOrCreateSettings();
    await this.prisma.siteBranding.update({ where: { id: settings.id }, data });
    return this.get();
  }

  async addLogo(imageUrl: string) {
    const last = await this.prisma.partnerLogo.findFirst({ orderBy: { sortOrder: 'desc' } });
    await this.prisma.partnerLogo.create({ data: { imageUrl, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    return this.get();
  }

  async removeLogo(id: string) {
    const logo = await this.prisma.partnerLogo.findUnique({ where: { id } });
    if (!logo) throw new NotFoundException('Logo introuvable');
    await this.prisma.partnerLogo.delete({ where: { id } });
    return this.get();
  }
}
