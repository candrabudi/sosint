CREATE TYPE "public"."snapshot_source" AS ENUM('sync', 'manual');--> statement-breakpoint
CREATE TABLE "link_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"likes" bigint DEFAULT 0 NOT NULL,
	"comments" bigint DEFAULT 0 NOT NULL,
	"shares" bigint DEFAULT 0 NOT NULL,
	"saves" bigint DEFAULT 0 NOT NULL,
	"author_followers" bigint,
	"source" "snapshot_source" DEFAULT 'sync' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_metric_snapshots" ADD CONSTRAINT "link_metric_snapshots_link_id_data_url_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."data_url_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_metric_snapshots_link_captured_idx" ON "link_metric_snapshots" USING btree ("link_id","captured_at");--> statement-breakpoint
CREATE INDEX "link_metric_snapshots_captured_idx" ON "link_metric_snapshots" USING btree ("captured_at");--> statement-breakpoint
-- titik awal riwayat: angka terakhir setiap link yang sudah pernah tersinkron
INSERT INTO "link_metric_snapshots" ("link_id", "captured_at", "views", "likes", "comments", "shares", "saves", "author_followers", "source")
SELECT "id", "last_synced_at", "views", "likes", "comments", "shares", "saves",
  CASE WHEN jsonb_typeof("meta"->'authorFollowers') = 'number' THEN ("meta"->>'authorFollowers')::bigint END,
  'sync'
FROM "data_url_links" WHERE "last_synced_at" IS NOT NULL;
