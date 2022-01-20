import { writeFile } from 'fs/promises'

import { TaskOptions } from '@ugdu/processor'

/**
 * The `write` task options.
 *
 * @remarks
 * This task write the info of this build to disk.
 * The data representation of previous build info is `context.project.meta.pre`.
 * Current build info is `context.project.meta.cur`.
 * The name of the file to be written is `context.CONSTANTS.META_JSON`.
 * The directory name is `context.config.dist`
 *
 * @public
 */
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
    await writeFile(resolve(dist, META_JSON), JSON.stringify(meta.cur))
  }
)
