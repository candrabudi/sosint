ALTER TABLE "data_url_links" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "data_url_links" ADD COLUMN "last_sync_error" text;