/**
 * A runtime lib for micro frontend.
 *
 * @remarks
 * This lib serves source code over ESM.
 * For better browser compatibility, we integrated {@link https://github.com/guybedford/es-module-shims | es-module-shims} in this lib.
 *
 * @packageDocumentation
 */

import 'es-module-shims'

/**
 * The `module`'s information.
 *
 * @public
 */
export interface UgduRuntimeModule {
  id: string
  /**
   * The corresponding js url of this `module`.
   */
  js: string
  /**
   * The corresponding css url of this `module` if there is.
   */
  css?: string
  /**
   * The `id` of the `module`s that this `module` imports.
   */
  imports: string[]
}

/**
 * Used to register and start `app`, load and unload resources, etc.
 *
 * @public
 */
export interface UgduRuntime {
  /**
   * Used to prepend to {@link UgduRuntimeModule.js} and {@link UgduRuntimeModule.css}.
   */
  base: string
  /**
   * All `module`s which would be used.
   */
  modules: UgduRuntimeModule[]
  /**
   * Loads the `module` corresponding to `mn`.
   *
   * @remarks
   * Here the `mn` means `module name`. The `module name` actually is {@link UgduRuntimeModule.id}.
   * When loading this `module`, for performance, the `module`s this `module` imports will be {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload | preload}.
   * To avoid {@link https://en.wikipedia.org/wiki/Flash_of_unstyled_content | FOUC}, the `module` will only be evaluated after the {@link UgduRuntimeModule.css} is loaded.
   *
   * @param mn - The `module name`
   */
  load(mn: string): Promise<any>
  /**
   * Unloads the `module` corresponding to `mn`.
   *
   * @param mn - The `module name`
   */
  unload(mn: string): void
  /**
   * Registers an `app`.
   *
   * @remarks
   * The `app` actually is the entry `package`.
   * We can register multiple `app` in one project. And those `app` could based on different framework.
   *
   * @param name - The `app`'s name
   * @param predicate - Whether this `app` should be active
   * @param load - The load function of this `app`.
   */
  register(name: string, predicate: (pathname: string) => boolean, load: () => Promise<any>): void
  /**
   * Starts this project. All `app`s(usually only one) which should be active will be mounted to the `document`.
   */
  start(): Promise<any>
}

declare global {
  interface Window {
    ur: UgduRuntime
  }
}

const relList = document.createElement('link').relList
const scriptRel = relList && relList.supports && relList.supports('modulepreload') ? 'modulepreload' : 'preload'
const seen: Record<string, boolean> = {}

const cached = <T extends (string: string) => any>(fn: T) => {
  const cache: Record<string, ReturnType<T>> = Object.create(null)
  return ((string) => cache[string] || (cache[string] = fn(string))) as T
}

const getDeps = cached(
  (mn) => {
    let deps: string[] = []
    const m = window.ur.modules.find((m) => m.id === mn)!
    deps.push(m.js)
    m.css && deps.push(m.css)
    m.imports.forEach(
      (mn) => {
        deps = deps.concat(getDeps(mn))
      }
    )
    return deps
  }
)

const ur = (window.ur = window.ur || {})
ur.load = function (mn) {
  const deps = getDeps(mn)
  return Promise.all(
    deps.map(
      (dep) => {
        if (seen[dep]) return
        seen[dep] = true
        const href = ur.base + dep
        const isCss = dep.endsWith('.css')
        const cssSelector = isCss ? '[rel="stylesheet"]' : ''
        if (document.querySelector(`link[href="${href}"]${cssSelector}`)) {
          return
        }
        const link = document.createElement('link')
        link.rel = isCss ? 'stylesheet' : scriptRel
        if (!isCss) {
          link.as = 'script'
          link.crossOrigin = ''
        }
        link.href = href
        document.head.appendChild(link)
        if (isCss) {
          return new Promise(
            (res, rej) => {
              link.addEventListener('load', res)
              link.addEventListener('error', rej)
            }
          )
        }
      }
    )
  ).then(() => window.importShim(mn))
}

ur.unload = function (mn) {
  const deps = getDeps(mn)
  deps
    .filter((dep) => dep.endsWith('.css'))
    .forEach(
      (dep) => {
        if (seen[dep]) {
          seen[dep] = false
          const href = ur.base + dep
          const link = document.querySelector(`link[href="${href}"][rel="stylesheet"]`)
          link && link.remove()
        }
      }
    )
}

enum UgduAppStatus {
  NOT_LOADED,
  NOT_MOUNTED,
  MOUNTED
}

/**
 * The user defined app config.
 * @public
 */
export interface UgduUserApp {
  /**
   * The method how this `app` should be mounted.
   */
  mount(): Promise<any>
  /**
   * The method how this `app` should be unmounted.
   */
  unmount(): Promise<any>
}

interface UgduBaseApp {
  name: string
  predicate: (pathname: string) => boolean
  load(): Promise<{ default: UgduUserApp }>
  status: UgduAppStatus
}

type UgduApp = UgduBaseApp & Partial<UgduUserApp>

const apps: UgduApp[] = []

ur.register = function (name, predicate, load) {
  apps.push(
    {
      name,
      predicate,
      load,
      status: UgduAppStatus.NOT_LOADED
    }
  )
}

const getApps = () => {
  const toBeMounted: UgduApp[] = []
  const toBeUnmounted: UgduApp[] = []

  apps.forEach(
    (app) => {
      const shouldBeActive = app.predicate(location.pathname)
      switch (app.status) {
        case UgduAppStatus.NOT_LOADED:
        case UgduAppStatus.NOT_MOUNTED:
          shouldBeActive && toBeMounted.push(app)
          break
        case UgduAppStatus.MOUNTED:
          shouldBeActive || toBeUnmounted.push(app)
      }
    }
  )

  return { toBeMounted, toBeUnmounted }
}

const route = async function () {
  const { toBeMounted, toBeUnmounted } = getApps()
  await Promise.all(
    toBeUnmounted.map(
      async (app) => {
        await app.unmount!()
        return ur.unload(app.name)
      }
    )
  )
  await Promise.all(
    toBeMounted.map(
      async (app) => {
        if (app.status === UgduAppStatus.NOT_LOADED) {
          Object.assign(app, await app.load().then((m) => m.default))
          app.status = UgduAppStatus.NOT_MOUNTED
        }
        await app.mount!()
        app.status = UgduAppStatus.MOUNTED
      }
    )
  )
}

ur.start = route

window.addEventListener('popstate', route)
const pushState = history.pushState
history.pushState = function (...args) {
  pushState.call(history, ...args)
  route()
}
