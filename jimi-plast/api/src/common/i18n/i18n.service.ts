import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type Locale = 'fr' | 'ar' | 'en';
export const SUPPORTED_LOCALES: Locale[] = ['fr', 'ar', 'en'];
export const RTL_LOCALES: Locale[] = ['ar'];

/**
 * Toutes les chaînes visibles dans l'app passent par une clé i18n stockée en
 * base (table translations), jamais en dur dans le code (§53 du cahier des
 * charges). Le service charge le cache au démarrage et le rafraîchit quand
 * l'admin modifie une traduction depuis Paramètres.
 */
@Injectable()
export class I18nService implements OnModuleInit {
  private cache = new Map<string, Map<Locale, string>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload() {
    const rows = await this.prisma.translation.findMany();
    this.cache.clear();
    for (const row of rows) {
      if (!this.cache.has(row.key)) this.cache.set(row.key, new Map());
      this.cache.get(row.key)!.set(row.locale as Locale, row.value);
    }
  }

  translate(key: string, locale: Locale): string {
    return this.cache.get(key)?.get(locale) ?? this.cache.get(key)?.get('fr') ?? key;
  }

  async upsert(key: string, locale: Locale, value: string) {
    await this.prisma.translation.upsert({
      where: { key_locale: { key, locale } },
      create: { key, locale, value },
      update: { value },
    });
    if (!this.cache.has(key)) this.cache.set(key, new Map());
    this.cache.get(key)!.set(locale, value);
  }
}
