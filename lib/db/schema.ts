import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  bigint,
  boolean,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -----------------------------------------------
// projects
// -----------------------------------------------
export const projects = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailStatus: varchar("thumbnail_status", { length: 20 })
      .notNull()
      .default("none"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_thumbnail_status_idx").on(table.thumbnailStatus)]
);

// -----------------------------------------------
// generations
// -----------------------------------------------
export const generations = pgTable(
  "generations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    modelParams: jsonb("model_params").notNull().default({}),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    imageUrl: text("image_url"),
    replicatePredictionId: varchar("replicate_prediction_id", { length: 255 }),
    errorMessage: text("error_message"),
    width: integer("width"),
    height: integer("height"),
    seed: bigint("seed", { mode: "number" }),
    promptMotiv: text("prompt_motiv").notNull().default(""),
    promptStyle: text("prompt_style").default(""),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    generationMode: varchar("generation_mode", { length: 20 })
      .notNull()
      .default("txt2img"),
    sourceImageUrl: text("source_image_url"),
    sourceGenerationId: uuid("source_generation_id").references(
      (): AnyPgColumn => generations.id,
      { onDelete: "set null" }
    ),
    batchId: uuid("batch_id"),
  },
  (table) => [
    index("generations_project_id_idx").on(table.projectId),
    index("generations_status_idx").on(table.status),
    index("generations_created_at_idx").on(table.createdAt),
    index("generations_is_favorite_idx").on(table.isFavorite),
    index("generations_project_mode_idx").on(
      table.projectId,
      table.generationMode
    ),
    index("generations_batch_id_idx").on(table.batchId),
  ]
);

// -----------------------------------------------
// favorite_models
// -----------------------------------------------
export const favoriteModels = pgTable(
  "favorite_models",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    modelId: varchar("model_id", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("favorite_models_model_id_idx").on(table.modelId)]
);

// -----------------------------------------------
// project_selected_models
// -----------------------------------------------
export const projectSelectedModels = pgTable(
  "project_selected_models",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("project_selected_models_project_id_idx").on(table.projectId)]
);

// -----------------------------------------------
// assistant_sessions
// -----------------------------------------------
export const assistantSessions = pgTable(
  "assistant_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    messageCount: integer("message_count").notNull().default(0),
    hasDraft: boolean("has_draft").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assistant_sessions_project_id_idx").on(table.projectId),
    index("assistant_sessions_last_message_at_idx").on(table.lastMessageAt),
  ]
);

// -----------------------------------------------
// assistant_images
// -----------------------------------------------
export const assistantImages = pgTable(
  "assistant_images",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assistantSessions.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    analysisResult: jsonb("analysis_result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assistant_images_session_id_idx").on(table.sessionId),
  ]
);

// -----------------------------------------------
// reference_images
// -----------------------------------------------
export const referenceImages = pgTable(
  "reference_images",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    width: integer("width"),
    height: integer("height"),
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    sourceGenerationId: uuid("source_generation_id").references(
      () => generations.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reference_images_project_id_idx").on(table.projectId)]
);

// -----------------------------------------------
// generation_references
// -----------------------------------------------
export const generationReferences = pgTable(
  "generation_references",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    referenceImageId: uuid("reference_image_id")
      .notNull()
      .references(() => referenceImages.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    strength: varchar("strength", { length: 20 }).notNull(),
    slotPosition: integer("slot_position").notNull(),
  },
  (table) => [
    index("generation_references_generation_id_idx").on(table.generationId),
  ]
);
