import type { CONSTANTS } from './constants'
import type { Config } from './config'
import type { Project } from './project'
import type { Utils } from './utils'

declare module '@ugdu/processor' {
  interface Context {
    CONSTANTS: CONSTANTS
    config: Config
    project: Project
    utils: Utils
    building: boolean
  }
}
