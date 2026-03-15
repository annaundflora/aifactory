import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYaml } from 'yaml'

/**
 * Tests for Caddyfile, docker-compose.prod.yml (Caddy extension) and .env.example
 *
 * Slice: slice-14-caddy-env
 * Strategy: Read files as text/YAML, validate structure and configuration against ACs.
 * Mocking Strategy: no_mocks
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..', '..')

function readCaddyfile(): string {
  return readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8')
}

function readComposeProd(): string {
  return readFileSync(resolve(ROOT, 'docker-compose.prod.yml'), 'utf-8')
}

function parseComposeProd(): any {
  return parseYaml(readComposeProd())
}

function readEnvExample(): string {
  return readFileSync(resolve(ROOT, '.env.example'), 'utf-8')
}

/**
 * Extract all variable names from the .env.example file.
 * Matches lines like `VAR_NAME=` or `VAR_NAME=value` (ignoring comments).
 */
function extractEnvVarNames(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line.trim()))
    .map((line) => line.trim().split('=')[0])
}

// ===========================================================================
// Acceptance Tests
// ===========================================================================

describe('Caddy + .env.example (slice-14) -- Acceptance Tests', () => {
  // -------------------------------------------------------------------------
  // AC-1: DOMAIN Environment-Variable in Caddyfile
  // GIVEN ein Caddyfile im Repo-Root
  // WHEN die Caddy-Konfiguration analysiert wird
  // THEN verwendet es die {$DOMAIN} Environment-Variable als Site-Adresse
  // -------------------------------------------------------------------------
  it('AC-1: GIVEN a Caddyfile in repo root WHEN the Caddy configuration is analyzed THEN it uses the {$DOMAIN} environment variable as site address', () => {
    const caddyfile = readCaddyfile()

    // Caddyfile must exist and not be empty
    expect(caddyfile.length).toBeGreaterThan(0)

    // Must use {$DOMAIN} as the site address (first token before the block)
    // Caddy uses {$VAR} syntax for environment variable substitution
    expect(caddyfile).toContain('{$DOMAIN}')

    // {$DOMAIN} should appear as the site address (at the start of a server block)
    expect(caddyfile).toMatch(/^\{?\$DOMAIN\}?\s*\{/m)
  })

  // -------------------------------------------------------------------------
  // AC-2: Reverse Proxy zu app:3000
  // GIVEN das Caddyfile
  // WHEN die Reverse-Proxy-Konfiguration analysiert wird
  // THEN leitet es alle Requests an den App-Service auf Port 3000 weiter
  //      (z.B. app:3000)
  // -------------------------------------------------------------------------
  it('AC-2: GIVEN the Caddyfile WHEN the reverse proxy configuration is analyzed THEN it forwards all requests to the app service on port 3000', () => {
    const caddyfile = readCaddyfile()

    // Must contain a reverse_proxy directive
    expect(caddyfile).toMatch(/reverse_proxy/)

    // Must proxy to app:3000 (the Docker service name and internal port)
    expect(caddyfile).toMatch(/reverse_proxy\s+app:3000/)
  })

  // -------------------------------------------------------------------------
  // AC-3: Caddy Service mit korrektem Image
  // GIVEN die docker-compose.prod.yml aus Slice 13
  // WHEN der Caddy-Service ergaenzt wird
  // THEN existiert ein caddy Service mit Image caddy:2.11.2-alpine
  // -------------------------------------------------------------------------
  it('AC-3: GIVEN docker-compose.prod.yml WHEN the Caddy service is added THEN a caddy service exists with image caddy:2.11.2-alpine', () => {
    const compose = parseComposeProd()

    // Must have a caddy service
    expect(compose.services.caddy).toBeDefined()

    // Must use the exact image specified
    expect(compose.services.caddy.image).toBe('caddy:2.11.2-alpine')
  })

  // -------------------------------------------------------------------------
  // AC-4: Ports 80 und 443 exponiert
  // GIVEN der caddy Service in docker-compose.prod.yml
  // WHEN die Port-Konfiguration analysiert wird
  // THEN exponiert er Port 80 und Port 443 nach aussen
  // -------------------------------------------------------------------------
  it('AC-4: GIVEN the caddy service in docker-compose.prod.yml WHEN the port configuration is analyzed THEN it exposes port 80 and port 443 externally', () => {
    const compose = parseComposeProd()

    // Caddy must have ports defined
    expect(compose.services.caddy.ports).toBeDefined()
    expect(Array.isArray(compose.services.caddy.ports)).toBe(true)

    const portMappings = compose.services.caddy.ports.map(String)

    // Must expose port 80
    const has80 = portMappings.some(
      (p: string) => p.includes('80:80') || p === '80'
    )
    expect(has80).toBe(true)

    // Must expose port 443
    const has443 = portMappings.some(
      (p: string) => p.includes('443:443') || p === '443'
    )
    expect(has443).toBe(true)
  })

  // -------------------------------------------------------------------------
  // AC-5: Caddyfile-Mount und persistente Volumes
  // GIVEN der caddy Service in docker-compose.prod.yml
  // WHEN die Volume-Konfiguration analysiert wird
  // THEN mountet er das Caddyfile als Config und hat persistente Volumes
  //      fuer caddy_data (SSL-Zertifikate) und caddy_config
  // -------------------------------------------------------------------------
  it('AC-5: GIVEN the caddy service in docker-compose.prod.yml WHEN the volume configuration is analyzed THEN it mounts the Caddyfile and defines caddy_data and caddy_config volumes', () => {
    const compose = parseComposeProd()

    // Caddy must have volumes
    expect(compose.services.caddy.volumes).toBeDefined()
    expect(Array.isArray(compose.services.caddy.volumes)).toBe(true)

    const volumes = compose.services.caddy.volumes.map(String)

    // Must mount the Caddyfile (e.g. ./Caddyfile:/etc/caddy/Caddyfile)
    const hasCaddyfileMount = volumes.some(
      (v: string) => v.includes('Caddyfile') && v.includes('/etc/caddy/')
    )
    expect(hasCaddyfileMount).toBe(true)

    // Must have caddy_data volume (for SSL certificates)
    const hasCaddyData = volumes.some((v: string) => v.includes('caddy_data'))
    expect(hasCaddyData).toBe(true)

    // Must have caddy_config volume
    const hasCaddyConfig = volumes.some((v: string) =>
      v.includes('caddy_config')
    )
    expect(hasCaddyConfig).toBe(true)

    // caddy_data and caddy_config must be defined as top-level volumes
    expect(compose.volumes).toBeDefined()
    expect(compose.volumes).toHaveProperty('caddy_data')
    expect(compose.volumes).toHaveProperty('caddy_config')
  })

  // -------------------------------------------------------------------------
  // AC-6: Caddy im privaten Netzwerk
  // GIVEN der caddy Service in docker-compose.prod.yml
  // WHEN die Netzwerk-Konfiguration analysiert wird
  // THEN ist er im selben privaten Netzwerk wie App und DB (aus Slice 13)
  // -------------------------------------------------------------------------
  it('AC-6: GIVEN the caddy service in docker-compose.prod.yml WHEN the network configuration is analyzed THEN it is in the same private network as app and db', () => {
    const compose = parseComposeProd()

    // Get the network names from the top-level networks section
    expect(compose.networks).toBeDefined()
    const networkNames = Object.keys(compose.networks)
    expect(networkNames.length).toBeGreaterThanOrEqual(1)

    // All three services must share the same network
    const sharedNetwork = networkNames[0]

    expect(compose.services.app.networks).toBeDefined()
    expect(compose.services.app.networks).toContain(sharedNetwork)

    expect(compose.services.db.networks).toBeDefined()
    expect(compose.services.db.networks).toContain(sharedNetwork)

    expect(compose.services.caddy.networks).toBeDefined()
    expect(compose.services.caddy.networks).toContain(sharedNetwork)
  })

  // -------------------------------------------------------------------------
  // AC-7: depends_on app
  // GIVEN der caddy Service in docker-compose.prod.yml
  // WHEN die Service-Dependencies analysiert werden
  // THEN haengt er vom app Service ab (depends_on)
  // -------------------------------------------------------------------------
  it('AC-7: GIVEN the caddy service in docker-compose.prod.yml WHEN service dependencies are analyzed THEN it depends on the app service', () => {
    const compose = parseComposeProd()

    // Caddy must have depends_on
    expect(compose.services.caddy.depends_on).toBeDefined()

    // depends_on can be an array or object; handle both
    const dependsOn = compose.services.caddy.depends_on
    if (Array.isArray(dependsOn)) {
      expect(dependsOn).toContain('app')
    } else {
      expect(dependsOn).toHaveProperty('app')
    }
  })

  // -------------------------------------------------------------------------
  // AC-8: Valide Compose-Konfiguration
  // GIVEN die docker-compose.prod.yml mit Caddy-Service
  // WHEN docker compose -f docker-compose.prod.yml config --quiet ausgefuehrt wird
  // THEN ist die Compose-Konfiguration valide (Exit-Code 0)
  //
  // Note: Actual docker compose config is an integration-level concern.
  // This test validates the YAML is parseable and structurally valid.
  // -------------------------------------------------------------------------
  it('AC-8: GIVEN docker-compose.prod.yml with caddy service WHEN the compose file is parsed THEN the YAML is structurally valid', () => {
    // Must parse without throwing
    const compose = parseComposeProd()

    // Must have the expected top-level keys
    expect(compose.services).toBeDefined()
    expect(compose.networks).toBeDefined()
    expect(compose.volumes).toBeDefined()

    // Must have all three services
    expect(Object.keys(compose.services)).toContain('app')
    expect(Object.keys(compose.services)).toContain('db')
    expect(Object.keys(compose.services)).toContain('caddy')
  })

  // -------------------------------------------------------------------------
  // AC-9: Required Auth/Deployment Vars in .env.example
  // GIVEN eine .env.example im Repo-Root
  // WHEN die Datei gelesen wird
  // THEN enthaelt sie mindestens diese Required Vars: AUTH_SECRET,
  //      AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS, DATABASE_URL,
  //      DOMAIN
  // -------------------------------------------------------------------------
  it('AC-9: GIVEN .env.example in repo root WHEN the file is read THEN it contains AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS, DATABASE_URL, DOMAIN', () => {
    const envContent = readEnvExample()
    const varNames = extractEnvVarNames(envContent)

    const requiredVars = [
      'AUTH_SECRET',
      'AUTH_GOOGLE_ID',
      'AUTH_GOOGLE_SECRET',
      'ALLOWED_EMAILS',
      'DATABASE_URL',
      'DOMAIN',
    ]

    for (const varName of requiredVars) {
      expect(
        varNames,
        `Expected .env.example to contain ${varName}`
      ).toContain(varName)
    }
  })

  // -------------------------------------------------------------------------
  // AC-10: Bestehende App-Vars in .env.example
  // GIVEN die .env.example
  // WHEN die Datei gelesen wird
  // THEN enthaelt sie auch die bestehenden App-Vars: OPENROUTER_API_KEY,
  //      REPLICATE_API_TOKEN, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
  //      R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL
  // -------------------------------------------------------------------------
  it('AC-10: GIVEN .env.example WHEN the file is read THEN it contains OPENROUTER_API_KEY, REPLICATE_API_TOKEN, and R2 storage vars', () => {
    const envContent = readEnvExample()
    const varNames = extractEnvVarNames(envContent)

    const appVars = [
      'OPENROUTER_API_KEY',
      'REPLICATE_API_TOKEN',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_ENDPOINT',
      'R2_BUCKET',
      'R2_PUBLIC_URL',
    ]

    for (const varName of appVars) {
      expect(
        varNames,
        `Expected .env.example to contain ${varName}`
      ).toContain(varName)
    }
  })

  // -------------------------------------------------------------------------
  // AC-11: DB-Credentials in .env.example
  // GIVEN die .env.example
  // WHEN die Datei gelesen wird
  // THEN enthaelt sie auch die DB-Credentials fuer Docker: POSTGRES_USER,
  //      POSTGRES_PASSWORD, POSTGRES_DB
  // -------------------------------------------------------------------------
  it('AC-11: GIVEN .env.example WHEN the file is read THEN it contains POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB', () => {
    const envContent = readEnvExample()
    const varNames = extractEnvVarNames(envContent)

    const dbVars = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']

    for (const varName of dbVars) {
      expect(
        varNames,
        `Expected .env.example to contain ${varName}`
      ).toContain(varName)
    }
  })

  // -------------------------------------------------------------------------
  // AC-12: Keine echten Secrets
  // GIVEN die .env.example
  // WHEN auf sensible Werte geprueft wird
  // THEN enthaelt sie KEINE echten Secrets/Tokens/Passwoerter -- nur
  //      Platzhalter (z.B. your-secret-here, leere Werte oder Beschreibungen)
  // -------------------------------------------------------------------------
  it('AC-12: GIVEN .env.example WHEN checked for sensitive values THEN it contains NO real secrets -- only placeholders or empty values', () => {
    const envContent = readEnvExample()

    // Extract all key=value lines (non-comment, non-empty)
    const varLines = envContent
      .split('\n')
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line.trim()))

    for (const line of varLines) {
      const [key, ...valueParts] = line.trim().split('=')
      const value = valueParts.join('=').trim()

      // Value should be empty, a placeholder, or a description
      // It must NOT look like a real secret (long random string, actual token)
      if (value.length > 0) {
        // Should not look like a real base64 secret (32+ chars of random chars)
        expect(
          value,
          `${key} appears to contain a real secret`
        ).not.toMatch(/^[A-Za-z0-9+/=]{32,}$/)

        // Should not look like an API key pattern (sk-, pk-, etc.)
        expect(value, `${key} appears to contain an API key`).not.toMatch(
          /^(sk|pk|rk|whsec|xoxb|xoxp)-[a-zA-Z0-9]{10,}/
        )

        // Should not look like a JWT token
        expect(value, `${key} appears to contain a JWT token`).not.toMatch(
          /^eyJ[a-zA-Z0-9._-]{20,}$/
        )

        // Should not look like a UUID-based credential
        expect(
          value,
          `${key} appears to contain a UUID credential`
        ).not.toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      }
    }
  })
})

// ===========================================================================
// Unit Tests -- Caddyfile structure
// ===========================================================================

describe('Caddyfile Structure (slice-14) -- Unit Tests', () => {
  it('should be a minimal, valid Caddyfile with a single server block', () => {
    const caddyfile = readCaddyfile()

    // Must contain an opening and closing brace (server block)
    expect(caddyfile).toContain('{')
    expect(caddyfile).toContain('}')

    // Should have exactly one server block (one site address)
    const openBraces = (caddyfile.match(/\{/g) || []).length
    const closeBraces = (caddyfile.match(/\}/g) || []).length
    // {$DOMAIN} contains a {, but the server block also has { and }
    // The Caddyfile should be compact -- at most a few braces
    expect(closeBraces).toBeGreaterThanOrEqual(1)
    expect(openBraces).toBe(closeBraces)
  })

  it('should not contain hardcoded domain names', () => {
    const caddyfile = readCaddyfile()

    // Must NOT contain hardcoded domains (should use {$DOMAIN} env var)
    expect(caddyfile).not.toMatch(/localhost/)
    expect(caddyfile).not.toMatch(/example\.com/)
    expect(caddyfile).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
  })
})

// ===========================================================================
// Unit Tests -- docker-compose.prod.yml caddy service details
// ===========================================================================

describe('docker-compose.prod.yml Caddy Service (slice-14) -- Unit Tests', () => {
  it('should configure caddy with restart policy', () => {
    const compose = parseComposeProd()

    expect(compose.services.caddy.restart).toBeDefined()
    expect(compose.services.caddy.restart).toBe('unless-stopped')
  })

  it('should pass DOMAIN environment variable to caddy container', () => {
    const compose = parseComposeProd()

    // Caddy must have environment section with DOMAIN
    expect(compose.services.caddy.environment).toBeDefined()
    expect(compose.services.caddy.environment).toHaveProperty('DOMAIN')

    // In raw YAML, verify it uses ${DOMAIN} interpolation
    const rawYaml = readComposeProd()
    expect(rawYaml).toMatch(/DOMAIN:\s*\$\{DOMAIN\}/)
  })

  it('should mount Caddyfile as read-only', () => {
    const rawYaml = readComposeProd()

    // The Caddyfile mount should be read-only (:ro)
    expect(rawYaml).toMatch(/Caddyfile.*:ro/)
  })

  it('should NOT expose app port 3000 externally (caddy proxies instead)', () => {
    const compose = parseComposeProd()

    // The app service should NOT have a ports mapping (only expose)
    // because Caddy handles external traffic
    const appService = compose.services.app
    expect(appService.ports).toBeUndefined()
  })
})

// ===========================================================================
// Integration Tests -- Cross-file consistency
// ===========================================================================

describe('Cross-file Consistency (slice-14) -- Integration Tests', () => {
  it('should have Caddyfile reverse_proxy target matching the app service internal port in compose', () => {
    const caddyfile = readCaddyfile()
    const compose = parseComposeProd()

    // Caddyfile must proxy to app:3000
    expect(caddyfile).toContain('app:3000')

    // The app service must expose port 3000 internally
    const appExpose = compose.services.app.expose
    expect(appExpose).toBeDefined()
    expect(appExpose.map(String)).toContain('3000')
  })

  it('should have DOMAIN variable in both compose caddy environment and .env.example', () => {
    const compose = parseComposeProd()
    const envContent = readEnvExample()
    const varNames = extractEnvVarNames(envContent)

    // Compose caddy service must reference DOMAIN
    expect(compose.services.caddy.environment).toHaveProperty('DOMAIN')

    // .env.example must document DOMAIN
    expect(varNames).toContain('DOMAIN')
  })

  it('should have all compose environment variables documented in .env.example', () => {
    const rawYaml = readComposeProd()
    const envContent = readEnvExample()
    const envVarNames = extractEnvVarNames(envContent)

    // Extract all ${VAR} references from docker-compose.prod.yml
    const composeVarRefs = new Set<string>()
    const varPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g
    let match
    while ((match = varPattern.exec(rawYaml)) !== null) {
      composeVarRefs.add(match[1])
    }

    // Every variable referenced in compose must be documented in .env.example
    for (const varName of composeVarRefs) {
      expect(
        envVarNames,
        `Expected .env.example to document ${varName} (referenced in docker-compose.prod.yml)`
      ).toContain(varName)
    }
  })

  it('should have caddy_data and caddy_config in top-level volumes section', () => {
    const compose = parseComposeProd()

    // Top-level volumes must include caddy_data and caddy_config
    expect(compose.volumes).toHaveProperty('caddy_data')
    expect(compose.volumes).toHaveProperty('caddy_config')

    // Also must still have postgres volume from slice-13
    const volumeNames = Object.keys(compose.volumes)
    const hasPostgresVolume = volumeNames.some((v) => v.includes('postgres'))
    expect(hasPostgresVolume).toBe(true)
  })
})
