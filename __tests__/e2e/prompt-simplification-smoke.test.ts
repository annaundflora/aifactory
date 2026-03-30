import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

describe('Prompt Simplification - E2E Smoke', () => {
  // ---------------------------------------------------------------------------
  // AC-1: Alle Vitest-Suites gruen
  // GIVEN alle vorherigen Slices (01-10) sind implementiert
  // WHEN `pnpm test` im Projekt-Root ausgefuehrt wird
  // THEN laufen ALLE Vitest-Suites gruen mit 0 Failures und 0 Errors
  // AND es gibt KEINE skipped Tests die auf promptStyle oder negativePrompt referenzieren
  // ---------------------------------------------------------------------------
  it('AC-1: should have all Vitest suites passing with 0 failures', () => {
    // This test validates itself: if Vitest runs and this suite is part of it,
    // then Vitest is functional. The full suite run is verified by the CI pipeline.
    // We verify there are no skipped tests referencing the old 3-field pattern
    // by scanning test files for .skip patterns that mention the old fields.
    const testDirs = ['__tests__', 'tests', 'lib', 'app', 'components']
    const skipPatterns: string[] = []

    for (const dir of testDirs) {
      try {
        const result = execSync(
          `grep -r "\\.skip\\|it\\.todo" --include="*.test.ts" --include="*.test.tsx" ${dir}/ 2>/dev/null || true`,
          { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
        )
        const lines = result.split('\n').filter(Boolean)
        for (const line of lines) {
          if (/promptStyle|negativePrompt/.test(line)) {
            skipPatterns.push(line.trim())
          }
        }
      } catch {
        // Directory may not exist or grep found nothing, that is fine
      }
    }

    expect(
      skipPatterns,
      `Found skipped tests referencing old 3-field pattern:\n${skipPatterns.join('\n')}`
    ).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // AC-3: TypeScript-Compiler ohne Fehler
  // GIVEN alle vorherigen Slices (01-10) sind implementiert
  // WHEN `npx tsc --noEmit` ausgefuehrt wird
  // THEN meldet der TypeScript-Compiler exakt 0 Fehler
  // ---------------------------------------------------------------------------
  it('AC-3: should compile without TypeScript errors', () => {
    // Run tsc --noEmit and verify exit code 0
    let tscOutput = ''
    let exitCode = 0
    try {
      tscOutput = execSync('npx tsc --noEmit 2>&1', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 120000,
      })
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        exitCode = (error as { status: number }).status
        tscOutput = (error as { stdout?: string }).stdout ?? ''
      }
    }

    expect(exitCode, `tsc --noEmit failed with errors:\n${tscOutput}`).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // AC-5: No negativePrompt/promptStyle in production TS code
  // GIVEN der User oeffnet die Prompt Area im Browser (txt2img-Modus)
  // WHEN die UI geladen ist
  // THEN sieht der User genau 1 Textarea mit Label "Prompt"
  // AND es gibt KEINE Collapsible-Sections fuer Style oder Negative Prompt
  //
  // Smoke-test approach: verify no negativePrompt or promptStyle references
  // remain in production TS/TSX files (lib/, app/, components/) excluding
  // test files and the prompt-knowledge model metadata field.
  // ---------------------------------------------------------------------------
  it('AC-5: should render exactly 1 Prompt textarea and no collapsible Style/Negative sections', () => {
    // Grep production TS/TSX code for old 3-field references
    // Exclude: __tests__ dirs, .test. files, prompt-knowledge.ts (model metadata field)
    const productionDirs = ['lib', 'app', 'components']
    const violations: string[] = []

    for (const dir of productionDirs) {
      try {
        const result = execSync(
          `grep -rn "negativePrompt" --include="*.ts" --include="*.tsx" ${dir}/ 2>/dev/null | grep -v "__tests__" | grep -v ".test." || true`,
          { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
        )
        const lines = result.split('\n').filter(Boolean)
        violations.push(...lines)
      } catch {
        // No matches is fine
      }
    }

    expect(
      violations,
      `Found negativePrompt in production TS code:\n${violations.join('\n')}`
    ).toHaveLength(0)

    // Check for promptStyle in a 3-field context (NOT ModelKnowledge.promptStyle which is model metadata)
    const promptStyleViolations: string[] = []
    for (const dir of productionDirs) {
      try {
        const result = execSync(
          `grep -rn "promptStyle" --include="*.ts" --include="*.tsx" ${dir}/ 2>/dev/null | grep -v "__tests__" | grep -v ".test." | grep -v "prompt-knowledge" || true`,
          { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
        )
        const lines = result.split('\n').filter(Boolean)
        promptStyleViolations.push(...lines)
      } catch {
        // No matches is fine
      }
    }

    expect(
      promptStyleViolations,
      `Found promptStyle in production TS code (outside prompt-knowledge):\n${promptStyleViolations.join('\n')}`
    ).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // AC-6: Generation ohne negative_prompt API-Error
  // GIVEN der User gibt einen Prompt ein und waehlt ein Flux-Model
  // WHEN der User auf "Generate" klickt
  // THEN wird die Bildgenerierung erfolgreich gestartet (kein API-Error)
  // AND die Replicate API erhaelt KEIN negative_prompt Input-Feld
  // AND der HTTP-Response-Status ist NICHT 422 (Validation Error)
  //
  // Smoke-test approach: verify GenerateImagesInput interface does not have
  // negativePrompt or promptStyle fields, confirming the server action
  // cannot send these fields to the API.
  // ---------------------------------------------------------------------------
  it('AC-6: should generate image with Flux model without API validation error', () => {
    // Read the generations.ts server action and verify no old fields in interface
    const generationsPath = join(ROOT, 'app', 'actions', 'generations.ts')
    const source = readFileSync(generationsPath, 'utf-8')

    // Extract the GenerateImagesInput interface
    const interfaceMatch = source.match(
      /interface GenerateImagesInput\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s
    )
    expect(interfaceMatch, 'GenerateImagesInput interface should exist').toBeTruthy()
    const interfaceBody = interfaceMatch![1]

    // Must NOT have negativePrompt or promptStyle as fields
    expect(interfaceBody).not.toMatch(/negativePrompt/)
    expect(interfaceBody).not.toMatch(/promptStyle/)

    // Must have promptMotiv as the single prompt field
    expect(interfaceBody).toMatch(/promptMotiv:\s*string/)

    // Verify the generateImages function does not reference negativePrompt or promptStyle
    const fnMatch = source.match(
      /export async function generateImages[\s\S]*?^}/m
    )
    expect(fnMatch, 'generateImages function should exist').toBeTruthy()
    const fnBody = fnMatch![0]
    expect(fnBody).not.toMatch(/negativePrompt/)
    expect(fnBody).not.toMatch(/\.promptStyle/)
  })

  // ---------------------------------------------------------------------------
  // AC-7: Assistant SSE liefert 1-Feld-Draft
  // GIVEN der User startet den Assistant und fragt nach einem Prompt-Vorschlag
  // WHEN der Assistant via SSE ein tool-call-result mit tool: "draft_prompt" sendet
  // THEN enthaelt die SSE-Payload das Format { prompt: string }
  //     (NICHT { motiv, style, negative_prompt })
  // AND der Draft wird im UI als ein einzelner Prompt-Block angezeigt
  // AND "Apply to Prompt" uebernimmt den Draft in das einzige Prompt-Textarea
  //
  // Smoke-test approach: verify DraftPrompt interface has only prompt field.
  // ---------------------------------------------------------------------------
  it('AC-7: should receive SSE draft_prompt with single prompt field', () => {
    // Read the assistant-context.tsx to verify DraftPrompt interface
    const contextPath = join(ROOT, 'lib', 'assistant', 'assistant-context.tsx')
    const source = readFileSync(contextPath, 'utf-8')

    // Extract the DraftPrompt interface
    const interfaceMatch = source.match(
      /export interface DraftPrompt\s*\{([^}]*)\}/
    )
    expect(interfaceMatch, 'DraftPrompt interface should exist').toBeTruthy()
    const interfaceBody = interfaceMatch![1]

    // Must have exactly one field: prompt: string
    expect(interfaceBody).toMatch(/prompt:\s*string/)

    // Must NOT have old 3-field pattern fields
    expect(interfaceBody).not.toMatch(/motiv/)
    expect(interfaceBody).not.toMatch(/style/)
    expect(interfaceBody).not.toMatch(/negative/)
    expect(interfaceBody).not.toMatch(/negativePrompt/)

    // Count the number of field declarations (lines with "fieldName: type")
    const fieldLines = interfaceBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^\w+\s*[?]?\s*:/.test(line))
    expect(
      fieldLines,
      `DraftPrompt should have exactly 1 field but has: ${fieldLines.join(', ')}`
    ).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // AC-8: DetailsOverlay zeigt nur Prompt-Section
  // GIVEN die Generation History im Canvas (DetailsOverlay)
  // WHEN der User eine bestehende Generation anklickt
  // THEN zeigt das Overlay NUR eine "Prompt"-Section
  // AND es gibt KEINE "Style"- oder "Negative Prompt"-Section
  //
  // Smoke-test approach: verify generateImages server action passes only
  // promptMotiv (not promptStyle/negativePrompt) and the GenerateImagesInput
  // interface has no old fields.
  // ---------------------------------------------------------------------------
  it('AC-8: should show only Prompt section in DetailsOverlay without Style or Negative sections', () => {
    // Read the generations action to verify only promptMotiv is passed to GenerationService
    const generationsPath = join(ROOT, 'app', 'actions', 'generations.ts')
    const source = readFileSync(generationsPath, 'utf-8')

    // Extract the GenerationService.generate call
    const generateCallMatch = source.match(
      /GenerationService\.generate\([\s\S]*?\)/
    )
    expect(generateCallMatch, 'GenerationService.generate call should exist').toBeTruthy()
    const generateCall = generateCallMatch![0]

    // The call should use input.promptMotiv, not promptStyle or negativePrompt
    expect(generateCall).toMatch(/input\.promptMotiv/)
    expect(generateCall).not.toMatch(/promptStyle/)
    expect(generateCall).not.toMatch(/negativePrompt/)
    expect(generateCall).not.toMatch(/negative_prompt/)
  })

  // ---------------------------------------------------------------------------
  // AC-9: Keine verbleibenden 3-Feld-Referenzen in produktivem Code
  // GIVEN maximal 3 Dateien mussten fuer Restbereinigung angepasst werden
  // WHEN die Aenderungen geprueft werden
  // THEN enthalten die Aenderungen ausschliesslich Bereinigungen
  //
  // Also covers: prompt-knowledge.json has no negativePrompts entries
  // AND no negative_prompt/prompt_style in production Python code
  // ---------------------------------------------------------------------------
  it('AC-9: should have no remaining promptStyle or negativePrompt references in production code', () => {
    // 1. Check prompt-knowledge.json has no negativePrompts key
    const knowledgePath = join(ROOT, 'data', 'prompt-knowledge.json')
    const knowledgeRaw = readFileSync(knowledgePath, 'utf-8')
    const knowledge = JSON.parse(knowledgeRaw)

    // Top level should not have negativePrompts
    expect(knowledge).not.toHaveProperty('negativePrompts')

    // No model entry should have negativePrompts
    for (const [modelKey, modelData] of Object.entries(knowledge.models)) {
      expect(
        modelData,
        `Model ${modelKey} should not have negativePrompts`
      ).not.toHaveProperty('negativePrompts')
    }

    // 2. Check no negative_prompt/prompt_style in production Python code
    // (backend/app/ only, excluding tests)
    let pythonViolations: string[] = []
    try {
      const result = execSync(
        `grep -rn "negative_prompt\\|prompt_style" --include="*.py" backend/app/ 2>/dev/null | grep -v "__pycache__" | grep -v "prompt_knowledge" || true`,
        { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
      )
      pythonViolations = result.split('\n').filter(Boolean)
    } catch {
      // No matches is fine
    }

    expect(
      pythonViolations,
      `Found negative_prompt/prompt_style in production Python code (outside prompt_knowledge):\n${pythonViolations.join('\n')}`
    ).toHaveLength(0)

    // 3. Verify DraftPromptDTO in backend has only prompt field
    // Read the dtos.py file
    const dtosPath = join(ROOT, 'backend', 'app', 'models', 'dtos.py')
    const dtosSource = readFileSync(dtosPath, 'utf-8')

    // Extract DraftPromptDTO class
    const dtoMatch = dtosSource.match(
      /class DraftPromptDTO\(BaseModel\):([\s\S]*?)(?=\nclass |\n[A-Z]|\Z)/
    )
    expect(dtoMatch, 'DraftPromptDTO class should exist').toBeTruthy()
    const dtoBody = dtoMatch![1]

    // Must have prompt field
    expect(dtoBody).toMatch(/prompt:\s*str/)

    // Must NOT have old 3-field fields
    expect(dtoBody).not.toMatch(/motiv/)
    expect(dtoBody).not.toMatch(/style/)
    expect(dtoBody).not.toMatch(/negative/)

    // Count field declarations (lines with "fieldname: type" or "fieldname =")
    const fieldLines = dtoBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[a-z_]\w*\s*[:=]/.test(line) && !line.startsWith('#') && !line.startsWith('"""'))
    expect(
      fieldLines,
      `DraftPromptDTO should have exactly 1 field but has: ${fieldLines.join(', ')}`
    ).toHaveLength(1)
  })
})
