import { Processor } from '@ugdu/processor'
import { resolve } from 'path'

import { setContext } from '../../src/tasks/context'
import { local } from '../../src/plugins/local'

import { setVirtualProject, resolveSourceAbsolutePath, resolveSourcePath } from '../../__mocks__/utils'

import type { Plugin } from 'vite'
import type { PluginContext } from 'rollup'
import type { Utils } from '../../src/tasks/utils'

jest.mock(
  'vite',
  () => ({
    ...jest.requireActual('vite'),
    build: jest.fn()
  })
)

const cwd = '/path/to/project'

const entry = {
  name: 'entry',
  main: 'src/index.ts',
  sources: ['src/index.ts', 'src/app.vue']
}

const foo = {
  name: 'foo',
  sources: ['src/pages/xx.vue', 'src/components/button.vue', 'src/assets/xx.png']
}

const bar = {
  name: 'bar',
  sources: ['src/pages/xx.vue', 'src/components/button.vue', 'src/assets/xx.png']
}

const lps = [entry, foo, bar]

setVirtualProject(lps, cwd)

const processor = new Processor()
const task = processor.task(setContext)
task.hook(
  'get-config',
  () => ({
    cwd,
    apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name) }],
    extensions: ['vue', 'ts'],
    meta: 'local'
  })
)

const pc = {
  resolve (source: string, importer: string) {
    return {
      id: resolve(importer, source),
      external: false
    }
  }
} as unknown as PluginContext

let plugin: Plugin
let utils: Utils

const lmn = 'foo/src/pages/xx.vue'
const importer = resolveSourceAbsolutePath('foo', 'src/pages/xx.vue')

beforeAll(
  () =>
    task.run().then(
      () => {
        plugin = local(lmn, task.manager.context)
        utils = task.manager.context.utils
      }
    )
)

it('should have a enforce property with a value of `pre`', () => {
  expect(plugin.enforce).toBe('pre')
})

describe('The resolveId hook', () => {
  it('should return null if importer is undefined', async () => {
    await expect(plugin.resolveId!.call(pc, importer, undefined, {})).resolves.toBe(null)
  })

  it('should resolve relative `source`s correctly', async () => {
    const source = '../assets/xx.png'
    await expect(plugin.resolveId!.call(pc, source, importer, {})).resolves.toEqual(pc.resolve(source, importer))
  })

  it('should resolve absolute `source`s correctly', async () => {
    const source = resolveSourceAbsolutePath('foo', 'src/assets/xx.png')
    await expect(plugin.resolveId!.call(pc, source, importer, {})).resolves.toEqual(pc.resolve(source, importer))
  })

  it('should resove `module`s correctly', async () => {
    const source = resolveSourceAbsolutePath('foo', 'src/components/button.vue')
    await expect(plugin.resolveId!.call(pc, source, importer, {})).resolves.toEqual(
      { id: utils.getLocalModuleName(utils.getNormalizedPath(source)), external: true }
    )
  })

  it('should throw an error if import `source`s or `module`s from other packages', async () => {
    let source = resolveSourceAbsolutePath('bar', 'src/assets/xx.png')
    await expect(plugin.resolveId!.call(pc, source, importer, {})).rejects.toThrow()
    source = resolveSourceAbsolutePath('bar', 'src/pages/xx.vue')
    await expect(plugin.resolveId!.call(pc, source, importer, {})).rejects.toThrow()
  })

  it('should record what `source`s this module depend on to the build info', async () => {
    expect(utils.getMetaModule(lmn).sources).toEqual([resolveSourcePath('foo', 'src/assets/xx.png')])
  })

  it('should not include the entry file in the `sources`', async () => {
    let plugin = local('entry', task.manager.context)
    await plugin.resolveId!.call(
      pc,
      resolveSourceAbsolutePath('entry', 'src/app.vue'),
      resolveSourceAbsolutePath('entry', 'src/index.ts'),
      {}
    )
    await plugin.resolveId!.call(
      pc,
      resolveSourceAbsolutePath('entry', 'src/index.ts'),
      resolveSourceAbsolutePath('entry', 'src/app.vue'),
      {}
    )
    expect(utils.getMetaModule('entry').sources).toEqual([resolveSourcePath('entry', 'src/app.vue')])
  })
})
