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
