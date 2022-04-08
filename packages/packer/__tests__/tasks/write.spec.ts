import { writeFile } from 'fs/promises'

import { Processor } from '@ugdu/processor'

import { write } from '../../src/tasks/write'

jest.mock('fs/promises')

it('should write the info of this build to disk', async () => {
  const processor = new Processor()
  const task = processor.task(write)
  task.hook('get-config', () => ({ apps: [], extensions: [], meta: 'local', dist: 'xx' }))
  await task.run()

  const {
    manager: {
      context: {
        CONSTANTS: { META_JSON },
        config: { dist },
        project: { meta },
        utils: { resolve }
      }
    }
  } = task

  expect(writeFile).toBeCalledWith(resolve(dist, META_JSON), JSON.stringify(meta.cur))
})
