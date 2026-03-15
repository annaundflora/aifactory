BEGIN;--> statement-breakpoint

-- Step 1: Add userId columns as NULLABLE (cannot be NOT NULL yet, existing rows have no value)
ALTER TABLE "projects" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "favorite_models" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Step 2: Insert a default user and backfill existing rows
-- The default user ('default@example.com') is a placeholder owner for pre-migration data.
-- It ensures existing rows satisfy the upcoming NOT NULL + FK constraint.
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  -- Insert default user or get existing one
  INSERT INTO "users" ("id", "email", "name")
  VALUES (gen_random_uuid(), 'default@example.com', 'Default User')
  ON CONFLICT ("email") DO NOTHING;

  SELECT "id" INTO default_user_id FROM "users" WHERE "email" = 'default@example.com';

  -- Step 3: Assign all existing projects to the default user
  UPDATE "projects" SET "user_id" = default_user_id WHERE "user_id" IS NULL;

  -- Step 4: Assign all existing favorite_models to the default user
  UPDATE "favorite_models" SET "user_id" = default_user_id WHERE "user_id" IS NULL;
END $$;--> statement-breakpoint

-- Step 5: Set NOT NULL constraints now that all rows have a value
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "favorite_models" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Step 6: Add foreign key constraints
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_models" ADD CONSTRAINT "favorite_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Step 7: Add indexes for performant lookups
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorite_models_user_id_idx" ON "favorite_models" USING btree ("user_id");--> statement-breakpoint

-- Step 8: Drop the old UNIQUE constraint on favorite_models.model_id (by column lookup) and add new UNIQUE(userId, modelId)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'favorite_models'
    AND nsp.nspname = 'public'
    AND att.attname = 'model_id'
    AND con.contype = 'u'
    AND array_length(con.conkey, 1) = 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "favorite_models" DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_models_user_id_model_id_idx" ON "favorite_models" USING btree ("user_id", "model_id");--> statement-breakpoint

COMMIT;
