import { parallel } from '@ugdu/processor'

import { setConfig } from './config'
import { setConstants } from './constants'
import { setProject } from './project'
import { setUtils } from './utils'

export const setContext = parallel(setConstants, setConfig, setProject, setUtils)
