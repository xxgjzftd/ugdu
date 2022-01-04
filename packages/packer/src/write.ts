import { writeFile } from 'fs/promises'

import { TaskOptions } from '@ugdu/processor'

export const write = new TaskOptions(
  async function () {
    const {
      manager: {
        context: {
          CONSTANTS: { META_JSON },
          config: { dist },
          project: { meta },
          utils: { resolve }
        }
      }
    } = this
    this.manager.context.config
    await writeFile(resolve(dist, META_JSON), JSON.stringify(meta.cur))
  }
)
