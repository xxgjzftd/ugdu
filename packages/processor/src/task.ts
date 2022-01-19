import { HookDriver } from './hook-driver'

import type { Promisable } from 'type-fest'
import type { BaseHooks } from './hook-driver'

/**
 * Taskoptions can be seen as a definition of a task.
 *
 * @remarks
 * It's instance is used to create {@link Task}.
 * The reason why we need this class is we can organize tasks easily by it's props and methods.
 * The {@link series} and {@link parallel} can help to compose task options.
 *
 * @public
 */
export class TaskOptions<Hooks extends BaseHooks<Hooks> = {}, HookName extends keyof Hooks = keyof Hooks> {
  constructor (action: (this: Task<Hooks, HookName>) => Promisable<void>, hns?: HookName[], hooks?: Partial<Hooks>) {
    this.action = action
    this.hns = hns || []
    this.hooks = hooks || {}
  }

  /**
   * Invoked when the corresponding task is running.
   *
   * @readonly
   */
  readonly action: (this: Task<Hooks, HookName>) => Promisable<void>

  /**
   * Hook names this corresponding task could call with.
   *
   * @readonly
   */
  readonly hns: HookName[]

  /**
   * The hooks of this task options.
   *
   * @remarks
   * We can adjust the hooks by invoking {@link TaskOptions.setHooks}.
   * The hooks of task options actually is the default hooks of the corresponding task.
   *
   */
  hooks: Partial<Hooks>

  /**
   * The children task options of this task options.
   *
   * @internal @readonly
   */
  children: TaskOptions<any, any>[] = []

  /**
   * Add child to this task options.
   *
   * @param child - The child task options
   * @returns The reference of `this`
   *
   * @internal
   */
  addChild (child: TaskOptions<any, any>) {
    this.children.push(child)
    return this
  }

  /**
   * Set hooks of this task options.
   *
   * @remarks
   * This method use the hooks you pass in as the hooks of the task options.
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
 * @internal
 */
export interface TaskManager {
  context: Context
  task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(
    to: TaskOptions<Hooks, HookName>
  ): Task<Hooks, HookName>
}

/**
 * The context of all task instances.
 *
 * @public
 */
export interface Context {}

/**
 * The Task class.
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
    _to.children.forEach((child) => this.children.push(manager.task(child)))
    ;(Object.entries(_to.hooks) as [keyof Hooks, Hooks[keyof Hooks]][]).forEach(([name, fn]) => this.hook(name, fn))
  }

  /**
   * If this task has executed.
   */
  private _executed = false

  /**
   * Invoked when this task is running.
   *
   * @readonly
   */
  get action () {
    return this._to.action
  }

  /**
   * Check whether this task is created by the specified `to`.
   *
   * @param to - The task options to be test
   * @returns true if it is
   */
  isCreatedBy (to: TaskOptions<any, any>): boolean {
    return this._to === to
  }

  /**
   * Executes this task.
   *
   * @remarks
   * By default, invoke this method repeatly will not invoke the action repeatly unless the `force` is specified as true.
   *
   * @param force - Whether to force reruning
   */
  async run (force = false) {
    if (force || !this._executed) {
      this._executed = true
      this.action.call(this)
    }
  }
}
