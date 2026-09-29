import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: 'prices.view_factory', label: 'Voir le prix usine', group: 'prices' },
  { key: 'prices.view_wholesale', label: 'Voir le prix grossiste', group: 'prices' },
  { key: 'prices.view_retail', label: 'Voir le prix détaillant', group: 'prices' },
  { key: 'prices.edit', label: 'Modifier les prix', group: 'prices' },
  { key: 'costs.view', label: "Voir les coûts d'achat et marges", group: 'prices' },
  { key: 'vouchers.create', label: 'Créer un bon', group: 'vouchers' },
  { key: 'vouchers.edit', label: 'Modifier un bon', group: 'vouchers' },
  { key: 'credits.view', label: 'Voir les crédits clients', group: 'finance' },
  { key: 'suppliers.view', label: 'Voir le module fabricants', group: 'suppliers' },
  { key: 'stock.manage', label: 'Gérer le stock et l’inventaire', group: 'stock' },
  { key: 'returns.manage', label: 'Traiter les retours', group: 'returns' },
  { key: 'transport.manage', label: 'Gérer le transport/livraison', group: 'transport' },
  { key: 'expenses.manage', label: 'Gérer les frais généraux et la situation', group: 'finance' },
  { key: 'negotiations.manage', label: 'Répondre aux négociations', group: 'negotiations' },
  { key: 'stats.view', label: 'Accéder aux statistiques', group: 'stats' },
  { key: 'users.manage', label: 'Gérer utilisateurs/rôles/permissions', group: 'admin' },
  { key: 'trash.restore', label: 'Restaurer un élément de la corbeille', group: 'admin' },
  { key: 'trash.purge', label: 'Supprimer définitivement', group: 'admin' },
  { key: 'audit.view', label: "Consulter le journal d'activité", group: 'admin' },
  { key: 'documents.manage', label: 'Gérer les documents/photos', group: 'documents' },
  { key: 'settings.manage', label: 'Gérer les paramètres système', group: 'admin' },
  { key: 'catalog.manage', label: 'Gérer le catalogue (produits, catégories)', group: 'catalog' },
  { key: 'customers.manage', label: 'Gérer les dossiers clients', group: 'finance' },
  { key: 'credits.manage', label: 'Enregistrer paiements et ajustements de crédit', group: 'finance' },
  { key: 'requests.manage', label: 'Traiter les demandes de produits et négociations', group: 'negotiations' },
  { key: 'besoins.manage', label: 'Voir et répondre aux besoins remontés par tous', group: 'besoins' },
];

const PRICE_TIER_TYPES = [
  { key: 'factory', label: 'Prix usine', permissionKey: 'prices.view_factory', sortOrder: 0 },
  { key: 'wholesale', label: 'Prix grossiste', permissionKey: 'prices.view_wholesale', sortOrder: 1 },
  { key: 'retail', label: 'Prix détaillant', permissionKey: 'prices.view_retail', sortOrder: 2 },
];

const PACKAGING_UNITS = [
  { key: 'unit', label: 'Pièce', labelPlural: 'Pièces' },
  { key: 'carton', label: 'Carton', labelPlural: 'Cartons' },
  { key: 'pallet', label: 'Palette', labelPlural: 'Palettes' },
];

const BASE_ROLES = [
  { key: 'admin', name: 'Administrateur', isSystem: true, permissions: 'ALL' as const },
  { key: 'employee', name: 'Employé', isSystem: true, permissions: [] as string[] },
  {
    key: 'wholesaler',
    name: 'Grossiste',
    isSystem: true,
    permissions: ['prices.view_wholesale', 'credits.view'],
  },
  {
    key: 'retailer',
    name: 'Détaillant',
    isSystem: true,
    permissions: ['prices.view_retail', 'credits.view'],
  },
  { key: 'manufacturer', name: 'Fabricant', isSystem: true, permissions: [] as string[] },
];

const TRANSLATIONS: Record<string, { fr: string; ar: string; en: string }> = {
  'app.name': { fr: 'JIMI PLAST', ar: 'جيمي بلاست', en: 'JIMI PLAST' },
  'auth.login.title': { fr: 'Connexion', ar: 'تسجيل الدخول', en: 'Sign in' },
  'auth.login.email': { fr: 'Adresse email', ar: 'البريد الإلكتروني', en: 'Email address' },
  'auth.login.password': { fr: 'Mot de passe', ar: 'كلمة المرور', en: 'Password' },
  'auth.login.submit': { fr: 'Se connecter', ar: 'دخول', en: 'Sign in' },
  'auth.register.title': { fr: "Demande d'inscription", ar: 'طلب الانضمام', en: 'Registration request' },
  'auth.register.submit': { fr: 'Envoyer la demande', ar: 'إرسال الطلب', en: 'Submit request' },
  'auth.register.pending': {
    fr: 'Votre demande a été envoyée. Un administrateur va l’examiner.',
    ar: 'تم إرسال طلبك. سيقوم المسؤول بمراجعته.',
    en: 'Your request has been sent. An administrator will review it.',
  },
  'nav.dashboard': { fr: 'Tableau de bord', ar: 'لوحة التحكم', en: 'Dashboard' },
  'nav.users': { fr: 'Employés & rôles', ar: 'الموظفون والأدوار', en: 'Users & roles' },
  'nav.requests': { fr: "Demandes d'inscription", ar: 'طلبات الانضمام', en: 'Registration requests' },
};

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { label: permission.label, group: permission.group },
    });
  }

  for (const role of BASE_ROLES) {
    const createdRole = await prisma.role.upsert({
      where: { key: role.key },
      create: { key: role.key, name: role.name, isSystem: role.isSystem },
      update: { name: role.name },
    });

    const permissionKeys = role.permissions === 'ALL'
      ? PERMISSIONS.map((p) => p.key)
      : role.permissions;

    const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: createdRole.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: createdRole.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  for (const [key, values] of Object.entries(TRANSLATIONS)) {
    for (const [locale, value] of Object.entries(values)) {
      await prisma.translation.upsert({
        where: { key_locale: { key, locale } },
        create: { key, locale, value },
        update: { value },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@jimiplast.dz';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Administrateur JIMI PLAST',
        passwordHash: await bcrypt.hash(adminPassword, 12),
        roleId: adminRole.id,
        status: 'ACTIVE',
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Compte ADMIN créé : ${adminEmail} / ${adminPassword} (à changer immédiatement)`);
  }

  for (const tier of PRICE_TIER_TYPES) {
    await prisma.priceTierType.upsert({ where: { key: tier.key }, create: tier, update: tier });
  }

  for (const unit of PACKAGING_UNITS) {
    await prisma.packagingUnit.upsert({ where: { key: unit.key }, create: unit, update: unit });
  }

  // eslint-disable-next-line no-console
  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
