-- Migration 0012: Replace model_settings (tier-based) with model_slots (slot-based)
-- Wraps all operations in a transaction for atomicity.

BEGIN;

-- Step 1: Create model_slots table (IF NOT EXISTS for idempotency)
CREATE TABLE IF NOT EXISTS "model_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" varchar(20) NOT NULL,
	"slot" integer NOT NULL,
	"model_id" varchar(255),
	"model_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_slots_slot_check" CHECK ("slot" IN (1, 2, 3))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_slots_mode_slot_idx" ON "model_slots" USING btree ("mode","slot");--> statement-breakpoint

-- Step 2: Migrate data from model_settings (tier -> slot mapping)
-- tier='draft'   -> slot=1, active=true
-- tier='quality' -> slot=2, active=false
-- tier='max'     -> slot=3, active=false
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active")
SELECT
  ms."mode",
  CASE ms."tier"
    WHEN 'draft'   THEN 1
    WHEN 'quality' THEN 2
    WHEN 'max'     THEN 3
  END AS "slot",
  ms."model_id",
  ms."model_params",
  CASE ms."tier"
    WHEN 'draft' THEN true
    ELSE false
  END AS "active"
FROM "model_settings" ms
WHERE ms."tier" IN ('draft', 'quality', 'max')
ON CONFLICT ("mode", "slot") DO NOTHING;

-- Step 3: Seed defaults for all 5 modes x 3 slots (fills gaps for missing modes/slots)
-- txt2img defaults
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active") VALUES
  ('txt2img', 1, 'black-forest-labs/flux-schnell', '{}'::jsonb, true),
  ('txt2img', 2, 'black-forest-labs/flux-2-pro', '{}'::jsonb, false),
  ('txt2img', 3, 'black-forest-labs/flux-2-max', '{}'::jsonb, false)
ON CONFLICT ("mode", "slot") DO NOTHING;

-- img2img defaults
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active") VALUES
  ('img2img', 1, 'black-forest-labs/flux-schnell', '{"prompt_strength": 0.6}'::jsonb, true),
  ('img2img', 2, 'black-forest-labs/flux-2-pro', '{"prompt_strength": 0.6}'::jsonb, false),
  ('img2img', 3, 'black-forest-labs/flux-2-max', '{"prompt_strength": 0.6}'::jsonb, false)
ON CONFLICT ("mode", "slot") DO NOTHING;

-- upscale defaults
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active") VALUES
  ('upscale', 1, 'philz1337x/crystal-upscaler', '{"scale": 4}'::jsonb, true),
  ('upscale', 2, 'nightmareai/real-esrgan', '{"scale": 2}'::jsonb, false),
  ('upscale', 3, NULL, '{}'::jsonb, false)
ON CONFLICT ("mode", "slot") DO NOTHING;

-- inpaint defaults (no models assigned yet)
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active") VALUES
  ('inpaint', 1, NULL, '{}'::jsonb, true),
  ('inpaint', 2, NULL, '{}'::jsonb, false),
  ('inpaint', 3, NULL, '{}'::jsonb, false)
ON CONFLICT ("mode", "slot") DO NOTHING;

-- outpaint defaults (no models assigned yet)
INSERT INTO "model_slots" ("mode", "slot", "model_id", "model_params", "active") VALUES
  ('outpaint', 1, NULL, '{}'::jsonb, true),
  ('outpaint', 2, NULL, '{}'::jsonb, false),
  ('outpaint', 3, NULL, '{}'::jsonb, false)
ON CONFLICT ("mode", "slot") DO NOTHING;

-- Step 4: Drop legacy model_settings table
DROP TABLE IF EXISTS "model_settings";

COMMIT;
