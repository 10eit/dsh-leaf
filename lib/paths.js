/**
 * Path, JSON, and small filesystem helpers shared by the dsh-leaf Host half.
 * Everything is deliberately dependency-free: the Host plugin ships as plain
 * ESM and imports only Node builtins, so it resolves identically from the
 * profile link, a packed tarball, or a source checkout.
 */
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Directory (inside a workspace) that owns all dsh-leaf bookkeeping. */
export const STATE_DIR = '.dsh-leaf'
/** Per-workspace project record. */
export const STATE_FILE = 'project.json'

/** Error carrying an HTTP status plus a stable machine-readable code. */
export class LeafError extends Error {
  /**
   * @param {number} status - HTTP status the route layer should answer with.
   * @param {string} code - stable diagnostic code for the client.
   * @param {string} message - human-readable explanation.
   */
  constructor(status, code, message) {
    super(message)
    this.name = 'LeafError'
    this.status = status
    this.code = code
  }
}

/**
 * Resolve an absolute path to its physical directory form.
 * @param {string} value - candidate directory.
 * @returns {Promise<string>} real path.
 */
export async function realDirectory(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new LeafError(400, 'workspace-missing', 'A workspace path is required.')
  }
  const abs = path.resolve(value)
  let info
  try {
    info = await stat(abs)
  } catch {
    throw new LeafError(404, 'workspace-not-found', `Workspace directory does not exist: ${abs}`)
  }
  if (!info.isDirectory()) {
    throw new LeafError(400, 'workspace-not-directory', `Workspace path is not a directory: ${abs}`)
  }
  return realpath(abs)
}

/**
 * Join a workspace-relative path and prove the result stays inside the root.
 * Absolute inputs are rejected as well: every caller speaks relative paths.
 * @param {string} root - physical workspace root.
 * @param {string} rel - workspace-relative path ('' means the root itself).
 * @returns {string} absolute path inside the workspace.
 */
export function safeJoin(root, rel) {
  const text = String(rel ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  if (text.split('/').includes('..')) {
    throw new LeafError(400, 'path-escape', 'Path escapes the workspace.')
  }
  const abs = path.resolve(root, text)
  const relative = path.relative(root, abs)
  if (relative !== '' && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new LeafError(400, 'path-escape', 'Path escapes the workspace.')
  }
  return abs
}

/**
 * Express an absolute path as a normalized workspace-relative path.
 * @param {string} root - workspace root.
 * @param {string} abs - absolute path inside it.
 * @returns {string} forward-slash relative path.
 */
export function relativeTo(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/')
}

/**
 * Check that a filesystem entry exists.
 * @param {string} target - absolute path.
 * @returns {Promise<boolean>} true when stat succeeds.
 */
export async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

/**
 * Read JSON, returning a fallback for a missing or unreadable file.
 * @param {string} file - absolute path.
 * @param {unknown} fallback - value when the file is absent.
 * @returns {Promise<any>} parsed value or the fallback.
 */
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * Write JSON through a sibling temp file and rename, so a crash never leaves
 * a half-written project record behind.
 * @param {string} file - destination path.
 * @param {unknown} value - JSON-serializable value.
 */
export async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temp, file)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/**
 * Turn any thrown value into a stable diagnostic payload.
 * @param {unknown} error - thrown value.
 * @returns {{status:number, code:string, message:string}} wire form.
 */
export function toDiagnostic(error) {
  if (error instanceof LeafError) {
    return { status: error.status, code: error.code, message: error.message }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { status: 500, code: 'internal', message }
}
