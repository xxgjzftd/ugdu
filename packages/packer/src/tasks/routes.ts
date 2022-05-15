import { join } from 'path'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { routes } from '../plugins/routes'
import { meta } from '../plugins/meta'
import { clone } from '../shared/utils'

import type { InlineConfig } from 'vite'
import type { Promisable } from 'type-fest'
import type { Context } from '@ugdu/processor'

/**
 * @public
 */
export interface BuildRoutesModuleHooks {
  /**
   * A `parallel` type hook. It will be invoked once `routes module` need be built.
   *
   * @remarks
   * This hook will be triggered when there are any creation or deletion of `page` in the project.
   *
   * @param context - {@link @ugdu/processor#Context}
   */
  'build-routes-module'(context: Context): Promisable<void>
}

/**
 * Builds `routes module`.
 *
 * @remarks
 * Check {@link MetaModule} for more information about `module`.
 *
 * @public
 */
export const buildRoutesModule = series(
  setContext,
  new TaskOptions(
    async function validate () {
      const {
        manager: {
          context: {
            utils: { getPages, getLocalModuleName }
          }
        }
      } = this
      getPages().forEach(
        (page) => {
          if (getLocalModuleName(page) === null) {
            throw new Error(
              `'${page}' is specified as a page, but it is not a 'local module'.` +
                `For the 'local package' which have 'main' field, only the corresponding file of 'main' can be specified as a page.` +
                `For other packages, there is no such restriction.`
            )
          }
        }
      )
    }
  ),
  new TaskOptions<BuildRoutesModuleHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            CONSTANTS: { ROUTES },
            project: {
              meta: { pre },
              sources: { changed }
            },
            utils: { isPage, addMetaModule }
          }
        }
      } = this

      if (
        changed.some((s) => (s.status === 'A' && isPage(s.path)) || (s.status === 'D' && pre.pages.includes(s.path)))
      ) {
        await this.call('build-routes-module', 'parallel', context)
      } else {
        const pmm = pre.modules.find((m) => m.id === ROUTES)
        if (pmm) {
          addMetaModule(clone(pmm))
        }
      }
    },
    ['build-routes-module'],
    {
      'build-routes-module': async function (context: Context) {
        const {
          CONSTANTS: { ROUTES_INPUT, ROUTES },
          config,
          config: { assets }
        } = context
        await build(
          mergeConfig(
            {
              publicDir: false,
              build: {
                rollupOptions: {
                  input: ROUTES_INPUT,
                  output: {
                    entryFileNames: join(assets, ROUTES, '[hash].js'),
                    chunkFileNames: join(assets, ROUTES, '[hash].js'),
                    assetFileNames: join(assets, ROUTES, '[hash][extname]'),
                    format: 'es'
                  },
                  preserveEntrySignatures: 'allow-extension'
                }
              },
              plugins: [routes(context), meta(ROUTES, context)]
            } as InlineConfig,
            config.vite
          )
        )
      }
    }
  )
)
