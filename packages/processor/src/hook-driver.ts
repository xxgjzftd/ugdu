/**
 * The type of hooks.
 *
 * @remarks
 * - `first` means the hook fns are run sequentially until a hook fn returns a value other than `null` or `undefined`.
 * - `sequential` as same as the `first` except that all of the hook fns will be run.
 * - `parallel` also run all of the hook fns but in parallel mode.
 * @public
 */
export type HookType = 'first' | 'sequential' | 'parallel'

/**
 * @public
 */
export type HookFn = (...args: any[]) => any

/**
 * @public
 */
export type BaseHooks<T extends {} = {}> = Record<keyof T, HookFn>

/**
 * The HookDriver class.
 *
 * @public
 */
export class HookDriver<Hooks extends BaseHooks<Hooks>> {
  /**
   * Hook name to hook fns map.
   */
  private _hn2hfm: { [Name in keyof Hooks]?: Hooks[Name][] } = {}

  /**
   * @internal
   */
  parents: HookDriver<Hooks>[] = []

  private _fns <Name extends keyof Hooks>(name: Name): Hooks[Name][] {
    let fns = this._hn2hfm[name]
    if (!fns) {
      fns = []
      this._hn2hfm[name] = fns
    }
    return fns
  }

  fns <Name extends keyof Hooks>(name: Name) {
    return [...this._fns(name)]
  }

  allFns <Name extends keyof Hooks>(name: Name) {
    const fns = this.fns(name)
    this.parents.forEach(
      (parent) => {
        fns.push(...parent.allFns(name))
      }
    )
    return fns
  }

  private _hook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name], prepend = false) {
    const fns = this._fns(name)
    prepend ? fns.unshift(fn) : fns.push(fn)
    return this
  }

  hook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    this._hook(name, fn)
    return this
  }

  prepend <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    this._hook(name, fn, true)
    return this
  }

  unhook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    const fns = this._fns(name)
    let index = fns.lastIndexOf(fn)
    if (~index) {
      fns.splice(index, 1)
    }
    return this
  }

  unhookAll <Name extends keyof Hooks>(name?: Name) {
    if (name) {
      this._hn2hfm[name] = []
    } else {
      this._hn2hfm = {}
    }
    return this
  }

  async call <Name extends keyof Hooks, T extends HookType>(
    name: Name,
    type: T,
    ...args: Parameters<Hooks[Name]>
  ): // @ts-ignore
  Promise<T extends 'first' ? ReturnType<Hooks[Name]> : void> {
    const fns = this.allFns(name)
    switch (type) {
      case 'first':
        let value = null
        for (const fn of fns) {
          value = await fn.call(this, ...args)
          if (value != null) {
            break
          }
        }
        return value
      case 'sequential':
        for (const fn of fns) {
          await fn.call(this, ...args)
        }
        break
      case 'parallel':
        await Promise.all(fns.map((fn) => fn.call(this, ...args)))
        break
      default:
        throw new Error(`Illegal hook type '${type}'. Only 'first', 'sequential' and 'parallel' are allowed.`)
    }
  }
}
