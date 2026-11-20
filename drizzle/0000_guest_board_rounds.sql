CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`board` text NOT NULL,
	`guest` text NOT NULL,
	`nickname` text NOT NULL,
	`ends_at` integer NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_board_guest` ON `runs` (`board`,`guest`,`score`);--> statement-breakpoint
CREATE INDEX `runs_deadline` ON `runs` (`ends_at`);