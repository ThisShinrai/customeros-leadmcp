import { getRequestEnv } from '@/lib/db';
import { shortId } from '@/lib/utils';

/**
 * R2 helpers. Files stay private — access is gated through a permission-checked
 * Next route handler that streams the object (no public bucket / presigned URLs
 * needed for the MVP).
 */

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

export function buildProjectFileKey(agencyId: string, projectId: string, filename: string): string {
  return `agencies/${agencyId}/projects/${projectId}/${shortId(10)}-${sanitize(filename)}`;
}

export function buildInvoiceKey(agencyId: string, invoiceId: string, filename = 'invoice.pdf'): string {
  return `agencies/${agencyId}/invoices/${invoiceId}/${shortId(6)}-${sanitize(filename)}`;
}

export async function putObject(
  key: string,
  data: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
  contentType?: string,
): Promise<void> {
  const env = await getRequestEnv();
  await env.R2.put(key, data, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

export async function getObject(key: string): Promise<R2ObjectBody | null> {
  const env = await getRequestEnv();
  return env.R2.get(key);
}

export async function deleteObject(key: string): Promise<void> {
  const env = await getRequestEnv();
  await env.R2.delete(key);
}
