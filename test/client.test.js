/**
 * Client-bundle smoke test: loads the hand-authored module-loader bundle under
 * a fake window/document, asserts the slot/menu/shortcut registrations, and
 * server-renders the panel for the empty and populated workspace states.
 *
 * React comes from the running profile when available (the bundle would get it
 * from the browser module table); the test skips on a machine without either.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

/**
 * Resolve React and react-dom/server from the profile or the local tree.
 * @returns {{React: object, renderToString: Function} | null} renderer or null.
 */
function loadReact() {
  const candidates = []
  if (process.env.DSH_PROFILE_DIR) {
    candidates.push(path.join(process.env.DSH_PROFILE_DIR, 'node_modules/react/index.js'))
    candidates.push(path.join(process.env.DSH_PROFILE_DIR, '..', 'node_modules/react/index.js'))
  }
  candidates.push(path.resolve('node_modules/react/index.js'))
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const requireFrom = createRequire(candidate)
      return { React: requireFrom('react'), renderToString: requireFrom('react-dom/server').renderToString }
    } catch {
      // try the next candidate
    }
  }
  return null
}

const renderer = loadReact()

test('client bundle registers the writing panel and renders', { skip: renderer === null }, async () => {
  let definition = null
  const appended = []
  globalThis.window = {
    __ModuleLoader__: { load(value) { definition = value } },
    localStorage: { getItem: () => null, setItem: () => {} },
  }
  globalThis.document = {
    baseURI: 'http://127.0.0.1:62354/',
    querySelector: () => null,
    createElement: () => ({ dataset: {}, style: {}, setAttribute() {}, remove() {} }),
    head: { appendChild: (node) => appended.push(node) },
  }
  await import(pathToFileURL(path.resolve('client.js')).href)
  assert.equal(definition.id, 'dsh-leaf')
  assert.equal(typeof definition.factory, 'function')

  const plugin = definition.factory((id) => {
    if (id === 'react') return renderer.React
    throw new Error(`Unexpected client module request: ${id}`)
  })
  assert.deepEqual(plugin.inject, ['slots', 'layout', 'locale', 'contextMenus', 'shortcuts', 'uiWorkspace'])

  const registrations = []
  const menus = []
  let Panel = null
  const ctx = {
    locale: { register: () => () => {}, bind: () => (key) => key },
    effect: (callback) => callback(),
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => {
        registrations.push(options.name)
        if (options.key === 'leaf') Panel = component
        return () => {}
      },
    },
    contextMenus: {
      register: (options) => {
        menus.push(options)
        return () => {}
      },
      notify: () => {},
    },
    shortcuts: { register: () => () => {} },
    layout: { selectPanel: () => {} },
  }
  plugin.apply(ctx)
  assert.ok(registrations.includes('main'))
  assert.ok(registrations.includes('sidebar.panellist'))
  assert.ok(registrations.includes('contextMenu.icon'))
  assert.deepEqual(menus.map((menu) => menu.id).sort(), ['dsh-leaf.close', 'dsh-leaf.open'])
  assert.equal(appended.length, 1, 'styles are installed exactly once')
  assert.equal(typeof Panel, 'function')

  const noWorkspaces = renderer.renderToString(renderer.React.createElement(Panel, {
    t: (key) => key,
    useLeaf: (selector) => selector({ path: null, at: 0 }),
    useWorkspaces: (selector) => selector({ items: [] }),
    useSessions: (selector) => selector({ byId: {} }),
  }))
  assert.match(noWorkspaces, /leaf-root/)

  const items = [{ workspaceId: 'w1', path: '/tmp/demo', title: 'demo', sessionIds: [] }]
  const panel = renderer.renderToString(renderer.React.createElement(Panel, {
    t: (key) => key,
    useLeaf: (selector) => selector({ path: null, at: 0 }),
    useWorkspaces: (selector) => selector({ items }),
    useSessions: (selector) => selector({ byId: {} }),
  }))
  assert.match(panel, /leaf-toolbar/)
  assert.match(panel, /leaf-tree/)
  assert.match(panel, /leaf-paper/)
  assert.match(panel, /leaf-log/)

  delete globalThis.window
  delete globalThis.document
})
