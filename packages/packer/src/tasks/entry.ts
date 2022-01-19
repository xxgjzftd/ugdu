import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { entry } from '../plugins/entry'

/**
 * @remarks
 * This task build the entry of the project.
 *
 * @public
 */
export const buildEntryModule = series(
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
