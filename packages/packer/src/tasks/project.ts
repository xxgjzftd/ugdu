import { readFile } from 'fs/promises'
import { resolve } from 'path'

import fg from 'fast-glob'
import { buildDependenciesHierarchy } from '@pnpm/reviewing.dependencies-hierarchy'
import { findWorkspacePackages } from '@pnpm/find-workspace-packages'
import axios from 'axios'
import { execa } from 'execa'
import { normalizePath } from 'vite'
import { parallel, series, TaskOptions } from '@ugdu/processor'

import { setConstants } from './constants'
import { setConfig } from './config'
import { Utils } from './utils'

import type { Promisable } from 'type-fest'
import type { PackageNode } from '@pnpm/reviewing.dependencies-hierarchy'
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
   *
   * @remarks
   * By default, this field is generated accroding to the `local package`s of your project.
   * The rule is something like:
   * ```ts
   * const alias: AliasOptions = {}
   * localPkgs.forEach((lp) => (alias[`@${getPkgId(lp.name)}`] = resolve(lp.ap, 'src')))
   * ```
   *
   * Suppose your `local package`s are:
   * ```ts
   * [{ name: '@xx/pkg0', ap: '/path/to/pkg0' }, { name: '@xx/pkg1', ap: '/path/to/pkg1' }, { name: '@xx/pkg2', ap: '/path/to/pkg2' }]
   * ```
   * Then the `alias` will be:
   * ```ts
   * { '@pkg0': '/path/to/pkg0/src', '@pkg1': '/path/to/pkg1/src', '@pkg2': '/path/to/pkg2/src' }
   * ```
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
    /**
     * The information of the previous building.
     */
    pre: Meta
    /**
     * The information of the current building.
     */
    cur: Meta
  }
  /**
   * The information of your source files.
   */
  sources: Sources
  /**
   * Used to generate the code of the `routes module`.
   *
   * @remarks
   * By default, this field will be generated according to your project structure.
   * Files in `src/pages` of `local package`s will be considered to be `page`s.
   * A `page` corresponds to a `BaseRoute`.
   * For its path, we need replace the `${local package path}/src/pages` with {@link Utils.getPkgId | `package` id} and then remove the file extension.
   * For dynamic routes, you should name your file within [].
   * For nested routes, you should put the children pages in the folder which has the same name with the parent page.
   * If there is a file named `index`, the generated path will remove it automaticly.
   * If there is a file whose name is the same as the {@link Utils.getPkgId | `package` id}, and it's located at the root of the `src/pages`, then it will be the parent page of the other pages in this package.
   * If there is a package whose id is `root`, we will remove the `root` from the generated path. You may need to put the pages which is no need to make a package in this package. Such as `/login`, `/welcom` etc.
   *
   * @example
   * Suppose we have the following structure:
   * ```
   * - packages/
   *   - foo/
   *     - package.json
   *     - src/
   *       - pages/
   *         - xx.vue
   *         - yy.vue
   *         - xx/
   *           - zz.vue
   *   - bar/
   *     - package.json
   *     - src/
   *       - pages/
   *         - bar.vue
   *         - xx/
   *           - index.vue
   *           - [id].vue
   *   - root/
   *     - package.json
   *     - src/
   *       - pages/
   *         - index.vue
   *         - login.vue
   * ```
   *
   * The generated `routes` module will be something like:
   * ```
   * [
   *   {
   *     path: '/foo/xx',
   *     component: 'packages/foo/src/pages/xx.vue',
   *     children: [
   *       {
   *         path: '/foo/xx/zz',
   *         component: 'packages/foo/src/pages/xx/zz.vue'
   *       }
   *     ]
   *   },
   *   {
   *     path: '/foo/yy',
   *     component: 'packages/foo/src/pages/yy.vue'
   *   },
   *   {
   *     path: '/bar',
   *     component: 'packages/bar/src/pages/bar.vue',
   *     children: [
   *       {
   *         path: '/bar/xx',
   *         component: 'packages/bar/src/pages/xx/index.vue'
   *       },
   *       {
   *         path: '/bar/xx/:id',
   *         component: 'packages/bar/src/pages/xx/[id].vue'
   *       }
   *     ]
   *   },
   *   {
   *     path: '/',
   *     component: 'packages/root/src/pages/index.vue'
   *   },
   *   {
   *     path: '/login',
   *     component: 'packages/root/src/pages/login.vue'
   *   }
   * ]
   * ```
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
   * All `module`s in this build.
   */
  modules: MetaModule[]
  /**
   * The `path`s of all `page`s in this build.
   */
  pages: string[]
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
   *
   * First is `local module` name.
   * Such as `@pkg/components`, `@pkg/sale/src/pages/order/index.vue`.
   *
   * Second is `routes module` name(i.e.`routes`).
   *
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
   * All `public package name`s this module may depends.
   * A vendor module will not be rebuilt unless one of it's externals and exports changed.
   * Only vendor modules have this field.
   * This filed will be an empty array if this module does not have any externals.
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
  /**
   * The sub module info of this module.
   * This field is only available in case of other `module`s import `*` from this module's sub modules.
   */
  subs?: MetaModuleSub[]
}

/**
 * The information of a `module`'s import.
 *
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
 * The information of a `module`'s sub module.
 *
 * @public
 */
export interface MetaModuleSub {
  /**
   * The subpath of this sub module.
   */
  subpath: string
  /**
   * The corresponding js file url.
   */
  js: string
}

/**
 * @public
 */
export interface Sources {
  /**
   * All `path`s of your source files should be built.
   *
   * @remarks
   * We will try to generate a corresponding `local module` for each file in this array(if the file does have a corresponding `local module`).
   */
  all: string[]
  /**
   * The `path` and status of your source files which changed since last build.
   *
   * @remarks
   * This array may include the files which are not in `all` array.
   */
  changed: ChangedSource[]
}

/**
 * @public
 */
export interface ChangedSource {
  /**
   * 'A' means the file is added.
   * 'M' means the file is modified.
   * 'D' means the file is deleted.
   */
  status: 'A' | 'M' | 'D'
  /**
   * The `path` of the source file.
   */
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

const getLocalPkgs = async (cwd: string) => {
  const fwps = await findWorkspacePackages(cwd)
  return fwps.slice(1).map(
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
    meta = { modules: [], pages: [] }
  }
  // meta.json maybe empty
  meta.modules = meta.modules || []
  meta.pages = meta.pages || []
  return meta
}

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

const getLocalPkgToDepsMap = async (localPkgs: PkgNode[], cwd: string) => {
  const pd2dhm = await buildDependenciesHierarchy(
    localPkgs.map((lp) => lp.ap),
    {
      depth: Infinity,
      include: { dependencies: true, devDependencies: false, optionalDependencies: false },
      lockfileDir: cwd,
      virtualStoreDirMaxLength: Infinity
    }
  )
  const lp2dm: LocalPkgToDepsMap = new Map()
  for (const pd of Object.keys(pd2dhm)) {
    lp2dm.set(localPkgs.find((lp) => lp.ap === pd)!, pd2dhm[pd].dependencies ?? [])
  }
  return lp2dm
}

const getAllPkgs = async (localPkgs: PkgNode[], cwd: string) => {
  const localPkgToDepsMap = await getLocalPkgToDepsMap(localPkgs, cwd)
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
  const isLocalPkg = (pkg: PkgNode) => localPkgs.find((lp) => lp.name === pkg.name)
  for (const localPkg of localPkgToDepsMap.keys()) {
    traverse(localPkgToDepsMap.get(localPkg)!, localPkg, localPkg.ap)
  }
  return pkgs
}

const getSources = async (context: Context) => {
  const {
    config: { cwd },
    project: {
      meta: { pre }
    },
    utils: { getLocalPkgPaths }
  } = context
  const all = await fg(
    getLocalPkgPaths().map((lpp) => lpp + '/**'),
    { cwd, ignore: ['**/node_modules/**'] }
  )
  let changed: ChangedSource[] = []
  if (pre.hash && pre.version === VERSION) {
    const { stdout = '' } = await execa('git', ['diff', pre.hash, 'HEAD', '--name-status'], { cwd })
    for (const info of stdout.split('\n')) {
      const [status, path] = info.split('\t')
      changed.push({ status, path } as ChangedSource)
    }
  } else {
    changed = all.map((path) => ({ status: 'A', path }))
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
            brs.forEach((br) => (br.path = br.path.replace(new RegExp(`^/${ROOT}/?`), '/')))
          }
          brs.forEach(
            (br) => {
              br.path = br.path.replace(new RegExp(`/${INDEX}$`), '')
              br.name = br.path.slice(1).replace(/\/:?/g, '-')
              if (br.path === '') {
                br.path = '/'
                br.name = ROOT
              }
            }
          )
          routes.push(...sub)
        }
      )
  )

  return routes
}

const getCurMeta = async (context: Context) => {
  const {
    config: { cwd }
  } = context
  try {
    const { stdout } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    const cur: Meta = {
      hash: stdout,
      version: VERSION,
      modules: [],
      pages: []
    }
    return cur
  } catch (e) {
    throw Error('no .git')
  }
}

/**
 * @public
 */
export interface SetProjectHooks {
  /**
   * A `first` type hook. Its first non null return value will be used as `local package`s.
   */
  'get-local-packages'(cwd: string): Promisable<PkgNode[]>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.meta.pre}.
   */
  'get-previous-meta'(context: Context): Promisable<Meta>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.alias}.
   */
  'get-alias'(localPkgs: PkgNode[], context: Context): Promisable<AliasOptions>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.pkgs}.
   */
  'get-all-packages'(localPkgs: PkgNode[], cwd: string): Promisable<PkgNode[]>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.sources}.
   */
  'get-sources'(context: Context): Promisable<Sources>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.routes}.
   */
  'get-routes'(context: Context): Promisable<BaseRoute[]>
  /**
   * A `first` type hook. Its first non null return value will be used as {@link Project.meta.cur}.
   */
  'get-current-meta'(context: Context): Promisable<Meta>
}

/**
 * Sets the project related data to `context.project`.
 *
 * @remarks
 * By default, for every hook in this task, we have a preset `hook fn`.
 * If any `hook fn` doesn't meet your needs, you can use your own `hook fn`s by invoking `task.prepend(name, fn)`.
 *
 * @public
 */
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
      context.utils = new Utils(context)
      const localPkgs = await this.call('get-local-packages', 'first', cwd)
      project.meta.pre = await this.call('get-previous-meta', 'first', context)
      project.alias = await this.call('get-alias', 'first', localPkgs, context)
      project.pkgs = await this.call('get-all-packages', 'first', localPkgs, cwd)
      project.sources = await this.call('get-sources', 'first', context)
      project.routes = await this.call('get-routes', 'first', context)
      project.meta.cur = await this.call('get-current-meta', 'first', context)
    },
    [
      'get-local-packages',
      'get-previous-meta',
      'get-alias',
      'get-all-packages',
      'get-sources',
      'get-routes',
      'get-current-meta'
    ],
    {
      'get-local-packages': getLocalPkgs,
      'get-previous-meta': getPreMeta,
      'get-alias': getAlias,
      'get-all-packages': getAllPkgs,
      'get-sources': getSources,
      'get-routes': getRoutes,
      'get-current-meta': getCurMeta
    }
  )
)
