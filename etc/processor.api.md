## API Report File for "@ugdu/processor"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import type { Promisable } from 'type-fest';
import type { UnionToIntersection } from 'type-fest';

// @public
export type BaseHooks<T extends {} = {}> = Record<keyof T, HookFn>;

// @public
export interface Context {
}

// @public
export class HookDriver<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks = keyof Hooks> {
    constructor(_hns?: HookName[]);
    call<Name extends HookName, T extends HookType>(name: Name, type: T, ...args: Parameters<Hooks[Name]>): Promise<T extends 'first' ? ReturnType<Hooks[Name]> : void>;
    children: HookDriver<any, any>[];
    // (undocumented)
    hfs<Name extends keyof Hooks>(name: Name): Hooks[Name][];
    hook<Name extends keyof Hooks>(name: Name, fn: Hooks[Name]): this;
    prepend<Name extends keyof Hooks>(name: Name, fn: Hooks[Name]): this;
    unhook<Name extends keyof Hooks>(name: Name, fn: Hooks[Name]): this;
}

// @public (undocumented)
export type HookFn = (...args: any[]) => any;

// @public (undocumented)
export type HookType = 'first' | 'sequential' | 'parallel';

// Warning: (ae-forgotten-export) The symbol "ParentTaskOptions" needs to be exported by the entry point index.d.ts
//
// @public
export const parallel: <T extends TaskOptions<any, any>[]>(...children: T) => ParentTaskOptions<T>;

// @public
class Processor implements TaskManager {
    readonly context: Context;
    task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(to: TaskOptions<Hooks, HookName>): Task<Hooks, HookName>;
}
export { Processor }
export default Processor;

// @public
export const series: <T extends TaskOptions<any, any>[]>(...children: T) => ParentTaskOptions<T>;

// @public
export class Task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks> extends HookDriver<Hooks, HookName> {
    constructor(_to: TaskOptions<Hooks, HookName>, manager: TaskManager);
    get action(): (this: Task<Hooks, HookName>) => Promisable<void>;
    isCreatedBy(to: TaskOptions<any, any>): boolean;
    // (undocumented)
    readonly manager: TaskManager;
    run(force?: boolean): Promise<void>;
}

// @public
export interface TaskManager {
    context: Context;
    task<Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(to: TaskOptions<Hooks, HookName>): Task<Hooks, HookName>;
}

// @public
export class TaskOptions<Hooks extends BaseHooks<Hooks> = {}, HookName extends keyof Hooks = keyof Hooks> {
    constructor(action: (this: Task<Hooks, HookName>) => Promisable<void>, hns?: HookName[], hooks?: Partial<Hooks>);
    readonly action: (this: Task<Hooks, HookName>) => Promisable<void>;
    // @internal
    addChild(child: TaskOptions<any, any>): this;
    // @internal
    children: TaskOptions<any, any>[];
    readonly hns: HookName[];
    hooks: Partial<Hooks>;
    setHooks(hooks: Partial<Hooks>): this;
}

```