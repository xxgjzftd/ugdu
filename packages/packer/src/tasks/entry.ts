import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { entry } from '../plugins/entry'

/**
 * Build the entry of the project.
 *
 * @remarks
 * It creates the `importmap` and startup script of {@link https://github.com/xxgjzftd/ugdu/blob/main/packages/runtime/README.md | @ugdu/runtime}
 * according to the `module`s of this project. Then inject them to `index.html`.
 *
 * @public
 */
export const buildEntry = series(
  setContext,
  new TaskOptions(
    async function () {
      const {
        manager: { context }
      } = this
      build(
        mergeConfig(
          {
            plugins: [entry(context)]
          },
          context.config.vite
        )
      )
    }
  )
)
