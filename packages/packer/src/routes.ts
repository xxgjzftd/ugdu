import { join } from 'path/posix'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { cached } from './shared'
import { setContext } from './context'
import { routes } from './plugins/routes'
import { meta } from './plugins/meta'

import type { InlineConfig } from 'vite'
import type { Promisable } from 'type-fest'
import type { Context } from '@ugdu/processor'

export interface BuildRoutesModulesHooks {
  'build-routes-module'(rmn: string, context: Context): Promisable<void>
}

export const buildRoutesModule = cached(
  async function (rmn, context: Context) {
    const {
      CONSTANTS: { ROUTES_INPUT },
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
                entryFileNames: join(assets, rmn, '[hash].js'),
                chunkFileNames: join(assets, rmn, '[hash].js'),
                assetFileNames: join(assets, rmn, '[hash][extname]'),
                format: 'es'
              },
              preserveEntrySignatures: 'allow-extension'
            }
          },
          plugins: [routes(rmn, context), meta(rmn, context)]
        } as InlineConfig,
        config.vite
      )
    )
  }
)

export const buildRoutesModules = series(
  setContext,
  new TaskOptions<BuildRoutesModulesHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            project: {
              sources: { changed }
            },
            utils: { getRoutesMoudleNames }
          }
        }
      } = this

      const pending = new Set<string>()

      changed.forEach(
        (s) => {
          if (s.status !== 'M') {
            getRoutesMoudleNames(s.path).forEach((rmn) => pending.add(rmn))
          }
        }
      )

      await Promise.all([...pending].map((rmn) => this.call('build-routes-module', 'parallel', rmn, context)))
    },
    {
      'build-routes-module': buildRoutesModule
    }
  )
)
