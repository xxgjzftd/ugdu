import { parallel } from '@ugdu/processor'

import { setConfig } from './config'
import { setConstants } from './constants'
import { setProject } from './project'

/**
 * Sets `context`. It contains the following sub `task options`
 * {@link setConstants | `set constants`},
 * {@link setConfig | `set config`},
 * {@link setProject | `set project`}
 *
 * @public
 */
export const setContext = parallel(setConstants, setConfig, setProject)
