CREATE TABLE "model_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" varchar(20) NOT NULL,
	"tier" varchar(20) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"model_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "model_settings_mode_tier_idx" ON "model_settings" USING btree ("mode","tier");--> statement-breakpoint

-- Seed default model settings (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO "model_settings" ("mode", "tier", "model_id", "model_params") VALUES
  ('txt2img', 'draft', 'black-forest-labs/flux-schnell', '{}'),
  ('txt2img', 'quality', 'black-forest-labs/flux-2-pro', '{}'),
  ('txt2img', 'max', 'black-forest-labs/flux-2-max', '{}'),
  ('img2img', 'draft', 'black-forest-labs/flux-schnell', '{"prompt_strength": 0.6}'),
  ('img2img', 'quality', 'black-forest-labs/flux-2-pro', '{"prompt_strength": 0.6}'),
  ('img2img', 'max', 'black-forest-labs/flux-2-max', '{"prompt_strength": 0.6}'),
  ('upscale', 'draft', 'nightmareai/real-esrgan', '{"scale": 2}'),
  ('upscale', 'quality', 'philz1337x/crystal-upscaler', '{"scale": 4}')
ON CONFLICT DO NOTHING;
