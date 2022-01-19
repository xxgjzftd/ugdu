import type { CONSTANTS } from '../tasks/constants'
import type { Config } from '../tasks/config'
import type { Project } from '../tasks/project'
import type { Utils } from '../tasks/utils'

declare module '@ugdu/processor' {
  interface Context {
    CONSTANTS: CONSTANTS
    config: Config
    project: Project
    utils: Utils
    building: boolean
  }
}
