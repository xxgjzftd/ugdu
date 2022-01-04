import { join } from 'path/posix'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { cached } from './shared'
import { setContext } from './context'
import { buildLocalModules } from './local'
import { vendor } from './plugins/vendor'
import { meta } from './plugins/meta'

import type { Promisable } from 'type-fest'
import type { Task } from '@ugdu/processor'

export interface BuildVendorModulesHooks {
  'build-vendor-module'(rmn: string, task: Task<BuildVendorModulesHooks>): Promisable<void>
}

export const buildVendorModule = cached(
  async function (vvn, task: Task<BuildVendorModulesHooks>) {
    const {
      manager: {
        context,
        context: {
          CONSTANTS: { VENDOR_INPUT },
          config,
          config: { assets },
          project,
          project: { mn2bm },
          utils: { isVendorModule, shouldExternal, getPkgFromModuleName, getVersionedPkgName, getMetaModule }
        }
      }
    } = task
    const pkg = getPkgFromModuleName(vvn)
    await Promise.all(
      pkg.dependents
        .filter((d) => !d.local)
        .map((d) => task.call('build-vendor-module', 'parallel', getVersionedPkgName(d), task))
    )
    if (shouldExternal(pkg)) {
      const bindings = new Set(mn2bm.cur[vvn])
      project.meta.cur.modules.forEach(
        (m) => {
          if (isVendorModule(m.id)) {
            m.imports.forEach((i) => i.id === vvn && i.bindings.forEach((b) => bindings.add(b)))
          }
        }
      )
      mn2bm.cur[vvn] = [...bindings].sort()
    }
    if (
      mn2bm.pre[vvn]?.toString() !== mn2bm.cur[vvn].toString() ||
      project.meta.pre.modules.find((m) => m.id === vvn)?.externals!.toString() !==
        getMetaModule(vvn).externals!.toString()
    ) {
      if (!mn2bm.cur[vvn].length) return
      await build(
        mergeConfig(
          {
            publicDir: false,
            build: {
              rollupOptions: {
                VENDOR_INPUT,
                output: {
                  entryFileNames: join(assets, vvn, '[hash].js'),
                  chunkFileNames: join(assets, vvn, '[hash].js'),
                  assetFileNames: join(assets, vvn, '[hash][extname]'),
                  format: 'es',
                  manualChunks: {}
                },
                preserveEntrySignatures: 'allow-extension'
              }
            },
            plugins: [vendor(vvn, context), meta(vvn, context)]
          },
          config.vite
        )
      )
    }
  }
)

export const buildVendorModules = series(
  setContext,
  buildLocalModules,
  new TaskOptions<BuildVendorModulesHooks>(
    async function build () {
      const {
        manager: {
          context: {
            project: { pkgs },
            utils: { shouldExternal, getVersionedPkgName, getMetaModule }
          }
        }
      } = this

      const pending: string[] = []
      pkgs.forEach(
        (pkg) => {
          if (!pkg.local && shouldExternal(pkg)) {
            const vvn = getVersionedPkgName(pkg)
            const mm = getMetaModule(vvn)
            if (!mm.externals!.length) {
              pending.push(vvn)
            }
          }
        }
      )

      await Promise.all(pending.map((vvn) => this.call('build-vendor-module', 'parallel', vvn, this)))
    },
    {
      'build-vendor-module': buildVendorModule
    }
  )
)
