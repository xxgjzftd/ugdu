import { TaskOptions } from '@ugdu/processor'
import { resolve } from 'path/posix'

declare module '@ugdu/processor' {
  interface Context {
    CONSTANTS: typeof CONSTANTS
  }
}

export const CONSTANTS = {
  META_JSON: 'meta.json',
  PACKAGE_JSON: 'package.json',
  BINDING_NAME_SEP: '$ugdu',
  PACKAGE_NAME_SEP: '$ugdu',
  VERSIONED_VENDOR_SEP: '@',
  ROUTES: 'routes',
  ROUTES_INPUT: resolve('routes'),
  VENDOR: 'vendor',
  VENDOR_INPUT: resolve('vendor')
} as const

export const setConstants = new TaskOptions(
  function () {
    this.manager.context.CONSTANTS = CONSTANTS
  }
)
