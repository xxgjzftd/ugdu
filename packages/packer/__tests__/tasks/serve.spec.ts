import { beforeAll, expect, it } from 'vitest'
import { Processor } from '@ugdu/processor'
import { createServer, mergeConfig } from 'vite'

import { serve } from 'src'

import type { UserConfig } from 'src'

const processor = new Processor()
const task = processor.task(serve)
const config: UserConfig = {
  apps: [
    { name: 'foo', packages: ['foo'], vite: { define: { foo: '"foo"' } } },
    { name: 'bar', packages: ['bar'], vite: { define: { bar: '"bar"' } } }
  ],
  extensions: [],
  meta: 'local',
  vite: { define: { xx: '"xx"' } }
}
task.hook('get-config', () => config)

beforeAll(() => task.run())

it('should invoke vite.createServer for each app with mergeConfig(defaultConfig, mergeConfig(config.vite, app.vite))', () => {
  expect(createServer).toHaveBeenCalledTimes(2)
  const {
    manager: {
      context: {
        config,
        project: { alias }
      }
    }
  } = task
  config.apps.forEach(
    (app) => {
      const dc = {
        resolve: {
          alias
        }
      }
      expect(createServer).toBeCalledWith(expect.objectContaining(mergeConfig(dc, mergeConfig(config.vite, app.vite))))
    }
  )
})
