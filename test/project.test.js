/**
 * Unit tests for the Host half's project record, tree, and editor surfaces.
 * Run with `npm test`; no network or LaTeX installation is required here.
 */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  chooseMain,
  classifyTexSource,
  createTemplate,
  createTexFile,
  findMainCandidates,
  isAuxiliaryName,
  listDirectory,
  readState,
  readTextFile,
  saveTextFile,
  writeState,
} from '../lib/project.js'
import { safeJoin } from '../lib/paths.js'
import { logTail, parseLatexLog } from '../lib/tex.js'

/**
 * Create an isolated workspace for one test.
 * @returns {Promise<{dir: string, cleanup: () => Promise<void>}>} fixture.
 */
async function workspace() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-test-'))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

test('safeJoin keeps paths inside the workspace', () => {
  const root = path.resolve('/tmp/ws')
  assert.equal(safeJoin(root, 'sections/intro.tex'), path.join(root, 'sections/intro.tex'))
  assert.equal(safeJoin(root, ''), root)
  assert.throws(() => safeJoin(root, '../escape.tex'), /escapes the workspace/)
  assert.throws(() => safeJoin(root, 'a/../../escape.tex'), /escapes the workspace/)
})

test('classifyTexSource only treats documentclass sources as main documents', () => {
  assert.deepEqual(
    classifyTexSource('\\documentclass[11pt]{article}\n\\begin{document}你好\\end{document}'),
    { isMain: true, documentClass: 'article', chinese: true },
  )
  assert.equal(classifyTexSource('\\section{Intro}\nText').isMain, false)
  assert.equal(classifyTexSource('\\documentclass{ctexart}').chinese, true)
})

test('findMainCandidates and chooseMain prefer root main.tex', async () => {
  const { dir, cleanup } = await workspace()
  try {
    await mkdir(path.join(dir, 'sections'), { recursive: true })
    await writeFile(path.join(dir, 'main.tex'), '\\documentclass{article}\n', 'utf8')
    await writeFile(path.join(dir, 'sections', 'intro.tex'), '\\section{Intro}\n', 'utf8')
    await writeFile(path.join(dir, 'sections', 'appendix.tex'), '\\documentclass{article}\n', 'utf8')
    const candidates = await findMainCandidates(dir)
    assert.deepEqual(candidates.map((candidate) => candidate.path), ['main.tex', 'sections/appendix.tex'])
    assert.deepEqual(chooseMain(candidates), { main: 'main.tex', ambiguous: false })
  } finally {
    await cleanup()
  }
})

test('chooseMain refuses to guess between equally shallow candidates', async () => {
  const candidates = [
    { path: 'a/paper.tex' },
    { path: 'b/paper.tex' },
  ]
  assert.deepEqual(chooseMain(candidates), { main: null, ambiguous: true })
})

test('project records round-trip and keep explicit opt-out', async () => {
  const { dir, cleanup } = await workspace()
  try {
    const initial = await readState(dir, { enabledByDefault: true })
    assert.equal(initial.enabled, true)
    assert.equal(initial.explicit, false)
    initial.enabled = false
    initial.explicit = true
    initial.mainDocument = 'main.tex'
    await writeState(dir, initial)
    const reloaded = await readState(dir, { enabledByDefault: true })
    assert.equal(reloaded.enabled, false)
    assert.equal(reloaded.explicit, true)
    assert.equal(reloaded.mainDocument, 'main.tex')
  } finally {
    await cleanup()
  }
})

test('listDirectory hides build artifacts and hidden files by default', async () => {
  const { dir, cleanup } = await workspace()
  try {
    await mkdir(path.join(dir, 'figures'))
    await writeFile(path.join(dir, 'main.tex'), 'x', 'utf8')
    await writeFile(path.join(dir, 'main.aux'), 'x', 'utf8')
    await writeFile(path.join(dir, '.hidden'), 'x', 'utf8')
    const page = await listDirectory(dir, '', {})
    assert.deepEqual(page.entries.map((entry) => entry.name), ['figures', 'main.tex'])
    const withAux = await listDirectory(dir, '', { showAuxiliary: true, showHidden: true })
    assert.ok(withAux.entries.some((entry) => entry.name === 'main.aux'))
    assert.ok(withAux.entries.some((entry) => entry.name === '.hidden'))
    assert.equal(isAuxiliaryName('main.synctex.gz'), true)
    assert.equal(isAuxiliaryName('paper.pdf'), false)
  } finally {
    await cleanup()
  }
})

test('readTextFile / saveTextFile detect external edits', async () => {
  const { dir, cleanup } = await workspace()
  try {
    await writeFile(path.join(dir, 'note.tex'), 'one', 'utf8')
    const first = await readTextFile(dir, 'note.tex')
    assert.equal(first.content, 'one')
    await saveTextFile(dir, 'note.tex', 'two', first.mtime)
    await writeFile(path.join(dir, 'note.tex'), 'external', 'utf8')
    const future = new Date(Date.now() + 5000)
    await utimes(path.join(dir, 'note.tex'), future, future)
    await assert.rejects(() => saveTextFile(dir, 'note.tex', 'three', first.mtime), (error) => error.code === 'conflict')
    await saveTextFile(dir, 'note.tex', 'four', null)
    assert.equal((await readTextFile(dir, 'note.tex')).content, 'four')
  } finally {
    await cleanup()
  }
})

test('createTemplate adds only missing files and never overwrites', async () => {
  const { dir, cleanup } = await workspace()
  try {
    await writeFile(path.join(dir, 'main.tex'), 'user content', 'utf8')
    const receipt = await createTemplate(dir, 'zh', '测试论文')
    assert.deepEqual(receipt.skipped, ['main.tex'])
    assert.ok(receipt.created.includes('sections/introduction.tex'))
    assert.equal((await readTextFile(dir, 'main.tex')).content, 'user content')
  } finally {
    await cleanup()
  }
})

test('createTexFile refuses to overwrite an existing file', async () => {
  const { dir, cleanup } = await workspace()
  try {
    const receipt = await createTexFile(dir, { path: 'sections/related.tex', title: 'Related work' })
    assert.equal(receipt.path, 'sections/related.tex')
    await assert.rejects(() => createTexFile(dir, { path: 'sections/related.tex' }), (error) => error.code === 'exists')
    await assert.rejects(() => createTexFile(dir, { path: 'file.md' }), (error) => error.code === 'bad-extension')
  } finally {
    await cleanup()
  }
})

test('parseLatexLog reports file/line errors, warnings, and missing packages', () => {
  const log = [
    '(./main.tex',
    '! LaTeX Error: File `missing.sty\' not found.',
    '! Undefined control sequence.',
    './sections/intro.tex:12: Undefined control sequence.',
    'LaTeX Warning: Reference `fig:x\' on page 1 undefined on input line 8.',
    ')',
  ].join('\n')
  const parsed = parseLatexLog(log, '/tmp/ws', '/tmp/ws')
  assert.ok(parsed.errors.some((error) => error.file === 'sections/intro.tex' && error.line === 12))
  assert.ok(parsed.errors.some((error) => error.missing === 'missing.sty'))
  assert.equal(parsed.missing.length, 1)
  assert.match(parsed.missing[0].hint, /tlmgr install missing/)
  assert.ok(parsed.warnings.length >= 1)
})

test('logTail bounds the displayed log', () => {
  const log = Array.from({ length: 300 }, (_, index) => `line ${index}`).join('\n')
  const { tail, truncated } = logTail(log, 120)
  assert.equal(truncated, true)
  assert.ok(tail.split('\n').length <= 120)
  assert.ok(tail.endsWith('line 299'))
})
