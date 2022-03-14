import { isAbsolute, resolve } from 'path'

import { normalizePath } from 'vite'
import { parallel, series, TaskOptions } from '@ugdu/processor'
import autobind from 'autobind-decorator'

import { cacheable, getDefault } from '../shared/utils'
import { setConstants } from './constants'
import { setConfig } from './config'

import type { Context } from '@ugdu/processor'
import type { PkgNode, BaseRoute } from './project'

/**
 * @public
 */
export const setUtils = series(
  parallel(setConstants, setConfig),
  new TaskOptions(
    function () {
      const {
        manager: { context }
      } = this
      context.utils = new Utils(context)
    }
  )
)

/**
 * @public
 */
@getDefault(autobind)
export class Utils {
  constructor (public context: Context) {}

  /**
   * Same as the `resolve` method of nodejs's 'path' moudle, But this method will resolve `pss` with {@link UserConfig.cwd}.
   *
   * @param pss - path segments
   * @returns The result path
   */
  resolve (...pss: string[]) {
    const {
      config: { cwd }
    } = this.context
    return resolve(cwd, ...pss)
  }

  /**
   * Removes the `module` whose id is `mn` from {@link Meta.modules}.
   *
   * @param mn - The id of the `module` to be removed
   */
  remove (mn: string) {
    const {
      project: { meta }
    } = this.context
    const index = meta.cur.modules.findIndex((m) => m.id === mn)
    if (~index) {
      meta.cur.modules.splice(index, 1)
    }
  }

  /**
   * Appends '/' to `str`.
   *
   * @param str - The string to be appended
   * @returns The result string
   */
  @cacheable
  appendSlash (str: string) {
    return `${str}/`
  }

  /**
   * Is the `path` a `page`.
   * `page` is `module` which is imported by the `routes module` as a route.
   * Check {@link UserConfig.cwd} for what `path` is.
   *
   * @param path - The `path` to be test
   * @returns true if the `path` is a `page`
   */
  @cacheable
  isPage (path: string) {
    return !!this.getRoutesMoudleNames(path).length
  }

  /**
   * Is the `mn` a `local package` name.
   *
   * @param mn - The `module` name to be test
   * @returns true if the `mn` is a `local package` name
   */
  @cacheable
  isLocalPkg (mn: string) {
    return this.getLocalPkgNames().includes(mn)
  }

  /**
   * Is the `mn` a `local module` name.
   *
   * @param mn - The module name to be test
   * @returns true if the `mn` is a `local module` name
   */
  @cacheable
  isLocalModule (mn: string) {
    return !!this.getLocalPkgNames().find((lpn) => mn === lpn || mn.startsWith(this.appendSlash(lpn)))
  }

  /**
   * Is the `mn` a `routes module` name.
   *
   * @param mn - The module name to be test
   * @returns true if the `mn` is a `routes module` name
   */
  @cacheable
  isRoutesModule (mn: string) {
    const {
      CONSTANTS: { ROUTES }
    } = this.context
    return mn.startsWith(this.appendSlash(ROUTES))
  }

  /**
   * Is the `mn` a `vendor module` name.
   *
   * @param mn - The module name to be test
   * @returns true if the `mn` is a `vendor module` name
   */
  @cacheable
  isVendorModule (mn: string) {
    return !this.isLocalModule(mn) && !this.isRoutesModule(mn)
  }

  /**
   * Is the `specifier` a bare `specifier`.
   *
   * @param specifier - The `specifier` to be test
   * @returns true if the `specifier` is a bare `specifier`
   */
  @cacheable
  isBareSpecifier (specifier: string) {
    return specifier[0] !== '.' && !isAbsolute(specifier)
  }

  /**
   * Whether the `pkg` should be external.
   * Only `vendor package`s imported by multiple `module`s or `local module` should be external.
   *
   * @param pkg - The `vendor package` to be test
   * @returns ture if the `pkg` should be external
   */
  shouldExternal (pkg: PkgNode) {
    return pkg.dependents.length > 1 || !!pkg.dependents.find((dep) => dep.local)
  }

  /**
   * Normalizes the `ap` to `path`.
   *
   * @param ap - The absolute path to be normalized
   * @returns The normalized `path`
   */
  @cacheable
  getNormalizedPath (ap: string) {
    const {
      config: { cwd }
    } = this.context
    return normalizePath(ap).slice(cwd.length + 1)
  }

  /**
   * Gets all `local package`s
   *
   * @returns All `local package`s
   */
  @cacheable
  getLocalPkgs () {
    const {
      project: { pkgs }
    } = this.context
    return pkgs.filter((pkg) => pkg.local)
  }

  /**
   * Gets the names of all `local package`s.
   *
   * @returns The names of all `local package`s
   */
  @cacheable
  getLocalPkgNames () {
    return this.getLocalPkgs().map((lp) => lp.name)
  }

  /**
   * Gets the `path`s of all `local package`s.
   *
   * @returns The `path`s of all `local package`s
   */
  @cacheable
  getLocalPkgPaths () {
    return this.getLocalPkgs().map((lp) => lp.path)
  }

  /**
   * Gets the `package` name without `scope`.
   *
   * @param lpn - The `local package` name
   * @returns The `package` name without `scope`
   */
  @cacheable
  getPkgId (lpn: string) {
    return lpn.replace(/.+\//, '')
  }

  /**
   * Gets the `local package` which contains the `path`.
   *
   * @param path - The `path` we get `local package` from
   * @returns The `local package` which contains the `path`
   */
  @cacheable
  getLocalPkgFromPath (path: string) {
    const lp = this.getLocalPkgs().find((lp) => path.startsWith(this.appendSlash(lp.path)))
    if (!lp) {
      throw new Error(
        `This method should only be called with a path which start with one of the ${this.getLocalPkgPaths().toString()}.` +
          `But received ${path}.`
      )
    }
    return lp
  }

  /**
   * Gets the `local package` which contains the `local module`.
   *
   * @param lmn - `local module` name
   * @returns The `local package` which contains the `local module`
   */
  @cacheable
  getLocalPkgFromName (lmn: string) {
    const lp = this.getLocalPkgs().find((lp) => lmn === lp.name || lmn.startsWith(this.appendSlash(lp.name)))
    if (!lp) {
      throw new Error(
        `This method should only be called with a local module name that start with one of the ${this.getLocalPkgNames().toString()}.` +
          `But received ${lmn}.`
      )
    }
    return lp
  }

  /**
   * Gets the names of `routes module`s which import the `path`.
   *
   * @param path - The `path` we get `routes module` names from
   * @returns The names of `routes module`s which import the `path`
   */
  @cacheable
  getRoutesMoudleNames (path: string) {
    const {
      project: { routes }
    } = this.context
    return Object.keys(routes).filter(
      (rmn) => {
        const queue: BaseRoute[] = [...routes[rmn]]
        while (queue.length) {
          const br = queue.shift()!
          if (br.id === path) {
            return true
          }
          if (br.children) {
            queue.push(...br.children)
          }
        }
        return false
      }
    )
  }

  /**
   * Gets the `local module` name from the `path`.
   *
   * @param path - The `path` we get `local module` name from
   * @returns the `local module` name of the `path` or null if there isn't a corresponding `module`
   */
  @cacheable
  getLocalModuleName (path: string) {
    const { config } = this.context
    const lp = this.getLocalPkgFromPath(path)
    const { main, name } = lp
    if (this.isPage(path) && main) {
      throw new Error(
        `A file in a package that has a main field cannot be specified as a page.` +
          `Please migrate '${path}' to another package.`
      )
    }
    if (this.isPage(path) || (!main && config.extensions.includes(path.slice(path.lastIndexOf('.') + 1)))) {
      return path.replace(lp.path, name)
    }
    if (main && this.getNormalizedPath(this.resolve(lp.path, main)) === path) {
      return name
    }
    return null
  }

  /**
   * Gets the `local module`'s path from the `local module` name.
   *
   * @param lmn - `local module` name
   * @returns The `path` of the `local module`
   */
  @cacheable
  getLocalModulePath (lmn: string) {
    const lp = this.getLocalPkgFromName(lmn)
    return this.isLocalPkg(lmn)
      ? this.getNormalizedPath(this.resolve(lp.path, lp.main!))
      : lmn.replace(lp.name, lp.path)
  }

  /**
   * Gets the `external` config of the `local module`.
   *
   * @param lmn - `local module` name
   * @returns The `external` config of the `local module`
   */
  @cacheable
  getLocalModuleExternal (lmn: string) {
    const {
      CONSTANTS: { ROUTES }
    } = this.context
    return [
      ...this.getLocalPkgFromName(lmn).dependencies.map((dep) => new RegExp('^' + dep.name + '(/.+)?$')),
      new RegExp(`^${this.appendSlash(ROUTES)}`)
    ]
  }

  /**
   * Gets the {@link MetaModule.externals} of the the `vendor module`.
   *
   * @param mn - The `vendor module` name
   * @returns The `externals` of the the `vendor module`
   */
  @cacheable
  getVendorModuleExternals (mn: string) {
    const pkg = this.getPkgFromModuleName(mn)
    const externals: string[] = []
    const traverse = (pkg: PkgNode, dp: PkgNode[]) => {
      pkg.dependencies.forEach(
        (dep) => {
          let paths = [...dp, dep]
          if (this.shouldExternal(dep)) {
            externals.push(this.getPublicPkgNameFromDepPath(paths))
          } else {
            traverse(dep, paths)
          }
        }
      )
    }
    traverse(pkg, [])
    return externals.sort()
  }

  /**
   * Gets the {@link MetaModule} from the `module` name.
   *
   * @param mn - The `module` name
   * @returns The {@link MetaModule}
   */
  @cacheable
  getMetaModule (mn: string) {
    const {
      project: { meta }
    } = this.context
    let mm = meta.cur.modules.find((m) => m.id === mn)
    if (!mm) {
      mm = { id: mn, js: '', imports: [] }
      if (this.isVendorModule(mn)) {
        mm.externals = this.getVendorModuleExternals(mn)
      }
      meta.cur.modules.push(mm)
    }
    return mm
  }

  /**
   * Gets the `package` name from the `specifier`.
   *
   * @param specifier - The `specifier` we get `package` name from
   * @returns The `package` name
   */
  @cacheable
  getPkgName (specifier: string) {
    return specifier.split('/', specifier[0] === '@' ? 2 : 1).join('/')
  }

  /**
   * Gets the `package` from the `module` name.
   *
   * @param mn - The `module` name
   * @returns The `package`
   */
  @cacheable
  getPkgFromModuleName (mn: string) {
    const {
      project: { pkgs },
      CONSTANTS: { VERSIONED_VENDOR_SEP }
    } = this.context
    let pkg
    if (this.isLocalModule(mn)) {
      pkg = pkgs.find((pkg) => pkg.name === this.getPkgName(mn))
    } else if (this.isVendorModule(mn)) {
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

  /**
   * Gets the `package` from the `module` id.
   *
   * @param mi - The fully resolved id of the `module`
   * @returns The `package`
   */
  @cacheable
  getPkgFromModuleId (mi: string) {
    const {
      project: { pkgs }
    } = this.context
    const pkg = pkgs
      .filter((pkg) => normalizePath(mi).startsWith(this.appendSlash(pkg.ap)))
      .sort((a, b) => b.ap.length - a.ap.length)[0]
    if (!pkg) {
      throw new Error(
        `Can not find '${mi}' in context.project.pkgs. This maybe a bug of @ugdu/packer. Please issue a bug in github.`
      )
    }
    return pkg
  }

  /**
   * Gets the `package` which own the `source` and imported by the `importer`.
   *
   * @param source - The `specifier` the `importer` import with
   * @param importer - The `module` id or `package` of the importer
   * @returns The `package` of the target or null if not find
   */
  getPkgFromSourceAndImporter (source: string, importer: string | PkgNode) {
    return (
      (this.isBareSpecifier(source) &&
        (typeof importer === 'string' ? this.getPkgFromModuleId(importer) : importer).dependencies.find(
          (dep) => source === dep.name || source.startsWith(this.appendSlash(dep.name))
        )) ||
      null
    )
  }

  /**
   * Gets the versioned `package` name from 'package'.
   *
   * @param pkg - The `package`
   * @returns The versioned `package` name
   */
  getVersionedPkgName (pkg: PkgNode) {
    return `${pkg.name}@${pkg.version}`
  }

  /**
   * Gets the dep path from start `package` to end `package`.
   * The dep path includes the end `package` but doesn't include the start `package`.
   *
   * @param start - The start `package`
   * @param end - The end `package`
   * @returns The dep path
   */
  getDepPath (start: PkgNode, end: PkgNode) {
    const queue: PkgNode[] = [start]
    const map: Map<PkgNode, PkgNode[]> = new Map()
    map.set(start, [])
    let path: PkgNode[] = []
    while (queue.length) {
      const pkg = queue.shift()!
      const pre = map.get(pkg)!
      if (pkg === end) {
        path = pre
        break
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
        `Can not find the dep path from '${this.getVersionedPkgName(start)}' to '${this.getVersionedPkgName(end)}'. ` +
          `This maybe a bug of @ugdu/packer. Please issue a bug in github.`
      )
    }
    return path
  }

  /**
   * Gets the `public package name` from dep path.
   * The `public package name` is the package name used at runtime.
   *
   * @remarks
   * At runtime, we couldn't use the `package` name directly, because there may be another `package` has same name but different version.
   * We couldn't use the versioned package name too, because we don't want rebuild and redeploy the `module`s when only their deps's version changed.
   * So we use the `public package name` which descripe the dep path.
   * For `package`s which has same name but different version, the dep path must be different.
   * When a `package`'s version changed, the dep path from the `module`s which import it to the `package` will not change.
   *
   * @param dp - The dep path
   * @returns The `public package name`
   */
  getPublicPkgNameFromDepPath (dp: PkgNode[]) {
    const {
      CONSTANTS: { PACKAGE_NAME_SEP }
    } = this.context
    return dp.map((pkg) => pkg.name).join(PACKAGE_NAME_SEP)
  }

  /**
   * Gets the `public package name` without subpath from the `public package name` which may contains subpath.
   *
   * @param imported - The `public package name` which may contains subpath
   * @returns The `public package name` without subpath
   */
  getPublicPkgNameFromImported (imported: string) {
    const {
      CONSTANTS: { PACKAGE_NAME_SEP }
    } = this.context
    const pns = imported.split(PACKAGE_NAME_SEP)
    const last = pns.pop()!
    pns.push(this.getPkgName(last))
    return pns.join(PACKAGE_NAME_SEP)
  }

  /**
   * Gets the `package` from the parent `package` and the `public package name`.
   *
   * @param parent - The parent `package`
   * @param ppn - The `public package name`
   * @returns The target `package`
   */
  getPkgFromPublicPkgName (parent: PkgNode, ppn: string) {
    const {
      CONSTANTS: { PACKAGE_NAME_SEP }
    } = this.context
    return ppn
      .split(PACKAGE_NAME_SEP)
      .reduce((parent, pn) => parent.dependencies.find((pkg) => pkg.name === pn)!, parent)
  }

  /**
   * Gets the routes option from the `routes module` name.
   *
   * @param rmn - The `routes module` name
   * @returns The corresponding routes option
   */
  @cacheable
  getRoutesOption (rmn: string) {
    const {
      config: { routes },
      CONSTANTS: { ROUTES }
    } = this.context
    return routes[rmn.slice(ROUTES.length + 1)]
  }

  /**
   * Convert the `payload` to a string.
   *
   * @example
   * ```ts
   * const payload = { id: '/path/to/component', component: '/path/to/component' }
   * console.log(stringfy(payload, (key, value) => { if (key === 'component') { return `() => import('${value}')` } }))
   * // "{id:"/path/to/component",component:() => import('/path/to/component')}"
   * ```
   *
   * @param payload - The source to be stringfy
   * @param replacer - The optional function used to custom the convert process
   * @returns The result string
   */
  stringify (payload: any, replacer?: (key: string | number, value: any) => string | void): string {
    const type = typeof payload
    switch (type) {
      case 'object':
        const isArray = Array.isArray(payload)
        let content = (
          isArray
            ? payload.map(
                (value: any, index: number) => (replacer && replacer(index, value)) ?? this.stringify(value, replacer)
              )
            : Object.keys(payload).map(
                (key) => `${key}:${(replacer && replacer(key, payload[key])) ?? this.stringify(payload[key], replacer)}`
              )
        ).join(',')
        return (replacer && replacer('', payload)) ?? isArray ? `[${content}]` : `{${content}}`
      case 'function':
        return payload.toString()
      default:
        return JSON.stringify(payload)
    }
  }
}
