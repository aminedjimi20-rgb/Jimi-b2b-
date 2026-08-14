import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Bootstraps the first ADMIN account. There is no public "register as
 * admin" endpoint on purpose — the very first Admin is provisioned once
 * via this seed script; every other account (client, and later employee)
 * is created by an existing Admin through the authenticated API.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@jimi-b2b.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`Admin created: ${email} / ${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
