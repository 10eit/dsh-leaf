/**
 * dsh-leaf — a LaTeX submission workspace for DeepSeek Harness.
 *
 * Host half: project records, lazy file tree, editor persistence, local TeX
 * environment detection/probing, the single-build-per-project compile
 * pipeline, PDF/asset byte routes, SyncTeX bridges, and two agent tools.
 * The browser half lives in ./client.js and talks to this half only through
 * the authenticated `/dsh-leaf/*` HTTP routes.
 */
import { createAssist } from './lib/assist.js'
import { registerLeafRoutes } from './lib/routes.js'
import { registerLeafTools } from './lib/tool.js'
import { BuildManager } from './lib/tex.js'

/** Cordis plugin name. */
export const name = 'dsh-leaf'

/** Host services this plugin cannot work without. */
export const inject = ['webServer', 'connection', 'workspaceRegistry']

/** Defaults mirrored by cordis.patch.yml. */
export const DEFAULTS = {
  enabledByDefault: true,
  engine: 'xelatex',
  autoCompile: true,
}

/**
 * Compose the host services and register routes, tools, and prompt guidance.
 * @param {object} ctx - host context.
 * @param {{enabledByDefault?: boolean, engine?: string, autoCompile?: boolean}} config - row config.
 */
export function apply(ctx, config = {}) {
  const leaf = {
    config: {
      enabledByDefault: config.enabledByDefault !== false,
      engine: config.engine === 'pdflatex' ? 'pdflatex' : 'xelatex',
      autoCompile: config.autoCompile !== false,
    },
    builds: new BuildManager({ ctx }),
  }

  ctx.effect(() => registerLeafRoutes(ctx, leaf), 'dsh-leaf: HTTP routes')

  // Tools and prompt guidance are optional capabilities: bind them through
  // ctx.inject so a profile without those services keeps the workspace usable.
  ctx.inject(['tools', 'workingDirectory'], (scoped) => {
    scoped.effect(() => registerLeafTools(scoped, leaf), 'dsh-leaf: agent tools')
  })

  ctx.inject(['llm', 'agentDefaultModel'], (scoped) => {
    leaf.assist = createAssist({ llm: scoped.llm, agentDefaultModel: scoped.agentDefaultModel })
  })

  ctx.inject(['clientModules'], (scoped) => {
    leaf.clientGraph = () => scoped.clientModules.graph()
  })

  ctx.inject(['systemPrompt'], (scoped) => {
    scoped.effect(() => scoped.systemPrompt.section({
      name: 'dsh-leaf',
      order: 900,
      text:
        'This profile includes dsh-leaf, a LaTeX submission workspace. When the current workspace is a LaTeX project, '
        + 'inspect it with latex_project(action="status") and compile with latex_build instead of invoking pdflatex directly; '
        + 'latex_build returns structured file/line errors, warnings, missing packages, and a log tail. '
        + 'Never claim a build succeeded without reading the tool result.',
    }), 'dsh-leaf: prompt guidance')
  })
}
