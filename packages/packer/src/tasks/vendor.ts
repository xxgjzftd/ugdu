import { join } from 'path'

import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { clone, cached } from '../shared/utils'
import { setContext } from './context'
import { buildLocalModules } from './local'
import { vendor } from '../plugins/vendor'
import { meta } from '../plugins/meta'

import type { Promisable } from 'type-fest'
import type { Context } from '@ugdu/processor'

/**
 * @public
 */
export interface BuildVendorModulesHooks {
  'build-vendor-module'(rmn: string, task: Context): Promisable<void>
}

/**
 * @internal
 */
export const buildVendorModule = async function (vvn: string, context: Context) {
  const {
    CONSTANTS: { VENDOR_INPUT },
    config,
    config: { assets },
    utils: { getMetaModule }
  } = context
  const cmm = getMetaModule(vvn)
  await build(
    mergeConfig(
      {
        publicDir: false,
        build: {
          cssCodeSplit: false,
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

/**
 * Builds `vendor module`.
 *
 * @remarks
 * Check {@link MetaModule} for more information about `module`.
 *
 * @public
 */
export const buildVendorModules = series(
  setContext,
  buildLocalModules,
  new TaskOptions<BuildVendorModulesHooks>(
    async function build () {
      const {
        manager: {
          context,
          context: {
            project,
            project: { pkgs, mn2bm },
            utils: {
              remove,
              shouldExternal,
              getVersionedPkgName,
              getMetaModule,
              addMetaModule,
              getPkgFromPublicPkgName,
              getPkgFromModuleName
            }
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
      let cs: Circle[] = []
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

      let collapse: Circle[] = []
      cs.forEach(
        (c) => {
          const pending = [c]
          const others: Circle[] = []
          collapse.forEach(
            (cc) => {
              if (c.some((vv) => cc.includes(vv))) {
                pending.push(cc)
              } else {
                others.push(cc)
              }
            }
          )
          collapse = [
            pending.reduce(
              (res, c) => {
                c.forEach((vv) => res.includes(vv) || res.push(vv))
                return res
              },
              []
            ),
            ...others
          ]
        }
      )

      cs = collapse

      const status: Map<VersionedVendor, boolean> = new Map()
      const getCircle = (vv: VersionedVendor) => cs.find((c) => c.includes(vv))
      const isInSameCircle = (vv1: VersionedVendor, vv2: VersionedVendor) => !!getCircle(vv1)?.includes(vv2)
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
        const pending: (VersionedVendor | VersionedVendor[])[] = []
        vvs
          .filter((vv) => isReady(vv))
          .forEach(
            (vv) => {
              const c = getCircle(vv)
              if (!c || c.every((vv) => status.get(vv))) {
                vvs.splice(vvs.indexOf(vv), 1)

                mn2bm.cur[vv.name] = getCurrentBindings(vv.name, context)
                const pmm = project.meta.pre.modules.find((m) => m.id === vv.name)
                const cmm = getMetaModule(vv.name)
                if (
                  mn2bm.pre[vv.name]?.toString() !== mn2bm.cur[vv.name].toString() ||
                  pmm?.externals!.toString() !== cmm.externals!.toString()
                ) {
                  if (mn2bm.cur[vv.name].length) {
                    if (c) {
                      const sub = pending.find((p) => Array.isArray(p) && c.includes(p[0])) as VersionedVendor[]
                      if (sub) {
                        sub.push(vv)
                      } else {
                        pending.push([vv])
                      }
                    } else {
                      pending.push(vv)
                    }
                  } else {
                    remove(vv.name)
                  }
                } else {
                  const cloned = clone(pmm)
                  cloned.imports.forEach(
                    (mmi) => {
                      mmi.id = getVersionedPkgName(getPkgFromPublicPkgName(getPkgFromModuleName(vv.name), mmi.name))
                    }
                  )
                  addMetaModule(cloned)
                }
              }
            }
          )

        await Promise.all(
          pending.map(
            async (p) => {
              if (Array.isArray(p)) {
                while (p.length) {
                  await Promise.all(p.map((vv) => this.call('build-vendor-module', 'parallel', vv.name, context)))
                  const c = getCircle(p[0])!
                  p = c.filter(
                    (vv) => {
                      const cb = getCurrentBindings(vv.name, context)
                      if (mn2bm.cur[vv.name].toString() !== cb.toString()) {
                        mn2bm.cur[vv.name] = cb
                        return true
                      } else {
                        return false
                      }
                    }
                  ) as VersionedVendor[]
                }
              } else {
                await this.call('build-vendor-module', 'parallel', p.name, context)
              }
            }
          )
        )
      }
    },
    ['build-vendor-module'],
    {
      'build-vendor-module': buildVendorModule
    }
  )
)
