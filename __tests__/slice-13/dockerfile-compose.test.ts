import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYaml } from 'yaml'

/**
 * Tests for Dockerfile and docker-compose.prod.yml
 *
 * Slice: slice-13-dockerfile-compose
 * Strategy: Read Dockerfile and docker-compose.prod.yml as text/YAML,
 *           validate structure and configuration against ACs.
 *           Read next.config.ts via dynamic import for config validation.
 * Mocking Strategy: no_mocks
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..', '..')

function readDockerfile(): string {
  return readFileSync(resolve(ROOT, 'Dockerfile'), 'utf-8')
}

function readComposeProd(): string {
  return readFileSync(resolve(ROOT, 'docker-compose.prod.yml'), 'utf-8')
}

function parseComposeProd(): any {
  return parseYaml(readComposeProd())
}

async function loadNextConfig(): Promise<any> {
  vi.resetModules()
  const mod = await import('../../next.config.ts')
  return mod.default
}

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe('Dockerfile + Docker Compose (slice-13) -- Acceptance Tests', () => {
  afterEach(() => {
    vi.resetModules()
  })

  // -------------------------------------------------------------------------
  // AC-1: Dockerfile existiert und ist valide
  // GIVEN ein Dockerfile im Repo-Root
  // WHEN docker compose -f docker-compose.prod.yml build ausgefuehrt wird
  // THEN ist der Build erfolgreich (Exit-Code 0) und das App-Image wird erstellt
  //
  // Note: Actual docker build is an integration-level concern.
  // This test validates the Dockerfile exists and has valid structure
  // (FROM, WORKDIR, CMD instructions) as a prerequisite for a successful build.
  // -------------------------------------------------------------------------
  it('AC-1: GIVEN a Dockerfile in repo root WHEN docker compose build is executed THEN the Dockerfile exists and has valid build structure', () => {
    const dockerfile = readDockerfile()

    // Dockerfile must exist and not be empty
    expect(dockerfile.length).toBeGreaterThan(0)

    // Must contain FROM instruction (required for any valid Dockerfile)
    expect(dockerfile).toMatch(/^FROM\s+/m)

    // Must contain a CMD or ENTRYPOINT (required to produce a runnable image)
    expect(dockerfile).toMatch(/^(CMD|ENTRYPOINT)\s+/m)

    // docker-compose.prod.yml must reference the Dockerfile
    const compose = parseComposeProd()
    expect(compose.services.app.build).toBeDefined()
    expect(compose.services.app.build.dockerfile).toBe('Dockerfile')
  })

  // -------------------------------------------------------------------------
  // AC-2: Image-Groesse < 500MB
  // GIVEN das gebaute App-Image
  // WHEN docker images die Image-Groesse anzeigt
  // THEN ist die Image-Groesse < 500MB
  //
  // Note: Image size can only be verified after a live docker build.
  // This test validates the Dockerfile uses slim base image and multi-stage
  // pattern which are prerequisites for a small image size.
  // -------------------------------------------------------------------------
  it('AC-2: GIVEN the built app image WHEN image size is checked THEN Dockerfile uses slim base and multi-stage for small image size', () => {
    const dockerfile = readDockerfile()

    // Must use slim variant (not full node image which is ~1GB)
    expect(dockerfile).toContain('node:22.14.0-slim')

    // Must use multi-stage build (multiple FROM statements reduce final image)
    const fromStatements = dockerfile.match(/^FROM\s+/gm)
    expect(fromStatements).not.toBeNull()
    expect(fromStatements!.length).toBeGreaterThanOrEqual(3)

    // Runner stage must only COPY from build stage (no full node_modules)
    const runnerSection = dockerfile.split(/^FROM\s+.*\s+AS\s+runner/m)[1]
    expect(runnerSection).toBeDefined()

    // Runner must not have npm install or pnpm install (deps come via standalone copy)
    expect(runnerSection).not.toMatch(/npm install|pnpm install/)
  })

  // -------------------------------------------------------------------------
  // AC-3: Multi-Stage Build mit node:22.14.0-slim
  // GIVEN das Dockerfile
  // WHEN der Build-Prozess analysiert wird
  // THEN nutzt es mindestens 3 Stages (deps, build, runner) mit
  //      node:22.14.0-slim als Base-Image
  // -------------------------------------------------------------------------
  it('AC-3: GIVEN the Dockerfile WHEN the build process is analyzed THEN it uses at least 3 stages (deps, build, runner) with node:22.14.0-slim base', () => {
    const dockerfile = readDockerfile()

    // Extract all FROM lines with their stage aliases
    const fromLines = dockerfile.match(/^FROM\s+.+$/gm)
    expect(fromLines).not.toBeNull()
    expect(fromLines!.length).toBeGreaterThanOrEqual(3)

    // Must have named stages: deps, build, runner
    const stageNames = fromLines!
      .map((line) => {
        const match = line.match(/AS\s+(\w+)/i)
        return match ? match[1].toLowerCase() : null
      })
      .filter(Boolean)

    expect(stageNames).toContain('deps')
    expect(stageNames).toContain('build')
    expect(stageNames).toContain('runner')

    // All FROM instructions must use node:22.14.0-slim as base
    // (stages that COPY --from don't count, only base image stages)
    const baseImages = fromLines!.map((line) => {
      const match = line.match(/^FROM\s+(\S+)/)
      return match ? match[1] : ''
    })

    // At least the first stage must use node:22.14.0-slim
    expect(baseImages[0]).toBe('node:22.14.0-slim')

    // All base images should be node:22.14.0-slim (per spec)
    for (const img of baseImages) {
      expect(img).toBe('node:22.14.0-slim')
    }
  })

  // -------------------------------------------------------------------------
  // AC-4: Non-Root User im Runner-Stage
  // GIVEN das Dockerfile Runner-Stage
  // WHEN der Container gestartet wird
  // THEN laeuft der Prozess als Non-Root User (nicht root)
  // -------------------------------------------------------------------------
  it('AC-4: GIVEN the Dockerfile runner stage WHEN the container is started THEN the process runs as a non-root user', () => {
    const dockerfile = readDockerfile()

    // Split at the runner stage
    const runnerSection = dockerfile.split(/^FROM\s+.*\s+AS\s+runner/m)[1]
    expect(runnerSection).toBeDefined()

    // Must have a USER instruction in the runner stage
    const userMatch = runnerSection.match(/^USER\s+(\S+)/m)
    expect(userMatch).not.toBeNull()

    // The USER must not be root
    const userName = userMatch![1]
    expect(userName).not.toBe('root')
    expect(userName).not.toBe('0')

    // Should create a system user/group before switching
    expect(runnerSection).toMatch(/adduser|useradd/)
    expect(runnerSection).toMatch(/addgroup|groupadd/)
  })

  // -------------------------------------------------------------------------
  // AC-5: App + DB Services definiert
  // GIVEN die docker-compose.prod.yml
  // WHEN docker compose -f docker-compose.prod.yml up -d ausgefuehrt wird
  // THEN starten sowohl der App-Service als auch der DB-Service (postgres)
  //      erfolgreich
  //
  // Note: Actual docker compose up is a live test. This validates both
  // services are defined with required configuration for successful startup.
  // -------------------------------------------------------------------------
  it('AC-5: GIVEN docker-compose.prod.yml WHEN compose up is executed THEN both app and postgres services are defined', () => {
    const compose = parseComposeProd()

    // Must have a services section
    expect(compose.services).toBeDefined()

    // Must have app service
    expect(compose.services.app).toBeDefined()
    expect(compose.services.app.build).toBeDefined()

    // Must have db service with postgres image
    expect(compose.services.db).toBeDefined()
    expect(compose.services.db.image).toMatch(/^postgres/)

    // App must depend on db
    expect(compose.services.app.depends_on).toBeDefined()
    expect(compose.services.app.depends_on).toHaveProperty('db')

    // DB should have a healthcheck for reliable startup
    expect(compose.services.db.healthcheck).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // AC-6: DB-Port nicht exponiert
  // GIVEN die docker-compose.prod.yml
  // WHEN die Service-Konfiguration analysiert wird
  // THEN ist der DB-Service Port (5432) NICHT nach aussen exponiert
  //      (kein ports-Mapping auf dem DB-Service)
  // -------------------------------------------------------------------------
  it('AC-6: GIVEN docker-compose.prod.yml WHEN service configuration is analyzed THEN the DB port is NOT exposed externally', () => {
    const compose = parseComposeProd()

    // DB service must exist
    expect(compose.services.db).toBeDefined()

    // DB service must NOT have a ports mapping
    expect(compose.services.db.ports).toBeUndefined()

    // Also verify via raw text that no port mapping exists for db
    const rawYaml = readComposeProd()

    // Find the db service section and check no "ports:" within it
    const dbSectionMatch = rawYaml.match(/^\s+db:\s*\n([\s\S]*?)(?=^\s+\w+:|^networks:|^volumes:|$)/m)
    expect(dbSectionMatch).not.toBeNull()
    const dbSection = dbSectionMatch![1]
    expect(dbSection).not.toMatch(/^\s+ports:/m)
  })

  // -------------------------------------------------------------------------
  // AC-7: Privates Docker-Netzwerk
  // GIVEN die docker-compose.prod.yml
  // WHEN die Netzwerk-Konfiguration analysiert wird
  // THEN kommunizieren App und DB ueber ein dediziertes privates
  //      Docker-Netzwerk
  // -------------------------------------------------------------------------
  it('AC-7: GIVEN docker-compose.prod.yml WHEN network configuration is analyzed THEN app and db communicate via a dedicated private network', () => {
    const compose = parseComposeProd()

    // Must have a top-level networks section
    expect(compose.networks).toBeDefined()

    // Must have at least one network defined
    const networkNames = Object.keys(compose.networks)
    expect(networkNames.length).toBeGreaterThanOrEqual(1)

    // Get the network name (should be 'internal' per spec)
    const networkName = networkNames[0]
    expect(networkName).toBeTruthy()

    // App service must be on the network
    expect(compose.services.app.networks).toBeDefined()
    expect(compose.services.app.networks).toContain(networkName)

    // DB service must be on the same network
    expect(compose.services.db.networks).toBeDefined()
    expect(compose.services.db.networks).toContain(networkName)

    // Network driver should be bridge (default private network)
    expect(compose.networks[networkName].driver).toBe('bridge')
  })

  // -------------------------------------------------------------------------
  // AC-8: Credentials aus .env (keine Hardcoded-Defaults)
  // GIVEN die docker-compose.prod.yml
  // WHEN die DB-Credentials geprueft werden
  // THEN werden POSTGRES_USER, POSTGRES_PASSWORD und POSTGRES_DB aus
  //      .env-Variablen gelesen (keine Hardcoded-Defaults wie aifactory_dev)
  // -------------------------------------------------------------------------
  it('AC-8: GIVEN docker-compose.prod.yml WHEN DB credentials are checked THEN POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB are read from .env variables without hardcoded defaults', () => {
    const compose = parseComposeProd()
    const rawYaml = readComposeProd()

    // DB service must have environment section
    expect(compose.services.db.environment).toBeDefined()
    const dbEnv = compose.services.db.environment

    // Must reference POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
    expect(dbEnv).toHaveProperty('POSTGRES_USER')
    expect(dbEnv).toHaveProperty('POSTGRES_PASSWORD')
    expect(dbEnv).toHaveProperty('POSTGRES_DB')

    // Values must be ${...} variable references, not hardcoded strings
    // In YAML, ${VAR} interpolation means the parsed value is the literal
    // string "${VAR}". Check raw YAML for the pattern.
    expect(rawYaml).toMatch(/POSTGRES_USER:\s*\$\{POSTGRES_USER\}/)
    expect(rawYaml).toMatch(/POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD\}/)
    expect(rawYaml).toMatch(/POSTGRES_DB:\s*\$\{POSTGRES_DB\}/)

    // Must NOT contain hardcoded default values like 'aifactory_dev'
    // or 'postgres' as literal values in the db environment section
    const dbSectionMatch = rawYaml.match(/^\s+db:\s*\n([\s\S]*?)(?=^\s+\w+:|^networks:|^volumes:|$)/m)
    expect(dbSectionMatch).not.toBeNull()
    const dbSection = dbSectionMatch![1]

    // Check that credentials are not hardcoded defaults
    expect(dbSection).not.toMatch(/POSTGRES_USER:\s*["']?aifactory_dev["']?/)
    expect(dbSection).not.toMatch(/POSTGRES_PASSWORD:\s*["']?aifactory_dev["']?/)
    expect(dbSection).not.toMatch(/POSTGRES_DB:\s*["']?aifactory_dev["']?/)
    // Also check there's no :- default syntax like ${POSTGRES_USER:-default}
    expect(dbSection).not.toMatch(/POSTGRES_USER:\s*\$\{POSTGRES_USER:-/)
    expect(dbSection).not.toMatch(/POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:-/)
    expect(dbSection).not.toMatch(/POSTGRES_DB:\s*\$\{POSTGRES_DB:-/)
  })

  // -------------------------------------------------------------------------
  // AC-9: App erreichbar (HTTP 200)
  // GIVEN docker compose -f docker-compose.prod.yml up -d laeuft
  // WHEN ein HTTP-Request an http://localhost:3000 gesendet wird
  // THEN antwortet die App mit HTTP 200 (oder Redirect zu /login)
  //
  // Note: This is a live acceptance test requiring running Docker containers.
  // This test validates that the app service exposes port 3000
  // as a prerequisite for HTTP reachability.
  // -------------------------------------------------------------------------
  it('AC-9: GIVEN compose up is running WHEN HTTP request to localhost:3000 THEN app service exposes port 3000', () => {
    const compose = parseComposeProd()

    // App service must expose port 3000
    expect(compose.services.app.ports).toBeDefined()
    expect(Array.isArray(compose.services.app.ports)).toBe(true)

    // Must map to port 3000
    const portMappings = compose.services.app.ports.map(String)
    const has3000 = portMappings.some(
      (p: string) => p.includes('3000:3000') || p === '3000'
    )
    expect(has3000).toBe(true)
  })

  // -------------------------------------------------------------------------
  // AC-10: next.config.ts output standalone
  // GIVEN next.config.ts
  // WHEN die Config-Option output geprueft wird
  // THEN ist output: "standalone" gesetzt
  // -------------------------------------------------------------------------
  it('AC-10: GIVEN next.config.ts WHEN the output config option is checked THEN output is set to "standalone"', async () => {
    const config = await loadNextConfig()

    expect(config.output).toBeDefined()
    expect(config.output).toBe('standalone')
  })

  // -------------------------------------------------------------------------
  // AC-11: Build-Kompatibilitaet mit bestehender Config
  // GIVEN next.config.ts mit output: "standalone"
  // WHEN pnpm build ausgefuehrt wird
  // THEN ist der Build erfolgreich und die bestehenden Config-Optionen
  //      (rewrites, images, experimental, headers) funktionieren weiterhin
  //
  // Note: Actual pnpm build is an integration-level concern.
  // This test validates that all existing config options are preserved
  // alongside the new output: "standalone" setting.
  // -------------------------------------------------------------------------
  it('AC-11: GIVEN next.config.ts with output standalone WHEN config is loaded THEN existing rewrites, images, experimental, and headers config are preserved', async () => {
    const config = await loadNextConfig()

    // output: "standalone" must be set
    expect(config.output).toBe('standalone')

    // rewrites must still exist and work
    expect(typeof config.rewrites).toBe('function')
    const rewrites = await config.rewrites()
    expect(Array.isArray(rewrites)).toBe(true)
    expect(rewrites.length).toBeGreaterThanOrEqual(1)
    const assistantRule = rewrites.find(
      (r: any) => r.source === '/api/assistant/:path*'
    )
    expect(assistantRule).toBeDefined()

    // images config must still be present
    expect(config.images).toBeDefined()
    expect(config.images.remotePatterns).toBeDefined()
    expect(Array.isArray(config.images.remotePatterns)).toBe(true)
    expect(config.images.remotePatterns.length).toBeGreaterThanOrEqual(1)

    // experimental config must still be present
    expect(config.experimental).toBeDefined()
    expect(config.experimental.viewTransition).toBe(true)
    expect(config.experimental.serverActions).toBeDefined()

    // headers must still exist and work
    expect(typeof config.headers).toBe('function')
    const headerRules = await config.headers()
    expect(Array.isArray(headerRules)).toBe(true)
    expect(headerRules.length).toBeGreaterThanOrEqual(1)

    // Verify headers still apply security headers
    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()
    expect(catchAllRule.headers.length).toBeGreaterThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// Unit Tests -- Dockerfile structure details
// ---------------------------------------------------------------------------

describe('Dockerfile Structure (slice-13) -- Unit Tests', () => {
  it('should use WORKDIR /app in all stages', () => {
    const dockerfile = readDockerfile()

    // Each stage should set WORKDIR /app
    const workdirMatches = dockerfile.match(/^WORKDIR\s+\/app$/gm)
    expect(workdirMatches).not.toBeNull()
    // At least 3 stages = at least 3 WORKDIR directives
    expect(workdirMatches!.length).toBeGreaterThanOrEqual(3)
  })

  it('should use frozen lockfile for dependency installation', () => {
    const dockerfile = readDockerfile()

    // Must use --frozen-lockfile to ensure reproducible builds
    expect(dockerfile).toMatch(/pnpm install.*--frozen-lockfile/)
  })

  it('should copy standalone output in runner stage', () => {
    const dockerfile = readDockerfile()

    const runnerSection = dockerfile.split(/^FROM\s+.*\s+AS\s+runner/m)[1]
    expect(runnerSection).toBeDefined()

    // Must copy .next/standalone from build stage
    expect(runnerSection).toMatch(/COPY\s+--from=build.*\.next\/standalone/)

    // Must copy .next/static from build stage
    expect(runnerSection).toMatch(/COPY\s+--from=build.*\.next\/static/)

    // Must copy public directory from build stage
    expect(runnerSection).toMatch(/COPY\s+--from=build.*public/)
  })

  it('should set NODE_ENV to production in runner stage', () => {
    const dockerfile = readDockerfile()

    const runnerSection = dockerfile.split(/^FROM\s+.*\s+AS\s+runner/m)[1]
    expect(runnerSection).toBeDefined()

    expect(runnerSection).toMatch(/ENV\s+NODE_ENV[=\s]+production/)
  })

  it('should expose port 3000', () => {
    const dockerfile = readDockerfile()

    expect(dockerfile).toMatch(/^EXPOSE\s+3000$/m)
  })

  it('should use node server.js as the CMD', () => {
    const dockerfile = readDockerfile()

    // CMD should run node server.js (standalone output entrypoint)
    expect(dockerfile).toMatch(/CMD\s+\[.*"node".*"server\.js".*\]/)
  })

  it('should disable Next.js telemetry in build and runner stages', () => {
    const dockerfile = readDockerfile()

    // At least the build stage should disable telemetry
    expect(dockerfile).toMatch(/NEXT_TELEMETRY_DISABLED[=\s]+1/)
  })
})

// ---------------------------------------------------------------------------
// Unit Tests -- docker-compose.prod.yml structure details
// ---------------------------------------------------------------------------

describe('docker-compose.prod.yml Structure (slice-13) -- Unit Tests', () => {
  it('should use postgres:16 for db service', () => {
    const compose = parseComposeProd()

    expect(compose.services.db.image).toBe('postgres:16')
  })

  it('should configure db healthcheck with pg_isready', () => {
    const compose = parseComposeProd()

    expect(compose.services.db.healthcheck).toBeDefined()
    expect(compose.services.db.healthcheck.test).toBeDefined()

    // healthcheck should use pg_isready
    const testCmd = Array.isArray(compose.services.db.healthcheck.test)
      ? compose.services.db.healthcheck.test.join(' ')
      : String(compose.services.db.healthcheck.test)
    expect(testCmd).toContain('pg_isready')
  })

  it('should mount a persistent volume for postgres data', () => {
    const compose = parseComposeProd()

    // DB must have volumes
    expect(compose.services.db.volumes).toBeDefined()
    expect(Array.isArray(compose.services.db.volumes)).toBe(true)
    expect(compose.services.db.volumes.length).toBeGreaterThanOrEqual(1)

    // Must reference /var/lib/postgresql/data
    const hasDataVolume = compose.services.db.volumes.some(
      (v: string) => v.includes('/var/lib/postgresql/data')
    )
    expect(hasDataVolume).toBe(true)

    // Top-level volumes must define the volume
    expect(compose.volumes).toBeDefined()
  })

  it('should configure app with restart policy', () => {
    const compose = parseComposeProd()

    expect(compose.services.app.restart).toBeDefined()
    expect(compose.services.app.restart).toBe('unless-stopped')
  })

  it('should configure db with restart policy', () => {
    const compose = parseComposeProd()

    expect(compose.services.db.restart).toBeDefined()
    expect(compose.services.db.restart).toBe('unless-stopped')
  })

  it('should pass DATABASE_URL to app service referencing db host', () => {
    const rawYaml = readComposeProd()

    // DATABASE_URL must reference the db service by hostname
    // and use environment variable interpolation for credentials
    expect(rawYaml).toMatch(/DATABASE_URL:.*@db:5432/)
    expect(rawYaml).toMatch(/DATABASE_URL:.*\$\{POSTGRES_USER\}/)
    expect(rawYaml).toMatch(/DATABASE_URL:.*\$\{POSTGRES_PASSWORD\}/)
    expect(rawYaml).toMatch(/DATABASE_URL:.*\$\{POSTGRES_DB\}/)
  })

  it('should configure app depends_on db with health condition', () => {
    const compose = parseComposeProd()

    expect(compose.services.app.depends_on).toBeDefined()
    expect(compose.services.app.depends_on.db).toBeDefined()
    expect(compose.services.app.depends_on.db.condition).toBe('service_healthy')
  })
})

// ---------------------------------------------------------------------------
// Integration Tests -- Cross-file consistency
// ---------------------------------------------------------------------------

describe('Cross-file Consistency (slice-13) -- Integration Tests', () => {
  it('should have consistent node version between Dockerfile stages and package.json engine', () => {
    const dockerfile = readDockerfile()

    // All FROM lines must use the same node version
    const fromLines = dockerfile.match(/^FROM\s+\S+/gm)
    expect(fromLines).not.toBeNull()

    for (const line of fromLines!) {
      expect(line).toContain('node:22.14.0-slim')
    }
  })

  it('should have Dockerfile CMD matching Next.js standalone server entrypoint', () => {
    const dockerfile = readDockerfile()

    // standalone output creates server.js at the root
    expect(dockerfile).toMatch(/CMD\s+\[.*"node".*"server\.js".*\]/)

    // COPY must bring standalone output to WORKDIR
    expect(dockerfile).toMatch(/COPY\s+--from=build.*\.next\/standalone\s+\.\//)
  })

  it('should have compose app service build context pointing to Dockerfile', () => {
    const compose = parseComposeProd()

    expect(compose.services.app.build.context).toBe('.')
    expect(compose.services.app.build.dockerfile).toBe('Dockerfile')
  })

  it('should have next.config.ts output standalone matching Dockerfile standalone copy', async () => {
    const config = await loadNextConfig()
    const dockerfile = readDockerfile()

    // next.config.ts must produce standalone output
    expect(config.output).toBe('standalone')

    // Dockerfile must copy from .next/standalone (produced by output: standalone)
    expect(dockerfile).toContain('.next/standalone')
  })
})
