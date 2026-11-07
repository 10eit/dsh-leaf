/**
 * The persistent "DSH-leaf workbench" session.
 *
 * The host sidebar only renders Session rows; a workspace property cannot add
 * an arbitrary row. This module therefore creates one ordinary Session, gives
 * it a user title, starts and cancels a minimal turn so the row is no longer a
 * blank placeholder, pins it, and records its id. The client watches for that
 * session becoming active and opens the writing panel.
 */
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { writeState } from './project.js'

/** Synthetic session title shown in the workspace list. */
export const WORKBENCH_TITLE = '✏️DSH-leaf工作台'

/**
 * Find the registry entity whose physical path is this workspace.
 * @param {object} ctx - host context.
 * @param {string} workspace - physical workspace root.
 * @returns {Promise<object | null>} workspace entity.
 */
export async function findWorkspaceEntity(ctx, workspace) {
  for (const entity of ctx.workspaceRegistry.list()) {
    try {
      if ((await realpath(entity.path)) === workspace) return entity
    } catch {
      // skip unreadable registrations
    }
  }
  return null
}

/**
 * Wait briefly for an asynchronous step that has no public completion hook.
 * @param {number} ms - delay.
 * @returns {Promise<void>} delay promise.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Attach and pin a workbench session; tolerate an already-attached session.
 * @param {object} ctx - host context.
 * @param {object} entity - workspace entity.
 * @param {string} sessionId - session identity.
 */
async function attachAndPin(ctx, entity, sessionId) {
  try {
    await entity.attachSession(sessionId)
  } catch {
    // already attached, or attach validation refused a stale id
  }
  await ctx.workspaceRegistry.pinSession(sessionId)
}

/**
 * Ensure this workspace owns one pinned workbench session.
 * @param {object} ctx - host context.
 * @param {string} workspace - physical workspace root.
 * @param {object} entity - workspace entity.
 * @param {object} state - project record (mutated and persisted).
 * @returns {Promise<{sessionId: string, created: boolean}>} session identity.
 */
export async function ensureWorkbenchSession(ctx, workspace, state) {
  const entity = await findWorkspaceEntity(ctx, workspace)
  if (entity === null) throw new Error('This directory is not a registered workspace.')
  if (typeof state.workbenchSessionId === 'string' && state.workbenchSessionId !== '') {
    try {
      await attachAndPin(ctx, entity, state.workbenchSessionId)
      await pinWorkspace(ctx, entity, workspace, state)
      await writeState(workspace, state)
      return { sessionId: state.workbenchSessionId, created: false }
    } catch {
      // fall through to a fresh session
    }
  }
  const selection = ctx.agentDefaultModel.currentSelection()
  if (selection === undefined || selection === null) {
    throw new Error('No native default model is configured.')
  }
  const sessionId = `session-${randomUUID()}`
  const created = await ctx.agents.create({
    sessionId,
    meta: { cwd: workspace },
    agentOptions: {
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
    },
  })
  const agent = created.agent
  await agent.whenIdle()
  // Title before the first turn so the automatic title generator leaves it alone.
  try {
    await ctx.sessionTitle.rename(agent.session, WORKBENCH_TITLE)
  } catch {
    // a deployment without the title service keeps the generated title
  }
  agent.followup({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: WORKBENCH_TITLE }],
    source: { kind: 'user' },
  })
  // The row stops being a blank placeholder at turn start; cancel the model work.
  await delay(700)
  agent.cancel({ kind: 'user' })
  await agent.whenIdle()
  await ctx.sessions.flush(agent.session).catch(() => {})
  await attachAndPin(ctx, entity, sessionId)
  state.workbenchSessionId = sessionId
  await pinWorkspace(ctx, entity, workspace, state)
  await writeState(workspace, state)
  return { sessionId, created: true }
}

/**
 * Rename a persisted workbench session to the current title.
 * @param {object} ctx - host context.
 * @param {object} state - project record.
 * @returns {Promise<{sessionId: string, title: string}>} rename result.
 */
export async function renameWorkbenchSession(ctx, state) {
  const sessionId = state.workbenchSessionId
  if (typeof sessionId !== 'string' || sessionId === '') throw new Error('This workspace has no workbench session.')
  const session = typeof ctx.sessions.get === 'function' ? ctx.sessions.get(sessionId) : null
  if (session === null || session === undefined) throw new Error('The workbench session is not loaded.')
  await ctx.sessionTitle.rename(session, WORKBENCH_TITLE)
  return { sessionId, title: WORKBENCH_TITLE }
}

/**
 * Remove the workbench row from the workspace list without deleting its log.
 * @param {object} ctx - host context.
 * @param {string} workspace - physical workspace root.
 * @param {object} state - project record.
 * @returns {Promise<{closed: boolean}>} outcome.
 */
export async function closeWorkbenchSession(ctx, workspace, state) {
  const entity = await findWorkspaceEntity(ctx, workspace)
  if (entity !== null) await restoreWorkspaceTitle(entity, state)
  const sessionId = state.workbenchSessionId
  if (typeof sessionId !== 'string' || sessionId === '') return { closed: false }
  try {
    await ctx.workspaceRegistry.unpinSession(sessionId)
  } catch {
    // already unpinned
  }
  try {
    await ctx.workspaceRegistry.archiveSession(sessionId)
  } catch {
    // archiving may be refused while the session is active; leave it unpinned
  }
  state.workbenchSessionId = null
  state.pinned = false
  await writeState(workspace, state)
  return { closed: true }
}

/**
 * Rename the workspace to dsh-leaf and move it to the top of the registry.
 * @param {object} ctx - host context.
 * @param {object} entity - workspace entity.
 * @param {string} workspace - physical root.
 * @param {object} state - project record.
 */
async function pinWorkspace(ctx, entity, workspace, state) {
  if (state.workspaceTitle === null || state.workspaceTitle === undefined) {
    state.workspaceTitle = entity.title ?? path.basename(entity.path)
  }
  await entity.setTitle('dsh-leaf')
  const first = ctx.workspaceRegistry.list().find((candidate) => candidate.id !== entity.id)
  if (first !== undefined) await ctx.workspaceRegistry.insertBefore(entity.id, first.id)
  state.pinned = true
}

/**
 * Restore the title saved before dsh-leaf pinned the workspace.
 * @param {object} entity - workspace entity.
 * @param {object} state - project record.
 */
async function restoreWorkspaceTitle(entity, state) {
  if (state.workspaceTitle !== null && state.workspaceTitle !== undefined) {
    await entity.setTitle(state.workspaceTitle)
  }
  state.workspaceTitle = null
}
