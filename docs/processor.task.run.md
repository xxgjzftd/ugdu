<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/processor](./processor.md) &gt; [Task](./processor.task.md) &gt; [run](./processor.task.run.md)

## Task.run() method

Executes this `task`<!-- -->.

<b>Signature:</b>

```typescript
run(force?: boolean): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  force | boolean | Whether to force reruning |

<b>Returns:</b>

Promise&lt;void&gt;

## Remarks

By default, invoke this method repeatly will not invoke the action repeatly unless the `force` is specified as true.

