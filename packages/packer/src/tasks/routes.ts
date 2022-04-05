import { join } from 'path'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { routes } from '../plugins/routes'
import { meta } from '../plugins/meta'

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
  new TaskOptions<BuildRoutesModuleHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            project: {
              sources: { changed }
            },
            utils: { isPage }
          }
        }
      } = this

      changed.some((s) => s.status !== 'M' && isPage(s.path)) && this.call('build-routes-module', 'parallel', context)
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
