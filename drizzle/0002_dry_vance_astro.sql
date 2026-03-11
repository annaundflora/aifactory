ALTER TABLE "generations" ADD COLUMN "generation_mode" varchar(20) DEFAULT 'txt2img' NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "source_image_url" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "source_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_source_generation_id_generations_id_fk" FOREIGN KEY ("source_generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generations_project_mode_idx" ON "generations" USING btree ("project_id","generation_mode");