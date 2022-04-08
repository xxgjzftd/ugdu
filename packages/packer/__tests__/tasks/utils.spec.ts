import { resolve } from 'path'

import { Processor } from '@ugdu/processor'

import { setContext } from '../../src/tasks/context'

import { resolveSourceAbsolutePath, resolveSourcePath, setVirtualProject } from '../../__mocks__/utils'

import type { UserConfig } from '../../src/tasks/config'
import type { Utils } from '../../src/tasks/utils'

const cwd = '/path/to/project'
const config: UserConfig = {
  cwd,
  apps: [],
  extensions: ['ts', 'vue'],
  meta: 'local'
}

const plain = { name: 'plain' }
const dv1 = { name: 'different-version', version: '1.0.0' }
const dv2 = { name: 'different-version', version: '2.0.0' }
const multiplePkgsDependOn = { name: 'multiple-pkgs-depend-on' }
const onlyAVendorPkgDependOn = { name: 'only-a-vendor-pkg-depend-on' }
const onlyALocalPkgDependOn = {
  name: 'only-a-local-pkg-depend-on'
}
const chain = { name: 'chain', dependencies: [dv1, multiplePkgsDependOn] }
const circle = {
  name: 'circle-a',
  dependencies: [
    dv2,
    onlyAVendorPkgDependOn,
    multiplePkgsDependOn,
    chain,
    { name: 'circle-b', dependencies: [{ name: 'circle-a' }] }
  ]
}

const entry = {
  name: 'entry',
  main: 'src/index.ts',
  sources: ['src/index.ts', 'src/app.vue']
}
const foo = {
  name: 'foo',
  dependencies: [plain, dv1],
  sources: [
    'src/pages/xx.vue',
    'src/pages/yy.vue',
    'src/pages/xx/zz.vue',
    'src/components/button.vue',
    'src/assets/xx.png'
  ]
}
const bar = {
  name: 'bar',
  dependencies: [plain, dv2],
  sources: ['src/pages/bar.vue', 'src/pages/xx/index.vue', 'src/pages/xx/[id].vue']
}
const baz = {
  name: 'baz',
  main: 'src/index.ts',
  sources: ['src/index.ts', 'src/utils.ts']
}
const root = {
  name: 'root',
  dependencies: [onlyALocalPkgDependOn, circle],
  sources: ['src/pages/index.vue', 'src/pages/login.vue']
}

const lps = [entry, foo, bar, baz, root]
setVirtualProject(lps, cwd)

const processor = new Processor()
const task = processor.task(setContext)
task.hook('get-config', () => config)

let utils: Utils

beforeAll(() => task.run().then(() => (utils = task.manager.context.utils)))

const getPkg = (name: string, version = '1.0.0') =>
  task.manager.context.project.pkgs.find((pkg) => pkg.name === name && pkg.version === version)!

const shouldBeCachable = (methodName: keyof Utils, expected: any, key?: string) => {
  // @ts-ignore
  const fn = jest.spyOn(Reflect.getPrototypeOf(utils)[methodName], 'origin')
  for (let i = 0; i < 2; i++) {
    // @ts-ignore
    expect(utils[methodName](key)).toEqual(expected)
  }
  expect(fn.mock.calls.length).toBeLessThanOrEqual(1)
}

describe('The resolve method', () => {
  it('should resolve the args with config.cwd', () => {
    expect(utils.resolve('foo', 'src')).toBe(resolve(cwd, 'foo/src'))
  })
})

describe('The remove method', () => {
  it('should remove the module whose id is the given mn from project.meta.cur.modules', () => {
    const modules = task.manager.context.project.meta.cur.modules

    const toBeRemoved = { id: 'to-be-removed', js: '', imports: [] }
    modules.push(toBeRemoved)
    expect(modules.includes(toBeRemoved)).toBe(true)

    utils.remove(toBeRemoved.id)
    expect(modules.includes(toBeRemoved)).toBe(false)
  })
})

describe('The appendSlash method', () => {
  it('should append slash to the given path', () => {
    expect(utils.appendSlash('foo')).toBe('foo/')
  })

  it('should return the given path if it ends with slash', () => {
    expect(utils.appendSlash('foo/')).toBe('foo/')
  })

  it('should be cachable', () => {
    shouldBeCachable('appendSlash', 'bar/', 'bar')
  })
})

describe('The isPage method', () => {
  it('should return whether the given path is a page', () => {
    expect(utils.isPage(resolveSourcePath('foo', 'src/pages/xx.vue'))).toBe(true)
    expect(utils.isPage(resolveSourcePath('foo', 'src/components/button.vue'))).toBe(false)
  })

  it('should be cachable', () => {
    shouldBeCachable('isPage', true, resolveSourcePath('foo', 'src/pages/yy.vue'))
  })
})

describe('The isLocalPkg method', () => {
  it('should return whether the given module name is a local package name', () => {
    expect(utils.isLocalPkg('baz')).toBe(true)
    expect(utils.isLocalPkg('foo/src/pages/xx.vue')).toBe(false)
  })

  it('should be cachable', () => {
    shouldBeCachable('isLocalPkg', true, 'baz')
  })
})

describe('The isLocalModule method', () => {
  it('should return whether the given module name is a local module name', () => {
    expect(utils.isLocalModule('baz')).toBe(true)
    expect(utils.isLocalModule('foo/src/pages/xx.vue')).toBe(true)
    expect(utils.isLocalModule('plain@1.0.0')).toBe(false)
  })

  it('should be cachable', () => {
    shouldBeCachable('isLocalModule', true, 'baz')
  })
})

describe('The isRoutesModule method', () => {
  it('should return whether the given module name is a routes module name', () => {
    expect(utils.isRoutesModule('baz')).toBe(false)
    expect(utils.isRoutesModule('foo/src/pages/xx.vue')).toBe(false)
    expect(utils.isRoutesModule(task.manager.context.CONSTANTS.ROUTES)).toBe(true)
  })

  it('should be cachable', () => {
    shouldBeCachable('isRoutesModule', true, task.manager.context.CONSTANTS.ROUTES)
  })
})

describe('The isVendorModule method', () => {
  it('should return whether the given module name is a vendor module name', () => {
    expect(utils.isVendorModule('baz')).toBe(false)
    expect(utils.isVendorModule('foo/src/pages/xx.vue')).toBe(false)
    expect(utils.isVendorModule('plain@1.0.0')).toBe(true)
  })

  it('should be cachable', () => {
    shouldBeCachable('isVendorModule', false, 'baz')
  })
})

describe('The isBareSpecifier method', () => {
  it('should return whether the given specifier is a bare specifier', () => {
    expect(utils.isBareSpecifier('baz')).toBe(true)
    expect(utils.isBareSpecifier('baz/qux')).toBe(true)
    expect(utils.isBareSpecifier('./baz')).toBe(false)
    expect(utils.isBareSpecifier('../baz')).toBe(false)
    expect(utils.isBareSpecifier('/baz')).toBe(false)
  })

  it('should be cachable', () => {
    shouldBeCachable('isBareSpecifier', true, 'baz')
  })
})

describe('The shouldExternal method', () => {
  it('should return whether the given module name should be externalized', () => {
    const pkgs = task.manager.context.project.pkgs

    expect(utils.shouldExternal(pkgs.find((pkg) => pkg.name === onlyAVendorPkgDependOn.name)!)).toBe(false)
    expect(utils.shouldExternal(pkgs.find((pkg) => pkg.name === multiplePkgsDependOn.name)!)).toBe(true)
    expect(utils.shouldExternal(pkgs.find((pkg) => pkg.name === onlyALocalPkgDependOn.name)!)).toBe(true)
  })
})

describe('The getNormalizedPath method', () => {
  const sourcePath = resolveSourcePath('foo', 'src/pages/xx.vue')
  const sourceAbsolutePath = resolveSourceAbsolutePath('foo', 'src/pages/xx.vue')
  it('should return the normalized path of the given absolute path', () => {
    expect(utils.getNormalizedPath(sourceAbsolutePath)).toBe(sourcePath)
  })

  it('should be cachable', () => {
    shouldBeCachable('getNormalizedPath', sourcePath, sourceAbsolutePath)
  })
})

describe('The getLocalPkgs method', () => {
  it('should return the local pkgs of this project', () => {
    const localPkgs = task.manager.context.project.pkgs.filter((pkg) => pkg.local)
    expect(utils.getLocalPkgs()).toEqual(localPkgs)
  })

  it('should be cachable', () => {
    const localPkgs = task.manager.context.project.pkgs.filter((pkg) => pkg.local)
    // @ts-ignore
    const fn = jest.spyOn(Reflect.getPrototypeOf(utils).getLocalPkgs, 'origin')
    expect(utils.getLocalPkgs()).toEqual(localPkgs)
    expect(utils.getLocalPkgs()).toEqual(localPkgs)
    expect(utils.getLocalPkgs()).toEqual(localPkgs)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(1)
    shouldBeCachable('getLocalPkgs', localPkgs)
  })
})

describe('The getLocalPkgNames method', () => {
  it('should return the local pkg names of this project', () => {
    const localPkgNames = utils.getLocalPkgs().map((lp) => lp.name)
    expect(utils.getLocalPkgNames()).toEqual(localPkgNames)
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getLocalPkgNames',
      utils.getLocalPkgs().map((lp) => lp.name)
    )
  })
})

describe('The getLocalPkgPaths method', () => {
  it('should return the local pkg paths of this project', () => {
    const localPkgPaths = utils.getLocalPkgs().map((lp) => lp.path)
    expect(utils.getLocalPkgPaths()).toEqual(localPkgPaths)
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getLocalPkgPaths',
      utils.getLocalPkgs().map((lp) => lp.path)
    )
  })
})

describe('The getPages method', () => {
  const pages = [
    resolveSourcePath('foo', 'src/pages/xx.vue'),
    resolveSourcePath('foo', 'src/pages/yy.vue'),
    resolveSourcePath('foo', 'src/pages/xx/zz.vue'),
    resolveSourcePath('bar', 'src/pages/bar.vue'),
    resolveSourcePath('bar', 'src/pages/xx/index.vue'),
    resolveSourcePath('bar', 'src/pages/xx/[id].vue'),
    resolveSourcePath('root', 'src/pages/index.vue'),
    resolveSourcePath('root', 'src/pages/login.vue')
  ]
  const expected = expect.arrayContaining(pages)
  it('should return the pages of this project', () => {
    expect(utils.getPages()).toEqual(expected)
    expect(utils.getPages().length).toBe(pages.length)
  })

  it('should be cachable', () => {
    shouldBeCachable('getPages', expected)
  })
})

describe('The getPkgId method', () => {
  it('should return the pkg id of the given pkg name', () => {
    expect(utils.getPkgId('foo')).toBe('foo')
    expect(utils.getPkgId('@xx/foo')).toBe('foo')
  })

  it('should be cachable', () => {
    shouldBeCachable('getPkgId', 'foo', 'foo')
  })
})

describe('The getLocalPkgFromPath method', () => {
  it('should return the local pkg which contains the given path', () => {
    const entry = utils.getLocalPkgs().find((lp) => lp.name === 'entry')!
    expect(utils.getLocalPkgFromPath(resolveSourcePath('entry', 'src/index.ts'))).toBe(entry)
  })

  it('should throw an error if the given path is not included in local packages', () => {
    expect(() => utils.getLocalPkgFromPath('package.json')).toThrow()
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getLocalPkgFromPath',
      utils.getLocalPkgs().find((lp) => lp.name === 'entry'),
      resolveSourcePath('entry', 'src/index.ts')
    )
  })
})

describe('The getLocalPkgFromName method', () => {
  it('should return the local pkg which contains the local module', () => {
    const foo = utils.getLocalPkgs().find((lp) => lp.name === 'foo')!
    expect(utils.getLocalPkgFromName('foo/src/pages/xx.vue')).toBe(foo)
  })

  it('should throw an error if the given name is not a local module name', () => {
    expect(() => utils.getLocalPkgFromName('plain')).toThrow()
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getLocalPkgFromName',
      utils.getLocalPkgs().find((lp) => lp.name === 'foo'),
      'foo/src/pages/xx.vue'
    )
  })
})

describe('The getLocalModuleName method', () => {
  describe('For a local package which has a main field', () => {
    it('should use the local package name as the local module name if the given path is the main of local package', () => {
      expect(utils.getLocalModuleName(resolveSourcePath('entry', 'src/index.ts'))).toBe('entry')
    })

    it('should return null if the given path is not the main', () => {
      expect(utils.getLocalModuleName(resolveSourcePath('entry', 'src/app.vue'))).toBe(null)
    })
  })

  describe('For a local package which does not have a main field', () => {
    it('should use path.replace(lp.path, lp.name) as the local module name if the given path is a page', () => {
      expect(utils.getLocalModuleName(resolveSourcePath('foo', 'src/pages/xx.vue'))).toBe('foo/src/pages/xx.vue')
    })

    it('should use path.replace(lp.path, lp.name) as the local module name if the extension of the given path is included in the config.extensions', () => {
      expect(utils.getLocalModuleName(resolveSourcePath('foo', 'src/components/button.vue'))).toBe(
        'foo/src/components/button.vue'
      )
    })

    it('should return null if the extension of the given path is not included in the config.extensions', () => {
      expect(utils.getLocalModuleName(resolveSourcePath('foo', 'src/assets/xx.png'))).toBe(null)
    })
  })

  it('should be cachable', () => {
    shouldBeCachable('getLocalModuleName', 'foo/src/pages/xx.vue', resolveSourcePath('foo', 'src/pages/xx.vue'))
  })
})

describe('The getLocalModulePath method', () => {
  it('should return the local module path for the given local module name', () => {
    expect(utils.getLocalModulePath('entry')).toBe(resolveSourcePath('entry', 'src/index.ts'))
    expect(utils.getLocalModulePath('foo/src/components/button.vue')).toBe(
      resolveSourcePath('foo', 'src/components/button.vue')
    )
  })

  it('should be cachable', () => {
    // @ts-ignore
    const fn = jest.spyOn(Reflect.getPrototypeOf(utils).getLocalModulePath, 'origin')
    expect(utils.getLocalModulePath('entry')).toBe(resolveSourcePath('entry', 'src/index.ts'))
    expect(utils.getLocalModulePath('entry')).toBe(resolveSourcePath('entry', 'src/index.ts'))
    expect(utils.getLocalModulePath('entry')).toBe(resolveSourcePath('entry', 'src/index.ts'))
    expect(fn.mock.calls.length).toBeLessThanOrEqual(1)
    shouldBeCachable('getLocalModulePath', resolveSourcePath('entry', 'src/index.ts'), 'entry')
  })
})

describe('The getLocalModuleExternal method', () => {
  it('should return the external config for the local module whose name is the given name', () => {
    const external = [
      ...foo.dependencies.map((dep) => new RegExp('^' + dep.name + '(/.+)?$')),
      new RegExp(`^${task.manager.context.CONSTANTS.ROUTES}$`)
    ]
    expect(utils.getLocalModuleExternal('foo')).toEqual(external)
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getLocalModuleExternal',
      [
        ...foo.dependencies.map((dep) => new RegExp('^' + dep.name + '(/.+)?$')),
        new RegExp(`^${task.manager.context.CONSTANTS.ROUTES}$`)
      ],
      'foo'
    )
  })
})

describe('The getVendorModuleExternals method', () => {
  it('should return the externals field for the vendor module whose name is the given name', () => {
    const mn = utils.getVersionedPkgName(getPkg(circle.name))
    const expected = expect.arrayContaining(
      [
        dv2.name,
        multiplePkgsDependOn.name,
        ['circle-b', 'circle-a'].join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
      ]
    )
    expect(utils.getVendorModuleExternals(mn)).toEqual(expected)
  })

  it('should be cachable', () => {
    const mn = utils.getVersionedPkgName(getPkg(circle.name))
    const expected = expect.arrayContaining(
      [
        dv2.name,
        multiplePkgsDependOn.name,
        ['circle-b', 'circle-a'].join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
      ]
    )
    shouldBeCachable('getVendorModuleExternals', expected, mn)
  })
})

describe('The getMetaModule method', () => {
  it('should return the module info for the module whose name is the given name', () => {
    expect(utils.getMetaModule('foo')).toEqual({ id: 'foo', js: '', imports: [] })
  })

  it('should return the module info which must have a externals field for the vendor module even if the module does not have any externals', () => {
    const mn = utils.getVersionedPkgName(getPkg(plain.name))
    expect(utils.getMetaModule(mn)).toEqual({ id: mn, js: '', imports: [], externals: [] })
  })

  it('should be cachable', () => {
    shouldBeCachable('getMetaModule', { id: entry.name, js: '', imports: [] }, entry.name)
  })
})

describe('The getPkgName method', () => {
  it('should return the package name from the given specifier', () => {
    expect(utils.getPkgName('foo')).toBe('foo')
    expect(utils.getPkgName('foo/bar')).toBe('foo')
    expect(utils.getPkgName('foo/bar/baz')).toBe('foo')
    expect(utils.getPkgName('@xx/foo')).toBe('@xx/foo')
    expect(utils.getPkgName('@xx/foo/bar')).toBe('@xx/foo')
    expect(utils.getPkgName('@xx/foo/bar/baz')).toBe('@xx/foo')
  })

  it('should be cachable', () => {
    shouldBeCachable('getPkgName', 'foo', 'foo')
  })
})

describe('The getPkgFromModuleName method', () => {
  it('should return the package from the given local module name', () => {
    const entry = utils.getLocalPkgs().find((lp) => lp.name === 'entry')
    expect(utils.getPkgFromModuleName('entry')).toBe(entry)
    const foo = utils.getLocalPkgs().find((lp) => lp.name === 'foo')!
    expect(utils.getPkgFromModuleName('foo/src/pages/xx.vue')).toBe(foo)
  })

  it('should return the package from the given vendor module name', () => {
    const pkg = getPkg(circle.name)
    const mn = utils.getVersionedPkgName(pkg)
    expect(utils.getPkgFromModuleName(mn)).toBe(pkg)
  })

  it('should throw an error if the given module name is the routes module name', () => {
    expect(() => utils.getPkgFromModuleName(task.manager.context.CONSTANTS.ROUTES)).toThrow()
  })

  it('should throw an error if could not find a package from the given module name', () => {
    expect(() => utils.getPkgFromModuleName('packge-does-not-exist@1.0.0')).toThrow()
  })

  it('should be cachable', () => {
    shouldBeCachable(
      'getPkgFromModuleName',
      utils.getLocalPkgs().find((lp) => lp.name === 'entry'),
      'entry'
    )
  })
})

describe('The getPkgFromModuleId method', () => {
  it('should return the package from the given module id', () => {
    const pkg = getPkg(plain.name)
    const mi = `${pkg.ap}/dist/plain.js`
    expect(utils.getPkgFromModuleId(mi)).toBe(pkg)
  })

  it('should throw an error if could not find a package from the given module id', () => {
    expect(() => utils.getPkgFromModuleId('/a/path/to/make/an/error')).toThrow()
  })

  it('should be cachable', () => {
    const pkg = getPkg(plain.name)
    const mi = `${pkg.ap}/node_modules/${pkg.name}/dist/index.js`
    shouldBeCachable('getPkgFromModuleId', pkg, mi)
  })
})

describe('The getPkgFromSourceAndImporter method', () => {
  it('should return the package which own the given source and imported by the given importer', () => {
    const pkgs = task.manager.context.project.pkgs
    const importer = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const pkg = pkgs.find((pkg) => pkg.name === dv2.name && pkg.version === '2.0.0')!
    expect(utils.getPkgFromSourceAndImporter(dv2.name, importer)).toBe(pkg)
  })

  it('also works when the given importer is a module id', () => {
    const pkgs = task.manager.context.project.pkgs
    const importer = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const mi = `${importer.ap}/node_modules/${importer.name}/dist/index.js`
    const pkg = pkgs.find((pkg) => pkg.name === dv2.name && pkg.version === '2.0.0')!
    expect(utils.getPkgFromSourceAndImporter(dv2.name, mi)).toBe(pkg)
  })

  it('should return null if the given source is not a bare specifier', () => {
    const pkgs = task.manager.context.project.pkgs
    const importer = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const mi = `${importer.ap}/node_modules/${importer.name}/dist/index.js`
    expect(utils.getPkgFromSourceAndImporter('./utils.js', mi)).toBe(null)
  })

  it('should return null if there is not a corresponding package', () => {
    const pkgs = task.manager.context.project.pkgs
    const importer = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    expect(utils.getPkgFromSourceAndImporter(plain.name, importer)).toBe(null)
  })
})

describe('The getVersionedPkgName method', () => {
  it('should return the versioned package name from the given package', () => {
    const pkg = getPkg(plain.name)
    expect(utils.getVersionedPkgName(pkg)).toBe(
      `${pkg.name}${task.manager.context.CONSTANTS.VERSIONED_VENDOR_SEP}${pkg.version}`
    )
  })
})

describe('The getDepPath method', () => {
  it('should return the dep path from start package to end package', () => {
    const pkgs = task.manager.context.project.pkgs
    const start = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const middle = pkgs.find((pkg) => pkg.name === chain.name && pkg.version === '1.0.0')!
    const end = pkgs.find((pkg) => pkg.name === dv1.name && pkg.version === '1.0.0')!
    expect(utils.getDepPath(start, end)).toEqual([middle, end])
  })

  it('should throw an error if could not find the dep path even when there is a circular dependency', () => {
    const pkgs = task.manager.context.project.pkgs
    const start = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const end = pkgs.find((pkg) => pkg.name === plain.name && pkg.version === '1.0.0')!
    expect(() => utils.getDepPath(start, end)).toThrow()
  })
})

describe('The getPublicPkgNameFromDepPath method', () => {
  it('should return the public package name from the given dep path', () => {
    const pkgs = task.manager.context.project.pkgs
    const middle = pkgs.find((pkg) => pkg.name === chain.name && pkg.version === '1.0.0')!
    const end = pkgs.find((pkg) => pkg.name === dv1.name && pkg.version === '1.0.0')!
    const dp = [middle, end]
    expect(utils.getPublicPkgNameFromDepPath(dp)).toBe(
      dp.map((pkg) => pkg.name).join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
    )
  })
})

describe('The getPublicPkgNameFromImported method', () => {
  it('should return the public package name from the given imported specifier', () => {
    const ppn = [chain.name, dv1.name].join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
    const imported = ppn + '/dist/index.js'
    expect(utils.getPublicPkgNameFromImported(imported)).toBe(ppn)
  })

  it('should be cachable', () => {
    const ppn = [chain.name, dv1.name].join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
    const imported = ppn + '/dist/index.js'
    shouldBeCachable('getPublicPkgNameFromImported', ppn, imported)
  })
})

describe('The getPkgFromPublicPkgName method', () => {
  it('should return the package from the parent package and the public package name', () => {
    const pkgs = task.manager.context.project.pkgs
    const parent = pkgs.find((pkg) => pkg.name === circle.name && pkg.version === '1.0.0')!
    const ppn = [chain.name, dv1.name].join(task.manager.context.CONSTANTS.PACKAGE_NAME_SEP)
    const pkg = pkgs.find((pkg) => pkg.name === dv1.name && pkg.version === '1.0.0')!
    expect(utils.getPkgFromPublicPkgName(parent, ppn)).toBe(pkg)
  })
})

describe('The stringify method', () => {
  it('should return a string according to the given payload', () => {
    expect(utils.stringify(1)).toBe('1')
    expect(utils.stringify('1')).toBe('"1"')
    expect(utils.stringify(true)).toBe('true')
    expect(utils.stringify(false)).toBe('false')
    expect(utils.stringify(null)).toBe('null')
    expect(utils.stringify(undefined)).toBe(undefined)
    expect(utils.stringify({})).toBe('{}')
    expect(utils.stringify([])).toBe('[]')
    expect(utils.stringify(['1', '2', '3'])).toBe('["1","2","3"]')
    expect(utils.stringify({ a: 1, b: 2, c: 3 })).toBe('{a:1,b:2,c:3}')
    expect(utils.stringify({ a: [1, 2, 3], b: { c: 4, d: 5 } })).toBe('{a:[1,2,3],b:{c:4,d:5}}')

    const fn0 = () => {
      console.log('fn0')
    }
    function fn1 () {
      console.log('fn1')
    }
    expect(utils.stringify(fn0)).toBe(fn0.toString())
    expect(utils.stringify(fn1)).toBe(fn1.toString())
    expect(utils.stringify({ fn0, fn1 })).toBe(`{fn0:${fn0.toString()},fn1:${fn1.toString()}}`)
  })

  it('should accept a custom replacer', () => {
    expect(
      utils.stringify(
        { id: '/path/to/component', component: '/path/to/component' },
        (key, value) => {
          if (key === 'component') {
            return `() => import('${value}')`
          }
        }
      )
    ).toBe('{id:"/path/to/component",component:() => import(\'/path/to/component\')}')
  })
})

describe('The cachable decorator', () => {
  it('should use different cache for different instances', async () => {
    const task1 = new Processor().task(setContext)
    const task2 = new Processor().task(setContext)
    task1.hook('get-config', () => config)
    task2.hook('get-config', () => config)
    const xx = resolveSourcePath('foo', 'src/pages/xx.vue')
    const yy = resolveSourcePath('foo', 'src/pages/yy.vue')
    task1.prepend('get-routes', () => [{ id: xx, component: xx, path: '/foo/xx', name: 'foo-xx' }])
    task2.prepend(
      'get-routes',
      () => [
        {
          id: yy,
          component: yy,
          path: '/foo/yy',
          name: 'foo-yy'
        }
      ]
    )
    await task1.run()
    await task2.run()

    const utils1 = task1.manager.context.utils
    const utils2 = task2.manager.context.utils

    expect(utils1.isPage(xx)).toBe(true)
    expect(utils1.isPage(yy)).toBe(false)

    expect(utils2.isPage(xx)).toBe(false)
    expect(utils2.isPage(yy)).toBe(true)
  })
})
