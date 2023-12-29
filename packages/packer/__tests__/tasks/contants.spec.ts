import { expect, it } from 'vitest'
import { Processor } from '@ugdu/processor'

import { CONSTANTS, setConstants } from 'src/tasks/constants'

it('should set built-in CONSTANTS to `context.CONSTANTS`', async () => {
  const task = new Processor().task(setConstants)
  await task.run()
  expect(task.manager.context.CONSTANTS).toEqual(CONSTANTS)
})
