ALTER TABLE "media" ADD COLUMN "seed_asset" text;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_seed_asset_unique" UNIQUE("seed_asset");