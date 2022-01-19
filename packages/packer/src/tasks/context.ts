import { parallel } from '@ugdu/processor'

import { setConfig } from './config'
import { setConstants } from './constants'
import { setProject } from './project'
import { setUtils } from './utils'

/**
 * @remarks
 * A encapsulation of
 * - set constants
 * - set config
 * - set project
 * - set utils
 * @public
 */
export const setContext = parallel(setConstants, setConfig, setProject, setUtils)
