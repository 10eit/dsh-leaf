/**
 * Local LaTeX toolchain discovery, probe compilation, and the build pipeline.
 *
 * The plugin never installs anything on its own: it reuses a working local
 * distribution, reports what is missing, and leaves installation decisions to
 * the user (see the requirements' environment section).
 */
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { LeafError, exists, relativeTo, safeJoin } from './paths.js'
import { chooseMain, findMainCandidates, writeState } from './project.js'

/** Engines the first version supports directly. */
export const SUPPORTED_ENGINES = ['xelatex', 'pdflatex']

/** Build-only directory inside the workspace. */
export const BUILD_DIR = '.dsh-leaf/build'

/** Extra places TeX Live and BasicTeX install into on macOS. */
async function texInstallDirs() {
  const dirs = new Set([
    '/Library/TeX/texbin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(homedir(), 'Library/TinyTeX/bin'),
  ])
  for (const root of ['/usr/local/texlive', path.join(homedir(), 'Library/TinyTeX/bin')]) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (root === '/usr/local/texlive') {
        const bins = await readdir(path.join(root, entry.name, 'bin'), { withFileTypes: true }).catch(() => [])
        for (const bin of bins) if (bin.isDirectory()) dirs.add(path.join(root, entry.name, 'bin', bin.name))
      } else {
        dirs.add(path.join(root, entry.name))
      }
    }
  }
  return [...dirs]
}

/**
 * Locate an executable by name across PATH and the known TeX install roots.
 * @param {string} name - executable name.
 * @returns {Promise<string | null>} absolute path or null.
 */
export async function findExecutable(name) {
  const fromPath = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const dirs = [...new Set([...fromPath, ...(await texInstallDirs())])]
  for (const dir of dirs) {
    const candidate = path.join(dir, name)
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      // keep looking
    }
  }
  return null
}

/**
 * Read the version banner of one executable without hanging on a GUI binary.
 * @param {string} executable - absolute path.
 * @returns {Promise<string>} first line of version output.
 */
async function versionOf(executable) {
  const result = await runProcess(executable, ['--version'], {
    cwd: tmpdir(),
    timeoutMs: 8000,
    env: { ...process.env, PATH: `${path.dirname(executable)}:${process.env.PATH ?? ''}` },
  })
  const line = `${result.stdout}${result.stderr}`.split('\n').find((value) => value.trim() !== '')
  return (line ?? '').trim()
}

/** In-process environment cache; refreshes after an explicit probe. */
let environmentCache = null

/**
 * Detect the local LaTeX environment without compiling. The result is cached
 * briefly because the UI polls it while the panel is open.
 * @param {{force?: boolean}} options - bypass the cache.
 * @returns {Promise<object>} environment report.
 */
export async function detectEnvironment(options = {}) {
  if (!options.force && environmentCache !== null && Date.now() - environmentCache.checkedAtMs < 60_000) {
    return environmentCache
  }
  const engines = {}
  for (const name of [...SUPPORTED_ENGINES, 'latexmk', 'bibtex', 'biber', 'tlmgr', 'synctex']) {
    const found = await findExecutable(name)
    engines[name] = found === null ? null : { path: found, version: await versionOf(found) }
  }
  const xelatex = engines.xelatex !== null
  const pdflatex = engines.pdflatex !== null
  const distribution = engines.tlmgr?.version ?? engines.pdflatex?.version ?? engines.xelatex?.version ?? null
  const parts = {
    engine: xelatex || pdflatex,
    latexmk: engines.latexmk !== null,
    bibtex: engines.bibtex !== null || engines.biber !== null,
    synctex: engines.synctex !== null,
  }
  const status = !parts.engine ? 'missing' : Object.values(parts).every(Boolean) ? 'detected' : 'partial'
  const report = {
    status,
    available: parts.engine,
    parts,
    engines,
    distribution,
    checkedAt: new Date().toISOString(),
    checkedAtMs: Date.now(),
    probe: null,
    message:
      status === 'missing'
        ? 'No pdflatex or xelatex was found. Install BasicTeX or TeX Live, or point dsh-leaf at an existing toolchain.'
        : status === 'partial'
          ? 'Core engines are available; some optional tools (latexmk, bibliography, SyncTeX) are missing.'
          : 'A local TeX distribution was found. Run the probe to verify it compiles a minimal document.',
  }
  environmentCache = report
  return report
}

/** Single-flight probe state, so repeated clicks share one compilation. */
let probeInFlight = null

/**
 * Verify the environment with a minimal compile. A pass is the only proof the
 * requirement accepts for "available".
 * @param {{engine?: string}} options - preferred engine.
 * @returns {Promise<object>} environment report with `probe`.
 */
export async function probeEnvironment(options = {}) {
  if (probeInFlight !== null) return probeInFlight
  probeInFlight = (async () => {
    const report = await detectEnvironment({ force: true })
    if (!report.available) return { ...report, probe: { ok: false, message: 'No LaTeX engine found.' } }
    const engine = options.engine === 'pdflatex' && report.engines.pdflatex !== null
      ? 'pdflatex'
      : report.engines.xelatex !== null
        ? 'xelatex'
        : 'pdflatex'
    const executable = report.engines[engine]?.path
    if (executable === undefined || executable === null) {
      return { ...report, probe: { ok: false, message: `Engine ${engine} is not installed.` } }
    }
    const dir = path.join(tmpdir(), `dsh-leaf-probe-${process.pid}-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const source = path.join(dir, 'probe.tex')
    await writeFile(source, '\\documentclass{article}\n\\begin{document}\ndsh-leaf probe $E=mc^2$.\n\\end{document}\n', 'utf8')
    const result = await runProcess(executable, [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-no-shell-escape',
      '-output-directory', dir,
      'probe.tex',
    ], { cwd: dir, timeoutMs: 60_000 })
    const pdf = path.join(dir, 'probe.pdf')
    const pdfInfo = await stat(pdf).catch(() => null)
    const ok = result.exitCode === 0 && pdfInfo !== null && pdfInfo.size > 0
    const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-12).join('\n')
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    const probed = {
      ...report,
      status: ok ? 'ready' : report.status === 'detected' ? 'failed' : report.status,
      available: ok,
      probe: {
        ok,
        engine,
        message: ok
          ? `${engine} compiled a minimal document.`
          : `${engine} failed to compile a minimal document. Check the installation and the probe log below.`,
        log: tail,
        checkedAt: new Date().toISOString(),
      },
    }
    environmentCache = probed
    return probed
  })()
  try {
    return await probeInFlight
  } finally {
    probeInFlight = null
  }
}

/**
 * Spawn a process and capture bounded output. Resolves for non-zero exits and
 * rejects only when the process could not be started at all.
 * @param {string} command - executable.
 * @param {string[]} args - argument vector.
 * @param {{cwd?: string, timeoutMs?: number, env?: Record<string,string>, signal?: AbortSignal, onSpawn?: (child: import('node:child_process').ChildProcess) => void}} options - limits.
 * @returns {Promise<{exitCode: number|null, stdout: string, stderr: string, timedOut: boolean, aborted: boolean}>} outcome.
 */
export function runProcess(command, args, options = {}) {
  const limit = 2 * 1024 * 1024
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    options.onSpawn?.(child)
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    const timer = options.timeoutMs === undefined ? null : setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, options.timeoutMs)
    const onAbort = () => {
      aborted = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000).unref?.()
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', (chunk) => {
      if (stdout.length < limit) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < limit) stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      if (timer !== null) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      if (timer !== null) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      resolve({ exitCode: code, stdout, stderr, timedOut, aborted, child })
    })
  })
}

/**
 * Parse a LaTeX log into actionable diagnostics.
 * @param {string} log - log text (full or truncated tail).
 * @param {string} workspace - physical workspace root.
 * @param {string} buildCwd - directory TeX ran from.
 * @returns {{errors: Array<object>, warnings: string[], missing: Array<object>}} diagnostics.
 */
export function parseLatexLog(log, workspace, buildCwd) {
  const errors = []
  const warnings = []
  const missing = new Map()
  // TeX hard-wraps log lines at 79 columns, sometimes splitting "file:line:".
  // Rejoin a wrap that lands immediately before the line number so structured
  // errors survive long temporary paths.
  const lines = log.replace(/\n(?=\d+:)/g, '').split('\n')
  let currentFile = null
  const filePattern = /\((?:\.\/)?([^()\s]+\.(?:tex|sty|cls|bib|bbl|ltx))/
  const fileLinePattern = /^(.+?\.(?:tex|sty|cls|bib)):(\d+):\s*(.*)$/
  const normalize = (file) => {
    if (file === null || file === '') return null
    const abs = path.isAbsolute(file) ? file : path.resolve(buildCwd, file)
    const rel = relativeTo(workspace, abs)
    return rel.startsWith('..') ? null : rel
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fileMatch = filePattern.exec(line)
    if (fileMatch !== null) currentFile = fileMatch[1]
    const structured = fileLinePattern.exec(line.trim())
    if (structured !== null) {
      let message = structured[3].trim()
      // A wrapped one- or two-character message continues on the next line.
      if (message.length <= 2 && index + 1 < lines.length && /^[a-z]/.test(lines[index + 1])) {
        message += lines[index + 1].trim()
        index += 1
      }
      const severity = /^(warning|overfull|underfull)/i.test(message) ? 'warning' : 'error'
      if (severity === 'warning') {
        if (warnings.length < 100) warnings.push(`${structured[1]}:${structured[2]}: ${message}`)
      } else if (errors.length < 80) {
        errors.push({
          file: normalize(structured[1]),
          line: Number(structured[2]),
          message,
          severity: 'error',
        })
      }
      continue
    }
    if (line.startsWith('! ')) {
      const message = line.slice(2).trim()
      const missingMatch = /File `([^']+)' not found/.exec(message)
      if (missingMatch !== null) {
        const name = missingMatch[1]
        const hint = name.endsWith('.sty') || name.endsWith('.cls')
          ? `Run "sudo tlmgr install ${name.replace(/\.(sty|cls)$/, '')}" or install the package that provides ${name}.`
          : `The file ${name} is missing from the project or the TeX distribution.`
        missing.set(name, { name, hint })
        if (errors.length < 80) {
          errors.push({ file: normalize(currentFile), line: null, message, severity: 'error', missing: name })
        }
        continue
      }
      if (errors.length < 80) {
        errors.push({ file: normalize(currentFile), line: null, message, severity: 'error' })
      }
      continue
    }
    if (line.startsWith('LaTeX Warning:')) {
      const message = line.slice('LaTeX Warning:'.length).trim()
      const lineMatch = /on input line (\d+)/.exec(message)
      if (warnings.length < 100) {
        warnings.push(`${normalize(currentFile) ?? 'document'}${lineMatch === null ? '' : `:${lineMatch[1]}`}: ${message}`)
      }
    }
  }
  return { errors, warnings, missing: [...missing.values()] }
}

/**
 * Produce a bounded, human-readable log tail.
 * @param {string} log - full log.
 * @param {number} limit - maximum lines.
 * @returns {{tail: string, truncated: boolean}} excerpt.
 */
export function logTail(log, limit = 160) {
  const lines = log.split('\n')
  const truncated = lines.length > limit
  return { tail: lines.slice(-limit).join('\n').trim(), truncated }
}

/** One serialized build per workspace, with latest-wins queuing. */
export class BuildManager {
  /** @param {{ctx: object}} options - host context holder. */
  constructor(options) {
    this.ctx = options.ctx
    this.jobs = new Map()
    this.onBuild = options.onBuild ?? (() => {})
  }

  /**
   * Read the current build state of a workspace.
   * @param {string} workspace - physical root.
   * @returns {{running: boolean, queued: boolean}} status.
   */
  statusOf(workspace) {
    const job = this.jobs.get(workspace)
    return { running: job !== undefined, queued: job?.pending !== undefined }
  }

  /**
   * Compile a project. Concurrent requests for the same workspace queue and
   * only the latest one runs, matching the single-build-per-project contract.
   * @param {string} workspace - physical root.
   * @param {object} state - project record.
   * @param {{engine?: string, mode?: string, mainDocument?: string}} options - overrides.
   * @returns {Promise<object>} build receipt.
   */
  async compile(workspace, state, options = {}) {
    const job = this.jobs.get(workspace)
    if (job !== undefined) {
      const queued = new Promise((resolve, reject) => {
        job.pending = { resolve, reject, options: { ...options, state } }
      })
      return queued
    }
    this.jobs.set(workspace, { pending: null, child: null, stopped: false })
    return this.#loop(workspace, state, options)
  }

  /**
   * Drive one job and every latest-wins replacement queued behind it.
   * @param {string} workspace - physical root.
   * @param {object} state - project record.
   * @param {object} options - build options.
   * @returns {Promise<object>} the first build receipt.
   */
  async #loop(workspace, state, options) {
    const job = this.jobs.get(workspace)
    let receipt
    let failure = null
    try {
      receipt = await this.#run(workspace, job, state, options)
    } catch (error) {
      failure = error
    }
    while (job.pending !== null) {
      const next = job.pending
      job.pending = null
      if (failure !== null) {
        next.reject(failure)
        continue
      }
      job.stopped = false
      job.child = null
      try {
        receipt = await this.#run(workspace, job, next.options.state ?? state, next.options)
        next.resolve(receipt)
      } catch (error) {
        failure = error
        next.reject(error)
      }
    }
    this.jobs.delete(workspace)
    if (failure !== null) throw failure
    return receipt
  }

  /**
   * Ask the running build for this workspace to stop.
   * @param {string} workspace - physical root.
   * @returns {{stopped: boolean}} whether a build was live.
   */
  stop(workspace) {
    const job = this.jobs.get(workspace)
    if (job === undefined) return { stopped: false }
    job.stopped = true
    if (job.pending !== null) {
      const pending = job.pending
      job.pending = null
      pending.resolve({
        ok: false,
        status: 'stopped',
        engine: pending.options.engine ?? 'xelatex',
        mode: pending.options.mode ?? 'full',
        mainDocument: pending.options.state?.mainDocument ?? null,
        durationMs: 0,
        errors: [],
        warnings: [],
        missing: [],
        logTail: 'Build stopped before it started.',
        pdf: { available: false, stale: true, path: null, mtime: 0, bytes: 0 },
      })
    }
    job.child?.kill('SIGTERM')
    return { stopped: true }
  }

  /**
   * Resolve the entry point and directory the build should use.
   * @param {string} workspace - physical root.
   * @param {object} state - project record.
   * @param {string | undefined} requested - explicit main document.
   * @returns {Promise<{mainRel: string, mainAbs: string, cwd: string}>} resolved inputs.
   */
  async #resolveEntry(workspace, state, requested) {
    let mainRel = requested ?? state.mainDocument
    if (mainRel === null || mainRel === undefined || mainRel === '') {
      const candidates = await findMainCandidates(workspace)
      const choice = chooseMain(candidates)
      if (choice.main === null) {
        if (candidates.length > 1) {
          throw Object.assign(new LeafError(409, 'main-ambiguous', 'Several documents could be the main file. Choose one in dsh-leaf.'), {
            candidates: candidates.map((candidate) => candidate.path),
          })
        }
        throw new LeafError(404, 'no-main', 'No compilable main document was found in this workspace.')
      }
      mainRel = choice.main
      state.mainDocument = mainRel
      await writeState(workspace, state)
    }
    const mainAbs = safeJoin(workspace, mainRel)
    if (!(await exists(mainAbs))) throw new LeafError(404, 'main-missing', `Main document is missing: ${mainRel}`)
    const cwd = state.buildCwd !== null && state.buildCwd !== undefined && state.buildCwd !== ''
      ? safeJoin(workspace, state.buildCwd)
      : path.dirname(mainAbs)
    return { mainRel, mainAbs, cwd }
  }

  /**
   * Run one build and return its receipt.
   * @param {string} workspace - physical root.
   * @param {object} job - in-flight job record.
   * @param {object} state - project record.
   * @param {object} options - build options.
   * @returns {Promise<object>} build receipt.
   */
  async #run(workspace, job, state, options) {
    const startedAt = Date.now()
    const mode = options.mode === 'fast' ? 'fast' : options.mode === 'full' ? 'full' : state.mode === 'fast' ? 'fast' : 'full'
    const engine = options.engine === 'pdflatex' ? 'pdflatex' : options.engine === 'xelatex' ? 'xelatex' : state.engine
    const environment = await detectEnvironment()
    if (!environment.available) {
      const receipt = {
        ok: false,
        status: 'no-environment',
        engine,
        mode,
        durationMs: Date.now() - startedAt,
        errors: [],
        warnings: [],
        missing: [],
        logTail: 'No LaTeX engine is installed. Install BasicTeX or TeX Live, then run the environment check again.',
        pdf: { available: false, stale: false, path: null, mtime: 0, bytes: 0 },
        mainDocument: state.mainDocument,
      }
      return receipt
    }
    const { mainRel, mainAbs, cwd } = await this.#resolveEntry(workspace, state, options.mainDocument)
    const buildDir = path.join(workspace, BUILD_DIR, mode)
    await mkdir(buildDir, { recursive: true })
    const baseName = path.basename(mainAbs, '.tex')
    const jobName = mode === 'fast' ? `${baseName}-fast` : baseName
    const latexmk = await findExecutable('latexmk')
    const engineBin = environment.engines[engine]?.path ?? (await findExecutable(engine))
    if (engineBin === null || engineBin === undefined) {
      throw new LeafError(400, 'engine-missing', `${engine} is not installed. Choose the other engine or install the missing tool.`)
    }
    const env = {
      ...process.env,
      PATH: [...new Set([path.dirname(engineBin), ...(process.env.PATH ?? '').split(path.delimiter)])].join(path.delimiter),
      TEXMFVAR: process.env.TEXMFVAR ?? path.join(homedir(), '.cache', 'dsh-leaf', 'texmf-var'),
      BIBINPUTS: `${cwd}:${process.env.BIBINPUTS ?? ''}`,
      TEXINPUTS: `${cwd}:${process.env.TEXINPUTS ?? ''}`,
    }
    await mkdir(env.TEXMFVAR, { recursive: true }).catch(() => {})
    let command
    let args
    if (latexmk !== null && latexmk !== undefined) {
      command = latexmk
      args = [
        '-g',
        '-interaction=nonstopmode',
        '-file-line-error',
        '-synctex=1',
        `-outdir=${buildDir}`,
        `-jobname=${jobName}`,
        engine === 'pdflatex' ? '-pdf' : '-xelatex',
      ]
      if (mode === 'fast') {
        const wrapper = path.join(buildDir, '__leaf_fast.tex')
        await writeFile(
          wrapper,
          `\\PassOptionsToPackage{draft}{graphicx}\n\\input{${mainAbs.replaceAll('\\', '/')}}\n`,
          'utf8',
        )
        args.push(wrapper)
      } else {
        args.push(mainAbs)
      }
    } else if (mode === 'fast') {
      command = engineBin
      args = [
        '-interaction=nonstopmode',
        '-file-line-error',
        '-synctex=1',
        `-output-directory=${buildDir}`,
        `-jobname=${jobName}`,
        `\\PassOptionsToPackage{draft}{graphicx}\\input{${mainAbs}}`,
      ]
    } else {
      command = engineBin
      args = [
        '-interaction=nonstopmode',
        '-file-line-error',
        '-synctex=1',
        `-output-directory=${buildDir}`,
        `-jobname=${jobName}`,
        path.basename(mainAbs),
      ]
    }
    const runOnce = () => runProcess(command, args, {
      cwd,
      env,
      timeoutMs: 10 * 60_000,
      onSpawn: (child) => {
        job.child = child
      },
    })
    let outcome = await runOnce()
    const logFile = path.join(buildDir, `${jobName}.log`)
    let log = await readFile(logFile, 'utf8').catch(() => `${outcome.stdout}\n${outcome.stderr}`)
    if (outcome.exitCode !== 0 && !outcome.aborted && !outcome.timedOut) {
      // A bibliography or a changed reference table needs a second pass.
      const aux = await readFile(path.join(buildDir, `${jobName}.aux`), 'utf8').catch(() => '')
      if (/\\bibdata|\\citation/.test(aux) && latexmk === null) {
        const bibtex = (await findExecutable('biber')) ?? (await findExecutable('bibtex'))
        if (bibtex !== null) {
          const bibResult = await runProcess(
            bibtex,
            [path.basename(aux, '.aux')],
            { cwd: buildDir, env, timeoutMs: 120_000 },
          )
          outcome = { ...outcome, stdout: `${outcome.stdout}\n${bibResult.stdout}`, stderr: `${outcome.stderr}\n${bibResult.stderr}` }
          outcome = await runOnce()
          log = await readFile(logFile, 'utf8').catch(() => `${outcome.stdout}\n${outcome.stderr}`)
        }
      }
    }
    if (outcome.exitCode !== 0 && !outcome.aborted && !outcome.timedOut) {
      outcome = await runOnce()
      log = await readFile(logFile, 'utf8').catch(() => `${outcome.stdout}\n${outcome.stderr}`)
    }
    const pdfFile = path.join(buildDir, `${jobName}.pdf`)
    const pdfInfo = await stat(pdfFile).catch(() => null)
    const diagnostics = parseLatexLog(log, workspace, cwd)
    const tail = logTail(log)
    const stopped = job.stopped || outcome.aborted
    const ok = outcome.exitCode === 0 && pdfInfo !== null && pdfInfo.size > 0 && !stopped
    const finishedAt = Date.now()
    const receipt = {
      ok,
      status: stopped ? 'stopped' : outcome.timedOut ? 'timeout' : ok ? (diagnostics.warnings.length > 0 ? 'warning' : 'success') : 'failed',
      engine,
      mode,
      mainDocument: mainRel,
      durationMs: finishedAt - startedAt,
      startedAt,
      finishedAt,
      exitCode: outcome.exitCode,
      errors: diagnostics.errors,
      warnings: diagnostics.warnings,
      missing: diagnostics.missing,
      logTail: tail.tail,
      logTruncated: tail.truncated,
      pdf: pdfInfo !== null && (ok || stopped)
        ? {
            available: true,
            path: relativeTo(workspace, pdfFile),
            mtime: pdfInfo.mtimeMs,
            bytes: pdfInfo.size,
            stale: !ok,
          }
        : {
            available: false,
            path: null,
            mtime: 0,
            bytes: 0,
            stale: true,
            previous: state.lastBuild?.pdf ?? null,
          },
    }
    state.lastBuild = {
      status: receipt.status,
      engine,
      mode,
      mainDocument: mainRel,
      finishedAt,
      durationMs: receipt.durationMs,
      ok,
      pdf: receipt.pdf.available
        ? { path: receipt.pdf.path, mtime: receipt.pdf.mtime }
        : state.lastBuild?.pdf ?? null,
    }
    state.mode = mode
    if (options.engine !== undefined) state.engine = engine
    await writeState(workspace, state).catch(() => {})
    this.onBuild(workspace, receipt)
    return { ...receipt, state: state.lastBuild }
  }
}

/**
 * Remove only dsh-leaf's own build directory. Source files, figures, and any
 * PDF the user saved elsewhere are untouched.
 * @param {string} workspace - physical root.
 * @returns {Promise<{removed: boolean}>} cleanup outcome.
 */
export async function cleanBuild(workspace) {
  const dir = path.join(workspace, BUILD_DIR)
  const existed = await exists(dir)
  await rm(dir, { recursive: true, force: true })
  return { removed: existed }
}

/**
 * Run a SyncTeX forward search from a source location to a page position.
 * @param {{workspace: string, buildCwd: string, pdfPath: string, file: string, line: number, column?: number}} input - query.
 * @returns {Promise<{page: number, x: number, y: number} | null>} PDF position.
 */
export async function synctexForward(input) {
  const synctex = await findExecutable('synctex')
  if (synctex === null) return null
  const pdf = safeJoin(input.workspace, input.pdfPath)
  const source = safeJoin(input.workspace, input.file)
  const result = await runProcess(
    synctex,
    ['view', '-i', `${input.line}:${input.column ?? 1}:${source}`, '-o', pdf],
    { cwd: input.buildCwd, timeoutMs: 15_000 },
  )
  const page = /Page:(\d+)/.exec(result.stdout)
  const x = /x:([\d.]+)/.exec(result.stdout)
  const y = /y:([\d.]+)/.exec(result.stdout)
  if (page === null) return null
  return { page: Number(page[1]), x: Number(x?.[1] ?? 0), y: Number(y?.[1] ?? 0) }
}

/**
 * Run a SyncTeX inverse search from a PDF position to a source location.
 * @param {{workspace: string, buildCwd: string, pdfPath: string, page: number, x: number, y: number}} input - query.
 * @returns {Promise<{file: string, line: number} | null>} source location.
 */
export async function synctexInverse(input) {
  const synctex = await findExecutable('synctex')
  if (synctex === null) return null
  const pdf = safeJoin(input.workspace, input.pdfPath)
  const result = await runProcess(
    synctex,
    ['edit', '-o', `${input.page}:${Math.round(input.x)}:${Math.round(input.y)}:${pdf}`],
    { cwd: input.buildCwd, timeoutMs: 15_000 },
  )
  const line = /Line:(\d+)/.exec(result.stdout)
  const file = /Input:(.+)/.exec(result.stdout)
  if (line === null || file === null) return null
  return { file: relativeTo(input.workspace, path.resolve(input.buildCwd, file[1].trim())), line: Number(line[1]) }
}
