'use server';

import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getRequestDb, feedback, FEEDBACK_CATEGORIES, type Feedback } from '@/lib/db';
import { requireAgencySession } from '@/lib/auth/session';

/* ─── Submit ──────────────────────────────────────────────────────── */

const RatingSchema = z.number().int().min(1).max(5);
const CommentSchema = z.string().trim().max(2000).optional();
const CategorySchema = z.enum(FEEDBACK_CATEGORIES);

/**
 * Persist a single NPS-style rating (1..5) plus an optional comment for the
 * current agency user. Tenant-scoped via the session's agencyId.
 */
export async function submitFeedback(rating: number, comment?: string): Promise<{ ok: true }> {
  const session = await requireAgencySession();
  const safeRating = RatingSchema.parse(rating);
  const safeComment = CommentSchema.parse(comment);

  const db = await getRequestDb();
  await db.insert(feedback).values({
    agencyId: session.agencyId,
    userId: session.user.id,
    userName: session.user.name,
    rating: safeRating,
    comment: safeComment && safeComment.length > 0 ? safeComment : null,
  });

  return { ok: true };
}

/**
 * Persist categorized feedback from the deliberate "Feedback geben" form:
 * a category (feature/bug/missing/general), an optional satisfaction rating
 * (1..5, 0 = none) and a free-text message. Tenant-scoped via the session.
 */
export async function submitDetailedFeedback(input: {
  category: string;
  rating?: number;
  message?: string;
}): Promise<{ ok: true }> {
  const session = await requireAgencySession();
  const category = CategorySchema.parse(input.category);
  const rating = input.rating && input.rating >= 1 ? RatingSchema.parse(input.rating) : 0;
  const message = CommentSchema.parse(input.message);

  const db = await getRequestDb();
  await db.insert(feedback).values({
    agencyId: session.agencyId,
    userId: session.user.id,
    userName: session.user.name,
    category,
    rating,
    comment: message && message.length > 0 ? message : null,
  });

  return { ok: true };
}

/* ─── Has the current user already given feedback? ───────────────────── */

/** True if this user already has a feedback row (so the widget can hide). */
export async function getMyFeedbackGiven(): Promise<boolean> {
  const session = await requireAgencySession();
  const db = await getRequestDb();

  const row = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.agencyId, session.agencyId), eq(feedback.userId, session.user.id)))
    .limit(1);

  return row.length > 0;
}

/* ─── Admin summary (tenant-isolated) ─────────────────────────────────── */

export interface FeedbackSummaryEntry {
  userName: string;
  rating: number;
  comment: string | null;
  createdAt: Feedback['createdAt'];
}

export interface FeedbackSummary {
  count: number;
  average: number;
  recent: FeedbackSummaryEntry[];
}

/**
 * Aggregate feedback for the current agency: total count, average rating and
 * the most recent entries. Scoped to the session's agencyId for tenant isolation.
 */
export async function getAgencyFeedbackSummary(): Promise<FeedbackSummary> {
  const session = await requireAgencySession();
  const db = await getRequestDb();

  const [agg] = await db
    .select({
      count: sql<number>`count(*)`,
      average: sql<number>`coalesce(avg(nullif(${feedback.rating}, 0)), 0)`,
    })
    .from(feedback)
    .where(eq(feedback.agencyId, session.agencyId));

  const recentRows = await db
    .select({
      userName: feedback.userName,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.agencyId, session.agencyId))
    .orderBy(desc(feedback.createdAt))
    .limit(10);

  return {
    count: Number(agg?.count ?? 0),
    average: Math.round(Number(agg?.average ?? 0) * 10) / 10,
    recent: recentRows,
  };
}
