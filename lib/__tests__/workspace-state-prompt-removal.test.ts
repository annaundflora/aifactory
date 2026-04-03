// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import * as fs from 'fs'
import * as path from 'path'
import {
  WorkspaceStateProvider,
  useWorkspaceVariation,
  type WorkspaceVariationState,
} from '../workspace-state'

/**
 * Unit tests for WorkspaceVariationState prompt field removal (slice-06).
 *
 * These tests verify that the `promptStyle` and `negativePrompt` properties
 * have been removed from the `WorkspaceVariationState` interface while all
 * other properties remain intact.
 */

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WorkspaceStateProvider, null, children)
}

describe('WorkspaceVariationState - prompt field removal', () => {
  // --------------------------------------------------------------------------
  // AC-1: Interface hat kein promptStyle
  // --------------------------------------------------------------------------
  it('should not include promptStyle in WorkspaceVariationState', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN existiert KEINE Property promptStyle
     */

    // Type-level check: promptStyle must NOT be a key of WorkspaceVariationState
    type HasPromptStyle = 'promptStyle' extends keyof WorkspaceVariationState
      ? true
      : false
    const check: HasPromptStyle = false
    expect(check).toBe(false)

    // Source-level check: read the actual source file and verify no promptStyle in interface
    const sourcePath = path.resolve(__dirname, '..', 'workspace-state.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')
    const interfaceMatch = source.match(
      /export\s+interface\s+WorkspaceVariationState\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/promptStyle/)
  })

  // --------------------------------------------------------------------------
  // AC-1: Interface hat kein negativePrompt
  // --------------------------------------------------------------------------
  it('should not include negativePrompt in WorkspaceVariationState', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN existiert KEINE Property negativePrompt
     */

    // Type-level check: negativePrompt must NOT be a key of WorkspaceVariationState
    type HasNegativePrompt = 'negativePrompt' extends keyof WorkspaceVariationState
      ? true
      : false
    const check: HasNegativePrompt = false
    expect(check).toBe(false)

    // Source-level check
    const sourcePath = path.resolve(__dirname, '..', 'workspace-state.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')
    const interfaceMatch = source.match(
      /export\s+interface\s+WorkspaceVariationState\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/negativePrompt/)
  })

  // --------------------------------------------------------------------------
  // AC-1: Bestehende Properties sind unveraendert
  // --------------------------------------------------------------------------
  it('should still include promptMotiv, modelId, modelParams and optional fields', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN sind promptMotiv, modelId, modelParams, targetMode?, sourceImageUrl?,
     *            strength?, sourceGenerationId?, addReference? UNVERAENDERT vorhanden
     */

    // Type-level checks for required fields
    type HasPromptMotiv = 'promptMotiv' extends keyof WorkspaceVariationState
      ? true
      : false
    type HasModelId = 'modelId' extends keyof WorkspaceVariationState
      ? true
      : false
    type HasModelParams = 'modelParams' extends keyof WorkspaceVariationState
      ? true
      : false

    const hasPromptMotiv: HasPromptMotiv = true
    const hasModelId: HasModelId = true
    const hasModelParams: HasModelParams = true
    expect(hasPromptMotiv).toBe(true)
    expect(hasModelId).toBe(true)
    expect(hasModelParams).toBe(true)

    // Runtime check: create an object with all expected properties and set it via context
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper })

    const fullState: WorkspaceVariationState = {
      promptMotiv: 'A test prompt',
      modelId: 'vendor/model-1',
      modelParams: { steps: 20 },
      targetMode: 'img2img',
      sourceImageUrl: 'https://example.com/img.png',
      strength: 0.75,
      sourceGenerationId: 'gen-abc-123',
      addReference: { imageUrl: 'https://example.com/ref.png', generationId: 'gen-ref-1' },
    }

    act(() => {
      result.current.setVariation(fullState)
    })

    const data = result.current.variationData!
    expect(data.promptMotiv).toBe('A test prompt')
    expect(data.modelId).toBe('vendor/model-1')
    expect(data.modelParams).toEqual({ steps: 20 })
    expect(data.targetMode).toBe('img2img')
    expect(data.sourceImageUrl).toBe('https://example.com/img.png')
    expect(data.strength).toBe(0.75)
    expect(data.sourceGenerationId).toBe('gen-abc-123')
    expect(data.addReference).toEqual({
      imageUrl: 'https://example.com/ref.png',
      generationId: 'gen-ref-1',
    })

    // Source-level check: verify all expected properties exist in interface body
    const sourcePath = path.resolve(__dirname, '..', 'workspace-state.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')
    const interfaceMatch = source.match(
      /export\s+interface\s+WorkspaceVariationState\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).toMatch(/promptMotiv/)
    expect(interfaceBody).toMatch(/modelId/)
    expect(interfaceBody).toMatch(/modelParams/)
    expect(interfaceBody).toMatch(/targetMode\?/)
    expect(interfaceBody).toMatch(/sourceImageUrl\?/)
    expect(interfaceBody).toMatch(/strength\?/)
    expect(interfaceBody).toMatch(/sourceGenerationId\?/)
    expect(interfaceBody).toMatch(/addReference\?/)
  })
})
