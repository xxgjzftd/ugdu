import { parallel, series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { buildLocalModules } from './local'
import { buildRoutesModules } from './routes'
import { buildVendorModules } from './vendor'
import { buildEntryModule } from './entry'
import { write } from './write'

/**
 * The `build` task options.
 *
 * @remarks
 * This task contains the following subtasks
 * - set `context.building` to `true`
 * - set `context`
 * - build `local module` and `routes module` in parallel
 * - build `vendor module`
 * - build `entry module`
 * - write the info of this build to disk
 *
 * @public
 */
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
