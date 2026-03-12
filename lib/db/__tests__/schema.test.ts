import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { projects, generations } from '../schema'

/**
 * Unit tests for DB Schema Definition (slice-01-docker-db-schema)
 *
 * These tests validate the Drizzle ORM schema definitions against the
 * Acceptance Criteria in the slice spec. They inspect the schema objects
 * directly without requiring a running database.
 */

describe('DB Schema Definition', () => {
  // -----------------------------------------------------------
  // AC-4: projects table
  // -----------------------------------------------------------
  describe('AC-4: projects table', () => {
    it('should define projects table with id, name, created_at, updated_at columns', () => {
      /**
       * AC-4: GIVEN die Tabellen existieren
       *       WHEN die Tabelle `projects` inspiziert wird
       *       THEN enthaelt sie die Spalten: id UUID PK, name VARCHAR(255) NOT NULL,
       *            created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
       */
      const config = getTableConfig(projects)

      expect(config.name).toBe('projects')

      const columnMap = Object.fromEntries(
        config.columns.map((c) => [c.name, c])
      )

      // id: UUID, primary key
      expect(columnMap['id']).toBeDefined()
      expect(columnMap['id'].dataType).toBe('string')
      expect(columnMap['id'].columnType).toBe('PgUUID')
      expect(columnMap['id'].primary).toBe(true)
      expect(columnMap['id'].hasDefault).toBe(true)

      // name: VARCHAR(255) NOT NULL
      expect(columnMap['name']).toBeDefined()
      expect(columnMap['name'].columnType).toBe('PgVarchar')
      expect((columnMap['name'] as any).config.length).toBe(255)
      expect(columnMap['name'].notNull).toBe(true)

      // created_at: TIMESTAMPTZ
      expect(columnMap['created_at']).toBeDefined()
      expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
      expect(columnMap['created_at'].hasDefault).toBe(true)

      // updated_at: TIMESTAMPTZ
      expect(columnMap['updated_at']).toBeDefined()
      expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
      expect(columnMap['updated_at'].hasDefault).toBe(true)
    })
  })

  // -----------------------------------------------------------
  // AC-5: generations table
  // -----------------------------------------------------------
  describe('AC-5: generations table', () => {
    it('should define generations table with all columns and project_id FK with CASCADE', () => {
      /**
       * AC-5: GIVEN die Tabellen existieren
       *       WHEN die Tabelle `generations` inspiziert wird
       *       THEN enthaelt sie alle Spalten inkl. FK `project_id` mit ON DELETE CASCADE
       */
      const config = getTableConfig(generations)

      expect(config.name).toBe('generations')

      const columnMap = Object.fromEntries(
        config.columns.map((c) => [c.name, c])
      )

      // id: UUID PK
      expect(columnMap['id']).toBeDefined()
      expect(columnMap['id'].columnType).toBe('PgUUID')
      expect(columnMap['id'].primary).toBe(true)
      expect(columnMap['id'].hasDefault).toBe(true)

      // project_id: UUID NOT NULL, FK to projects with CASCADE
      expect(columnMap['project_id']).toBeDefined()
      expect(columnMap['project_id'].columnType).toBe('PgUUID')
      expect(columnMap['project_id'].notNull).toBe(true)

      // Verify foreign key with CASCADE
      expect(config.foreignKeys.length).toBeGreaterThanOrEqual(1)
      const projectFk = config.foreignKeys[0]
      expect(projectFk).toBeDefined()
      // Check ON DELETE CASCADE via the reference config
      const fkConfig = projectFk.reference()
      expect(fkConfig.foreignTable).toBe(projects)
      // onDelete should be cascade
      expect(projectFk.onDelete).toBe('cascade')

      // prompt: TEXT NOT NULL
      expect(columnMap['prompt']).toBeDefined()
      expect(columnMap['prompt'].columnType).toBe('PgText')
      expect(columnMap['prompt'].notNull).toBe(true)

      // negative_prompt: TEXT (nullable)
      expect(columnMap['negative_prompt']).toBeDefined()
      expect(columnMap['negative_prompt'].columnType).toBe('PgText')

      // model_id: VARCHAR(255) NOT NULL
      expect(columnMap['model_id']).toBeDefined()
      expect(columnMap['model_id'].columnType).toBe('PgVarchar')
      expect(columnMap['model_id'].notNull).toBe(true)

      // model_params: JSONB NOT NULL
      expect(columnMap['model_params']).toBeDefined()
      expect(columnMap['model_params'].columnType).toBe('PgJsonb')
      expect(columnMap['model_params'].notNull).toBe(true)
      expect(columnMap['model_params'].hasDefault).toBe(true)

      // status: VARCHAR(20) NOT NULL DEFAULT 'pending'
      expect(columnMap['status']).toBeDefined()
      expect(columnMap['status'].columnType).toBe('PgVarchar')
      expect(columnMap['status'].notNull).toBe(true)
      expect(columnMap['status'].hasDefault).toBe(true)

      // image_url: TEXT (nullable)
      expect(columnMap['image_url']).toBeDefined()
      expect(columnMap['image_url'].columnType).toBe('PgText')

      // replicate_prediction_id: VARCHAR(255)
      expect(columnMap['replicate_prediction_id']).toBeDefined()
      expect(columnMap['replicate_prediction_id'].columnType).toBe('PgVarchar')

      // error_message: TEXT (nullable)
      expect(columnMap['error_message']).toBeDefined()
      expect(columnMap['error_message'].columnType).toBe('PgText')

      // width: INTEGER
      expect(columnMap['width']).toBeDefined()
      expect(columnMap['width'].columnType).toBe('PgInteger')

      // height: INTEGER
      expect(columnMap['height']).toBeDefined()
      expect(columnMap['height'].columnType).toBe('PgInteger')

      // seed: BIGINT
      expect(columnMap['seed']).toBeDefined()
      expect(columnMap['seed'].columnType).toBe('PgBigInt53')

      // created_at: TIMESTAMPTZ NOT NULL
      expect(columnMap['created_at']).toBeDefined()
      expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
      expect(columnMap['created_at'].hasDefault).toBe(true)
    })

    it('should define indexes on generations.project_id, generations.status, generations.created_at', () => {
      /**
       * AC-5: GIVEN die Tabellen existieren
       *       WHEN die Tabelle `generations` inspiziert wird
       *       THEN hat sie Index auf `project_id`, `status` und `created_at`
       */
      const config = getTableConfig(generations)

      // Extract index names
      const indexNames = config.indexes.map((idx) => idx.config.name)

      expect(indexNames).toContain('generations_project_id_idx')
      expect(indexNames).toContain('generations_status_idx')
      expect(indexNames).toContain('generations_created_at_idx')
      expect(indexNames).toContain('generations_is_favorite_idx')
      expect(config.indexes.length).toBe(5)
    })
  })

})
