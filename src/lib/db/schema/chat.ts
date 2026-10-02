import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { projects } from './projects';

export const chatChannels = sqliteTable('chat_channels', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['project', 'direct'] }).notNull().default('project'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const chatParticipants = sqliteTable('chat_participants', {
  channelId: text('channel_id').notNull().references(() => chatChannels.id),
  participantId: text('participant_id').notNull(),
  participantType: text('participant_type', { enum: ['agency_user', 'client_user'] }).notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  // Typing indicator (polling-based): updated while a participant is typing.
  lastTypingAt: integer('last_typing_at', { mode: 'timestamp' }),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  channelId: text('channel_id').notNull().references(() => chatChannels.id),
  senderId: text('sender_id').notNull(),
  senderType: text('sender_type', { enum: ['agency_user', 'client_user'] }).notNull(),
  content: text('content').notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type ChatChannel = typeof chatChannels.$inferSelect;
export type NewChatChannel = typeof chatChannels.$inferInsert;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type NewChatParticipant = typeof chatParticipants.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
