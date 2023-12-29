import { expect, it } from 'vitest'
import { Processor } from '@ugdu/processor'

import { setConfig } from 'src/tasks/config'

import type { UserConfig } from 'src'

it('should throw an error if there is not a hook function which hooks into the get-config hook and returns a config', async () => {
  const task = new Processor().task(setConfig)
  await expect(task.run()).rejects.toThrow()
})

it("should get user's config from get-config hook and normalizes it, then set it to context.config", async () => {
  const task = new Processor().task(setConfig)
  const uc: UserConfig = {
    cwd: '/path/to/project',
    apps: [{ name: '@xx/container', packages: (lp) => lp.map((p) => p.name) }],
    extensions: ['ts', 'tsx'],
    meta: 'local'
  }
  task.hook('get-config', () => uc)
  await task.run()
  expect(task.manager.context.config).toMatchSnapshot()
})
