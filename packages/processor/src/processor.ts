import { Task } from './task'

import type { TaskOptions, TaskManager, Context } from './task'
import type { BaseHooks } from './hook-driver'

/**
 * Used to manage `task`s.
 *
 * @public
 */
export class Processor implements TaskManager {
  /**
   * Holds all `task`s created by this processor.
   */
  private readonly _tasks: Task<any, any>[] = []

  /**
   * {@inheritDoc TaskManager.context}
   */
  readonly context: Context = {}

  /**
   * {@inheritDoc TaskManager.task}
   */
  task <Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(
    to: TaskOptions<Hooks, HookName>
  ): Task<Hooks, HookName> {
    let task = this._tasks.find((task) => task.isCreatedBy(to))
    if (!task) {
      task = new Task(to, this)
      this._tasks.push(task)
    }
    return task
  }
}
