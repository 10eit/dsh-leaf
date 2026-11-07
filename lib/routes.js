/**
 * HTTP surface of the dsh-leaf Host half.
 *
 * Every route lives under `/dsh-leaf` on the composition's webServer and is
 * admitted through the connection service's Host/Origin + browser-auth fence,
 * so the endpoints share the Web UI's trust boundary instead of opening a new
 * one. Responses are JSON except the byte routes (`/asset`, `/pdf`).
 */
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  LeafError,
  realDirectory,
  relativeTo,
  safeJoin,
  toDiagnostic,
} from './paths.js'
import {
  applyStatePatch,
  createTemplate,
  createTexFile,
  detectFiguresDir,
  findMainCandidates,
  chooseMain,
  listDirectory,
  projectView,
  readState,
  readTextFile,
  saveTextFile,
  writeState,
} from './project.js'
import {
  cleanBuild,
  detectEnvironment,
  probeEnvironment,
  synctexForward,
  synctexInverse,
} from './tex.js'

/** Route prefix owned by this plugin. */
export const PREFIX = '/dsh-leaf'

/**
 * Main-document discovery walks the project; the client polls /state while a
 * panel is open, so cache the scan briefly instead of rescanning every tick.
 */
const candidateCache = new Map()
const CANDIDATE_TTL_MS = 15_000

/**
 * Cached main-document scan.
 * @param {string} workspace - physical workspace root.
 * @returns {Promise<Array<object>>} candidates.
 */
async function candidatesOf(workspace) {
  const cached = candidateCache.get(workspace)
  if (cached !== undefined && Date.now() - cached.at < CANDIDATE_TTL_MS) return cached.candidates
  const candidates = await findMainCandidates(workspace)
  candidateCache.set(workspace, { at: Date.now(), candidates })
  return candidates
}

/** Bodies are editor-sized; larger uploads are rejected before buffering. */
const MAX_BODY_BYTES = 16 * 1024 * 1024

/** Extensions the browser can render without a converter. */
const CONTENT_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
  ['.tex', 'text/plain; charset=utf-8'],
  ['.bib', 'text/plain; charset=utf-8'],
  ['.sty', 'text/plain; charset=utf-8'],
  ['.cls', 'text/plain; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
])

/**
 * Normalize and authorize a workspace path against the live registry.
 * @param {object} ctx - host context.
 * @param {string | null} raw - requested absolute path.
 * @returns {Promise<string>} physical workspace root.
 */
export async function authorizeWorkspace(ctx, raw) {
  const real = await realDirectory(raw)
  const registry = ctx.workspaceRegistry
  const entries = registry?.list?.() ?? []
  const roots = []
  for (const entry of entries) {
    if (typeof entry?.path !== 'string') continue
    try {
      roots.push(await realDirectory(entry.path))
    } catch {
      roots.push(path.resolve(entry.path))
    }
  }
  const allowed = roots.some((root) => real === root || real.startsWith(`${root}${path.sep}`))
  if (!allowed) {
    throw new LeafError(403, 'workspace-unregistered', 'This directory is not a registered DeepSeek Harness workspace.')
  }
  return real
}

/**
 * Read a JSON body with a byte ceiling.
 * @param {import('node:http').IncomingMessage} req - request stream.
 * @returns {Promise<Record<string, unknown>>} parsed body.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      throw new LeafError(413, 'body-too-large', 'Request body exceeds the 16 MiB limit.')
    }
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return value !== null && typeof value === 'object' ? value : {}
  } catch {
    throw new LeafError(400, 'bad-json', 'Request body is not valid JSON.')
  }
}

/**
 * Send a JSON response with no-store caching.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {number} status - HTTP status.
 * @param {unknown} payload - JSON-serializable value.
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

/**
 * Send a text response.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {number} status - HTTP status.
 * @param {string} text - text body.
 */
function sendText(res, status, text) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(text)
}

/**
 * Method guard.
 * @param {import('node:http').IncomingMessage} req - request.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {string[]} allowed - accepted methods.
 * @returns {boolean} true when the request was rejected.
 */
function rejectMethod(req, res, allowed) {
  if (allowed.includes(req.method ?? 'GET')) return false
  res.statusCode = 405
  res.setHeader('allow', allowed.join(', '))
  res.end()
  return true
}

/**
 * Stream a file with single-range support, matching what browsers and PDF
 * viewers expect.
 * @param {import('node:http').IncomingMessage} req - request.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {string} file - absolute file path.
 * @param {{contentType?: string, downloadName?: string}} options - headers.
 */
async function sendFile(req, res, file, options = {}) {
  const info = await stat(file).catch(() => null)
  if (info === null || !info.isFile()) {
    sendJson(res, 404, { code: 'not-found', message: 'File not found.' })
    return
  }
  const contentType = options.contentType ?? CONTENT_TYPES.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream'
  res.setHeader('content-type', contentType)
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('accept-ranges', 'bytes')
  if (options.downloadName !== undefined) {
    res.setHeader('content-disposition', `attachment; filename="${options.downloadName.replaceAll('"', '')}"`)
  }
  const range = req.headers.range
  if (typeof range === 'string') {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (match !== null) {
      const start = match[1] === '' ? null : Number(match[1])
      const end = match[2] === '' ? null : Number(match[2])
      let from = start ?? 0
      let to = end ?? info.size - 1
      if (start === null && end !== null) {
        from = Math.max(0, info.size - end)
        to = info.size - 1
      }
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || from >= info.size) {
        res.statusCode = 416
        res.setHeader('content-range', `bytes */${info.size}`)
        res.end()
        return
      }
      to = Math.min(to, info.size - 1)
      res.statusCode = 206
      res.setHeader('content-range', `bytes ${from}-${to}/${info.size}`)
      res.setHeader('content-length', String(to - from + 1))
      createReadStream(file, { start: from, end: to }).pipe(res)
      return
    }
  }
  res.statusCode = 200
  res.setHeader('content-length', String(info.size))
  createReadStream(file).pipe(res)
}

/**
 * Resolve the current paper PDF for a workspace.
 * @param {string} workspace - physical root.
 * @param {object} state - project record.
 * @returns {Promise<{file: string, rel: string, mtime: number} | null>} PDF location.
 */
async function currentPdf(workspace, state) {
  const candidates = []
  if (typeof state.lastBuild?.pdf?.path === 'string') candidates.push(state.lastBuild.pdf.path)
  for (const mode of ['full', 'fast']) {
    const main = state.mainDocument ?? 'main.tex'
    const base = path.basename(main, '.tex')
    candidates.push(path.join('.dsh-leaf', 'build', mode, `${base}.pdf`))
    candidates.push(path.join('.dsh-leaf', 'build', mode, `${base}-fast.pdf`))
  }
  for (const candidate of candidates) {
    const abs = safeJoin(workspace, candidate)
    const info = await stat(abs).catch(() => null)
    if (info !== null && info.isFile() && info.size > 0) {
      return { file: abs, rel: relativeTo(workspace, abs), mtime: info.mtimeMs }
    }
  }
  return null
}

/**
 * Build the state payload the client panel renders.
 * @param {string} workspace - physical root.
 * @param {object} ctx - host context.
 * @param {object} config - plugin config.
 * @returns {Promise<object>} state payload.
 */
async function statePayload(workspace, ctx, leaf) {
  const state = await readState(workspace, leaf.config)
  const candidates = await candidatesOf(workspace)
  const figuresDir = state.figuresDir ?? (await detectFiguresDir(workspace))
  if (state.mainDocument === null) {
    const choice = chooseMain(candidates)
    if (choice.main !== null) {
      state.mainDocument = choice.main
      state.figuresDir = figuresDir
      await writeState(workspace, state)
    }
  }
  const pdf = await currentPdf(workspace, state)
  const environment = await detectEnvironment()
  return {
    workspace: { path: workspace, name: path.basename(workspace) },
    project: projectView(state),
    candidates,
    ambiguousMain: state.mainDocument === null && candidates.length > 1,
    figuresDir,
    pdf: pdf === null ? null : { path: pdf.rel, mtime: pdf.mtime, url: `${PREFIX}/pdf?workspace=${encodeURIComponent(workspace)}&v=${pdf.mtime}` },
    environment,
    buildQueue: leaf.builds.statusOf(workspace),
  }
}

/**
 * Register every dsh-leaf route on the webServer.
 * @param {object} ctx - host context.
 * @param {{config: object, builds: import('./tex.js').BuildManager}} leaf - plugin state.
 * @returns {() => void} disposer.
 */
export function registerLeafRoutes(ctx, leaf) {
  const connection = ctx.connection
  const disposers = []
  const register = (route) => {
    disposers.push(ctx.webServer.register(route))
  }

  register({
    kind: 'prefix',
    path: PREFIX,
    handler: async (req, res) => {
      const rejection = connection?.requestRejection?.(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh-leaf.local')
      const route = url.pathname.slice(PREFIX.length) || '/'
      try {
        await handle(route, req, res, url)
      } catch (error) {
        const diagnostic = toDiagnostic(error)
        const extra = {}
        if (typeof error === 'object' && error !== null) {
          if (Array.isArray(error.candidates)) extra.candidates = error.candidates
          if (typeof error.mtime === 'number') extra.mtime = error.mtime
        }
        if (!res.headersSent) sendJson(res, diagnostic.status, { ...extra, code: diagnostic.code, message: diagnostic.message })
        else res.destroy()
      }
    },
  })

  /**
   * Dispatch one route.
   * @param {string} route - pathname suffix.
   * @param {import('node:http').IncomingMessage} req - request.
   * @param {import('node:http').ServerResponse} res - response.
   * @param {URL} url - parsed URL.
   */
  async function handle(route, req, res, url) {
    const method = req.method ?? 'GET'
    const body = method === 'POST' ? await readJsonBody(req) : null
    if (route === '/health') {
      if (rejectMethod(req, res, ['GET'])) return
      sendJson(res, 200, { ok: true, plugin: 'dsh-leaf' })
      return
    }
    if (route === '/env') {
      if (rejectMethod(req, res, ['GET'])) return
      sendJson(res, 200, await detectEnvironment({ force: url.searchParams.get('force') === '1' }))
      return
    }
    if (route === '/env/probe') {
      if (rejectMethod(req, res, ['POST'])) return
      sendJson(res, 200, await probeEnvironment({ engine: leaf.config.engine }))
      return
    }
    // POST routes carry the workspace in the JSON body; GET routes use the query.
    // Bodies are read once, after the trust fence and before authorization.
    const workspace = await authorizeWorkspace(
      ctx,
      url.searchParams.get('workspace') ?? (typeof body?.workspace === 'string' ? body.workspace : null),
    )
    if (route === '/state') {
      if (method === 'GET') {
        sendJson(res, 200, await statePayload(workspace, ctx, leaf))
        return
      }
      if (method === 'POST') {
        const before = await readState(workspace, leaf.config)
        const after = applyStatePatch(before, body.patch ?? body)
        await writeState(workspace, after)
        sendJson(res, 200, await statePayload(workspace, ctx, leaf))
        return
      }
      rejectMethod(req, res, ['GET', 'POST'])
      return
    }
    if (route === '/tree') {
      if (rejectMethod(req, res, ['GET'])) return
      const dir = url.searchParams.get('dir') ?? ''
      const payload = await listDirectory(workspace, dir, {
        showHidden: url.searchParams.get('hidden') === '1',
        showAuxiliary: url.searchParams.get('aux') === '1',
      })
      sendJson(res, 200, payload)
      return
    }
    if (route === '/file') {
      if (method === 'GET') {
        const rel = url.searchParams.get('path') ?? ''
        sendJson(res, 200, await readTextFile(workspace, rel))
        return
      }
      if (method === 'POST') {
        const receipt = await saveTextFile(
          workspace,
          String(body.path ?? ''),
          body.content,
          typeof body.expectedMtime === 'number' ? body.expectedMtime : null,
        )
        sendJson(res, 200, receipt)
        return
      }
      rejectMethod(req, res, ['GET', 'POST'])
      return
    }
    if (route === '/new') {
      if (rejectMethod(req, res, ['POST'])) return
      const receipt = await createTexFile(workspace, {
        path: String(body.path ?? ''),
        kind: body.kind === 'main' ? 'main' : 'section',
        title: typeof body.title === 'string' ? body.title : undefined,
      })
      const state = await readState(workspace, leaf.config)
      if (state.mainDocument === null && receipt.kind === 'main') {
        state.mainDocument = receipt.path
        await writeState(workspace, state)
      }
      sendJson(res, 200, receipt)
      return
    }
    if (route === '/init') {
      if (rejectMethod(req, res, ['POST'])) return
      const template = body.template === 'en' ? 'en' : 'zh'
      const receipt = await createTemplate(workspace, template, typeof body.title === 'string' ? body.title : '')
      const state = await readState(workspace, leaf.config)
      if (receipt.created.includes('main.tex')) state.mainDocument = 'main.tex'
      state.figuresDir = (await detectFiguresDir(workspace)) ?? 'figures'
      state.engine = template === 'zh' ? 'xelatex' : state.engine
      await writeState(workspace, state)
      sendJson(res, 200, { ...receipt, state: await statePayload(workspace, ctx, leaf) })
      return
    }
    if (route === '/compile') {
      if (rejectMethod(req, res, ['POST'])) return
      const state = await readState(workspace, leaf.config)
      if (body.engine === 'xelatex' || body.engine === 'pdflatex') state.engine = body.engine
      if (body.mode === 'fast' || body.mode === 'full') state.mode = body.mode
      if (typeof body.mainDocument === 'string') state.mainDocument = body.mainDocument
      await writeState(workspace, state)
      if (body.clean === true) await cleanBuild(workspace)
      const receipt = await leaf.builds.compile(workspace, state, {
        engine: state.engine,
        mode: state.mode,
        mainDocument: state.mainDocument,
      })
      sendJson(res, 200, { ...receipt, state: await statePayload(workspace, ctx, leaf) })
      return
    }
    if (route === '/stop') {
      if (rejectMethod(req, res, ['POST'])) return
      sendJson(res, 200, leaf.builds.stop(workspace))
      return
    }
    if (route === '/clean') {
      if (rejectMethod(req, res, ['POST'])) return
      const receipt = await cleanBuild(workspace)
      const state = await readState(workspace, leaf.config)
      state.lastBuild = null
      await writeState(workspace, state)
      sendJson(res, 200, { ...receipt, state: await statePayload(workspace, ctx, leaf) })
      return
    }
    if (route === '/log') {
      if (rejectMethod(req, res, ['GET'])) return
      const state = await readState(workspace, leaf.config)
      const mode = state.lastBuild?.mode === 'fast' ? 'fast' : 'full'
      const base = state.lastBuild?.mainDocument ?? state.mainDocument ?? 'main.tex'
      const job = path.basename(base, '.tex')
      const candidates = [
        path.join(workspace, '.dsh-leaf', 'build', mode, `${mode === 'fast' ? `${job}-fast` : job}.log`),
        path.join(workspace, '.dsh-leaf', 'build', 'full', `${job}.log`),
      ]
      for (const candidate of candidates) {
        const text = await readFile(candidate, 'utf8').catch(() => null)
        if (text !== null) {
          sendText(res, 200, text)
          return
        }
      }
      sendText(res, 404, 'No build log has been produced yet.')
      return
    }
    if (route === '/pdf') {
      if (rejectMethod(req, res, ['GET', 'HEAD'])) return
      const state = await readState(workspace, leaf.config)
      const pdf = await currentPdf(workspace, state)
      if (pdf === null) {
        sendJson(res, 404, { code: 'no-pdf', message: 'This project has not produced a PDF yet.' })
        return
      }
      await sendFile(req, res, pdf.file, {
        contentType: 'application/pdf',
        downloadName: url.searchParams.get('download') === '1' ? `${path.basename(state.mainDocument ?? 'paper', '.tex')}.pdf` : undefined,
      })
      return
    }
    if (route === '/asset') {
      if (rejectMethod(req, res, ['GET', 'HEAD'])) return
      const rel = url.searchParams.get('path') ?? ''
      const abs = safeJoin(workspace, rel)
      const info = await stat(abs).catch(() => null)
      if (info === null || !info.isFile()) {
        sendJson(res, 404, { code: 'not-found', message: `File not found: ${rel}` })
        return
      }
      if (info.size > 64 * 1024 * 1024) {
        sendJson(res, 413, { code: 'too-large', message: 'Asset is larger than the 64 MiB preview limit.' })
        return
      }
      await sendFile(req, res, abs)
      return
    }
    if (route === '/reveal') {
      if (rejectMethod(req, res, ['POST'])) return
      const abs = safeJoin(workspace, String(body.path ?? ''))
      if (process.platform === 'darwin') {
        spawn('open', ['-R', abs], { detached: true, stdio: 'ignore' }).unref()
        sendJson(res, 200, { ok: true })
      } else if (process.platform === 'win32') {
        spawn('explorer', ['/select,', abs], { detached: true, stdio: 'ignore' }).unref()
        sendJson(res, 200, { ok: true })
      } else {
        spawn('xdg-open', [path.dirname(abs)], { detached: true, stdio: 'ignore' }).unref()
        sendJson(res, 200, { ok: true })
      }
      return
    }
    if (route === '/synctex/forward') {
      if (rejectMethod(req, res, ['GET'])) return
      const state = await readState(workspace, leaf.config)
      const pdf = await currentPdf(workspace, state)
      if (pdf === null) {
        sendJson(res, 409, { code: 'no-pdf', message: 'Compile the project before locating source in the PDF.' })
        return
      }
      const main = state.mainDocument ?? 'main.tex'
      const cwd = state.buildCwd === null ? path.dirname(path.join(workspace, main)) : path.join(workspace, state.buildCwd)
      const result = await synctexForward({
        workspace,
        buildCwd: cwd,
        pdfPath: pdf.rel,
        file: url.searchParams.get('path') ?? main,
        line: Number(url.searchParams.get('line') ?? '1'),
        column: Number(url.searchParams.get('column') ?? '1'),
      })
      if (result === null) {
        sendJson(res, 404, { code: 'synctex-miss', message: 'SyncTeX could not map this location. Recompile with SyncTeX enabled.' })
        return
      }
      sendJson(res, 200, result)
      return
    }
    if (route === '/synctex/inverse') {
      if (rejectMethod(req, res, ['GET'])) return
      const state = await readState(workspace, leaf.config)
      const pdf = await currentPdf(workspace, state)
      if (pdf === null) {
        sendJson(res, 409, { code: 'no-pdf', message: 'Compile the project before locating PDF text in the source.' })
        return
      }
      const main = state.mainDocument ?? 'main.tex'
      const cwd = state.buildCwd === null ? path.dirname(path.join(workspace, main)) : path.join(workspace, state.buildCwd)
      const result = await synctexInverse({
        workspace,
        buildCwd: cwd,
        pdfPath: pdf.rel,
        page: Number(url.searchParams.get('page') ?? '1'),
        x: Number(url.searchParams.get('x') ?? '0'),
        y: Number(url.searchParams.get('y') ?? '0'),
      })
      if (result === null) {
        sendJson(res, 404, { code: 'synctex-miss', message: 'SyncTeX could not map this PDF position. Recompile with SyncTeX enabled.' })
        return
      }
      sendJson(res, 200, result)
      return
    }
    sendJson(res, 404, { code: 'unknown-route', message: `Unknown dsh-leaf route: ${route}` })
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
