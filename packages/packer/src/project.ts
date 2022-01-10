import { readFile } from 'fs/promises'
import { resolve } from 'path'

import fg from 'fast-glob'
import dh from 'dependencies-hierarchy'
import fwp from '@pnpm/find-workspace-packages'
import axios from 'axios'
import { execa } from 'execa'
import { parallel, series, TaskOptions } from '@ugdu/processor'

import { cached, getDefault } from './shared'
import { setConstants } from './constants'
import { setConfig } from './config'

import type { Promisable } from 'type-fest'
import type { PackageNode } from 'dependencies-hierarchy'
import type { AliasOptions } from 'vite'
import type { Context } from '@ugdu/processor'

export interface Project {
  alias: AliasOptions
  pkgs: PkgNode[]
  meta: {
    pre: Meta
    cur: Meta
  }
  sources: Sources
  routes: RoutesModuleNameToPathsMap
}

export interface PkgNode {
  name: string
  version: string
  path: string
  local: boolean
  main?: string
  dependents: PkgNode[]
  dependencies: PkgNode[]
}

export type LocalPkgToDepsMap = Map<PkgNode, PackageNode[]>

export interface Meta {
  modules: MetaModule[]
  hash?: string
  version?: string
}

export interface MetaModule {
  /**
   * The module name.
   * There are three types of module names.
   * First is `local module name`.
   * Such as `@pkg/components`, `@pkg/sale/src/pages/order/index.vue`
   * Second is `routes module name`.
   * Such as `routes/v2`
   * Last is `vendor module name`.
   * Such as `lodash@4.17.21`
   * Here the `vendor module name` actually is `versioned vendor package name`.
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

export interface Sources {
  all: string[]
  changed: ChangedSource[]
}

export interface ChangedSource {
  status: 'A' | 'M' | 'D'
  path: string
}

export type RoutesModuleNameToPathsMap = Record<string, string[]>

const getLocalPkgs = async (cwd: string) =>
  (await getDefault(fwp)(cwd)).slice(1).map(
    (pkg) => {
      const {
        manifest: { name, main, version },
        dir
      } = pkg
      if (!name) throw new Error(`The package at '${pkg.dir}' doesn't specified the 'name' field.`)
      if (!version) throw new Error(`The package at '${pkg.dir}' doesn't specified the 'version' field.`)
      return {
        name,
        version,
        path: dir,
        local: true,
        main,
        dependents: [],
        dependencies: []
      } as PkgNode
    }
  )

const getLocalPkgToDepsMap = async (localPkgs: PkgNode[], cwd: string) =>
  getDefault(dh)(
    localPkgs.map((lp) => lp.path),
    {
      depth: Infinity,
      include: { dependencies: true, devDependencies: false, optionalDependencies: false },
      lockfileDir: cwd
    }
  ).then(
    (pd2dhm) => {
      const lp2dm: LocalPkgToDepsMap = new Map()
      for (const pd of Object.keys(pd2dhm)) {
        lp2dm.set(localPkgs.find((lp) => lp.path === pd)!, pd2dhm[pd].dependencies!)
      }
      return lp2dm
    }
  )

export const getPkgId = cached((lpn) => lpn.replace(/.+\//, ''))

export const getAliasKey = cached((lpn) => `@${getPkgId(lpn)}`)

const getAlias = (localPkgs: PkgNode[]) => {
  const alias: AliasOptions = {}
  localPkgs.forEach((lp) => (alias[getAliasKey(lp.name)] = `${lp.path}/src`))
  if (Object.keys(alias).length < localPkgs.length) {
    throw new Error(`There are duplicate pkg id in local packages.`)
  }
  return alias
}

export const getPkgs = (localPkgToDepsMap: LocalPkgToDepsMap, cwd: string) => {
  const localPkgs = [...localPkgToDepsMap.keys()]
  const pkgs = [...localPkgs]
  const traverse = (deps: PackageNode[], dependent: PkgNode, pp: string) => {
    deps.forEach(
      (dep) => {
        let pkg = findPkgFromDep(dep)
        if (!pkg) {
          pkg = {
            name: dep.name,
            version: dep.version,
            path: dep.path.replace(pp, cwd),
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
    traverse(localPkgToDepsMap.get(localPkg)!, localPkg, localPkg.path)
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
  cur.modules = pre.modules.filter((m) => !m.externals)
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
    pkgs.filter((pkg) => pkg.local).map((lp) => lp.path.replace(cwd + '/', '') + '/**'),
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

const getRoutesModuleNameToPathsMap = (context: Context) => {
  const {
    config,
    CONSTANTS: { ROUTES }
  } = context
  const rmn2pm: RoutesModuleNameToPathsMap = {}
  if (config.routes) {
    Object.keys(config.routes).forEach(
      (subpath) => {
        rmn2pm[`${ROUTES}/${subpath}`] = fg.sync(config.routes![subpath].patterns)
      }
    )
  }
  return rmn2pm
}

export interface SetProjectHooks {
  'get-local-packages'(cwd: string): Promisable<PkgNode[]>
  'get-alias'(localPkgs: PkgNode[]): Promisable<AliasOptions>
  'get-all-packages'(localPkgs: PkgNode[], cwd: string): Promisable<PkgNode[]>
  'get-previous-meta'(context: Context): Promisable<Meta>
  'get-current-meta'(context: Context): Promisable<Meta>
  'get-sources'(context: Context): Promisable<Sources>
  'get-routes'(context: Context): Promisable<RoutesModuleNameToPathsMap>
}

export const setProject = series(
  parallel(setConstants, setConfig),
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
      project.alias = await this.call('get-alias', 'first', localPkgs)
      project.pkgs = await this.call('get-all-packages', 'first', localPkgs, cwd)
      project.meta.pre = await this.call('get-previous-meta', 'first', context)
      project.meta.cur = await this.call('get-current-meta', 'first', context)
      project.sources = await this.call('get-sources', 'first', context)
      project.routes = await this.call('get-routes', 'first', context)
    },
    {
      'get-local-packages': getLocalPkgs,
      'get-alias': getAlias,
      'get-all-packages': getAllPkgs,
      'get-previous-meta': getPreMeta,
      'get-current-meta': getCurMeta,
      'get-sources': getSources,
      'get-routes': getRoutesModuleNameToPathsMap
    }
  )
)
