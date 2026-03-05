import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYaml } from 'yaml'

/**
 * Acceptance tests for slice-01-docker-db-schema
 *
 * AC-7 and AC-8 validate configuration files (drizzle.config.ts, docker-compose.yml).
 * AC-1 through AC-3 require Docker and are skipped (covered by integration tests).
 * AC-4 through AC-6 are covered in schema.test.ts unit tests.
 */

const ROOT = resolve(__dirname, '../..')

describe('slice-01-docker-db-schema Acceptance', () => {
  // -----------------------------------------------------------
  // AC-7: drizzle.config.ts
  // -----------------------------------------------------------
  it('AC-7: GIVEN drizzle.config.ts existiert WHEN die Konfiguration gelesen wird THEN referenziert sie lib/db/schema.ts als Schema-Quelle und drizzle/ als Migrations-Verzeichnis und nutzt postgresql Dialect mit DATABASE_URL', () => {
    const configPath = resolve(ROOT, 'drizzle.config.ts')
    expect(existsSync(configPath)).toBe(true)

    const content = readFileSync(configPath, 'utf-8')

    // Schema source references lib/db/schema.ts
    expect(content).toMatch(/schema:\s*['"]\.\/lib\/db\/schema\.ts['"]/)

    // Output directory is drizzle/
    expect(content).toMatch(/out:\s*['"]\.\/drizzle['"]/)

    // Dialect is postgresql
    expect(content).toMatch(/dialect:\s*['"]postgresql['"]/)

    // Uses DATABASE_URL from environment
    expect(content).toContain('DATABASE_URL')
    expect(content).toContain('process.env')
  })

  // -----------------------------------------------------------
  // AC-8: docker-compose.yml
  // -----------------------------------------------------------
  it('AC-8: GIVEN docker-compose.yml existiert WHEN die Konfiguration gelesen wird THEN definiert sie einen PostgreSQL 16 Service mit Volume-Persistenz und konfigurierbaren Credentials via Environment-Variablen', () => {
    const composePath = resolve(ROOT, 'docker-compose.yml')
    expect(existsSync(composePath)).toBe(true)

    const content = readFileSync(composePath, 'utf-8')
    const config = parseYaml(content)

    // Find the postgres service (could be named anything)
    const services = config.services
    expect(services).toBeDefined()

    const postgresService = Object.values(services).find(
      (svc: any) => typeof svc.image === 'string' && svc.image.startsWith('postgres:16')
    ) as any
    expect(postgresService).toBeDefined()

    // PostgreSQL 16 image
    expect(postgresService.image).toMatch(/^postgres:16/)

    // Port 5432 exposed
    const ports = postgresService.ports?.map(String) ?? []
    expect(ports.some((p: string) => p.includes('5432'))).toBe(true)

    // Volume persistence
    expect(postgresService.volumes).toBeDefined()
    expect(postgresService.volumes.length).toBeGreaterThan(0)

    // Environment variables for credentials are configurable (using ${VAR:-default} syntax or similar)
    const env = postgresService.environment
    expect(env).toBeDefined()
    expect(env.POSTGRES_USER).toBeDefined()
    expect(env.POSTGRES_PASSWORD).toBeDefined()
    expect(env.POSTGRES_DB).toBeDefined()

    // Top-level volumes defined for persistence
    expect(config.volumes).toBeDefined()
  })
})
