import { join } from 'path'

import { build, mergeConfig } from 'vite'
import { Processor } from '@ugdu/processor'

import { buildRoutesModule } from '../../src/tasks/routes'

import { setHash, setMeta, setChanged, setVirtualProject, resolveSourcePath } from '../../__mocks__/utils'

import type { UserConfig } from '../../src/tasks/config'
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
  apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name) }],
  extensions: ['vue', 'ts'],
  meta: 'local',
  vite: { define: { xx: '"xx"' } }
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

const lps = [entry, foo]

setMeta(
  {
    hash: 'prehash',
    version: VERSION,
    modules: [],
    pages: []
  }
)
setVirtualProject(lps)
setHash('curhash')

describe('The buildRoutesModule task', () => {
  it('should throw an error if there is a page in the package which has a main field', async () => {
    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.prepend(
      'get-routes',
      () => [
        {
          id: resolveSourcePath('entry', 'src/app.vue'),
          path: '/entry/app',
          name: 'entry-app',
          component: resolveSourcePath('entry', 'src/app.vue')
        }
      ]
    )
    await expect(task.run()).rejects.toThrow()
  })

  it('should call the `build-routes-module` if a page is added', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [{ path: resolveSourcePath('foo', 'src/pages/zz.vue'), status: 'A' }]
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook('build-routes-module', fn)
    await task.run()

    expect(fn).toHaveBeenCalled()
  })

  it('should call the `build-routes-module` if a page is deleted', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [{ path: resolveSourcePath('foo', 'src/pages/yy.vue'), status: 'D' }]
    setMeta(
      {
        hash: 'prehash',
        version: VERSION,
        modules: [],
        pages: [resolveSourcePath('foo', 'src/pages/yy.vue')]
      }
    )
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook('build-routes-module', fn)
    await task.run()

    expect(fn).toHaveBeenCalled()
  })

  it('should not call the `build-routes-module` if a page is modified', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [{ path: resolveSourcePath('foo', 'src/pages/xx.vue'), status: 'M' }]
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook('build-routes-module', fn)
    await task.run()

    expect(fn).not.toHaveBeenCalled()
  })

  it('should not call the `build-routes-module` if any other modules are changed', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [{ path: resolveSourcePath('foo', 'src/components/button.vue'), status: 'A' }]
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook('build-routes-module', fn)
    await task.run()

    expect(fn).not.toHaveBeenCalled()
  })

  it('should call `build-local-module` hook only once', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [
      { path: resolveSourcePath('foo', 'src/pages/zz.vue'), status: 'A' },
      { path: resolveSourcePath('foo', 'src/pages/yy.vue'), status: 'D' }
    ]
    setMeta(
      {
        hash: 'prehash',
        version: VERSION,
        modules: [],
        pages: [resolveSourcePath('foo', 'src/pages/yy.vue')]
      }
    )
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook('build-routes-module', fn)
    await task.run()

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('The preset `build-routes-module` hook fn', () => {
  it('should invoke vite.build with `mergeConfig(defaultConfig, config.vite)`', async () => {
    const fn = jest.fn()

    const changed: ChangedSource[] = [{ path: resolveSourcePath('foo', 'src/pages/zz.vue'), status: 'A' }]
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(buildRoutesModule)
    task.hook('get-config', () => config)
    task.hook(
      'build-routes-module',
      async (context) => {
        await new Promise((resolve) => setTimeout(resolve))
        const {
          CONSTANTS: { ROUTES_INPUT, ROUTES },
          config,
          config: { assets }
        } = context
        const dc = {
          publicDir: false,
          build: {
            rollupOptions: {
              input: ROUTES_INPUT,
              output: {
                entryFileNames: join(assets, ROUTES, '[hash].js'),
                chunkFileNames: join(assets, ROUTES, '[hash].js'),
                assetFileNames: join(assets, ROUTES, '[hash][extname]'),
                format: 'es'
              },
              preserveEntrySignatures: 'allow-extension'
            }
          }
        }
        expect(build).toHaveBeenCalledWith(expect.objectContaining(mergeConfig(dc, config.vite)))
        fn()
      }
    )
    await task.run()
    expect(fn).toBeCalled()
  })
})
