import {
  pgTable,
  primaryKey,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  bigint,
  boolean,
  index,
  uniqueIndex,
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
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("projects_thumbnail_status_idx").on(table.thumbnailStatus),
    index("projects_user_id_idx").on(table.userId),
  ]
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

// -----------------------------------------------
// model_settings
// -----------------------------------------------
export const modelSettings = pgTable(
  "model_settings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    mode: varchar("mode", { length: 20 }).notNull(),
    tier: varchar("tier", { length: 20 }).notNull(),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    modelParams: jsonb("model_params").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("model_settings_mode_tier_idx").on(table.mode, table.tier),
  ]
);

// -----------------------------------------------
// models
// -----------------------------------------------
export const models = pgTable(
  "models",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    replicateId: varchar("replicate_id", { length: 255 }).notNull(),
    owner: varchar("owner", { length: 100 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    runCount: integer("run_count"),
    collections: text("collections").array(),
    capabilities: jsonb("capabilities").notNull(),
    inputSchema: jsonb("input_schema"),
    versionHash: varchar("version_hash", { length: 64 }),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("models_replicate_id_idx").on(table.replicateId),
    index("models_is_active_idx").on(table.isActive),
  ]
);

// -----------------------------------------------
// users (Auth.js)
// -----------------------------------------------
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

// -----------------------------------------------
// accounts (Auth.js)
// -----------------------------------------------
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_userId_idx").on(table.userId),
  ]
);

// -----------------------------------------------
// sessions (Auth.js)
// -----------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("sessions_userId_idx").on(table.userId),
  ]
);
