-- Step 1: Add userId columns as NULLABLE (cannot be NOT NULL yet, existing rows have no value)
ALTER TABLE "projects" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "favorite_models" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Step 2: Insert a default user (uses first email from ALLOWED_EMAILS, fallback to default@example.com)
-- The DO block ensures idempotency: if the user already exists, we reuse it.
DO $$
DECLARE
  default_email TEXT;
  default_user_id UUID;
BEGIN
  -- Try to get ALLOWED_EMAILS env var; fallback to default@example.com
  default_email := split_part(coalesce(current_setting('app.allowed_emails', true), 'default@example.com'), ',', 1);
  IF default_email = '' THEN
    default_email := 'default@example.com';
  END IF;
  default_email := trim(default_email);

  -- Insert default user or get existing one
  INSERT INTO "users" ("id", "email", "name")
  VALUES (gen_random_uuid(), default_email, 'Default User')
  ON CONFLICT ("email") DO NOTHING;

  SELECT "id" INTO default_user_id FROM "users" WHERE "email" = default_email;

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

-- Step 8: Drop the old UNIQUE constraint on favorite_models.model_id and add new UNIQUE(userId, modelId)
ALTER TABLE "favorite_models" DROP CONSTRAINT IF EXISTS "favorite_models_model_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_models_user_id_model_id_idx" ON "favorite_models" USING btree ("user_id", "model_id");
