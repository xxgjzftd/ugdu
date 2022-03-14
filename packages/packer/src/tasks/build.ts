import { parallel, series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { buildLocalModules } from './local'
import { buildRoutesModules } from './routes'
import { buildVendorModules } from './vendor'
import { buildEntry } from './entry'
import { write } from './write'

/**
 * Builds project for production.
 *
 * @remarks
 * It contains the following sub `task options`(in `series` mode).
 *
 * - set `context.building` to `true`
 *
 * - {@link setContext | `set context`}
 *
 * - {@link buildLocalModules | `build local module`} and {@link buildRoutesModules | `build routes module`} (in `parallel` mode)
 *
 * - {@link buildVendorModules | `build vendor module`}
 *
 * - {@link buildEntry | `build entry`}
 *
 * - {@link write | write the info of this build to disk}
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
  buildEntry,
  write
)
