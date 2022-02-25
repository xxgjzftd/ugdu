A task processor which could be hooked in.

## Usage

```ts
import { writeFile } from 'fs/promises'

import { Processor, TaskOptions, series } from '@ugdu/processor'

declare module '@ugdu/processor' {
  interface Context {
    data: string
  }
}

interface WriteHooks {
  'before-write'(data: string): void
  'after-write'(data: string): void
}

const setData = new TaskOptions(
  function () {
    const data = 'xx'
    this.manager.context.data = data
  }
)

const write = new TaskOptions<WriteHooks>(
  // The `action` which will be invoked when the corresponding `task` is running.
  async function () {
    const {
      manager: {
        context: { data }
      }
    } = this
    this.call('before-write', 'sequential', data)
    await writeFile('/path/to/target/file', data)
    this.call('after-write', 'sequential', data)
  },
  // The `hook name`s that the corresponding `task` could call with.
  ['before-write', 'after-write'],
  // The preset hooks of the corresponding `task`.
  {
    'before-write' (data) {
      console.log(data)
    }
  }
)

const to = series(setData, write)

const processor = new Processor()

const task = processor.task(to)

task.hook('before-write', () => console.log('before ~'))
task.hook('after-write', () => console.log('after ~'))

task.run()

// Will log
// 'xx'
// 'before ~'
// 'after ~'
```
