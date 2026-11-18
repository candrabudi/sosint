ALTER TABLE "link_comments" ADD COLUMN "author_name" varchar(200);--> statement-breakpoint
ALTER TABLE "link_comments" ADD COLUMN "author_avatar" text;--> statement-breakpoint
ALTER TABLE "link_comments" ADD COLUMN "is_pinned" boolean;