import { join } from 'path'

import { build, mergeConfig } from 'vite'
import { Processor } from '@ugdu/processor'

import { buildVendorModules } from '../../src/tasks/vendor'

import { resolveSourcePath, setChanged, setMeta, setVirtualProject } from '../../__mocks__/utils'

import type { UserConfig } from '../../src/tasks/config'
import type { Utils } from '../../src/tasks/utils'

import type { LooseVirtualPkgNode } from '../../__mocks__/utils'

jest.mock(
  'vite',
  () => ({
    ...jest.requireActual('vite'),
    build: jest.fn()
  })
)
jest.mock('fs/promises')

const cwd = '/path/to/project'
const config: UserConfig = {
  cwd,
  apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name) }],
  extensions: ['ts', 'vue'],
  meta: 'local'
}

const onlyALocalPkgDependOn = {
  name: 'only-a-local-pkg-depend-on'
}
const onlyAVendorPkgDependOn = { name: 'only-a-vendor-pkg-depend-on' }
const multipleVendorsDependOn = { name: 'multiple-vendors-depend-on' }
const hasDeps = { name: 'has-deps', dependencies: [onlyAVendorPkgDependOn, multipleVendorsDependOn] }

const plainCircleA: LooseVirtualPkgNode = { name: 'plain-circle-a', dependencies: [multipleVendorsDependOn] }
const plainCircleB: LooseVirtualPkgNode = { name: 'plain-circle-b', dependencies: [] }
const plainCircleC: LooseVirtualPkgNode = { name: 'plain-circle-c', dependencies: [] }

plainCircleA.dependencies!.push(plainCircleB)
plainCircleB.dependencies!.push(plainCircleC)
plainCircleC.dependencies!.push(plainCircleA)

const privateCircle = { name: 'private-circle', dependencies: [plainCircleA] }
plainCircleA.dependencies!.push(privateCircle)

const crossedCircleA: LooseVirtualPkgNode = { name: 'crossed-circle-a', dependencies: [] }
const crossedCircleB: LooseVirtualPkgNode = { name: 'crossed-circle-b', dependencies: [] }
const crossedCircleC: LooseVirtualPkgNode = { name: 'crossed-circle-c', dependencies: [] }
const crossedCircleD: LooseVirtualPkgNode = { name: 'crossed-circle-d', dependencies: [] }
const crossedCircleE: LooseVirtualPkgNode = { name: 'crossed-circle-e', dependencies: [] }
const crossedCircleF: LooseVirtualPkgNode = { name: 'crossed-circle-f', dependencies: [] }

crossedCircleA.dependencies!.push(crossedCircleB)
crossedCircleB.dependencies!.push(crossedCircleC, crossedCircleE)
crossedCircleC.dependencies!.push(crossedCircleD)
crossedCircleD.dependencies!.push(crossedCircleA)
crossedCircleE.dependencies!.push(crossedCircleF)
crossedCircleF.dependencies!.push(crossedCircleA)

plainCircleA.dependencies!.push(crossedCircleF)

const chainedCircleA: LooseVirtualPkgNode = { name: 'chained-circle-a', dependencies: [] }
const chainedCircleB: LooseVirtualPkgNode = { name: 'chained-circle-b', dependencies: [] }
const chainedCircleC: LooseVirtualPkgNode = { name: 'chained-circle-c', dependencies: [] }
const chainedCircleD: LooseVirtualPkgNode = { name: 'chained-circle-d', dependencies: [] }
const chainedCircleE: LooseVirtualPkgNode = { name: 'chained-circle-e', dependencies: [] }
const chainedCircleF: LooseVirtualPkgNode = { name: 'chained-circle-f', dependencies: [] }

chainedCircleA.dependencies!.push(chainedCircleB)
chainedCircleB.dependencies!.push(chainedCircleC)
chainedCircleC.dependencies!.push(chainedCircleA, chainedCircleD)
chainedCircleD.dependencies!.push(chainedCircleE)
chainedCircleE.dependencies!.push(chainedCircleF)
chainedCircleF.dependencies!.push(chainedCircleD)

const entry = {
  name: 'entry',
  main: 'src/index.ts',
  dependencies: [onlyALocalPkgDependOn, plainCircleA, plainCircleB, plainCircleC],
  sources: ['src/index.ts', 'src/app.vue']
}
const foo = {
  name: 'foo',
  dependencies: [
    hasDeps,
    crossedCircleA,
    crossedCircleB,
    crossedCircleC,
    crossedCircleD,
    crossedCircleE,
    crossedCircleF
  ],
  sources: ['src/pages/xx.vue']
}
const bar = {
  name: 'bar',
  dependencies: [chainedCircleA, chainedCircleB, chainedCircleC, chainedCircleD, chainedCircleE, chainedCircleF],
  sources: ['src/pages/xx.vue']
}
const lps = [entry, foo, bar]
setVirtualProject(lps, cwd)

describe('The buildVendorModules task', () => {
  const fn = jest.fn()

  let utils: Utils

  setMeta(
    {
      hash: 'prehash',
      version: VERSION,
      modules: [
        {
          id: 'foo/src/pages/xx.vue',
          js: 'assets/foo/xx.js',
          exports: ['default'],
          imports: []
        },
        {
          id: 'bar/src/pages/xx.vue',
          js: 'assets/bar/xx.js',
          exports: ['default'],
          imports: [
            { id: `${chainedCircleA.name}@1.0.0`, name: chainedCircleA.name, bindings: ['default', 'a'] },
            { id: `${chainedCircleB.name}@1.0.0`, name: chainedCircleB.name, bindings: ['default'] },
            { id: `${chainedCircleC.name}@1.0.0`, name: chainedCircleC.name, bindings: ['default'] }
          ]
        },
        {
          id: `${chainedCircleA.name}@1.0.0`,
          js: `assets/${chainedCircleA.name}@1.0.0/index.js`,
          imports: [],
          externals: [chainedCircleB.name]
        },
        {
          id: `${chainedCircleC.name}@1.0.0`,
          js: `assets/${chainedCircleC.name}@1.0.0/index.js`,
          imports: [],
          externals: [chainedCircleA.name, chainedCircleD.name]
        }
      ],
      pages: [resolveSourcePath('foo', 'src/pages/xx.vue'), resolveSourcePath('bar', 'src/pages/xx.vue')]
    }
  )
  setChanged(
    [
      { path: resolveSourcePath('entry', 'src/index.ts'), status: 'M' },
      { path: resolveSourcePath('foo', 'src/pages/xx.vue'), status: 'M' },
      { path: resolveSourcePath('bar', 'src/pages/xx.vue'), status: 'M' }
    ]
  )
  const processor = new Processor()
  const task = processor.task(buildVendorModules)
  task.hook('get-config', () => config)
  task.hook(
    'build-local-module',
    (lmn, context) => {
      const {
        utils: { getMetaModule, getPkgFromModuleName, getVersionedPkgName }
      } = context
      const mm = getMetaModule(lmn)
      const lp = getPkgFromModuleName(lmn)
      mm.imports = []
      lp.dependencies.forEach(
        (dep) => {
          if (dep.name !== 'chained-circle-d') {
            mm.imports.push({ id: getVersionedPkgName(dep), name: dep.name, bindings: ['default'] })
          }
        }
      )
    }
  )
  task.hook(
    'build-vendor-module',
    (vvn, context) => {
      const {
        utils: { getPkgFromModuleName, getMetaModule, getPkgFromPublicPkgName, getVersionedPkgName }
      } = context
      const pkg = getPkgFromModuleName(vvn)

      if (pkg.name.startsWith('plain-circle')) {
        const mm = getMetaModule(vvn)
        getMetaModule(vvn).externals!.forEach(
          (ppn) => {
            const dep = getPkgFromPublicPkgName(pkg, ppn)
            mm.imports.push({ id: getVersionedPkgName(dep), name: dep.name, bindings: ['x'] })
          }
        )
      }
    }
  )
  task.hook('build-vendor-module', fn)
  const calls: string[][] = []
  task.hook(
    'build-vendor-module',
    async () => {
      await new Promise((resolve) => setTimeout(resolve))
      const recorded = calls.reduce((acc, c) => acc + c.length, 0)
      if (recorded !== fn.mock.calls.length) {
        const group: string[] = []
        calls.push(group)
        for (let i = recorded; i < fn.mock.calls.length; i++) {
          const c = fn.mock.calls[i]
          group.push(c[0])
        }
      }
    }
  )

  beforeAll(() => task.run().then(() => (utils = task.manager.context.utils)))
  afterAll(() => setMeta())

  const getPkg = (name: string, version = '1.0.0') =>
    task.manager.context.project.pkgs.find((pkg) => pkg.name === name && pkg.version === version)!

  it('should call `build-vendor-module` hook with the vendor module name for a vendor module which is imported by local modules', () => {
    const pkg = getPkg(onlyALocalPkgDependOn.name)
    expect(fn).toBeCalledWith(utils.getVersionedPkgName(pkg), expect.anything())
  })

  it('should call `build-vendor-module` hook with the vendor module name for a vendor module which is imported by multiple vendor modules', () => {
    const pkg = getPkg(multipleVendorsDependOn.name)
    expect(fn).toBeCalledWith(utils.getVersionedPkgName(pkg), expect.anything())
  })

  it('should not call `build-vendor-module` hook for a vendor module which is only imported by one vendor module', () => {
    expect(fn).not.toBeCalledWith(utils.getVersionedPkgName(getPkg(onlyAVendorPkgDependOn.name)), expect.anything())
    expect(fn).not.toBeCalledWith(utils.getVersionedPkgName(getPkg(privateCircle.name)), expect.anything())
  })

  it('should call `build-vendor-module` hook for a vendor module whose bindings has changed', () => {
    expect(fn).toBeCalledWith(utils.getVersionedPkgName(getPkg(chainedCircleA.name)), expect.anything())
  })

  it('should call `build-vendor-module` hook for a vendor module whose externals has changed', () => {
    expect(fn).toBeCalledWith(utils.getVersionedPkgName(getPkg(chainedCircleB.name)), expect.anything())
  })

  it('should not call `build-vendor-module` hook for a vendor module whose bindings and externals are the same as previous build', () => {
    expect(fn).not.toBeCalledWith(utils.getVersionedPkgName(getPkg(chainedCircleC.name)), expect.anything())
    expect(
      task.manager.context.project.meta.cur.modules.find(
        (m) => m.id === utils.getVersionedPkgName(getPkg(chainedCircleC.name))
      )
    ).toEqual(
      task.manager.context.project.meta.pre.modules.find(
        (m) => m.id === utils.getVersionedPkgName(getPkg(chainedCircleC.name))
      )
    )
  })

  it('should remove the module info of a vendor module whose bindings are empty', () => {
    expect(fn).not.toBeCalledWith(utils.getVersionedPkgName(getPkg(chainedCircleD.name)), expect.anything())
    expect(
      task.manager.context.project.meta.cur.modules.find(
        (m) => m.id === utils.getVersionedPkgName(getPkg(chainedCircleD.name))
      )
    ).toBeUndefined()
  })

  it('should only call `build-vendor-module` hook for a vendor module when all of its dependents are built or they are in the same circle and all dependents of the circle are built', async () => {
    ;[
      [onlyALocalPkgDependOn, hasDeps, plainCircleA, plainCircleB, plainCircleC, chainedCircleA, chainedCircleB],
      [plainCircleA, plainCircleB, plainCircleC],
      [
        multipleVendorsDependOn,
        crossedCircleA,
        crossedCircleB,
        crossedCircleC,
        crossedCircleD,
        crossedCircleE,
        crossedCircleF,
        chainedCircleE,
        chainedCircleF
      ]
    ].forEach(
      (ns, index) => {
        expect(calls[index]).toEqual(expect.arrayContaining(ns.map((n) => utils.getVersionedPkgName(getPkg(n.name)))))
        expect(calls[index].length).toBe(ns.length)
      }
    )
  })

  it('should call `build-vendor-module` hook for the vendor modules in a circle multiple times until all of them are available', async () => {
    expect(fn.mock.calls.filter((c) => c[0] === utils.getVersionedPkgName(getPkg(plainCircleA.name))).length).toBe(2)
    expect(fn.mock.calls.filter((c) => c[0] === utils.getVersionedPkgName(getPkg(plainCircleB.name))).length).toBe(2)
    expect(fn.mock.calls.filter((c) => c[0] === utils.getVersionedPkgName(getPkg(plainCircleC.name))).length).toBe(2)
  })
})

describe('The preset `build-vendor-module` hook fn', () => {
  it('should invoke vite.build with mergeConfig(defaultConfig, config.vite)', async () => {
    const fn = jest.fn()

    const processor = new Processor()
    const task = processor.task(buildVendorModules)
    task.hook('get-config', () => config)
    task.hook(
      'build-local-module',
      (lmn, context) => {
        const {
          utils: { getMetaModule, getPkgFromModuleName, getVersionedPkgName }
        } = context
        const mm = getMetaModule(lmn)
        const lp = getPkgFromModuleName(lmn)
        mm.imports = []
        lp.dependencies.forEach(
          (dep) => {
            mm.imports.push({ id: getVersionedPkgName(dep), name: dep.name, bindings: ['default'] })
          }
        )
      }
    )
    task.hook(
      'build-vendor-module',
      async (vvn, context) => {
        await new Promise((resolve) => setTimeout(resolve))
        const {
          CONSTANTS: { VENDOR_INPUT },
          config,
          config: { assets },
          utils: { getMetaModule }
        } = context
        const cmm = getMetaModule(vvn)
        const dc = {
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
          }
        }
        expect(build).toBeCalledWith(expect.objectContaining(mergeConfig(dc, config.vite)))
        fn()
      }
    )

    await task.run()

    expect(fn).toBeCalled()
  })
})
