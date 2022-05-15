import { join } from 'path'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { local } from '../plugins/local'
import { meta } from '../plugins/meta'
import { clone } from '../shared/utils'

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
   * Note: This hook will be triggered by the change of the `module`'s own file or its `source` file.
   *
   * @param lmn - `local module` name
   * @param context - {@link @ugdu/processor#Context}
   */
  'build-local-module'(lmn: string, context: Context): Promisable<void>
}

/**
 * @internal
 */
export const buildLocalModule = async function (lmn: string, context: Context) {
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
            utils: {
              getLocalPkgs,
              getLocalModuleName,
              addMetaModule,
              getPkgFromModuleName,
              getModuleNameFromPublicPkgName
            },
            project: {
              sources: { all, changed },
              meta: { pre, cur }
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

      all.forEach(
        (path) => {
          const lmn = getLocalModuleName(path)
          const pmm = pre.modules.find((m) => m.id === lmn)
          if (lmn && pmm) {
            const cloned = clone(pmm)
            cloned.imports.forEach(
              (mmi) => {
                mmi.id = getModuleNameFromPublicPkgName(getPkgFromModuleName(lmn), mmi.name)
              }
            )
            addMetaModule(cloned)
          }
        }
      )

      const pending = new Set<string>()

      changed.forEach(
        ({ path }) => {
          const lmn = getLocalModuleName(path)
          if (lmn) {
            pending.add(lmn)
          } else {
            cur.modules.filter((m) => m.exports && m.sources?.includes(path)).forEach((m) => pending.add(m.id))
          }
        }
      )

      await Promise.all([...pending].map(async (lmn) => this.call('build-local-module', 'parallel', lmn, context)))
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
            project: { mn2bm, meta },
            utils: { isLocalModule, getLocalPkgFromName }
          }
        }
      } = this
      const lms = meta.cur.modules.filter((m) => isLocalModule(m.id))
      lms.forEach(
        (m) => {
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

          m.imports.forEach(
            (i) => {
              if (isLocalModule(i.id) && !lms.find((m) => m.id === i.id)) {
                throw new Error(
                  `Module '${i.id}' is imported by '${mn}' but it is not a local module name.` +
                    `You may need to import from ${getLocalPkgFromName(i.id)} instead of ${i.id}.`
                )
              }
            }
          )
        }
      )
    }
  )
)
