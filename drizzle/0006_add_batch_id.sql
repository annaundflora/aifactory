ALTER TABLE "generations" ADD COLUMN "batch_id" uuid DEFAULT NULL;--> statement-breakpoint
CREATE INDEX "generations_batch_id_idx" ON "generations" USING btree ("batch_id");
