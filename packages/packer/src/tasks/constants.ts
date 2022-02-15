import { TaskOptions } from '@ugdu/processor'
import { resolve } from 'path'

/**
 * @internal
 */
export const CONSTANTS = {
  /**
   * The filename of the file which store previous build info.
   */
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

/**
 * @internal
 */
export type CONSTANTS = typeof CONSTANTS

/**
 * @public
 */
export const setConstants = new TaskOptions(
  function () {
    this.manager.context.CONSTANTS = CONSTANTS
  }
)
