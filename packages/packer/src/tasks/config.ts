import { cwd } from 'process'

import { TaskOptions } from '@ugdu/processor'
import { mergeConfig, normalizePath } from 'vite'

import type { InlineConfig } from 'vite'
import type { Merge } from 'type-fest'

import type { PkgNode } from './project'

/**
 * @public
 */
export interface UserConfig {
  /**
   * In package which doesn't have `main` field, all files with extension in this config is considered to be a `module`.
   *
   * @remarks
   * There are two types in our source files.
   * One is `module`, the other is `source`.
   * `source` is bundled into `module` in building.
   * `module`s import each other in runtime.
   * In package which have `main` field, the corresponding file of `main` is considered to be a `module`,
   * and the other files are considered as `source`.
   * In package which doesn't have `main` field, all files with extension in this config is considered to be a `module`.
   * Usually, this config will be `['js', 'ts', 'jsx', 'tsx']`.
   * According to the framework you use, you should specify the corresponding value.
   * Such as, for `vue`, you should add `vue` to this config.
   */
  extensions: string[]
  /**
   * The current working directory.
   *
   * @remarks
   * This field affects following process
   * - Where to find `local package` and `vendor package`
   * - Where to write `dist` file
   * - Where to find `all sources` and `changed sources`
   * - In build process, the relative path to this field of a file is used to represent the path of that file
   *
   * @default `process.cwd()`
   */
  cwd?: string
  /**
   * The output directory.
   *
   * @default 'dist'
   */
  dist?: string
  /**
   * The directory to nest generated assets.
   *
   * @default 'assets'
   */
  assets?: string
  /**
   * Base public path when served in development or production.
   *
   * @default '/'
   */
  base?: string
  /**
   *
   * @remarks
   * A project can contains multiple apps.
   * Different apps can be based on different fe frameworks.
   */
  apps: UserAppConfig[]
  /**
   * The `routes id` to {@link RoutesOption} map.
   *
   * @remarks
   * The `routes id` is used to generate `routes module` name.
   * The `routes module` is a fs based routes.
   *
   * @example
   * If we have such config
   * ```
   * { foo: {...}, bar: {...} }
   * ```
   * Then we could code in our source code as
   * ```
   * import routes from 'routes/foo'
   * import routes from 'routes/bar'
   * ```
   *
   * @default {}
   */
  routes?: Record<string, RoutesOption>
  /**
   * The vite config all apps should apply.
   *
   * @default {}
   */
  vite?: InlineConfig
  /**
   * Decide where to find previous build info.
   */
  meta: 'local' | `http${'s' | ''}://${string}/`
}

/**
 * @public
 */
export interface UserAppConfig {
  /**
   * The name of `local package` which is the entry package of this app.
   */
  name: string
  /**
   * Whether to load this app.
   */
  predicate?: (pathname: string) => boolean
  /**
   * The vite config of this app.
   */
  vite?: InlineConfig
  /**
   * The packages belonging to this app.
   */
  packages: ((packages: PkgNode[]) => string[]) | string[]
}

/**
 * @public
 */
export interface RoutesOption {
  /**
   * The patterns used by `fast-glob` to decide which file belonging to this routes.
   */
  patterns: string | string[]
  /**
   * The generated path will prepend this config.
   */
  base: `/${string}/` | '/'
  /**
   * The default depth of the generated route.
   */
  depth: number
  /**
   * Extended the generated route.
   *
   * @example
   * If we have such files
   * ```
   * packages/foo/src/pages/xx/layout.tsx
   * packages/foo/src/pages/yy/list.tsx
   * packages/foo/src/pages/zz/list.tsx
   * ```
   * The package name is `foo`.
   * And the corresponding config is
   * ```
   * {
   *   //...
   *   base: '/example/',
   *   depth: 1,
   *   extends: [
   *     {
   *       id: 'packages/foo/src/pages/xx/layout.tsx',
   *       path: '/example',
   *       depth: 0
   *     }
   *   ]
   * }
   * ```
   * Then the generated routes will be
   * ```
   * [
   *   {
   *     //...
   *     id: 'packages/foo/src/pages/xx/layout.tsx',
   *     path: '/example',
   *     depth: 0,
   *     children: [
   *       {
   *         id: 'packages/foo/src/pages/yy/list.tsx',
   *         path: '/example/foo/yy/list',
   *         depth: 1
   *       },
   *       {
   *         id: 'packages/foo/src/pages/zz/list.tsx',
   *         path: '/example/foo/zz/list',
   *         depth: 1
   *       }
   *     ]
   *   }
   * ]
   * ```
   * In this example, for path '/example/foo/yy/list'.
   * The reason why 'example' appears is the config `base` is `/example/`.
   * The 'foo' is the package name is 'foo'.
   * The 'yy/list' is the id replaced with extension and `lca` of all ids.
   * cf. https://en.wikipedia.org/wiki/Lowest_common_ancestor for `lca`.
   */
  extends: RouteExtend[]
}

type RouteExtend = Partial<Pick<BaseRoute, 'path' | 'name' | 'depth'>> & Pick<BaseRoute, 'id'>

/**
 * The generated routes object.
 *
 * @public
 */
export interface BaseRoute {
  /**
   * The file path relative to {@link UserConfig.cwd}
   */
  id: string
  path: string
  name: string
  depth: number
  component: string
  children?: BaseRoute[]
}

/**
 * The normalized config.
 *
 * @internal
 */
export type Config = Merge<Required<UserConfig>, { apps: Required<UserAppConfig>[] }>

/**
 * @public
 */
export interface SetConfigHooks {
  'get-config'(): UserConfig | void
}

/**
 * The set config task options.
 *
 * @remarks
 * This task get user's config from `get-config` hook and normalize it.
 * Then set it to {@link Context.config}.
 *
 * @public
 */
export const setConfig = new TaskOptions<SetConfigHooks>(
  async function () {
    const config = await this.call('get-config', 'first')
    if (!config) {
      throw new Error(`The 'get-config' hook should have at least one hook function which returns a config.`)
    }
    config.cwd = normalizePath(config.cwd ?? cwd())
    config.dist = config.dist ?? 'dist'
    config.assets = config.assets ?? 'assets'
    config.base = config.base ?? '/'
    config.vite = mergeConfig(
      {
        base: config.base,
        build: {
          outDir: config.dist,
          assetsDir: config.assets,
          emptyOutDir: false
        }
      },
      config.vite ?? {}
    )
    config.routes = config.routes ?? {}
    config.apps.forEach(
      (app) => {
        app.predicate = app.predicate ?? (() => true)
        app.vite = app.vite ?? {}
      }
    )
    this.manager.context.config = config as Config
  },
  ['get-config']
)
