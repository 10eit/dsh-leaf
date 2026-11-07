/**
 * PDF text geometry and page images via the macOS PDFKit helper.
 *
 * The helper is a small Swift program compiled once per workspace (the
 * sandbox only permits workspace writes). It exposes per-line word boxes in
 * PDF points with a top-left origin, which is exactly what SyncTeX's inverse
 * search expects. Other platforms keep the built-in viewer and lose only the
 * text-to-source mapping.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LeafError, safeJoin } from './paths.js'
import { findExecutable, runProcess } from './tex.js'

const HELPER_SOURCE = fileURLToPath(new URL('../tools/pdfhelper.swift', import.meta.url))
const compiles = new Map()

/**
 * Compile the helper for one workspace, serializing concurrent callers.
 * @param {string} workspace - physical workspace root.
 * @returns {Promise<string | null>} executable path, or null when unavailable.
 */
async function compileHelper(workspace) {
  if (process.platform !== 'darwin') return null
  const swiftc = await findExecutable('swiftc')
  if (swiftc === null) return null
  const bin = safeJoin(workspace, '.dsh-leaf/bin/pdfhelper')
  const cache = safeJoin(workspace, '.dsh-leaf/swift-cache')
  const tmp = safeJoin(workspace, '.dsh-leaf/tmp')
  await mkdir(path.dirname(bin), { recursive: true })
  await mkdir(cache, { recursive: true })
  await mkdir(tmp, { recursive: true })
  const result = await runProcess(
    swiftc,
    ['-O', '-module-cache-path', cache, '-o', bin, HELPER_SOURCE],
    {
      cwd: workspace,
      timeoutMs: 120_000,
      env: { ...process.env, TMPDIR: tmp },
    },
  )
  if (result.exitCode !== 0) {
    throw new LeafError(503, 'pdf-helper-unavailable', `PDFKit helper failed to compile: ${result.stderr.trim().slice(-800)}`)
  }
  return bin
}

/**
 * Resolve (and, when stale, rebuild) the PDFKit helper.
 * @param {string} workspace - physical workspace root.
 * @returns {Promise<string | null>} executable path.
 */
export async function pdfHelper(workspace) {
  if (process.platform !== 'darwin') return null
  const bin = safeJoin(workspace, '.dsh-leaf/bin/pdfhelper')
  const [source, compiled] = await Promise.all([
    stat(HELPER_SOURCE).catch(() => null),
    stat(bin).catch(() => null),
  ])
  if (source === null) return null
  if (compiled !== null && compiled.mtimeMs >= source.mtimeMs) return bin
  let pending = compiles.get(workspace)
  if (pending === undefined) {
    pending = compileHelper(workspace)
    compiles.set(workspace, pending)
  }
  try {
    return await pending
  } finally {
    compiles.delete(workspace)
  }
}

/**
 * Read per-word boxes for one PDF page, cached by PDF mtime and page.
 * @param {object} input - workspace, absolute PDF path, page, and PDF mtime.
 * @returns {Promise<{page:number,pages:number,width:number,height:number,words:Array<object>}>} geometry.
 */
export async function readPdfPageText(input) {
  const pdf = safeJoin(input.workspace, input.pdfPath)
  const page = Math.max(1, Math.min(10000, Math.round(Number(input.page) || 1)))
  const cacheDir = safeJoin(input.workspace, '.dsh-leaf/build/pdftext')
  const cacheFile = path.join(cacheDir, `v1-${Math.round(Number(input.mtime) || 0)}-${page}.json`)
  const cached = await readFile(cacheFile, 'utf8').catch(() => null)
  if (cached !== null) {
    try {
      return JSON.parse(cached)
    } catch {
      // fall through and regenerate
    }
  }
  const helper = await pdfHelper(input.workspace)
  if (helper === null) {
    throw new LeafError(501, 'pdf-helper-unavailable', 'PDF text selection requires macOS PDFKit; the built-in viewer remains available.')
  }
  const result = await runProcess(helper, ['text', pdf, String(page)], { cwd: input.workspace, timeoutMs: 30_000 })
  if (result.exitCode !== 0) {
    throw new LeafError(422, 'pdf-text-failed', result.stderr.trim() || 'Could not read text from this PDF page.')
  }
  const parsed = JSON.parse(result.stdout)
  if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height) || !Array.isArray(parsed.words)) {
    throw new LeafError(422, 'pdf-text-failed', 'The PDF helper returned an unexpected page description.')
  }
  await mkdir(cacheDir, { recursive: true })
  await writeFile(cacheFile, result.stdout)
  return parsed
}

/**
 * Render one PDF page to a PNG, cached by PDF mtime, page, and scale.
 * @param {object} input - workspace, absolute PDF path, page, scale, and mtime.
 * @returns {Promise<string>} PNG path.
 */
export async function renderPdfPage(input) {
  const pdf = safeJoin(input.workspace, input.pdfPath)
  const page = Math.max(1, Math.min(10000, Math.round(Number(input.page) || 1)))
  const scale = Math.max(1, Math.min(5, Number(input.scale) || 2))
  const cacheDir = safeJoin(input.workspace, '.dsh-leaf/build/pdfpage')
  const file = path.join(cacheDir, `v1-${Math.round(Number(input.mtime) || 0)}-${page}-${scale}.png`)
  const cached = await stat(file).catch(() => null)
  if (cached !== null && cached.size > 0) return file
  const helper = await pdfHelper(input.workspace)
  if (helper === null) {
    throw new LeafError(501, 'pdf-helper-unavailable', 'Page rendering requires macOS PDFKit; the built-in viewer remains available.')
  }
  await mkdir(cacheDir, { recursive: true })
  const result = await runProcess(helper, ['render', pdf, String(page), file, String(scale)], { cwd: input.workspace, timeoutMs: 30_000 })
  if (result.exitCode !== 0) {
    throw new LeafError(422, 'pdf-render-failed', result.stderr.trim() || 'Could not render this PDF page.')
  }
  return file
}
