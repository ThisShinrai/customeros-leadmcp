'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { clientUsers } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';

const MAX_AVATAR_SIZE = 256 * 1024; // 256 KB
const FRAME_COLORS = ['#0A0A0A', '#FF6B00', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#DB2777', '#0891B2'];

/** Update the client's own display name + avatar frame color. */
export async function updateClientProfile(input: { name: string; avatarFrameColor: string }) {
  const session = await requirePortalSession();
  const db = await getRequestDb();

  const name = (input.name || '').trim();
  if (!name) throw new Error('NO_NAME');
  if (name.length > 80) throw new Error('NAME_TOO_LONG');

  const frame = FRAME_COLORS.includes(input.avatarFrameColor) ? input.avatarFrameColor : '#0A0A0A';

  await db
    .update(clientUsers)
    .set({ name, avatarFrameColor: frame, updatedAt: new Date() })
    .where(eq(clientUsers.id, session.client.id));

  revalidatePath(`/app/p/${session.agency.slug}`, 'layout');
  return { ok: true };
}

/** Edge-safe avatar upload: stored as a base64 data URL on the client row. */
export async function uploadClientAvatar(formData: FormData) {
  const session = await requirePortalSession();
  const db = await getRequestDb();

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) throw new Error('NO_FILE');
  if (!file.type.startsWith('image/')) throw new Error('NOT_IMAGE');
  if (file.size > MAX_AVATAR_SIZE) throw new Error('TOO_LARGE');

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const dataUrl = `data:${file.type};base64,${btoa(binary)}`;

  await db
    .update(clientUsers)
    .set({ avatarUrl: dataUrl, updatedAt: new Date() })
    .where(eq(clientUsers.id, session.client.id));

  revalidatePath(`/app/p/${session.agency.slug}`, 'layout');
  return { ok: true };
}
