import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/** Feedback categories. `general` = the proactive NPS pulse; the rest come from
 *  the deliberate "Feedback geben" form. */
export const FEEDBACK_CATEGORIES = ['general', 'feature', 'bug', 'missing'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** In-app feedback — quick NPS pulse + the categorized "Feedback geben" form. */
export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  category: text('category', { enum: FEEDBACK_CATEGORIES }).notNull().default('general'),
  rating: integer('rating').notNull(), // 1..5 smiley scale; 0 = no rating given
  comment: text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
