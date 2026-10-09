CREATE TYPE "public"."form_submission_status" AS ENUM('new', 'read', 'archived');--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" text NOT NULL,
	"locale" text NOT NULL,
	"data" jsonb NOT NULL,
	"page_path" text,
	"status" "form_submission_status" DEFAULT 'new' NOT NULL,
	"delivery" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "form_submissions_inbox_idx" ON "form_submissions" USING btree ("form_id","status","created_at" DESC NULLS LAST);