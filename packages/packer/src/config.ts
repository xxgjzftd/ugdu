import { cwd } from 'process'

import { TaskOptions } from '@ugdu/processor'
import { mergeConfig } from 'vite'

import type { InlineConfig } from 'vite'
import type { Merge } from 'type-fest'

export interface UserConfig {
  extensions: string[]
  cwd?: string
  /**
   * @default 'dist'
   */
  dist?: string
  /**
   * @default 'assets'
   */
  assets?: string
  /**
   * @default '/'
   */
  base?: string
  apps: UserAppConfig[]
  routes?: Record<string, RoutesOption>
  vite?: InlineConfig
  meta: 'local' | `http${'s' | ''}://${string}/`
}

export interface UserAppConfig {
  name: string
  predicate?: (pathname: string) => boolean
  vite?: InlineConfig
  packages: ((packages: string[]) => string[]) | string[]
}

export interface RoutesOption {
  patterns: string | string[]
  base: `/${string}/` | '/'
  depth: number
  extends: RouteExtend[]
}

type RouteExtend = Partial<Pick<BaseRoute, 'path' | 'name' | 'depth'>> & Pick<BaseRoute, 'id'>

export interface BaseRoute {
  id: string
  path: string
  name: string
  depth: number
  component: string
  children?: BaseRoute[]
}

export type Config = Merge<Required<UserConfig>, { apps: Required<UserAppConfig>[] }>

export interface SetConfigHooks {
  'get-config'(): UserConfig | void
}

export const setConfig = new TaskOptions<SetConfigHooks>(
  async function () {
    const config = await this.call('get-config', 'first')
    if (!config) {
      throw new Error(`The 'get-config' hook should have at least one hook function which returns a config.`)
    }
    config.cwd = config.cwd ?? cwd()
    config.dist = config.dist ?? 'dist'
    config.assets = config.assets ?? 'assets'
    config.base = config.base ?? '/'
    config.vite = mergeConfig(
      {
        base: config.base,
        build: {
          outDir: config.dist,
          assetsDir: config.assets,
          emptyOutDir: false,
          commonjsOptions: { esmExternals: true }
        }
      },
      config.vite ?? {}
    )
    config.routes = config.routes ?? {}
    config.apps.forEach(
      (app) => {
        app.predicate = () => true
        app.vite = {}
      }
    )
    this.manager.context.config = config as Config
  }
)
