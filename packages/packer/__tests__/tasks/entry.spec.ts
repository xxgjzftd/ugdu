import { beforeAll, expect, it } from 'vitest'
import { build, mergeConfig } from 'vite'
import { Processor } from '@ugdu/processor'

import { buildEntry } from 'src/tasks/entry'

const processor = new Processor()
const task = processor.task(buildEntry)
task.hook(
  'get-config',
  () => ({
    apps: [],
    extensions: [],
    meta: 'local',
    vite: { define: { xx: '"xx"' } }
  })
)

beforeAll(() => task.run())

it('should invoke vite.build with mergeConfig(defaultConfig, config.vite)', () => {
  expect(build).toBeCalledWith(expect.objectContaining(mergeConfig({}, task.manager.context.config.vite)))
})
