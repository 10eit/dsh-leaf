/**
 * Agent tools for dsh-leaf.
 *
 * The Host plugin registers raw JSON-Schema tool definitions (the same shape
 * MCP-sourced tools use) instead of importing the internal defineTool helper,
 * so the bundle resolves without depending on a second package's runtime
 * exports. Both tools call the same project and build services the UI uses.
 */
import { LeafError, realDirectory } from './paths.js'
import {
  chooseMain,
  createTemplate,
  createTexFile,
  detectFiguresDir,
  findMainCandidates,
  projectView,
  readState,
  writeState,
} from './project.js'
import { cleanBuild, detectEnvironment } from './tex.js'

/**
 * Resolve the workspace a tool call applies to: the explicit argument first,
 * then the calling agent's working directory.
 * @param {{workspace?: string}} args - tool arguments.
 * @param {object} exec - tool execution context.
 * @param {object} ctx - host context.
 * @returns {Promise<string>} physical workspace root.
 */
async function resolveWorkspace(args, exec, ctx) {
  if (typeof args.workspace === 'string' && args.workspace.trim() !== '') {
    return realDirectory(args.workspace.trim())
  }
  if (ctx.workingDirectory !== undefined && exec.agent !== undefined) {
    const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
    if (typeof cwd === 'string' && cwd !== '') return realDirectory(cwd)
  }
  throw new LeafError(400, 'workspace-missing', 'No workspace was given and the session has no working directory.')
}

/**
 * Validate an optional string argument.
 * @param {unknown} value - candidate.
 * @param {string} name - field name.
 * @returns {string | undefined} normalized value.
 */
function optionalString(value, name) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new LeafError(400, 'bad-argument', `${name} must be a string.`)
  return value
}

/**
 * Compact environment summary used by tool output.
 * @param {object} environment - detection report.
 * @returns {object} summary.
 */
function environmentSummary(environment) {
  return {
    status: environment.status,
    available: environment.available,
    engines: Object.fromEntries(
      Object.entries(environment.engines ?? {}).map(([name, value]) => [name, value === null ? null : value.version]),
    ),
    distribution: environment.distribution,
    probe: environment.probe,
  }
}

/**
 * Register `latex_build` and `latex_project` on the host tool registry.
 * @param {object} ctx - host context.
 * @param {{config: object, builds: object}} leaf - plugin services.
 * @returns {() => void} disposer that unregisters both tools.
 */
export function registerLeafTools(ctx, leaf) {
  const disposers = []
  disposers.push(ctx.tools.register({
    name: 'latex_build',
    description:
      'Compile the current LaTeX project. Uses the project main document and engine recorded by dsh-leaf, '
      + 'returns structured errors (file/line/message), warnings, missing packages, and a log tail. '
      + 'Use this instead of calling pdflatex directly so the preview PDF and build state stay consistent.',
    parameters: {
      type: 'object',
      properties: {
        workspace: {
          type: 'string',
          description: 'Absolute workspace path. Defaults to the session working directory.',
        },
        mode: {
          type: 'string',
          enum: ['full', 'fast'],
          description: 'full renders everything; fast uses draft image placeholders for quick layout checks.',
        },
        engine: {
          type: 'string',
          enum: ['xelatex', 'pdflatex'],
          description: 'Compile engine. Defaults to the project setting.',
        },
        clean: {
          type: 'boolean',
          description: 'Remove the dsh-leaf build cache before compiling. Never touches sources or figures.',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render(args, value) {
        const lines = [
          value.ok ? `Build ${value.status} in ${Math.round(value.durationMs / 100) / 10}s (${value.engine}, ${value.mode}).` : `Build ${value.status}.`,
        ]
        if (value.mainDocument !== null && value.mainDocument !== undefined) lines.push(`Main document: ${value.mainDocument}`)
        if (value.errors?.length > 0) {
          lines.push('', `Errors (${value.errors.length}):`)
          for (const error of value.errors.slice(0, 12)) {
            lines.push(`- ${error.file ?? 'document'}${error.line === null || error.line === undefined ? '' : `:${error.line}`}: ${error.message}`)
          }
        }
        if (value.missing?.length > 0) {
          lines.push('', 'Missing files/packages:')
          for (const item of value.missing.slice(0, 8)) lines.push(`- ${item.name}: ${item.hint}`)
        }
        if (value.warnings?.length > 0) {
          lines.push('', `Warnings (${value.warnings.length}):`)
          for (const warning of value.warnings.slice(0, 6)) lines.push(`- ${warning}`)
        }
        if (value.logTail) lines.push('', 'Log tail:', '```', value.logTail.slice(-4000), '```')
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args, exec) {
      const workspace = await resolveWorkspace(args, exec, ctx)
      const state = await readState(workspace, leaf.config)
      const mode = args.mode === 'fast' ? 'fast' : args.mode === 'full' ? 'full' : undefined
      const engine = args.engine === 'pdflatex' ? 'pdflatex' : args.engine === 'xelatex' ? 'xelatex' : undefined
      if (args.clean === true) await cleanBuild(workspace)
      const receipt = await leaf.builds.compile(workspace, state, {
        mode: mode ?? state.mode,
        engine: engine ?? state.engine,
        mainDocument: state.mainDocument,
      })
      return {
        ok: receipt.ok,
        status: receipt.status,
        engine: receipt.engine,
        mode: receipt.mode,
        mainDocument: receipt.mainDocument,
        durationMs: receipt.durationMs,
        errors: receipt.errors,
        warnings: receipt.warnings,
        missing: receipt.missing,
        pdf: receipt.pdf,
        logTail: receipt.logTail,
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'latex_project',
    description:
      'Inspect or initialize the dsh-leaf LaTeX project in the current workspace. '
      + 'Actions: status (main document, engine, candidates, environment), init (minimal bilingual template), '
      + 'create_file (new .tex), clean (remove build cache only).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'init', 'create_file', 'clean', 'set_main', 'diagnostics', 'assist_probe', 'workbench_probe'],
          description: 'Operation to perform.',
        },
        workspace: {
          type: 'string',
          description: 'Absolute workspace path. Defaults to the session working directory.',
        },
        path: {
          type: 'string',
          description: 'Workspace-relative file path for create_file, or the main document for set_main.',
        },
        kind: {
          type: 'string',
          enum: ['main', 'section'],
          description: 'create_file kind; main gets a compilable preamble, section gets a \\section skeleton.',
        },
        title: {
          type: 'string',
          description: 'Optional document or section title.',
        },
        instruction: {
          type: 'string',
          description: 'assist_probe only: the background writing instruction to send to the native default model.',
        },
        template: {
          type: 'string',
          enum: ['zh', 'en'],
          description: 'init template language.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render(args, value) {
        if (value.action === 'status') {
          const lines = [
            `Workspace: ${value.workspace}`,
            `Main document: ${value.project.mainDocument ?? '(not chosen)'}`,
            `Engine: ${value.project.engine} | mode: ${value.project.mode} | auto compile: ${value.project.autoCompile}`,
            `Environment: ${value.environment.status} (${value.environment.available ? 'available' : 'not available'})`,
          ]
          if (value.candidates.length > 0) lines.push(`Main candidates: ${value.candidates.map((item) => item.path).join(', ')}`)
          if (value.figuresDir !== null) lines.push(`Figures directory: ${value.figuresDir}`)
          return [{ type: 'text', text: lines.join('\n') }]
        }
        if (value.action === 'create_file') return [{ type: 'text', text: `Created ${value.result.path} (${value.result.kind}).` }]
        if (value.action === 'init') {
          return [{
            type: 'text',
            text: `Template created: ${value.result.created.join(', ') || '(nothing)'}${value.result.skipped.length > 0 ? `; skipped existing: ${value.result.skipped.join(', ')}` : ''}`,
          }]
        }
        if (value.action === 'clean') return [{ type: 'text', text: value.result.removed ? 'Build cache removed.' : 'No build cache to remove.' }]
        if (value.action === 'diagnostics') return [{ type: 'text', text: JSON.stringify(value.diagnostics, null, 2) }]
        if (value.action === 'assist_probe') return [{ type: 'text', text: `${value.result.model}: ${value.result.text}` }]
        if (value.action === 'workbench_probe') return [{ type: 'text', text: `workbench session ${value.result.sessionId} (${value.result.created ? 'created' : 'reused'})` }]
        return [{ type: 'text', text: value.message ?? 'Done.' }]
      },
    },
    async execute(args, exec) {
      const workspace = await resolveWorkspace(args, exec, ctx)
      const action = String(args.action ?? '')
      if (action === 'status') {
        const state = await readState(workspace, leaf.config)
        const candidates = await findMainCandidates(workspace)
        if (state.mainDocument === null) {
          const choice = chooseMain(candidates)
          if (choice.main !== null) {
            state.mainDocument = choice.main
            await writeState(workspace, state)
          }
        }
        return {
          action,
          workspace,
          project: projectView(state),
          candidates,
          figuresDir: state.figuresDir ?? (await detectFiguresDir(workspace)),
          environment: environmentSummary(await detectEnvironment()),
        }
      }
      if (action === 'init') {
        const template = args.template === 'en' ? 'en' : 'zh'
        const result = await createTemplate(workspace, template, optionalString(args.title, 'title') ?? '')
        const state = await readState(workspace, leaf.config)
        if (result.created.includes('main.tex')) state.mainDocument = 'main.tex'
        state.figuresDir = (await detectFiguresDir(workspace)) ?? 'figures'
        if (template === 'zh') state.engine = 'xelatex'
        await writeState(workspace, state)
        return { action, result }
      }
      if (action === 'create_file') {
        const rel = optionalString(args.path, 'path')
        if (rel === undefined) throw new LeafError(400, 'bad-argument', 'path is required for create_file.')
        const result = await createTexFile(workspace, {
          path: rel,
          kind: args.kind === 'main' ? 'main' : 'section',
          title: optionalString(args.title, 'title'),
        })
        const state = await readState(workspace, leaf.config)
        if (state.mainDocument === null && result.kind === 'main') {
          state.mainDocument = result.path
          await writeState(workspace, state)
        }
        return { action, result }
      }
      if (action === 'set_main') {
        const rel = optionalString(args.path, 'path')
        if (rel === undefined) throw new LeafError(400, 'bad-argument', 'path is required for set_main.')
        const state = await readState(workspace, leaf.config)
        state.mainDocument = rel.replaceAll('\\', '/')
        await writeState(workspace, state)
        return { action, message: `Main document set to ${state.mainDocument}.`, project: projectView(state) }
      }
      if (action === 'clean') {
        return { action, result: await cleanBuild(workspace) }
      }
      if (action === 'workbench_probe') {
        if (leaf.workbench === undefined) throw new LeafError(503, 'workbench-unavailable', 'The workbench session service is unavailable in this profile.')
        const state = await readState(workspace, leaf.config)
        const result = await leaf.workbench.ensure(workspace, state)
        return { action, result }
      }
      if (action === 'assist_probe') {
        if (typeof leaf.assist !== 'function') throw new LeafError(503, 'assist-unavailable', 'Background assist is unavailable in this profile.')
        const instruction = optionalString(args.instruction, 'instruction') ?? 'Reply with exactly: OK'
        const result = await leaf.assist({
          instruction,
          file: null,
          mainDocument: null,
          selection: null,
          fileText: null,
        })
        return { action, result }
      }
      if (action === 'diagnostics') {
        const graph = leaf.clientGraph?.() ?? null
        return {
          action,
          workspace,
          diagnostics: graph === null
            ? { clientModules: null }
            : {
                rev: graph.rev,
                entries: (graph.entries ?? []).map((entry) => ({ id: entry.id, url: entry.url, rev: entry.rev })),
                batches: (graph.batches ?? []).map((batch) => ({ phase: batch.phase, url: batch.url, entries: batch.entries })),
              },
        }
      }
      throw new LeafError(400, 'bad-action', `Unknown action: ${action}`)
    },
  }))

  return () => {
    for (const dispose of disposers) dispose()
  }
}
