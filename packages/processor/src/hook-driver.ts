/**
 * The type of hooks.
 *
 * @remarks
 * - `first` means the hook fns run sequentially until a hook fn returns a value other than `null` or `undefined`.
 * - `sequential` is as same as the `first` except that all of the hook fns will be run.
 * - `parallel` also run all of the hook fns but in parallel mode.
 * @public
 */
export type HookType = 'first' | 'sequential' | 'parallel'

/**
 * Hook fn must be a function.
 * @public
 */
export type HookFn = (...args: any[]) => any

/**
 * The key of Hooks is `hook name`.
 * The value of Hooks is `hook fn`.
 * @public
 */
export type BaseHooks<T extends {} = {}> = Record<keyof T, HookFn>

/**
 * The HookDriver class.
 *
 * @public
 */
export class HookDriver<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks = keyof Hooks> {
  constructor (_hns?: HookName[]) {
    this._hns = _hns || []
    const _hn2hfm = {} as { [Name in HookName]: Hooks[Name][] }
    this._hns.forEach((hn) => (_hn2hfm[hn] = []))
    this._hn2hfm = _hn2hfm
  }

  /**
   * Hook names this hook driver could call with.
   */
  private readonly _hns: HookName[]

  /**
   * Hook name to hook fns map.
   */
  private readonly _hn2hfm: { [Name in HookName]: Hooks[Name][] }

  /**
   * The children of this hook driver.
   * User could hook in the children hook driver by invoking the {@link HookDriver.hook} method of the parent.
   */
  children: HookDriver<any, any>[] = []

  /**
   *
   * @param name - The hook name
   * @returns The hook driver which is responsible for invoking the corresponding hook function
   */
  private _getTarget <Name extends keyof Hooks>(name: Name): HookDriver<any, any> | void {
    if (this._hns.includes(name as unknown as HookName)) {
      return this
    } else {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i]
        let target = child._getTarget(name)
        if (target) {
          return target
        }
      }
    }
  }

  /**
   *
   * @param name - The hook name this hook driver could call with
   * @returns The corresponding hook fns
   */
  private _hfs <Name extends HookName>(name: Name) {
    return this._hn2hfm[name]
  }

  /**
   *
   * @param name - The hook name
   * @returns The corresponding hook fns
   */
  hfs <Name extends keyof Hooks>(name: Name): Hooks[Name][] {
    const target = this._getTarget(name)
    if (!target) {
      throw new Error(`Hook name '${name}' doesn't exist in this hook driver.`)
    }
    return target._hfs(name)
  }

  /**
   *
   * @param name - The hook name
   * @param fn - The hook fn
   * @param prepend - Whether to prepend
   * @returns The hook driver instance for chained calls
   */
  private _hook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name], prepend: boolean) {
    const hfs = this.hfs(name)
    prepend ? hfs.unshift(fn) : hfs.push(fn)
    return this
  }

  /**
   * Append `fn` to hook fns.
   * @param name - The hook name
   * @param fn - The hook fn
   * @returns The hook driver instance for chained calls
   */
  hook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    return this._hook(name, fn, false)
  }

  /**
   * Prepend `fn` to hook fns.
   * @param name - The hook name
   * @param fn - The hook fn
   * @returns The hook driver instance for chained calls
   */
  prepend <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    return this._hook(name, fn, true)
  }

  /**
   * Remove `fn` from hook fns.
   * @param name - The hook name
   * @param fn - The hook fn
   * @returns The hook driver instance for chained calls
   */
  unhook <Name extends keyof Hooks>(name: Name, fn: Hooks[Name]) {
    const hfs = this.hfs(name)
    let index = hfs.lastIndexOf(fn)
    if (~index) {
      hfs.splice(index, 1)
    }
    return this
  }

  /**
   *
   * @param name - The hook name this hook driver could call with
   * @param type - The hook type (cf.{@link HookType})
   * @param args - The args of the hook fn
   * @returns The return value of the hook fn if `type` is `first` else return nothing
   */
  async call <Name extends HookName, T extends HookType>(
    name: Name,
    type: T,
    ...args: Parameters<Hooks[Name]>
  ): // @ts-ignore
  Promise<T extends 'first' ? ReturnType<Hooks[Name]> : void> {
    const hfs = this._hfs(name)
    switch (type) {
      case 'first':
        let value = null
        for (const fn of hfs) {
          value = await fn.call(this, ...args)
          if (value != null) {
            break
          }
        }
        return value
      case 'sequential':
        for (const fn of hfs) {
          await fn.call(this, ...args)
        }
        break
      case 'parallel':
        await Promise.all(hfs.map((fn) => fn.call(this, ...args)))
        break
      default:
        throw new Error(`Illegal hook type '${type}'. Only 'first', 'sequential' and 'parallel' are allowed.`)
    }
  }
}
