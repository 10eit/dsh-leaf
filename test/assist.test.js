/**
 * Background assist tests: the model call is faked, so this checks prompt
 * shape, answer assembly, and terminal failure handling without network I/O.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { boundFileText, createAssist } from '../lib/assist.js'

/**
 * Build an assist bound to a scripted stream.
 * @param {Array<object>} chunks - chunks to yield.
 * @returns {{assist: Function, captured: object}} assist and captured options.
 */
function scriptedAssist(chunks) {
  const captured = {}
  const llm = {
    async *stream(options) {
      captured.options = options
      for (const chunk of chunks) yield chunk
    },
  }
  const agentDefaultModel = {
    currentSelection: () => ({ provider: 'test-provider', model: 'test-model', reasoningEffort: 'high' }),
  }
  return { assist: createAssist({ llm, agentDefaultModel }), captured }
}

test('assist assembles text deltas and forwards the native model selection', async () => {
  const { assist, captured } = scriptedAssist([
    { type: 'text-delta', text: 'Hello ' },
    { type: 'text-delta', text: 'dsh-leaf' },
    { type: 'finish', reason: { kind: 'completed' } },
  ])
  const result = await assist({
    instruction: 'tighten this',
    file: 'sections/intro.tex',
    mainDocument: 'main.tex',
    selection: 'Selected text',
    fileText: null,
  })
  assert.equal(result.text, 'Hello dsh-leaf')
  assert.equal(result.model, 'test-model')
  assert.equal(captured.options.provider, 'test-provider')
  assert.equal(captured.options.reasoningEffort, 'high')
  assert.match(captured.options.messages[0].content[0].text, /tighten this/)
  assert.match(captured.options.messages[0].content[0].text, /Selected text/)
})

test('assist surfaces a terminal model failure', async () => {
  const { assist } = scriptedAssist([
    { type: 'finish', reason: { kind: 'error', failure: new Error('quota exceeded') } },
  ])
  await assert.rejects(
    () => assist({ instruction: 'x', file: null, mainDocument: null, selection: null, fileText: null }),
    /quota exceeded/,
  )
})

test('assist rejects an empty model answer', async () => {
  const { assist } = scriptedAssist([{ type: 'finish', reason: { kind: 'completed' } }])
  await assert.rejects(
    () => assist({ instruction: 'x', file: null, mainDocument: null, selection: null, fileText: null }),
    /empty answer/,
  )
})

test('boundFileText truncates oversized manuscripts', () => {
  assert.equal(boundFileText('short'), 'short')
  const long = 'x'.repeat(24_010)
  const bounded = boundFileText(long)
  assert.ok(bounded.startsWith('x'.repeat(100)))
  assert.match(bounded, /truncated by dsh-leaf/)
})
