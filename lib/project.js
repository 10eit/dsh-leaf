/**
 * LaTeX project discovery and per-workspace project records.
 *
 * A dsh-leaf project is an ordinary directory: this module only reads and
 * writes `.dsh-leaf/project.json` and never rewrites the user's sources.
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  STATE_DIR,
  STATE_FILE,
  exists,
  readJson,
  relativeTo,
  safeJoin,
  writeJsonAtomic,
} from './paths.js'

/** Directories never scanned while looking for TeX entry points. */
const SKIP_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.dsh-leaf',
  'node_modules',
  'dist',
  'build',
  'out',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  '.cache',
])

/** Suffixes LaTeX writes next to sources; hidden in the tree by default. */
export const AUXILIARY_SUFFIXES = [
  '.aux',
  '.log',
  '.out',
  '.toc',
  '.lof',
  '.lot',
  '.fls',
  '.fdb_latexmk',
  '.synctex.gz',
  '.synctex',
  '.bbl',
  '.blg',
  '.bcf',
  '.run.xml',
  '.nav',
  '.snm',
  '.vrb',
  '.idx',
  '.ilg',
  '.ind',
  '.xdv',
  '.dvi',
]

/** Extra suffixes treated as build-only products in the tree. */
const BUILD_ONLY = new Set(['.aux', '.log', '.toc', '.out', '.fls', '.fdb_latexmk'])

/**
 * Whether a file name is a LaTeX build artifact.
 * @param {string} name - file name.
 * @returns {boolean} true for auxiliary products.
 */
export function isAuxiliaryName(name) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.synctex.gz')) return true
  const ext = path.extname(lower)
  return BUILD_ONLY.has(ext) || AUXILIARY_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

/**
 * Build the default project record for a workspace.
 * @param {string} workspace - physical workspace root.
 * @param {{enabledByDefault?: boolean, engine?: string, autoCompile?: boolean}} config - plugin config.
 * @returns {object} project record.
 */
export function defaultState(workspace, config = {}) {
  return {
    version: 1,
    workspace,
    enabled: config.enabledByDefault !== false,
    explicit: false,
    mainDocument: null,
    buildCwd: null,
    engine: config.engine === 'pdflatex' ? 'pdflatex' : 'xelatex',
    mode: 'full',
    autoCompile: config.autoCompile !== false,
    figuresDir: null,
    workspaceTitle: null,
    pinned: false,
    lastBuild: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Read one workspace's project record, merged over current defaults.
 * @param {string} workspace - physical workspace root.
 * @param {object} config - plugin config.
 * @returns {Promise<object>} project record; `explicit` marks an existing file.
 */
export async function readState(workspace, config = {}) {
  const file = path.join(workspace, STATE_DIR, STATE_FILE)
  const stored = await readJson(file, null)
  const base = defaultState(workspace, config)
  if (stored === null || typeof stored !== 'object') return base
  return {
    ...base,
    ...stored,
    workspace,
    explicit: true,
    engine: stored.engine === 'pdflatex' ? 'pdflatex' : 'xelatex',
    mode: stored.mode === 'fast' ? 'fast' : 'full',
    autoCompile: stored.autoCompile !== false,
    enabled: stored.enabled !== false,
  }
}

/**
 * Persist the full project record, refreshing `updatedAt`.
 * @param {string} workspace - physical workspace root.
 * @param {object} state - complete record.
 * @returns {Promise<object>} the saved record.
 */
export async function writeState(workspace, state) {
  const record = { ...state, workspace, updatedAt: new Date().toISOString() }
  await writeJsonAtomic(path.join(workspace, STATE_DIR, STATE_FILE), record)
  return record
}

/**
 * Merge a patch into a project record, validating the fields the UI may set.
 * @param {object} state - current record.
 * @param {object} patch - partial update.
 * @returns {object} merged record.
 */
export function applyStatePatch(state, patch) {
  const next = { ...state }
  if (typeof patch.enabled === 'boolean') {
    next.enabled = patch.enabled
    next.explicit = true
  }
  if (patch.mainDocument === null || typeof patch.mainDocument === 'string') {
    next.mainDocument = patch.mainDocument === null ? null : patch.mainDocument.replaceAll('\\', '/')
  }
  if (typeof patch.buildCwd === 'string' || patch.buildCwd === null) {
    next.buildCwd = patch.buildCwd
  }
  if (patch.engine === 'xelatex' || patch.engine === 'pdflatex') next.engine = patch.engine
  if (patch.mode === 'full' || patch.mode === 'fast') next.mode = patch.mode
  if (typeof patch.autoCompile === 'boolean') next.autoCompile = patch.autoCompile
  if (typeof patch.figuresDir === 'string' || patch.figuresDir === null) {
    next.figuresDir = patch.figuresDir
  }
  return next
}

/**
 * Read the first chunk of a file as UTF-8; used to classify TeX entry points
 * and detect CJK content without reading a whole manuscript per candidate.
 * @param {string} file - absolute path.
 * @param {number} limit - byte ceiling.
 * @returns {Promise<string>} decoded head.
 */
async function readHead(file, limit = 64 * 1024) {
  const { open } = await import('node:fs/promises')
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(limit)
    const { bytesRead } = await handle.read(buffer, 0, limit, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

/**
 * Whether source text looks like a compilable Top-level document.
 * @param {string} text - file head.
 * @returns {{isMain: boolean, documentClass: string | null, chinese: boolean}} classification.
 */
export function classifyTexSource(text) {
  const documentClass = /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/.exec(text)?.[1] ?? null
  const chinese = /ctex|xecjk|\\begin\{CJK\}|[\u3400-\u9fff]/.test(text)
  return { isMain: documentClass !== null, documentClass, chinese }
}

/**
 * Discover candidate main documents under a workspace.
 * @param {string} workspace - physical workspace root.
 * @param {{maxDepth?: number, maxFiles?: number}} limits - scan bounds.
 * @returns {Promise<Array<{path: string, name: string, documentClass: string, chinese: boolean}>>} candidates.
 */
export async function findMainCandidates(workspace, limits = {}) {
  const maxDepth = limits.maxDepth ?? 3
  const maxFiles = limits.maxFiles ?? 400
  const found = []
  let scanned = 0
  const queue = [{ dir: workspace, depth: 0 }]
  while (queue.length > 0 && scanned < maxFiles) {
    const { dir, depth } = queue.shift()
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth < maxDepth && !SKIP_DIRS.has(entry.name)) queue.push({ dir: abs, depth: depth + 1 })
        continue
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.tex')) continue
      scanned += 1
      if (scanned > maxFiles) break
      const info = await stat(abs).catch(() => null)
      if (info === null || info.size > 4 * 1024 * 1024) continue
      const source = await readHead(abs).catch(() => '')
      const classified = classifyTexSource(source)
      if (!classified.isMain) continue
      found.push({
        path: relativeTo(workspace, abs),
        name: entry.name,
        documentClass: classified.documentClass,
        chinese: classified.chinese,
      })
    }
  }
  return found.sort((a, b) => depthOf(a.path) - depthOf(b.path) || a.path.localeCompare(b.path))
}

/**
 * Count path segments, so shallower entry points sort first.
 * @param {string} value - relative path.
 * @returns {number} depth.
 */
function depthOf(value) {
  return value.split('/').length
}

/**
 * Pick a sensible default main document without silently guessing between
 * equally plausible candidates.
 * @param {Array<{path: string}>} candidates - discovered entry points.
 * @returns {{main: string | null, ambiguous: boolean}} choice.
 */
export function chooseMain(candidates) {
  if (candidates.length === 0) return { main: null, ambiguous: false }
  const rootMain = candidates.find((candidate) => candidate.path === 'main.tex')
  if (rootMain !== undefined) return { main: rootMain.path, ambiguous: false }
  const shallowest = depthOf(candidates[0].path)
  const top = candidates.filter((candidate) => depthOf(candidate.path) === shallowest)
  if (top.length === 1) return { main: top[0].path, ambiguous: false }
  return { main: null, ambiguous: true }
}

/**
 * Guess the project's figure directory from common names.
 * @param {string} workspace - physical workspace root.
 * @returns {Promise<string | null>} relative directory or null.
 */
export async function detectFiguresDir(workspace) {
  for (const name of ['figures', 'figure', 'figs', 'images', 'img']) {
    if (await exists(path.join(workspace, name))) return name
  }
  return null
}

/**
 * Snapshot of the project a client panel renders.
 * @param {object} state - project record.
 * @returns {object} projection without internal fields.
 */
export function projectView(state) {
  return {
    enabled: state.enabled,
    explicit: state.explicit,
    mainDocument: state.mainDocument,
    buildCwd: state.buildCwd,
    engine: state.engine,
    mode: state.mode,
    autoCompile: state.autoCompile,
    figuresDir: state.figuresDir,
    pinned: state.pinned === true,
    workspaceTitle: state.workspaceTitle ?? null,
    lastBuild: state.lastBuild,
  }
}

/**
 * List a directory lazily, one level at a time.
 * @param {string} workspace - physical workspace root.
 * @param {string} rel - workspace-relative directory ('' for the root).
 * @param {{showAuxiliary?: boolean, showHidden?: boolean}} options - filters.
 * @returns {Promise<{dir: string, entries: Array<object>}>} one directory page.
 */
export async function listDirectory(workspace, rel, options = {}) {
  const abs = safeJoin(workspace, rel)
  const info = await stat(abs).catch(() => null)
  if (info === null || !info.isDirectory()) {
    throw Object.assign(new Error(`Not a directory: ${rel || '.'}`), { status: 404, code: 'not-directory' })
  }
  const dirents = await readdir(abs, { withFileTypes: true })
  const entries = []
  const limit = options.limit ?? 500
  let truncated = false
  for (const dirent of dirents) {
    if (entries.length >= limit) {
      truncated = true
      break
    }
    const name = dirent.name
    if (!options.showHidden && name.startsWith('.')) continue
    if (name === STATE_DIR) continue
    if (!options.showAuxiliary && isAuxiliaryName(name)) continue
    const childAbs = path.join(abs, name)
    if (dirent.isSymbolicLink()) continue
    const childRel = relativeTo(workspace, childAbs)
    const isDir = dirent.isDirectory()
    const childInfo = isDir ? null : await stat(childAbs).catch(() => null)
    entries.push({
      name,
      path: childRel,
      type: isDir ? 'directory' : 'file',
      extension: isDir ? '' : path.extname(name).slice(1).toLowerCase(),
      size: childInfo?.size ?? 0,
      mtime: childInfo?.mtimeMs ?? 0,
    })
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return { dir: rel, entries, truncated }
}

/**
 * Build a minimal but genuinely compilable project.
 * @param {'zh' | 'en'} template - document language.
 * @param {string} title - document title.
 * @returns {Array<{path: string, content: string}>} files to create.
 */
export function templateFiles(template, title) {
  const chinese = template === 'zh'
  const heading = chinese ? '引言' : 'Introduction'
  const abstract = chinese
    ? '这里是摘要。请在写作视图中补充研究问题、方法与主要结论。'
    : 'This is the abstract. Describe the research question, method, and main findings.'
  const body = chinese
    ? `本节介绍研究背景与问题。实验数据与图表保存在 \\texttt{figures/} 目录，可在同一工作区的普通对话中生成。

\\begin{figure}[htbp]
  \\centering
  % \\includegraphics[width=0.8\\linewidth]{figures/example.pdf}
  \\caption{示例图注。}
  \\label{fig:example}
\\end{figure}

正文引用示例：图~\\ref{fig:example}。`
    : `This section introduces the background and the research question. Figures produced from experiments live in \\texttt{figures/} and can be generated from a normal conversation in this workspace.

\\begin{figure}[htbp]
  \\centering
  % \\includegraphics[width=0.8\\linewidth]{figures/example.pdf}
  \\caption{Example caption.}
  \\label{fig:example}
\\end{figure}

Reference example: Figure~\\ref{fig:example}.`
  const main = chinese
    ? `\\documentclass[11pt,a4paper]{article}
\\usepackage[UTF8]{ctex}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{${title}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
${abstract}
\\end{abstract}

\\input{sections/introduction}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`
    : `\\documentclass[11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{${title}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
${abstract}
\\end{abstract}

\\input{sections/introduction}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`
  const section = `\\section{${heading}}
${body}
`
  const bibliography = chinese
    ? `@article{example2025,
  title   = {示例参考文献},
  author  = {作者},
  journal = {期刊},
  year    = {2025}
}
`
    : `@article{example2025,
  title   = {An example reference},
  author  = {Author},
  journal = {Journal},
  year    = {2025}
}
`
  return [
    { path: 'main.tex', content: main },
    { path: 'sections/introduction.tex', content: section },
    { path: 'references.bib', content: bibliography },
    { path: `${chinese ? 'figures' : 'figures'}/.gitkeep`, content: '' },
  ]
}

/**
 * Create template files without overwriting anything the user already owns.
 * @param {string} workspace - physical workspace root.
 * @param {'zh' | 'en'} template - template id.
 * @param {string} title - document title.
 * @returns {Promise<{created: string[], skipped: string[]}>} outcome.
 */
export async function createTemplate(workspace, template, title) {
  const created = []
  const skipped = []
  for (const file of templateFiles(template, title || (template === 'zh' ? '论文题目' : 'Paper title'))) {
    const abs = safeJoin(workspace, file.path)
    if (await exists(abs)) {
      skipped.push(file.path)
      continue
    }
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, file.content, 'utf8')
    created.push(file.path)
  }
  return { created, skipped }
}

/**
 * Read a UTF-8 text file with a binary guard.
 * @param {string} workspace - physical workspace root.
 * @param {string} rel - workspace-relative path.
 * @returns {Promise<{path: string, content: string, size: number, mtime: number}>} file payload.
 */
export async function readTextFile(workspace, rel) {
  const abs = safeJoin(workspace, rel)
  const info = await stat(abs).catch(() => null)
  if (info === null || !info.isFile()) {
    throw Object.assign(new Error(`File not found: ${rel}`), { status: 404, code: 'not-found' })
  }
  if (info.size > 8 * 1024 * 1024) {
    throw Object.assign(new Error('File is larger than the 8 MiB editor limit.'), { status: 413, code: 'too-large' })
  }
  const buffer = await readFile(abs)
  if (buffer.includes(0)) {
    throw Object.assign(new Error('Binary file.'), { status: 415, code: 'binary' })
  }
  return {
    path: rel,
    content: buffer.toString('utf8'),
    size: info.size,
    mtime: info.mtimeMs,
  }
}

/**
 * Write a text file, guarding against clobbering an external edit.
 * @param {string} workspace - physical workspace root.
 * @param {string} rel - workspace-relative path.
 * @param {string} content - new content.
 * @param {number | null} expectedMtime - mtime the editor last saw.
 * @returns {Promise<{path: string, mtime: number, size: number}>} write receipt.
 */
export async function saveTextFile(workspace, rel, content, expectedMtime = null) {
  if (typeof content !== 'string') {
    throw Object.assign(new Error('content must be a string'), { status: 400, code: 'bad-request' })
  }
  const abs = safeJoin(workspace, rel)
  const info = await stat(abs).catch(() => null)
  if (info !== null && !info.isFile()) {
    throw Object.assign(new Error(`Not a file: ${rel}`), { status: 400, code: 'not-file' })
  }
  if (info !== null && info.size > 8 * 1024 * 1024) {
    throw Object.assign(new Error('File is larger than the 8 MiB editor limit.'), { status: 413, code: 'too-large' })
  }
  if (info !== null && expectedMtime !== null && Math.abs(info.mtimeMs - expectedMtime) > 1) {
    const conflict = Object.assign(new Error('File changed on disk since it was opened.'), {
      status: 409,
      code: 'conflict',
      mtime: info.mtimeMs,
    })
    throw conflict
  }
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf8')
  const after = await stat(abs)
  return { path: rel, mtime: after.mtimeMs, size: after.size }
}

/**
 * Create a new TeX file with a minimal compilable skeleton.
 * @param {string} workspace - physical workspace root.
 * @param {{path: string, kind?: 'main' | 'section', title?: string}} input - creation request.
 * @returns {Promise<{path: string, kind: string, created: boolean}>} outcome.
 */
export async function createTexFile(workspace, input) {
  const rel = String(input.path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  if (!rel.toLowerCase().endsWith('.tex')) {
    throw Object.assign(new Error('TeX file names must end with .tex'), { status: 400, code: 'bad-extension' })
  }
  if (rel.split('/').includes('..') || rel === '') {
    throw Object.assign(new Error('Invalid path'), { status: 400, code: 'bad-path' })
  }
  const abs = safeJoin(workspace, rel)
  if (await exists(abs)) {
    throw Object.assign(new Error(`File already exists: ${rel}`), { status: 409, code: 'exists' })
  }
  const title = input.title ?? path.basename(rel, '.tex')
  const kind = input.kind === 'main' ? 'main' : 'section'
  const body = kind === 'main'
    ? `\\documentclass[11pt]{article}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}

\\title{${title}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\input{sections/introduction}

\\end{document}
`
    : `\\section{${title}}

Text.
`
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, body, 'utf8')
  return { path: rel, kind, created: true }
}
