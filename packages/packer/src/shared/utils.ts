/**
 * Returns a function that could cache the result of `fn` according to the argument of `fn`.
 *
 * @param fn - The origin function
 * @returns The cached version function
 *
 * @public
 */
export const cached = <T extends (this: any, string: string) => any>(fn: T) => {
  const cache: Record<string, ReturnType<T>> = Object.create(null)
  return function (string) {
    return cache[string] || (cache[string] = fn.call(this, string))
  } as T
}

/**
 * Get default export of the CommonJS module.
 *
 * @remark
 * When importing CommonJS modules from esm module, the module.exports object is provided as the default export.
 * While ts compiler consider the module.exports.default is the default export in some specific CommonJS modules.
 * So we need this helper.
 *
 * @param m - The CommonJS module
 * @returns The default export of the `m` or the `m` itself if the default export doesn't exist
 *
 * @internal
 */
export const getDefault = <T>(m: T) => (m as { default?: T }).default ?? m

/**
 * Deep clone a `target`.
 *
 * @param target - The target
 * @returns The cloned result
 *
 * @internal
 */
export const clone = <T>(target: T) => {
  let result: any
  switch (typeof target) {
    case 'object':
      if (Array.isArray(target)) {
        result = []
      } else {
        result = {}
      }
      Object.entries(target).forEach(([key, value]) => (result[key] = clone(value)))
      break
    default:
      result = target
      break
  }
  return result as T
}
