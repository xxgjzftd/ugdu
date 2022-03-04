A task processor which could be hooked in.

## Features

- Delegation
  - Can hook into the children `hook dirver` through the parent `hook dirver`.
- Shareable
  - Can create a `task options` which can be seen as a definition of a `task`. Others can use it to create `task`s.
- Extensible
  - Can extend the `task options` easily.
- Composable
  - Can compose the parent `task options` with children `task options` in series or parallel mode with your need.
- Preset hooks
  - Can preset `hook fn`s for `task options`.

## Usage

Below is a simple example of a `task` which sets data to the `context`, writes the data to disk, and calls the `hook`s at the same time.

For more detail, check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/processor.md).

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
