ALTER TABLE "generations" ADD COLUMN "prompt_motiv" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "prompt_style" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "thumbnail_status" varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX "generations_is_favorite_idx" ON "generations" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "projects_thumbnail_status_idx" ON "projects" USING btree ("thumbnail_status");

UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = '';