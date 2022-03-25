import { readFile } from 'fs/promises'
import { resolve } from 'path'

import fg from 'fast-glob'
import dh from 'dependencies-hierarchy'
import fwp from '@pnpm/find-workspace-packages'
import axios from 'axios'
import { execa } from 'execa'
import { normalizePath } from 'vite'
import { parallel, series, TaskOptions } from '@ugdu/processor'

import { cached, clone, getDefault } from '../shared/utils'
import { setConstants } from './constants'
import { setConfig } from './config'
import { setUtils } from './utils'

import type { Promisable } from 'type-fest'
import type { PackageNode } from 'dependencies-hierarchy'
import type { AliasOptions } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * The information of your project.
 *
 * @public
 */
export interface Project {
  /**
   * The alias config used when building.
   */
  alias: AliasOptions
  /**
   * All `package`s including `local package`s and `vendor package`s in your project.
   */
  pkgs: PkgNode[]
  /**
   * The information of the building.
   */
  meta: {
    pre: Meta
    cur: Meta
  }
  /**
   * The information of your source files.
   */
  sources: Sources
  /**
   * A `routes module` name to `routes module` information map.
   */
  routes: BaseRoute[]
}

/**
 * @public
 */
export interface PkgNode {
  name: string
  version: string
  /**
   * The `path` of the folder for this package.
   * Check {@link UserConfig.cwd} for what `path` is.
   *
   * @remarks
   * For `local package`s, the folder is the package's folder.
   * For `vendor package`s, the folder has a subfolder named 'node_modules' which contains the package's folder.
   */
  path: string
  /**
   * The absolute path of the folder for this package.
   */
  ap: string
  /**
   * Is this package a `local package`.
   */
  local: boolean
  /**
   * The `main` field of this package.
   */
  main?: string
  /**
   * Packages which depend on this package.
   */
  dependents: PkgNode[]
  /**
   * This package's dependencies.
   */
  dependencies: PkgNode[]
}

/**
 * @internal
 */
export type LocalPkgToDepsMap = Map<PkgNode, PackageNode[]>

/**
 * The build information.
 *
 * @public
 */
export interface Meta {
  /**
   * All `module`s in this project.
   */
  modules: MetaModule[]
  hash?: string
  version?: string
}

/**
 * The information of a `module`.
 *
 * @remarks
 * There are three types `module` in our project.
 *
 * First is `local module`.
 * `local module` comes from `local package`.
 * For a `local package` which have `main` field, the corresponding file of `main` is a `local module`, and the other files will be bundled into this module.
 * For other `local package`s, all files with extension in {@link UserConfig.extensions} are considered to be a `local module`.
 *
 * Second is `vendor module`.
 * `vendor module` comes from `vendor package`.
 * Only `vendor package`s imported by multiple `module`s or `local module` have a corresponding `vendor module`.
 * The other `vendor package`s will be bundled into the `vendor module` which import them.
 *
 * Last is `routes module`.
 * `routes module` is generated according to the structure of your project.
 *
 * @public
 */
export interface MetaModule {
  /**
   * The module name.
   * There are three types of module names.
   * First is `local module` name.
   * Such as `@pkg/components`, `@pkg/sale/src/pages/order/index.vue`
   * Second is `routes module` name.
   * Such as `routes/v2`
   * Last is `vendor module` name.
   * Such as `lodash@4.17.21`
   * Here the `vendor module` name actually is versioned vendor package name.
   */
  id: string
  /**
   * The generated js file url.
   */
  js: string
  /**
   * The generated css file url. This field may not exist if this module doesn't have any css.
   */
  css?: string
  /**
   * The static resources this module depends. Such as css, img etc.
   * Only local modules have this field when it does depend any static resources.
   */
  sources?: string[]
  /**
   * All public package names this module may depends.
   * A vendor module will not be rebuilt unless one of it's externals and exports changed.
   * Only vendor modules have this field.
   */
  externals?: string[]
  /**
   * The import info of this module include from which package and import what.
   */
  imports: MetaModuleImport[]
  /**
   * The exported variable names.
   * Used to check if there is any error in the local modules build.
   * Only local modules have this field.
   */
  exports?: string[]
}

/**
 * @public
 */
export interface MetaModuleImport {
  /**
   * The module name.
   */
  id: string
  /**
   * The public package name.
   */
  name: string
  /**
   * The bindings that the parent module import.
   */
  bindings: string[]
}

/**
 * @public
 */
export interface Sources {
  all: string[]
  changed: ChangedSource[]
}

/**
 * @public
 */
export interface ChangedSource {
  status: 'A' | 'M' | 'D'
  path: string
}

/**
 * Used to generate the code of the `routes module`.
 *
 * @public
 */
export interface BaseRoute {
  /**
   * The file path relative to {@link UserConfig.cwd}.
   */
  id: string
  path: string
  name: string
  /**
   * The file path relative to {@link UserConfig.cwd}. In the generated code, this field will be something like '() =\> import("/path/to/this/component")'.
   */
  component: string
  children?: BaseRoute[]
}

const getLocalPkgs = async (cwd: string) =>
  (await getDefault(fwp)(cwd)).slice(1).map(
    (pkg) => {
      const {
        manifest: { name, main, version },
        dir
      } = pkg
      if (!name) throw new Error(`The package at '${pkg.dir}' doesn't specified the 'name' field.`)
      if (!version) throw new Error(`The package at '${pkg.dir}' doesn't specified the 'version' field.`)
      const ap = normalizePath(dir)
      return {
        name,
        version,
        path: ap.slice(cwd.length + 1),
        ap,
        local: true,
        main,
        dependents: [],
        dependencies: []
      } as PkgNode
    }
  )

const getLocalPkgToDepsMap = async (localPkgs: PkgNode[], cwd: string) =>
  getDefault(dh)(
    localPkgs.map((lp) => lp.ap),
    {
      depth: Infinity,
      include: { dependencies: true, devDependencies: false, optionalDependencies: false },
      lockfileDir: cwd
    }
  ).then(
    (pd2dhm) => {
      const lp2dm: LocalPkgToDepsMap = new Map()
      for (const pd of Object.keys(pd2dhm)) {
        lp2dm.set(localPkgs.find((lp) => lp.ap === pd)!, pd2dhm[pd].dependencies!)
      }
      return lp2dm
    }
  )

/**
 * @internal
 */
export const getPkgId = cached((lpn) => lpn.replace(/.+\//, ''))

/**
 * @internal
 */
export const getAliasKey = cached((lpn) => `@${getPkgId(lpn)}`)

const getAlias = (localPkgs: PkgNode[], context: Context) => {
  const {
    utils: { getPkgId }
  } = context
  const alias: AliasOptions = {}
  localPkgs.forEach((lp) => (alias[`@${getPkgId(lp.name)}`] = resolve(lp.ap, 'src')))
  if (Object.keys(alias).length < localPkgs.length) {
    throw new Error(`There are duplicate pkg id in local packages.`)
  }
  return alias
}

/**
 * @internal
 */
export const getPkgs = (localPkgToDepsMap: LocalPkgToDepsMap, cwd: string) => {
  const localPkgs = [...localPkgToDepsMap.keys()]
  const pkgs = [...localPkgs]
  const traverse = (deps: PackageNode[], dependent: PkgNode, pp: string) => {
    deps.forEach(
      (dep) => {
        let pkg = findPkgFromDep(dep)
        if (!pkg) {
          const ap = normalizePath(dep.path).replace(pp, cwd)
          pkg = {
            name: dep.name,
            version: dep.version,
            path: ap.slice(cwd.length + 1),
            ap,
            local: false,
            dependencies: [],
            dependents: []
          }
          pkgs.push(pkg)
          dep.dependencies && traverse(dep.dependencies, pkg, pp)
        }
        pkg.dependents.push(dependent)
        dependent.dependencies.push(pkg)
      }
    )
  }
  const findPkgFromDep = (dep: PackageNode) =>
    pkgs.find((pkg) => pkg.name === dep.name && (isLocalPkg(pkg) || pkg.version === dep.version))
  const isLocalPkg = (n: PkgNode) => localPkgs.find((lp) => lp.name === n.name)
  for (const localPkg of localPkgToDepsMap.keys()) {
    traverse(localPkgToDepsMap.get(localPkg)!, localPkg, localPkg.ap)
  }
  return pkgs
}

const getAllPkgs = async (localPkgs: PkgNode[], cwd: string) => {
  const localPkgToDepsMap = await getLocalPkgToDepsMap(localPkgs, cwd)
  const pkgs = getPkgs(localPkgToDepsMap, cwd)
  return pkgs
}

const getPreMeta = async (context: Context) => {
  let meta: Meta
  const {
    CONSTANTS: { META_JSON },
    config,
    config: { cwd, dist }
  } = context
  try {
    if (config.meta === 'local') {
      meta = JSON.parse(await readFile(resolve(cwd, dist, META_JSON), 'utf-8'))
    } else {
      meta = await axios.get(`${config.meta}${META_JSON}`).then((res) => res.data)
    }
  } catch (error) {
    meta = { modules: [] }
  }
  // meta.json maybe empty
  meta.modules = meta.modules || []
  return meta
}

const getCurMeta = async (context: Context) => {
  const {
    project: {
      meta: { pre }
    },
    config: { cwd }
  } = context
  const cur: Meta = { modules: [] }
  const { stdout } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd })
  cur.hash = stdout
  cur.version = VERSION
  cur.modules = clone(pre.modules.filter((m) => !m.externals))
  return cur
}

const getSources = async (context: Context) => {
  const {
    config: { cwd },
    project: {
      pkgs,
      meta: { pre }
    }
  } = context
  const all = await fg(
    pkgs.filter((pkg) => pkg.local).map((lp) => lp.path + '/**'),
    {
      cwd,
      ignore: ['**/node_modules/**']
    }
  )
  let changed: ChangedSource[] = []
  if (pre.hash && pre.version === VERSION) {
    const { stdout } = await execa('git', ['diff', pre.hash, 'HEAD', '--name-status'], { cwd })
    changed = stdout
      .split('\n')
      .map(
        (info) => {
          const [status, path] = info.split('\t')
          return { status, path } as ChangedSource
        }
      )
      .filter(({ path }) => all.includes(path))
  } else {
    changed = all.map(
      (path) => {
        return { status: 'A', path }
      }
    )
  }
  return { all, changed }
}

const getRoutes = async (context: Context) => {
  const {
    CONSTANTS: { ROOT, INDEX },
    utils: { appendSlash, getLocalPkgs, getPkgId }
  } = context
  const routes: BaseRoute[] = []

  await Promise.all(
    getLocalPkgs()
      .filter((lp) => !lp.main)
      .map(
        async (lp) => {
          const pp = `${lp.path}/src/pages`
          const pi = getPkgId(lp.name)
          const paths = await fg(`${pp}/**/*`)
          const brs = paths.map(
            (path) => {
              const br: BaseRoute = {
                id: path,
                path: path
                  .replace(pp, '/' + pi)
                  .replace(/\.[^\.]+$/, '')
                  .replace(/(?<=\/)\[(.+?)\](?=(\/|$))/g, ':$1')
                  .replace(new RegExp(`^(/${pi})\\1$`), '$1'),
                name: '',
                component: path
              }
              return br
            }
          )
          const insert = (target: BaseRoute, list: BaseRoute[]) => {
            for (let i = 0; i < list.length; i++) {
              const current = list[i]
              if (target.path.startsWith(appendSlash(current.path))) {
                current.children = current.children || []
                insert(target, current.children)
                return
              } else if (current.path.startsWith(appendSlash(target.path))) {
                target.children = []
                list.splice(i, 1, target)
                insert(current, target.children)
                return
              }
            }
            list.push(target)
          }
          const sub: BaseRoute[] = []
          brs.forEach((br) => insert(br, sub))
          if (pi === ROOT) {
            brs.forEach((br) => (br.path = br.path.replace(new RegExp(`^/${ROOT}`), '')))
          }
          brs.forEach(
            (br) => {
              br.path = br.path.replace(new RegExp(`/${INDEX}$`), '')
              br.name = br.path.slice(1).replace(/\//g, '-')
            }
          )
          routes.push(...sub)
        }
      )
  )

  return routes
}

/**
 * @public
 */
export interface SetProjectHooks {
  'get-local-packages'(cwd: string): Promisable<PkgNode[]>
  'get-alias'(localPkgs: PkgNode[], context: Context): Promisable<AliasOptions>
  'get-all-packages'(localPkgs: PkgNode[], cwd: string): Promisable<PkgNode[]>
  'get-previous-meta'(context: Context): Promisable<Meta>
  'get-current-meta'(context: Context): Promisable<Meta>
  'get-sources'(context: Context): Promisable<Sources>
  'get-routes'(context: Context): Promisable<BaseRoute[]>
}

/**
 * @public
 */
export const setProject = series(
  parallel(setConstants, setConfig, setUtils),
  new TaskOptions<SetProjectHooks>(
    async function () {
      const {
        manager: {
          context,
          context: {
            config: { cwd }
          }
        }
      } = this
      const project = { meta: {} } as Project
      context.project = project
      const localPkgs = await this.call('get-local-packages', 'first', cwd)
      project.alias = await this.call('get-alias', 'first', localPkgs, context)
      project.pkgs = await this.call('get-all-packages', 'first', localPkgs, cwd)
      project.meta.pre = await this.call('get-previous-meta', 'first', context)
      project.meta.cur = await this.call('get-current-meta', 'first', context)
      project.sources = await this.call('get-sources', 'first', context)
      project.routes = await this.call('get-routes', 'first', context)
    },
    [
      'get-local-packages',
      'get-alias',
      'get-all-packages',
      'get-previous-meta',
      'get-current-meta',
      'get-sources',
      'get-routes'
    ],
    {
      'get-local-packages': getLocalPkgs,
      'get-alias': getAlias,
      'get-all-packages': getAllPkgs,
      'get-previous-meta': getPreMeta,
      'get-current-meta': getCurMeta,
      'get-sources': getSources,
      'get-routes': getRoutes
    }
  )
)
