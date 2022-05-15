import { isAbsolute, resolve } from 'path'

import { normalizePath } from 'vite'
import autobind from 'autobind-decorator'

import { getDefault } from '../shared/utils'

import type { Context } from '@ugdu/processor'
import type { PkgNode, BaseRoute, MetaModule } from './project'

const cached = <T extends (this: Utils, string: string) => any>(origin: T) => {
  const u2cm: Map<Utils, Record<string, ReturnType<T>>> = new Map()
  const wrapper = function (string) {
    let cache = u2cm.get(this)
    if (!cache) {
      cache = Object.create(null)
      u2cm.set(this, cache!)
    }
    return cache![string] || (cache![string] = origin.call(this, string))
  } as T
  if (TEST) {
    // @ts-ignore
    wrapper.origin = origin
  }
  return wrapper
}

const cacheable = (_target: any, _key: string, descriptor: PropertyDescriptor) => {
  descriptor.value = cached(descriptor.value)
}

/**
 * A utils set.
 *
 * @remarks
 * Note that some of the methods are not available before the corresponding data is ready.
 * Such as `isPage(path)` needs to know the `context.project.routes` to decide whether the `path` is a `page`.
 *
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
   * Removes the `module` whose id is `mn` from `context.project.meta.cur.modules`.
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
   * Appends '/' to `str`. It will not append if the `str` already ends with '/'.
   *
   * @param str - The string to be appended
   * @returns The result string
   */
  @cacheable
  appendSlash (str: string) {
    return str.endsWith('/') ? str : `${str}/`
  }

  /**
   * Is the `path` a `page`.
   * `page` is a `module` which is imported by the `routes module` as a route.
   * Check {@link UserConfig.cwd} for what `path` is.
   *
   * @param path - The `path` to be test
   * @returns true if the `path` is a `page`
   */
  @cacheable
  isPage (path: string) {
    return this.getPages().includes(path)
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
    return mn === ROUTES
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
   * Gets the `path`s of all `page`s from {@link Project.routes}.
   *
   * @returns The `path`s of all `page`s
   */
  @cacheable
  getPages () {
    const {
      project: { routes }
    } = this.context
    const pages = []
    const queue: BaseRoute[] = [...routes]
    while (queue.length) {
      const br = queue.shift()!
      pages.push(br.id)
      if (br.children) {
        queue.push(...br.children)
      }
    }
    return pages
  }

  /**
   * Gets the `package` id.
   * The `package` id is the `package` name without `scope`.
   * For a `package` whose name doesn't have `scope`, its id will be the same as its name.
   *
   * @param pn - The `package` name
   * @returns The `package` id
   */
  @cacheable
  getPkgId (pn: string) {
    return pn.replace(/.+\//, '')
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
   * Gets the `local module` name from the `path`.
   *
   * @param path - The `path` we get `local module` name from
   * @returns the `local module` name of the `path` or null if there isn't a corresponding `module`
   */
  @cacheable
  getLocalModuleName (path: string) {
    const {
      config,
      project: {
        sources: { all }
      }
    } = this.context

    if (all.includes(path)) {
      const lp = this.getLocalPkgFromPath(path)
      const { main, name } = lp

      if (main) {
        if (this.getNormalizedPath(this.resolve(lp.path, main)) === path) {
          return name
        }
      } else {
        if (this.isPage(path) || config.extensions.includes(path.slice(path.lastIndexOf('.') + 1))) {
          return path.replace(lp.path, name)
        }
      }
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
   * Gets the `external` config for the `local module`.
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
      new RegExp(`^${ROUTES}$`)
    ]
  }

  /**
   * Gets the {@link MetaModule.externals} for the `vendor module` whose name is the `mn`.
   *
   * @param mn - The `vendor module` name
   * @returns The `externals` of the `vendor module`
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
   * Gets the {@link MetaModule} for the `module` whose name is the `mn`.
   *
   * @param mn - The `module` name
   * @returns The {@link MetaModule}
   */
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
   * Push the `mm` to the `meta.cur.modules`.
   *
   * @remarks
   * If the `meta.cur.modules` already contains a module whose `id` is the same as that of `mm`, the module will be assigned with the `mm`.
   *
   * @param mm - The {@link MetaModule}
   */
  addMetaModule (mm: MetaModule) {
    const origin = this.getMetaModule(mm.id)
    Object.assign(origin, mm)
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
    const pkg = pkgs.find((pkg) => normalizePath(mi).startsWith(this.appendSlash(pkg.ap)))
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
    const {
      CONSTANTS: { VERSIONED_VENDOR_SEP }
    } = this.context
    return `${pkg.name}${VERSIONED_VENDOR_SEP}${pkg.version}`
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
            if (!map.has(dep)) {
              queue.push(dep)
              map.set(dep, [...pre, dep])
            }
          }
        )
      }
    }
    if (!path.length && start !== end) {
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
  @cacheable
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
   * Gets the `module` name from the parent `package` and the `public package name`.
   *
   * @param parent - The parent `package`
   * @param ppn - The `public package name`
   * @returns The target `module` name
   */
  getModuleNameFromPublicPkgName (parent: PkgNode, ppn: string) {
    const pkg = this.getPkgFromPublicPkgName(parent, ppn)
    return pkg.local ? pkg.name : this.getVersionedPkgName(pkg)
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
        if (payload === null) return 'null'
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
