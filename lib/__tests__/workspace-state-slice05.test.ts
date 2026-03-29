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
 * Unit tests for WorkspaceVariationState - prompt simplification (slice-05).
 *
 * These tests verify that the `promptStyle` and `negativePrompt` properties
 * are absent from the `WorkspaceVariationState` interface and that variation
 * consumption only involves `promptMotiv` (no style/negative fields).
 */

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WorkspaceStateProvider, null, children)
}

describe('WorkspaceVariationState - prompt simplification', () => {
  // --------------------------------------------------------------------------
  // AC-9: WorkspaceVariationState hat kein promptStyle
  // --------------------------------------------------------------------------
  it('should not include promptStyle in WorkspaceVariationState type', () => {
    /**
     * AC-9: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN seine Properties geprueft werden
     *       THEN enthaelt es KEINE Property promptStyle
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
  // AC-9: WorkspaceVariationState hat kein negativePrompt
  // --------------------------------------------------------------------------
  it('should not include negativePrompt in WorkspaceVariationState type', () => {
    /**
     * AC-9: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN seine Properties geprueft werden
     *       THEN enthaelt es KEINE Property negativePrompt
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
  // AC-8: Variation-Konsumierung nur mit promptMotiv
  // --------------------------------------------------------------------------
  it('should set variation with only promptMotiv without promptStyle or negativePrompt', () => {
    /**
     * AC-8: GIVEN eine WorkspaceVariationState die via useWorkspaceVariation konsumiert wird
     *       WHEN variationData mit promptMotiv, modelId, modelParams ankommt
     *       THEN wird nur promptMotiv gesetzt
     *       AND es wird KEIN promptStyle oder negativePrompt mitgefuehrt
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper })

    const variationData: WorkspaceVariationState = {
      promptMotiv: 'A mountain landscape at sunset',
      modelId: 'black-forest-labs/flux-2-pro',
      modelParams: { aspect_ratio: '16:9' },
    }

    act(() => {
      result.current.setVariation(variationData)
    })

    const data = result.current.variationData!
    expect(data).not.toBeNull()
    expect(data.promptMotiv).toBe('A mountain landscape at sunset')
    expect(data.modelId).toBe('black-forest-labs/flux-2-pro')
    expect(data.modelParams).toEqual({ aspect_ratio: '16:9' })

    // Verify no promptStyle or negativePrompt keys exist on the object
    const keys = Object.keys(data)
    expect(keys).not.toContain('promptStyle')
    expect(keys).not.toContain('negativePrompt')
  })
})
