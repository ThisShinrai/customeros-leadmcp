import { customAlphabet } from 'nanoid';
import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { agencies, type Agency } from '@/lib/db';

// Unambiguous alphabet (no 0/O/1/I) for human-readable, dictate-able numbers.
const CN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const cnGen = customAlphabet(CN_ALPHABET, 8);
const pinGen = customAlphabet('0123456789', 6);

/** A random, human-readable customer number, e.g. `EPS-7F3K-9210`. */
export function generateCustomerNumber(): string {
  const raw = cnGen();
  return `EPS-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** A random 6-digit support PIN. */
export function generateSupportPin(): string {
  return pinGen();
}

/**
 * Return the agency's support credentials, lazily generating + persisting them
 * on first access. Backfills agencies created before the support feature so
 * every agency always has a customer number + PIN without a manual migration.
 */
export async function ensureSupportCredentials(
  db: Db,
  agency: Pick<Agency, 'id' | 'customerNumber' | 'supportPin'>,
): Promise<{ customerNumber: string; supportPin: string }> {
  let customerNumber = agency.customerNumber;
  let supportPin = agency.supportPin;

  if (!customerNumber || !supportPin) {
    customerNumber = customerNumber || generateCustomerNumber();
    supportPin = supportPin || generateSupportPin();
    await db
      .update(agencies)
      .set({ customerNumber, supportPin, updatedAt: new Date() })
      .where(eq(agencies.id, agency.id));
  }

  return { customerNumber, supportPin };
}
