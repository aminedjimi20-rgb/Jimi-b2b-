import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Runs `fn`; if it fails on a foreign-key constraint (P2003), rethrows as a
 * friendly 400 instead of letting Prisma's raw error surface as a 500.
 * Used by every "permanent delete from trash" endpoint to protect historical
 * relations (orders/receipts/payments referencing this row) without the
 * caller needing to know which specific relations block it.
 */
export async function runOrExplainForeignKeyError<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new BadRequestException(message);
    }
    throw error;
  }
}
