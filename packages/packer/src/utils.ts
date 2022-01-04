import { isAbsolute, resolve as originResolve } from 'path'

import { normalizePath } from 'vite'
import { parallel, series, TaskOptions } from '@ugdu/processor'

import { cached } from './shared'
import { setConstants } from './constants'
import { setConfig } from './config'
import { setProject, getPkgId } from './project'

import type { Context } from '@ugdu/processor'
import type { PkgNode } from './project'

const getUtils = (context: Context) => {
  const {
    CONSTANTS: { ROUTES, VERSIONED_VENDOR_SEP, PACKAGE_NAME_SEP },
    config,
    config: { cwd, apps },
    project: { pkgs, routes, meta }
  } = context
  const localPkgs = pkgs.filter((pkg) => pkg.local)
  const localPkgPaths = localPkgs.map((lp) => getNormalizedPath(lp.path))
  const localPkgNames = localPkgs.map((lp) => getNormalizedPath(lp.name))

  const resolve = originResolve.bind(null, cwd)

  const remove = (mn: string) => {
    const index = meta.cur.modules.findIndex((m) => m.id === mn)
    if (~index) {
      meta.cur.modules.splice(index, 1)
    }
  }

  const appendSlash = cached((str: string) => `${str}/`)

  const isPage = cached((path) => !!getRoutesMoudleNames(path).length)
  /**
   * Module name can be {@link MetaModule.id} or {@link MetaModuleImport.name}.
   */
  const isLocalPkg = cached((mn) => localPkgNames.includes(mn))
  const isLocalModule = cached((mn) => !!localPkgNames.find((lpn) => mn === lpn || mn.startsWith(appendSlash(lpn))))
  const isRoutesModule = cached((mn) => mn.startsWith(appendSlash(ROUTES)))
  const isVendorModule = cached((mn) => !isLocalModule(mn) && !isRoutesModule(mn))
  const isBareSpecifier = cached((specifier) => specifier[0] !== '.' && !isAbsolute(specifier))

  const shouldExternal = (pkg: PkgNode) => pkg.dependents.length > 1 || !!pkg.dependents.find((dep) => dep.local)

  const getNormalizedPath = cached((ap) => normalizePath(ap).slice(normalizePath(cwd).length + 1))

  const getLocalPkgFromPath = cached(
    (path) => {
      const lp = localPkgs.find((lp) => path.startsWith(appendSlash(getNormalizedPath(lp.path))))
      if (!lp) {
        throw new Error(
          `This method should only be called with a path that start with one of the ${localPkgPaths.toString()}.` +
            `But received ${path}.`
        )
      }
      return lp
    }
  )

  const getLocalPkgFromName = cached(
    (lmn) => {
      const lp = localPkgs.find((lp) => lmn === lp.name || lmn.startsWith(appendSlash(lp.name)))
      if (!lp) {
        throw new Error(
          `This method should only be called with a local module name that start with one of the ${localPkgNames.toString()}.` +
            `But received ${lmn}.`
        )
      }
      return lp
    }
  )

  const getRoutesMoudleNames = cached((path) => Object.keys(routes).filter((rmn) => routes[rmn].includes(path)))

  const getLocalModuleName = cached(
    (path) => {
      const localPkg = getLocalPkgFromPath(path)
      const localPkgPath = getNormalizedPath(localPkg.path)
      const { main, name } = localPkg
      if (isPage(path) && main) {
        throw new Error(
          `A file in a package that has a main field cannot be specified as a page.` +
            `Please migrate '${path}' to another package.`
        )
      }
      if (isPage(path) || (!main && config.extensions.includes(path.slice(path.lastIndexOf('.') + 1)))) {
        return path.replace(localPkgPath, name)
      }
      if (main && getNormalizedPath(resolve(localPkgPath, main)) === path) {
        return name
      }
      return null
    }
  )

  const getLocalModulePath = cached(
    (lmn) =>
      getNormalizedPath(
        isLocalPkg(lmn)
          ? resolve(getLocalPkgFromName(lmn).path, getLocalPkgFromName(lmn).main!)
          : lmn.replace(getLocalPkgFromName(lmn).name, getLocalPkgFromName(lmn).path)
      )
  )

  /**
   * The return value is used as `external` config of rollup when building local module.
   */
  const getLocalModuleExternal = cached(
    (lmn) => [
      ...getLocalPkgFromName(lmn).dependencies.map((dep) => new RegExp('^' + dep + '(/.+)?$')),
      new RegExp(`^${appendSlash(ROUTES)}`)
    ]
  )

  /**
   * This method is different from {@link getLocalModuleExternal}. It's return value is used to set {@link MetaModule.externals}.
   */
  const getVendorModuleExternals = cached(
    (mn) => {
      const pkg = getPkgFromModuleName(mn)
      const externals: string[] = []
      const traverse = (pkg: PkgNode, dp: PkgNode[]) => {
        pkg.dependencies.forEach(
          (dep) => {
            dp = [...dp, dep]
            if (shouldExternal(dep)) {
              externals.push(getPublicPkgName(dp))
            } else {
              traverse(dep, dp)
            }
          }
        )
      }
      traverse(pkg, [])
      return externals.sort()
    }
  )

  const getMetaModule = cached(
    (mn) => {
      let mm = meta.cur.modules.find((m) => m.id === mn)
      if (!mm) {
        mm = { id: mn, js: '', imports: [] }
        if (isVendorModule(mn)) {
          mm.externals = getVendorModuleExternals(mn)
        }
        meta.cur.modules.push(mm)
      }
      return mm
    }
  )

  const getPkgName = cached((specifier) => specifier.split('/', specifier[0] === '@' ? 2 : 1).join('/'))

  /**
   * Module name is {@link MetaModule.id}.
   */
  const getPkgFromModuleName = cached(
    (mn) => {
      let pkg
      if (isLocalModule(mn)) {
        pkg = pkgs.find((pkg) => pkg.name === getPkgName(mn))
      } else if (isVendorModule(mn)) {
        const [name, version] = mn.split(new RegExp(`(?!^)${VERSIONED_VENDOR_SEP}`), 2)
        pkg = pkgs.find((pkg) => pkg.name === name && pkg.version === version)
      } else {
        throw new Error(`Shouldn't call this method with ${mn}. Because it's a routes module name.`)
      }
      if (!pkg) {
        throw new Error(
          `Can not find '${mn}' in context.project.pkgs. This maybe a bug of @ugdu/packer. Please issue a bug in github.`
        )
      }
      return pkg
    }
  )

  /**
   * Module id is the fully resolved id of the module.
   */
  const getPkgFromModuleId = cached(
    (mi) => {
      const pkg = pkgs
        .filter((pkg) => mi.startsWith(appendSlash(pkg.path)))
        .sort((a, b) => b.path.length - a.path.length)[0]
      if (!pkg) {
        throw new Error(
          `Can not find '${mi}' in context.project.pkgs. This maybe a bug of @ugdu/packer. Please issue a bug in github.`
        )
      }
      return pkg
    }
  )

  /**
   * Gets the {@link PkgNode} which own the `source`.
   *
   * @param source - The module specifier which imported by the importer
   * @param importer - The module id or pkg node of the importer
   * @returns The {@link PkgNode} of the target or null if not find
   */
  const getPkgFromSourceAndImporter = (source: string, importer: string | PkgNode) =>
    (isBareSpecifier(source) &&
      (typeof importer === 'string' ? getPkgFromModuleId(importer) : importer).dependencies.find(
        (dep) => source === dep.name || source.startsWith(appendSlash(dep.name))
      )) ||
    null

  const getVersionedPkgName = (pkg: PkgNode) => `${pkg.name}@${pkg.version}`

  const getDepPath = (start: PkgNode, end: PkgNode) => {
    const queue: PkgNode[] = [start]
    const map: Map<PkgNode, PkgNode[]> = new Map()
    map.set(start, [])
    let path: PkgNode[] = []
    while (queue.length) {
      const pkg = queue.shift()!
      const pre = map.get(pkg)!
      if (pkg === end) {
        path = pre
      } else {
        pkg.dependencies.forEach(
          (dep) => {
            queue.push(dep)
            map.set(dep, [...pre, dep])
          }
        )
      }
    }
    if (!path) {
      throw new Error(
        `Can not find the dep path from '${getVersionedPkgName(start)}' to '${getVersionedPkgName(end)}'. ` +
          `This maybe a bug of @ugdu/packer. Please issue a bug in github.`
      )
    }
    return path
  }

  const getPublicPkgName = (dp: PkgNode[]) => dp.map((pkg) => pkg.name).join(PACKAGE_NAME_SEP)

  const getPkgFromPublicPkgName = (parent: PkgNode, ppn: string) =>
    ppn.split(PACKAGE_NAME_SEP).reduce((parent, pn) => parent.dependencies.find((pkg) => pkg.name === pn)!, parent)

  const getRoutesOption = cached((rmn) => config.routes[rmn.slice(ROUTES.length + 1)])

  const stringify = (payload: any, replacer?: (key: string | number, value: any) => string | void): string => {
    const type = typeof payload
    switch (type) {
      case 'object':
        const isArray = Array.isArray(payload)
        let content = (
          isArray
            ? payload.map(
                (value: any, index: number) => (replacer && replacer(index, value)) ?? stringify(value, replacer)
              )
            : Object.keys(payload).map(
                (key) => `${key}:${(replacer && replacer(key, payload[key])) ?? stringify(payload[key], replacer)}`
              )
        ).join(',')
        return (replacer && replacer('', payload)) ?? isArray ? `[${content}]` : `{${content}}`
      case 'function':
        return payload.toString()
      default:
        return JSON.stringify(payload)
    }
  }

  apps.forEach(
    (app) => {
      if (typeof app.packages === 'function') {
        app.packages = app.packages(localPkgs)
      }
    }
  )

  return {
    cached,
    resolve,
    remove,
    appendSlash,
    shouldExternal,
    isPage,
    isLocalPkg,
    isLocalModule,
    isRoutesModule,
    isVendorModule,
    isBareSpecifier,
    getPkgId,
    getNormalizedPath,
    getLocalPkgFromPath,
    getLocalPkgFromName,
    getRoutesMoudleNames,
    getLocalModuleName,
    getLocalModulePath,
    getLocalModuleExternal,
    getVendorModuleExternals,
    getMetaModule,
    getPkgName,
    getPkgFromModuleName,
    getPkgFromModuleId,
    getPkgFromSourceAndImporter,
    getVersionedPkgName,
    getDepPath,
    getPublicPkgName,
    getPkgFromPublicPkgName,
    getRoutesOption,
    stringify
  }
}

export const setUtils = series(
  parallel(setConstants, setConfig, setProject),
  new TaskOptions(
    function () {
      const {
        manager: { context }
      } = this
      context.utils = getUtils(context)
    }
  )
)

export type Utils = ReturnType<typeof getUtils>
