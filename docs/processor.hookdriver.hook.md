<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/processor](./processor.md) &gt; [HookDriver](./processor.hookdriver.md) &gt; [hook](./processor.hookdriver.hook.md)

## HookDriver.hook() method

Appends `fn` to `hook fn`<!-- -->s.

<b>Signature:</b>

```typescript
hook<Name extends keyof Hooks>(name: Name, fn: Hooks[Name]): this;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  name | Name | The <code>hook name</code> this <code>hook driver</code> or its descendants could call with |
|  fn | Hooks\[Name\] | The <code>hook fn</code> |

<b>Returns:</b>

this

The `hook driver` for chained calls
