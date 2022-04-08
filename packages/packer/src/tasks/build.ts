import { parallel, series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { buildLocalModules } from './local'
import { buildRoutesModule } from './routes'
import { buildVendorModules } from './vendor'
import { buildEntry } from './entry'
import { write } from './write'

const setBuilding = new TaskOptions(
  function () {
    this.manager.context.building = true
  }
)

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
 * - {@link buildLocalModules | `build local module`} and {@link buildRoutesModule | `build routes module`} (in `parallel` mode)
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
  setBuilding,
  setContext,
  parallel(buildLocalModules, buildRoutesModule),
  buildVendorModules,
  buildEntry,
  write
)
