import { parallel } from '@ugdu/processor'

import { setConfig } from './config'
import { setConstants } from './constants'
import { setProject } from './project'
import { setUtils } from './utils'

/**
 * Sets `context`. It contains the following sub `task options`
 * {@link setConstants | `set constants`},
 * {@link setConfig | `set config`},
 * {@link setProject | `set project`} and
 * {@link setUtils | `set utils`}(in `parallel` mode).
 *
 * @public
 */
export const setContext = parallel(setConstants, setConfig, setProject, setUtils)
