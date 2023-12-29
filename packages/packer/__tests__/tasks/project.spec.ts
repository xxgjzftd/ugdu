import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolve } from 'path'
import { readFile } from 'fs/promises'

import axios from 'axios'
import fg from 'fast-glob'
import { execa } from 'execa'
import { Processor } from '@ugdu/processor'

import { setContext } from 'src/tasks/context'

import {
  setHash,
  setMeta,
  setChanged,
  setVirtualProject,
  resolveSourcePath,
  resolveLocalPkgPath
} from '__mocks__/utils'

import type { ChangedSource, UserConfig } from 'src'

const cwd = '/path/to/project'
const config: UserConfig = {
  cwd,
  apps: [],
  extensions: [],
  meta: 'local'
}

beforeEach(
  () => {
    setHash()
    setMeta()
    setChanged()
    setVirtualProject()
    vi.clearAllMocks()
  }
)

describe('The preset get-local-packages hook fn', () => {
  it('should returns local packages of your project', async () => {
    setVirtualProject([{ name: 'pkg0' }, { name: 'pkg1' }, { name: 'pkg2' }], cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.utils.getLocalPkgs()).toMatchSnapshot()
  })
})

describe('The preset get-alias hook fn', () => {
  it('should return the alias accroding to the `local package`s of your project', async () => {
    setVirtualProject([{ name: 'pkg0' }, { name: 'pkg1' }, { name: 'pkg2' }], cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.project.alias).toMatchSnapshot()
  })

  it('should throw an error if there are duplicate pkg id in local packages', async () => {
    setVirtualProject([{ name: 'duplicate' }, { name: 'duplicate' }], cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)

    await expect(task.run()).rejects.toThrow()
  })
})

describe('The preset get-all-packages hook fn', () => {
  it('should return all packages of your project', async () => {
    const plain = { name: 'plain' }
    const dv1 = { name: 'different-version', version: '1.0.0' }
    const dv2 = { name: 'different-version', version: '2.0.0' }
    const hd = { name: 'has-deps', dependencies: [plain, dv1] }
    const circle = {
      name: 'circle-a',
      dependencies: [dv2, { name: 'circle-b', dependencies: [{ name: 'circle-a' }] }]
    }
    const lps = [
      { name: 'pkg0', dependencies: [plain, dv1] },
      { name: 'pkg1', dependencies: [plain, dv2] },
      { name: 'pkg2', dependencies: [hd, circle] }
    ]
    setVirtualProject(lps, cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.project.pkgs).toMatchSnapshot()
  })
})

describe('The preset get-previous-meta hook fn', () => {
  it('should read data from `resolve(config.cwd, config.dist, CONSTANTS.META_JSON)` when the `config.meta` is set to `local`', async () => {
    const cwd = '/cwd'
    setVirtualProject([], cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    const dist = 'xx'
    task.hook('get-config', () => ({ cwd, dist, meta: 'local', apps: [], extensions: [] }))
    await task.run()

    expect(readFile).toBeCalledWith(resolve(cwd, dist, task.manager.context.CONSTANTS.META_JSON), 'utf-8')
  })

  it('should fetch data from `${config.meta}${CONSTANTS.META_JSON}` when the `config.meta` is set to a value other than `local`', async () => {
    setVirtualProject([], cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    const meta = 'http://your.url/'
    task.hook('get-config', () => ({ cwd, meta, apps: [], extensions: [] }))
    await task.run()

    expect(axios.get).toBeCalledWith(`${meta}${task.manager.context.CONSTANTS.META_JSON}`)
  })
})

describe('The preset get-current-meta hook fn', () => {
  const hash = 'curhash'
  const entry = {
    id: '@xx/entry',
    js: 'assets/@xx/entry/index.js',
    imports: [
      {
        id: 'vue@3.2.31',
        name: 'vue',
        bindings: [
          'defineComponent',
          'ref',
          'resolveComponent',
          'openBlock',
          'createElementBlock',
          'Fragment',
          'createBlock',
          'withCtx',
          'createVNode',
          'createCommentVNode',
          'createTextVNode',
          'createApp'
        ]
      }
    ],
    sources: ['packages/entry/src/app.vue', 'packages/entry/src/index.css'],
    css: 'assets/@xx/entry/index.css',
    exports: ['default']
  }
  const vue = { id: 'vue@3.2.31', js: 'assets/vue@3.2.31/index.js', imports: [], externals: ['@vue/shared'] }
  const modules = [entry, vue]
  const meta = { hash: 'prehash', version: VERSION, modules, pages: [] }

  it('should set hash to the hash of HEAD', async () => {
    setHash(hash)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    const cur = task.manager.context.project.meta.cur
    expect(cur.hash).toBe(hash)
    expect(execa).toBeCalledWith('git', ['rev-parse', '--short', 'HEAD'], { cwd: cwd })
  })

  it('should set version to the version of the package.json', async () => {
    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    const cur = task.manager.context.project.meta.cur
    expect(cur.version).toBe(VERSION)
  })

  it('should set modules to an empty array', async () => {
    setMeta(meta)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    const cur = task.manager.context.project.meta.cur
    expect(cur.modules).toEqual([])
  })
})

describe('The preset get-sources hook fn', () => {
  it('should return all sources of your project accroding to the local packages', async () => {
    const lps = [
      { name: 'pkg0', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg1', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg2', sources: ['src/index.ts', 'src/index.css'] }
    ]
    setVirtualProject(lps, cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.project.sources.all).toMatchSnapshot()
    expect(fg).toBeCalledWith(
      task.manager.context.utils.getLocalPkgs().map((pkg) => `${pkg.path}/**`),
      { cwd, ignore: ['**/node_modules/**'] }
    )
  })

  it("should get `changed sources` by using `git diff` if there is a hash of pre meta and the packer's version of previous build is the same with current", async () => {
    const lps = [
      { name: 'pkg0', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg1', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg2', sources: ['src/index.ts', 'src/index.css'] }
    ]
    const prehash = 'prehash'
    const changed: ChangedSource[] = [{ path: resolveSourcePath('pkg0', 'src/index.ts'), status: 'M' }]
    setVirtualProject(lps, cwd)
    setMeta({ hash: prehash, version: VERSION, modules: [], pages: [] })
    setChanged(changed)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.project.sources.changed).toEqual(changed)
    expect(execa).toBeCalledWith('git', ['diff', prehash, 'HEAD', '--name-status'], { cwd })
  })

  it('should use `all sources` with the status `A` as `changed sources` else', async () => {
    const lps = [
      { name: 'pkg0', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg1', sources: ['src/index.ts', 'src/index.css'] },
      { name: 'pkg2', sources: ['src/index.ts', 'src/index.css'] }
    ]
    setVirtualProject(lps, cwd)
    setMeta()

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    const sources = task.manager.context.project.sources
    expect(sources.changed).toEqual(sources.all.map((path) => ({ path, status: 'A' })))
  })
})

describe('The preset get-routes hook fn', () => {
  it('should find page from `${local packages}/src/pages`', async () => {
    const lps = [{ name: 'pkg0', sources: ['src/pages/xx.vue'] }]
    setVirtualProject(lps, cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(fg).toBeCalledWith(`${resolveLocalPkgPath('pkg0')}/src/pages/**/*`)
  })

  it('should generate route path according to the `path` of the page', async () => {
    const lps = [
      { name: 'foo', sources: ['src/pages/xx.vue', 'src/pages/yy.vue', 'src/pages/xx/zz.vue'] },
      { name: 'bar', sources: ['src/pages/bar.vue', 'src/pages/xx/index.vue', 'src/pages/xx/[id].vue'] },
      { name: 'root', sources: ['src/pages/index.vue', 'src/pages/login.vue'] }
    ]
    setVirtualProject(lps, cwd)

    const processor = new Processor()
    const task = processor.task(setContext)
    task.hook('get-config', () => config)
    await task.run()

    expect(task.manager.context.project.routes).toEqual(
      expect.arrayContaining(
        [
          {
            id: resolveSourcePath('foo', 'src/pages/xx.vue'),
            component: resolveSourcePath('foo', 'src/pages/xx.vue'),
            path: '/foo/xx',
            name: 'foo-xx',
            children: [
              {
                id: resolveSourcePath('foo', 'src/pages/xx/zz.vue'),
                component: resolveSourcePath('foo', 'src/pages/xx/zz.vue'),
                path: '/foo/xx/zz',
                name: 'foo-xx-zz'
              }
            ]
          },
          {
            id: resolveSourcePath('foo', 'src/pages/yy.vue'),
            component: resolveSourcePath('foo', 'src/pages/yy.vue'),
            path: '/foo/yy',
            name: 'foo-yy'
          },
          {
            id: resolveSourcePath('bar', 'src/pages/bar.vue'),
            component: resolveSourcePath('bar', 'src/pages/bar.vue'),
            path: '/bar',
            name: 'bar',
            children: [
              {
                id: resolveSourcePath('bar', 'src/pages/xx/index.vue'),
                component: resolveSourcePath('bar', 'src/pages/xx/index.vue'),
                path: '/bar/xx',
                name: 'bar-xx'
              },
              {
                id: resolveSourcePath('bar', 'src/pages/xx/[id].vue'),
                component: resolveSourcePath('bar', 'src/pages/xx/[id].vue'),
                path: '/bar/xx/:id',
                name: 'bar-xx-id'
              }
            ]
          },
          {
            id: resolveSourcePath('root', 'src/pages/index.vue'),
            component: resolveSourcePath('root', 'src/pages/index.vue'),
            path: '/',
            name: 'root'
          },
          {
            id: resolveSourcePath('root', 'src/pages/login.vue'),
            component: resolveSourcePath('root', 'src/pages/login.vue'),
            path: '/login',
            name: 'login'
          }
        ]
      )
    )
  })
})
