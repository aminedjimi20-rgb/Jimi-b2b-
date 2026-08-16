import { Prisma } from '@prisma/client';

export type PaymentStatusValue = 'NON_PAYE' | 'PARTIEL' | 'PAYE';

/** Derived from montantPaye vs. the amount actually owed — never stored, always computed. */
export function computePaymentStatus(montantPaye: Prisma.Decimal, montantDu: Prisma.Decimal): PaymentStatusValue {
  if (montantPaye.lessThanOrEqualTo(0)) return 'NON_PAYE';
  if (montantPaye.greaterThanOrEqualTo(montantDu)) return 'PAYE';
  return 'PARTIEL';
}

export function clampedRemainder(montantDu: Prisma.Decimal, montantPaye: Prisma.Decimal): Prisma.Decimal {
  const remainder = montantDu.minus(montantPaye);
  return remainder.lessThan(0) ? new Prisma.Decimal(0) : remainder;
}
