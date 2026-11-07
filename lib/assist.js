/**
 * Background writing assistance.
 *
 * This is deliberately a single model call, not a second Agent runtime: it
 * uses the native default model selection, sends the current file/selection,
 * and returns text to the panel without switching the main view. Full Agent
 * work (tools, approvals, history) still belongs to the native conversation.
 */
import { LeafError } from './paths.js'

/** Keep model input bounded so a huge manuscript cannot wedge one call. */
const MAX_FILE_CHARS = 24_000
/** Cap the generated answer returned to the panel. */
const MAX_ANSWER_CHARS = 120_000

/**
 * Build the model-facing instruction for one assist request.
 * @param {{instruction: string, file: string | null, mainDocument: string | null, selection: string | null, fileText: string | null}} request - assist inputs.
 * @returns {string} prompt text.
 */
function buildPrompt(request) {
  const parts = [
    'You are the Writing Agent embedded in dsh-leaf, a LaTeX submission workspace.',
    'Return only the revised LaTeX or the requested answer; do not describe the tool or wrap the entire answer in a code fence unless the user asks for code.',
    'Preserve citation keys, labels, cross-references, units, and numeric results. Never invent experiment values or references; mark missing facts as TODO instead.',
    '',
    `Main document: ${request.mainDocument ?? '(not chosen)'}`,
    `Current file: ${request.file ?? '(none)'}`,
  ]
  if (request.selection !== null) {
    parts.push('', 'Selected LaTeX (replace only this range):', '```latex', request.selection, '```')
  } else if (request.fileText !== null) {
    parts.push('', 'Current file (truncated):', '```latex', request.fileText, '```')
  }
  parts.push('', 'Request:', request.instruction)
  return parts.join('\n')
}

/**
 * Create the background assist function bound to the already-injected runtime.
 * @param {{llm: object, agentDefaultModel: object}} services - scoped host services.
 * @returns {(request: object) => Promise<{text: string, provider: string, model: string}>} assist function.
 */
export function createAssist(services) {
  return async function assist(request) {
    const selection = services.agentDefaultModel?.currentSelection?.()
    if (selection === undefined || selection === null || typeof selection.provider !== 'string') {
      throw new LeafError(503, 'assist-unavailable', 'No native default model is configured for this profile.')
    }
    const prompt = buildPrompt(request)
    const options = {
      provider: selection.provider,
      model: selection.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
    }
    let text = ''
    let failure = null
    try {
      for await (const chunk of services.llm.stream(options)) {
        if (chunk.type === 'text-delta') {
          text += chunk.text
          if (text.length > MAX_ANSWER_CHARS) break
        } else if (chunk.type === 'finish') {
          if (chunk.reason?.kind === 'error') failure = chunk.reason.failure
          if (chunk.reason?.kind === 'aborted') failure = chunk.reason.failure ?? new Error('Model call aborted.')
        }
      }
    } catch (error) {
      throw new LeafError(502, 'assist-failed', `Model call failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (failure !== null) {
      throw new LeafError(502, 'assist-failed', `Model call failed: ${failure?.message ?? String(failure)}`)
    }
    const answer = text.trim()
    if (answer === '') throw new LeafError(502, 'assist-empty', 'The model returned an empty answer.')
    return {
      text: answer,
      provider: selection.provider,
      model: selection.model,
      fileChars: request.fileText === null ? 0 : request.fileText.length,
      selectionChars: request.selection === null ? 0 : request.selection.length,
    }
  }
}

/**
 * Bound the file text included in one prompt.
 * @param {string | null} content - file content.
 * @returns {string | null} bounded content.
 */
export function boundFileText(content) {
  if (typeof content !== 'string') return null
  if (content.length <= MAX_FILE_CHARS) return content
  return `${content.slice(0, MAX_FILE_CHARS)}\n… [truncated by dsh-leaf]`
}
