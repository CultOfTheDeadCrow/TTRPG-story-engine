import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProposedUpdate } from '../../../../shared/types'

interface UseGenerationResult {
  storyText: string
  proposedUpdates: ProposedUpdate[]
  isGenerating: boolean
  error: string | null
  generate: (entityContext: string, userPrompt: string) => Promise<void>
  cancel: () => void
  reset: () => void
  loadDraft: (text: string, updates: ProposedUpdate[]) => void
}

export function useGeneration(): UseGenerationResult {
  const [storyText, setStoryText] = useState('')
  const [proposedUpdates, setProposedUpdates] = useState<ProposedUpdate[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef<string | null>(null)

  useEffect(() => {
    const removeChunk = window.electronAPI.ai.onChunk(({ requestId, text }) => {
      if (requestId !== requestIdRef.current) return
      setStoryText(prev => prev + text)
    })
    const removeDone = window.electronAPI.ai.onDone(({ requestId, storyText: fullText, proposedUpdates: updates }) => {
      if (requestId !== requestIdRef.current) return
      setStoryText(fullText)
      setProposedUpdates(updates)
      setIsGenerating(false)
      requestIdRef.current = null
    })
    const removeError = window.electronAPI.ai.onError(({ requestId, message }) => {
      if (requestId !== requestIdRef.current) return
      setError(message)
      setIsGenerating(false)
      requestIdRef.current = null
    })
    const removeCancelled = window.electronAPI.ai.onCancelled(({ requestId }) => {
      if (requestId !== requestIdRef.current) return
      setIsGenerating(false)
      requestIdRef.current = null
    })
    return () => { removeChunk(); removeDone(); removeError(); removeCancelled() }
  }, [])

  const generate = useCallback(async (entityContext: string, userPrompt: string) => {
    setStoryText('')
    setProposedUpdates([])
    setError(null)
    setIsGenerating(true)
    const result = await window.electronAPI.ai.startGeneration({ entityContext, userPrompt })
    if ('error' in result) {
      setError(result.error)
      setIsGenerating(false)
      return
    }
    requestIdRef.current = result.requestId
  }, [])

  const cancel = useCallback(() => {
    if (requestIdRef.current) {
      window.electronAPI.ai.cancelGeneration(requestIdRef.current)
    }
  }, [])

  const reset = useCallback(() => {
    setStoryText('')
    setProposedUpdates([])
    setError(null)
    setIsGenerating(false)
    requestIdRef.current = null
  }, [])

  const loadDraft = useCallback((text: string, updates: ProposedUpdate[]) => {
    setStoryText(text)
    setProposedUpdates(updates)
    setIsGenerating(false)
    setError(null)
    requestIdRef.current = null
  }, [])

  return { storyText, proposedUpdates, isGenerating, error, generate, cancel, reset, loadDraft }
}
