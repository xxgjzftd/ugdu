import { parallel, series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { buildLocalModules } from './local'
import { buildRoutesModules } from './routes'
import { buildVendorModules } from './vendor'
import { buildEntryModule } from './entry'
import { write } from './write'

export const build = series(
  new TaskOptions(
    function setBuilding () {
      this.manager.context.building = true
    }
  ),
  setContext,
  parallel(buildLocalModules, buildRoutesModules),
  buildVendorModules,
  buildEntryModule,
  write
)
