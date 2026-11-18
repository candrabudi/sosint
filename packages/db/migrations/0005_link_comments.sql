CREATE TABLE "link_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"author" varchar(200) NOT NULL,
	"author_followers" bigint,
	"author_verified" boolean,
	"text" text DEFAULT '' NOT NULL,
	"posted_at" timestamp with time zone,
	"likes" bigint DEFAULT 0 NOT NULL,
	"replies" bigint DEFAULT 0 NOT NULL,
	"shares" bigint DEFAULT 0 NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"lang" varchar(16),
	"polarity" varchar(16),
	"dominant_emotion" varchar(32),
	"intensity" double precision,
	"emotions" jsonb,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_comments_link_external_unique" UNIQUE("link_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "data_url_links" ADD COLUMN "comments_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_url_links" ADD COLUMN "comments_sync_error" text;--> statement-breakpoint
ALTER TABLE "link_comments" ADD CONSTRAINT "link_comments_link_id_data_url_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."data_url_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_comments_link_posted_idx" ON "link_comments" USING btree ("link_id","posted_at");--> statement-breakpoint
CREATE INDEX "link_comments_polarity_idx" ON "link_comments" USING btree ("polarity");