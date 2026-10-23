CREATE TABLE "content_seed_state" (
	"scope" text NOT NULL,
	"document_key" text NOT NULL,
	"locale" text NOT NULL,
	"hashes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_seed_state_scope_document_key_locale_pk" PRIMARY KEY("scope","document_key","locale")
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "seed_asset_hash" text;