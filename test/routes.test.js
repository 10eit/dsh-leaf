/**
 * HTTP surface test: binds the real route handler to a throwaway node:http
 * server, then exercises state, tree, editor, PDF serving, and the trust fence.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { registerLeafRoutes } from '../lib/routes.js'
import { BuildManager, detectEnvironment } from '../lib/tex.js'

const environment = await detectEnvironment()

/**
 * Start the route table on an ephemeral port.
 * @param {string} root - registered workspace path.
 * @param {{rejection?: number, registered?: boolean}} options - fence behavior.
 * @returns {Promise<{base: string, close: () => Promise<void>, calls: Array<object>}>} harness.
 */
async function harness(root, options = {}) {
  let route = null
  const calls = []
  const ctx = {
    webServer: {
      register: (candidate) => {
        route = candidate
        calls.push(candidate)
        return () => {}
      },
    },
    connection: {
      requestRejection: () => options.rejection,
    },
    workspaceRegistry: options.registry ?? {
      list: () => (options.registered === false ? [] : [{ path: root }]),
    },
  }
  const leaf = {
    config: { enabledByDefault: true, engine: 'xelatex', autoCompile: true },
    builds: new BuildManager({ ctx }),
  }
  registerLeafRoutes(ctx, leaf)
  assert.ok(route !== null)
  const server = http.createServer((request, response) => {
    route.handler(request, response).catch((error) => {
      response.statusCode = 500
      response.end(String(error))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return {
    base: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('health, state, tree, and editor routes round-trip', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-routes-'))
  const server = await harness(dir)
  try {
    await writeFile(path.join(dir, 'main.tex'), '\\documentclass{article}\n\\begin{document}x\\end{document}\n', 'utf8')
    const health = await fetch(`${server.base}/dsh-leaf/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).plugin, 'dsh-leaf')

    const state = await fetch(`${server.base}/dsh-leaf/state?workspace=${encodeURIComponent(dir)}`)
    assert.equal(state.status, 200)
    const statePayload = await state.json()
    assert.equal(statePayload.workspace.path, await realpath(dir))
    assert.equal(statePayload.project.mainDocument, 'main.tex')
    assert.equal(statePayload.project.enabled, true)
    assert.ok(Array.isArray(statePayload.candidates))

    const tree = await fetch(`${server.base}/dsh-leaf/tree?workspace=${encodeURIComponent(dir)}&dir=`)
    assert.equal(tree.status, 200)
    assert.deepEqual((await tree.json()).entries.map((entry) => entry.name), ['main.tex'])

    const created = await fetch(`${server.base}/dsh-leaf/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: dir, path: 'sections/intro.tex', kind: 'section' }),
    })
    assert.equal(created.status, 200)
    assert.equal((await created.json()).path, 'sections/intro.tex')

    const write = await fetch(`${server.base}/dsh-leaf/file`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: dir, path: 'sections/intro.tex', content: '\\section{Intro}\n', expectedMtime: null }),
    })
    assert.equal(write.status, 200)
    const read = await fetch(`${server.base}/dsh-leaf/file?workspace=${encodeURIComponent(dir)}&path=sections%2Fintro.tex`)
    assert.equal(read.status, 200)
    assert.equal((await read.json()).content, '\\section{Intro}\n')
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('client activation diagnostics are appended to the host log', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-diag-'))
  const server = await harness(dir)
  try {
    const response = await fetch(`${server.base}/dsh-leaf/client-error`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 'test-stage', message: 'boom', stack: 'at test' }),
    })
    assert.equal(response.status, 200)
    const log = await readFile(path.join(tmpdir(), 'dsh-leaf-client-errors.log'), 'utf8')
    assert.ok(log.includes('"stage":"test-stage"'))
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('pinning renames and reorders the workspace, unpinning restores the title', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-pin-'))
  const changes = []
  const entity = {
    id: 'w1',
    path: dir,
    title: 'my-paper',
    async setTitle(title) {
      this.title = title
      changes.push(['title', title])
    },
  }
  const other = { id: 'w2', path: '/tmp/other', title: 'other', async setTitle() {} }
  const registry = {
    list: () => [entity, other],
    insertBefore: (id, before) => {
      changes.push(['order', id, before])
      return ['w1', 'w2']
    },
  }
  const server = await harness(dir, { registry })
  try {
    const pinned = await fetch(`${server.base}/dsh-leaf/workspace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: dir, action: 'pin' }),
    })
    assert.equal(pinned.status, 200)
    assert.equal(entity.title, 'dsh-leaf')
    assert.deepEqual(changes[0], ['title', 'dsh-leaf'])
    assert.deepEqual(changes[1], ['order', 'w1', 'w2'])
    const state = await (await fetch(`${server.base}/dsh-leaf/state?workspace=${encodeURIComponent(dir)}`)).json()
    assert.equal(state.project.pinned, true)

    const unpinned = await fetch(`${server.base}/dsh-leaf/workspace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: dir, action: 'unpin' }),
    })
    assert.equal(unpinned.status, 200)
    assert.equal(entity.title, 'my-paper')
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('the trust fence rejects unauthenticated requests before any file access', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-fence-'))
  const server = await harness(dir, { rejection: 401 })
  try {
    const response = await fetch(`${server.base}/dsh-leaf/state?workspace=${encodeURIComponent(dir)}`)
    assert.equal(response.status, 401)
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('unregistered directories are refused', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-unregistered-'))
  const server = await harness(dir, { registered: false })
  try {
    const response = await fetch(`${server.base}/dsh-leaf/tree?workspace=${encodeURIComponent(dir)}&dir=`)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'workspace-unregistered')
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('compile produces a PDF the /pdf route serves with Range support', { skip: !environment.available }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-leaf-pdf-'))
  const server = await harness(dir)
  try {
    await writeFile(path.join(dir, 'main.tex'), [
      '\\documentclass{article}',
      '\\begin{document}',
      'Range test $1+1=2$.',
      '\\end{document}',
      '',
    ].join('\n'), 'utf8')
    const compile = await fetch(`${server.base}/dsh-leaf/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: dir, engine: 'xelatex', mode: 'full' }),
    })
    assert.equal(compile.status, 200)
    const receipt = await compile.json()
    assert.equal(receipt.ok, true, receipt.logTail)
    assert.ok(receipt.pdf.path.endsWith('.pdf'))

    const pdf = await fetch(`${server.base}/dsh-leaf/pdf?workspace=${encodeURIComponent(dir)}`)
    assert.equal(pdf.status, 200)
    assert.equal(pdf.headers.get('content-type'), 'application/pdf')
    const bytes = Buffer.from(await pdf.arrayBuffer())
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF')

    const ranged = await fetch(`${server.base}/dsh-leaf/pdf?workspace=${encodeURIComponent(dir)}`, {
      headers: { range: 'bytes=0-9' },
    })
    assert.equal(ranged.status, 206)
    assert.equal(ranged.headers.get('content-range'), `bytes 0-9/${bytes.length}`)
    assert.equal((await ranged.arrayBuffer()).byteLength, 10)
  } finally {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  }
})
