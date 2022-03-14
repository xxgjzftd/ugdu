<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/processor](./processor.md) &gt; [TaskOptions](./processor.taskoptions.md) &gt; [setHooks](./processor.taskoptions.sethooks.md)

## TaskOptions.setHooks() method

Sets hooks of this `task options`<!-- -->.

<b>Signature:</b>

```typescript
setHooks(hooks: Partial<Hooks>): this;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  hooks | Partial&lt;Hooks&gt; | The hooks to be set |

<b>Returns:</b>

this

The reference of `this`

## Remarks

This method use the hooks you pass in as the hooks of the `task options`<!-- -->. If you want to add instead of replace the hooks, you could call the method like below.

## Example


```ts
setHooks(Object.assign(this.hooks, yourHooks))
```
