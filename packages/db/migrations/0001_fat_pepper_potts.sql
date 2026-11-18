CREATE TYPE "public"."platform" AS ENUM('instagram', 'tiktok', 'x', 'facebook', 'youtube', 'threads', 'linkedin', 'other');--> statement-breakpoint
CREATE TABLE "data_url_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_url_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"url" text NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"likes" bigint DEFAULT 0 NOT NULL,
	"comments" bigint DEFAULT 0 NOT NULL,
	"shares" bigint DEFAULT 0 NOT NULL,
	"saves" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_url_links_data_url_id_url_unique" UNIQUE("data_url_id","url"),
	CONSTRAINT "data_url_links_metrics_non_negative" CHECK ("data_url_links"."views" >= 0 and "data_url_links"."likes" >= 0 and "data_url_links"."comments" >= 0 and "data_url_links"."shares" >= 0 and "data_url_links"."saves" >= 0)
);
--> statement-breakpoint
CREATE TABLE "data_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_url_links" ADD CONSTRAINT "data_url_links_data_url_id_data_urls_id_fk" FOREIGN KEY ("data_url_id") REFERENCES "public"."data_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_urls" ADD CONSTRAINT "data_urls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_url_links_data_url_id_idx" ON "data_url_links" USING btree ("data_url_id");--> statement-breakpoint
CREATE INDEX "data_url_links_platform_idx" ON "data_url_links" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "data_urls_tags_gin_idx" ON "data_urls" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "data_urls_is_active_idx" ON "data_urls" USING btree ("is_active");