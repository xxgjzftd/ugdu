import { Processor } from '@ugdu/processor'

import { setContext } from '../../src/tasks/context'
import { routes } from '../../src/plugins/routes'

import { setVirtualProject } from '../../__mocks__/utils'

import type { Plugin } from 'vite'
import type { PluginContext } from 'rollup'

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

const pc = {} as unknown as PluginContext

let plugin: Plugin

beforeAll(
  () =>
    task.run().then(
      () => {
        plugin = routes(task.manager.context)
      }
    )
)

describe('The resolveId', () => {
  it('should return CONSTANTS.ROUTES when source is CONSTANTS.ROUTES_INPUT', () => {
    const {
      manager: {
        context: {
          CONSTANTS: { ROUTES, ROUTES_INPUT }
        }
      }
    } = task
    expect(plugin.resolveId!.call(pc, ROUTES_INPUT, undefined, {})).toBe(ROUTES)
  })

  it('should return the source itself if the source is routes module(i.e. CONSTANTS.ROUTES)', () => {
    const {
      manager: {
        context: {
          CONSTANTS: { ROUTES, ROUTES_INPUT }
        }
      }
    } = task
    expect(plugin.resolveId!.call(pc, ROUTES, ROUTES_INPUT, {})).toBe(ROUTES)
  })
})

describe('The load hook', () => {
  it('should return the genetered routes code', async () => {
    const {
      manager: {
        context,
        context: {
          CONSTANTS: { ROUTES },
          project,
          utils: { getLocalModuleName, stringify }
        }
      }
    } = task
    context.building = true
    await expect(plugin.load!.call(pc, ROUTES)).resolves.toBe(
      `export default ${stringify(
        project.routes,
        (key, value) => {
          if (key === 'component') {
            return `()=>ur.load("${getLocalModuleName(value)}")`
          }
        }
      )}`
    )
    context.building = false
    await expect(plugin.load!.call(pc, ROUTES)).resolves.toBe(
      `export default ${stringify(
        project.routes,
        (key, value) => {
          if (key === 'component') {
            return `()=>import("${'/' + value}")`
          }
        }
      )}`
    )
  })
})
