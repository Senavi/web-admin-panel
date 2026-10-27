CREATE TABLE "database_environment" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"environment" text NOT NULL,
	"database_identity" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "database_environment_singleton" CHECK ("database_environment"."id" = 1)
);
