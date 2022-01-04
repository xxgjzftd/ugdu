import { series, TaskOptions } from '@ugdu/processor'
import { build, mergeConfig } from 'vite'

import { setContext } from './context'
import { entry } from './plugins/entry'

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
