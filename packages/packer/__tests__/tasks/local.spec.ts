import { join } from 'path'

import { build, mergeConfig } from 'vite'
import { Processor } from '@ugdu/processor'

import { buildLocalModules } from '../../src/tasks/local'

import { setHash, setMeta, setChanged, setVirtualProject, resolveSourcePath } from '../../__mocks__/utils'

import type { UserConfig } from '../../src/tasks/config'
import type { Utils } from '../../src/tasks/utils'
import type { ChangedSource } from '../../src/tasks/project'

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
  apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name), vite: { define: { xx: '"xx"', yy: '"yy"' } } }],
  extensions: ['vue', 'ts'],
  meta: 'local',
  vite: { define: { xx: '"will be overridden"' } }
}

const entry = {
  name: 'entry',
  main: 'src/index.ts',
  sources: ['src/index.ts', 'src/app.vue']
}
const foo = {
  name: 'foo',
  sources: [
    'src/pages/xx.vue',
    'src/pages/zz.vue',
    'src/components/button.vue',
    'src/components/input.vue',
    'src/assets/xx.png',
    'src/assets/input.png'
  ]
}
const components = {
  name: 'components',
  main: 'src/index.ts',
  sources: ['src/index.ts']
}
const lps = [entry, foo, components]
const changed: ChangedSource[] = [
  { path: resolveSourcePath('entry', 'src/index.ts'), status: 'M' },
  { path: resolveSourcePath('foo', 'src/assets/xx.png'), status: 'M' },
  { path: resolveSourcePath('foo', 'src/pages/yy.vue'), status: 'D' },
  { path: resolveSourcePath('foo', 'src/pages/zz.vue'), status: 'A' },
  { path: resolveSourcePath('foo', 'src/components/input.vue'), status: 'M' },
  { path: resolveSourcePath('foo', 'src/assets/button.png'), status: 'D' },
  { path: resolveSourcePath('foo', 'src/assets/input.png'), status: 'M' },
  { path: resolveSourcePath('components', 'src/index.ts'), status: 'M' }
]

setMeta(
  {
    hash: 'prehash',
    version: VERSION,
    modules: [
      { id: 'routes', js: 'assets/routes/index.js', imports: [] },
      {
        id: 'entry',
        js: 'assets/entry/index.js',
        imports: [],
        sources: [resolveSourcePath('entry', 'src/app.vue')],
        exports: ['default']
      },
      {
        id: 'foo/src/pages/xx.vue',
        js: 'assets/foo/xx.js',
        imports: [{ id: 'components', bindings: ['Dialog'], name: 'components' }],
        sources: [resolveSourcePath('foo', 'src/assets/xx.png')],
        exports: ['default']
      },
      {
        id: 'foo/src/pages/yy.vue',
        js: 'assets/foo/yy.js',
        imports: [{ id: 'components', bindings: ['Select'], name: 'components' }],
        exports: ['default']
      },
      {
        id: 'foo/src/components/button.vue',
        js: 'assets/foo/button.js',
        imports: [],
        sources: [resolveSourcePath('foo', 'src/assets/button.png')],
        exports: ['default']
      },
      {
        id: 'foo/src/components/input.vue',
        js: 'assets/foo/input.js',
        imports: [],
        sources: [resolveSourcePath('foo', 'src/assets/input.png')],
        exports: ['default']
      },
      { id: 'components', js: 'assets/components/index.js', imports: [], exports: ['Dialog', 'Select'] }
    ],
    pages: [resolveSourcePath('foo', 'src/pages/xx.vue'), resolveSourcePath('foo', 'src/pages/yy.vue')]
  }
)
setVirtualProject(lps)
setHash('curhash')
setChanged(changed)

describe('The buildLocalModules task', () => {
  const fn = jest.fn()

  let utils: Utils

  const processor = new Processor()
  const task = processor.task(buildLocalModules)
  task.hook('get-config', () => config)
  task.hook('build-local-module', fn)
  beforeAll(
    () => {
      return task.run().then(() => (utils = task.manager.context.utils))
    }
  )

  it('should clone pre local module info to `meta.cur.modules` according to current sources', () => {
    const {
      manager: {
        context: {
          project: {
            meta: { pre, cur }
          }
        }
      }
    } = task
    const preEntryModule = pre.modules.find((m) => m.id === 'entry')
    const curEntryModule = cur.modules.find((m) => m.id === 'entry')
    expect(preEntryModule).toEqual(curEntryModule)
    expect(preEntryModule).not.toBe(curEntryModule)

    // The 'foo/src/pages/yy.vue' module is not cloned because it is deleted.
    expect(cur.modules.find((m) => m.id === 'foo/src/pages/yy.vue')).toBeUndefined()
    // The 'foo/src/pages/zz.vue' module is not cloned because there is no info about it in pre.
    expect(cur.modules.find((m) => m.id === 'foo/src/pages/zz.vue')).toBeUndefined()
  })

  it('should call `build-local-module` hook with the local module name for a `module` which is modified', () => {
    expect(fn).toBeCalledWith(utils.getLocalModuleName(resolveSourcePath('entry', 'src/index.ts')), expect.anything())
  })

  it('should call `build-local-module` hook with the local module name for a `module` any of whose sources is modified', () => {
    expect(fn).toBeCalledWith(utils.getLocalModuleName(resolveSourcePath('foo', 'src/pages/xx.vue')), expect.anything())
  })

  it('should remove the module info from cur.meta.modules if the `module` is deleted', () => {
    expect(task.manager.context.project.meta.cur.modules.find((m) => m.id === 'foo/src/pages/yy.vue')).toBeUndefined()
  })

  it('should call `build-local-module` hook with the local module name for a `module` which is added', () => {
    expect(fn).toBeCalledWith(utils.getLocalModuleName(resolveSourcePath('foo', 'src/pages/zz.vue')), expect.anything())
  })

  it('should call `build-local-module` hook with the local module name for a `module` any of whose sources is deleted', () => {
    expect(fn).toBeCalledWith(
      utils.getLocalModuleName(resolveSourcePath('foo', 'src/components/button.vue')),
      expect.anything()
    )
  })

  it('should call `build-local-module` hook only once for the same local module', () => {
    expect(
      fn.mock.calls.filter(
        ([name]) => name === utils.getLocalModuleName(resolveSourcePath('foo', 'src/components/input.vue'))
      ).length
    ).toBe(1)
  })

  it('should set mn2bm to context.project', () => {
    expect(task.manager.context.project.mn2bm).toEqual(
      {
        pre: {
          components: ['Dialog', 'Select']
        },
        cur: {
          components: ['Dialog']
        }
      }
    )
  })

  it('should throw an error if a module no longer exports some binding but other modules still import it', async () => {
    const processor = new Processor()
    const task = processor.task(buildLocalModules)
    task.hook('get-config', () => config)
    task.hook(
      'build-local-module',
      (lmn, context) => {
        if (lmn === 'components') {
          context.utils.getMetaModule(lmn).exports = ['Select']
        }
      }
    )
    await expect(task.run()).rejects.toThrow()
  })

  it('should throw an error if a module import from sub path of another local module which has a main field', async () => {
    const processor = new Processor()
    const task = processor.task(buildLocalModules)
    task.hook('get-config', () => config)
    task.hook(
      'build-local-module',
      (lmn, context) => {
        if (lmn === 'foo/src/pages/xx.vue') {
          context.utils
            .getMetaModule(lmn)
            .imports.push({ id: 'entry/src/app.vue', name: 'entry/src/app.vue', bindings: ['default'] })
        }
      }
    )
    await expect(task.run()).rejects.toThrow()
  })
})

describe('The preset `build-local-module` hook fn', () => {
  it('should invoke vite.build with mergeConfig(defaultConfig, mergeConfig(config.vite, app.vite))', async () => {
    const fn = jest.fn()

    const processor = new Processor()
    const task = processor.task(buildLocalModules)
    task.hook('get-config', () => config)
    task.hook(
      'build-local-module',
      async (lmn, context) => {
        await new Promise((resolve) => setTimeout(resolve))
        const {
          config,
          config: { apps, assets },
          project: { alias },
          utils: { resolve, getLocalModulePath, getLocalModuleExternal, getPkgName }
        } = context
        const pn = getPkgName(lmn)
        const app = apps.find((app) => (app.packages as string[]).includes(pn))!
        const dc = {
          publicDir: false,
          resolve: {
            alias
          },
          build: {
            rollupOptions: {
              input: resolve(getLocalModulePath(lmn)),
              output: {
                entryFileNames: join(assets, pn, '[name].[hash].js'),
                chunkFileNames: join(assets, pn, '[name].[hash].js'),
                assetFileNames: join(assets, pn, '[name].[hash][extname]'),
                format: 'es'
              },
              preserveEntrySignatures: 'allow-extension',
              external: getLocalModuleExternal(lmn)
            }
          }
        }
        expect(build).toBeCalledWith(expect.objectContaining(mergeConfig(dc, mergeConfig(config.vite, app.vite))))
        fn()
      }
    )
    await task.run()

    expect(fn).toBeCalled()
  })
})
