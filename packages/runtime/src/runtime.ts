/**
 * The `module`'s information.
 *
 * @public
 */
export interface RuntimeModule {
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
export interface Runtime {
  /**
   * Used to prepend to {@link RuntimeModule.js} and {@link RuntimeModule.css}.
   */
  base: string
  /**
   * All `module`s which would be used.
   */
  modules: RuntimeModule[]
  /**
   * Loads the `module` corresponding to `mn`.
   *
   * @remarks
   * Here the `mn` means `module name`. The `module name` actually is {@link RuntimeModule.id}.
   * When loading this `module`, for performance, the `module`s this `module` imports will be {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload | preload}.
   * To avoid {@link https://en.wikipedia.org/wiki/Flash_of_unstyled_content | FOUC}, the `module` will only be evaluated after the {@link RuntimeModule.css} is loaded.
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
   * The `app` can actually be thought of as the entry `package`.
   * We can register multiple `app` in one project. And those `app` could based on different framework.
   *
   * @param name - The `app`'s name
   * @param predicate - Whether this `app` should be active
   * @param load - The load function of this `app`.
   */
  register(name: string, predicate: (pathname: string) => boolean, load: () => Promise<any>): void
  /**
   * Starts this project.
   * All `app`s(usually only one) which should be active will be mounted to the `document`.
   *
   * @remarks
   * Technically, with `rms` and `base`, we can create `importmap` dynamicly.
   * But for performance and compatibility, we leave it to user who should provide `importmap` staticly.
   * Usually, you will use this lib with `@ugdu/packer` which will do that for you.
   *
   * @param rms - {@link Runtime.modules}
   * @param base - {@link Runtime.base}
   */
  start(rms: RuntimeModule[], base: string): Promise<any>
}

declare global {
  interface Window {
    ur: Runtime
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
        if (isCss && !TEST) {
          return new Promise(
            (res, rej) => {
              link.addEventListener('load', res)
              link.addEventListener('error', rej)
            }
          )
        }
      }
    )
  ).then(
    () => window.importShim(mn)
  )
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

enum AppStatus {
  NOT_LOADED,
  NOT_MOUNTED,
  MOUNTED
}

/**
 * The user defined app config.
 * @public
 */
export interface UserApp {
  /**
   * The method how this `app` should be mounted.
   */
  mount(): Promise<any>
  /**
   * The method how this `app` should be unmounted.
   */
  unmount(): Promise<any>
}

interface BaseApp {
  name: string
  predicate: (pathname: string) => boolean
  load(): Promise<{ default: UserApp }>
  status: AppStatus
}

type App = BaseApp & Partial<UserApp>

const apps: App[] = []

ur.register = function (name, predicate, load) {
  apps.push(
    {
      name,
      predicate,
      load,
      status: AppStatus.NOT_LOADED
    }
  )
}

const getApps = () => {
  const toBeMounted: App[] = []
  const toBeUnmounted: App[] = []

  apps.forEach(
    (app) => {
      const shouldBeActive = app.predicate(location.pathname)
      switch (app.status) {
        case AppStatus.NOT_LOADED:
        case AppStatus.NOT_MOUNTED:
          shouldBeActive && toBeMounted.push(app)
          break
        case AppStatus.MOUNTED:
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
        if (app.status === AppStatus.NOT_LOADED) {
          Object.assign(app, await app.load().then((m) => m.default))
          app.status = AppStatus.NOT_MOUNTED
        }
        await app.mount!()
        app.status = AppStatus.MOUNTED
      }
    )
  )
}

ur.start = async function (rms = [], base = '/') {
  ur.modules = rms
  ur.base = base
  await route()
}

window.addEventListener('popstate', route)
const pushState = history.pushState
history.pushState = function (...args) {
  pushState.call(history, ...args)
  route()
}
