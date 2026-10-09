CREATE TYPE "public"."collection_item_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "collection_item_content" (
	"item_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "collection_item_content_item_id_locale_pk" PRIMARY KEY("item_id","locale")
);
--> statement-breakpoint
CREATE TABLE "collection_item_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"author_id" text,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_item_seo" (
	"item_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "collection_item_seo_item_id_locale_pk" PRIMARY KEY("item_id","locale")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" text NOT NULL,
	"slug" text NOT NULL,
	"status" "collection_item_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_slug_uq" UNIQUE("collection_id","slug")
);
--> statement-breakpoint
CREATE TABLE "collection_seed_log" (
	"collection_id" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_seed_log_collection_id_slug_pk" PRIMARY KEY("collection_id","slug")
);
--> statement-breakpoint
CREATE TABLE "collection_slug_redirects" (
	"collection_id" text NOT NULL,
	"old_slug" text NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_slug_redirects_collection_id_old_slug_pk" PRIMARY KEY("collection_id","old_slug")
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "collection_item_content" ADD CONSTRAINT "collection_item_content_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_content" ADD CONSTRAINT "collection_item_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_revisions" ADD CONSTRAINT "collection_item_revisions_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_revisions" ADD CONSTRAINT "collection_item_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_seo" ADD CONSTRAINT "collection_item_seo_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_seo" ADD CONSTRAINT "collection_item_seo_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slug_redirects" ADD CONSTRAINT "collection_slug_redirects_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_item_revisions_item_locale_created_idx" ON "collection_item_revisions" USING btree ("item_id","locale","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collection_items_list_idx" ON "collection_items" USING btree ("collection_id","status","published_at" DESC NULLS LAST);