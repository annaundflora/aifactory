import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Slice 12: Cleanup — Unit Tests
 *
 * These tests verify the structural correctness of migrated consumer files.
 * They ensure the Model type contract is correctly used throughout the codebase
 * after migration from CollectionModel.
 *
 * Mocking Strategy: no_mocks
 */

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

// =========================================================================
// model-card.tsx: Model type field usage
// =========================================================================

describe('model-card.tsx — Model type field access', () => {
  const filePath = path.join(PROJECT_ROOT, 'components', 'models', 'model-card.tsx')

  it('should access Model-specific fields that differ from CollectionModel (coverImageUrl, runCount, owner)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // The Drizzle Model type uses coverImageUrl (not "url" or "imageUrl" from CollectionModel)
    expect(content).toMatch(/model\.coverImageUrl/)

    // runCount is a nullable field on the Model type
    expect(content).toMatch(/model\.runCount/)

    // owner is a separate field on Model (not embedded in "url" like CollectionModel)
    expect(content).toMatch(/model\.owner/)

    // description is nullable text on Model
    expect(content).toMatch(/model\.description/)
  })

  it('should handle nullable runCount with fallback', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // runCount can be null in the Model type, so code should have a fallback
    // Common patterns: model.runCount ?? 0, model.runCount || 0
    expect(content).toMatch(/model\.runCount\s*\?\?/)
  })

  it('should handle nullable coverImageUrl with conditional rendering', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // coverImageUrl is nullable, so there should be conditional rendering
    expect(content).toMatch(/model\.coverImageUrl\s*\?/)
  })

  it('should export ModelCardProps interface using Model type', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // The exported interface should use Model
    expect(content).toMatch(/export\s+interface\s+ModelCardProps/)
    expect(content).toMatch(/model:\s*Model/)
    expect(content).toMatch(/onSelect:\s*\(model:\s*Model\)/)
  })
})

// =========================================================================
// model-trigger.tsx: Model type field usage
// =========================================================================

describe('model-trigger.tsx — Model type field access', () => {
  const filePath = path.join(PROJECT_ROOT, 'components', 'models', 'model-trigger.tsx')

  it('should access Model-specific fields for display (name, owner, coverImageUrl)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/model\.name/)
    expect(content).toMatch(/model\.owner/)
    expect(content).toMatch(/model\.coverImageUrl/)
  })

  it('should export ModelTriggerProps interface using Model type', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/export\s+interface\s+ModelTriggerProps/)
    expect(content).toMatch(/models:\s*Model\[\]/)
    expect(content).toMatch(/onRemove:\s*\(model:\s*Model\)/)
  })
})

// =========================================================================
// model-browser-drawer.tsx: Model type field usage
// =========================================================================

describe('model-browser-drawer.tsx — Model type field access', () => {
  const filePath = path.join(PROJECT_ROOT, 'components', 'models', 'model-browser-drawer.tsx')

  it('should export ModelBrowserDrawerProps interface using Model type', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/export\s+interface\s+ModelBrowserDrawerProps/)
    expect(content).toMatch(/models:\s*Model\[\]/)
    expect(content).toMatch(/selectedModels:\s*Model\[\]/)
    expect(content).toMatch(/onConfirm:\s*\(models:\s*Model\[\]\)/)
  })

  it('should use Model for internal state (tempSelectedModels)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Internal state should be typed as Model[], not CollectionModel[]
    expect(content).toMatch(/useState<\s*\n?\s*Model\[\]/)
  })

  it('should compare models by owner and name (Model-type fields)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Model identity comparison should use owner + name
    expect(content).toMatch(/m\.owner\s*===\s*model\.owner/)
    expect(content).toMatch(/m\.name\s*===\s*model\.name/)
  })
})

// =========================================================================
// canvas-model-selector.tsx: getModels integration
// =========================================================================

describe('canvas-model-selector.tsx — getModels server action usage', () => {
  const filePath = path.join(PROJECT_ROOT, 'components', 'canvas', 'canvas-model-selector.tsx')

  it('should call getModels with capability filter for img2img', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // The file should call getModels with img2img capability
    // All models returned by getModels({ capability: "img2img" }) are already img2img-capable
    expect(content).toMatch(/getModels\(\s*\{\s*capability:\s*['"]img2img['"]\s*\}\s*\)/)
  })

  it('should use replicateId field for model identification (Model-type field)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Model type uses replicateId (not "url" or modelId from CollectionModel)
    expect(content).toMatch(/\.replicateId/)
  })

  it('should handle error response from getModels', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // getModels returns Model[] | { error: string }, so the consumer must check for errors
    expect(content).toMatch(/["']error["']\s*in\s*result/)
  })

  it('should store fetched models in local state typed as Model[]', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/useState<Model\[\]>/)
  })
})

// =========================================================================
// use-model-filters.ts: Model type usage
// =========================================================================

describe('use-model-filters.ts — Model type usage', () => {
  const filePath = path.join(PROJECT_ROOT, 'lib', 'hooks', 'use-model-filters.ts')

  it('should import Model from model-catalog-service (not CollectionModel)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/import\s+.*\bModel\b.*from\s+['"]@\/lib\/services\/model-catalog-service['"]/)
    expect(content).not.toMatch(/CollectionModel/)
  })

  it('should accept Model[] as input parameter', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/models:\s*Model\[\]/)
  })

  it('should return filteredModels typed as Model[]', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/filteredModels:\s*Model\[\]/)
  })

  it('should access Model-specific fields for filtering (name, description, owner)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/model\.name/)
    expect(content).toMatch(/model\.description/)
    expect(content).toMatch(/model\.owner/)
  })

  it('should handle nullable description safely (Model.description is text | null)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Should check for null before accessing description methods
    expect(content).toMatch(/model\.description\s*!==\s*null/)
  })
})
