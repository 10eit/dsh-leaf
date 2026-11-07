/**
 * End-to-end build test against the real local TeX installation.
 * The test skips (rather than fails) on a machine without a LaTeX engine, so
 * the suite stays usable in CI while still proving the pipeline locally.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { readState } from '../lib/project.js'
import { BuildManager, detectEnvironment } from '../lib/tex.js'

const environment = await detectEnvironment()

test('the detected environment compiles a minimal project end to end', { skip: !environment.available }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-build-'))
  try {
    await writeFile(path.join(dir, 'main.tex'), [
      '\\documentclass{article}',
      '\\begin{document}',
      'Hello from dsh-leaf. $E=mc^2$',
      '\\end{document}',
      '',
    ].join('\n'), 'utf8')
    const state = await readState(dir, {})
    state.mainDocument = 'main.tex'
    state.engine = environment.engines.xelatex !== null ? 'xelatex' : 'pdflatex'
    const builds = new BuildManager({ ctx: {} })
    const receipt = await builds.compile(dir, state, { engine: state.engine, mode: 'full' })
    assert.equal(receipt.ok, true, receipt.logTail)
    assert.equal(receipt.pdf.available, true)
    const pdf = await readFile(path.join(dir, receipt.pdf.path))
    assert.ok(pdf.subarray(0, 4).toString() === '%PDF')
    assert.ok(receipt.durationMs >= 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a failing project reports file/line diagnostics and keeps no fresh PDF', { skip: !environment.available }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-fail-'))
  try {
    await writeFile(path.join(dir, 'main.tex'), [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\undefinedcommandhere',
      '\\end{document}',
      '',
    ].join('\n'), 'utf8')
    const state = await readState(dir, {})
    state.mainDocument = 'main.tex'
    state.engine = environment.engines.xelatex !== null ? 'xelatex' : 'pdflatex'
    const builds = new BuildManager({ ctx: {} })
    const receipt = await builds.compile(dir, state, { engine: state.engine, mode: 'full' })
    assert.equal(receipt.ok, false)
    assert.equal(receipt.pdf.available, false)
    assert.ok(receipt.errors.length > 0)
    assert.ok(receipt.errors.some((error) => error.file === 'main.tex'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
