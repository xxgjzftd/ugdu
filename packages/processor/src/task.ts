import { HookDriver } from './hook-driver'

import type { Promisable } from 'type-fest'
import type { BaseHooks } from './hook-driver'

/**
 * Taskoptions can be seen as a definition of a task.
 *
 * @remarks
 * It's instance is used to create {@link Task}.
 * The reason why we need this class is we can organize tasks easily by it's props and methods.
 *
 * @public
 */
export class TaskOptions<Hooks extends BaseHooks<Hooks> = {}> {
  constructor (
    private readonly _action: (this: Task<Hooks>) => Promisable<void>,
    private _hooks: Partial<Hooks> = {}
  ) {}

  /**
   * Invoked when the corresponding task is running.
   *
   * @readonly
   */
  get action () {
    return this._action
  }

  /**
   * The hooks of this task options.
   *
   * @remarks
   * We can adjust the hooks by {@link TaskOptions.setHooks}.
   * The hooks of task options actually is the default hooks of the corresponding task.
   *
   * @readonly
   */
  get hooks () {
    return this._hooks
  }

  /**
   * The parent task options of this task options.
   *
   * @remarks
   * When the corresponding task is running the hooks hooked on the task of the parent task options should be invoked.
   *
   * @internal @readonly
   */
  parents: TaskOptions<Hooks>[] = []

  /**
   * Add parent to this task options.
   *
   * @param parent - The parent task options
   * @returns The reference of `this`
   *
   * @internal
   */
  addParent (parent: TaskOptions<Hooks>) {
    this.parents.push(parent)
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
    this._hooks = hooks
    return this
  }
}

/**
 * @internal
 */
export interface TaskManager {
  context: Context
  task<Hooks extends BaseHooks<Hooks> = {}>(to: TaskOptions<Hooks>): Task<Hooks>
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
export class Task<Hooks extends BaseHooks<Hooks> = {}> extends HookDriver<Hooks> {
  /**
   * If this task has executed.
   */
  private _executed = false

  constructor (private readonly _to: TaskOptions<Hooks>, readonly manager: TaskManager) {
    super()
    this._to = _to
    this.manager = manager
    _to.parents.forEach((p) => this.parents.push(manager.task(p)))
    ;(Object.entries(_to.hooks) as [keyof Hooks, Hooks[keyof Hooks]][]).forEach(([name, fn]) => this.hook(name, fn))
  }

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
  isCreatedBy (to: TaskOptions<Hooks>): boolean {
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
