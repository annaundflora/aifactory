import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import type { PromptKnowledgeFile } from '@/lib/types/prompt-knowledge'

// ---------------------------------------------------------------------------
// Mock: OpenRouter client (external API -- mocked per Mocking Strategy)
// Knowledge lookup is NOT mocked -- real prompt-knowledge.json is used.
// ---------------------------------------------------------------------------
const mockChat = vi.fn()

vi.mock('@/lib/clients/openrouter', () => ({
  openRouterClient: {
    chat: (...args: unknown[]) => mockChat(...args),
  },
}))

import { PromptService } from '@/lib/services/prompt-service'

// ---------------------------------------------------------------------------
// Load the real knowledge data for assertion comparisons
// ---------------------------------------------------------------------------
let knowledgeData: PromptKnowledgeFile

beforeAll(() => {
  const filePath = join(process.cwd(), 'data', 'prompt-knowledge.json')
  const raw = readFileSync(filePath, 'utf-8')
  knowledgeData = JSON.parse(raw) as PromptKnowledgeFile
})

/**
 * Helper: Extracts the system prompt content from the mockChat call arguments.
 * The mock is called with { model, messages: [...] } and we want the system message content.
 */
function getSystemPromptFromLastCall(): string {
  const callArgs = mockChat.mock.calls[mockChat.mock.calls.length - 1][0]
  const systemMessage = callArgs.messages.find(
    (m: { role: string }) => m.role === 'system',
  )
  return systemMessage?.content ?? ''
}

// ==========================================================================
// PromptService.improve -- Integration mit realem Knowledge-Lookup
// ==========================================================================

describe('PromptService.improve -- Integration mit realem Knowledge-Lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChat.mockResolvedValue('improved prompt text')
  })

  // --------------------------------------------------------------------------
  // AC-1: Flux-Modell + img2img -> Modell-Tipps UND img2img-Tipps
  // --------------------------------------------------------------------------
  it('should include flux-2 model tips AND img2img mode tips for flux-2-pro with img2img', async () => {
    await PromptService.improve(
      'a cat on a rooftop',
      'black-forest-labs/flux-2-pro',
      'img2img',
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain at least one tip from models["flux-2"].tips
    const flux2Tips = knowledgeData.models['flux-2'].tips
    const hasModelTip = flux2Tips.some((tip) => systemPrompt.includes(tip))
    expect(hasModelTip).toBe(true)

    // Must contain at least one tip from models["flux-2"].modes.img2img.tips
    const flux2Img2imgTips = knowledgeData.models['flux-2'].modes!.img2img!.tips
    const hasModeTip = flux2Img2imgTips.some((tip) => systemPrompt.includes(tip))
    expect(hasModeTip).toBe(true)
  })

  // --------------------------------------------------------------------------
  // AC-2: Flux-Modell + txt2img -> Modell-Tipps UND txt2img-Tipps, KEINE img2img-Tipps
  // --------------------------------------------------------------------------
  it('should include flux-2 model tips AND txt2img mode tips but NOT img2img tips for flux-2-pro with txt2img', async () => {
    await PromptService.improve(
      'a cat on a rooftop',
      'black-forest-labs/flux-2-pro',
      'txt2img',
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain at least one tip from models["flux-2"].tips
    const flux2Tips = knowledgeData.models['flux-2'].tips
    const hasModelTip = flux2Tips.some((tip) => systemPrompt.includes(tip))
    expect(hasModelTip).toBe(true)

    // Must contain at least one tip from models["flux-2"].modes.txt2img.tips
    const flux2Txt2imgTips = knowledgeData.models['flux-2'].modes!.txt2img!.tips
    const hasTxt2imgTip = flux2Txt2imgTips.some((tip) =>
      systemPrompt.includes(tip),
    )
    expect(hasTxt2imgTip).toBe(true)

    // Must NOT contain any tip from models["flux-2"].modes.img2img.tips
    const flux2Img2imgTips = knowledgeData.models['flux-2'].modes!.img2img!.tips
    for (const tip of flux2Img2imgTips) {
      expect(systemPrompt).not.toContain(tip)
    }
  })

  // --------------------------------------------------------------------------
  // AC-3: Unbekanntes Modell -> Fallback-Tipps, keine modellspezifischen Tipps
  // --------------------------------------------------------------------------
  it('should include fallback tips and no model-specific tips for unknown model', async () => {
    await PromptService.improve(
      'a landscape',
      'unknown-vendor/mystery-model-v9',
      'txt2img',
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain at least one tip from fallback.tips
    const fallbackTips = knowledgeData.fallback.tips
    const hasFallbackTip = fallbackTips.some((tip) =>
      systemPrompt.includes(tip),
    )
    expect(hasFallbackTip).toBe(true)

    // Must NOT contain any tip from any specific model entry
    for (const [, modelEntry] of Object.entries(knowledgeData.models)) {
      for (const tip of modelEntry.tips) {
        expect(systemPrompt).not.toContain(tip)
      }
    }
  })

  // --------------------------------------------------------------------------
  // AC-4: Bestehende Prompt-Struktur erhalten, keine alten statischen Hints
  // --------------------------------------------------------------------------
  it('should preserve Analysis Phase, Improvement Strategy and Rules sections and exclude old static hints', async () => {
    await PromptService.improve(
      'a sunset',
      'black-forest-labs/flux-2-pro',
      'txt2img',
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain the structural sections
    expect(systemPrompt).toContain('Analysis Phase')
    expect(systemPrompt).toContain('Improvement Strategy')
    expect(systemPrompt).toContain('Rules')

    // Must NOT contain old static hints
    const oldStaticHints = [
      'FLUX models: Detailed scene descriptions',
      'Recraft V4: Minimalistic, design-oriented',
      'Google Imagen: Natural language descriptions',
      'Stable Diffusion: Keyword-rich prompts',
    ]

    for (const hint of oldStaticHints) {
      expect(systemPrompt).not.toContain(hint)
    }
  })

  // --------------------------------------------------------------------------
  // AC-5: Seedream-Modell + img2img -> Seedream-Tipps UND img2img-Tipps
  // --------------------------------------------------------------------------
  it('should include seedream model tips AND img2img mode tips for seedream-5 with img2img', async () => {
    await PromptService.improve(
      'product photo',
      'google/seedream-5',
      'img2img',
    )

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain at least one tip from models["seedream"].tips
    const seedreamTips = knowledgeData.models['seedream'].tips
    const hasModelTip = seedreamTips.some((tip) => systemPrompt.includes(tip))
    expect(hasModelTip).toBe(true)

    // Must contain at least one tip from models["seedream"].modes.img2img.tips
    const seedreamImg2imgTips =
      knowledgeData.models['seedream'].modes!.img2img!.tips
    const hasModeTip = seedreamImg2imgTips.some((tip) =>
      systemPrompt.includes(tip),
    )
    expect(hasModeTip).toBe(true)
  })

  // --------------------------------------------------------------------------
  // AC-6: Ohne expliziten generationMode -> Default txt2img-Tipps
  // --------------------------------------------------------------------------
  it('should default to txt2img mode tips when generationMode is omitted', async () => {
    // Call with only 2 arguments (no generationMode)
    await PromptService.improve('a sunset', 'black-forest-labs/flux-2-pro')

    expect(mockChat).toHaveBeenCalledOnce()
    const systemPrompt = getSystemPromptFromLastCall()

    // Must contain Flux model tips
    const flux2Tips = knowledgeData.models['flux-2'].tips
    const hasModelTip = flux2Tips.some((tip) => systemPrompt.includes(tip))
    expect(hasModelTip).toBe(true)

    // Must contain txt2img mode tips (default behavior from Slice 04)
    const flux2Txt2imgTips = knowledgeData.models['flux-2'].modes!.txt2img!.tips
    const hasTxt2imgTip = flux2Txt2imgTips.some((tip) =>
      systemPrompt.includes(tip),
    )
    expect(hasTxt2imgTip).toBe(true)
  })
})
