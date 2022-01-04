import { HookDriver } from './hook-driver'

import type { Promisable } from 'type-fest'
import type { BaseHooks } from './hook-driver'

export class TaskOptions<Hooks extends BaseHooks<Hooks> = {}> {
  constructor (
    private readonly _action: (this: Task<Hooks>) => Promisable<void>,
    private _hooks: Partial<Hooks> = {}
  ) {}

  get action () {
    return this._action
  }

  get hooks () {
    return this._hooks
  }

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
  private _result?: Promisable<void>

  constructor (private readonly _to: TaskOptions<Hooks>, readonly manager: TaskManager) {
    super()
    this._to = _to
    this.manager = manager
    _to.parents.forEach((p) => this.parents.push(manager.task(p)))
    ;(Object.entries(_to.hooks) as [keyof Hooks, Hooks[keyof Hooks]][]).forEach(([name, fn]) => this.hook(name, fn))
  }

  get action () {
    return this._to.action
  }

  isCreatedBy (to: TaskOptions<Hooks>): boolean {
    return this._to === to
  }

  async run (force = false) {
    if (force || !this._result) {
      this._result = this.action.call(this)
    }
    return this._result
  }
}
