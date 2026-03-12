import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Acceptance tests for slice-07-legacy-cleanup
 *
 * These tests verify that all legacy files (Prompt-Builder, Template-Selector,
 * Builder-Fragments, Prompt-Templates, Snippet-Service) have been removed,
 * imports/usage have been cleaned up, and the schema has been sanitized.
 *
 * Each test maps 1:1 to an Acceptance Criterion from the slice spec.
 */

const ROOT = resolve(__dirname, '../..')

describe('Slice 07: Legacy Cleanup Acceptance', () => {
  // ---------------------------------------------------------------------------
  // AC-1: prompt-builder Ordner geloescht
  // ---------------------------------------------------------------------------
  it('AC-1: GIVEN die Datei components/prompt-builder/ existiert als Ordner WHEN der Implementer den Slice abschliesst THEN existiert der gesamte Ordner components/prompt-builder/ nicht mehr', () => {
    const dir = resolve(ROOT, 'components/prompt-builder')
    expect(existsSync(dir)).toBe(false)

    // Also verify specific files that were listed in the AC
    const files = [
      'components/prompt-builder/builder-drawer.tsx',
      'components/prompt-builder/category-tabs.tsx',
      'components/prompt-builder/option-chip.tsx',
      'components/prompt-builder/snippet-form.tsx',
      'components/prompt-builder/surprise-me-button.tsx',
    ]
    for (const file of files) {
      expect(existsSync(resolve(ROOT, file))).toBe(false)
    }

    // Verify __tests__ subdirectory is also gone
    expect(existsSync(resolve(ROOT, 'components/prompt-builder/__tests__'))).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-2: template-selector geloescht
  // ---------------------------------------------------------------------------
  it('AC-2: GIVEN die Dateien components/workspace/template-selector.tsx und components/workspace/__tests__/template-selector.test.tsx existieren WHEN der Implementer den Slice abschliesst THEN existieren beide Dateien nicht mehr', () => {
    expect(
      existsSync(resolve(ROOT, 'components/workspace/template-selector.tsx'))
    ).toBe(false)

    expect(
      existsSync(resolve(ROOT, 'components/workspace/__tests__/template-selector.test.tsx'))
    ).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-3: lib-Dateien geloescht
  // ---------------------------------------------------------------------------
  it('AC-3: GIVEN die Dateien lib/builder-fragments.ts, lib/prompt-templates.ts, lib/services/snippet-service.ts existieren WHEN der Implementer den Slice abschliesst THEN existieren diese drei Dateien und deren Testdateien nicht mehr', () => {
    const filesToDelete = [
      'lib/builder-fragments.ts',
      'lib/prompt-templates.ts',
      'lib/services/snippet-service.ts',
      'lib/__tests__/builder-fragments.test.ts',
      'lib/__tests__/prompt-templates.test.ts',
      'lib/services/__tests__/snippet-service.test.ts',
    ]

    for (const file of filesToDelete) {
      expect(existsSync(resolve(ROOT, file))).toBe(false)
    }
  })

  // ---------------------------------------------------------------------------
  // AC-4: prompt-area.tsx bereinigt
  // ---------------------------------------------------------------------------
  it('AC-4: GIVEN prompt-area.tsx importiert BuilderDrawer und TemplateSelector WHEN der Implementer den Slice abschliesst THEN enthaelt prompt-area.tsx weder den Import noch die JSX-Usage von BuilderDrawer und TemplateSelector', () => {
    const filePath = resolve(ROOT, 'components/workspace/prompt-area.tsx')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')

    // No import of BuilderDrawer
    expect(content).not.toMatch(/import\s+.*BuilderDrawer/)
    expect(content).not.toMatch(/from\s+['"].*builder-drawer['"]/)

    // No import of TemplateSelector
    expect(content).not.toMatch(/import\s+.*TemplateSelector/)
    expect(content).not.toMatch(/from\s+['"].*template-selector['"]/)

    // No JSX usage of BuilderDrawer or TemplateSelector
    expect(content).not.toMatch(/<BuilderDrawer/)
    expect(content).not.toMatch(/<TemplateSelector/)
  })

  // ---------------------------------------------------------------------------
  // AC-5: prompts.ts bereinigt
  // ---------------------------------------------------------------------------
  it('AC-5: GIVEN prompts.ts exportiert createSnippet, updateSnippet, deleteSnippet, getSnippets und importiert SnippetService WHEN der Implementer den Slice abschliesst THEN exportiert die Datei nur noch getPromptHistory, getFavoritePrompts, toggleFavorite, improvePrompt', () => {
    const filePath = resolve(ROOT, 'app/actions/prompts.ts')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')

    // Must export these four functions
    expect(content).toMatch(/export\s+async\s+function\s+getPromptHistory/)
    expect(content).toMatch(/export\s+async\s+function\s+getFavoritePrompts/)
    expect(content).toMatch(/export\s+async\s+function\s+toggleFavorite/)
    expect(content).toMatch(/export\s+async\s+function\s+improvePrompt/)

    // Must NOT export snippet-related functions
    expect(content).not.toMatch(/export\s+.*createSnippet/)
    expect(content).not.toMatch(/export\s+.*updateSnippet/)
    expect(content).not.toMatch(/export\s+.*deleteSnippet/)
    expect(content).not.toMatch(/export\s+.*getSnippets/)

    // Must NOT import SnippetService
    expect(content).not.toMatch(/import\s+.*SnippetService/)
    expect(content).not.toMatch(/from\s+['"].*snippet-service['"]/)

    // Must NOT contain validateSnippetInput helper
    expect(content).not.toMatch(/validateSnippetInput/)
  })

  // ---------------------------------------------------------------------------
  // AC-6: schema.ts bereinigt
  // ---------------------------------------------------------------------------
  it('AC-6: GIVEN lib/db/schema.ts definiert die Tabelle promptSnippets WHEN der Implementer den Slice abschliesst THEN ist die promptSnippets Tabellendefinition und ihr Export aus schema.ts entfernt', () => {
    const filePath = resolve(ROOT, 'lib/db/schema.ts')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')

    // Must NOT contain promptSnippets table definition
    expect(content).not.toMatch(/promptSnippets/)
    expect(content).not.toMatch(/prompt_snippets/)

    // Must NOT export promptSnippets
    expect(content).not.toMatch(/export\s+.*promptSnippets/)
  })

  // ---------------------------------------------------------------------------
  // AC-7: prompts.test.ts bereinigt
  // ---------------------------------------------------------------------------
  it('AC-7: GIVEN prompts.test.ts mockt @/lib/services/snippet-service WHEN der Implementer den Slice abschliesst THEN sind die snippet-service Mocks und alle Snippet-bezogenen Tests aus prompts.test.ts entfernt', () => {
    const filePath = resolve(ROOT, 'app/actions/__tests__/prompts.test.ts')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')

    // Must NOT mock snippet-service
    expect(content).not.toMatch(/vi\.mock\(['"]@\/lib\/services\/snippet-service['"]\)/)
    expect(content).not.toMatch(/snippet-service/)

    // Must NOT contain snippet-related test descriptions
    expect(content).not.toMatch(/createSnippet/)
    expect(content).not.toMatch(/updateSnippet/)
    expect(content).not.toMatch(/deleteSnippet/)
    expect(content).not.toMatch(/getSnippets/)
    expect(content).not.toMatch(/SnippetService/)

    // Verify the remaining tests (improvePrompt) are still there
    expect(content).toMatch(/improvePrompt/)
  })

  // ---------------------------------------------------------------------------
  // AC-7 continued: prompts-history.test.ts still runs
  // ---------------------------------------------------------------------------
  it('AC-7 (continued): GIVEN prompts-history.test.ts verbleibende Tests WHEN die Datei inspiziert wird THEN existiert sie und enthaelt keine snippet-service Referenzen', () => {
    const filePath = resolve(ROOT, 'app/actions/__tests__/prompts-history.test.ts')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')

    // Must NOT mock snippet-service
    expect(content).not.toMatch(/snippet-service/)
    expect(content).not.toMatch(/SnippetService/)

    // Must still contain the history/favorite tests
    expect(content).toMatch(/getPromptHistory/)
    expect(content).toMatch(/toggleFavorite/)
  })

  // ---------------------------------------------------------------------------
  // AC-8: snippet-service Mocks aus verbleibenden Tests entfernt
  // ---------------------------------------------------------------------------
  it('AC-8: GIVEN die bestehenden Tests in prompt-area, prompt-tabs, variation-flow, model-trigger mocken snippet-service WHEN der Implementer den Slice abschliesst THEN sind alle snippet-service Mocks aus diesen Testdateien entfernt', () => {
    const testFiles = [
      'components/workspace/__tests__/prompt-area.test.tsx',
      'components/workspace/__tests__/prompt-area-structured.test.tsx',
      'components/workspace/__tests__/prompt-tabs.test.tsx',
      'components/lightbox/__tests__/variation-flow.test.tsx',
      'components/models/__tests__/model-trigger.test.tsx',
    ]

    for (const testFile of testFiles) {
      const filePath = resolve(ROOT, testFile)
      // The file must exist (these are NOT deleted, just cleaned up)
      expect(existsSync(filePath)).toBe(true)

      const content = readFileSync(filePath, 'utf-8')

      // Must NOT contain any snippet-service mock
      expect(content).not.toMatch(/snippet-service/)
      expect(content).not.toMatch(/SnippetService/)
    }
  })

  // ---------------------------------------------------------------------------
  // AC-9: Build erfolgreich
  // ---------------------------------------------------------------------------
  // Note: AC-9 requires running `pnpm build`. This is a heavyweight test
  // that verifies there are no dead imports or unresolved references.
  // It is covered by the integration command in the slice spec.
  // We validate the preconditions here: no dead references in source files.
  it('AC-9: GIVEN alle Aenderungen aus AC-1 bis AC-8 sind umgesetzt WHEN die Quell-Dateien inspiziert werden THEN gibt es keine Referenzen auf geloeschte Module', () => {
    // Check prompt-area.tsx has no references to deleted modules
    const promptAreaContent = readFileSync(
      resolve(ROOT, 'components/workspace/prompt-area.tsx'),
      'utf-8'
    )
    expect(promptAreaContent).not.toMatch(/builder-fragments/)
    expect(promptAreaContent).not.toMatch(/prompt-templates/)
    expect(promptAreaContent).not.toMatch(/snippet-service/)
    expect(promptAreaContent).not.toMatch(/template-selector/)
    expect(promptAreaContent).not.toMatch(/builder-drawer/)

    // Check prompts.ts has no references to deleted modules
    const promptsContent = readFileSync(
      resolve(ROOT, 'app/actions/prompts.ts'),
      'utf-8'
    )
    expect(promptsContent).not.toMatch(/snippet-service/)
    expect(promptsContent).not.toMatch(/builder-fragments/)
    expect(promptsContent).not.toMatch(/prompt-templates/)

    // Check schema.ts has no references to promptSnippets
    const schemaContent = readFileSync(
      resolve(ROOT, 'lib/db/schema.ts'),
      'utf-8'
    )
    expect(schemaContent).not.toMatch(/promptSnippets/)
    expect(schemaContent).not.toMatch(/prompt_snippets/)

    // Verify the "use server" directive is preserved in prompts.ts
    expect(promptsContent).toMatch(/^["']use server["']/)
  })
})
