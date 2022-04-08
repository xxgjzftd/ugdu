import { HookDriver } from './hook-driver'

import type { Promisable } from 'type-fest'
import type { BaseHooks } from './hook-driver'

/**
 * `task options` can be seen as a definition of a `task`. It is used to create `task` by calling {@link TaskManager.task}.
 *
 * @remarks
 * The reason why we use the `task`'s definition instead of directly using the `task` itself is that usually we want share our `task`'s definition not the `task` itself.
 *
 * The reason why we need this class rather than a simple object is that we can organize `task options` easily by it's props and methods.
 *
 * The {@link series} and {@link parallel} can help to compose `task options`.
 *
 * @public
 */
export class TaskOptions<Hooks extends BaseHooks<Hooks> = {}, HookName extends keyof Hooks = keyof Hooks> {
  /**
   *
   * @param action - {@link TaskOptions.action}
   * @param hns - {@link TaskOptions.hns}
   * @param hooks - {@link TaskOptions.hooks}
   */
  constructor (action: (this: Task<Hooks, HookName>) => Promisable<void>, hns?: HookName[], hooks?: Partial<Hooks>) {
    this.action = action
    this.hns = hns || []
    this.hooks = hooks || {}
  }

  /**
   * Invoked when the corresponding `task` is running.
   *
   * @readonly
   */
  readonly action: (this: Task<Hooks, HookName>) => Promisable<void>

  /**
   * The `hook name`s that the corresponding `task` could call with.
   *
   * @readonly
   */
  readonly hns: HookName[]

  /**
   * The preset hooks of the corresponding `task`.
   *
   * @remarks
   * We can adjust this prop by invoking {@link TaskOptions.setHooks}.
   *
   */
  hooks: Partial<Hooks>

  /**
   * The children `task options` of this `task options`.
   *
   * @internal @readonly
   */
  children: Array<TaskOptions<any, any> | TaskOptions<any, never>> = []

  /**
   * Adds child to this `task options`.
   *
   * @param child - The child `task options`
   * @returns The reference of `this`
   *
   * @internal
   */
  addChild (child: TaskOptions<any, any> | TaskOptions<any, never>) {
    this.children.push(child)
    return this
  }

  /**
   * Sets hooks of this `task options`.
   *
   * @remarks
   * This method use the hooks you pass in as the hooks of the `task options`.
   * If you want to add instead of replace the hooks, you could call the method like below.
   *
   * @example
   * ```ts
   * setHooks(Object.assign(this.hooks, yourHooks))
   * ```
   *
   * @param hooks - The hooks to be set
   * @returns The reference of `this`
   *
   * @public
   */
  setHooks (hooks: Partial<Hooks>) {
    this.hooks = hooks
    return this
  }
}

/**
 * Used to manage `task`s.
 *
 * @public
 */
export interface TaskManager {
  /**
   * The context of all `task`s.
   * We can access it in {@link Task.action}.
   */
  context: Context
  /**
   * Gets the `task` corresponding to `to` in this `manager`.
   *
   * @param to - `task options`
   * @returns The corresponding `task`
   */
  task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(
    to: TaskOptions<Hooks, HookName>
  ): Task<Hooks, HookName>
}

/**
 * The context of all `task`s.
 *
 * @public
 */
export interface Context {}

/**
 * A subclass of {@link HookDriver}.
 *
 * @remarks
 * Task class can only be instantiated by {@link TaskManager.task} with {@link TaskOptions}.
 *
 * @public
 */
export class Task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks> extends HookDriver<Hooks, HookName> {
  constructor (private readonly _to: TaskOptions<Hooks, HookName>, readonly manager: TaskManager) {
    super(_to.hns)
    this._to = _to
    this.manager = manager
    // @ts-ignore
    _to.children.forEach((child) => this.children.push(manager.task(child)))
    ;(Object.entries(_to.hooks) as [keyof Hooks, Hooks[keyof Hooks]][]).forEach(([name, fn]) => this.hook(name, fn))
  }

  /**
   * The return value of this `task`'s action.
   */
  private _result: Promisable<void> | null = null

  /**
   * Invoked when this `task` is running.
   *
   * @readonly
   */
  get action () {
    return this._to.action
  }

  /**
   * Check whether this `task` is created by the specified `to`.
   *
   * @param to - The `task options` to be test
   * @returns true if it is
   */
  isCreatedBy (to: TaskOptions<any, any>): boolean {
    return this._to === to
  }

  /**
   * Executes this `task`.
   *
   * @remarks
   * By default, invoke this method repeatly will not invoke the action repeatly unless the `force` is specified as true.
   *
   * @param force - Whether to force reruning
   */
  async run (force = false) {
    if (force || this._result === null) {
      this._result = this.action.call(this)
    }
    return this._result
  }
}
