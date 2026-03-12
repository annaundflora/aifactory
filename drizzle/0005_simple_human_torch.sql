CREATE TABLE "generation_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"reference_image_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"strength" varchar(20) NOT NULL,
	"slot_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"original_filename" varchar(255),
	"width" integer,
	"height" integer,
	"source_type" varchar(20) NOT NULL,
	"source_generation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_references" ADD CONSTRAINT "generation_references_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_references" ADD CONSTRAINT "generation_references_reference_image_id_reference_images_id_fk" FOREIGN KEY ("reference_image_id") REFERENCES "public"."reference_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_source_generation_id_generations_id_fk" FOREIGN KEY ("source_generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_references_generation_id_idx" ON "generation_references" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "reference_images_project_id_idx" ON "reference_images" USING btree ("project_id");