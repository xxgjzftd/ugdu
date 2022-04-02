import { join } from 'path'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { cached } from '../shared/utils'
import { setContext } from './context'
import { local } from '../plugins/local'
import { meta } from '../plugins/meta'

import type { InlineConfig } from 'vite'
import type { Promisable } from 'type-fest'
import type { Context } from '@ugdu/processor'

declare module './project' {
  interface Project {
    mn2bm: ModuleNameToBindingsMap
  }
}

type ModuleNameToBindingsMap = { pre: Record<string, string[]>; cur: Record<string, string[]> }

const getModuleNameToBindingsMap = (context: Context) => {
  const {
    project: { meta }
  } = context
  const mn2bm: ModuleNameToBindingsMap = { pre: {}, cur: {} }
  const types = ['pre', 'cur'] as const
  types.forEach(
    (type) => {
      const map = mn2bm[type]
      meta[type].modules.forEach(
        (m) => {
          m.imports.forEach(
            (i) => {
              const mn = i.id
              const bindings = map[mn] || (map[mn] = [])
              i.bindings.forEach((binding) => bindings.push(binding))
            }
          )
        }
      )
      Object.keys(map).forEach((mn) => (map[mn] = [...new Set(map[mn])].sort()))
    }
  )

  return mn2bm
}

/**
 * @public
 */
export interface BuildLocalModulesHooks {
  /**
   * A `parallel` type hook. It will be invoked once a `local module` need be built.
   *
   * @remarks
   * Note: This hook will be triggered by the change of each `module`'s own file and its `source` file.
   * So this hook may be invoked multiple times with the same `lmn`.
   * However, because we have a caching mechanism, this `module` will only be built once.
   *
   * @param lmn - `local module` name
   * @param context - {@link @ugdu/processor#Context}
   */
  'build-local-module'(lmn: string, context: Context): Promisable<void>
}

/**
 * @internal
 */
export const buildLocalModule = cached(
  async function (lmn, context: Context) {
    const {
      config,
      config: { apps, assets },
      project: { alias },
      utils: { resolve, getLocalModulePath, getLocalModuleExternal, getPkgName }
    } = context
    const pn = getPkgName(lmn)
    const app = apps.find((app) => (app.packages as string[]).includes(pn))
    if (!app) {
      throw new Error(`'${pn}' doesn't have corresponding app.`)
    }
    const dc: InlineConfig = {
      publicDir: false,
      resolve: {
        alias
      },
      build: {
        rollupOptions: {
          input: resolve(getLocalModulePath(lmn)),
          output: {
            entryFileNames: join(assets, pn, '[name].[hash].js'),
            chunkFileNames: join(assets, pn, '[name].[hash].js'),
            assetFileNames: join(assets, pn, '[name].[hash][extname]'),
            format: 'es'
          },
          preserveEntrySignatures: 'allow-extension',
          external: getLocalModuleExternal(lmn)
        }
      },
      plugins: [local(lmn, context), meta(lmn, context)]
    }

    await build(mergeConfig(dc, mergeConfig(config.vite, app.vite)))
  }
)

/**
 * Builds `local module`s.
 *
 * @remarks
 * `local module` is the `module` of `local package`s.
 * Check {@link MetaModule} for more information about `module`.
 *
 * @public
 */
export const buildLocalModules = series(
  setContext,
  new TaskOptions<BuildLocalModulesHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            config: { apps },
            utils: { remove, getLocalPkgs, getLocalModuleName },
            project: {
              sources: { changed },
              meta: { cur }
            }
          }
        }
      } = this

      apps.forEach(
        (app) => {
          if (typeof app.packages === 'function') {
            app.packages = app.packages(getLocalPkgs())
          }
        }
      )

      await Promise.all(
        changed.map(
          async ({ path, status }) => {
            const lmn = getLocalModuleName(path)
            if (status === 'D') {
              return lmn && remove(lmn)
            }
            if (lmn) {
              return this.call('build-local-module', 'parallel', lmn, context)
            } else {
              return Promise.all(
                cur.modules
                  .filter((m) => m.exports && m.sources?.includes(path))
                  .map((m) => this.call('build-local-module', 'parallel', m.id, context))
              )
            }
          }
        )
      )
    },
    ['build-local-module'],
    {
      'build-local-module': buildLocalModule
    }
  ),
  new TaskOptions(
    async function setModuleNameToBindingsMap () {
      const {
        manager: {
          context,
          context: { project }
        }
      } = this
      project.mn2bm = getModuleNameToBindingsMap(context)
    }
  ),
  new TaskOptions(
    async function qa () {
      const {
        manager: {
          context: {
            project: { mn2bm, meta }
          }
        }
      } = this
      meta.cur.modules.forEach(
        (m) => {
          if (m.exports) {
            const mn = m.id
            const missing = mn2bm.cur[mn]?.find((b, index) => !m.exports!.includes(b, index))
            if (missing) {
              const dependents = meta.cur.modules
                .filter((m) => m.imports.find((i) => i.id === mn && i.bindings.includes(missing)))
                .map((m) => m.id)
              throw new Error(
                `Module '${mn}' no longer exports '${missing}' in this build.` +
                  `But ${dependents.join(',')} still import it.`
              )
            }
          }
        }
      )
    }
  )
)
