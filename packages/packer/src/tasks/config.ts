import { cwd } from 'process'

import { TaskOptions } from '@ugdu/processor'
import { mergeConfig, normalizePath } from 'vite'

import type { InlineConfig } from 'vite'
import type { Merge } from 'type-fest'

import type { PkgNode, BaseRoute } from './project'

/**
 * @public
 */
export interface UserConfig {
  /**
   * In `local package`s which don't have `main` field, all files with extension in this config are considered to be a `module`.
   *
   * @remarks
   * There are two types in our source files.
   * One is `module`, the other is `source`.
   * `source`s are bundled into `module` when building.
   * `module`s import each other at runtime.
   * In packages which have `main` field, the corresponding file of `main` is considered to be a `module`,
   * and the other files are considered as `source`.
   * In packages which don't have `main` field, all files with extension in this config are considered to be a `module`.
   * Usually, this config will be `['js', 'ts', 'jsx', 'tsx']`.
   * According to the framework you use, you should specify the corresponding value.
   * Such as, for `vue`, you should add `vue` to this config.
   * Check {@link MetaModule} for more information about `module`.
   *
   */
  extensions: string[]
  /**
   * The current working directory.
   *
   * @remarks
   * This field affects following process
   *
   * - Where to find `local package` and `vendor package`
   *
   * - Where to write `dist` file
   *
   * - Where to find `all sources` and `changed sources`
   *
   * - In build process, the relative path to this field of a file is used to represent the `path` of that file
   *
   * @defaultValue `process.cwd()`
   */
  cwd?: string
  /**
   * The output directory.
   *
   * @defaultValue 'dist'
   */
  dist?: string
  /**
   * The directory to nest generated assets.
   *
   * @defaultValue 'assets'
   */
  assets?: string
  /**
   * Base public path when served in development or production.
   *
   * @defaultValue '/'
   */
  base?: string
  /**
   * The `app`s's configurations.
   *
   * @remarks
   * A project can contains multiple `app`s.
   * Different `app`s can be based on different fe frameworks.
   */
  apps: UserAppConfig[]
  /**
   * The `routes id` to {@link RoutesConfigProperties} array map.
   *
   * @remarks
   * The `routes id` is used as the generated `routes module`'s name.
   * The `routes module` is a `module` which export a {@link BaseRoute} array.
   * The array is generated based on the project structure.
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
   * @defaultValue \{\}
   */
  routes?: Record<string, RoutesConfigProperties>
  /**
   * The vite config all `app`s should apply.
   *
   * @defaultValue \{\}
   */
  vite?: InlineConfig
  /**
   * Decide where to find previous build information.
   *
   * @remarks
   * `local` means that we should read the build information from where we should write this time.
   */
  meta: 'local' | `http${'s' | ''}://${string}/`
}

/**
 *
 * @remarks
 * The `app` can actually be thought of as the entry `package`.
 *
 * @public
 */
export interface UserAppConfig {
  /**
   * The name of `local package` which is the entry package of this app.
   */
  name: string
  /**
   * Whether to load and mount this `app`.
   */
  predicate?: (pathname: string) => boolean
  /**
   * The vite config which will be applied when building this `app`.
   */
  vite?: InlineConfig
  /**
   * The packages belonging to this `app`.
   */
  packages: ((packages: PkgNode[]) => string[]) | string[]
}

/**
 * Used to generate `routes module` which export a {@link BaseRoute} array.
 * Check {@link MetaModule} for more information about `module`.
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
 * ```ts
 * {
 *   groups: [
 *      {
 *        //...
 *        base: '/example/',
 *        parent: 'packages/foo/src/pages/xx/layout.tsx'
 *      }
 *   ],
 *   extends: [
 *     {
 *       id: 'packages/foo/src/pages/xx/layout.tsx',
 *       path: '/example'
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
 *     children: [
 *       {
 *         id: 'packages/foo/src/pages/yy/list.tsx',
 *         path: '/example/foo/yy/list'
 *       },
 *       {
 *         id: 'packages/foo/src/pages/zz/list.tsx',
 *         path: '/example/foo/zz/list'
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
 *
 * @public
 */
export interface RoutesConfigProperties {
  /**
   * Used to generate {@link BaseRoute} array.
   */
  groups: RoutesConfigGroup[]
  /**
   * Used to extend the generated {@link BaseRoute} array.
   */
  extends: RoutesExtend[]
}

/**
 * Used to generate {@link BaseRoute} array.
 *
 * @public
 */
export interface RoutesConfigGroup {
  /**
   * The patterns used by `fast-glob` to decide which file belonging to this routes.
   */
  patterns: string | string[]
  /**
   * The generated path will prepend this field.
   */
  base: `/${string}/` | '/'
  /**
   * The generated routes will be the children of the route whose {@link BaseRoute.id | id} is equal to this field.
   */
  parent?: string
}

/**
 * Used to extend the generated {@link BaseRoute} array.
 *
 */
type RoutesExtend = Partial<Pick<BaseRoute, 'path' | 'name'>> & Pick<BaseRoute, 'id'>

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
  /**
   * A `first` type hook. Its non null return value will be used as config after normalized.
   */
  'get-config'(): UserConfig | void
}

/**
 * Gets user's config from `get-config` hook and normalize it.
 * Then set it to `context.config`.
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
