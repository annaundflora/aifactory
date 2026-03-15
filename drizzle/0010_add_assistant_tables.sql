CREATE TABLE "assistant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"has_draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "assistant_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"analysis_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "assistant_sessions_project_id_idx" ON "assistant_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "assistant_sessions_last_message_at_idx" ON "assistant_sessions" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "assistant_images_session_id_idx" ON "assistant_images" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_images" ADD CONSTRAINT "assistant_images_session_id_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assistant_sessions"("id") ON DELETE cascade ON UPDATE no action;
