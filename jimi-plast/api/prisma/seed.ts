import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: 'prices.view_factory', label: 'Voir le prix usine', group: 'prices' },
  { key: 'prices.view_wholesale', label: 'Voir le prix grossiste', group: 'prices' },
  { key: 'prices.view_retail', label: 'Voir le prix détaillant', group: 'prices' },
  { key: 'prices.edit', label: 'Modifier les prix', group: 'prices' },
  { key: 'costs.view', label: "Voir les coûts d'achat et marges", group: 'prices' },
  { key: 'orders.create', label: 'Créer une commande', group: 'orders' },
  { key: 'orders.edit', label: 'Modifier une commande', group: 'orders' },
  { key: 'vouchers.create', label: 'Créer un bon', group: 'vouchers' },
  { key: 'vouchers.edit', label: 'Modifier un bon', group: 'vouchers' },
  { key: 'credits.view', label: 'Voir les crédits clients', group: 'finance' },
  { key: 'suppliers.view', label: 'Voir le module fabricants', group: 'suppliers' },
  { key: 'stock.manage', label: 'Gérer le stock et l’inventaire', group: 'stock' },
  { key: 'returns.manage', label: 'Traiter les retours', group: 'returns' },
  { key: 'transport.manage', label: 'Gérer le transport/livraison', group: 'transport' },
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
    permissions: ['prices.view_wholesale', 'orders.create', 'credits.view'],
  },
  {
    key: 'retailer',
    name: 'Détaillant',
    isSystem: true,
    permissions: ['prices.view_retail', 'orders.create', 'credits.view'],
  },
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

  await seedCatalogDemo();

  // eslint-disable-next-line no-console
  console.log('Seed terminé.');
}

async function seedCatalogDemo() {
  const plastique = await prisma.category.upsert({
    where: { slug: 'plastique' },
    create: { slug: 'plastique', nameFr: 'Plastique', nameAr: 'بلاستيك', nameEn: 'Plastic', sortOrder: 0 },
    update: {},
  });
  const vaisselle = await prisma.category.upsert({
    where: { slug: 'vaisselle-plastique' },
    create: {
      slug: 'vaisselle-plastique',
      nameFr: 'Vaisselle',
      nameAr: 'أواني المائدة',
      nameEn: 'Tableware',
      parentId: plastique.id,
      sortOrder: 0,
    },
    update: {},
  });
  const bassines = await prisma.category.upsert({
    where: { slug: 'bassines-seaux' },
    create: {
      slug: 'bassines-seaux',
      nameFr: 'Bassines & Seaux',
      nameAr: 'أحواض ودِلاء',
      nameEn: 'Basins & Buckets',
      parentId: plastique.id,
      sortOrder: 1,
    },
    update: {},
  });

  const carton = await prisma.packagingUnit.findUniqueOrThrow({ where: { key: 'carton' } });
  const factory = await prisma.priceTierType.findUniqueOrThrow({ where: { key: 'factory' } });
  const wholesale = await prisma.priceTierType.findUniqueOrThrow({ where: { key: 'wholesale' } });
  const retail = await prisma.priceTierType.findUniqueOrThrow({ where: { key: 'retail' } });

  // Les prix stockés sont toujours au prix de la pièce/unité de base — le
  // conditionnement (unitsPerPackage) sert uniquement à convertir la quantité
  // commandée en cartons vers un nombre de pièces, cf. §8 du cahier des charges.
  const DEMO_PRODUCTS = [
    {
      sku: 'PLA-001',
      categoryId: vaisselle.id,
      nameFr: 'Assiette plastique ronde 22cm',
      nameAr: 'صحن بلاستيك دائري 22 سم',
      packagingUnitId: carton.id,
      unitsPerPackage: 50,
      costPrice: 6.5,
      currentStock: 4200,
      stockMin: 500,
      isNew: false,
      prices: [
        { priceTierTypeId: factory.id, price: 8 },
        { priceTierTypeId: wholesale.id, price: 9.5 },
        { priceTierTypeId: retail.id, price: 11.5 },
      ],
    },
    {
      sku: 'PLA-002',
      categoryId: bassines.id,
      nameFr: 'Seau plastique 15L',
      nameAr: 'دلو بلاستيك 15 لتر',
      packagingUnitId: carton.id,
      unitsPerPackage: 20,
      costPrice: 150,
      currentStock: 860,
      stockMin: 200,
      prices: [
        { priceTierTypeId: factory.id, price: 180 },
        { priceTierTypeId: wholesale.id, price: 210 },
        { priceTierTypeId: retail.id, price: 250 },
      ],
    },
    {
      sku: 'PLA-003',
      categoryId: vaisselle.id,
      nameFr: 'Set de couverts plastique (12 pièces)',
      nameAr: 'طقم أدوات مائدة بلاستيك (12 قطعة)',
      packagingUnitId: carton.id,
      unitsPerPackage: 100,
      costPrice: 20,
      currentStock: 3000,
      stockMin: 300,
      isNew: true,
      prices: [
        { priceTierTypeId: factory.id, price: 25 },
        { priceTierTypeId: wholesale.id, price: 30 },
        { priceTierTypeId: retail.id, price: 38 },
      ],
    },
    {
      sku: 'PLA-004',
      categoryId: bassines.id,
      nameFr: 'Bassine plastique 30L',
      nameAr: 'حوض بلاستيك 30 لتر',
      packagingUnitId: carton.id,
      unitsPerPackage: 10,
      costPrice: 270,
      currentStock: 45,
      stockMin: 100,
      isFeatured: true,
      prices: [
        { priceTierTypeId: factory.id, price: 320 },
        { priceTierTypeId: wholesale.id, price: 370 },
        { priceTierTypeId: retail.id, price: 440 },
      ],
    },
  ];

  for (const demo of DEMO_PRODUCTS) {
    const { prices, ...data } = demo;
    const product = await prisma.product.upsert({
      where: { sku: demo.sku },
      create: { ...data, prices: { create: prices } },
      update: data,
    });
    for (const p of prices) {
      await prisma.productPrice.upsert({
        where: { productId_priceTierTypeId: { productId: product.id, priceTierTypeId: p.priceTierTypeId } },
        create: { productId: product.id, priceTierTypeId: p.priceTierTypeId, price: p.price },
        update: { price: p.price },
      });
    }
  }

  // Promotion de démonstration : -10% sur le prix détaillant de la bassine 30L
  const bassine = await prisma.product.findUnique({ where: { sku: 'PLA-004' } });
  if (bassine) {
    const already = await prisma.promotion.findFirst({
      where: { productId: bassine.id, priceTierTypeId: retail.id, isActive: true },
    });
    if (!already) {
      await prisma.promotion.create({
        data: {
          productId: bassine.id,
          priceTierTypeId: retail.id,
          discountType: 'PERCENT',
          discountValue: 10,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
