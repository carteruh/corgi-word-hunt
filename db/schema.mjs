import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  board: text('board').notNull(),
  guest: text('guest').notNull(),
  nickname: text('nickname').notNull(),
  endsAt: integer('ends_at').notNull(),
  score: integer('score').notNull().default(0),
  wordCount: integer('word_count').notNull().default(0),
}, t => [
  index('runs_board_guest').on(t.board, t.guest, t.score),
  index('runs_deadline').on(t.endsAt),
]);
