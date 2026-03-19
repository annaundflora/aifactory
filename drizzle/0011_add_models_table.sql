CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"replicate_id" varchar(255) NOT NULL,
	"owner" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"cover_image_url" text,
	"run_count" integer,
	"collections" text[],
	"capabilities" jsonb NOT NULL,
	"input_schema" jsonb,
	"version_hash" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "models_replicate_id_idx" ON "models" USING btree ("replicate_id");--> statement-breakpoint
CREATE INDEX "models_is_active_idx" ON "models" USING btree ("is_active");
