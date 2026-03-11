CREATE TABLE "favorite_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE INDEX "favorite_models_model_id_idx" ON "favorite_models" USING btree ("model_id");