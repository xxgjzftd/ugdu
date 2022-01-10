/**
 * Returns a function that could cache the result of `fn` according to the first parameter of `fn`.
 *
 * @remark
 * Calling this function repeatedly with the same first argument will return the same result even if the other arguments are different.
 *
 * @param fn - The origin function
 * @returns The cached version function
 */
export const cached = <T extends (this: any, string: string, ...args: any[]) => any>(fn: T) => {
  const cache: Record<string, ReturnType<T>> = Object.create(null)
  return function (string, ...args) {
    return cache[string] || (cache[string] = fn.call(this, string, ...args))
  } as T
}

/**
 * Get default export of the CommonJS module.
 *
 * @remark
 * When importing CommonJS modules in esm world, the module.exports object is provided as the default export.
 * While ts compiler consider the module.exports.default is the default export in some specific CommonJS modules.
 * So we need this helper.
 *
 * @param m - The CommonJS module
 * @returns The default export of the `m` or the `m` itself if the default export doesn't exist
 */
export const getDefault = <T>(m: T) => (m as { default?: T }).default ?? m
