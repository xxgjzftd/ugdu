import { join } from 'path/posix'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { assign, cached } from '../shared/utils'
import { setContext } from './context'
import { buildLocalModules } from './local'
import { vendor } from '../plugins/vendor'
import { meta } from '../plugins/meta'

import type { Promisable } from 'type-fest'
import type { Context } from '@ugdu/processor'

export interface BuildVendorModulesHooks {
  'build-vendor-module'(rmn: string, task: Context): Promisable<void>
}

export const buildVendorModule = async function (vvn: string, context: Context) {
  const {
    CONSTANTS: { VENDOR_INPUT },
    config,
    config: { assets },
    project,
    project: { mn2bm },
    utils: { remove, getMetaModule }
  } = context
  mn2bm.cur[vvn] = getCurrentBindings(vvn, context)
  const pmm = project.meta.pre.modules.find((m) => m.id === vvn)
  const cmm = getMetaModule(vvn)
  if (
    mn2bm.pre[vvn]?.toString() !== mn2bm.cur[vvn].toString() ||
    pmm?.externals!.toString() !== cmm.externals!.toString()
  ) {
    if (mn2bm.cur[vvn].length) {
      await build(
        mergeConfig(
          {
            publicDir: false,
            build: {
              rollupOptions: {
                input: VENDOR_INPUT,
                output: {
                  entryFileNames: join(assets, vvn, '[hash].js'),
                  chunkFileNames: join(assets, vvn, '[hash].js'),
                  assetFileNames: join(assets, vvn, '[hash][extname]'),
                  format: 'es',
                  manualChunks: {}
                },
                preserveEntrySignatures: 'allow-extension',
                external: cmm.externals
              }
            },
            plugins: [vendor(vvn, context), meta(vvn, context)]
          },
          config.vite
        )
      )
    } else {
      remove(vvn)
    }
  } else {
    assign(cmm, pmm)
  }
}

interface VersionedVendor {
  name: string
  dependents: VersionedVendor[]
}

type Circle = VersionedVendor[]

const getCurrentBindings = (vvn: string, context: Context) => {
  const {
    project,
    project: { mn2bm },
    utils: { isVendorModule }
  } = context
  const bindings = new Set(mn2bm.cur[vvn])
  project.meta.cur.modules.forEach(
    (m) => {
      if (isVendorModule(m.id)) {
        m.imports.forEach((i) => i.id === vvn && i.bindings.forEach((b) => bindings.add(b)))
      }
    }
  )
  return [...bindings].sort()
}

export const buildVendorModules = series(
  setContext,
  buildLocalModules,
  new TaskOptions<BuildVendorModulesHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            project: { pkgs, mn2bm },
            utils: { shouldExternal, getVersionedPkgName, getMetaModule, getPkgFromPublicPkgName }
          }
        }
      } = this

      const vvs: VersionedVendor[] = []

      const getVersionedVendor = cached(
        (vvn) => {
          let vv = vvs.find((vv) => vv.name === vvn)
          if (!vv) {
            vv = { name: vvn, dependents: [] }
            vvs.push(vv)
          }
          return vv
        }
      )

      pkgs.forEach(
        (pkg) => {
          if (!pkg.local && shouldExternal(pkg)) {
            const vvn = getVersionedPkgName(pkg)
            const vv = getVersionedVendor(vvn)
            const mm = getMetaModule(vvn)
            mm.externals!.forEach(
              (ppn) => {
                const dpkg = getPkgFromPublicPkgName(pkg, ppn)
                const dvvn = getVersionedPkgName(dpkg)
                const dvv = getVersionedVendor(dvvn)
                !dvv.dependents.includes(vv) && dvv !== vv && dvv.dependents.push(vv)
              }
            )
          }
        }
      )

      const seen: Set<VersionedVendor> = new Set()
      const cs: Circle[] = []
      const traverse = (vv: VersionedVendor, dp: VersionedVendor[]) => {
        if (seen.has(vv)) return
        vv.dependents.forEach(
          (d) => {
            const index = dp.indexOf(d)
            if (~index) {
              cs.push(dp.slice(index))
            } else {
              traverse(d, [...dp, d])
            }
          }
        )
        seen.add(vv)
      }

      vvs.forEach((vv) => traverse(vv, [vv]))

      const status: Map<VersionedVendor, boolean> = new Map()
      const getCircles = (vv: VersionedVendor, range = cs) => range.filter((c) => c.includes(vv))
      const isInSameCircle = (vv1: VersionedVendor, vv2: VersionedVendor) => !!(getCircles(vv2), getCircles(vv1)).length
      const isReady = (vv: VersionedVendor) => {
        if (status.get(vv)) {
          return true
        } else {
          const ready = vv.dependents.every(
            (d) => {
              if (!vvs.includes(d)) {
                return true
              } else if (isInSameCircle(vv, d)) {
                return true
              } else {
                return false
              }
            }
          )
          status.set(vv, ready)
          return ready
        }
      }

      while (vvs.length) {
        const pending: VersionedVendor[] = []
        vvs
          .filter((vv) => isReady(vv))
          .forEach(
            (vv) => {
              const cs = getCircles(vv)
              if (!cs.length || cs.every((c) => c.every((vv) => status.get(vv)))) {
                vvs.splice(vvs.indexOf(vv), 1)
                pending.push(vv)
              }
            }
          )

        let changed = [...pending]

        while (changed.length) {
          await Promise.all(changed.map((vv) => this.call('build-vendor-module', 'parallel', vv.name, context)))
          changed = pending.filter(
            (vv) => mn2bm.cur[vv.name].toString() !== getCurrentBindings(vv.name, context).toString()
          )
        }
      }
    },
    ['build-vendor-module'],
    {
      'build-vendor-module': buildVendorModule
    }
  )
)
