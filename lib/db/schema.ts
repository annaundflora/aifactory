import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  bigint,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -----------------------------------------------
// projects
// -----------------------------------------------
export const projects = pgTable("projects", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("generations_project_id_idx").on(table.projectId),
    index("generations_status_idx").on(table.status),
    index("generations_created_at_idx").on(table.createdAt),
  ]
);

// -----------------------------------------------
// prompt_snippets
// -----------------------------------------------
export const promptSnippets = pgTable(
  "prompt_snippets",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    text: varchar("text", { length: 500 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("prompt_snippets_category_idx").on(table.category)]
);
