CREATE TABLE "ui_text_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"locale" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"author_id" text,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ui_texts" (
	"namespace" text NOT NULL,
	"locale" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "ui_texts_namespace_locale_pk" PRIMARY KEY("namespace","locale")
);
--> statement-breakpoint
ALTER TABLE "ui_text_revisions" ADD CONSTRAINT "ui_text_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_texts" ADD CONSTRAINT "ui_texts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ui_text_revisions_ns_locale_created_idx" ON "ui_text_revisions" USING btree ("namespace","locale","created_at" DESC NULLS LAST);